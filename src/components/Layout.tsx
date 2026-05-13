import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../store/ThemeContext';
import { Home, Users, Shield, Settings, Sun, Moon, Database, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

import { Logo } from './Logo';

export default function Layout() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const navItems = [
    { to: '/', icon: Home, label: 'Дашборд' },
    { to: '/visitors', icon: Users, label: 'Відвідувачі' },
    { to: '/database', icon: Database, label: 'База даних' },
    { to: '/security', icon: Shield, label: 'Охорона' },
    { to: '/reports', icon: FileText, label: 'Звіти' },
    { to: '/settings', icon: Settings, label: 'Налаштування' },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card">
        <div className="p-6">
          <div className="mb-8 p-4 bg-[#0a0a0a] rounded-2xl">
            <Logo className="w-full" />
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between px-8 border-b border-border bg-background h-16 shrink-0 text-sm">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="text-sm">Статус Системи: <span className="text-emerald-500 font-medium">Працює</span></span>
            <div className="hidden sm:block w-[1px] h-4 bg-border"></div>
            <span className="hidden sm:inline text-sm">Локація: Головний Пост</span>
          </div>
          <button 
            onClick={toggleTheme} 
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs border border-border transition-colors hover:bg-muted"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed z-50 bottom-0 left-0 right-0 border-t bg-card flex items-center justify-around p-2 pb-safe bg-background/80 backdrop-blur-md">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex flex-col items-center p-2 min-w-[64px] rounded-lg transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
