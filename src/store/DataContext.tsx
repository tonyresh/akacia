import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Visitor, Guard, Shift, Category, Group, SecurityShift } from '../types';

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
  locations: string[];
  setLocations: React.Dispatch<React.SetStateAction<string[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [visitors, setVisitors] = useState<Visitor[]>(() => {
    const saved = localStorage.getItem('visitors');
    return saved ? JSON.parse(saved) : [];
  });
  const [guards, setGuards] = useState<Guard[]>(() => {
    const saved = localStorage.getItem('guards');
    return saved ? JSON.parse(saved) : [];
  });
  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem('shifts');
    return saved ? JSON.parse(saved) : [];
  });
  const [securityShifts, setSecurityShifts] = useState<SecurityShift[]>(() => {
    const saved = localStorage.getItem('securityShifts');
    return saved ? JSON.parse(saved) : [
      { id: 'shift-1', name: 'Денна зміна', visitorIds: [] },
      { id: 'shift-2', name: 'Нічна зміна', visitorIds: [] }
    ];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('categories');
    return saved ? JSON.parse(saved) : ['Рядовий', 'Сержант', 'Лейтенант', 'Капітан', 'Майор', 'Полковник'];
  });
  const [locations, setLocations] = useState<string[]>(() => {
    const saved = localStorage.getItem('locations');
    return saved ? JSON.parse(saved) : ['Штаб', 'КПП', 'Казарма №1', 'Навчальна частина'];
  });
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('groups');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0 && typeof parsed[0] === 'string') {
        return [{ id: 'g-default', name: 'Постійні відвідувачі', color: 'rgba(34, 197, 94, 0.1)' }];
      }
      return parsed;
    }
    return [
      { id: '1', name: 'Постійні відвідувачі', color: 'rgba(34, 197, 94, 0.1)' },
      { id: '2', name: 'Тимчасові', color: 'rgba(59, 130, 246, 0.1)' },
    ];
  });

  useEffect(() => { localStorage.setItem('visitors', JSON.stringify(visitors)); }, [visitors]);
  useEffect(() => { localStorage.setItem('guards', JSON.stringify(guards)); }, [guards]);
  useEffect(() => { localStorage.setItem('shifts', JSON.stringify(shifts)); }, [shifts]);
  useEffect(() => { localStorage.setItem('securityShifts', JSON.stringify(securityShifts)); }, [securityShifts]);
  useEffect(() => { localStorage.setItem('categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('locations', JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem('groups', JSON.stringify(groups)); }, [groups]);

  return (
    <DataContext.Provider value={{ visitors, setVisitors, guards, setGuards, shifts, setShifts, securityShifts, setSecurityShifts, categories, setCategories, groups, setGroups, locations, setLocations }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
};
