import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../store/ThemeContext';
import { Home, Users, Shield, Settings, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

import { Logo } from './Logo';

export default function Layout() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { to: '/', icon: Home, label: 'Дашборд' },
    { to: '/visitors', icon: Users, label: 'Відвідувачі' },
    { to: '/security', icon: Shield, label: 'Охорона' },
    { to: '/reports', icon: FileText, label: 'Звіти' },
    { to: '/settings', icon: Settings, label: 'Налаштування' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden text-foreground">
      {/* Top Header */}
      <header className="hidden landscape:flex items-center justify-between px-3 sm:px-8 border-b border-border bg-card h-16 shrink-0 gap-2 sm:gap-4 select-none no-print">
        {/* Left: Logo */}
        <div className="flex items-center shrink-0">
          <Logo className="w-auto" />
        </div>

        {/* Right: Nav Menu (Only on top in landscape horizontal orientation) */}
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
      <main className="flex-1 overflow-auto p-3 md:p-5 portrait:pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation for Portrait vertical orientation */}
      <nav className="flex landscape:hidden fixed bottom-1 left-2 right-2 sm:left-4 sm:right-4 z-50 items-center justify-around bg-card/95 backdrop-blur-md border border-border/80 h-16 rounded-2xl shadow-xl px-2 select-none mb-1 no-print">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center rounded-2xl transition-all h-12 w-16 p-1 text-center font-roboto",
              isActive 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/15" 
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <item.icon className="w-5 h-5 mb-0.5" />
            <span className="text-[8px] font-bold tracking-wider uppercase leading-none">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
