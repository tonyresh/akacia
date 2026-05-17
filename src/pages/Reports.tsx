import React, { useState, useMemo } from 'react';
import { useData } from '../store/DataContext';
import { DirtySkyEvent } from '../types';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar as CalendarIcon, 
  Search, 
  Table as TableIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  subMonths, 
  addMonths,
  parseISO,
  differenceInMinutes,
  isWithinInterval
} from 'date-fns';
import { uk } from 'date-fns/locale';

import { formatNameAbbreviated } from '../utils/nameUtils';

export default function Reports() {
  const { visitors, groups, dirtySkyEvents } = useData();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');

  const dateRange = useMemo(() => ({
    start: parseISO(startDate),
    end: parseISO(endDate + 'T23:59:59')
  }), [startDate, endDate]);

  const daysInRange = useMemo(() => {
    try {
      return eachDayOfInterval(dateRange);
    } catch (e) {
      return [];
    }
  }, [dateRange]);

  // Filter visitors who visited in the selected range
  const filteredData = useMemo(() => {
    const visitorVisits = visitors.filter(v => {
      const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
      const matchesSearch = (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (v.callsign || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = filterGroup === 'all' || v.group === filterGroup;
      
      const hasVisitInRange = logs.some(log => {
        if (!log.in) return false;
        const logDate = parseISO(log.in);
        return logDate >= dateRange.start && logDate <= dateRange.end;
      });

      return matchesSearch && matchesGroup && hasVisitInRange;
    });

    return visitorVisits;
  }, [visitors, searchQuery, filterGroup, dateRange]);

  const dirtySkyVisits = useMemo(() => {
    return (dirtySkyEvents || []).filter(e => {
      const logDate = parseISO(e.startTime);
      return logDate >= dateRange.start && logDate <= dateRange.end && (searchQuery === '' || 'брудне небо'.includes(searchQuery.toLowerCase()));
    });
  }, [dirtySkyEvents, dateRange, searchQuery]);

  // Statistics for charts
  const chartData = useMemo(() => {
    return daysInRange.map(day => {
      const visitorCount = visitors.reduce((acc, v) => {
        const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
        const visitedThisDay = logs.some(log => log.in && isSameDay(parseISO(log.in), day));
        return acc + (visitedThisDay ? 1 : 0);
      }, 0);

      const dirtySkyCount = (dirtySkyEvents || []).filter(e => isSameDay(parseISO(e.startTime), day)).length;

      return {
        day: format(day, 'dd'),
        fullDate: format(day, 'dd.MM'),
        count: visitorCount + dirtySkyCount
      };
    });
  }, [visitors, dirtySkyEvents, daysInRange]);

  const totalVisits = useMemo(() => {
    const vVisits = visitors.reduce((acc, v) => {
      const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
      const rangeLogs = logs.filter(log => log.in && parseISO(log.in) >= dateRange.start && parseISO(log.in) <= dateRange.end);
      return acc + rangeLogs.length;
    }, 0);
    const dsVisits = (dirtySkyEvents || []).filter(e => parseISO(e.startTime) >= dateRange.start && parseISO(e.startTime) <= dateRange.end).length;
    return vVisits + dsVisits;
  }, [visitors, dirtySkyEvents, dateRange]);

  const reportRows = useMemo(() => {
    const rows: any[] = [];
    
    visitors.forEach(v => {
      const matchesSearch = (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (v.callsign || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = filterGroup === 'all' || v.group === filterGroup;
      if (!matchesSearch || !matchesGroup) return;

      const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
      
      const logsByDay: Record<string, typeof logs> = {};
      logs.forEach(log => {
        if (!log.in) return;
        const logDate = parseISO(log.in);
        if (logDate >= dateRange.start && logDate <= dateRange.end) {
          const dateKey = format(logDate, 'yyyy-MM-dd');
          if (!logsByDay[dateKey]) logsByDay[dateKey] = [];
          logsByDay[dateKey].push(log);
        }
      });

      Object.entries(logsByDay).forEach(([dateKey, dayLogs]) => {
        rows.push({
          type: 'visitor',
          visitor: v,
          date: parseISO(dateKey),
          logs: dayLogs
        });
      });
    });

    dirtySkyVisits.forEach(e => {
      rows.push({
        type: 'dirtySky',
        event: e,
        date: parseISO(e.startTime),
        logs: [{ in: e.startTime, out: e.endTime }]
      });
    });

    return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [visitors, dirtySkyVisits, dateRange, searchQuery, filterGroup]);

  const uniqueVisitors = filteredData.length;

  const downloadCSV = () => {
    const headers = [
      'Дата', 'Звання', 'ПІБ', 'Позивний', 'Група', 'Бригада', 'Час входу', 'Час виходу'
    ];

    const csvRows = reportRows.map(row => {
      const dateStr = format(row.date, 'dd.MM.yyyy');
      if (row.type === 'dirtySky') {
        return [
          dateStr,
          '—',
          'Брудне небо',
          '—',
          'Спец. події',
          '—',
          format(parseISO(row.event.startTime), 'HH:mm'),
          row.event.endTime ? format(parseISO(row.event.endTime), 'HH:mm') : 'триває'
        ];
      } else {
        const v = row.visitor;
        const ins = row.logs.map((l: any) => format(parseISO(l.in), 'HH:mm')).join('; ');
        const outs = row.logs.map((l: any) => l.out ? format(parseISO(l.out), 'HH:mm') : '—').join('; ');
        return [
          dateStr,
          v.category || '',
          formatNameAbbreviated(v.name),
          v.callsign || '',
          v.group || '',
          v.location || '',
          ins,
          outs
        ];
      }
    });

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const fileName = `Звіт_відвідування_${startDate}_${endDate}.csv`;
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-roboto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-normal tracking-tight">Звіти та Аналітика</h1>
          <p className="text-sm text-muted-foreground mt-1">Детальна статистика відвідувань системи</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-card rounded-3xl p-6 shadow-sm">
          <div className="text-xs text-muted-foreground font-normal uppercase tracking-wider mb-2">Загалом відвідувань</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-normal">{totalVisits}</div>
            <div className="text-emerald-500 text-xs font-normal mb-1">за місяць</div>
          </div>
        </div>
        <div className="bg-card rounded-3xl p-6 shadow-sm">
          <div className="text-xs text-muted-foreground font-normal uppercase tracking-wider mb-2">Унікальних осіб</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-normal">{uniqueVisitors}</div>
            <div className="text-primary text-xs font-normal mb-1">активні</div>
          </div>
        </div>
        <div className="bg-card rounded-3xl p-6 shadow-sm">
          <button 
            onClick={downloadCSV}
            className="w-full h-full flex flex-col items-center justify-center gap-2 hover:bg-secondary/50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <span className="text-sm font-normal">Завантажити CSV звіт</span>
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-card rounded-2xl p-2 shadow-sm border border-border/50">
          <div className="flex items-center gap-2 px-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">З:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-normal focus:ring-0 cursor-pointer"
            />
          </div>
          <div className="hidden sm:block h-4 w-[1px] bg-border" />
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">По:</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-normal focus:ring-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-card rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Пошук за іменем чи позивним..."
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-xl bg-muted/20 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-normal text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select 
                    className="px-4 py-2 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/20 font-normal text-sm appearance-none cursor-pointer hover:bg-muted transition-colors min-w-[140px]"
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                  >
                    <option value="all">Всі групи</option>
                    {(groups || []).map(g => (
                      <option key={g.id || g.name} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden mt-4">
                {/* Desktop Header */}
                <div className="hidden md:grid md:grid-cols-[100px_1fr_120px_100px_80px_100px] bg-muted/30 text-[10px] font-normal uppercase tracking-wider text-muted-foreground border-b border-border">
                  <div className="px-6 py-3 border-r border-border">Дата</div>
                  <div className="px-6 py-3 border-r border-border">Користувач</div>
                  <div className="px-6 py-3 border-r border-border">Звідки (Бригада)</div>
                  <div className="px-6 py-3 border-r border-border">Група</div>
                  <div className="px-6 py-3 border-r border-border">Вхід</div>
                  <div className="px-6 py-3 text-right">Вихід</div>
                </div>

                <div className="divide-y divide-border">
                  {reportRows.length > 0 ? (
                    reportRows.map((row, idx) => {
                      const dateStr = format(row.date, 'dd.MM.yyyy');
                      
                      if (row.type === 'dirtySky') {
                        const e = row.event;
                        return (
                          <div key={`ds-${e.id}-${idx}`} className="grid grid-cols-1 md:grid-cols-[100px_1fr_120px_100px_80px_100px] hover:bg-amber-500/5 bg-amber-500/5 transition-colors p-4 md:p-0">
                            <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border text-xs flex justify-between md:block mb-2 md:mb-0">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Дата</span>
                              {dateStr}
                            </div>
                            <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border mb-3 md:mb-0">
                              <div className="md:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1">Подія</div>
                              <div className="text-sm font-normal text-amber-700">Брудне небо</div>
                              <div className="text-[10px] text-muted-foreground uppercase">Спеціальна подія</div>
                            </div>
                            <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border text-xs flex justify-between md:block mb-2 md:mb-0">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Звідки</span>
                              —
                            </div>
                            <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border text-xs flex justify-between md:block mb-2 md:mb-0">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Група</span>
                              Спец. події
                            </div>
                            <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border text-xs tabular-nums text-amber-600 font-normal flex justify-between md:block mb-2 md:mb-0">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Вхід</span>
                              {format(parseISO(e.startTime), 'HH:mm')}
                            </div>
                            <div className="px-0 md:px-6 md:py-4 text-xs tabular-nums text-red-600 font-normal flex justify-between md:block">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Вихід</span>
                              <span className="md:w-full md:text-right md:block">{e.endTime ? format(parseISO(e.endTime), 'HH:mm') : 'триває'}</span>
                            </div>
                          </div>
                        );
                      }

                      const v = row.visitor;
                      const visitorGroup = groups.find(g => g.name === v.group);
                      const blockColor = v.color || visitorGroup?.color;
                      const hasGroupColor = !!blockColor && blockColor !== 'transparent';
                      const rowStyles = hasGroupColor ? {
                        backgroundColor: blockColor.startsWith('#') ? `${blockColor}15` : blockColor,
                      } : {};

                      return (
                        <div key={`${v.id}-${dateStr}-${idx}`} className="grid grid-cols-1 md:grid-cols-[100px_1fr_120px_100px_80px_100px] hover:bg-secondary/30 transition-colors p-4 md:p-0" style={rowStyles}>
                          <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border text-xs flex justify-between md:block mb-2 md:mb-0">
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Дата</span>
                            {dateStr}
                          </div>
                          <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border mb-3 md:mb-0">
                            <div className="md:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1">Користувач</div>
                            <div className="text-[10px] text-muted-foreground uppercase mb-0.5">{v.category}</div>
                            <div className="text-sm font-normal">{formatNameAbbreviated(v.name)}</div>
                            {v.callsign && (
                              <div className="text-[11px] font-bold text-primary/80 uppercase tracking-widest mt-0.5">
                                {v.callsign}
                              </div>
                            )}
                          </div>
                          <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border text-xs flex justify-between md:block mb-2 md:mb-0">
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Звідки</span>
                            {v.location || '—'}
                          </div>
                          <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border text-xs flex justify-between md:block mb-2 md:mb-0">
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Група</span>
                            {v.group || '—'}
                          </div>
                          <div className="px-0 md:px-6 md:py-4 md:border-r md:border-border text-xs tabular-nums text-emerald-600 font-normal flex justify-between md:block mb-2 md:mb-0">
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Вхід</span>
                            <div className="flex flex-col gap-1 md:items-start items-end">
                              {row.logs.map((l: any) => format(parseISO(l.in), 'HH:mm')).join('; ')}
                            </div>
                          </div>
                          <div className="px-0 md:px-6 md:py-4 text-xs tabular-nums text-red-600 font-normal flex justify-between md:block">
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground">Вихід</span>
                            <div className="flex flex-col gap-1 md:items-end items-end w-full">
                              {row.logs.map((l: any) => l.out ? format(parseISO(l.out), 'HH:mm') : 'на посту').join('; ')}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-6 py-12 text-center text-muted-foreground italic text-sm">
                      Даних за обраний період не знайдено
                    </div>
                  )}
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
