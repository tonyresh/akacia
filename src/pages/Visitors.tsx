import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../store/DataContext';
import { useTheme } from '../store/ThemeContext';
import { Search, LogIn, LogOut, Download, Mic, MicOff, Star, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../store/ToastContext';
import { differenceInMinutes } from 'date-fns';
import { formatNameAbbreviated, splitNameTwoLines } from '../utils/nameUtils';

export default function Visitors() {
  const { visitors, setVisitors, categories, groups, locations, shifts, customIcons, dirtySkyEvents } = useData();
  const { visitorsColumns } = useTheme();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const activeDirtySky = dirtySkyEvents.find(e => !e.endTime);

  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [showOnlyIn, setShowOnlyIn] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [groups]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

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
    
    setVisitors(prev => {
        const matching = prev.filter(v => matchesSearch(v.name, v.callsign, nameQuery));
        if (matching.length === 0) return prev;
        
        const v = matching[0];
        const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
        
        if (action === 'in') {
          if (v.status !== 'in') {
            const now = new Date().toISOString();
            if (logs.length === 0 || logs[logs.length - 1].out) {
              logs.push({ in: now });
            }
            return prev.map(visitor => visitor.id === v.id ? { ...visitor, status: 'in' as const, lastEntry: now, logs } : visitor);
          }
        } else if (action === 'out') {
          const isGuard = v.groupId === '3' || (v.location || v.locationId || v.group || '').toLowerCase().includes('охорон') || (v.location || v.locationId || v.group || '').toLowerCase().includes('рота');
          const isGuardOnDuty = isGuard && shifts.some(s => s.guardId === v.id && !s.endTime);
          
          if (isGuardOnDuty) return prev;

          if (v.status === 'in') {
            const now = new Date().toISOString();
            let index = -1;
            for (let i = logs.length - 1; i >= 0; i--) {
              if (logs[i] && logs[i].in && !logs[i].out) { index = i; break; }
            }
            
            if (index !== -1) {
                logs[index] = { ...logs[index], out: now };
                const startTime = logs[index].in;
                const diff = startTime ? differenceInMinutes(new Date(now), new Date(startTime)) : 0;
                return prev.map(visitor => visitor.id === v.id ? { 
                    ...visitor, 
                    status: 'out' as const, 
                    lastEntry: undefined,
                    logs,
                    totalTimeMinutes: (visitor.totalTimeMinutes || 0) + Math.max(0, diff)
                } : visitor);
            } else {
                const fallbackIn = v.lastEntry || now;
                logs.push({ in: fallbackIn, out: now });
                const diff = differenceInMinutes(new Date(now), new Date(fallbackIn));
                return prev.map(visitor => visitor.id === v.id ? { 
                  ...visitor, 
                  status: 'out' as const, 
                  lastEntry: undefined,
                  logs,
                  totalTimeMinutes: (visitor.totalTimeMinutes || 0) + Math.max(0, diff)
                } : visitor);
            }
          }
        }
        return prev;
    });
  };



  // We need an effect or ref to access the latest search state inside recognition callback
  const latestSearch = useRef(search);
  useEffect(() => {
    latestSearch.current = search;
  }, [search]);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Ваш браузер не підтримує розпізнавання мови");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'uk-UA'; 
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => { 
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert("Помилка: Надайте дозвіл на використання мікрофону у браузері.");
      }
    };
    recognition.onresult = (event: any) => {
      const resultIndex = event.results.length - 1;
      const transcript = event.results[resultIndex][0].transcript.toLowerCase();
      
      let text = transcript.trim();
      const isPlus = /(плюс|заш|зайш|ввійш|увійш|прийш)/i.test(text);
      const isMinus = /(минус|мінус|выш|вийш|піш)/i.test(text);

      let searchName = text
        .replace(/(плюс|минус|мінус|зашел|зашла|зайшов|зайшла|ввійшов|ввійшла|увійшов|увійшла|прийшов|прийшла|зайшли|прийшли|вышел|вышла|вийшов|вийшла|пішов|пішла|вийшли|пішли|заш|зайш|ввійш|увійш|прийш|выш|вийш|піш)[а-яіїєґ]*/gi, '')
        .replace(/[.,!?]/g, '')
        .trim();

      if (searchName) {
        setSearch(searchName);
      } else {
        searchName = latestSearch.current;
      }

      if (isPlus || isMinus) {
        executeCommand(searchName, isPlus ? 'in' : 'out');
        setTimeout(() => {
          setSearch('');
          setShowOnlyIn(true);
        }, 1000);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const filtered = visitors
    .filter(v => matchesSearch(v.name, v.callsign, search))
    .filter(v => activeGroup === 'all' || v.groupId === activeGroup || v.group === activeGroup)
    .filter(v => showOnlyIn ? v.status === 'in' : true)
    .sort((a, b) => {
      const specialA = a.isSpecial ? 1 : 0;
      const specialB = b.isSpecial ? 1 : 0;
      if (specialA !== specialB) return specialB - specialA;
      
      if (a.status === 'in' && b.status !== 'in') return -1;
      if (a.status !== 'in' && b.status === 'in') return 1;
      return a.name.localeCompare(b.name);
    });

  const markIn = (id: string, index: number) => {
    const v = visitors.find(vis => vis.id === id);
    if (v) {
      showToast(`${v.name}: ЗАЙШОВ`, 'success');
    }

    setVisitors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const now = new Date().toISOString();
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      logs[index] = { in: now };
      return { ...v, status: 'in', lastEntry: now, logs };
    }));
    setSearch('');
  };

  const markOut = (id: string, index: number) => {
    const v = visitors.find(vis => vis.id === id);
    if (v) {
      showToast(`${v.name}: ВИЙШОВ`, 'info');
    }

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
    setSearch('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-card rounded-2xl p-2 sm:p-3 shadow-sm overflow-hidden border-none">
        <div className="flex items-center justify-between gap-1 sm:gap-4 w-full flex-nowrap">
          <div className="flex items-center gap-1.5 sm:gap-6 shrink-0 min-w-0">
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Star className="w-3 h-3 sm:w-5 sm:h-5 fill-primary/20" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[6px] sm:text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 leading-none mb-0.5 whitespace-nowrap">Чергова зміна</span>
                <h1 className="text-[9px] sm:text-sm font-bold tracking-tight text-foreground truncate">
                  {currentTime.toLocaleDateString()}
                </h1>
              </div>
            </div>
            
            <div className="h-4 sm:h-8 w-px bg-border shrink-0" />
            
            <div className="text-base sm:text-3xl font-black tracking-tighter text-foreground tabular-nums flex items-baseline gap-0.5 shrink-0">
              {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false}).replace(/:\d\d$/, '')}
              <span className="text-[8px] sm:text-lg opacity-50 ml-0.5">{currentTime.toLocaleTimeString([], {second:'2-digit', hour12: false}).split(':')[0]}</span>
            </div>
          </div>

          <div className="flex gap-1 sm:gap-2 flex-1 min-w-0 items-center justify-end ml-1">
            <div className="relative flex-1 max-w-[120px] sm:max-w-md">
              <Search className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 sm:w-4 sm:h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Пошук..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-5 sm:pl-9 pr-1 sm:pr-4 py-1 sm:py-2 bg-muted/30 border border-border rounded-lg sm:rounded-xl text-[9px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
            <button
               onClick={toggleListening}
               className={`w-6 h-6 sm:w-10 sm:h-10 border rounded-lg sm:rounded-xl transition-all flex items-center justify-center shrink-0 ${isListening ? 'bg-red-500 text-white border-transparent shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground'}`}
               title="Голосовий пошук"
            >
              {isListening ? <Mic className="w-3 h-3 sm:w-5 sm:h-5" /> : <MicOff className="w-3 h-3 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col relative">
        <div className="flex items-center gap-2 mb-6 group/nav relative">
          {showLeftArrow && (
            <button 
              onClick={() => scroll('left')}
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div 
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex gap-2 w-full overflow-x-auto pb-2 hide-scrollbar scroll-smooth"
          >
            <button
               onClick={() => setShowOnlyIn(!showOnlyIn)}
               className={`h-10 px-4 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border shrink-0 flex items-center justify-center gap-2 ${
                 showOnlyIn
                   ? 'bg-emerald-600 text-white border-transparent shadow-lg shadow-emerald-600/20 active:scale-95'
                   : 'bg-card hover:bg-muted border-border text-muted-foreground'
               }`}
             >
               <div className={`w-2 h-2 rounded-full ${showOnlyIn ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
               На локації
             </button>
            <div className="w-px h-6 bg-border/60 mx-1 shrink-0 self-center" />
            {[{ id: 'all', name: 'Всі', color: '' }, ...groups].map(g => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`h-10 px-4 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border shrink-0 ${
                  activeGroup === g.id 
                    ? 'bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/20 scale-[1.02]' 
                    : 'bg-card hover:bg-muted border-border text-muted-foreground'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {showRightArrow && (
            <button 
              onClick={() => scroll('right')}
              className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <style>{`
          @media (min-width: 1024px) {
            .visitors-grid {
              grid-template-columns: repeat(${visitorsColumns}, minmax(0, 1fr)) !important;
            }
          }
        `}</style>
        
        <div className="visitors-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground border border-border rounded-2xl bg-muted/20">
              Немає даних для відображення
            </div>
          )}
          {filtered.map((v, index) => {
            const visitorGroup = groups.find(g => g.id === v.groupId) || groups.find(g => g.name === v.group);
            const customIcon = customIcons.find(icon => icon.id === v.customIconId);
            const bgColor = v.color || visitorGroup?.color || 'transparent';
            const hasGroupColor = bgColor !== 'transparent';
            
            const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
            
            const cardStyles = hasGroupColor ? {
              backgroundColor: bgColor.startsWith('#') ? `${bgColor}15` : bgColor,
              borderColor: bgColor.startsWith('#') ? `${bgColor}40` : bgColor,
            } : {};
            
            const shiftStart = new Date(currentTime);
            if (shiftStart.getHours() < 8) {
              shiftStart.setDate(shiftStart.getDate() - 1);
            }
            shiftStart.setHours(8, 0, 0, 0);

            const shiftLogs = (v.logs || []).filter(log => new Date(log.in!) >= shiftStart);
            if (v.lastEntry && new Date(v.lastEntry) >= shiftStart && !shiftLogs.some(l => l.in === v.lastEntry)) {
               // This shouldn't normally happen if logs are synced, but as a safety check
            }
            
            const displayLogs = shiftLogs.length > 0 ? shiftLogs : (v.status === 'in' && v.lastEntry && new Date(v.lastEntry) >= shiftStart ? [{ in: v.lastEntry }] : []);
            
            return (
              <div 
                key={v.id} 
                className={`flex flex-col relative rounded-xl h-full overflow-hidden shadow-sm hover:shadow transition-all ${hasGroupColor ? 'opacity-100 ring-1 ring-inset ring-white/10' : 'bg-card'}`}
                style={cardStyles}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: hasGroupColor ? bgColor : 'var(--border)' }}
                />
                
                <div className="p-2.5 pl-3.5 flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-2.5 items-center min-w-0">
                      <div className={`w-9 h-9 rounded-full border-2 border-background shrink-0 flex items-center justify-center text-white overflow-hidden ${customIcon ? '' : 'shadow-sm'}`} style={{ backgroundColor: customIcon ? 'transparent' : (v.isSpecial ? '#fbbf24' : (v.color || visitorGroup?.color || '#5b6984')) }}>
                        {customIcon ? (
                          <img src={customIcon.data} alt="icon" className="w-full h-full object-cover" />
                        ) : (v.isSpecial ? (
                          <Star className="w-5 h-5 text-white fill-white" />
                        ) : (
                          <User className="w-4 h-4 text-[#e5e9ec]" />
                        ))}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                          {v.category}
                        </span>
                        <h3 className="font-bold text-foreground leading-tight text-[13px] flex flex-col uppercase tracking-tight min-w-0" style={{ fontFamily: 'Roboto, sans-serif' }}>
                          {(() => {
                            const { first, second } = splitNameTwoLines(v.name);
                            return (
                              <>
                                <span className="truncate block w-full">{first}</span>
                                <span className="truncate block w-full opacity-100">{second}</span>
                              </>
                            );
                          })()}
                        </h3>
                        {v.callsign && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-primary/80 leading-none mt-1 truncate">
                            {v.callsign}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[9px] font-mono font-bold text-muted-foreground bg-muted/50 border border-border px-1.5 py-0.5 rounded-md shrink-0">
                      #{index + 1}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground mt-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-foreground text-[9px] uppercase tracking-wider opacity-60 shrink-0">Звідки:</span>
                      <span className="break-words">{v.location || v.locationId || v.group}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-foreground text-[9px] uppercase tracking-wider opacity-60 shrink-0">Група:</span>
                      <span className="break-words px-1 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: hasGroupColor ? `${bgColor}15` : 'var(--muted)', color: hasGroupColor ? bgColor : 'inherit' }}>
                        {visitorGroup?.name || v.group}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-2 border-t border-border/50 flex flex-col gap-1.5">
                    {displayLogs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <div className="flex items-center text-[11px] sm:text-xs font-mono font-bold bg-muted/50 border border-border/50 rounded px-2 py-1 w-full justify-between">
                          <span className="text-emerald-600" title="Перший захід (в цій зміні)">
                            {displayLogs[0].in ? new Date(displayLogs[0].in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : '--:--'}
                          </span>
                          <span className="text-muted-foreground/30">➜</span>
                          <span className="text-red-500" title="Останній вихід (в цій зміні)">
                            {displayLogs[displayLogs.length - 1].out 
                              ? new Date(displayLogs[displayLogs.length - 1].out!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) 
                              : (v.status === 'in' ? 'на локації' : '--:--')}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-1.5 w-full">
                      {v.status !== 'in' && (
                        <button
                          onClick={() => !activeDirtySky && markIn(v.id, logs.length)}
                          disabled={!!activeDirtySky}
                          title={activeDirtySky ? "Вхід заблоковано режимом Брудне небо" : undefined}
                          className={`flex-1 flex justify-center items-center gap-1 px-1.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                            activeDirtySky
                              ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed'
                              : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30'
                          }`}
                        >
                          <LogIn className="w-3 h-3" />
                          Зайшов
                        </button>
                      )}
                      {v.status === 'in' && (() => {
                        const isGuard = v.groupId === '3' || (v.location || v.locationId || v.group || '').toLowerCase().includes('охорон') || (v.location || v.locationId || v.group || '').toLowerCase().includes('рота');
                        const isGuardOnDuty = isGuard && shifts.some(s => s.guardId === v.id && !s.endTime);
                        const isOutDisabled = isGuardOnDuty || !!activeDirtySky;
                        return (
                          <button
                            onClick={() => !isOutDisabled && markOut(v.id, logs.length - 1)}
                            disabled={isOutDisabled}
                            title={isGuardOnDuty ? "Не можна вийти до передачі зміни" : activeDirtySky ? "Вихід заблоковано режимом Брудне небо" : undefined}
                            className={`flex-1 flex justify-center items-center gap-1 px-1.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                              isOutDisabled 
                                ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed'
                                : 'border-red-500/30 text-red-600 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30'
                            }`}
                          >
                            <LogOut className="w-3 h-3" />
                            Вийшов
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
