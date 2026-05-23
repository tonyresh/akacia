import React, { useState, useRef } from 'react';
import { useTheme } from '../store/ThemeContext';
import { useData } from '../store/DataContext';
import { useToast } from '../store/ToastContext';
import { X, Check, Type, AppWindow, Database, Download, Upload, MapPin, Users, UserRound, Archive, Palette, LayoutDashboard, Bell, BellOff, Volume2, Clock, Pencil, Trash2, Sliders, Sun, Moon } from 'lucide-react';
import { Visitor } from '../types';
import VisitorManagement from '../components/VisitorManagement';

type SettingsTab = 'database' | 'ranks' | 'locations' | 'groups' | 'backup' | 'appearance' | 'other';

export default function Settings() {
  const { 
    theme, setTheme,
    fontSize, setFontSize, 
    toastsEnabled, setToastsEnabled,
    soundsEnabled, setSoundsEnabled,
    toastDuration, setToastDuration,
    visitorsColumns, setVisitorsColumns
  } = useTheme();
  const { showToast } = useToast();
  const dataContext = useData();
  const { categories, setCategories, groups, setGroups, visitors, setVisitors, guards, setGuards, shifts, setShifts, securityShifts, setSecurityShifts, locations, setLocations, customIcons, setCustomIcons, cleanCurrentShiftLogs, cleanLogsByPeriod } = dataContext;

  const [activeTab, setActiveTab] = useState<SettingsTab>('database');

  const [newCat, setNewCat] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newLocationIconId, setNewLocationIconId] = useState<string | undefined>();
  const [newGroup, setNewGroup] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('');
  
  const [editingRank, setEditingRank] = useState<string | null>(null);
  const [editRankValue, setEditRankValue] = useState('');

  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [editGroupValue, setEditGroupValue] = useState('');
  const [editGroupColor, setEditGroupColor] = useState('');

  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [editLocationValue, setEditLocationValue] = useState('');
  const [editLocationIconId, setEditLocationIconId] = useState<string | undefined>();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const usersFileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const GUARD_COLORS = [
    'rgba(239, 68, 68, 0.1)', 'rgba(249, 115, 22, 0.1)', 'rgba(245, 158, 11, 0.1)', 
    'rgba(132, 204, 22, 0.1)', 'rgba(34, 197, 94, 0.1)', 'rgba(16, 185, 129, 0.1)', 
    'rgba(6, 182, 212, 0.1)', 'rgba(59, 130, 246, 0.1)', 'rgba(99, 102, 241, 0.1)', 
    'rgba(168, 85, 247, 0.1)', 'rgba(236, 72, 153, 0.1)', 'rgba(100, 116, 139, 0.1)'
  ];

  const addCat = () => {
    if (!newCat.trim()) return;
    if (categories.includes(newCat.trim())) {
      showToast(`Звання "${newCat.trim()}" вже є в довіднику!`, 'error');
      return;
    }
    setCategories([...categories, newCat.trim()]);
    showToast(`Звання "${newCat.trim()}" успішно додано`, 'success');
    setNewCat('');
  }

  const saveRankEdit = (oldValue: string) => {
    const trimmed = editRankValue.trim();
    if (!trimmed || trimmed === oldValue) {
      setEditingRank(null);
      return;
    }
    if (categories.includes(trimmed)) {
      alert(`Звання "${trimmed}" вже є в довіднику!`);
      return;
    }
    setCategories(prev => prev.map(c => c === oldValue ? trimmed : c));
    showToast(`Звання за замінено на "${trimmed}"`, 'success');
    
    // Propagate change to visitors
    setVisitors(prev => prev.map(v => {
      if (v.category === oldValue) {
        return { ...v, category: trimmed };
      }
      return v;
    }));
    
    setEditingRank(null);
  };

  const [selectedCleanGroups, setSelectedCleanGroups] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<'period' | 'shift' | null>(null);

  const CLEAN_PERIODS = [
    { label: '5 хв', value: 5 },
    { label: '15 хв', value: 15 },
    { label: '30 хв', value: 30 },
    { label: '1 год', value: 60 },
    { label: '3 год', value: 180 },
    { label: '6 год', value: 360 },
    { label: '12 год', value: 720 },
  ];

  const handlePeriodClean = () => {
    if (selectedPeriod === null) return;
    cleanLogsByPeriod(selectedPeriod, selectedCleanGroups);
    showToast(`Записи за останні ${CLEAN_PERIODS.find(p => p.value === selectedPeriod)?.label} успішно очищено`, 'success');
    setShowConfirmModal(null);
    setSelectedPeriod(null);
  };

  const handleShiftClean = () => {
    cleanCurrentShiftLogs(selectedCleanGroups);
    showToast(`Дані про вхід/вихід за зміну успішно очищено`, 'success');
    setShowConfirmModal(null);
  };

  const addLocation = () => {
    if (!newLocation.trim()) return;
    if (locations.find(l => l.name === newLocation.trim())) {
      showToast(`Бригада "${newLocation.trim()}" вже є в довіднику!`, 'error');
      return;
    }
    setLocations([...locations, { id: Date.now().toString(), name: newLocation.trim(), iconId: newLocationIconId }]);
    showToast(`Бригаду "${newLocation.trim()}" додано`, 'success');
    setNewLocation('');
    setNewLocationIconId(undefined);
  }

  const saveLocationEdit = () => {
    if (!editingLocation || !editLocationValue.trim()) return;
    const trimmed = editLocationValue.trim();
    
    setLocations(prev => prev.map(l => l.id === editingLocation.id ? { ...l, name: trimmed, iconId: editLocationIconId } : l));
    
    // Propagate change to visitors
    if (trimmed !== editingLocation.name) {
      setVisitors(prev => prev.map(v => {
        if (v.location === editingLocation.name || v.locationId === editingLocation.id) {
          return { ...v, location: trimmed, locationId: editingLocation.id };
        }
        return v;
      }));
    }

    showToast(`Бригаду "${trimmed}" оновлено`, 'success');
    setEditingLocation(null);
  };

  const addGroup = () => {
    if (!newGroup.trim()) return;
    if (groups.find(g => g.name === newGroup.trim())) {
      showToast(`Група "${newGroup.trim()}" вже існує!`, 'error');
      return;
    }
    setGroups([...groups, { id: Date.now().toString(), name: newGroup.trim(), color: newGroupColor }]);
    showToast(`Групу "${newGroup.trim()}" створено`, 'success');
    setNewGroup('');
    setNewGroupColor('');
  }

  const saveGroupEdit = () => {
    if (!editingGroup || !editGroupValue.trim()) return;
    
    const trimmed = editGroupValue.trim();
    setGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, name: trimmed, color: editGroupColor } : g));
    
    // Propagate name change to visitors
    if (trimmed !== editingGroup.name) {
      setVisitors(prev => prev.map(v => {
        if (v.groupId === editingGroup.id || v.group === editingGroup.name) {
          return { ...v, group: trimmed, groupId: editingGroup.id };
        }
        return v;
      }));
    }
    
    showToast(`Групу "${trimmed}" оновлено`, 'success');
    setEditingGroup(null);
  };

  const removeCat = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
    showToast(`Звання "${cat}" видалено`, 'info');
  };
  const removeLocation = (id: string) => {
    const location = locations.find(l => l.id === id);
    setLocations(locations.filter(l => l.id !== id));
    showToast(`Бригаду "${location?.name || ''}" видалено`, 'info');
  };
  const removeGroup = (id: string) => {
    const group = groups.find(g => g.id === id);
    setGroups(groups.filter(g => g.id !== id));
    showToast(`Групу "${group?.name || ''}" видалено`, 'info');
  };

  const handleExportData = () => {
    const backup = {
      visitors,
      guards,
      shifts,
      securityShifts,
      categories,
      groups,
      locations
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `cp-manager-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportToCSV = () => {
    const headers = [
      'Дата',
      '№ п/п',
      'Звання',
      'Прізвище Ім\'я По батькові',
      'Позивний',
      'Бригада',
      'Група',
      ...Array.from({length: 4}).flatMap((_, i) => [`Вхід ${i+1}`, `Вихід ${i+1}`]),
      'Загальний час (хв)'
    ];

    const rows = visitors.map((v, i) => {
      const logs = v.logs || (v.lastEntry ? [{ in: v.lastEntry }] : []);
      const date = logs[0]?.in ? new Date(logs[0].in).toLocaleDateString() : new Date().toLocaleDateString();
      
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
        v.callsign || '',
        v.location || v.locationId || v.group,
        v.group,
        ...timeCols,
        v.totalTimeMinutes
      ].map(val => `"${val}"`).join(',');
    });

    const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `visitors_export_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.visitors) setVisitors(json.visitors);
        if (json.guards) setGuards(json.guards);
        if (json.shifts) setShifts(json.shifts);
        if (json.securityShifts) setSecurityShifts(json.securityShifts);
        if (json.categories) setCategories(json.categories);
        if (json.groups) setGroups(json.groups);
        if (json.locations) setLocations(json.locations);
        alert('База даних успішно відновлена з резервної копії!');
      } catch (error) {
        alert('Помилка файлу. Переконайтеся, що ви вибрали правильний JSON файл.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleImportUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let importedUsers: any[] = [];

        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          importedUsers = Array.isArray(json) ? json : (json.visitors || []);
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length < 2) return;
          
          // Basic CSV parsing safely handles quotes
          const parseCSVLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const headers = parseCSVLine(lines[0]);
          importedUsers = lines.slice(1).map(line => {
            const values = parseCSVLine(line);
            const obj: any = {};
            headers.forEach((h, idx) => {
              const cleanHeader = h.toLowerCase();
              if (cleanHeader.includes('ім\'я') || cleanHeader.includes('name')) obj.name = values[idx];
              if (cleanHeader.includes('позивний') || cleanHeader.includes('callsign')) obj.callsign = values[idx];
              if (cleanHeader.includes('звання') || cleanHeader.includes('rank') || cleanHeader.includes('category')) obj.category = values[idx];
              if (cleanHeader.includes('група') || cleanHeader.includes('group')) obj.group = values[idx];
            });
            return obj;
          });
        }

        if (importedUsers.length > 0) {
          const newVisitors: Visitor[] = importedUsers.map(u => {
            const groupObj = groups.find(g => g.name === u.group) || groups[0];
            return {
              id: u.id || Math.random().toString(36).substr(2, 9),
              name: u.name || 'Невідомий',
              callsign: u.callsign || '',
              category: u.category || categories[0] || 'Рядовий',
              group: groupObj?.name || u.group || '',
              groupId: groupObj?.id || 'default',
              status: 'out',
              totalTimeMinutes: 0
            };
          });

          setVisitors(prev => {
            const existingNames = new Set(prev.map(v => v.name));
            const uniqueNew = newVisitors.filter(v => !existingNames.has(v.name));
            if (uniqueNew.length < newVisitors.length) {
              const skippedCount = newVisitors.length - uniqueNew.length;
              alert(`Імпортовано ${uniqueNew.length} нових користувачів. ${skippedCount} дублікатів пропущено.`);
            } else {
              alert(`Успішно імпортовано ${newVisitors.length} користувачів!`);
            }
            return [...prev, ...uniqueNew];
          });
        }
      } catch (err) {
        alert('Помилка при читанні файлу');
      }
      if (usersFileInputRef.current) usersFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) { // 500kb limit
      showToast('Файл занадто великий (макс 500КБ)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newIcon = {
        id: 'icon-' + Date.now(),
        name: file.name,
        data: base64
      };
      setCustomIcons(prev => [...prev, newIcon]);
      showToast('Іконку успішно завантажено', 'success');
    };
    reader.readAsDataURL(file);
    if (iconInputRef.current) iconInputRef.current.value = '';
  };

  const removeIcon = (id: string) => {
    setCustomIcons(prev => prev.filter(icon => icon.id !== id));
    showToast('Іконку видалено', 'info');
  };

  const menuItems: { id: SettingsTab; label: string; icon: any; color: string }[] = [
    { id: 'database', label: 'Користувачі', icon: Database, color: 'text-blue-500' },
    { id: 'ranks', label: 'Звання', icon: UserRound, color: 'text-emerald-500' },
    { id: 'locations', label: 'Бригада', icon: MapPin, color: 'text-orange-500' },
    { id: 'groups', label: 'Групи', icon: Users, color: 'text-amber-500' },
    { id: 'backup', label: 'Бэкап', icon: Archive, color: 'text-indigo-500' },
    { id: 'appearance', label: 'Зовнішній вигляд', icon: Palette, color: 'text-primary' },
    { id: 'other', label: 'Інше', icon: Sliders, color: 'text-rose-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-3">
      <div className="mb-2 overflow-x-auto pb-1.5 hide-scrollbar">
        <div className="flex gap-2 min-w-max">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`h-10 px-4 rounded-xl flex items-center gap-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border shrink-0 ${
                activeTab === item.id 
                  ? 'bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/20 scale-[1.02]' 
                  : 'bg-card hover:bg-muted border-border text-muted-foreground'
              }`}
            >
              <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Divider line between submenu and main settings content area */}
      <div className="h-px bg-border/60 w-full mb-6 no-print" />

      <div className="flex flex-col gap-4">
        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <div className="bg-transparent rounded-none p-0 min-h-[500px]">
            {activeTab === 'database' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <VisitorManagement />
              </div>
            )}

            {activeTab === 'ranks' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
                <div className="flex gap-3 mb-6">
                  <input 
                    value={newCat} onChange={e => setNewCat(e.target.value)}
                    className="flex-1 px-4 py-2 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                    placeholder="Введіть нове звання..."
                  />
                  <button onClick={addCat} className="bg-emerald-500 text-emerald-950 px-6 py-2 rounded-xl hover:bg-emerald-400 text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20">
                    Додати
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map(c => (
                    <div key={c} className="flex justify-between items-center p-3 bg-muted/40 rounded-xl border border-border/50 text-sm group transition-colors hover:bg-muted/60">
                      {editingRank === c ? (
                        <div className="flex-1 flex gap-2">
                          <input 
                            autoFocus
                            value={editRankValue}
                            onChange={e => setEditRankValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveRankEdit(c)}
                            className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none"
                          />
                          <button 
                            onClick={() => saveRankEdit(c)} 
                            title="Зберегти"
                            className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setEditingRank(null)} 
                            title="Скасувати"
                            className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium truncate">{c}</span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingRank(c);
                                setEditRankValue(c);
                              }} 
                              className="text-muted-foreground hover:text-blue-500 p-1.5 rounded-md transition-all sm:opacity-0 group-hover:opacity-100"
                              title="Редагувати"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => removeCat(c)}
                              className="text-muted-foreground hover:text-red-500 p-1.5 rounded-md transition-all"
                              title="Видалити"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'locations' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
                <div className="space-y-4 mb-6 p-4 bg-muted/30 rounded-2xl border border-border/50">
                  <div className="flex gap-3">
                    <input 
                      value={newLocation} onChange={e => setNewLocation(e.target.value)}
                      className="flex-1 px-4 py-2 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm"
                      placeholder="Введіть нову бригаду..."
                    />
                    <button onClick={addLocation} className="bg-orange-500 text-orange-950 px-6 py-2 rounded-xl hover:bg-orange-400 text-sm font-medium transition-colors shadow-lg shadow-orange-500/20">
                      Додати
                    </button>
                  </div>
                  
                  {customIcons.length > 0 && (
                    <div className="flex gap-2 flex-wrap items-center mt-2">
                       <span className="text-[10px] uppercase font-bold text-muted-foreground mr-2">Іконка бригади:</span>
                       <div className="flex flex-wrap gap-2 bg-background/50 p-2 rounded-xl border border-border/50 max-w-full">
                         <button 
                           onClick={() => setNewLocationIconId(undefined)}
                           className={`w-8 h-8 rounded-lg flex items-center justify-center border text-[10px] ${!newLocationIconId ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                         >
                           DEF
                         </button>
                         {customIcons.map(icon => (
                           <button
                             key={icon.id}
                             onClick={() => setNewLocationIconId(icon.id)}
                             className={`w-8 h-8 rounded-lg overflow-hidden border transition-all ${newLocationIconId === icon.id ? 'border-primary scale-110 ring-2 ring-primary/20' : 'border-border opacity-60 hover:opacity-100'}`}
                           >
                             <img src={icon.data} alt={icon.name} className="w-full h-full object-cover" />
                           </button>
                         ))}
                       </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {locations.map(loc => (
                    <div key={loc.id} className="flex flex-col p-3 rounded-xl border border-border/50 text-sm group transition-colors hover:bg-muted/60 bg-muted/40">
                      {editingLocation?.id === loc.id ? (
                        <div className="flex-1 flex flex-col gap-3">
                          <input 
                            autoFocus
                            value={editLocationValue}
                            onChange={e => setEditLocationValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveLocationEdit()}
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none"
                          />

                          <div className="flex flex-wrap gap-2 items-center bg-background/30 p-1.5 rounded-lg border border-border/20 max-w-full">
                            <button 
                              onClick={() => setEditLocationIconId(undefined)}
                              className={`w-6 h-6 rounded-md flex items-center justify-center border text-[8px] ${!editLocationIconId ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                            >
                              DEF
                            </button>
                            {customIcons.map(icon => (
                              <button
                                key={icon.id}
                                onClick={() => setEditLocationIconId(icon.id)}
                                className={`w-6 h-6 rounded-md overflow-hidden border transition-all ${editLocationIconId === icon.id ? 'border-primary scale-110' : 'border-border opacity-60'}`}
                              >
                                <img src={icon.data} alt={icon.name} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>

                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={saveLocationEdit} 
                              className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase transition-colors"
                            >
                              Зберегти
                            </button>
                            <button 
                              onClick={() => setEditingLocation(null)} 
                              className="px-3 py-1 bg-muted text-muted-foreground rounded-lg text-[10px] font-bold uppercase transition-colors"
                            >
                              Скасувати
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-card/40 flex items-center justify-center text-foreground shrink-0 overflow-hidden">
                              {loc.iconId && customIcons.find(i => i.id === loc.iconId) ? (
                                <img src={customIcons.find(i => i.id === loc.iconId)?.data} alt="icon" className="w-full h-full object-cover" />
                              ) : (
                                <MapPin className="w-4 h-4 opacity-40" />
                              )}
                            </div>
                            <span className="font-medium truncate">{loc.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingLocation(loc);
                                setEditLocationValue(loc.name);
                                setEditLocationIconId(loc.iconId);
                              }} 
                              className="text-muted-foreground hover:text-blue-500 p-1.5 rounded-md transition-all sm:opacity-0 group-hover:opacity-100"
                              title="Редагувати"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => removeLocation(loc.id)}
                              className="text-muted-foreground hover:text-red-500 p-1.5 rounded-md transition-all"
                              title="Видалити"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'groups' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
                <div className="space-y-4 mb-8 p-4 bg-muted/30 rounded-2xl border border-border/50">
                  <div className="flex gap-3">
                    <input 
                      value={newGroup} onChange={e => setNewGroup(e.target.value)}
                      className="flex-1 px-4 py-2 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                      placeholder="Назва нової групи..."
                    />
                    <button onClick={addGroup} className="bg-amber-500 text-amber-950 px-6 py-2 rounded-xl hover:bg-amber-400 text-sm font-medium transition-colors shadow-lg shadow-amber-500/20">
                      Додати
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mr-2">Колір групи:</span>
                    {GUARD_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewGroupColor(c)}
                        className={`w-6 h-6 rounded-full border-2 ${newGroupColor === c ? 'border-primary scale-110 shadow-sm' : 'border-border/50'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groups.map(g => (
                    <div key={g.id} className="flex flex-col p-3 rounded-xl border border-border/50 text-sm transition-colors group relative" style={{ backgroundColor: g.color || 'var(--muted)' }}>
                      {editingGroup?.id === g.id ? (
                        <div className="flex-1 flex flex-col gap-3">
                           <input 
                            autoFocus
                            value={editGroupValue}
                            onChange={e => setEditGroupValue(e.target.value)}
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none"
                          />
                          
                          <div className="flex gap-2 flex-wrap items-center">
                             {GUARD_COLORS.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditGroupColor(c)}
                                className={`w-4 h-4 rounded-full border ${editGroupColor === c ? 'border-primary ring-1 ring-primary' : 'border-border/50'}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>

                          <div className="flex gap-2 justify-end mt-1">
                            <button 
                                onClick={saveGroupEdit} 
                                className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase transition-colors"
                              >
                                Зберегти
                              </button>
                              <button 
                                onClick={() => setEditingGroup(null)} 
                                className="px-3 py-1 bg-muted text-muted-foreground rounded-lg text-[10px] font-bold uppercase transition-colors"
                              >
                                Скасувати
                              </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-card/40 flex items-center justify-center text-foreground shrink-0 overflow-hidden">
                                <Users className="w-4 h-4 opacity-40" />
                            </div>
                            <span className="font-medium truncate">{g.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingGroup(g);
                                setEditGroupValue(g.name);
                                setEditGroupColor(g.color);
                              }} 
                              className="text-muted-foreground hover:text-blue-500 p-1.5 rounded-md transition-all sm:opacity-0 group-hover:opacity-100"
                              title="Редагувати"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => removeGroup(g.id)}
                              className="text-muted-foreground hover:text-red-500 p-1.5 rounded-md transition-all"
                              title="Видалити"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-8">
                  <div className="p-6 bg-blue-500/5 rounded-2xl">
                    <h3 className="text-sm font-semibold mb-2">Зберігання даних</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Ваш додаток працює <strong>автономно</strong>. Дані зберігаються локально в браузері. Ми рекомендуємо регулярно робити експорт бази даних для запобігання втраті інформації.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={handleExportData} className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 font-medium">
                      <Download className="w-5 h-5"/> Експорт бази (.json)
                    </button>
                    <button onClick={exportToCSV} className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500 text-emerald-950 rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 font-medium">
                      <Download className="w-5 h-5"/> Експорт відвідувань (.csv)
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-3 px-6 py-4 bg-secondary text-secondary-foreground rounded-2xl border border-border hover:bg-secondary/80 transition-all font-medium">
                      <Upload className="w-5 h-5"/> Імпорт бази (.json)
                    </button>
                    <button onClick={() => usersFileInputRef.current?.click()} className="flex items-center justify-center gap-3 px-6 py-4 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 font-medium">
                      <Upload className="w-5 h-5"/> Імпорт користувачів (CSV/JSON)
                    </button>
                  </div>
                  
                  <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImportData} />
                  <input type="file" accept=".json,.csv" className="hidden" ref={usersFileInputRef} onChange={handleImportUsers} />
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-8">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4">Сповіщення в системі</label>
                    <div className="space-y-4">
                      {/* Visual Notifications Toggle */}
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${toastsEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                            {toastsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">Спливаючі повідомлення</p>
                            <p className="text-xs text-muted-foreground">Показувати вікна про успішні дії або помилки</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setToastsEnabled(!toastsEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${toastsEnabled ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toastsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>

                      {/* Sound Notifications Toggle */}
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${soundsEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                            {soundsEnabled ? <Volume2 className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">Звукові сповіщення</p>
                            <p className="text-xs text-muted-foreground">Відтворювати звук при завершенні операцій</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSoundsEnabled(!soundsEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${soundsEnabled ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>

                      {/* Toast Duration Setting */}
                      <div className="p-5 bg-muted/30 rounded-2xl border border-border/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Тривалість сповіщень</p>
                              <p className="text-xs text-muted-foreground">Час показу вікна в секундах</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              min="1"
                              max="30"
                              value={toastDuration}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) setToastDuration(Math.min(30, Math.max(1, val)));
                              }}
                              className="w-16 px-3 py-1.5 bg-background border border-border rounded-xl text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <span className="text-xs text-muted-foreground font-medium">сек</span>
                          </div>
                        </div>
                        <input 
                          type="range"
                          min="1"
                          max="30"
                          step="1"
                          value={toastDuration}
                          onChange={(e) => setToastDuration(parseInt(e.target.value, 10))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between mt-2 px-1">
                          <span className="text-[10px] text-muted-foreground">1с</span>
                          <span className="text-[10px] text-muted-foreground">15с</span>
                          <span className="text-[10px] text-muted-foreground">30с</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4">Користувацькі іконки</label>
                    <div className="p-6 bg-muted/30 rounded-2xl border border-border/50">
                      <p className="text-xs text-muted-foreground mb-4">Завантажте власні іконки, щоб використовувати їх замість стандартних для користувачів.</p>
                      
                      <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
                        {customIcons.map(icon => (
                          <div key={icon.id} className="relative group w-8 h-8 sm:w-10 sm:h-10 bg-background rounded-lg border border-border overflow-hidden flex items-center justify-center shrink-0">
                            <img src={icon.data} alt={icon.name} className="w-full h-full object-cover" />
                            <button 
                              onClick={() => removeIcon(icon.id)}
                              className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              title="Видалити іконку"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => iconInputRef.current?.click()}
                          className="w-8 h-8 sm:w-10 sm:h-10 bg-background border border-border border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-all shrink-0"
                        >
                          <Upload className="w-3 h-3 sm:w-4 sm:h-4 mb-0.5" />
                          <span className="text-[7px] sm:text-[8px] leading-tight font-bold">Додати</span>
                        </button>
                      </div>
                      <input type="file" accept="image/*,.svg,image/svg+xml" className="hidden" ref={iconInputRef} onChange={handleIconUpload} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4">Кількість колонок на сторінці відвідувачів</label>
                    <div className="flex flex-wrap gap-2">
                      {[3, 4, 5, 6, 7, 8].map(cols => (
                        <button
                          key={cols}
                          onClick={() => setVisitorsColumns(cols)}
                          className={`w-12 h-12 rounded-xl text-sm font-bold transition-all ${
                            visitorsColumns === cols 
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' 
                              : 'bg-muted text-muted-foreground hover:bg-secondary/50 border border-border/50'
                          }`}
                        >
                          {cols}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground opacity-70">Виберіть скільки карток відображати в одному рядку на великих екранах</p>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4">Розмір шрифту інтерфейсу</label>
                    <div className="flex flex-wrap gap-3">
                      {(['normal', 'large', 'xlarge'] as const).map(size => (
                        <button
                          key={size}
                          onClick={() => setFontSize(size)}
                          className={`px-8 py-3 rounded-xl text-sm font-medium transition-all ${
                            fontSize === size 
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                              : 'bg-muted text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-border/50'
                          }`}
                        >
                          {size === 'normal' ? 'Стандартний' : size === 'large' ? 'Великий' : 'Дуже великий'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4">Тема оформлення (Світла / Темна)</label>
                    <div className="flex flex-wrap gap-3">
                      {(['light', 'dark'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={`px-8 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                            theme === t 
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                              : 'bg-muted text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-border/50'
                          }`}
                        >
                          {t === 'light' ? (
                            <>
                              <Sun className="w-4.5 h-4.5" />
                              <span>Світла</span>
                            </>
                          ) : (
                            <>
                              <Moon className="w-4.5 h-4.5" />
                              <span>Темна</span>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'other' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-8">
                  <div className="p-6 bg-rose-500/5 rounded-2xl relative overflow-hidden">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                       <Trash2 className="w-4 h-4 text-rose-500" /> 
                       Очищення помилкових записів
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      Виберіть період часу та натисніть кнопку "Очистити". Будуть видалені записи лише для користувачів, які вже **вийшли** з локації. 
                    </p>

                    <div className="mb-6">
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3">Виберіть групи для очищення (якщо нічого не вибрано - очистяться всі):</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            if (selectedCleanGroups.length === groups.length) {
                              setSelectedCleanGroups([]);
                            } else {
                              setSelectedCleanGroups(groups.map(g => g.id));
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedCleanGroups.length === groups.length ? 'bg-primary text-white border-transparent shadow-sm' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                        >
                          ВСІ ГРУПИ
                        </button>
                        <div className="w-px h-6 bg-border/60 mx-1 self-center" />
                        {groups.map(g => (
                          <button
                            key={g.id}
                            onClick={() => setSelectedCleanGroups(prev => prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id])}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedCleanGroups.includes(g.id) ? 'bg-primary text-white border-transparent shadow-sm' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                          >
                            {g.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4">
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Очистити за період:</label>
                        <div className="flex flex-wrap gap-2">
                          {CLEAN_PERIODS.map((period) => (
                            <button
                              key={period.value}
                              onClick={() => setSelectedPeriod(period.value)}
                              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedPeriod === period.value ? 'bg-primary text-white border-primary shadow-md' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                            >
                              {period.label}
                            </button>
                          ))}
                        </div>
                        <button
                          disabled={selectedPeriod === null}
                          onClick={() => setShowConfirmModal('period')}
                          className={`w-full sm:w-auto px-10 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-lg ${selectedPeriod !== null ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20' : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'}`}
                        >
                          Очистити
                        </button>
                      </div>

                      <div className="h-px bg-border/50" />

                      <div className="flex flex-col gap-3">
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Швидкі дії:</label>
                        <button
                          onClick={() => setShowConfirmModal('shift')}
                          className="w-full sm:w-auto self-start px-6 py-2.5 bg-muted border border-border text-muted-foreground rounded-xl text-xs font-bold hover:bg-rose-500 hover:text-white hover:border-transparent transition-all active:scale-95"
                        >
                          Всю зміну
                        </button>
                        <p className="text-[10px] text-muted-foreground">Видаляє дані за поточне чергування для тих, хто вже вийшов</p>
                      </div>
                    </div>

                    {/* Confirmation Modal */}
                    {showConfirmModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-card border border-border w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-4 mx-auto">
                            <Trash2 className="w-6 h-6" />
                          </div>
                          <h3 className="text-lg font-bold text-center mb-2">Підтвердження очищення</h3>
                          <p className="text-sm text-muted-foreground text-center mb-6">
                            Ви впевнені, що хочете видалити записи для груп: <span className="font-bold text-foreground">{selectedCleanGroups.length > 0 ? groups.filter(g => selectedCleanGroups.includes(g.id)).map(g => g.name).join(', ') : 'Всіх'}</span>? 
                            <br/><br/>
                            {showConfirmModal === 'period' 
                              ? `Це видалить записи за останні ${CLEAN_PERIODS.find(p => p.value === selectedPeriod)?.label} для користувачів, які вже вийшли.` 
                              : 'Це видалить всі записи за поточне чергування для користувачів, які вже вийшли.'}
                          </p>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => setShowConfirmModal(null)}
                              className="flex-1 py-3 px-4 bg-muted text-muted-foreground rounded-2xl text-xs font-bold hover:bg-muted/80 transition-colors"
                            >
                              Скасувати
                            </button>
                            <button 
                              onClick={showConfirmModal === 'period' ? handlePeriodClean : handleShiftClean}
                              className="flex-1 py-3 px-4 bg-rose-500 text-white rounded-2xl text-xs font-bold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
                            >
                              Підтвердити
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
