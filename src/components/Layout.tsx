import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../store/ThemeContext';
import { Home, Users, Shield, Settings, FileText, TriangleAlert, Cloud } from 'lucide-react';
import { cn } from '../lib/utils';
import { useData } from '../store/DataContext';
import { useToast } from '../store/ToastContext';
import { format } from 'date-fns';

import { Logo } from './Logo';

export default function Layout() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { dirtySkyEvents, startDirtySky, endDirtySky } = useData();
  const { showToast } = useToast();

  const activeDirtySky = dirtySkyEvents.find(e => !e.endTime);

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
      <header className="hidden landscape:flex items-center justify-between px-3 sm:px-6 md:px-8 border-b border-border bg-card h-[72px] shrink-0 select-none no-print">
        {/* Left Column: Logo and Clock centered between Logo and Dirty Sky */}
        <div className="flex-1 flex items-center min-w-0">
          <Logo className="w-auto shrink-0" />
          <div className="flex-1 flex justify-center items-center px-2 min-w-0">
            <div className="flex flex-col items-center justify-center leading-none text-center">
              <span className="text-[20px] sm:text-[27px] md:text-[33px] font-semibold tabular-nums tracking-tight text-foreground">
                {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false})}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase mt-1">
                {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' }).replace(/\s*р\.?$/, '')}
              </span>
            </div>
          </div>
        </div>

        {/* Center Column: Dirty Sky Controls (centered between Logo and Menu) */}
        <div className="shrink-0 flex justify-center items-center px-4">
          {!activeDirtySky ? (
            <div className="flex items-center gap-2.5 select-none shrink-0">
              <Cloud className="w-[18px] h-[18px] text-muted-foreground/70 shrink-0" />
              <span className="text-[11px] sm:text-[13px] font-bold tracking-wider uppercase text-muted-foreground">Брудне небо</span>
              <button
                onClick={() => {
                  startDirtySky();
                  showToast('РЕЖИМ БРУДНЕ НЕБО АКТИВОВАНО!', 'error');
                }}
                className="h-9 w-12 sm:w-[62px] rounded-lg bg-red-500 hover:bg-red-600 active:scale-95 text-white text-[11px] sm:text-[13px] font-black uppercase transition-all flex items-center justify-center cursor-pointer select-none shadow-sm shadow-red-500/10 font-sans"
                title="Увімкнути режим Брудне небо"
              >
                ON
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 sm:gap-3.5 select-none shrink-0 justify-center">
              <div className="flex items-center gap-1.5 text-red-500 animate-pulse font-extrabold text-[13px] sm:text-[15.5px] md:text-[17.6px] uppercase tracking-wider">
                <TriangleAlert className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] shrink-0" />
                <span>Брудне небо</span>
              </div>
              <button
                onClick={() => {
                  endDirtySky();
                  showToast('Режим Брудне небо завершено', 'success');
                }}
                className="h-9 w-12 sm:w-[62px] rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[11px] sm:text-[13px] font-black uppercase transition-all flex items-center justify-center cursor-pointer select-none shadow-sm shadow-emerald-500/10 font-sans shrink-0"
                title="Вимкнути режим Брудне небо"
              >
                OFF
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Nav Menu */}
        <div className="flex-1 flex items-center justify-end min-w-0">
          <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto hide-scrollbar">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  "flex flex-col items-center justify-center rounded-xl transition-all h-[57px] min-w-[55px] sm:min-w-[77px] p-1 px-2 sm:px-3 text-center",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <item.icon className="w-[22px] h-[22px] mb-0.5" />
                <span className="text-[9px] sm:text-[11px] font-bold tracking-wider uppercase leading-none">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-auto p-3 md:p-5 portrait:pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation for Portrait vertical orientation - styled with dark contrast context */}
      <nav className="flex landscape:hidden fixed bottom-1 left-2 right-2 sm:left-4 sm:right-4 z-50 items-center justify-around bg-neutral-950/98 backdrop-blur-lg border border-neutral-800/85 h-16 rounded-2xl shadow-2xl px-2 select-none mb-1 no-print text-white">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center rounded-2xl transition-all h-12 w-16 p-1 text-center font-roboto",
              isActive 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
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
