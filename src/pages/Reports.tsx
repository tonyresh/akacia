import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { DirtySkyEvent } from '../types';
import { jsPDF } from 'jspdf';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar as CalendarIcon, 
  Search, 
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  ArrowRightCircle
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

type SortField = 'date' | 'user' | 'brigade' | 'group' | 'timeIn' | 'timeOut';

export default function Reports() {
  const { visitors, groups, dirtySkyEvents, securityShifts } = useData();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');

  useEffect(() => {
    if (securityShifts && securityShifts.length > 0 && !selectedShiftId) {
      setSelectedShiftId(securityShifts[0].id);
    }
  }, [securityShifts, selectedShiftId]);

  const selectedShift = useMemo(() => {
    if (!securityShifts || securityShifts.length === 0) return null;
    return securityShifts.find(s => s.id === selectedShiftId) || securityShifts[0];
  }, [securityShifts, selectedShiftId]);

  const selectedShiftComposition = useMemo(() => {
    if (!selectedShift) return 'склад зміни не встановлено';
    const members = (selectedShift.visitorIds || [])
      .map(id => visitors.find(v => v.id === id))
      .filter((v): v is NonNullable<typeof v> => !!v);
    
    if (members.length === 0) return 'склад зміни порожній';
    
    return members.map(m => {
      const parts = [m.category, formatNameAbbreviated(m.name)];
      if (m.callsign) parts.push(`[${m.callsign}]`);
      return parts.filter(Boolean).join(' ');
    }).join(', ');
  }, [selectedShift, visitors]);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      
      logs.forEach(log => {
        if (!log.in) return;
        const logDate = parseISO(log.in);
        if (logDate >= dateRange.start && logDate <= dateRange.end) {
          const start = logDate.getTime();
          const end = log.out ? parseISO(log.out).getTime() : Date.now();
          rows.push({
            type: 'visitor',
            visitor: v,
            date: logDate,
            maxTime: Math.max(start, end),
            log: log
          });
        }
      });
    });

    dirtySkyVisits.forEach(e => {
      const start = parseISO(e.startTime).getTime();
      const end = e.endTime ? parseISO(e.endTime).getTime() : Date.now();
      rows.push({
        type: 'dirtySky',
        event: e,
        date: parseISO(e.startTime),
        maxTime: Math.max(start, end),
        log: { in: e.startTime, out: e.endTime }
      });
    });

    return rows;
  }, [visitors, dirtySkyVisits, dateRange, searchQuery, filterGroup]);

  // Dynamic sorting of the results
  const sortedReportRows = useMemo(() => {
    const sorted = [...reportRows];
    
    sorted.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      if (sortField === 'date') {
        const timeA = a.date.getTime();
        const timeB = b.date.getTime();
        if (timeA !== timeB) {
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        return sortOrder === 'asc' ? a.maxTime - b.maxTime : b.maxTime - a.maxTime;
      } else if (sortField === 'user') {
        const nameA = a.type === 'dirtySky' ? 'Брудне небо' : (a.visitor?.name || '');
        const nameB = b.type === 'dirtySky' ? 'Брудне небо' : (b.visitor?.name || '');
        valA = nameA.toLowerCase();
        valB = nameB.toLowerCase();
      } else if (sortField === 'brigade') {
        const locA = a.type === 'dirtySky' ? '' : (a.visitor?.location || '');
        const locB = b.type === 'dirtySky' ? '' : (b.visitor?.location || '');
        
        // Extract numbers for sorting: "по бригадах по номеру в назві бригади"
        const numA = parseInt(locA.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(locB.match(/\d+/)?.[0] || '0', 10);
        
        if (numA !== numB) {
          valA = numA;
          valB = numB;
        } else {
          valA = locA.toLowerCase();
          valB = locB.toLowerCase();
        }
      } else if (sortField === 'group') {
        const grpA = a.type === 'dirtySky' ? 'Спец. події' : (a.visitor?.group || '');
        const grpB = b.type === 'dirtySky' ? 'Спец. події' : (b.visitor?.group || '');
        valA = grpA.toLowerCase();
        valB = grpB.toLowerCase();
      } else if (sortField === 'timeIn') {
        const insA = a.log?.in ? new Date(a.log.in).getTime() : 0;
        const insB = b.log?.in ? new Date(b.log.in).getTime() : 0;
        valA = insA;
        valB = insB;
      } else if (sortField === 'timeOut') {
        const outA = a.log?.out ? new Date(a.log.out).getTime() : (a.type === 'dirtySky' && a.event?.endTime ? new Date(a.event.endTime).getTime() : 0);
        const outB = b.log?.out ? new Date(b.log.out).getTime() : (b.type === 'dirtySky' && b.event?.endTime ? new Date(b.event.endTime).getTime() : 0);
        valA = outA;
        valB = outB;
      }

      if (valA === valB) return 0;
      if (valA === null || valA === '') return 1;
      if (valB === null || valB === '') return -1;
      
      const comparison = valA < valB ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [reportRows, sortField, sortOrder]);

  const uniqueVisitors = filteredData.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="opacity-30 text-[9px] ml-1">↕</span>;
    return sortOrder === 'asc' 
      ? <span className="text-primary font-bold text-[9px] ml-1">▲</span> 
      : <span className="text-primary font-bold text-[9px] ml-1">▼</span>;
  };

  const downloadCSV = () => {
    const headers = [
      'Дата', 'Звання', 'ПІБ', 'Позивний', 'Група', 'Бригада', 'Час входу', 'Час виходу'
    ];

    const csvRows = sortedReportRows.map(row => {
      const dateStr = format(row.date, 'dd.MM.yyyy');
      if (row.type === 'dirtySky') {
        const e = row.event;
        return [
          dateStr,
          '—',
          'Брудне небо',
          '—',
          'Спец. події',
          '—',
          format(parseISO(e.startTime), 'HH:mm'),
          e.endTime ? format(parseISO(e.endTime), 'HH:mm') : 'триває'
        ];
      } else {
        const v = row.visitor;
        const log = row.log;
        const ins = log?.in ? format(parseISO(log.in), 'HH:mm') : '—';
        const outs = log?.out ? format(parseISO(log.out), 'HH:mm') : 'на посту';
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

    let filename = '';
    const formattedStart = format(parseISO(startDate), 'ddMMyyyy');
    const formattedEnd = format(parseISO(endDate), 'ddMMyyyy');
    if (formattedStart === formattedEnd) {
      filename = `Звіт_${formattedStart}.csv`;
    } else {
      filename = `Звіт_${formattedStart}-${formattedEnd}.csv`;
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Fetch a clean Cyrillic open font to write Ukrainian letters perfectly
      const fontUrl = 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.ttf';
      const response = await fetch(fontUrl);
      if (!response.ok) throw new Error('Failed to fetch font');
      const blob = await response.blob();
      
      const base64Font = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto');
      
      // Document Title
      doc.setFontSize(14);
      doc.text('ЗВІТ ВІДВІДУВАНЬ СИСТЕМИ', 10, 15);
      
      doc.setFontSize(9);
      doc.text(`Період звіту: ${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`, 10, 22);
      doc.text(`Згенеровано: ${format(new Date(), 'dd.MM.yyyy HH:mm:ss')}`, 10, 27);
      doc.text(`Відвідувань: ${totalVisits}  |  Відвідувачів: ${uniqueVisitors}`, 10, 32);
      
      // Horizontal separator
      doc.setDrawColor(200, 200, 200);
      doc.line(10, 35, 200, 35);

      // Table Header row (x boundaries from 10 to 200 represents full 190mm printable width)
      doc.setFillColor(240, 240, 240);
      doc.rect(10, 38, 190, 8, 'F');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      
      doc.text('Дата', 12, 43.5);
      doc.text('Користувач', 34, 43.5);
      doc.text('Звідки (Бригада)', 85, 43.5);
      doc.text('Група', 132, 43.5);
      doc.text('Вхід', 176, 43.5, { align: 'center' });
      doc.text('Вихід', 192, 43.5, { align: 'center' });

      let y = 46;
      const pageHeight = 297;
      const marginBottom = 15;

      doc.setTextColor(0, 0, 0);

      const truncateText = (text: string, maxLen: number) => {
        if (!text) return '—';
        return text.length > maxLen ? text.substring(0, maxLen - 2) + '..' : text;
      };

      sortedReportRows.forEach((row) => {
        if (y > pageHeight - marginBottom) {
          doc.addPage();
          y = 15;
          // Render Table Header on new page
          doc.setFillColor(240, 240, 240);
          doc.rect(10, y, 190, 8, 'F');
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 80);
          doc.text('Дата', 12, y + 5.5);
          doc.text('Користувач', 34, y + 5.5);
          doc.text('Звідки (Бригада)', 85, y + 5.5);
          doc.text('Група', 132, y + 5.5);
          doc.text('Вхід', 176, y + 5.5, { align: 'center' });
          doc.text('Вихід', 192, y + 5.5, { align: 'center' });
          y += 8;
          doc.setTextColor(0, 0, 0);
        }

        doc.setDrawColor(235, 235, 235);
        doc.line(10, y, 200, y);

        const dateStr = format(row.date, 'dd.MM.yyyy');
        doc.setFontSize(8);

        if (row.type === 'dirtySky') {
          const e = row.event;
          const timeInStr = format(parseISO(e.startTime), 'HH:mm');
          const timeOutStr = e.endTime ? format(parseISO(e.endTime), 'HH:mm') : 'триває';

          doc.text(dateStr, 12, y + 5.5);
          doc.setTextColor(180, 83, 9); // Amber
          doc.text('Брудне небо', 34, y + 4.2);
          doc.setFontSize(7);
          doc.setTextColor(120, 120, 120);
          doc.text('Спеціальна подія', 34, y + 7.5);
          
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text('—', 85, y + 5.5);
          doc.text('Спец. події', 132, y + 5.5);
          
          doc.setTextColor(5, 150, 105); // emerald
          doc.text(timeInStr, 176, y + 5.5, { align: 'center' });
          doc.setTextColor(220, 38, 38); // red
          doc.text(timeOutStr, 192, y + 5.5, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        } else {
          const v = row.visitor;
          const log = row.log;
          const timeInStr = log?.in ? format(parseISO(log.in), 'HH:mm') : '—';
          const timeOutStr = log?.out ? format(parseISO(log.out), 'HH:mm') : 'на посту';

          doc.text(dateStr, 12, y + 5.5);

          // Render Category above name inside Visitor cell
          doc.setFontSize(7);
          doc.setTextColor(120, 120, 120);
          doc.text(truncateText(v.category, 30), 34, y + 3.2);

          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          const namePart = formatNameAbbreviated(v.name);
          doc.text(namePart, 34, y + 6.2);
          
          if (v.callsign) {
            doc.setFontSize(7);
            doc.setTextColor(30, 41, 59);
            doc.text(`[${v.callsign}]`, 34 + doc.getTextWidth(namePart) + 1.5, y + 6.2);
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
          }

          doc.text(truncateText(v.location, 25), 85, y + 5.5);
          doc.text(truncateText(v.group, 20), 132, y + 5.5);
          
          doc.setTextColor(5, 150, 105); // emerald
          doc.text(timeInStr, 176, y + 5.5, { align: 'center' });
          doc.setTextColor(timeOutStr === 'на посту' ? 100 : 220, timeOutStr === 'на посту' ? 116 : 38, timeOutStr === 'на посту' ? 139 : 38);
          doc.text(timeOutStr, 192, y + 5.5, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        }

        y += 10;
      });

      let pdfFilename = '';
      const formattedStart = format(parseISO(startDate), 'ddMMyyyy');
      const formattedEnd = format(parseISO(endDate), 'ddMMyyyy');
      if (formattedStart === formattedEnd) {
        pdfFilename = `Звіт_${formattedStart}.pdf`;
      } else {
        pdfFilename = `Звіт_${formattedStart}-${formattedEnd}.pdf`;
      }

      doc.save(pdfFilename);
    } catch (e) {
      console.error(e);
      alert('Помилка формування PDF звіту. Будь ласка, спробуйте ще раз.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-12 font-roboto font-normal">
      {/* Summary Metrics & Save Row - polished dashboard flow */}
      <div className="flex flex-col lg:flex-row gap-3 no-print">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-primary/10 rounded-3xl py-2 sm:py-2.5 px-3 sm:px-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-2">
              <div className="text-xs sm:text-sm text-primary font-bold uppercase tracking-wider">Відвідувань:</div>
              <div className="text-xs sm:text-sm font-bold text-primary">{totalVisits}</div>
            </div>
            <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-normal shadow-lg shadow-primary/20">
               <ArrowRightCircle className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>

          <div className="bg-emerald-500/10 rounded-3xl py-2 sm:py-2.5 px-3 sm:px-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-2">
              <div className="text-xs sm:text-sm text-emerald-600 font-bold uppercase tracking-wider">Відвідувачів:</div>
              <div className="text-xs sm:text-sm font-bold text-emerald-700">{uniqueVisitors}</div>
            </div>
            <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-normal shadow-lg shadow-emerald-500/20">
               <Users className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
        </div>

        {/* Polished Save Card with Shift dropdown and Print button */}
        <div className="bg-card border border-border/50 rounded-3xl py-1.5 px-4 flex flex-col xs:flex-row xs:items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all lg:w-[48%]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1">
            <div className="flex flex-col">
              <div className="text-xs text-foreground/80 font-bold uppercase tracking-wider leading-tight">Зберегти та надрукувати:</div>
              <div className="text-[10px] text-muted-foreground">Звіт за вказаний період</div>
            </div>
            
            <div className="flex items-center gap-2 sm:ml-auto select-none">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Чергова зміна:</span>
              <select
                value={selectedShiftId}
                onChange={(e) => setSelectedShiftId(e.target.value)}
                className="text-xs font-semibold px-2 py-1 border border-border/60 bg-muted/45 rounded-lg outline-none cursor-pointer focus:ring-1 focus:ring-primary/20 pr-6 text-foreground"
              >
                {securityShifts && securityShifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                {(!securityShifts || securityShifts.length === 0) && (
                  <option value="">Немає змін</option>
                )}
              </select>
            </div>
          </div>
          <div className="flex gap-1.5 self-end xs:self-auto shrink-0">
            <button 
              onClick={downloadCSV}
              className="px-2.5 py-1 sm:py-1.5 bg-secondary hover:bg-muted text-foreground rounded-xl flex items-center justify-center font-bold text-[10px] sm:text-xs uppercase cursor-pointer select-none active:scale-95 transition-all"
            >
              CSV
            </button>
            <button 
              onClick={generatePDF}
              disabled={isGeneratingPdf}
              className="px-2.5 py-1 sm:py-1.5 bg-secondary hover:bg-muted text-foreground rounded-xl flex items-center justify-center font-bold text-[10px] sm:text-xs uppercase cursor-pointer select-none active:scale-95 transition-all disabled:opacity-45"
            >
              {isGeneratingPdf ? 'PDF...' : 'PDF'}
            </button>
            <button 
              onClick={() => window.print()}
              className="px-3.5 py-1 sm:py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl flex items-center justify-center font-bold text-[10px] sm:text-xs uppercase cursor-pointer select-none active:scale-95 transition-all shadow-md shadow-primary/10"
            >
              Друк
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center no-print">
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

      {/* Print-Only Report Header (Visually rendered on A4 landscape/portrait printer output only) */}
      <div className="hidden print:block text-black mb-6 font-roboto">
        <div className="border-b-2 border-black pb-3 mb-3 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wide">Звіт відвідувань системи</h1>
            <p className="text-xs text-neutral-600 mt-1">
              Діапазон дат: {format(parseISO(startDate), 'dd.MM.yyyy')} — {format(parseISO(endDate), 'dd.MM.yyyy')}
            </p>
          </div>
          <p className="text-right text-xs text-neutral-500">
            Згенеровано: {format(new Date(), 'dd.MM.yyyy HH:mm')}
          </p>
        </div>
        
        <div className="border border-neutral-300 p-3 rounded-xl text-xs mb-4 space-y-2">
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-neutral-500 block">Чергова зміна:</span>
            <span className="text-sm font-semibold">{selectedShift?.name || '—'}</span>
          </div>
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-neutral-500 block">Склад зміни:</span>
            <span className="text-xs font-normal text-neutral-800">{selectedShiftComposition}</span>
          </div>
        </div>

        <div className="flex gap-8 text-xs mb-2">
          <div>
            <span className="font-bold">Кількість відвідувань: </span>
            <span>{totalVisits}</span>
          </div>
          <div>
            <span className="font-bold">Кількість відвідувачів: </span>
            <span>{uniqueVisitors}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-card rounded-3xl overflow-hidden shadow-sm">
        <div className="p-3">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-4 no-print">
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

              <div className="rounded-2xl overflow-hidden mt-4 print:mt-0">
                {/* Desktop Header with interactive Sorting */}
                <div className="reports-table-grid hidden md:grid md:grid-cols-[90px_1fr_130px_180px_60px_70px] md:items-center bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border select-none">
                  <button 
                    onClick={() => handleSort('date')}
                    className="px-2 py-2 border-r border-border text-center justify-center flex items-center cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none h-full"
                  >
                    Дата{renderSortIndicator('date')}
                  </button>
                  <button 
                    onClick={() => handleSort('user')}
                    className="px-3 py-2 border-r border-border text-left flex items-center cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none h-full"
                  >
                    Користувач{renderSortIndicator('user')}
                  </button>
                  <button 
                    onClick={() => handleSort('brigade')}
                    className="px-3 py-2 border-r border-border text-left flex items-center cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none h-full"
                  >
                    Звідки{renderSortIndicator('brigade')}
                  </button>
                  <button 
                    onClick={() => handleSort('group')}
                    className="px-3 py-2 border-r border-border text-left flex items-center cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none h-full"
                  >
                    Група{renderSortIndicator('group')}
                  </button>
                  <button 
                    onClick={() => handleSort('timeIn')}
                    className="px-2 py-2 border-r border-border text-center justify-center flex items-center cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none h-full"
                  >
                    Вхід{renderSortIndicator('timeIn')}
                  </button>
                  <button 
                    onClick={() => handleSort('timeOut')}
                    className="px-2 py-2 text-center justify-center flex items-center cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none h-full"
                  >
                    Вихід{renderSortIndicator('timeOut')}
                  </button>
                </div>

                <div className="divide-y divide-border">
                  {sortedReportRows.length > 0 ? (
                    sortedReportRows.map((row, idx) => {
                      const dateStr = format(row.date, 'dd.MM.yyyy');
                      
                      if (row.type === 'dirtySky') {
                        const e = row.event;
                        return (
                          <div key={`ds-${e.id}-${idx}`} className="reports-table-grid grid grid-cols-1 md:grid-cols-[90px_1fr_130px_180px_60px_70px] md:items-center hover:bg-amber-500/5 bg-amber-500/5 transition-colors p-2 md:p-0">
                            <div className="px-0 md:px-2 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center md:justify-center md:text-center mb-2 md:mb-0 h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Дата</span>
                              {dateStr}
                            </div>
                            <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border mb-3 md:mb-0 h-full flex flex-col justify-center">
                              <div className="md:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1 no-print">Подія</div>
                              <div className="text-sm font-normal text-amber-700">Брудне небо</div>
                              <div className="text-[10px] text-muted-foreground uppercase">Спеціальна подія</div>
                            </div>
                            <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center mb-2 md:mb-0 truncate whitespace-nowrap h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Звідки</span>
                              —
                            </div>
                            <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center mb-2 md:mb-0 truncate whitespace-nowrap h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Група</span>
                              Спец. події
                            </div>
                            <div className="px-0 md:px-2 md:py-2 md:border-r md:border-border text-xs tabular-nums text-amber-600 font-normal flex justify-between md:flex md:items-center md:justify-center mb-2 md:mb-0 md:text-center h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Вхід</span>
                              {format(parseISO(e.startTime), 'HH:mm')}
                            </div>
                            <div className="px-0 md:px-2 md:py-2 text-xs tabular-nums text-red-600 font-normal flex justify-between md:flex md:items-center md:justify-center h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Вихід</span>
                              <span className="md:w-full md:text-center md:block">{e.endTime ? format(parseISO(e.endTime), 'HH:mm') : 'триває'}</span>
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
                        <div key={`${v.id}-${row.log?.in || idx}`} className="reports-table-grid grid grid-cols-1 md:grid-cols-[90px_1fr_130px_180px_60px_70px] md:items-center hover:bg-secondary/30 transition-colors p-2 md:p-0" style={rowStyles}>
                          <div className="px-0 md:px-2 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center md:justify-center md:text-center mb-2 md:mb-0 h-full">
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Дата</span>
                            {dateStr}
                          </div>
                          <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border mb-3 md:mb-0 h-full flex flex-col justify-center">
                            <div className="md:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1 no-print">Користувач</div>
                            <div className="text-[10px] text-muted-foreground uppercase mb-0.5">{v.category}</div>
                            <div className="text-sm font-normal">{formatNameAbbreviated(v.name)}</div>
                            {v.callsign && (
                              <div className="text-[11px] font-bold text-primary/80 uppercase tracking-widest mt-0.5">
                                {v.callsign}
                              </div>
                            )}
                          </div>
                          <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center mb-2 md:mb-0 truncate whitespace-nowrap h-full" title={v.location}>
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Звідки</span>
                            {v.location || '—'}
                          </div>
                          <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center mb-2 md:mb-0 truncate whitespace-nowrap h-full" title={v.group}>
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Група</span>
                            {v.group || '—'}
                          </div>
                          <div className="px-0 md:px-2 md:py-2 md:border-r md:border-border text-xs tabular-nums text-emerald-600 font-normal flex justify-between md:flex md:items-center md:justify-center mb-2 md:mb-0 md:text-center h-full">
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Вхід</span>
                            {row.log?.in ? format(parseISO(row.log.in), 'HH:mm') : '—'}
                          </div>
                          <div className="px-0 md:px-2 md:py-2 text-xs tabular-nums text-red-600 font-normal flex justify-between md:flex md:items-center md:justify-center h-full">
                            <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Вихід</span>
                            <span className="md:w-full md:text-center md:block">{row.log?.out ? format(parseISO(row.log.out), 'HH:mm') : 'на посту'}</span>
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
