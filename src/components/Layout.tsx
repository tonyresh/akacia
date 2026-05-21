import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../store/ThemeContext';
import { Home, Users, Shield, Settings, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

import { Logo } from './Logo';

export default function Layout() {
  const navItems = [
    { to: '/', icon: Home, label: 'Дашборд' },
    { to: '/visitors', icon: Users, label: 'Відвідувачі' },
    { to: '/security', icon: Shield, label: 'Охорона' },
    { to: '/reports', icon: FileText, label: 'Звіти' },
    { to: '/settings', icon: Settings, label: 'Налаштування' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden text-foreground">
      {/* Top Header & Horizontal Unified Navigation */}
      <header className="flex items-center justify-between px-3 sm:px-8 border-b border-border bg-card h-16 shrink-0 gap-2 sm:gap-4 select-none">
        {/* Left: Logo */}
        <div className="flex items-center shrink-0">
          <Logo className="w-auto" />
        </div>

        {/* Right: Nav Menu (Vertical icon/text buttons style in a row) */}
        <nav className="flex items-center gap-0.5 sm:gap-1.5 overflow-x-auto hide-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center rounded-xl transition-all h-13 min-w-[52px] sm:min-w-[74px] p-1 px-1.5 sm:px-3 text-center",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/10" 
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5 mb-0.5" />
              <span className="text-[8px] sm:text-[10px] font-bold tracking-wider uppercase leading-none">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-auto p-3 md:p-5">
        <Outlet />
      </main>
    </div>
  );
}
