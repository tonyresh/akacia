import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../store/DataContext';
import { Users, Clock, ArrowRightCircle, X, Search, Mic, MicOff, LogIn, LogOut } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';

export default function Dashboard() {
  const { visitors, setVisitors, groups, categories, shifts } = useData();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [modalType, setModalType] = useState<'entered' | 'exited' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const markIn = (id: string) => {
    setVisitors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const now = new Date().toISOString();
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      const index = logs.length;
      if (index < 4) {
          logs[index] = { in: now };
      }
      return { ...v, status: 'in', lastEntry: now, logs };
    }));
  };

  const markOut = (id: string) => {
    setVisitors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const now = new Date().toISOString();
      const logs = v.logs ? [...v.logs] : (v.lastEntry ? [{ in: v.lastEntry }] : []);
      const index = logs.length - 1;
      if (index >= 0 && !logs[index].out) {
          logs[index] = { ...logs[index], out: now };
          const diff = logs[index].in ? differenceInMinutes(new Date(now), new Date(logs[index].in!)) : 0;
          return { 
            ...v, 
            status: 'out', 
            lastEntry: undefined,
            logs,
            totalTimeMinutes: (v.totalTimeMinutes || 0) + diff 
          };
      }
      return v;
    }));
  };
  const latestSearch = useRef(searchQuery);
  useEffect(() => {
    latestSearch.current = searchQuery;
  }, [searchQuery]);

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
        setSearchQuery(searchName);
      } else {
        searchName = latestSearch.current;
      }

      if (isPlus || isMinus) {
        executeCommand(searchName, isPlus ? 'in' : 'out');
        setTimeout(() => {
          setSearchQuery('');
        }, 1000);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const commandVisitors = visitors.filter(v => {
    if (searchQuery.trim()) {
      return matchesSearch(v.name, v.callsign, searchQuery);
    }
    const groupName = groups.find(g => g.id === v.groupId)?.name || v.group;
    return groupName === 'Командування полку';
  }).sort((a, b) => {
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

  const modalVisitors = modalType === 'entered' ? enteredTodayVisitors : exitedTodayVisitors;
  const modalTitle = modalType === 'entered' ? "Зайшли за зміну" : "Вийшли за зміну";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Оглядова панель</h1>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tracking-tight text-muted-foreground uppercase">
            Чергова зміна: {currentTime.toLocaleDateString()}
          </div>
          <div className="text-3xl font-black tracking-tighter text-foreground tabular-nums">
            {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false})}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 cursor-pointer">
        <div 
          onClick={() => setModalType('entered')}
          className="bg-primary/10 border border-primary/20 rounded-3xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <div>
            <div className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider mb-1">Зайшло (з 08:00)</div>
            <div className="text-2xl sm:text-3xl font-bold">{enteredTodayCount}</div>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20">
             <ArrowRightCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div 
          onClick={() => setModalType('exited')}
          className="bg-red-500/10 border border-red-500/20 rounded-3xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <div>
            <div className="text-[10px] sm:text-xs text-red-500 font-bold uppercase tracking-wider mb-1">Вийшло (з 08:00)</div>
            <div className="text-2xl sm:text-3xl font-bold">{exitedTodayCount}</div>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-red-500 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/20">
            <ArrowRightCircle className="w-5 h-5 sm:w-6 sm:h-6 rotate-180" />
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="w-6 h-6 text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Пошук..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-14 pr-16 py-4 bg-card border border-border rounded-3xl text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow shadow-sm"
        />
        <button
          onClick={toggleListening}
          className={`absolute inset-y-0 right-2 my-auto h-12 w-12 flex items-center justify-center rounded-2xl transition-all ${
            isListening 
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 animate-pulse' 
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title={isListening ? "Зупинити голосовий пошук" : "Голосовий пошук та команди"}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 flex flex-col shadow-sm">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-lg font-semibold">{searchQuery.trim() ? 'Результати пошуку' : 'Командування полку'}</h2>
            <p className="text-xs text-muted-foreground">{searchQuery.trim() ? 'Знайдені співробітники' : 'Всі співробітники Командування полку'}</p>
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
                        {v.category} {v.callsign ? `• ${v.callsign}` : ''} {v.location || v.locationId || v.group ? `• ${v.location || v.locationId || v.group}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {isOnLocation ? (
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="text-[10px] sm:text-xs font-medium text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
                          з {v.lastEntry ? new Date(v.lastEntry).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : ''}
                        </div>
                        {(() => {
                          const isGuard = (v.location || v.locationId || v.group || '').toLowerCase().includes('охорон');
                          const isGuardOnDuty = isGuard && shifts.some(s => s.guardId === v.id && !s.endTime);
                          return (
                            <button
                              onClick={() => !isGuardOnDuty && markOut(v.id)}
                              disabled={isGuardOnDuty}
                              title={isGuardOnDuty ? "Не можна вийти до передачі зміни" : undefined}
                              className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-xl border transition-colors ${
                                isGuardOnDuty 
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
                        onClick={() => markIn(v.id)}
                        className="w-full sm:w-auto flex justify-center items-center gap-1.5 px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-xl border border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 transition-colors"
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
               Співробітників не знайдено
            </div>
          )}
        </div>
      </div>

      {modalType && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm sm:p-4">
          <div className="bg-card w-full sm:w-[480px] h-full sm:h-auto sm:max-h-full sm:rounded-3xl shadow-xl border border-border flex flex-col shrink-0 animate-in slide-in-from-right sm:slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
              <h2 className="text-xl font-bold">{modalTitle}</h2>
              <button 
                onClick={() => setModalType(null)}
                className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors"
                title="Закрити"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
              {modalVisitors.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border border-border border-dashed rounded-2xl bg-muted/20">
                  Немає даних
                </div>
              ) : (
                modalVisitors.map(v => {
                  const visitorGroup = groups?.find(g => g.id === v.groupId) || groups?.find(g => g.name === v.group);
                  return (
                    <div key={v.id} className="flex justify-between items-center bg-background border border-border p-4 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-background shadow-sm shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: v.color || visitorGroup?.color || '#e2e8f0', color: v.color ? '#fff' : undefined }}>
                          {v.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{v.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                            {v.category} {v.callsign ? `• ${v.callsign}` : ''} {v.location || v.locationId || v.group ? `• ${v.location || v.locationId || v.group}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
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
