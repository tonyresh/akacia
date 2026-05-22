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



  // We need an effect or ref to access the latest search state inside recognition callback
  const latestSearch = useRef(search);
  useEffect(() => {
    latestSearch.current = search;
  }, [search]);

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

      const isPlus = /(?:\+|^|плюс|заш|зайш|ввійш|увійш|прийш|заход|зайди|заходь|плюсани|додай|став|постав|вошел|увійшов|зайшов)[а-яіїєґ]*\b/i.test(text);
      const isMinus = /(?:-|^|мінус|минус|выш|вийш|піш|виход|вийди|виходь|мінусани|відніми|заверш|ушел|вийшов|зовні|випиши)[а-яіїєґ]*\b/i.test(text);

      let searchName = text
        .replace(/(?:\+|-|плюс|минус|мінус|зашел|зашла|зайшов|зайшла|ввійшов|ввійшла|увійшов|увійшла|прийшов|прийшла|зайшли|прийшли|вышел|вышла|вийшов|вийшла|пішов|пішла|вийшли|пішли|заш|зайш|ввійш|увійш|прийш|выш|вийш|піш|заход|виход|зайди|заходь|плюсани|додай|вийди|виходь|мінусани|відніми|став|постав|заверш|ушел|зовні|випиши)[а-яіїєґ/]*\b/gi, '')
        .replace(/[.,!?]/g, '')
        .trim();

      if (searchName) {
        setSearch(searchName);
      }

      if (event.results[event.results.length - 1].isFinal && (isPlus || isMinus)) {
        const finalSearchName = searchName || latestSearch.current;
        executeCommand(finalSearchName, isPlus ? 'in' : 'out');
        setTimeout(() => {
          setSearch('');
          setShowOnlyIn(true);
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

  const markIn = (id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];
    const now = new Date().toISOString();
    
    if (ids.length === 1) {
      const v = visitors.find(vis => vis.id === ids[0]);
      if (v && v.status !== 'in') {
        showToast(`${v.name}: ЗАЙШОВ`, 'success');
      }
    }

    setVisitors(prev => prev.map(v => {
      if (!ids.includes(v.id)) return v;
      if (v.status === 'in') return v;
      
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      if (logs.length === 0 || logs[logs.length - 1].out) {
        logs.push({ in: now });
      }
      
      return { ...v, status: 'in', lastEntry: now, logs };
    }));
    setSearch('');
  };

  const markOut = (id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];
    const now = new Date().toISOString();
    
    if (ids.length === 1) {
      const v = visitors.find(vis => vis.id === ids[0]);
      if (v && (v.status === 'in' || v.lastEntry)) {
        showToast(`${v.name}: ВИЙШОВ`, 'info');
      }
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
    setSearch('');
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-card rounded-2xl p-2 sm:p-3 shadow-sm overflow-hidden border-none font-roboto font-normal">
        <div className="flex items-center justify-center gap-1.5 sm:gap-3 w-full">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground/60" />
            <input 
              type="text"
              placeholder="Швидкий пошук відвідувачів..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 sm:pl-11 pr-4 py-2 bg-muted/40 border border-border/80 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
          <button
             onClick={toggleListening}
             className={`w-8 h-8 sm:w-10 sm:h-10 border rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer ${isListening ? 'bg-red-500 text-white border-transparent shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground'}`}
             title="Голосовий пошук"
          >
            {isListening ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
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
            const visitorLocation = locations.find(l => l.id === v.locationId) || locations.find(l => l.name === v.location);
            const customIcon = customIcons.find(icon => icon.id === v.customIconId) || (visitorLocation?.iconId ? customIcons.find(icon => icon.id === visitorLocation.iconId) : null);
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
                
                <div className="py-1.5 px-2.5 pl-3.5 flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-2.5 items-center min-w-0">
                      <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white overflow-hidden ${customIcon ? '' : 'shadow-sm'}`} style={{ backgroundColor: customIcon ? 'transparent' : (v.isSpecial ? '#fbbf24' : (v.color || visitorGroup?.color || '#5b6984')) }}>
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
                  </div>

                  <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground mt-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-foreground text-[9px] uppercase tracking-wider opacity-60 shrink-0">Звідки:</span>
                      <span className="break-words">{v.location || v.locationId || v.group}</span>
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
                          onClick={() => !activeDirtySky && markIn(v.id)}
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
                            onClick={() => !isOutDisabled && markOut(v.id)}
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
