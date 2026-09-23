import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Visitor, Guard, Shift, Category, Group, SecurityShift, DirtySkyEvent, CustomIcon, Location, DutyEvent } from '../types';

interface DataContextType {
  visitors: Visitor[];
  setVisitors: React.Dispatch<React.SetStateAction<Visitor[]>>;
  guards: Guard[];
  setGuards: React.Dispatch<React.SetStateAction<Guard[]>>;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  securityShifts: SecurityShift[];
  setSecurityShifts: React.Dispatch<React.SetStateAction<SecurityShift[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  dirtySkyEvents: DirtySkyEvent[];
  dutyEvents: DutyEvent[];
  setDutyEvents: React.Dispatch<React.SetStateAction<DutyEvent[]>>;
  addDutyEvent: (shiftId: string, shiftName: string, type: 'start' | 'end', timestamp?: string) => void;
  customIcons: CustomIcon[];
  setCustomIcons: React.Dispatch<React.SetStateAction<CustomIcon[]>>;
  startDirtySky: () => void;
  endDirtySky: () => void;
  performShiftBackupAndReset: () => void;
  cleanLogsByPeriod: (minutes: number, groupIds?: string[]) => void;
  cleanCurrentShiftLogs: (groupIds?: string[]) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [visitors, setVisitors] = useState<Visitor[]>(() => {
    try {
      const saved = localStorage.getItem('visitors');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [guards, setGuards] = useState<Guard[]>(() => {
    try {
      const saved = localStorage.getItem('guards');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      const saved = localStorage.getItem('shifts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [securityShifts, setSecurityShifts] = useState<SecurityShift[]>(() => {
    try {
      const saved = localStorage.getItem('securityShifts');
      return saved ? JSON.parse(saved) : [
        { id: 'shift-1', name: 'Денна зміна', visitorIds: [] },
        { id: 'shift-2', name: 'Нічна зміна', visitorIds: [] }
      ];
    } catch {
      return [
        { id: 'shift-1', name: 'Денна зміна', visitorIds: [] },
        { id: 'shift-2', name: 'Нічна зміна', visitorIds: [] }
      ];
    }
  });
  const [categories, setCategoriesState] = useState<Category[]>(() => {
    const defaultRanks = ['Рядовий', 'Сержант', 'Лейтенант', 'Капітан', 'Майор', 'Полковник'];
    try {
      const saved = localStorage.getItem('categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const unique = Array.from(new Set(parsed.map(String).map(s => s.trim()).filter(Boolean)));
          return unique.length > 0 ? unique : defaultRanks;
        }
      }
      return defaultRanks;
    } catch {
      return defaultRanks;
    }
  });

  const setCategories = useCallback((action: React.SetStateAction<Category[]>) => {
    setCategoriesState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      return Array.from(new Set(next.map(String).map(s => s.trim()).filter(Boolean)));
    });
  }, []);
  const [locations, setLocations] = useState<Location[]>(() => {
    try {
      const saved = localStorage.getItem('locations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          return (parsed as string[]).map(l => ({ id: Math.random().toString(36).substr(2, 9), name: l }));
        }
        return parsed;
      }
    } catch {}
    return [
      { id: 'loc-1', name: 'Штаб' },
      { id: 'loc-2', name: 'КПП' },
      { id: 'loc-3', name: 'Казарма №1' },
      { id: 'loc-4', name: 'Навчальна бригада' }
    ];
  });
  const [groups, setGroups] = useState<Group[]>(() => {
    try {
      const saved = localStorage.getItem('groups');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          return [
            { id: '1', name: 'Постійні відвідувачі', color: 'rgba(34, 197, 94, 0.1)' },
            { id: '2', name: 'Тимчасові', color: 'rgba(59, 130, 246, 0.1)' },
            { id: '3', name: 'Рота охорони', color: 'rgba(239, 68, 68, 0.1)' },
          ];
        }
        return parsed;
      }
    } catch {}
    return [
      { id: '1', name: 'Постійні відвідувачі', color: 'rgba(34, 197, 94, 0.1)' },
      { id: '2', name: 'Тимчасові', color: 'rgba(59, 130, 246, 0.1)' },
      { id: '3', name: 'Рота охорони', color: 'rgba(239, 68, 68, 0.1)' },
    ];
  });

  // Migration: Move "Рота охорони" from locations to groups and de-duplicate
  useEffect(() => {
    // Migration from old location to group
    const hasSecurityLocation = locations.some(loc => loc.name === 'Рота охорони');
    if (hasSecurityLocation) {
      setLocations(prev => prev.filter(loc => loc.name !== 'Рота охорони'));
    }
    
    // Always check for duplicates and ensure Рота охорони exists
    setGroups(prev => {
      const seen = new Set();
      const unique: Group[] = [];
      
      // First ensure core groups exist if missing
      const coreGroups = [
        { id: '1', name: 'Постійні відвідувачі', color: 'rgba(34, 197, 94, 0.1)' },
        { id: '2', name: 'Тимчасові', color: 'rgba(59, 130, 246, 0.1)' },
        { id: '3', name: 'Рота охорони', color: 'rgba(239, 68, 68, 0.1)' },
      ];

      // Use a combined list to filter
      const allPossible = [...prev];
      coreGroups.forEach(cg => {
        if (!allPossible.some(g => g.name === cg.name)) {
          allPossible.push(cg);
        }
      });

      allPossible.forEach(g => {
        if (!seen.has(g.name)) {
          seen.add(g.name);
          unique.push(g);
        }
      });

      return unique.length === prev.length && prev.length > 0 ? prev : unique;
    });
  }, [locations]);

  const [dirtySkyEvents, setDirtySkyEvents] = useState<DirtySkyEvent[]>(() => {
    const saved = localStorage.getItem('dirtySkyEvents');
    return saved ? JSON.parse(saved) : [];
  });

  const [dutyEvents, setDutyEvents] = useState<DutyEvent[]>(() => {
    try {
      const saved = localStorage.getItem('dutyEvents');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addDutyEvent = useCallback((shiftId: string, shiftName: string, type: 'start' | 'end', timestamp?: string) => {
    const newEvent: DutyEvent = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 6),
      shiftId,
      shiftName,
      type,
      timestamp: timestamp || new Date().toISOString()
    };
    setDutyEvents(prev => [...prev, newEvent]);
  }, []);

  const [customIcons, setCustomIcons] = useState<CustomIcon[]>(() => {
    try {
      const saved = localStorage.getItem('customIcons');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const startDirtySky = () => {
    const newEvent: DirtySkyEvent = {
      id: Date.now().toString(),
      startTime: new Date().toISOString(),
    };
    setDirtySkyEvents(prev => [...prev, newEvent]);
  };

  const endDirtySky = () => {
    setDirtySkyEvents(prev => {
      const lastEvent = prev[prev.length - 1];
      if (lastEvent && !lastEvent.endTime) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...lastEvent,
          endTime: new Date().toISOString(),
        };
        return updated;
      }
      return prev;
    });
  };

  const performShiftBackupAndReset = () => {
    const now = new Date();
    const shiftDateString = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString().split('T')[0] + '-' + Date.now();
    
    // Backup Settings
    const settings = { categories, locations, groups };
    const blobOptions = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const urlOptions = URL.createObjectURL(blobOptions);
    const aOptions = document.createElement('a');
    aOptions.href = urlOptions;
    aOptions.download = `backup_settings_${shiftDateString}.json`;
    document.body.appendChild(aOptions);
    aOptions.click();
    document.body.removeChild(aOptions);

    // Report of Visitors
    setTimeout(() => {
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

      const sortedVisitors = [...visitors].sort((a, b) => a.name.localeCompare(b.name));

      const rows = sortedVisitors.map((v, i) => {
        const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
        const date = logs[0]?.in ? new Date(logs[0].in).toLocaleDateString() : now.toLocaleDateString();
        
        const timeCols = Array.from({length: 4}).flatMap((_, idx) => {
          const log = logs[idx];
          const timeIn = log?.in ? new Date(log.in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
          const timeOut = log?.out ? new Date(log.out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
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
          v.totalTimeMinutes || 0
        ].map(val => `"${val}"`).join(',');
      });

      const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
      const blobReport = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const urlReport = URL.createObjectURL(blobReport);
      const aReport = document.createElement('a');
      aReport.href = urlReport;
      aReport.download = `report_visitors_${shiftDateString}.csv`;
      document.body.appendChild(aReport);
      aReport.click();
      document.body.removeChild(aReport);
    }, 500);

    // Clean cells for new shift visibility while preserving history
    setVisitors(prev => prev.map(v => {
      const nowIso = now.toISOString();
      if (v.status === 'in') {
        // Close current log for the report but keep history
        const logs = [...(v.logs || [])];
        const lastLog = logs[logs.length - 1];
        if (lastLog && !lastLog.out) {
          lastLog.out = nowIso;
        }
        // Start new log segment for the new shift
        logs.push({ in: nowIso });
        
        return { 
          ...v, 
          lastEntry: nowIso, 
          logs, 
          totalTimeMinutes: 0 // Reset daily counter
        };
      } else {
        // Reset "Out" visitors status but keep their logs!
        return { ...v, status: 'out' as const, totalTimeMinutes: 0 };
      }
    }));
    
    // Do NOT clear dirtySkyEvents anymore, they are filtered by date in reports and dashboard
  };
  
  const cleanLogsByPeriod = (minutes: number, groupIds?: string[]) => {
    const cutOff = new Date();
    cutOff.setMinutes(cutOff.getMinutes() - minutes);

    setVisitors(prev => prev.map(v => {
      // Only clean data for users who have status 'out'
      if (v.status !== 'out') return v;

      // Filter by groups if provided
      if (groupIds && groupIds.length > 0) {
        const matchesGroupId = groupIds.includes(v.groupId);
        const matchesGroupName = groupIds.includes(v.group);
        if (!matchesGroupId && !matchesGroupName) return v;
      }

      const logs = v.logs || [];
      const updatedLogs = logs.filter(log => {
        const entryTime = log.in ? new Date(log.in) : null;
        return entryTime && entryTime < cutOff;
      }).map(log => {
        const exitTime = log.out ? new Date(log.out) : null;
        if (exitTime && exitTime >= cutOff) {
          return { ...log, out: undefined };
        }
        return log;
      });

      let lastEntry = v.lastEntry;
      let status = v.status;

      if (lastEntry && new Date(lastEntry) >= cutOff) {
        status = 'out';
        lastEntry = undefined;
      }
      
      if (updatedLogs.length > 0 && !updatedLogs[updatedLogs.length - 1].out) {
        status = 'in';
        lastEntry = updatedLogs[updatedLogs.length - 1].in;
      } else if (updatedLogs.length === 0 || updatedLogs[updatedLogs.length - 1].out) {
        status = 'out';
        lastEntry = undefined;
      }

      // Recalculate totalTimeMinutes based on NEW logs
      const totalTime = updatedLogs.reduce((acc, log) => {
        if (log.in && log.out) {
          return acc + differenceInMinutes(new Date(log.out), new Date(log.in));
        }
        return acc;
      }, 0);

      return { ...v, status, lastEntry, logs: updatedLogs, totalTimeMinutes: totalTime };
    }));
  };

  const cleanCurrentShiftLogs = (groupIds?: string[]) => {
    const now = new Date();
    const shiftStart = new Date(now);
    if (shiftStart.getHours() < 8) {
      shiftStart.setDate(shiftStart.getDate() - 1);
    }
    shiftStart.setHours(8, 0, 0, 0);

    setVisitors(prev => prev.map(v => {
      // Only clean data for users who have status 'out'
      if (v.status !== 'out') return v;

      if (groupIds && groupIds.length > 0) {
         const matchesGroupId = groupIds.includes(v.groupId);
         const matchesGroupName = groupIds.includes(v.group);
         if (!matchesGroupId && !matchesGroupName) return v;
      }

      const logs = v.logs || [];
      const updatedLogs = logs.filter(log => {
        const entryTime = log.in ? new Date(log.in) : null;
        return entryTime && entryTime < shiftStart;
      });

      let status = v.status;
      let lastEntry = v.lastEntry;
      
      // If they were "in" during current shift, they should be "out" after cleaning
      if (lastEntry && new Date(lastEntry) >= shiftStart) {
        status = 'out';
        lastEntry = undefined;
      }
      
      // Check last log of remaining logs
      if (updatedLogs.length > 0 && !updatedLogs[updatedLogs.length - 1].out) {
        status = 'in';
        lastEntry = updatedLogs[updatedLogs.length - 1].in;
      } else {
        status = 'out';
        lastEntry = undefined;
      }

      const totalTime = updatedLogs.reduce((acc, log) => {
        if (log.in && log.out) {
          return acc + differenceInMinutes(new Date(log.out), new Date(log.in));
        }
        return acc;
      }, 0);

      return { ...v, status, lastEntry, logs: updatedLogs, totalTimeMinutes: totalTime };
    }));
  };

  useEffect(() => { localStorage.setItem('visitors', JSON.stringify(visitors)); }, [visitors]);
  useEffect(() => { localStorage.setItem('guards', JSON.stringify(guards)); }, [guards]);
  useEffect(() => { localStorage.setItem('shifts', JSON.stringify(shifts)); }, [shifts]);
  useEffect(() => { localStorage.setItem('securityShifts', JSON.stringify(securityShifts)); }, [securityShifts]);
  useEffect(() => { localStorage.setItem('categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('locations', JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem('groups', JSON.stringify(groups)); }, [groups]);
  useEffect(() => { localStorage.setItem('dirtySkyEvents', JSON.stringify(dirtySkyEvents)); }, [dirtySkyEvents]);
  useEffect(() => { localStorage.setItem('dutyEvents', JSON.stringify(dutyEvents)); }, [dutyEvents]);
  useEffect(() => { localStorage.setItem('customIcons', JSON.stringify(customIcons)); }, [customIcons]);

  // Data retention: 60 days
  useEffect(() => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    setVisitors(prev => {
      let changed = false;
      const updated = prev.map(v => {
        if (!v.logs) return v;
        const filteredLogs = v.logs.filter(log => {
          const logDate = log.in ? new Date(log.in) : null;
          return logDate && logDate > sixtyDaysAgo;
        });
        if (filteredLogs.length === v.logs.length) return v;
        changed = true;
        return { ...v, logs: filteredLogs };
      });
      return changed ? updated : prev;
    });

    setDirtySkyEvents(prev => {
      const filtered = prev.filter(event => {
        const eventDate = new Date(event.startTime);
        return eventDate > sixtyDaysAgo;
      });
      return filtered.length === prev.length ? prev : filtered;
    });

    setDutyEvents(prev => {
      const filtered = prev.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate > sixtyDaysAgo;
      });
      return filtered.length === prev.length ? prev : filtered;
    });
  }, []);

  return (
    <DataContext.Provider value={{ 
      visitors, setVisitors, 
      guards, setGuards, 
      shifts, setShifts, 
      securityShifts, setSecurityShifts, 
      categories, setCategories, 
      groups, setGroups, 
      locations, setLocations, 
      dirtySkyEvents, startDirtySky, endDirtySky,
      dutyEvents, setDutyEvents, addDutyEvent,
      customIcons, setCustomIcons,
      performShiftBackupAndReset, cleanLogsByPeriod, cleanCurrentShiftLogs 
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
};
