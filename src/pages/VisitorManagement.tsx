import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Search, Pencil, Trash2, X, Check, Plus } from 'lucide-react';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', 
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', 
  '#ec4899', '#f43f5e', '#64748b'
];

export default function VisitorManagement() {
  const { visitors, setVisitors, categories, groups, locations } = useData();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState(categories[0] || '');
  const [newLocation, setNewLocation] = useState(locations[0] || '');
  const [newGroup, setNewGroup] = useState(groups[0]?.id || '');
  const [newColor, setNewColor] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [editColor, setEditColor] = useState('');

  const filtered = visitors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setVisitors(prev => [...prev, {
      id: Date.now().toString(),
      name: newName,
      category: newCat || categories[0] || '',
      locationId: newLocation || locations[0] || '',
      location: newLocation || locations[0] || '',
      groupId: newGroup || groups[0]?.id || '',
      group: groups.find(g => g.id === (newGroup || groups[0]?.id))?.name || '',
      status: 'out',
      totalTimeMinutes: 0,
      color: newColor
    }]);
    setNewName('');
    setNewColor('');
    setIsAdding(false);
  };

  const startEditing = (v: any) => {
    setEditingId(v.id);
    setEditName(v.name);
    setEditCat(v.category);
    setEditLocation(v.location || v.locationId || locations[0] || '');
    setEditGroupId(v.groupId || groups.find(g => g.name === v.group)?.id || groups[0]?.id || '');
    setEditColor(v.color || '');
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    setVisitors(prev => prev.map(v => {
      if (v.id === editingId) {
        const foundGroup = groups.find(g => g.id === editGroupId);
        return { 
          ...v, 
          name: editName, 
          category: editCat, 
          locationId: editLocation, 
          location: editLocation, 
          groupId: editGroupId, 
          group: foundGroup?.name || v.group, 
          color: editColor 
        };
      }
      return v;
    }));
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const deleteVisitor = (id: string) => {
    if (confirm('Ви впевнені, що хочете видалити цього співробітника з бази? Буде видалена також вся історія відвідувань.')) {
      setVisitors(prev => prev.filter(v => v.id !== id));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">База даних співробітників</h1>
      </div>

      <div className="flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Пошук співробітника..."
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

        <div className="border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm min-w-max">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border w-12 text-center">Колір</th>
                <th className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border">ПІБ</th>
                <th className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Звання</th>
                <th className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Звідки прибув</th>
                <th className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] border-r border-border">Група</th>
                <th className="px-4 py-4 font-semibold uppercase tracking-wider text-[10px] text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Співробітники не знайдені
                  </td>
                </tr>
              )}
              {filtered.map((v) => {
                const isEditing = editingId === v.id;
                const visitorGroup = groups.find(g => g.id === v.groupId) || groups.find(g => g.name === v.group);
                
                return (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-center border-r border-border">
                      {isEditing ? (
                        <div className="flex gap-1 flex-wrap w-24">
                          {COLORS.slice(0, 8).map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className={`w-4 h-4 rounded-full border-2 ${editColor === c ? 'border-primary shadow-sm scale-110 relative z-10' : 'border-transparent'}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => setEditColor('')}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!editColor ? 'border-primary shadow-sm scale-110 relative z-10' : 'border-border/50'}`}
                          >
                            <X className="w-2 h-2" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full mx-auto shadow-sm" style={{ backgroundColor: v.color || visitorGroup?.color || '#e2e8f0' }} />
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-border font-medium" style={{ backgroundColor: visitorGroup?.color || 'transparent' }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        v.name
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-border" style={{ backgroundColor: visitorGroup?.color || 'transparent' }}>
                      {isEditing ? (
                        <select
                          value={editCat}
                          onChange={(e) => setEditCat(e.target.value)}
                          className="w-full px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">{v.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-border" style={{ backgroundColor: visitorGroup?.color || 'transparent' }}>
                      {isEditing ? (
                        <select
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          className="w-full px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground" style={{ color: visitorGroup?.color ? '#ffffff' : undefined }}>{v.location || v.locationId || v.group}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-border" style={{ backgroundColor: visitorGroup?.color || 'transparent' }}>
                      {isEditing ? (
                        <select
                          value={editGroupId}
                          onChange={(e) => setEditGroupId(e.target.value)}
                          className="w-full px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-muted-foreground" style={{ color: visitorGroup?.color ? 'rgba(255,255,255,0.7)' : undefined }}>{visitorGroup?.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={cancelEdit} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                          <button onClick={saveEdit} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => startEditing(v)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors" title="Редагувати">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteVisitor(v.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Видалити">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-6 rounded-3xl shadow-xl border border-border">
            <h2 className="text-xl font-bold mb-6">Додати співробітника</h2>
            <form onSubmit={handleAdd} className="space-y-4">
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
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Звідки прибув</label>
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
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Власний колір (Опціонально)</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.slice(0, 10).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${newColor === c ? 'border-foreground shadow-sm scale-110 relative z-10' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewColor('')}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] ${!newColor ? 'border-foreground shadow-sm scale-110 relative z-10' : 'border-border/50'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="px-5 py-2 border border-border rounded-full hover:bg-muted text-sm font-medium transition-colors"
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 text-sm font-medium transition-colors"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
