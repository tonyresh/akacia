import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { Search, LogIn, LogOut, Download } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';

export default function Visitors() {
  const { visitors, setVisitors, categories, groups } = useData();
  const [search, setSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [activeGroup, setActiveGroup] = useState<string>('all');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filtered = visitors
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    .filter(v => activeGroup === 'all' || v.groupId === activeGroup || v.group === activeGroup);

  const markIn = (id: string, index: number) => {
    setVisitors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const now = new Date().toISOString();
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      logs[index] = { in: now };
      return { ...v, status: 'in', lastEntry: now, logs };
    }));
  };

  const markOut = (id: string, index: number) => {
    setVisitors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const now = new Date().toISOString();
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      if (!logs[index]) return v;
      logs[index] = { ...logs[index], out: now };
      
      const diff = logs[index].in ? differenceInMinutes(new Date(now), new Date(logs[index].in!)) : 0;
      return { 
        ...v, 
        status: 'out', 
        lastEntry: undefined,
        logs,
        totalTimeMinutes: (v.totalTimeMinutes || 0) + diff 
      };
    }));
  };

  const exportToCSV = () => {
    const headers = [
      'Дата',
      '№ п/п',
      'Звання',
      'Прізвище Ім\'я По батькові',
      'Звідки прибув',
      'Група',
      ...Array.from({length: 4}).flatMap((_, i) => [`Вхід ${i+1}`, `Вихід ${i+1}`]),
      'Загальний час (хв)'
    ];

    const rows = filtered.map((v, i) => {
      const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
      const date = logs[0]?.in ? new Date(logs[0].in).toLocaleDateString() : new Date().toLocaleDateString();
      
      const timeCols = Array.from({length: 4}).flatMap((_, idx) => {
        const log = logs[idx];
        const timeIn = log?.in ? new Date(log.in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const timeOut = log?.out ? new Date(log.out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return [timeIn, timeOut];
      });
      
      return [
        date,
        i + 1,
        v.category,
        v.name,
        v.location || v.locationId || v.group,
        v.group,
        ...timeCols,
        v.totalTimeMinutes
      ].map(val => `"${val}"`).join(',');
    });

    const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `visitors_export_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="relative flex flex-col justify-center items-center sm:block py-2 mb-2">
        <h1 className="text-xl font-bold tracking-tight text-muted-foreground sm:absolute sm:left-0 sm:top-1/2 sm:-translate-y-1/2">
          Зміна: {currentTime.toLocaleDateString()}
        </h1>
        <div className="text-5xl font-black tracking-tighter text-foreground tabular-nums text-center mt-2 sm:mt-0">
          {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2 w-full sm:w-auto sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
          <button 
            onClick={exportToCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-secondary text-secondary-foreground border border-border px-5 py-2 rounded-full hover:bg-secondary/80 transition-colors text-sm font-medium whitespace-nowrap shadow-sm"
          >
            <Download className="w-4 h-4" />
            Експорт
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Пошук за ім'ям..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            {[{ id: 'all', name: 'Всі', color: '' }, ...groups].map(g => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                  activeGroup === g.id 
                    ? 'bg-foreground text-background border-transparent shadow-md' 
                    : 'bg-background hover:bg-muted border-border text-foreground'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th rowSpan={2} className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] w-12 text-center border-r border-border">№</th>
                <th rowSpan={2} className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Звання</th>
                <th rowSpan={2} className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border">ПІБ</th>
                <th rowSpan={2} className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Звідки прибув</th>
                <th rowSpan={2} className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Група</th>
                <th colSpan={2} className="px-2 py-2 font-semibold uppercase tracking-wider text-[10px] text-center border-r border-border">Відвідування 1</th>
                <th colSpan={2} className="px-2 py-2 font-semibold uppercase tracking-wider text-[10px] text-center border-r border-border">Відвідування 2</th>
                <th colSpan={2} className="px-2 py-2 font-semibold uppercase tracking-wider text-[10px] text-center border-r border-border">Відвідування 3</th>
                <th colSpan={2} className="px-2 py-2 font-semibold uppercase tracking-wider text-[10px] text-center border-r border-border">Відвідування 4</th>
              </tr>
              <tr>
                {Array.from({length: 4}).map((_, i) => (
                  <React.Fragment key={i}>
                    <th className="px-2 py-2 font-semibold uppercase tracking-wider text-[10px] text-center border-r border-t border-border bg-muted/20">Зайшов</th>
                    <th className={`px-2 py-2 font-semibold uppercase tracking-wider text-[10px] text-center border-t border-border bg-muted/20 ${i < 3 ? 'border-r border-border' : ''}`}>Вийшов</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-8 text-center text-muted-foreground">
                    Немає даних для відображення
                  </td>
                </tr>
              )}
              {filtered.map((v, index) => {
                const visitorGroup = groups.find(g => g.id === v.groupId) || groups.find(g => g.name === v.group);
                return (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-center border-r border-border text-xs font-bold" style={{ backgroundColor: v.color || visitorGroup?.color || 'transparent', color: v.color ? '#fff' : 'var(--foreground)' }}>{index + 1}</td>
                  <td className="px-4 py-3 border-r border-border" style={{ backgroundColor: visitorGroup?.color || 'transparent' }}>
                    <span className="bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">{v.category}</span>
                  </td>
                  <td className="px-4 py-3 font-medium border-r border-border" style={{ backgroundColor: visitorGroup?.color || 'transparent' }}>
                    {v.name}
                  </td>
                  <td className="px-4 py-3 border-r border-border" style={{ backgroundColor: visitorGroup?.color || 'transparent' }}>
                    <span className="text-xs text-muted-foreground" style={{ color: visitorGroup?.color ? '#ffffff' : undefined }}>{v.location || v.locationId || v.group}</span>
                  </td>
                  <td className="px-4 py-3 border-r border-border" style={{ backgroundColor: visitorGroup?.color || 'transparent' }}>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground" style={{ color: visitorGroup?.color ? 'rgba(255,255,255,0.7)' : undefined }}>{visitorGroup?.name}</span>
                  </td>
                  {Array.from({length: 4}).map((_, i) => {
                    const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
                    const log = logs[i];
                    
                    const isNextIn = (v.status === 'out' && logs.filter(l => l.out).length === i) || (logs.length === 0 && i === 0 && (!v.lastEntry || v.status === 'out'));
                    const isNextOut = v.status === 'in' && logs.length === i + 1 && !log?.out;

                    return (
                      <React.Fragment key={i}>
                        <td className="px-2 py-3 text-center border-r border-border">
                          {log?.in ? (
                            <span className="text-xs font-mono">{new Date(log.in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          ) : isNextIn ? (
                            <button
                              onClick={() => markIn(v.id, i)}
                              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors w-full"
                            >
                              Зайшов
                            </button>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                        <td className={`px-2 py-3 text-center ${i < 3 ? 'border-r border-border' : ''}`}>
                          {log?.out ? (
                            <span className="text-xs font-mono">{new Date(log.out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          ) : isNextOut ? (
                            <button
                              onClick={() => markOut(v.id, i)}
                              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border border-red-500/30 text-red-600 bg-red-500/10 hover:bg-red-500/20 transition-colors w-full"
                            >
                              Вийшов
                            </button>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
