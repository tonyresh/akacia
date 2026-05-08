import React, { useState, useRef } from 'react';
import { useTheme } from '../store/ThemeContext';
import { useData } from '../store/DataContext';
import { X, Type, AppWindow, Database, Download, Upload } from 'lucide-react';

export default function Settings() {
  const { fontSize, setFontSize } = useTheme();
  const dataContext = useData();
  const { categories, setCategories, groups, setGroups, visitors, setVisitors, guards, setGuards, shifts, setShifts, securityShifts, setSecurityShifts, locations, setLocations } = dataContext;

  const [newCat, setNewCat] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const GUARD_COLORS = [
    'rgba(239, 68, 68, 0.1)', 'rgba(249, 115, 22, 0.1)', 'rgba(245, 158, 11, 0.1)', 
    'rgba(132, 204, 22, 0.1)', 'rgba(34, 197, 94, 0.1)', 'rgba(16, 185, 129, 0.1)', 
    'rgba(6, 182, 212, 0.1)', 'rgba(59, 130, 246, 0.1)', 'rgba(99, 102, 241, 0.1)', 
    'rgba(168, 85, 247, 0.1)', 'rgba(236, 72, 153, 0.1)', 'rgba(100, 116, 139, 0.1)'
  ];

  const addCat = () => {
    if (newCat.trim() && !categories.includes(newCat)) setCategories([...categories, newCat]);
    setNewCat('');
  }

  const addLocation = () => {
    if (newLocation.trim() && !locations.includes(newLocation)) setLocations([...locations, newLocation]);
    setNewLocation('');
  }

  const addGroup = () => {
    if (newGroup.trim() && !groups.find(g => g.name === newGroup)) {
      setGroups([...groups, { id: Date.now().toString(), name: newGroup, color: newGroupColor }]);
    }
    setNewGroup('');
    setNewGroupColor('');
  }

  const removeCat = (cat: string) => setCategories(categories.filter(c => c !== cat));
  const removeLocation = (loc: string) => setLocations(locations.filter(l => l !== loc));
  const removeGroup = (id: string) => setGroups(groups.filter(g => g.id !== id));

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

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Налаштування</h1>

      <section className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                 <Database className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold">Зберігання даних</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mt-2">
              Ваш додаток працює абсолютно <strong>автономно, без зв'язку з зовнішніми серверами</strong>. Всі дані про зміни та співробітників зберігаються локально в пам'яті цього пристрою/браузера. Щоб перенести дані на інший комп'ютер або зробити резервну копію, експортуйте файл бази даних.
            </p>
          </div>
          <div className="flex sm:flex-col gap-3 shrink-0 auto-cols-auto flex-wrap">
             <button onClick={handleExportData} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 text-sm font-medium">
               <Download className="w-4 h-4"/> Експорт бази (.json)
             </button>
             <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl border border-border hover:bg-secondary/80 transition-colors text-sm font-medium">
               <Upload className="w-4 h-4"/> Імпорт бази (.json)
             </button>
             <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImportData} />
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
             <Type className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-semibold">Зовнішній вигляд інтерфейсу</h2>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3">Розмір шрифту</label>
          <div className="flex bg-muted p-1 inline-flex rounded-xl border border-border/50">
            {(['normal', 'large', 'xlarge'] as const).map(size => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  fontSize === size ? 'bg-background shadow-sm text-foreground ring-1 ring-border shadow-black/5' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {size === 'normal' ? 'Стандартний' : size === 'large' ? 'Великий' : 'Дуже великий'}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed max-w-lg">
             Шрифт інтерфейсу буде адаптовано з урахуванням вибраного розміру. Рекомендується для людей з вадами зору.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <AppWindow className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Військові звання</h2>
          </div>
          <div className="flex gap-3">
            <input 
              value={newCat} onChange={e => setNewCat(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2 border border-border bg-background rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-shadow"
              placeholder="Додати звання..."
            />
            <button onClick={addCat} className="bg-emerald-500 text-emerald-950 px-5 py-2 rounded-full hover:bg-emerald-400 text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20">
              Додати
            </button>
          </div>
          <ul className="space-y-3 mt-6 flex-1 overflow-auto">
            {categories.map(c => (
              <li key={c} className="flex justify-between items-center p-3.5 bg-muted/40 rounded-2xl border border-border/50 text-sm group transition-colors hover:bg-muted/60">
                <span className="font-medium truncate mr-2">{c}</span>
                <button onClick={() => removeCat(c)} className="shrink-0 text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <AppWindow className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Звідки прибув</h2>
          </div>
          <div className="flex gap-3">
            <input 
              value={newLocation} onChange={e => setNewLocation(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2 border border-border bg-background rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm transition-shadow"
              placeholder="Додати місце..."
            />
            <button onClick={addLocation} className="bg-orange-500 text-orange-950 px-5 py-2 rounded-full hover:bg-orange-400 text-sm font-medium transition-colors shadow-lg shadow-orange-500/20 whitespace-nowrap">
              Додати
            </button>
          </div>
          <ul className="space-y-3 mt-6 flex-1 overflow-auto">
            {locations.map(loc => (
              <li key={loc} className="flex justify-between items-center p-3.5 bg-muted/40 rounded-2xl border border-border/50 text-sm group transition-colors hover:bg-muted/60">
                <span className="font-medium truncate mr-2">{loc}</span>
                <button onClick={() => removeLocation(loc)} className="shrink-0 text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <AppWindow className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Вкладки груп</h2>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <input 
                value={newGroup} onChange={e => setNewGroup(e.target.value)}
                className="flex-1 min-w-0 px-4 py-2 border border-border bg-background rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm transition-shadow"
                placeholder="Додати групу..."
              />
              <button onClick={addGroup} className="bg-amber-500 text-amber-950 px-5 py-2 rounded-full hover:bg-amber-400 text-sm font-medium transition-colors shadow-lg shadow-amber-500/20 whitespace-nowrap">
                Додати
              </button>
            </div>
            <div className="flex gap-2 flex-wrap px-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-full">Колір групи (фон):</span>
              {GUARD_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewGroupColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${newGroupColor === c ? 'border-primary shadow-sm scale-110 relative z-10' : 'border-border/50'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <ul className="space-y-3 mt-6 flex-1 overflow-auto">
            {groups.map(g => (
              <li key={g.id} className="flex justify-between items-center p-3.5 rounded-2xl border border-border/50 text-sm group transition-colors" style={{ backgroundColor: g.color || 'var(--muted)' }}>
                <span className="font-medium truncate mr-2">{g.name}</span>
                <button onClick={() => removeGroup(g.id)} className="shrink-0 text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
