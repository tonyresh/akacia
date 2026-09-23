import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
