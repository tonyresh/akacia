import React, { useState, useRef } from 'react';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import { Logo } from './Logo';
import {
  ShieldCheck,
  Mail,
  LogIn,
  AlertCircle,
  FileUp,
  KeyRound,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Shield,
  Key,
  Send,
  X,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { AuthorizedUser } from '../types';

export default function LoginForm() {
  const { login, authorizedUsers, roles, importUsersFromJson, requestNewPassword, superadminEmails } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password reset request modal state
  const [showPasswordRequestModal, setShowPasswordRequestModal] = useState(false);
  const [reqEmail, setReqEmail] = useState('');
  const [reqName, setReqName] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [requestResult, setRequestResult] = useState<{ message: string; mailtoUrl?: string } | null>(null);

  const handleOpenPasswordRequest = (prefilledEmail?: string) => {
    const targetEmail = prefilledEmail || email;
    setReqEmail(targetEmail);
    const existing = authorizedUsers.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());
    setReqName(existing ? existing.name : '');
    setReqNotes('');
    setRequestResult(null);
    setShowPasswordRequestModal(true);
  };

  const handleSendPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqEmail.trim()) {
      showToast('Вкажіть електронну пошту', 'error');
      return;
    }

    setIsSendingRequest(true);
    try {
      const existing = authorizedUsers.find(u => u.email.toLowerCase() === reqEmail.trim().toLowerCase());
      const res = await requestNewPassword({
        userId: existing ? existing.id : 'external-' + Date.now(),
        userEmail: reqEmail.trim(),
        userName: reqName.trim() || existing?.name || reqEmail.trim().split('@')[0],
        notes: reqNotes.trim()
      });

      if (res.success) {
        setRequestResult({ message: res.message, mailtoUrl: res.mailtoUrl });
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = login(email, password);
    if (!result.success) {
      setError(result.message);
      setLoading(false);
      showToast(result.message, 'error');
    } else {
      showToast(result.message, 'success');
    }
  };

  const handleSelectQuickUser = (user: AuthorizedUser) => {
    const userPwd = user.password?.trim() || 'admin';
    setEmail(user.email);
    setPassword(userPwd);
    setError(null);

    const result = login(user.email, userPwd);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      setError(result.message);
      showToast(result.message, 'error');
    }
  };

  const handleFillAdminPassword = () => {
    setPassword('admin');
    if (error && error.includes('парол')) {
      setError(null);
    }
    showToast("Введено стандартний пароль: admin", 'info');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importUsersFromJson(content);
      if (res.success) {
        showToast(res.message, 'success');
        setError(null);
      } else {
        setError(res.message);
        showToast(res.message, 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background via-card to-background relative overflow-hidden select-none">
      {/* Background Decorative Accents */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-3xl p-6 sm:p-8 z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3 scale-110">
            <Logo />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>Контроль доступу та безпека</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Вхід до системи обліку
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
            Авторизація співробітників за парою email та пароль
          </p>
        </div>

        {/* Superadmin Default Password Notice Banner */}
        <div className="mb-5 p-3 rounded-2xl bg-primary/10 border border-primary/25 text-foreground flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Key className="w-4 h-4 text-primary shrink-0" />
            <div className="truncate">
              <span className="font-bold text-foreground">Суперадміністратор:</span>{' '}
              <span className="text-muted-foreground">пароль за замовчуванням —</span>{' '}
              <span className="font-mono font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded">admin</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFillAdminPassword}
            className="shrink-0 text-[11px] font-bold text-primary hover:text-primary/80 bg-background/80 hover:bg-background px-2.5 py-1 rounded-xl border border-primary/30 transition-all cursor-pointer shadow-2xs"
          >
            Вставити admin
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive flex items-start gap-3 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Помилка авторизації</p>
              <p className="text-destructive/90 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Електронна пошта</span>
              <span className="text-[10px] text-primary lowercase font-medium">список дозволених</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                required
                autoFocus
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Пароль</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPasswordRequest(email)}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  title="Надіслати запит нового паролю Суперадміністратору"
                >
                  <Mail className="w-3 h-3" />
                  <span>Запит нового паролю</span>
                </button>
                <span className="text-muted-foreground/40 text-xs">•</span>
                <button
                  type="button"
                  onClick={handleFillAdminPassword}
                  className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Вставити пароль за замовчуванням (admin)"
                >
                  admin
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                <KeyRound className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Введіть пароль (за замовчуванням: admin)"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full pl-11 pr-11 py-3 rounded-2xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-inner font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={showPassword ? 'Сховати пароль' : 'Показати пароль'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm uppercase tracking-wider shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] mt-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Увійти в систему</span>
          </button>

          {/* Secondary Password Request Prompt */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => handleOpenPasswordRequest(email)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1.5 font-medium"
            >
              <Mail className="w-3.5 h-3.5 text-primary" />
              <span>Потрібен новий пароль?</span>
              <span className="font-bold text-primary underline underline-offset-2">Запит нового паролю</span>
            </button>
          </div>
        </form>

        {/* Quick Selection Section for authorized users */}
        <div className="mt-6 pt-5 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Швидкий вхід за обліковим записом ({authorizedUsers.length})
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              title="Завантажити локальний файл authorized_users.json"
            >
              <FileUp className="w-3.5 h-3.5" />
              Імпорт
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {authorizedUsers.map((user) => {
              const userRole = roles.find(r => r.id === user.roleId);
              const isAdmin = user.roleId === 'admin';

              return (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left group ${
                    isAdmin
                      ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                      : 'border-border bg-card/60 hover:bg-secondary/70 hover:border-primary/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectQuickUser(user)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: user.avatarColor || '#3b82f6' }}
                    >
                      {user.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {user.name}
                        </p>
                        {isAdmin && (
                          <span className="text-[9px] px-1 py-0.2 rounded-full bg-primary/20 text-primary font-bold">
                            admin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate font-mono">
                        {user.email}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenPasswordRequest(user.email)}
                    title="Надіслати запит нового паролю для цього користувача"
                    className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0 ml-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-5 p-3 rounded-xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground flex items-start gap-2">
          <KeyRound className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Вхід захищено паролем. За замовчуванням пароль для всіх облікових записів та суперадміністратора —{' '}
            <code className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-primary font-bold">admin</code>.
            Змінити пароль або список користувачів можна у вкладці «Доступ».
          </p>
        </div>
      </div>

      {/* Modal: Password Reset Request to Superadministrator */}
      {showPasswordRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Запит нового паролю</h3>
                  <p className="text-xs text-muted-foreground">Надсилання повідомлення Суперадміністратору</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordRequestModal(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {requestResult ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-foreground flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      Запит успішно надіслано!
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      {requestResult.message}
                    </p>
                    <p className="text-muted-foreground pt-1">
                      Отримувач (Суперадміністратор): <span className="font-mono font-bold text-foreground">{superadminEmails.join(', ')}</span>
                    </p>
                  </div>
                </div>

                {requestResult.mailtoUrl && (
                  <a
                    href={requestResult.mailtoUrl}
                    className="w-full h-11 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Відкрити у поштовій програмі (Email Client)</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setShowPasswordRequestModal(false)}
                  className="w-full h-11 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Закрити
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendPasswordRequest} className="space-y-4">
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Shield className="w-4 h-4 text-primary shrink-0" />
                    <span>Одержувач сповіщення:</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Лист буде відправлено на скриньку Суперадміністратора:{' '}
                    <span className="font-mono font-bold text-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                      {superadminEmails.join(', ')}
                    </span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ваш Email <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@checkpoint.com"
                    value={reqEmail}
                    onChange={(e) => {
                      setReqEmail(e.target.value);
                      const ex = authorizedUsers.find(u => u.email.toLowerCase() === e.target.value.toLowerCase());
                      if (ex && !reqName) setReqName(ex.name);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Прізвище та ім'я
                  </label>
                  <input
                    type="text"
                    placeholder="Іван Петренко"
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Причина / коментар (необов'язково)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Наприклад: забув пароль або потрібен доступ до зміни..."
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-secondary/50 border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordRequestModal(false)}
                    className="flex-1 h-11 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingRequest || !reqEmail.trim()}
                    className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingRequest ? (
                      <span>Надсилання...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Надіслати запит</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
