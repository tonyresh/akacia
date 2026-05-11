import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { Users, Clock, ArrowRightCircle } from 'lucide-react';

export default function Dashboard() {
  const { visitors, groups, categories } = useData();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const commandVisitors = visitors.filter(v => {
    const groupName = groups.find(g => g.id === v.groupId)?.name || v.group;
    return groupName === 'Командування полку';
  }).sort((a, b) => a.name.localeCompare(b.name));

  const today8am = new Date();
  today8am.setHours(8, 0, 0, 0);

  let enteredTodayCount = 0;
  visitors.forEach(v => {
    let enteredToday = false;
    if (v.lastEntry && new Date(v.lastEntry) >= today8am) {
      enteredToday = true;
    }
    const logs = v.logs || [];
    for (const log of logs) {
      if (log.in && new Date(log.in) >= today8am) {
        enteredToday = true;
      }
    }
    if (enteredToday) enteredTodayCount++;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Оглядова панель</h1>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tracking-tight text-muted-foreground uppercase">
            Зміна: {currentTime.toLocaleDateString()}
          </div>
          <div className="text-3xl font-black tracking-tighter text-foreground tabular-nums">
            {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false})}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Зайшло сьогодні (з 08:00)</div>
            <div className="text-3xl font-bold">{enteredTodayCount}</div>
          </div>
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20">
             <ArrowRightCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-1">Всього осіб за весь час</div>
            <div className="text-3xl font-bold">{visitors.length}</div>
          </div>
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 flex flex-col shadow-sm">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-lg font-semibold">Список Командування полку</h2>
            <p className="text-xs text-muted-foreground">Список всіх співробітників Командування полку</p>
          </div>
        </div>
        
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 hide-scrollbar">
          {commandVisitors.length > 0 ? (
            commandVisitors.map(v => {
              const visitorGroup = groups?.find((g: any) => g.id === v.groupId) || groups?.find((g: any) => g.name === v.group);
              const isOnLocation = v.status === 'in';
              return (
                <div key={v.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border-2 border-background shadow-sm shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: v.color || visitorGroup?.color || '#e2e8f0', color: v.color ? '#fff' : undefined }}>
                      {v.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{v.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                        {v.category} {v.location || v.locationId || v.group ? `• ${v.location || v.locationId || v.group}` : ''}
                      </div>
                    </div>
                  </div>
                  {isOnLocation ? (
                    <div className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-4 py-1.5 rounded-full self-start sm:self-auto border border-emerald-500/20">
                      На локації з {v.lastEntry ? new Date(v.lastEntry).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : ''}
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-1.5 rounded-full self-start sm:self-auto border border-border/50">
                      Відсутній
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-muted-foreground bg-muted/10 border border-border border-dashed rounded-2xl">
               Співробітників у групі Командування полку не знайдено
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
