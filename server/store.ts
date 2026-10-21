import fs from 'fs';
import path from 'path';

export interface PasswordResetRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleId?: string;
  requestedAt: string;
  requestedByEmail?: string;
  notes?: string;
  status: 'pending' | 'resolved';
}

export interface ServerState {
  visitors: any[];
  guards: any[];
  shifts: any[];
  securityShifts: any[];
  categories: string[];
  groups: any[];
  locations: any[];
  dirtySkyEvents: any[];
  dutyEvents: any[];
  customIcons: any[];
  reportRetentionHours: number;
  authorizedUsers: any[];
  roles: any[];
  passwordRequests?: PasswordResetRequest[];
  lastUpdated: string;
}

const DEFAULT_RANKS = ['Рядовий', 'Сержант', 'Лейтенант', 'Капітан', 'Майор', 'Полковник'];

const DEFAULT_LOCATIONS = [
  { id: 'loc-1', name: 'Штаб' },
  { id: 'loc-2', name: 'КПП' },
  { id: 'loc-3', name: 'Казарма №1' },
  { id: 'loc-4', name: 'Навчальна бригада' }
];

const DEFAULT_GROUPS = [
  { id: '1', name: 'Постійні відвідувачі', color: 'rgba(34, 197, 94, 0.1)' },
  { id: '2', name: 'Тимчасові', color: 'rgba(59, 130, 246, 0.1)' },
  { id: '3', name: 'Рота охорони', color: 'rgba(239, 68, 68, 0.1)' }
];

const DEFAULT_SECURITY_SHIFTS = [
  { id: 'shift-1', name: 'Денна зміна', visitorIds: [] },
  { id: 'shift-2', name: 'Нічна зміна', visitorIds: [] }
];

const ALL_PERMISSION_KEYS = [
  'dashboard.view',
  'dashboard.actions',
  'visitors.view',
  'visitors.create',
  'visitors.edit',
  'visitors.delete',
  'security.view',
  'security.manage_shifts',
  'security.dirty_sky',
  'reports.view',
  'reports.export',
  'reports.clean',
  'roles.view',
  'roles.manage_users',
  'roles.manage_permissions',
  'settings.view',
  'settings.manage_dictionaries',
  'settings.backup',
  'settings.appearance'
];

const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'Суперадміністратор',
    description: 'Повний необмежений доступ до всіх функцій, налаштувань та керування доступом',
    color: '#3b82f6',
    isSystem: true,
    permissions: ALL_PERMISSION_KEYS
  },
  {
    id: 'security',
    name: 'Служба безпеки / Охорона',
    description: 'Оперативний контроль КПП: швидкі дії, графік змін, режим «Брудне небо» та друк звітів',
    color: '#ef4444',
    isSystem: true,
    permissions: [
      'dashboard.view', 'dashboard.actions',
      'visitors.view', 'visitors.create',
      'security.view', 'security.manage_shifts', 'security.dirty_sky',
      'reports.view', 'reports.export',
      'settings.view'
    ]
  },
  {
    id: 'manager',
    name: 'Оператор КПП',
    description: 'Базова робота на КПП: відмітка входу/виходу, створення та редагування карток відвідувачів',
    color: '#10b981',
    isSystem: true,
    permissions: [
      'dashboard.view', 'dashboard.actions',
      'visitors.view', 'visitors.create', 'visitors.edit',
      'security.view', 'security.dirty_sky',
      'settings.view'
    ]
  },
  {
    id: 'auditor',
    name: 'Інспектор / Аудитор',
    description: 'Перегляд аналітики, звітів та списків без можливості редагування даних',
    color: '#f59e0b',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'visitors.view',
      'security.view',
      'reports.view', 'reports.export'
    ]
  }
];

class StateStore {
  private state: ServerState;
  private dataDir: string;
  private stateFilePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.stateFilePath = path.join(this.dataDir, 'system_state.json');

    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create data directory:', err);
      }
    }

    this.state = this.loadInitialState();
  }

  private loadInitialState(): ServerState {
    // 1. Try loading existing state from file
    if (fs.existsSync(this.stateFilePath)) {
      try {
        const raw = fs.readFileSync(this.stateFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        console.log(`[Store] Loaded persistent server state from ${this.stateFilePath}`);
        return {
          visitors: Array.isArray(parsed.visitors) ? parsed.visitors : [],
          guards: Array.isArray(parsed.guards) ? parsed.guards : [],
          shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
          securityShifts: Array.isArray(parsed.securityShifts) && parsed.securityShifts.length > 0 ? parsed.securityShifts : DEFAULT_SECURITY_SHIFTS,
          categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : DEFAULT_RANKS,
          groups: Array.isArray(parsed.groups) && parsed.groups.length > 0 ? parsed.groups : DEFAULT_GROUPS,
          locations: Array.isArray(parsed.locations) && parsed.locations.length > 0 ? parsed.locations : DEFAULT_LOCATIONS,
          dirtySkyEvents: Array.isArray(parsed.dirtySkyEvents) ? parsed.dirtySkyEvents : [],
          dutyEvents: Array.isArray(parsed.dutyEvents) ? parsed.dutyEvents : [],
          customIcons: Array.isArray(parsed.customIcons) ? parsed.customIcons : [],
          reportRetentionHours: typeof parsed.reportRetentionHours === 'number' ? parsed.reportRetentionHours : 1440,
          authorizedUsers: (Array.isArray(parsed.authorizedUsers) && parsed.authorizedUsers.length > 0 ? parsed.authorizedUsers : this.loadInitialAuthorizedUsers()).map((u: any) => ({
            ...u,
            password: u.password || 'admin'
          })),
          roles: Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : DEFAULT_ROLES,
          passwordRequests: Array.isArray(parsed.passwordRequests) ? parsed.passwordRequests : [],
          lastUpdated: parsed.lastUpdated || new Date().toISOString()
        };
      } catch (e) {
        console.error('[Store] Error parsing system_state.json, creating default state', e);
      }
    }

    // 2. Default state
    const initialState: ServerState = {
      visitors: [],
      guards: [],
      shifts: [],
      securityShifts: DEFAULT_SECURITY_SHIFTS,
      categories: DEFAULT_RANKS,
      groups: DEFAULT_GROUPS,
      locations: DEFAULT_LOCATIONS,
      dirtySkyEvents: [],
      dutyEvents: [],
      customIcons: [],
      reportRetentionHours: 1440,
      authorizedUsers: this.loadInitialAuthorizedUsers(),
      roles: DEFAULT_ROLES,
      passwordRequests: [],
      lastUpdated: new Date().toISOString()
    };

    this.saveStateImmediately(initialState);
    return initialState;
  }

  private loadInitialAuthorizedUsers(): any[] {
    const authUsersPath = path.join(process.cwd(), 'src', 'data', 'authorized_users.json');
    if (fs.existsSync(authUsersPath)) {
      try {
        const raw = fs.readFileSync(authUsersPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u: any) => ({
            ...u,
            password: u.password || 'admin'
          }));
        }
      } catch (err) {
        console.error('[Store] Error reading initial authorized_users.json', err);
      }
    }
    return [
      {
        id: 'user-1',
        email: 'tonyreshua@gmail.com',
        name: 'Антон (Адміністратор)',
        roleId: 'admin',
        addedAt: new Date().toISOString(),
        notes: 'Основний обліковий запис адміністратора системи',
        avatarColor: '#3b82f6'
      }
    ];
  }

  public getState(): ServerState {
    return this.state;
  }

  public updateKey<K extends keyof ServerState>(key: K, value: ServerState[K]): ServerState {
    this.state[key] = value;
    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.state;
  }

  public patch(partial: Partial<ServerState>): ServerState {
    Object.assign(this.state, partial);
    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.state;
  }

  public seedIfEmpty(clientData: Partial<ServerState>): boolean {
    let seeded = false;

    // Seed visitors if server has none and client provided some
    if (this.state.visitors.length === 0 && Array.isArray(clientData.visitors) && clientData.visitors.length > 0) {
      this.state.visitors = clientData.visitors;
      seeded = true;
    }

    if (this.state.customIcons.length === 0 && Array.isArray(clientData.customIcons) && clientData.customIcons.length > 0) {
      this.state.customIcons = clientData.customIcons;
      seeded = true;
    }

    if (this.state.dutyEvents.length === 0 && Array.isArray(clientData.dutyEvents) && clientData.dutyEvents.length > 0) {
      this.state.dutyEvents = clientData.dutyEvents;
      seeded = true;
    }

    if (this.state.dirtySkyEvents.length === 0 && Array.isArray(clientData.dirtySkyEvents) && clientData.dirtySkyEvents.length > 0) {
      this.state.dirtySkyEvents = clientData.dirtySkyEvents;
      seeded = true;
    }

    if (seeded) {
      this.state.lastUpdated = new Date().toISOString();
      this.scheduleSave();
      console.log('[Store] Seeded server data from client payload');
    }

    return seeded;
  }

  public createBackupSnapshot(payload?: Partial<ServerState>): { filename: string; timestamp: string; size: number; totalVisitors: number } {
    if (payload && typeof payload === 'object') {
      Object.assign(this.state, payload);
    }
    this.state.lastUpdated = new Date().toISOString();
    this.saveStateImmediately(this.state);

    const backupsDir = path.join(this.dataDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      try {
        fs.mkdirSync(backupsDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create backups directory:', err);
      }
    }

    const now = new Date();
    const datePart = now.toISOString().replace(/[:.]/g, '-');
    const filename = `backup_db_${datePart}.json`;
    const fullBackupPath = path.join(backupsDir, filename);

    const content = JSON.stringify(this.state, null, 2);
    fs.writeFileSync(fullBackupPath, content, 'utf8');

    const stats = fs.statSync(fullBackupPath);
    console.log(`[Store] Created server backup snapshot: ${filename} (${stats.size} bytes)`);

    return {
      filename,
      timestamp: now.toISOString(),
      size: stats.size,
      totalVisitors: Array.isArray(this.state.visitors) ? this.state.visitors.length : 0
    };
  }

  public getServerBackups(): Array<{ filename: string; timestamp: string; size: number; totalVisitors: number }> {
    const backupsDir = path.join(this.dataDir, 'backups');
    if (!fs.existsSync(backupsDir)) return [];

    try {
      const files = fs.readdirSync(backupsDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(filename => {
          const filePath = path.join(backupsDir, filename);
          const stats = fs.statSync(filePath);
          let totalVisitors = 0;
          try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(raw);
            totalVisitors = Array.isArray(data.visitors) ? data.visitors.length : 0;
          } catch (e) {}

          return {
            filename,
            timestamp: stats.mtime.toISOString(),
            size: stats.size,
            totalVisitors
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (e) {
      console.error('[Store] Failed to list backups:', e);
      return [];
    }
  }

  public restoreBackupSnapshot(filename: string): ServerState | null {
    const cleanName = path.basename(filename);
    const backupPath = path.join(this.dataDir, 'backups', cleanName);
    if (!fs.existsSync(backupPath)) return null;

    try {
      const raw = fs.readFileSync(backupPath, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = {
        visitors: Array.isArray(parsed.visitors) ? parsed.visitors : [],
        guards: Array.isArray(parsed.guards) ? parsed.guards : [],
        shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
        securityShifts: Array.isArray(parsed.securityShifts) ? parsed.securityShifts : DEFAULT_SECURITY_SHIFTS,
        categories: Array.isArray(parsed.categories) ? parsed.categories : DEFAULT_RANKS,
        groups: Array.isArray(parsed.groups) ? parsed.groups : DEFAULT_GROUPS,
        locations: Array.isArray(parsed.locations) ? parsed.locations : DEFAULT_LOCATIONS,
        dirtySkyEvents: Array.isArray(parsed.dirtySkyEvents) ? parsed.dirtySkyEvents : [],
        dutyEvents: Array.isArray(parsed.dutyEvents) ? parsed.dutyEvents : [],
        customIcons: Array.isArray(parsed.customIcons) ? parsed.customIcons : [],
        reportRetentionHours: typeof parsed.reportRetentionHours === 'number' ? parsed.reportRetentionHours : 1440,
        authorizedUsers: Array.isArray(parsed.authorizedUsers) ? parsed.authorizedUsers : this.loadInitialAuthorizedUsers(),
        roles: Array.isArray(parsed.roles) ? parsed.roles : DEFAULT_ROLES,
        lastUpdated: new Date().toISOString()
      };

      this.saveStateImmediately(this.state);
      console.log(`[Store] Restored database from server backup: ${cleanName}`);
      return this.state;
    } catch (e) {
      console.error('[Store] Failed to restore backup:', e);
      return null;
    }
  }

  public addPasswordRequest(reqData: Omit<PasswordResetRequest, 'id' | 'requestedAt' | 'status'>): PasswordResetRequest {
    if (!Array.isArray(this.state.passwordRequests)) {
      this.state.passwordRequests = [];
    }
    const newReq: PasswordResetRequest = {
      id: 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      ...reqData,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    };
    this.state.passwordRequests.unshift(newReq);
    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return newReq;
  }

  public resolvePasswordRequest(requestId: string): boolean {
    if (!Array.isArray(this.state.passwordRequests)) return false;
    const item = this.state.passwordRequests.find(r => r.id === requestId);
    if (item) {
      item.status = 'resolved';
      this.state.lastUpdated = new Date().toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }

  public getSuperadminEmails(): string[] {
    const admins = (this.state.authorizedUsers || []).filter((u: any) => u.roleId === 'admin');
    if (admins.length > 0) {
      return Array.from(new Set(admins.map((u: any) => u.email)));
    }
    return ['tonyreshua@gmail.com'];
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveStateImmediately(this.state);
    }, 150);
  }

  private saveStateImmediately(state: ServerState) {
    try {
      const json = JSON.stringify(state, null, 2);
      const tmpPath = `${this.stateFilePath}.tmp`;
      fs.writeFileSync(tmpPath, json, 'utf8');
      fs.renameSync(tmpPath, this.stateFilePath);

      // Automatic backup snapshot on any change to the database
      const backupsDir = path.join(this.dataDir, 'backups');
      if (!fs.existsSync(backupsDir)) {
        try {
          fs.mkdirSync(backupsDir, { recursive: true });
        } catch (e) {}
      }
      if (fs.existsSync(backupsDir)) {
        fs.writeFileSync(path.join(backupsDir, 'latest_auto_backup.json'), json, 'utf8');
      }
    } catch (e) {
      console.error('[Store] Failed to save state to disk:', e);
    }
  }
}

export const store = new StateStore();
