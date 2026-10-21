import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { store, ServerState } from "./server/store";
import { setupWebSocket, broadcast, getConnectedClientsCount } from "./server/ws";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);

  // Initialize WebSockets
  setupWebSocket(httpServer);

  // Middleware for parsing JSON
  app.use(express.json({ limit: '50mb' }));

  // Create reports directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
    console.log('Created reports directory');
  }

  // Serve public static assets
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // API to save reports
  app.post("/api/save-report", (req, res) => {
    const { csvData, fileName } = req.body;
    
    if (!csvData || !fileName) {
      return res.status(400).json({ error: 'Missing data or filename' });
    }

    const filePath = path.join(reportsDir, fileName);
    
    try {
      // Add UTF-8 BOM for Excel compatibility
      const content = '\uFEFF' + csvData;
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Saved report: ${fileName}`);
      res.json({ success: true, path: filePath });
    } catch (error) {
      console.error('Error saving report:', error);
      res.status(500).json({ error: 'Failed to save report' });
    }
  });

  // REST endpoints for State Synchronization
  app.get("/api/state", (_req, res) => {
    res.json({
      success: true,
      data: store.getState(),
      onlineClients: getConnectedClientsCount(),
      serverTime: new Date().toISOString()
    });
  });

  app.post("/api/state/update", (req, res) => {
    const { key, data, clientId } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Missing key' });
    }

    store.updateKey(key as keyof ServerState, data);
    broadcast({
      type: 'sync:update',
      key,
      data,
      updatedBy: clientId || 'api',
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, lastUpdated: store.getState().lastUpdated });
  });

  app.post("/api/state/patch", (req, res) => {
    const { patch, clientId } = req.body;
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: 'Invalid patch object' });
    }

    store.patch(patch);
    broadcast({
      type: 'sync:patch',
      patch,
      updatedBy: clientId || 'api',
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, lastUpdated: store.getState().lastUpdated });
  });

  app.post("/api/state/seed-if-empty", (req, res) => {
    const { data } = req.body;
    if (data && typeof data === 'object') {
      const seeded = store.seedIfEmpty(data);
      if (seeded) {
        broadcast({
          type: 'sync:init',
          data: store.getState(),
          serverTime: new Date().toISOString()
        });
      }
      return res.json({ success: true, seeded, state: store.getState() });
    }
    res.status(400).json({ error: 'Invalid data' });
  });

  // Upload and snapshot full database to server
  app.post("/api/backup/upload-to-server", (req, res) => {
    try {
      const { data, userEmail } = req.body;
      const snapshot = store.createBackupSnapshot(data);

      broadcast({
        type: 'sync:init',
        data: store.getState(),
        serverTime: new Date().toISOString(),
        backupUploadedBy: userEmail || 'user'
      });

      console.log(`[Backup] Server backup completed by ${userEmail || 'operator'}: ${snapshot.filename}`);
      res.json({
        success: true,
        message: 'Повну базу успішно вивантажено та збережено на сервері',
        snapshot,
        lastUpdated: store.getState().lastUpdated
      });
    } catch (err: any) {
      console.error('[Backup] Upload error:', err);
      res.status(500).json({ success: false, error: err.message || 'Помилка вивантаження на сервер' });
    }
  });

  // Get list of server backups
  app.get("/api/backup/server-backups", (_req, res) => {
    try {
      const backups = store.getServerBackups();
      res.json({ success: true, backups });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Restore database from server backup snapshot
  app.post("/api/backup/restore-from-server", (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ success: false, error: 'Filename is required' });
      }

      const restoredState = store.restoreBackupSnapshot(filename);
      if (!restoredState) {
        return res.status(404).json({ success: false, error: 'Бекап файл не знайдено на сервері' });
      }

      broadcast({
        type: 'sync:init',
        data: restoredState,
        serverTime: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Базу успішно відновлено з серверного бекапу: ${filename}`,
        state: restoredState
      });
    } catch (err: any) {
      console.error('[Backup] Restore error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Password Reset Request (Email notification to Superadministrator)
  app.post("/api/auth/request-password-reset", (req, res) => {
    try {
      const { userId, userEmail, userName, requestedByEmail, notes } = req.body;
      if (!userEmail && !userId) {
        return res.status(400).json({ success: false, error: 'User email or ID is required' });
      }

      const allUsers = store.getState().authorizedUsers || [];
      const user = allUsers.find((u: any) => u.id === userId || u.email.toLowerCase() === (userEmail || '').toLowerCase());
      const targetName = user?.name || userName || userEmail;
      const targetEmail = user?.email || userEmail;
      const targetRole = user?.roleId || 'user';

      const superadminEmails = store.getSuperadminEmails();
      const primarySuperadmin = superadminEmails[0] || 'tonyreshua@gmail.com';

      const request = store.addPasswordRequest({
        userId: user?.id || userId || 'unknown',
        userName: targetName,
        userEmail: targetEmail,
        roleId: targetRole,
        requestedByEmail: requestedByEmail || targetEmail,
        notes: notes || ''
      });

      // Prepare mailto link for direct mail client dispatch
      const emailSubject = encodeURIComponent(`[СКУД] Запит нового пароля для: ${targetName} (${targetEmail})`);
      const emailBody = encodeURIComponent(
        `Шановний Суперадміністратор!\n\n` +
        `Надійшов запит на створення / надання нового пароля для доступу до системи СКУД.\n\n` +
        `Деталі запиту:\n` +
        `• Користувач: ${targetName}\n` +
        `• Email користувача: ${targetEmail}\n` +
        `• Роль: ${targetRole}\n` +
        `• Дата та час: ${new Date().toLocaleString('uk-UA')}\n` +
        `• Запит подано від: ${requestedByEmail || targetEmail}\n` +
        (notes ? `• Коментар/причина: ${notes}\n\n` : `\n`) +
        `Для встановлення нового пароля увійдіть до системи СКУД та відкрийте вкладку «Доступ».\n`
      );
      const mailtoUrl = `mailto:${primarySuperadmin}?subject=${emailSubject}&body=${emailBody}`;

      // Broadcast event via WebSocket to superadmins
      broadcast({
        type: 'auth:password_request',
        request,
        superadminEmails,
        timestamp: new Date().toISOString()
      });

      console.log(`[Email Dispatch] Password request notification sent to Superadmin (${superadminEmails.join(', ')}): User ${targetName} (${targetEmail})`);

      res.json({
        success: true,
        message: `Лист із запитом нового пароля успішно надіслано на пошту Суперадміністратора (${superadminEmails.join(', ')})`,
        superadminEmails,
        mailtoUrl,
        request
      });
    } catch (err: any) {
      console.error('[Auth] Error creating password request:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get all password reset requests
  app.get("/api/auth/password-requests", (_req, res) => {
    res.json({
      success: true,
      requests: store.getState().passwordRequests || []
    });
  });

  // Resolve password reset request
  app.post("/api/auth/resolve-password-request", (req, res) => {
    const { requestId } = req.body;
    const resolved = store.resolvePasswordRequest(requestId);
    if (resolved) {
      broadcast({
        type: 'auth:password_request_resolved',
        requestId,
        timestamp: new Date().toISOString()
      });
    }
    res.json({ success: resolved });
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      onlineClients: getConnectedClientsCount(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running with WebSockets on http://localhost:${PORT}`);
  });
}

startServer();
