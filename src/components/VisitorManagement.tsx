import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Search, User, Pencil, Trash2, X, Check, Plus, ChevronDown, Star } from 'lucide-react';
import { useToast } from '../store/ToastContext';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', 
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', 
  '#ec4899', '#f43f5e', '#64748b'
];

export default function VisitorManagement() {
  const { visitors, setVisitors, categories, groups, locations, customIcons } = useData();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visitorToDelete, setVisitorToDelete] = useState<string | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCallsign, setNewCallsign] = useState('');
  const [newCat, setNewCat] = useState(categories[0] || '');
  const [newLocation, setNewLocation] = useState(locations[0] || '');
  const [newGroup, setNewGroup] = useState(groups[0]?.id || '');
  const [newColor, setNewColor] = useState('');
  const [newIsSpecial, setNewIsSpecial] = useState(false);
  const [newCustomIconId, setNewCustomIconId] = useState<string>('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCallsign, setEditCallsign] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIsSpecial, setEditIsSpecial] = useState(false);
  const [editCustomIconId, setEditCustomIconId] = useState<string>('');

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

  const filtered = visitors
    .filter(v => matchesSearch(v.name, v.callsign, search))
    .sort((a, b) => {
      const specialA = a.isSpecial ? 1 : 0;
      const specialB = b.isSpecial ? 1 : 0;
      if (specialA !== specialB) return specialB - specialA;
      return a.name.localeCompare(b.name);
    });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    const trimmedCallsign = newCallsign.trim();
    
    if (!trimmedName) return;

    const isDuplicateName = visitors.some(v => v.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicateName) {
      alert(`Користувач з ім'ям "${trimmedName}" вже є в базі!`);
      return;
    }

    if (trimmedCallsign) {
      const isDuplicateCallsign = visitors.some(v => v.callsign?.toLowerCase() === trimmedCallsign.toLowerCase());
      if (isDuplicateCallsign) {
        alert(`Користувач з позивним "${trimmedCallsign}" вже є в базі!`);
        return;
      }
    }
    
    try {
      setVisitors(prev => [...prev, {
        id: Date.now().toString(),
        name: trimmedName,
        callsign: trimmedCallsign || undefined,
        category: newCat || categories[0] || '',
        locationId: newLocation || locations[0] || '',
        location: newLocation || locations[0] || '',
        groupId: newGroup || groups[0]?.id || '',
        group: groups.find(g => g.id === (newGroup || groups[0]?.id))?.name || '',
        status: 'out',
        totalTimeMinutes: 0,
        color: newColor,
        isSpecial: newIsSpecial,
        customIconId: newCustomIconId || undefined
      }]);
      showToast(`Успішно додано користувача: ${trimmedName}`, 'success');
      setNewName('');
      setNewCallsign('');
      setNewColor('');
      setNewIsSpecial(false);
      setNewCustomIconId('');
      setIsAdding(false);
    } catch (error) {
      showToast(`Помилка при додаванні: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const startEditing = (v: any) => {
    setEditingId(v.id);
    setEditName(v.name);
    setEditCallsign(v.callsign || '');
    setEditCat(v.category);
    setEditLocation(v.location || v.locationId || locations[0] || '');
    setEditGroupId(v.groupId || groups.find(g => g.name === v.group)?.id || groups[0]?.id || '');
    setEditColor(v.color || '');
    setEditIsSpecial(v.isSpecial || false);
    setEditCustomIconId(v.customIconId || '');
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    try {
      setVisitors(prev => prev.map(v => {
        if (v.id === editingId) {
          const foundGroup = groups.find(g => g.id === editGroupId);
          return { 
            ...v, 
            name: editName, 
            callsign: editCallsign.trim() || undefined,
            category: editCat, 
            locationId: editLocation, 
            location: editLocation, 
            groupId: editGroupId, 
            group: foundGroup?.name || v.group, 
            color: editColor,
            isSpecial: editIsSpecial,
            customIconId: editCustomIconId || undefined
          };
        }
        return v;
      }));
      showToast(`Успішно збережено зміни: ${editName}`, 'success');
      setEditingId(null);
    } catch (error) {
      showToast(`Помилка при збереженні: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const confirmDeleteVisitor = (id: string) => {
    setVisitorToDelete(id);
  };

  const executeDelete = () => {
    if (visitorToDelete) {
      const visitor = visitors.find(v => v.id === visitorToDelete);
      setVisitors(prev => prev.filter(v => v.id !== visitorToDelete));
      showToast(`Користувача ${visitor?.name || ''} видалено`, 'info');
      setVisitorToDelete(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      </div>

      <div className="flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Пошук користувача..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full justify-center sm:w-auto flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-full hover:bg-primary/90 transition-colors text-sm font-medium shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Додати
          </button>
        </div>

        <div className="border border-border rounded-2xl overflow-hidden bg-card">
          {/* Desktop Table Header */}
          <div className="hidden lg:grid lg:grid-cols-[80px_1fr_150px_150px_140px] bg-muted/50 text-muted-foreground border-b border-border">
            <div className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] border-r border-border text-center">Іконка / Колір</div>
            <div className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Користувач</div>
            <div className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Бригада</div>
            <div className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Група</div>
            <div className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right">Дії</div>
          </div>

          <div className="divide-y divide-border">
            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center text-muted-foreground">
                Користувачі не знайдені
              </div>
            )}
            {filtered.map((v) => {
              const isEditing = editingId === v.id;
              const visitorGroup = groups.find(g => g.id === v.groupId) || groups.find(g => g.name === v.group);
              const customIcon = customIcons.find(icon => icon.id === v.customIconId);
              const blockColor = v.color || visitorGroup?.color;
              const hasGroupColor = !!blockColor && blockColor !== 'transparent';
              
              const rowStyles = hasGroupColor ? {
                backgroundColor: blockColor.startsWith('#') ? `${blockColor}15` : blockColor,
              } : {};
              
              return (
                <div 
                  key={v.id} 
                  className={`flex flex-col lg:grid lg:grid-cols-[80px_1fr_150px_150px_140px] hover:bg-muted/30 transition-colors p-4 lg:p-0 ${isEditing ? 'bg-muted/10' : ''}`}
                  style={rowStyles}
                >
                  {/* Icon Column */}
                  <div className="flex items-center justify-center lg:border-r lg:border-border mb-4 lg:mb-0 pt-2 lg:pt-0">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 items-center w-full px-2">
                        <div className="relative w-full">
                          <select
                            value={editCustomIconId}
                            onChange={(e) => setEditCustomIconId(e.target.value)}
                            className="w-full h-10 px-3 bg-background border border-border rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-primary pl-10"
                          >
                            <option value="">Стандартна</option>
                            {customIcons.map(icon => (
                              <option key={icon.id} value={icon.id}>{icon.name}</option>
                            ))}
                          </select>
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center overflow-hidden">
                            {editCustomIconId ? (
                              <img src={customIcons.find(i => i.id === editCustomIconId)?.data} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                        <div className="relative w-full">
                          <select
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-full h-10 px-3 bg-background border border-border rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-primary pl-10"
                            style={{ borderLeft: editColor ? `4px solid ${editColor}` : undefined }}
                          >
                            <option value="">Без кольору</option>
                            {COLORS.map(c => (
                              <option key={c} value={c} style={{ backgroundColor: c, color: '#fff' }}>
                                Колір {c}
                              </option>
                            ))}
                          </select>
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-border/50" style={{ backgroundColor: editColor || 'transparent' }} />
                        </div>
                      </div>
                    ) : (
                    <div className={`w-12 h-12 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-white overflow-hidden ${customIcon ? '' : 'shadow-sm'}`} style={{ backgroundColor: customIcon ? 'transparent' : (v.isSpecial ? '#fbbf24' : (v.color || visitorGroup?.color || '#5b6984')) }}>
                        {customIcon ? (
                          <img src={customIcon.data} alt="user icon" className="w-full h-full object-cover" />
                        ) : v.isSpecial ? (
                          <Star className="w-6 h-6 lg:w-5 lg:h-5 text-white fill-white" />
                        ) : (
                          <User className="w-6 h-6 lg:w-5 lg:h-5 text-[#e5e9ec]" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info Column */}
                  <div className="flex flex-col px-0 lg:px-4 lg:py-3 lg:border-r lg:border-border mb-4 lg:mb-0">
                    <div className="lg:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1">Інформація</div>
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Звання</label>
                            <select
                              value={editCat}
                              onChange={(e) => setEditCat(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary"
                            >
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">ПІБ</label>
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm font-medium focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Позивний</label>
                            <input
                              value={editCallsign}
                              onChange={(e) => setEditCallsign(e.target.value)}
                              placeholder="Позивний"
                              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div className="flex items-center gap-3 pt-4 px-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <div className={`w-5 h-5 rounded border border-border flex items-center justify-center transition-colors ${editIsSpecial ? 'bg-primary border-primary' : 'bg-background'}`}>
                                {editIsSpecial && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <input 
                                type="checkbox"
                                checked={editIsSpecial}
                                onChange={e => setEditIsSpecial(e.target.checked)}
                                className="hidden"
                              />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase group-hover:text-primary transition-colors">Особливий</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">{v.category}</span>
                        <div className="font-semibold text-base leading-tight mb-1">{v.name}</div>
                        {v.callsign && (
                          <div className="text-[10px] font-bold text-primary/80 uppercase tracking-[0.2em]">{v.callsign}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Brigade Column */}
                  <div className="flex flex-col px-0 lg:px-4 lg:py-3 lg:border-r lg:border-border mb-4 lg:mb-0">
                    <div className="lg:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1">Бригада</div>
                    {isEditing ? (
                      <select
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-1 focus:ring-primary"
                      >
                        {locations.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground lg:text-foreground">{v.location || v.locationId || v.group}</span>
                    )}
                  </div>

                  {/* Group Column */}
                  <div className="flex flex-col px-0 lg:px-4 lg:py-3 lg:border-r lg:border-border mb-6 lg:mb-0">
                    <div className="lg:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1">Група</div>
                    {isEditing ? (
                      <select
                        value={editGroupId}
                        onChange={(e) => setEditGroupId(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-1 focus:ring-primary"
                      >
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: visitorGroup?.color || 'currentColor' }} />
                        <span className="text-[10px] uppercase font-bold text-muted-foreground truncate">{visitorGroup?.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center justify-center lg:px-4 lg:py-3 pt-4 border-t lg:border-t-0 border-border/50">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-3 w-full">
                        <button 
                          onClick={saveEdit} 
                          title="Зберегти"
                          className="flex-1 lg:flex-none flex items-center justify-center p-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                          <Check className="w-5 h-5 lg:w-4 lg:h-4" />
                          <span className="lg:hidden ml-2 font-medium">Зберегти</span>
                        </button>
                        <button 
                          onClick={cancelEdit} 
                          title="Скасувати"
                          className="flex-1 lg:flex-none flex items-center justify-center p-3 bg-muted text-muted-foreground rounded-2xl hover:bg-muted/80 transition-colors border border-border"
                        >
                          <X className="w-5 h-5 lg:w-4 lg:h-4" />
                          <span className="lg:hidden ml-2 font-medium">Скасувати</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 w-full">
                        <button onClick={() => startEditing(v)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 p-3 lg:p-2 lg:bg-blue-500/10 lg:text-blue-500 text-blue-600 bg-blue-50 rounded-2xl lg:rounded-md transition-all font-medium text-sm" title="Редагувати">
                          <Pencil className="w-5 h-5 lg:w-4 lg:h-4" />
                          <span className="lg:hidden">Редагувати</span>
                        </button>
                        <button onClick={() => confirmDeleteVisitor(v.id)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 p-3 lg:p-2 lg:bg-red-500/10 lg:text-red-500 text-red-600 bg-red-50 rounded-2xl lg:rounded-md transition-all font-medium text-sm" title="Видалити">
                          <Trash2 className="w-5 h-5 lg:w-4 lg:h-4" />
                          <span className="lg:hidden">Видалити</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-6 rounded-3xl shadow-xl border border-border">
            <h2 className="text-xl font-bold mb-6">Додати користувача</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Звання</label>
                <select 
                  value={newCat} 
                  onChange={e => setNewCat(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  <option value="">Виберіть звання...</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">ПІБ</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Позивний (опціонально)</label>
                <input 
                  type="text" 
                  value={newCallsign}
                  onChange={e => setNewCallsign(e.target.value)}
                  placeholder="Введіть позивний"
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Бригада</label>
                <select 
                  value={newLocation} 
                  onChange={e => setNewLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  <option value="">Виберіть...</option>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Група</label>
                <select 
                  value={newGroup} 
                  onChange={e => setNewGroup(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  <option value="">Виберіть групу...</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Власний колір виділення (Опціонально)</label>
                <div className="relative">
                  <select 
                    value={newColor} 
                    onChange={e => setNewColor(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow appearance-none"
                  >
                    <option value="">Не виділяти кольором</option>
                    {COLORS.map(c => (
                      <option key={c} value={c}>
                        Колір {c}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-border" style={{ backgroundColor: newColor || 'transparent' }} />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Власна іконка</label>
                <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-2 border border-border rounded-xl bg-background">
                  <button
                    type="button"
                    onClick={() => setNewCustomIconId('')}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${!newCustomIconId ? 'border-primary bg-primary/10' : 'border-transparent bg-muted/50'}`}
                  >
                    <User className="w-5 h-5" />
                  </button>
                      {customIcons.map(icon => (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => setNewCustomIconId(icon.id)}
                          className={`aspect-square rounded-lg border-2 overflow-hidden transition-all ${newCustomIconId === icon.id ? 'border-primary bg-primary/10' : 'border-transparent bg-muted/50'}`}
                        >
                          <img src={icon.data} alt={icon.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/50">
                <div className={`p-2 rounded-lg ${newIsSpecial ? 'bg-yellow-500/10 text-yellow-500' : 'bg-muted text-muted-foreground'}`}>
                  <Star className={`w-4 h-4 ${newIsSpecial ? 'fill-yellow-500' : ''}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Особливий статус</p>
                  <p className="text-xs text-muted-foreground">Буде відображатись на початку списку із золотою зіркою</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewIsSpecial(!newIsSpecial)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${newIsSpecial ? 'bg-yellow-500' : 'bg-muted'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${newIsSpecial ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  title="Скасувати"
                  className="p-3 border border-border rounded-2xl hover:bg-muted text-muted-foreground transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <button 
                  type="submit"
                  title="Зберегти"
                  className="p-3 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {visitorToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-6 rounded-3xl shadow-xl border border-border">
            <h2 className="text-xl font-bold mb-4 text-red-500">Видалити користувача?</h2>
            <p className="text-muted-foreground mb-6">
              Ви впевнені, що хочете видалити цього користувача з бази? Буде видалена також вся історія відвідувань. Цю дію неможливо скасувати.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setVisitorToDelete(null)}
                title="Скасувати"
                className="p-3 border border-border rounded-2xl hover:bg-muted text-muted-foreground transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <button 
                onClick={executeDelete}
                title="Видалити"
                className="p-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all font-medium"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
