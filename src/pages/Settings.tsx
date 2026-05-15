import React, { useState, useRef } from 'react';
import { useTheme } from '../store/ThemeContext';
import { useData } from '../store/DataContext';
import { useToast } from '../store/ToastContext';
import { X, Check, Type, AppWindow, Database, Download, Upload, MapPin, Users, UserRound, Archive, Palette, LayoutDashboard, Bell, BellOff, Volume2, Clock, Pencil, Trash2 } from 'lucide-react';
import { Visitor } from '../types';
import VisitorManagement from '../components/VisitorManagement';

type SettingsTab = 'database' | 'ranks' | 'locations' | 'groups' | 'backup' | 'appearance';

export default function Settings() {
  const { 
    fontSize, setFontSize, 
    toastsEnabled, setToastsEnabled,
    soundsEnabled, setSoundsEnabled,
    toastDuration, setToastDuration
  } = useTheme();
  const { showToast } = useToast();
  const dataContext = useData();
  const { categories, setCategories, groups, setGroups, visitors, setVisitors, guards, setGuards, shifts, setShifts, securityShifts, setSecurityShifts, locations, setLocations } = dataContext;

  const [activeTab, setActiveTab] = useState<SettingsTab>('database');

  const [newCat, setNewCat] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('');
  
  const [editingRank, setEditingRank] = useState<string | null>(null);
  const [editRankValue, setEditRankValue] = useState('');

  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [editGroupValue, setEditGroupValue] = useState('');
  const [editGroupColor, setEditGroupColor] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const usersFileInputRef = useRef<HTMLInputElement>(null);

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

  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editLocationValue, setEditLocationValue] = useState('');

  const addLocation = () => {
    if (!newLocation.trim()) return;
    if (locations.includes(newLocation.trim())) {
      showToast(`Бригада "${newLocation.trim()}" вже є в довіднику!`, 'error');
      return;
    }
    setLocations([...locations, newLocation.trim()]);
    showToast(`Бригаду "${newLocation.trim()}" додано`, 'success');
    setNewLocation('');
  }

  const saveLocationEdit = (oldValue: string) => {
    const trimmed = editLocationValue.trim();
    if (!trimmed || trimmed === oldValue) {
      setEditingLocation(null);
      return;
    }
    
    if (locations.includes(trimmed)) {
      alert(`Бригада "${trimmed}" вже є в довіднику!`);
      return;
    }

    setLocations(prev => prev.map(l => l === oldValue ? trimmed : l));
    showToast(`Бригаду "${oldValue}" перейменована на "${trimmed}"`, 'success');
    
    // Propagate change to visitors
    setVisitors(prev => prev.map(v => {
      if (v.location === oldValue || v.locationId === oldValue) {
        return { ...v, location: trimmed, locationId: trimmed };
      }
      return v;
    }));
    
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
  const removeLocation = (loc: string) => {
    setLocations(locations.filter(l => l !== loc));
    showToast(`Бригаду "${loc}" видалено`, 'info');
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

  const menuItems: { id: SettingsTab; label: string; icon: any; color: string }[] = [
    { id: 'database', label: 'Співробітники', icon: Database, color: 'text-blue-500' },
    { id: 'ranks', label: 'Військові звання', icon: UserRound, color: 'text-emerald-500' },
    { id: 'locations', label: 'Бригада', icon: MapPin, color: 'text-orange-500' },
    { id: 'groups', label: 'Групи', icon: Users, color: 'text-amber-500' },
    { id: 'backup', label: 'База даних (Резерв)', icon: Archive, color: 'text-indigo-500' },
    { id: 'appearance', label: 'Зовнішній вигляд', icon: Palette, color: 'text-primary' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-8">Налаштування</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Menu */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap lg:whitespace-normal w-full text-left ${
                  activeTab === item.id 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-current' : item.color}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm min-h-[500px]">
            {activeTab === 'database' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Database className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold">Співробітники</h2>
                </div>
                <VisitorManagement />
              </div>
            )}

            {activeTab === 'ranks' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold">Довідник звань</h2>
                </div>
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
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold">Бригада</h2>
                </div>
                <div className="flex gap-3 mb-6">
                  <input 
                    value={newLocation} onChange={e => setNewLocation(e.target.value)}
                    className="flex-1 px-4 py-2 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm"
                    placeholder="Введіть нову бригаду..."
                  />
                  <button onClick={addLocation} className="bg-orange-500 text-orange-950 px-6 py-2 rounded-xl hover:bg-orange-400 text-sm font-medium transition-colors shadow-lg shadow-orange-500/20">
                    Додати
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {locations.map(loc => (
                    <div key={loc} className="flex justify-between items-center p-3 bg-muted/40 rounded-xl border border-border/50 text-sm group transition-colors hover:bg-muted/60">
                      {editingLocation === loc ? (
                        <div className="flex-1 flex gap-2">
                          <input 
                            autoFocus
                            value={editLocationValue}
                            onChange={e => setEditLocationValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveLocationEdit(loc)}
                            className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none"
                          />
                          <button 
                            onClick={() => saveLocationEdit(loc)} 
                            title="Зберегти"
                            className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setEditingLocation(null)} 
                            title="Скасувати"
                            className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium truncate">{loc}</span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingLocation(loc);
                                setEditLocationValue(loc);
                              }} 
                              className="text-muted-foreground hover:text-blue-500 p-1.5 rounded-md transition-all sm:opacity-0 group-hover:opacity-100"
                              title="Редагувати"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => removeLocation(loc)}
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

            {activeTab === 'groups' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Users className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold">Налаштування груп</h2>
                </div>
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
                    <div key={g.id} className="flex justify-between items-center p-3 rounded-xl border border-border/50 text-sm transition-colors group" style={{ backgroundColor: g.color || 'var(--muted)' }}>
                      {editingGroup?.id === g.id ? (
                        <div className="flex-1 flex flex-col gap-2">
                           <input 
                            autoFocus
                            value={editGroupValue}
                            onChange={e => setEditGroupValue(e.target.value)}
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none"
                          />
                          <div className="flex gap-2 items-center">
                             {GUARD_COLORS.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditGroupColor(c)}
                                className={`w-4 h-4 rounded-full border ${editGroupColor === c ? 'border-primary ring-1 ring-primary' : 'border-border/50'}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                            <div className="flex-1" />
                            <button 
                                onClick={saveGroupEdit} 
                                title="Зберегти"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setEditingGroup(null)} 
                                title="Скасувати"
                                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium truncate">{g.name}</span>
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
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <Archive className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold">Резервне копіювання та імпорт</h2>
                </div>
                <div className="space-y-8">
                  <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
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
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Palette className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold">Зовнішній вигляд</h2>
                </div>

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
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
