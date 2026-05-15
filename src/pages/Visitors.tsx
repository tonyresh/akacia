import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../store/DataContext';
import { Search, LogIn, LogOut, Download, Mic, MicOff, Star, User } from 'lucide-react';
import { useToast } from '../store/ToastContext';
import { differenceInMinutes } from 'date-fns';
import { formatNameAbbreviated, splitNameTwoLines } from '../utils/nameUtils';

export default function Visitors() {
  const { visitors, setVisitors, categories, groups, locations, shifts } = useData();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [showOnlyIn, setShowOnlyIn] = useState(false);
  
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
    if (!nameQuery) return;
    
    setVisitors(prev => {
        const matching = prev.filter(v => matchesSearch(v.name, v.callsign, nameQuery));
        if (matching.length === 0) return prev;
        
        const v = matching[0];
        const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
        
        if (action === 'in') {
             let targetIndex = -1;
             for (let i = 0; i < 4; i++) {
                const isNextIn = (v.status === 'out' && logs.filter(l => l.out).length === i) || (logs.length === 0 && i === 0 && (!v.lastEntry || v.status === 'out'));
                if (isNextIn) {
                   targetIndex = i;
                   break;
                }
             }
             if (targetIndex !== -1) {
                 const now = new Date().toISOString();
                 logs[targetIndex] = { in: now };
                 const newVisitors = prev.map(visitor => visitor.id === v.id ? { ...visitor, status: 'in' as const, lastEntry: now, logs } : visitor);
                 return newVisitors;
             }
        } else if (action === 'out') {
             const isGuard = (v.location || v.locationId || v.group || '').toLowerCase().includes('охорон');
             const isGuardOnDuty = isGuard && shifts.some(s => s.guardId === v.id && !s.endTime);
             
             if (isGuardOnDuty) {
               return prev; // Prevent mark out if guard is on duty
             }

             let targetIndex = -1;
             for (let i = 0; i < 4; i++) {
                const log = logs[i];
                const isNextOut = v.status === 'in' && logs.length === i + 1 && !log?.out;
                if (isNextOut) {
                   targetIndex = i;
                   break;
                }
             }
             if (targetIndex !== -1) {
                 const now = new Date().toISOString();
                 logs[targetIndex] = { ...logs[targetIndex], out: now };
                 const diff = logs[targetIndex].in ? differenceInMinutes(new Date(now), new Date(logs[targetIndex].in!)) : 0;
                 return prev.map(visitor => visitor.id === v.id ? { 
                     ...visitor, 
                     status: 'out' as const, 
                     lastEntry: undefined,
                     logs,
                     totalTimeMinutes: (visitor.totalTimeMinutes || 0) + diff 
                 } : visitor);
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
    setVisitors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const now = new Date().toISOString();
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      logs[index] = { in: now };
      showToast(`${v.name}: ЗАЙШОВ`, 'success');
      return { ...v, status: 'in', lastEntry: now, logs };
    }));
    setSearch('');
  };

  const markOut = (id: string, index: number) => {
    setVisitors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const now = new Date().toISOString();
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      if (!logs[index]) return v;
      logs[index] = { ...logs[index], out: now };
      
      const diff = logs[index].in ? differenceInMinutes(new Date(now), new Date(logs[index].in!)) : 0;
      showToast(`${v.name}: ВИЙШОВ`, 'info');
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
      <div className="relative flex flex-col justify-center items-center sm:block py-2 mb-2">
        <h1 className="text-xl font-bold tracking-tight text-muted-foreground sm:absolute sm:left-0 sm:top-1/2 sm:-translate-y-1/2">
          Чергова зміна: {currentTime.toLocaleDateString()}
        </h1>
        <div className="text-4xl font-black tracking-tighter text-foreground tabular-nums text-center mt-2 sm:mt-0">
          {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false})}
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2 w-full sm:w-64 sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Пошук за ім'ям..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
          <button
             onClick={toggleListening}
             className={`p-2 border rounded-full transition-colors flex-shrink-0 ${isListening ? 'bg-red-500 text-white border-transparent shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-background border-border hover:bg-muted text-foreground'}`}
             title="Голосовий пошук та команди (Голосове 'плюс' або 'минус')"
          >
            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-muted-foreground" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex gap-2 w-full flex-wrap pb-2">
            <button
               onClick={() => setShowOnlyIn(!showOnlyIn)}
               className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${
                 showOnlyIn
                   ? 'bg-green-600 text-white border-transparent shadow-md'
                   : 'bg-background hover:bg-muted border-border text-foreground'
               }`}
             >
               Тільки зайшли
             </button>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground border border-border rounded-2xl bg-muted/20">
              Немає даних для відображення
            </div>
          )}
          {filtered.map((v, index) => {
            const visitorGroup = groups.find(g => g.id === v.groupId) || groups.find(g => g.name === v.group);
            const bgColor = v.color || visitorGroup?.color || 'transparent';
            const hasGroupColor = bgColor !== 'transparent';
            
            const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
            
            const cardStyles = hasGroupColor ? {
              backgroundColor: bgColor.startsWith('#') ? `${bgColor}15` : bgColor,
              borderColor: bgColor.startsWith('#') ? `${bgColor}60` : bgColor,
            } : {};
            
            return (
              <div 
                key={v.id} 
                className={`flex flex-col relative border border-border rounded-xl overflow-hidden shadow-sm hover:shadow transition-all ${hasGroupColor ? 'opacity-100 ring-1 ring-inset ring-white/10' : 'bg-card'}`}
                style={cardStyles}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: hasGroupColor ? bgColor : 'var(--border)' }}
                />
                
                <div className="p-3 pl-4 flex-1 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex gap-3 items-center min-w-0">
                      <div className="w-10 h-10 rounded-full border-2 border-background shadow-sm shrink-0 flex items-center justify-center text-white" style={{ backgroundColor: v.isSpecial ? '#fbbf24' : (v.color || visitorGroup?.color || '#5b6984') }}>
                        {v.isSpecial ? (
                          <Star className="w-6 h-6 text-white fill-white" />
                        ) : (
                          <User className="w-5 h-5 text-[#e5e9ec]" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">
                          {v.category}
                        </span>
                        <h3 className="font-bold text-foreground leading-tight text-sm flex flex-col uppercase tracking-tight min-w-0" style={{ fontFamily: 'Roboto, sans-serif' }}>
                          {(() => {
                            const { first, second } = splitNameTwoLines(v.name);
                            return (
                              <>
                                <span className="truncate w-full">{first}</span>
                                <span className="truncate w-full italic text-muted-foreground/80">{second}</span>
                              </>
                            );
                          })()}
                        </h3>
                        {v.callsign && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80 leading-none mt-1">
                            {v.callsign}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/50 border border-border px-1.5 py-0.5 rounded-md">
                      #{index + 1}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground text-[10px] uppercase tracking-wider opacity-70">Звідки:</span>
                      <span className="truncate">{v.location || v.locationId || v.group}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground text-[10px] uppercase tracking-wider opacity-70">Група:</span>
                      <span className="truncate px-1 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: hasGroupColor ? `${bgColor}15` : 'var(--muted)', color: hasGroupColor ? bgColor : 'inherit' }}>
                        {visitorGroup?.name || v.group}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-2 border-t border-border flex flex-col gap-2">
                    {logs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <div className="flex items-center text-[10px] font-mono font-medium bg-muted/50 border border-border rounded px-1.5 py-0.5">
                          <span className="text-emerald-600" title="Перший захід">
                            {logs[0].in ? new Date(logs[0].in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : '--:--'}
                          </span>
                          <span className="mx-1.5 text-muted-foreground/30">➜</span>
                          <span className="text-red-500" title="Останній вихід">
                            {logs[logs.length - 1].out 
                              ? new Date(logs[logs.length - 1].out!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) 
                              : (v.status === 'in' ? 'на посту' : '--:--')}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2 w-full mt-1">
                      {v.status !== 'in' && logs.length < 4 && (
                        <button
                          onClick={() => markIn(v.id, logs.length)}
                          className="flex-1 flex justify-center items-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 transition-colors"
                        >
                          <LogIn className="w-3 h-3" />
                          Зайшов
                        </button>
                      )}
                      {v.status === 'in' && (() => {
                        const isGuard = (v.location || v.locationId || v.group || '').toLowerCase().includes('охорон');
                        const isGuardOnDuty = isGuard && shifts.some(s => s.guardId === v.id && !s.endTime);
                        return (
                          <button
                            onClick={() => !isGuardOnDuty && markOut(v.id, logs.length - 1)}
                            disabled={isGuardOnDuty}
                            title={isGuardOnDuty ? "Не можна вийти до передачі зміни" : undefined}
                            className={`flex-1 flex justify-center items-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border transition-colors ${
                              isGuardOnDuty 
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
