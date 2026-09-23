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
  ArrowRightCircle,
  Printer,
  FileDown,
  X,
  Eye,
  Shield,
  Check
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
import PrintableReportDocument from '../components/PrintableReportDocument';

type SortField = 'date' | 'user' | 'brigade' | 'group' | 'timeIn' | 'timeOut';

export default function Reports() {
  const { visitors, groups, dirtySkyEvents, securityShifts, dutyEvents } = useData();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');

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

    (dutyEvents || []).forEach(de => {
      const eventDate = parseISO(de.timestamp);
      if (eventDate >= dateRange.start && eventDate <= dateRange.end) {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchShift = (de.shiftName || '').toLowerCase().includes(q);
          const matchAction = de.type === 'start' ? 'заступила'.includes(q) : 'закінчила'.includes(q);
          const matchGeneral = 'чергування'.includes(q) || 'чергова зміна'.includes(q) || 'охорона'.includes(q);
          if (!matchShift && !matchAction && !matchGeneral) return;
        }
        if (filterGroup !== 'all' && filterGroup !== 'Рота охорони' && filterGroup !== 'Охорона' && filterGroup !== 'Чергова служба') {
          return;
        }
        const t = eventDate.getTime();
        rows.push({
          type: 'dutyEvent',
          event: de,
          date: eventDate,
          maxTime: t,
          log: de.type === 'start' ? { in: de.timestamp } : { out: de.timestamp }
        });
      }
    });

    return rows;
  }, [visitors, dirtySkyVisits, dutyEvents, dateRange, searchQuery, filterGroup]);

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
        const nameA = a.type === 'dirtySky' ? 'Брудне небо' : a.type === 'dutyEvent' ? `Чергова зміна ${a.event?.shiftName}` : (a.visitor?.name || '');
        const nameB = b.type === 'dirtySky' ? 'Брудне небо' : b.type === 'dutyEvent' ? `Чергова зміна ${b.event?.shiftName}` : (b.visitor?.name || '');
        valA = nameA.toLowerCase();
        valB = nameB.toLowerCase();
      } else if (sortField === 'brigade') {
        const locA = a.type === 'dirtySky' ? '' : a.type === 'dutyEvent' ? 'КПП' : (a.visitor?.location || '');
        const locB = b.type === 'dirtySky' ? '' : b.type === 'dutyEvent' ? 'КПП' : (b.visitor?.location || '');
        
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
        const grpA = a.type === 'dirtySky' ? 'Спец. події' : a.type === 'dutyEvent' ? 'Рота охорони' : (a.visitor?.group || '');
        const grpB = b.type === 'dirtySky' ? 'Спец. події' : b.type === 'dutyEvent' ? 'Рота охорони' : (b.visitor?.group || '');
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

  const currentlyOnSiteCount = useMemo(() => {
    return visitors.filter(v => {
      const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
      const lastLog = logs[logs.length - 1];
      return lastLog && lastLog.in && !lastLog.out;
    }).length;
  }, [visitors]);

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
      } else if (row.type === 'dutyEvent') {
        const e = row.event;
        const isStart = e.type === 'start';
        const timeStr = format(parseISO(e.timestamp), 'HH:mm');
        return [
          dateStr,
          'Чергування',
          `Чергова зміна "${e.shiftName}" (${isStart ? 'Заступила на чергування' : 'Закінчила чергування'})`,
          isStart ? 'Заступила' : 'Закінчила',
          'Рота охорони',
          'КПП',
          isStart ? timeStr : '—',
          !isStart ? timeStr : '—'
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
      const isLandscape = pdfOrientation === 'landscape';
      const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const marginX = 10;
      const printableWidth = pageWidth - (marginX * 2);

      // Load fonts from local public directory
      try {
        const fontRes = await fetch('/fonts/Roboto-Regular.ttf');
        if (fontRes.ok) {
          const blob = await fontRes.blob();
          const base64Font = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
          doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
          doc.setFont('Roboto', 'normal');
        }
      } catch (fontErr) {
        console.warn('Could not load local font', fontErr);
      }

      try {
        const fontBoldRes = await fetch('/fonts/Roboto-Bold.ttf');
        if (fontBoldRes.ok) {
          const blobB = await fontBoldRes.blob();
          const base64Bold = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blobB);
          });
          doc.addFileToVFS('Roboto-Bold.ttf', base64Bold);
          doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
        }
      } catch (boldErr) {
        console.warn('Could not load bold font', boldErr);
      }

      const formattedStart = format(parseISO(startDate), 'dd.MM.yyyy');
      const formattedEnd = format(parseISO(endDate), 'dd.MM.yyyy');
      const docRegNumber = `ЗВ-${format(new Date(), 'yyyyMMdd')}/${format(parseISO(startDate), 'dd')}`;

      // Column widths based on orientation
      const colWidths = isLandscape
        ? { num: 10, date: 24, name: 78, brigade: 48, group: 40, in: 22, out: 22, status: 21 }
        : { num: 9, date: 20, name: 54, brigade: 33, group: 30, in: 16, out: 16, status: 12 };

      const colX = {
        num: marginX,
        date: marginX + colWidths.num,
        name: marginX + colWidths.num + colWidths.date,
        brigade: marginX + colWidths.num + colWidths.date + colWidths.name,
        group: marginX + colWidths.num + colWidths.date + colWidths.name + colWidths.brigade,
        in: marginX + colWidths.num + colWidths.date + colWidths.name + colWidths.brigade + colWidths.group,
        out: marginX + colWidths.num + colWidths.date + colWidths.name + colWidths.brigade + colWidths.group + colWidths.in,
        status: marginX + colWidths.num + colWidths.date + colWidths.name + colWidths.brigade + colWidths.group + colWidths.in + colWidths.out
      };

      const truncateText = (text: string, maxLen: number) => {
        if (!text) return '—';
        return text.length > maxLen ? text.substring(0, maxLen - 2) + '..' : text;
      };

      let pageNum = 1;

      const renderHeader = (isFirstPage: boolean) => {
        if (isFirstPage) {
          // Document Title & Subtitle
          doc.setFont('Roboto', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(20, 20, 20);
          doc.text('ЖУРНАЛ ОБЛІКУ ВІДВІДУВАЧІВ ТА ПЕРЕМІЩЕНЬ (КПП)', marginX, 13);
          
          doc.setFont('Roboto', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text('Контрольно-пропускний пункт • Військова частина • Офіційний зведений звіт', marginX, 17.5);
          
          doc.text(`Реєстраційний номер: ${docRegNumber}   |   Сформовано: ${format(new Date(), 'dd.MM.yyyy HH:mm:ss')}`, marginX, 22);
          doc.text(`Період звітування: ${formattedStart} — ${formattedEnd}`, marginX, 26);
          doc.text(`Чергова зміна: ${selectedShift?.name || '—'}   |   Склад наряду: ${truncateText(selectedShiftComposition, isLandscape ? 110 : 70)}`, marginX, 30);
          doc.text(`Всього фіксацій: ${totalVisits}   |   Унікальних осіб: ${uniqueVisitors}   |   «Брудне небо»: ${dirtySkyVisits.length}   |   На території (на посту): ${currentlyOnSiteCount}`, marginX, 34);

          doc.setDrawColor(30, 30, 30);
          doc.setLineWidth(0.4);
          doc.line(marginX, 37, marginX + printableWidth, 37);

          return 40;
        } else {
          // Running header on page 2+
          doc.setFont('Roboto', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(120, 120, 120);
          doc.text(`Журнал обліку КПП (${formattedStart} — ${formattedEnd}) • Реєстр: ${docRegNumber}`, marginX, 10);
          doc.line(marginX, 12, marginX + printableWidth, 12);
          return 14;
        }
      };

      const renderTableHeader = (currentY: number) => {
        doc.setFillColor(242, 242, 245);
        doc.rect(marginX, currentY, printableWidth, 7, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(marginX, currentY, printableWidth, 7, 'S');

        doc.setFont('Roboto', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(50, 50, 50);

        doc.text('№', colX.num + colWidths.num / 2, currentY + 4.8, { align: 'center' });
        doc.text('Дата', colX.date + colWidths.date / 2, currentY + 4.8, { align: 'center' });
        doc.text('Звання, ПІБ, Позивний', colX.name + 2, currentY + 4.8);
        doc.text('Звідки (Бригада)', colX.brigade + 2, currentY + 4.8);
        doc.text('Група', colX.group + 2, currentY + 4.8);
        doc.text('Вхід', colX.in + colWidths.in / 2, currentY + 4.8, { align: 'center' });
        doc.text('Вихід', colX.out + colWidths.out / 2, currentY + 4.8, { align: 'center' });
        doc.text('Статус', colX.status + colWidths.status / 2, currentY + 4.8, { align: 'center' });

        return currentY + 7;
      };

      let y = renderHeader(true);
      y = renderTableHeader(y);

      sortedReportRows.forEach((row, idx) => {
        const rowHeight = 7.5;
        if (y + rowHeight > pageHeight - 20) {
          // Bottom footer
          doc.setFont('Roboto', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(140, 140, 140);
          doc.text(`Сторінка ${pageNum}`, pageWidth / 2, pageHeight - 7, { align: 'center' });

          doc.addPage();
          pageNum++;
          y = renderHeader(false);
          y = renderTableHeader(y);
        }

        // Row background
        if (row.type === 'dirtySky') {
          doc.setFillColor(254, 243, 199); // amber 100
          doc.rect(marginX, y, printableWidth, rowHeight, 'F');
        } else if (row.type === 'dutyEvent') {
          if (row.event?.type === 'start') {
            doc.setFillColor(236, 253, 245); // emerald 50
          } else {
            doc.setFillColor(255, 241, 242); // rose 50
          }
          doc.rect(marginX, y, printableWidth, rowHeight, 'F');
        } else if (idx % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(marginX, y, printableWidth, rowHeight, 'F');
        }

        // Thin separator
        doc.setDrawColor(225, 225, 230);
        doc.setLineWidth(0.1);
        doc.line(marginX, y + rowHeight, marginX + printableWidth, y + rowHeight);

        const dateStr = format(row.date, 'dd.MM.yyyy');

        // Column 1: Index
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`${idx + 1}`, colX.num + colWidths.num / 2, y + 4.8, { align: 'center' });

        // Column 2: Date
        doc.setTextColor(50, 50, 50);
        doc.text(dateStr, colX.date + colWidths.date / 2, y + 4.8, { align: 'center' });

        if (row.type === 'dirtySky') {
          const e = row.event;
          const timeInStr = format(parseISO(e.startTime), 'HH:mm');
          const timeOutStr = e.endTime ? format(parseISO(e.endTime), 'HH:mm') : 'триває';
          const isOngoing = !e.endTime;

          doc.setFont('Roboto', 'bold');
          doc.setTextColor(180, 83, 9);
          doc.text('⚠️ БРУДНЕ НЕБО (Спец. подія)', colX.name + 2, y + 4.8);

          doc.setFont('Roboto', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text('—', colX.brigade + 2, y + 4.8);
          doc.text('Спец. події', colX.group + 2, y + 4.8);

          doc.setFont('Roboto', 'bold');
          doc.setTextColor(180, 83, 9);
          doc.text(timeInStr, colX.in + colWidths.in / 2, y + 4.8, { align: 'center' });
          doc.setTextColor(isOngoing ? 220 : 50, isOngoing ? 38 : 50, isOngoing ? 38 : 50);
          doc.text(timeOutStr, colX.out + colWidths.out / 2, y + 4.8, { align: 'center' });

          doc.setFontSize(6.5);
          doc.setTextColor(isOngoing ? 180 : 100, isOngoing ? 83 : 100, isOngoing ? 9 : 100);
          doc.text(isOngoing ? 'Триває' : 'Закрито', colX.status + colWidths.status / 2, y + 4.8, { align: 'center' });
        } else if (row.type === 'dutyEvent') {
          const e = row.event;
          const isStart = e.type === 'start';
          const timeStr = format(parseISO(e.timestamp), 'HH:mm');
          const actionText = isStart ? 'Заступила на чергування' : 'Закінчила чергування';

          doc.setFont('Roboto', 'bold');
          if (isStart) {
            doc.setTextColor(5, 150, 105);
          } else {
            doc.setTextColor(225, 29, 72);
          }
          doc.text(`[ЧЕРГУВАННЯ] ${e.shiftName}: ${actionText}`, colX.name + 2, y + 4.8);

          doc.setFont('Roboto', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text('КПП', colX.brigade + 2, y + 4.8);
          doc.text('Рота охорони', colX.group + 2, y + 4.8);

          if (isStart) {
            doc.setFont('Roboto', 'bold');
            doc.setTextColor(5, 150, 105);
            doc.text(timeStr, colX.in + colWidths.in / 2, y + 4.8, { align: 'center' });
            doc.setFont('Roboto', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text('—', colX.out + colWidths.out / 2, y + 4.8, { align: 'center' });
          } else {
            doc.setFont('Roboto', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text('—', colX.in + colWidths.in / 2, y + 4.8, { align: 'center' });
            doc.setFont('Roboto', 'bold');
            doc.setTextColor(225, 29, 72);
            doc.text(timeStr, colX.out + colWidths.out / 2, y + 4.8, { align: 'center' });
          }

          doc.setFontSize(6.5);
          doc.setTextColor(isStart ? 5 : 225, isStart ? 150 : 29, isStart ? 105 : 72);
          doc.text(isStart ? 'Заступила' : 'Закінчила', colX.status + colWidths.status / 2, y + 4.8, { align: 'center' });
        } else {
          const v = row.visitor;
          const log = row.log;
          const timeInStr = log?.in ? format(parseISO(log.in), 'HH:mm') : '—';
          const timeOutStr = log?.out ? format(parseISO(log.out), 'HH:mm') : 'на посту';
          const isOnSite = !log?.out;

          // Person
          const categoryStr = v.category ? `${v.category.toUpperCase()} ` : '';
          const namePart = formatNameAbbreviated(v.name);
          const callsignPart = v.callsign ? ` [${v.callsign}]` : '';
          const fullPersonText = truncateText(`${categoryStr}${namePart}${callsignPart}`, isLandscape ? 45 : 30);

          doc.setFont('Roboto', 'normal');
          doc.setTextColor(20, 20, 20);
          doc.text(fullPersonText, colX.name + 2, y + 4.8);

          // Brigade
          doc.setTextColor(60, 60, 60);
          doc.text(truncateText(v.location, isLandscape ? 28 : 18), colX.brigade + 2, y + 4.8);

          // Group
          doc.text(truncateText(v.group, isLandscape ? 24 : 16), colX.group + 2, y + 4.8);

          // In time
          doc.setFont('Roboto', 'normal');
          doc.setTextColor(5, 150, 105);
          doc.text(timeInStr, colX.in + colWidths.in / 2, y + 4.8, { align: 'center' });

          // Out time
          doc.setTextColor(isOnSite ? 180 : 50, isOnSite ? 83 : 50, isOnSite ? 9 : 50);
          doc.text(timeOutStr, colX.out + colWidths.out / 2, y + 4.8, { align: 'center' });

          // Status badge
          doc.setFontSize(6.5);
          doc.setTextColor(isOnSite ? 5 : 120, isOnSite ? 150 : 120, isOnSite ? 105 : 120);
          doc.text(isOnSite ? 'На посту' : 'Вибув', colX.status + colWidths.status / 2, y + 4.8, { align: 'center' });
        }

        y += rowHeight;
      });

      // Signature block on the last page
      if (y + 32 > pageHeight - 15) {
        // Bottom footer
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text(`Сторінка ${pageNum}`, pageWidth / 2, pageHeight - 7, { align: 'center' });

        doc.addPage();
        pageNum++;
        y = 15;
      }

      y += 8;
      doc.setDrawColor(30, 30, 30);
      doc.setLineWidth(0.3);
      doc.line(marginX, y, marginX + printableWidth, y);
      y += 5;

      doc.setFont('Roboto', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);

      const sigColW = printableWidth / 3;
      // Col 1: Звіт склав
      doc.text('Звіт склав (Черговий КПП):', marginX, y);
      doc.text('Підпис: ____________ / ПІБ: ________________', marginX, y + 6);

      // Col 2: Зміну здав
      doc.text('Зміну здав:', marginX + sigColW, y);
      doc.text('Підпис: ____________ / ПІБ: ________________', marginX + sigColW, y + 6);

      // Col 3: Зміну прийняв
      doc.text('Зміну прийняв:', marginX + sigColW * 2, y);
      doc.text('Підпис: ____________ / ПІБ: ________________', marginX + sigColW * 2, y + 6);

      y += 12;
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Дата засвідчення: «___» ____________ 2026 р.         М. П.         Автоматизований комплекс КПП', marginX, y);

      // Last page footer
      doc.text(`Сторінка ${pageNum}`, pageWidth / 2, pageHeight - 7, { align: 'center' });

      let pdfFilename = '';
      const formattedStartFile = format(parseISO(startDate), 'ddMMyyyy');
      const formattedEndFile = format(parseISO(endDate), 'ddMMyyyy');
      if (formattedStartFile === formattedEndFile) {
        pdfFilename = `Звіт_КПП_${formattedStartFile}.pdf`;
      } else {
        pdfFilename = `Звіт_КПП_${formattedStartFile}-${formattedEndFile}.pdf`;
      }

      doc.save(pdfFilename);
    } catch (e) {
      console.error(e);
      if (confirm('Помилка при генерації файлу. Відкрити вікно друку / збереження в PDF браузера?')) {
        window.print();
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-12 font-roboto font-normal">
      {/* Summary Metrics & Save Row - polished dashboard flow */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full no-print">
        <div className="bg-primary/10 rounded-xl py-2 sm:py-2.5 px-3 sm:px-[14px] flex items-center justify-between shadow-sm hover:shadow-md transition-all h-[52px] sm:h-[60px]">
          <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 opacity-0 select-none pointer-events-none" />
          <div className="flex items-center justify-center gap-2 flex-1 text-center font-roboto">
            <span className="text-xs sm:text-sm text-primary font-bold uppercase tracking-wider">Відвідувань:</span>
            <span className="text-xs sm:text-sm font-bold text-primary">{totalVisits}</span>
          </div>
          <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-normal shadow-lg shadow-primary/20">
             <ArrowRightCircle className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
        </div>

        <div className="bg-emerald-500/10 rounded-xl py-2 sm:py-2.5 px-3 sm:px-[14px] flex items-center justify-between shadow-sm hover:shadow-md transition-all h-[52px] sm:h-[60px]">
          <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 opacity-0 select-none pointer-events-none" />
          <div className="flex items-center justify-center gap-2 flex-1 text-center font-roboto">
            <span className="text-xs sm:text-sm text-emerald-600 font-bold uppercase tracking-wider">Відвідувачів:</span>
            <span className="text-xs sm:text-sm font-bold text-emerald-700">{uniqueVisitors}</span>
          </div>
          <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-normal shadow-lg shadow-emerald-500/20">
             <Users className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
        </div>

        {/* Polished Save & Export Card */}
        <div className="bg-card border border-border/50 rounded-xl py-1.5 px-3 sm:px-[14px] flex flex-row items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all h-[52px] sm:h-[60px]">
          <div className="flex flex-col justify-center font-roboto">
            <span className="text-xs sm:text-sm text-foreground font-bold uppercase tracking-wider leading-tight">Експорт звіту</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 lowercase">за обраний період</span>
          </div>
          <div className="flex shrink-0 items-center justify-center gap-1.5 sm:gap-2">
            <button 
              onClick={() => setShowPdfPreview(true)}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center gap-1.5 font-bold text-[10px] sm:text-xs uppercase cursor-pointer select-none active:scale-95 transition-all shadow-md shadow-red-600/20"
              title="Експорт та друк у форматі PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button 
              onClick={() => {
                setShowPdfPreview(true);
                setTimeout(() => window.print(), 250);
              }}
              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-secondary hover:bg-muted text-foreground border border-border/60 rounded-xl flex items-center justify-center gap-1.5 font-bold text-[10px] sm:text-xs uppercase cursor-pointer select-none active:scale-95 transition-all"
              title="Швидкий друк офіційного звіту"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Друк</span>
            </button>
            <button 
              onClick={downloadCSV}
              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-1.5 font-bold text-[10px] sm:text-xs uppercase cursor-pointer select-none active:scale-95 transition-all shadow-md shadow-emerald-500/10"
              title="Експорт таблиці в CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 no-print">
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

        {securityShifts && securityShifts.length > 0 && (
          <div className="flex items-center gap-2 bg-card rounded-2xl px-3 py-2 shadow-sm border border-border/50 text-xs">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground uppercase font-bold tracking-wider text-[10px]">Зміна:</span>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="bg-transparent border-none outline-none font-semibold text-foreground text-xs cursor-pointer focus:ring-0"
            >
              {securityShifts.map((s, idx) => (
                <option key={s.id || `shift-opt-${idx}`} value={s.id} className="bg-card text-foreground">
                  {s.name} {s.status === 'active' ? '(чергує)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Print-Only Professional Document Layout (Rendered on A4 landscape/portrait printer output) */}
      <div className="hidden print:block">
        <PrintableReportDocument
          startDate={startDate}
          endDate={endDate}
          reportRows={sortedReportRows}
          totalVisits={totalVisits}
          uniqueVisitors={uniqueVisitors}
          dirtySkyCount={dirtySkyVisits.length}
          currentlyOnSiteCount={currentlyOnSiteCount}
          selectedShift={selectedShift}
          selectedShiftComposition={selectedShiftComposition}
          orientation={pdfOrientation}
        />
      </div>

      {/* Main Content Area */}
      <div className="bg-card rounded-3xl overflow-hidden shadow-sm no-print">
        <div className="p-3">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-4 no-print">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Пошук за іменем чи позивним..."
                    className="w-full pl-10 pr-4 py-2 border border-transparent rounded-xl bg-muted/20 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-normal text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select 
                    className="px-4 py-2 border border-transparent rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/20 font-normal text-sm appearance-none cursor-pointer hover:bg-muted transition-colors min-w-[140px]"
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                  >
                    <option key="default-all-groups" value="all">Всі групи</option>
                    {(groups || []).map((g, idx) => (
                      <option key={g.id ? `report-grp-${g.id}` : `report-grp-idx-${idx}`} value={g.name}>{g.name}</option>
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

                      if (row.type === 'dutyEvent') {
                        const e = row.event;
                        const isStart = e.type === 'start';
                        const timeStr = format(parseISO(e.timestamp), 'HH:mm');
                        return (
                          <div 
                            key={`duty-${e.id}-${idx}`} 
                            className={`reports-table-grid grid grid-cols-1 md:grid-cols-[90px_1fr_130px_180px_60px_70px] md:items-center transition-colors p-2 md:p-0 ${
                              isStart ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'bg-rose-500/5 hover:bg-rose-500/10'
                            }`}
                          >
                            <div className="px-0 md:px-2 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center md:justify-center md:text-center mb-2 md:mb-0 h-full font-mono">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Дата</span>
                              {dateStr}
                            </div>
                            <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border mb-3 md:mb-0 h-full flex flex-col justify-center">
                              <div className="md:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1 no-print">Подія чергування</div>
                              <div className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 text-muted-foreground">
                                <Shield className={`w-3 h-3 ${isStart ? 'text-emerald-500' : 'text-rose-500'}`} />
                                <span>Чергова служба • Охорона</span>
                              </div>
                              <div className="text-sm font-semibold text-foreground">
                                Чергова зміна: {e.shiftName}
                              </div>
                              <div className={`text-[11px] font-medium ${isStart ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {isStart ? `Заступила на чергування о ${timeStr}` : `Закінчила чергування о ${timeStr}`}
                              </div>
                            </div>
                            <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center mb-2 md:mb-0 truncate whitespace-nowrap h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Звідки</span>
                              КПП
                            </div>
                            <div className="px-0 md:px-3 md:py-2 md:border-r md:border-border text-xs flex justify-between md:flex md:items-center mb-2 md:mb-0 truncate whitespace-nowrap h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Група</span>
                              Рота охорони
                            </div>
                            <div className="px-0 md:px-2 md:py-2 md:border-r md:border-border text-xs tabular-nums text-emerald-600 font-bold flex justify-between md:flex md:items-center md:justify-center mb-2 md:mb-0 md:text-center h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Вхід</span>
                              {isStart ? timeStr : '—'}
                            </div>
                            <div className="px-0 md:px-2 md:py-2 text-xs tabular-nums text-rose-600 font-bold flex justify-between md:flex md:items-center md:justify-center h-full">
                              <span className="md:hidden font-bold uppercase text-[9px] text-muted-foreground no-print">Вихід</span>
                              <span className="md:w-full md:text-center md:block">{!isStart ? timeStr : '—'}</span>
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

      {/* PDF Export & Printable Document Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col no-print animate-in fade-in duration-200">
          {/* Modal Header Toolbar */}
          <div className="bg-neutral-900 border-b border-neutral-800 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold tracking-wide flex items-center gap-2">
                  <span>Експорт та друк звіту</span>
                  <span className="text-[10px] bg-red-600/30 text-red-300 font-semibold px-2 py-0.5 rounded-full border border-red-500/30 uppercase">PDF A4</span>
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Офіційний бланк зведеного обліку КПП з електронним реєстром та блоком підписів
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Shift selection */}
              {securityShifts && securityShifts.length > 0 && (
                <div className="flex items-center gap-1.5 bg-neutral-800 px-2.5 py-1.5 rounded-xl border border-neutral-700 text-xs">
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">Зміна:</span>
                  <select
                    value={selectedShiftId}
                    onChange={(e) => setSelectedShiftId(e.target.value)}
                    className="bg-transparent text-white border-none outline-none text-xs cursor-pointer font-medium focus:ring-0"
                  >
                    {securityShifts.map((s, idx) => (
                      <option key={`modal-shift-${s.id || idx}`} value={s.id} className="bg-neutral-900 text-white">
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Orientation toggle */}
              <div className="flex items-center bg-neutral-800 p-0.5 rounded-xl border border-neutral-700 text-xs">
                <button
                  type="button"
                  onClick={() => setPdfOrientation('portrait')}
                  className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                    pdfOrientation === 'portrait' ? 'bg-neutral-700 text-white shadow-sm font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Книжкова
                </button>
                <button
                  type="button"
                  onClick={() => setPdfOrientation('landscape')}
                  className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                    pdfOrientation === 'landscape' ? 'bg-neutral-700 text-white shadow-sm font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Альбомна
                </button>
              </div>

              {/* Print / Save to PDF */}
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Відкрити системне вікно друку або збереження в PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Зберегти як PDF / Друк</span>
              </button>

              {/* Direct PDF Download button */}
              <button
                type="button"
                onClick={generatePDF}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Завантажити готовий PDF-файл на пристрій"
              >
                <FileDown className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'Формування...' : 'Завантажити .PDF'}</span>
              </button>

              {/* Close Modal button */}
              <button
                type="button"
                onClick={() => setShowPdfPreview(false)}
                className="w-8 h-8 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
                title="Закрити вікно перегляду"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-neutral-950/80">
            <div className="my-auto shadow-2xl rounded bg-white">
              <PrintableReportDocument
                startDate={startDate}
                endDate={endDate}
                reportRows={sortedReportRows}
                totalVisits={totalVisits}
                uniqueVisitors={uniqueVisitors}
                dirtySkyCount={dirtySkyVisits.length}
                currentlyOnSiteCount={currentlyOnSiteCount}
                selectedShift={selectedShift}
                selectedShiftComposition={selectedShiftComposition}
                orientation={pdfOrientation}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
