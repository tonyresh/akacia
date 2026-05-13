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
  differenceInMinutes
} from 'date-fns';
import { uk } from 'date-fns/locale';

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
      const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           v.callsign?.toLowerCase().includes(searchQuery.toLowerCase());
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

  const uniqueVisitors = filteredData.length;

  const downloadCSV = () => {
    const headers = [
      'Дата', 'Звання', 'ПІБ', 'Позивний', 'Група', 'Час входу', 'Час виходу', 'Тривалість (хв)'
    ];

    const rows: string[][] = [];
    filteredData.forEach(v => {
      const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
      logs.forEach(log => {
        if (!log.in) return;
        const logDate = parseISO(log.in);
        if (logDate >= dateRange.start && logDate <= dateRange.end) {
          rows.push([
            format(logDate, 'dd.MM.yyyy'),
            v.category,
            v.name,
            v.callsign || '',
            v.group || '',
            format(logDate, 'HH:mm'),
            log.out ? format(parseISO(log.out), 'HH:mm') : '',
            v.totalTimeMinutes ? v.totalTimeMinutes.toString() : '0'
          ]);
        }
      });
    });

    dirtySkyVisits.forEach(e => {
      const logDate = parseISO(e.startTime);
      rows.push([
        format(logDate, 'dd.MM.yyyy'),
        '—',
        'Брудне небо',
        '—',
        'Спец. події',
        format(logDate, 'HH:mm'),
        e.endTime ? format(parseISO(e.endTime), 'HH:mm') : 'триває',
        e.endTime ? differenceInMinutes(parseISO(e.endTime), logDate).toString() : '0'
      ]);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
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
        
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-card border border-border rounded-2xl p-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase font-normal">З:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-normal focus:ring-0 cursor-pointer"
            />
          </div>
          <div className="hidden sm:block h-4 w-[1px] bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase font-normal">По:</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-normal focus:ring-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="text-xs text-muted-foreground font-normal uppercase tracking-wider mb-2">Загалом відвідувань</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-normal">{totalVisits}</div>
            <div className="text-emerald-500 text-xs font-normal mb-1">за місяць</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="text-xs text-muted-foreground font-normal uppercase tracking-wider mb-2">Унікальних осіб</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-normal">{uniqueVisitors}</div>
            <div className="text-primary text-xs font-normal mb-1">активні</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
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

      {/* Main Content Area */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
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
                    className="px-4 py-2 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/20 font-normal text-sm"
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

              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-muted/30 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 border-b border-border">Дата</th>
                      <th className="px-6 py-3 border-b border-border">Звання / Ім'я</th>
                      <th className="px-6 py-3 border-b border-border">Позивний</th>
                      <th className="px-6 py-3 border-b border-border">Група</th>
                      <th className="px-6 py-3 border-b border-border">Вхід</th>
                      <th className="px-6 py-3 border-b border-border">Вихід</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dirtySkyVisits.map((e, idx) => {
                      const logDate = parseISO(e.startTime);
                      return (
                        <tr key={`ds-${e.id}`} className="hover:bg-amber-500/5 bg-amber-500/5 transition-colors">
                          <td className="px-6 py-4 border-b border-border text-xs">
                            {format(logDate, 'dd.MM.yyyy')}
                          </td>
                          <td className="px-6 py-4 border-b border-border">
                            <div className="text-sm font-normal text-amber-700">Брудне небо</div>
                            <div className="text-[10px] text-muted-foreground uppercase">Спеціальна подія</div>
                          </td>
                          <td className="px-6 py-4 border-b border-border text-xs text-muted-foreground italic">—</td>
                          <td className="px-6 py-4 border-b border-border text-xs">Спец. події</td>
                          <td className="px-6 py-4 border-b border-border text-xs tabular-nums text-amber-600 font-normal">
                            {format(logDate, 'HH:mm')}
                          </td>
                          <td className="px-6 py-4 border-b border-border text-xs tabular-nums text-red-600 font-normal">
                            {e.endTime ? format(parseISO(e.endTime), 'HH:mm') : 'триває'}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredData.length > 0 || dirtySkyVisits.length > 0 ? (
                      filteredData.map((v) => {
                        const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
                        const rangeLogs = logs.filter(log => log.in && parseISO(log.in) >= dateRange.start && parseISO(log.in) <= dateRange.end);
                        
                        return rangeLogs.map((log, lIdx) => (
                          <tr key={`${v.id}-${lIdx}`} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-6 py-4 border-b border-border text-xs">
                              {format(parseISO(log.in!), 'dd.MM.yyyy')}
                            </td>
                            <td className="px-6 py-4 border-b border-border">
                              <div className="text-sm font-normal">{v.name}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">{v.category}</div>
                            </td>
                            <td className="px-6 py-4 border-b border-border text-xs text-muted-foreground italic">
                              {v.callsign || '—'}
                            </td>
                            <td className="px-6 py-4 border-b border-border text-xs">
                              {v.group || '—'}
                            </td>
                            <td className="px-6 py-4 border-b border-border text-xs tabular-nums text-emerald-600 font-normal">
                              {format(parseISO(log.in!), 'HH:mm')}
                            </td>
                            <td className="px-6 py-4 border-b border-border text-xs tabular-nums text-red-600 font-normal">
                              {log.out ? format(parseISO(log.out), 'HH:mm') : 'на посту'}
                            </td>
                          </tr>
                        ));
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic text-sm">
                          Даних за обраний період не знайдено
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
