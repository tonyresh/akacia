import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../store/DataContext';
import { useToast } from '../store/ToastContext';
import { Users, User, Clock, ArrowRightCircle, X, Search, Mic, MicOff, LogIn, LogOut, Play, Square, CloudRain, TriangleAlert, Star } from 'lucide-react';
import { differenceInMinutes, format } from 'date-fns';
import { formatNameAbbreviated } from '../utils/nameUtils';

export default function Dashboard() {
  const { 
    visitors, setVisitors, groups, categories, shifts, securityShifts,
    dirtySkyEvents, startDirtySky, endDirtySky, customIcons, locations
  } = useData();
  const { showToast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [modalType, setModalType] = useState<'entered' | 'exited' | 'on_location' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const normalizeForSearch = (str: string) => {
    return str.toLowerCase()
      .replace(/['`’ʼ.,!?]/g, '')
      .replace(/[иіїыi]/g, 'i')
      .replace(/[еєэe]/g, 'e')
      .replace(/[гґg]/g, 'g')
      .replace(/[аa]/g, 'a')
      .replace(/[оo]/g, 'o')
      .replace(/[рp]/g, 'p')
      .replace(/[сc]/g, 'c')
      .replace(/[хx]/g, 'x')
      .replace(/[уy]/g, 'y');
  };

  const matchesSearch = (name: string, callsign: string | undefined, searchStr: string) => {
    const normName = normalizeForSearch(name);
    const normCallsign = callsign ? normalizeForSearch(callsign) : '';
    const searchWords = normalizeForSearch(searchStr).split(/\s+/).filter(w => w.length > 0);
    if (searchWords.length === 0) return true;
    return searchWords.every(word => normName.includes(word) || normCallsign.includes(word));
  };

  const executeCommand = (nameQuery: string, action: 'in' | 'out') => {
    if (!nameQuery || !!activeDirtySky) return;
    
    const matching = visitors.filter(v => matchesSearch(v.name, v.callsign, nameQuery));
    if (matching.length === 0) {
      showToast(`Користувача "${nameQuery}" не знайдено`, 'info');
      return;
    }
    
    const v = matching[0];
    if (action === 'in') {
      markIn(v.id);
    } else {
      markOut(v.id);
    }
  };

  const markIn = (id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];
    const now = new Date().toISOString();
    
    // Find visitors to show toast for
    if (ids.length === 1) {
      const v = visitors.find(vis => vis.id === ids[0]);
      if (v && v.status !== 'in') {
        showToast(`${v.name}: ЗАЙШОВ`, 'success');
      }
    } else if (ids.length > 1) {
      showToast(`Успішно зайшло: ${ids.length} осіб`, 'success');
    }

    setVisitors(prev => prev.map(v => {
      if (!ids.includes(v.id)) return v;
      if (v.status === 'in') return v;
      
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      // Push new entry if last one is complete
      if (logs.length === 0 || logs[logs.length - 1].out) {
        logs.push({ in: now });
      }
      
      return { ...v, status: 'in', lastEntry: now, logs };
    }));
  };

  const markOut = (id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];
    const now = new Date().toISOString();
    
    // Find visitors to show toast for
    if (ids.length === 1) {
      const v = visitors.find(vis => vis.id === ids[0]);
      if (v && (v.status === 'in' || v.lastEntry)) {
        showToast(`${v.name}: ВИЙШОВ`, 'info');
      }
    } else if (ids.length > 1) {
      showToast(`Успішно вийшло: ${ids.length} осіб`, 'info');
    }

    setVisitors(prev => prev.map(v => {
      if (!ids.includes(v.id)) return v;
      
      const isGuard = v.groupId === '3' || (v.location || v.locationId || v.group || '').toLowerCase().includes('охорон') || (v.location || v.locationId || v.group || '').toLowerCase().includes('рота');
      const isGuardOnDuty = isGuard && shifts.some(s => s.guardId === v.id && !s.endTime);
      if (isGuardOnDuty) {
        showToast(`Не можна вийти: ${v.name} заступив на чергування`, 'error');
        return v;
      }

      if (v.status === 'out' && !v.lastEntry) return v;

      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      
      let index = -1;
      for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].in && !logs[i].out) {
          index = i;
          break;
        }
      }

      if (index !== -1) {
          logs[index] = { ...logs[index], out: now };
          const startTime = logs[index].in;
          const diff = startTime ? differenceInMinutes(new Date(now), new Date(startTime)) : 0;
          return { 
            ...v, 
            status: 'out', 
            lastEntry: undefined,
            logs,
            totalTimeMinutes: (v.totalTimeMinutes || 0) + Math.max(0, diff) 
          };
      } else {
          const fallbackIn = v.lastEntry || now;
          logs.push({ in: fallbackIn, out: now });
          const diff = differenceInMinutes(new Date(now), new Date(fallbackIn));
          return {
            ...v,
            status: 'out',
            lastEntry: undefined,
            logs,
            totalTimeMinutes: (v.totalTimeMinutes || 0) + Math.max(0, diff)
          };
      }
    }));
  };
  const latestSearch = useRef(searchQuery);
  useEffect(() => {
    latestSearch.current = searchQuery;
  }, [searchQuery]);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Stop error:', e);
        }
      }
      setIsListening(false);
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Ваш браузер не підтримує розпізнавання мови", 'error');
      return;
    }

    setIsListening(true);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'uk-UA'; 
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log('Speech recognition started');
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Restart error:', e);
          setIsListening(false);
        }
      }
    };

    recognition.onerror = (event: any) => { 
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        showToast("Помилка: Надайте дозвіл на використання мікрофону у браузері.", 'error');
        setIsListening(false);
      } else if (event.error === 'aborted') {
        // Ignore aborted error as it happens on stop()
      } else {
        setIsListening(false);
      }
    };
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

    const text = (finalTranscript + ' ' + interimTranscript).toLowerCase().trim();
    if (!text) return;

    // Detection with word boundaries and common variations
    const isPlus = /(?:\+|^|плюс|заш|зайш|ввійш|увійш|прийш|заход|зайди|заходь|плюсани|додай|став|постав|вошел|увійшов|зайшов)[а-яіїєґ]*\b/i.test(text);
    const isMinus = /(?:-|^|мінус|минус|выш|вийш|піш|виход|вийди|виходь|мінусани|відніми|заверш|ушел|вийшов|зовні|випиши)[а-яіїєґ]*\b/i.test(text);

    let searchName = text
      .replace(/(?:\+|-|плюс|минус|мінус|зашел|зашла|зайшов|зайшла|ввійшов|ввійшла|увійшов|увійшла|прийшов|прийшла|зайшли|прийшли|вышел|вышла|вийшов|вийшла|пішов|пішла|вийшли|пішли|заш|зайш|ввійш|увійш|прийш|выш|вийш|піш|заход|виход|зайди|заходь|плюсани|додай|вийди|виходь|мінусани|відніми|став|постав|заверш|ушел|зовні|випиши)[а-яіїєґ/]*\b/gi, '')
      .replace(/[.,!?]/g, '')
      .trim();

      if (searchName) {
        setSearchQuery(searchName);
      }

      if (event.results[event.results.length - 1].isFinal && (isPlus || isMinus)) {
        const finalSearchName = searchName || latestSearch.current;
        executeCommand(finalSearchName, isPlus ? 'in' : 'out');
        
        setTimeout(() => {
          setSearchQuery('');
        }, 1500);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error('Start error:', err);
      setIsListening(false);
    }
  };

  const commandVisitors = visitors.filter(v => {
    if (searchQuery.trim()) {
      return matchesSearch(v.name, v.callsign, searchQuery);
    }
    const groupName = groups.find(g => g.id === v.groupId)?.name || v.group;
    return groupName === 'Командування полку' || groupName === 'Керівництво' || groupName === 'Командування 412' || groupName === 'Управління';
  }).sort((a, b) => {
    const specialA = a.isSpecial ? 1 : 0;
    const specialB = b.isSpecial ? 1 : 0;
    if (specialA !== specialB) return specialB - specialA;

    const groupOrder: Record<string, number> = {
      'Командування 412': 1,
      'Управління': 2,
      'Керівництво': 3,
      'Командування полку': 4
    };

    const groupNameA = groups.find(g => g.id === a.groupId)?.name || a.group || '';
    const groupNameB = groups.find(g => g.id === b.groupId)?.name || b.group || '';

    const orderA = groupOrder[groupNameA] || 99;
    const orderB = groupOrder[groupNameB] || 99;

    if (orderA !== orderB) return orderA - orderB;
    
    if (a.status === 'in' && b.status !== 'in') return -1;
    if (a.status !== 'in' && b.status === 'in') return 1;
    return a.name.localeCompare(b.name);
  });

  const shiftStart = new Date(currentTime);
  if (shiftStart.getHours() < 8) {
    shiftStart.setDate(shiftStart.getDate() - 1);
  }
  shiftStart.setHours(8, 0, 0, 0);

  const enteredTodayVisitors: any[] = [];
  const exitedTodayVisitors: any[] = [];
  
  visitors.forEach(v => {
    let enteredToday = false;
    let exitedToday = false;
    const logs = v.logs || [];
    
    let enterTime: Date | null = null;
    let exitTime: Date | null = null;
    
    if (v.lastEntry && new Date(v.lastEntry) >= shiftStart) {
      enteredToday = true;
      enterTime = new Date(v.lastEntry);
    }
    for (const log of logs) {
      if (log.in && new Date(log.in) >= shiftStart) {
        enteredToday = true;
        if (!enterTime || new Date(log.in) < enterTime) {
          enterTime = new Date(log.in);
        }
      }
      if (log.out && new Date(log.out) >= shiftStart) {
        exitedToday = true;
        if (!exitTime || new Date(log.out) > exitTime) {
          exitTime = new Date(log.out);
        }
      }
    }
    
    if (enteredToday) enteredTodayVisitors.push({ ...v, shiftEnterTime: enterTime });
    if (exitedToday) exitedTodayVisitors.push({ ...v, shiftExitTime: exitTime });
  });

  const enteredTodayCount = enteredTodayVisitors.length;
  const exitedTodayCount = exitedTodayVisitors.length;

  const currentlyInVisitors = visitors.filter(v => v.status === 'in').sort((a,b) => a.name.localeCompare(b.name));
  const currentlyInCount = currentlyInVisitors.length;

  const modalVisitors = 
    modalType === 'entered' ? enteredTodayVisitors : 
    modalType === 'exited' ? exitedTodayVisitors : 
    currentlyInVisitors;

  const modalTitle = 
    modalType === 'entered' ? "Зайшли за зміну" : 
    modalType === 'exited' ? "Вийшли за зміну" : 
    "Зараз на локації";

  const activeSecurityShift = (securityShifts || []).find(s => 
    s.visitorIds.some(id => shifts.some((session: any) => session.guardId === id && !session.endTime))
  );
  const activeShiftName = activeSecurityShift?.name;

  const activeDirtySky = dirtySkyEvents.find(e => !e.endTime);
  const lastCompletedDirtySky = [...dirtySkyEvents].reverse().find(e => e.endTime);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 md:gap-6 py-4 mb-2 font-roboto font-normal border-b border-border/40 pb-6 w-full min-w-0 flex-nowrap">
        {/* Left column: Notifications like Large active "Dirty sky" + activation time */}
        <div className="flex flex-col items-start justify-center grow shrink min-w-0">
          {activeDirtySky ? (
            <div className="flex flex-col items-start text-red-500 animate-pulse min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <TriangleAlert className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                <span className="text-sm sm:text-base md:text-lg font-bold uppercase tracking-wide leading-none truncate">Брудне небо</span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-red-500/80 mt-1 pl-6">
                з {format(new Date(activeDirtySky.startTime), 'HH:mm')}
              </span>
            </div>
          ) : (
            <div className="text-muted-foreground/30 flex items-center gap-1.5 select-none min-w-0">
              <CloudRain className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest leading-none truncate">Небо чисте</span>
            </div>
          )}
        </div>
        
        {/* Center column: Date and time */}
        <div className="text-center flex flex-col items-center justify-center grow shrink-0 min-w-0">
          <div className="text-lg sm:text-2xl md:text-3xl font-semibold tabular-nums leading-none tracking-tight">
            {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false})}
          </div>
          <div className="text-[9px] sm:text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase mt-1">
            {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Right column: Dirty sky title and ON/OFF status buttons */}
        <div className="flex justify-end items-center grow shrink-0">
          <div className="flex flex-col items-center md:items-end gap-1.5 w-[90px] sm:w-[110px] md:w-[130px]">
            <span className="text-[10px] sm:text-xs md:text-sm font-bold tracking-[0.05em] text-muted-foreground uppercase whitespace-nowrap">
              Брудне небо
            </span>
            <div className="flex items-center gap-1 w-full">
              <button
                onClick={() => {
                  if (!activeDirtySky) {
                    startDirtySky();
                    showToast('РЕЖИМ БРУДНЕ НЕБО АКТИВОВАНО!', 'error');
                  }
                }}
                className={`flex-1 h-8 sm:h-9 md:h-10 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all flex flex-col items-center justify-center shrink-0 ${
                  activeDirtySky 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 scale-[1.03]' 
                    : 'bg-muted text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800'
                }`}
                title="Увімкнути режим Брудне небо"
              >
                <span>ON</span>
              </button>
              
              <button
                onClick={() => {
                  if (activeDirtySky) {
                    endDirtySky();
                    showToast('Режим Брудне небо завершено', 'success');
                  }
                }}
                className={`flex-1 h-8 sm:h-9 md:h-10 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all flex flex-col items-center justify-center shrink-0 ${
                  !activeDirtySky 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-[1.03]' 
                    : 'bg-muted text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800'
                }`}
                title="Вимкнути режим Брудне небо"
              >
                <span>OFF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div 
          onClick={() => setModalType('on_location')}
          className="bg-emerald-500/10 rounded-3xl py-2 sm:py-2.5 px-3 sm:px-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="text-xs sm:text-sm text-emerald-600 font-bold uppercase tracking-wider">На локації:</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-700">{currentlyInCount}</div>
          </div>
          <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-normal shadow-lg shadow-emerald-500/20">
             <Users className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
        </div>

        <div 
          onClick={() => setModalType('entered')}
          className="bg-primary/10 rounded-3xl py-2 sm:py-2.5 px-3 sm:px-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="text-xs sm:text-sm text-primary font-bold uppercase tracking-wider">Зайшло:</div>
            <div className="text-xs sm:text-sm font-bold text-primary">{enteredTodayCount}</div>
          </div>
          <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-normal shadow-lg shadow-primary/20">
             <ArrowRightCircle className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
        </div>

        <div 
          onClick={() => setModalType('exited')}
          className="bg-red-500/10 rounded-3xl py-2 sm:py-2.5 px-3 sm:px-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="text-xs sm:text-sm text-red-500 font-bold uppercase tracking-wider">Вийшло:</div>
            <div className="text-xs sm:text-sm font-bold text-red-600">{exitedTodayCount}</div>
          </div>
          <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 bg-red-500 rounded-xl flex items-center justify-center text-white font-normal shadow-lg shadow-red-500/20">
            <ArrowRightCircle className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rotate-180" />
          </div>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none transition-transform group-focus-within:scale-110">
          <Search className="w-8 h-8 text-primary/60 group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Швидкий пошук за іменем чи позивним..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-18 pr-16 py-6 bg-card border-2 border-primary/20 rounded-3xl text-xl focus:outline-none focus:border-primary focus:ring-8 focus:ring-primary/5 transition-all shadow-xl hover:shadow-2xl placeholder:text-muted-foreground/40 font-normal"
        />
        <button
          onClick={toggleListening}
          className={`absolute inset-y-0 right-3 my-auto h-14 w-14 flex items-center justify-center rounded-[1.5rem] transition-all ${
            isListening 
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 animate-pulse' 
              : 'text-primary/60 hover:bg-primary/10 hover:text-primary'
          }`}
          title={isListening ? "Зупинити голосовий пошук" : "Голосовий пошук та команди"}
        >
          {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>

      <div className="bg-card rounded-3xl p-4 flex flex-col shadow-sm">
        {searchQuery.trim() && (
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-lg font-normal">Результати пошуку</h2>
              <p className="text-xs text-muted-foreground">Знайдені користувачі</p>
            </div>
          </div>
        )}
        
        <div className="space-y-2 pr-2 hide-scrollbar">
          {commandVisitors.length > 0 ? (
            commandVisitors.map(v => {
              const visitorGroup = groups?.find((g: any) => g.id === v.groupId) || groups?.find((g: any) => g.name === v.group);
              const visitorLocation = locations.find(l => l.id === v.locationId) || locations.find(l => l.name === v.location);
              const customIcon = customIcons.find(icon => icon.id === v.customIconId) || (visitorLocation?.iconId ? customIcons.find(icon => icon.id === visitorLocation.iconId) : null);
              const isOnLocation = v.status === 'in';
              const blockColor = v.color || visitorGroup?.color;
              const hasGroupColor = !!blockColor && blockColor !== 'transparent';
              
              const rowStyles = hasGroupColor ? {
                backgroundColor: blockColor.startsWith('#') ? `${blockColor}15` : blockColor,
                borderColor: blockColor.startsWith('#') ? `${blockColor}60` : blockColor,
              } : {};

              return (
                <div 
                  key={v.id} 
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 px-4 rounded-2xl transition-colors ${isOnLocation ? 'opacity-100' : 'opacity-50'} ${hasGroupColor ? (isOnLocation ? 'shadow-md ring-1 ring-inset ring-white/10' : '') : (isOnLocation ? 'bg-muted/20 hover:bg-muted/40' : 'bg-black/5')}`}
                  style={rowStyles}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white overflow-hidden ${customIcon ? '' : 'shadow-sm'}`} style={{ backgroundColor: customIcon ? 'transparent' : (v.isSpecial ? '#fbbf24' : (v.color || visitorGroup?.color || '#5b6984')) }}>
                      {customIcon ? (
                        <img src={customIcon.data} alt="icon" className="w-full h-full object-cover" />
                      ) : v.isSpecial ? (
                        <Star className="w-6 h-6 text-white fill-white" />
                      ) : (
                        <User className="w-5 h-5 text-[#e5e9ec]" />
                      )}
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase font-normal tracking-wider mb-1 opacity-70 break-words leading-tight">
                        {v.category} {v.location || v.locationId || v.group ? `• ${v.location || v.locationId || v.group}` : ''}
                      </div>
                      <div className="font-normal text-sm">{formatNameAbbreviated(v.name)}</div>
                      {v.callsign && (
                        <div className="text-[11px] font-bold text-primary/80 uppercase tracking-widest leading-none mt-1">
                          {v.callsign}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {isOnLocation ? (
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="text-[10px] sm:text-xs font-normal text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
                          з {v.lastEntry ? new Date(v.lastEntry).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : ''}
                        </div>
                        {(() => {
                          const isGuard = v.groupId === '3' || (v.location || v.locationId || v.group || '').toLowerCase().includes('охорон') || (v.location || v.locationId || v.group || '').toLowerCase().includes('рота');
                          const isGuardOnDuty = isGuard && shifts.some(s => s.guardId === v.id && !s.endTime);
                          const isOutDisabled = isGuardOnDuty || !!activeDirtySky;
                          
                          return (
                            <button
                              onClick={() => !isOutDisabled && markOut(v.id)}
                              disabled={isOutDisabled}
                              title={isGuardOnDuty ? "Не можна вийти до передачі зміни" : activeDirtySky ? "Вихід заблоковано режимом Брудне небо" : undefined}
                              className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-1.5 text-[10px] sm:text-xs font-normal uppercase tracking-widest rounded-xl border transition-colors ${
                                isOutDisabled 
                                  ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed'
                                  : 'border-red-500/30 text-red-600 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30'
                              }`}
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              Вийшов
                            </button>
                          );
                        })()}
                      </div>
                    ) : (
                      <button
                        onClick={() => !activeDirtySky && markIn(v.id)}
                        disabled={!!activeDirtySky}
                        title={activeDirtySky ? "Вхід заблоковано режимом Брудне небо" : undefined}
                        className={`w-full sm:w-auto flex justify-center items-center gap-1.5 px-4 py-1.5 text-[10px] sm:text-xs font-normal uppercase tracking-widest rounded-xl border transition-colors ${
                          activeDirtySky
                            ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed'
                            : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30'
                        }`}
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        Зайшов
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-muted-foreground bg-muted/10 border border-border border-dashed rounded-2xl">
               Користувачів не знайдено
            </div>
          )}
        </div>
      </div>

      {modalType && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm sm:p-4">
          <div className="bg-card w-full sm:w-[480px] h-full sm:h-auto sm:max-h-full sm:rounded-3xl shadow-xl border border-border flex flex-col shrink-0 animate-in slide-in-from-right sm:slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h2 className="text-xl font-bold">{modalTitle}</h2>
              <button 
                onClick={() => setModalType(null)}
                className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors"
                title="Закрити"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {modalVisitors.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border border-border border-dashed rounded-2xl bg-muted/20">
                  Немає даних
                </div>
              ) : (
                modalVisitors.map(v => {
                  const visitorGroup = groups?.find(g => g.id === v.groupId) || groups?.find(g => g.name === v.group);
                  const visitorLocation = locations.find(l => l.id === v.locationId) || locations.find(l => l.name === v.location);
                  const customIcon = customIcons.find(icon => icon.id === v.customIconId) || (visitorLocation?.iconId ? customIcons.find(icon => icon.id === visitorLocation.iconId) : null);
                  const blockColor = v.color || visitorGroup?.color;
                  const hasGroupColor = !!blockColor && blockColor !== 'transparent';
                  
                  const rowStyles = hasGroupColor ? {
                    backgroundColor: blockColor.startsWith('#') ? `${blockColor}15` : blockColor,
                    borderColor: blockColor.startsWith('#') ? `${blockColor}60` : blockColor,
                  } : {};

                  const isOnLocation = v.status === 'in';
                  return (
                    <div 
                      key={v.id} 
                      className={`flex justify-between items-center p-4 rounded-2xl shadow-sm transition-colors ${isOnLocation ? 'opacity-100' : 'opacity-50'} ${hasGroupColor ? '' : 'bg-background'}`}
                      style={rowStyles}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white overflow-hidden ${customIcon ? '' : 'shadow-sm'}`} style={{ backgroundColor: customIcon ? 'transparent' : (v.isSpecial ? '#fbbf24' : (v.color || visitorGroup?.color || '#5b6984')) }}>
                          {customIcon ? (
                            <img src={customIcon.data} alt="icon" className="w-full h-full object-cover" />
                          ) : v.isSpecial ? (
                            <Star className="w-6 h-6 text-white fill-white" />
                          ) : (
                            <User className="w-5 h-5 text-[#e5e9ec]" />
                          )}
                        </div>
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1 opacity-70 break-words leading-tight">
                            {v.category} {v.location || v.locationId || v.group ? `• ${v.location || v.locationId || v.group}` : ''}
                          </div>
                          <div className="font-semibold text-sm">{formatNameAbbreviated(v.name)}</div>
                          {v.callsign && (
                            <div className="text-[11px] font-bold text-primary/80 uppercase tracking-widest leading-none mt-1">
                              {v.callsign}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        {modalType === 'on_location' && v.lastEntry && (
                          <div className="text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg text-xs font-mono font-medium">
                            зайшов о {new Date(v.lastEntry).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                          </div>
                        )}
                        {modalType === 'entered' && v.shiftEnterTime && (
                          <div className="text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg text-xs font-mono font-medium">
                            {new Date(v.shiftEnterTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                          </div>
                        )}
                        {modalType === 'exited' && v.shiftExitTime && (
                          <div className="text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg text-xs font-mono font-medium mt-1">
                            {new Date(v.shiftExitTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
