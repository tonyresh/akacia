import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { ShieldAlert, Plus, Play, Square, Coffee, Trash2, Settings, Users } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';

export default function Security() {
  const { visitors, securityShifts, setSecurityShifts, shifts, setShifts, performShiftBackupAndReset } = useData();
  
  const [activeTab, setActiveTab] = useState<string>('');
  
  useEffect(() => {
    if (!activeTab && securityShifts.length > 0) {
      setActiveTab(securityShifts[0].id);
    } else if (securityShifts.length > 0 && !securityShifts.find(s => s.id === activeTab)) {
      setActiveTab(securityShifts[0].id);
    }
  }, [securityShifts, activeTab]);

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftNameInput, setShiftNameInput] = useState('');
  const [rosterSelection, setRosterSelection] = useState<string[]>([]);

  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverTarget, setHandoverTarget] = useState('');

  const activeShift = securityShifts.find(s => s.id === activeTab);

  const executeHandover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverTarget) return;

    const now = new Date().toISOString();
    
    // End all active guard work sessions across ALL shifts to be safe
    setShifts(prev => prev.map(s => s.endTime ? s : { ...s, endTime: now }));

    // Start work sessions for the target group's guards
    const targetGroup = securityShifts.find(s => s.id === handoverTarget);
    if (targetGroup) {
        const newShifts = targetGroup.visitorIds.map(id => ({
           id: Date.now().toString() + '-' + id + '-' + Math.random(),
           guardId: id,
           startTime: now,
           restPeriods: []
        }));
        
        // Use a timeout to ensure state settles before adding new
        setTimeout(() => {
          setShifts(prev => [...prev, ...newShifts]);
          setActiveTab(targetGroup.id);
        }, 50);
    }
    
    performShiftBackupAndReset();
    setIsHandoverModalOpen(false);
  };

  const openAddModal = () => {
    setEditingShiftId(null);
    setShiftNameInput('');
    setRosterSelection([]);
    setIsShiftModalOpen(true);
  };

  const openEditModal = (shift: any) => {
    setEditingShiftId(shift.id);
    setShiftNameInput(shift.name);
    setRosterSelection(shift.visitorIds);
    setIsShiftModalOpen(true);
  };

  const saveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftNameInput.trim()) return;
    
    if (editingShiftId) {
      setSecurityShifts(prev => prev.map(s => s.id === editingShiftId ? { ...s, name: shiftNameInput, visitorIds: rosterSelection } : s));
    } else {
      const newId = Date.now().toString();
      setSecurityShifts(prev => [...prev, { id: newId, name: shiftNameInput, visitorIds: rosterSelection }]);
      setActiveTab(newId);
    }
    setIsShiftModalOpen(false);
  };

  const deleteShift = (id: string) => {
    if (confirm('Ви впевнені, що хочете видалити цю зміну?')) {
      setSecurityShifts(prev => prev.filter(s => s.id !== id));
    }
  };

  const toggleRosterSelection = (id: string) => {
    setRosterSelection(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const getActiveWorkSession = (guardId: string) => {
    return shifts.find(s => s.guardId === guardId && !s.endTime);
  };

  const toggleWorkSession = (guardId: string) => {
    const active = getActiveWorkSession(guardId);
    if (active) {
      setShifts(prev => prev.map(s => s.id === active.id ? { ...s, endTime: new Date().toISOString() } : s));
    } else {
      setShifts(prev => [...prev, {
        id: Date.now().toString(),
        guardId,
        startTime: new Date().toISOString(),
        restPeriods: []
      }]);
    }
  };

  const toggleBreak = (shiftId: string) => {
    setShifts(prev => prev.map(s => {
      if (s.id !== shiftId) return s;
      const activeBreakIdx = s.restPeriods.findIndex(r => !r.end);
      if (activeBreakIdx >= 0) {
        const newPeriods = [...s.restPeriods];
        newPeriods[activeBreakIdx].end = new Date().toISOString();
        return { ...s, restPeriods: newPeriods };
      } else {
        return { ...s, restPeriods: [...s.restPeriods, { start: new Date().toISOString() }] };
      }
    }));
  };

  const formatDuration = (start: string, end?: string) => {
    const min = differenceInMinutes(end ? new Date(end) : new Date(), new Date(start));
    return `${Math.floor(min / 60)}г ${min % 60}хв`;
  };

  const shiftVisitors = visitors.filter(v => activeShift?.visitorIds.includes(v.id));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Облік охорони - Зміни</h1>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
        {securityShifts.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id)}
            className={`px-5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all shadow-sm ${
              activeTab === s.id 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                : 'bg-card text-muted-foreground hover:bg-secondary border border-border'
            }`}
          >
            {s.name}
          </button>
        ))}
        <button 
          onClick={openAddModal} 
          className="px-5 py-2.5 rounded-2xl text-sm font-medium bg-card text-muted-foreground border border-border border-dashed hover:bg-secondary whitespace-nowrap flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4"/> Створити зміну
        </button>
      </div>

      {activeShift ? (
        <>
          <div className="flex flex-wrap justify-between items-center bg-card border border-border rounded-3xl p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-bold">{activeShift.name}</h2>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <Users className="w-4 h-4" /> Чергових: {activeShift.visitorIds.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
              <button 
                onClick={() => {
                  setHandoverTarget('');
                  setIsHandoverModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors text-sm shadow-lg shadow-primary/20"
              >
                Передати зміну
              </button>
              <button 
                onClick={() => openEditModal(activeShift)} 
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors text-sm"
              >
                <Settings className="w-4 h-4"/> Налаштування
              </button>
              <button 
                onClick={() => deleteShift(activeShift.id)} 
                className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                title="Видалити зміну"
              >
                <Trash2 className="w-5 h-5"/>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shiftVisitors.map(guard => {
              const activeWorkSession = getActiveWorkSession(guard.id);
              const activeBreak = activeWorkSession?.restPeriods.find(r => !r.end);
              
              return (
                <div key={guard.id} className="bg-card border border-border rounded-3xl p-6 flex flex-col shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3 font-semibold text-lg max-w-[70%]">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary" style={{ backgroundColor: guard.color ? guard.color : undefined, color: guard.color ? '#fff' : undefined }}>
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <span className="truncate" title={guard.name}>{guard.name}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                      activeWorkSession 
                        ? (activeBreak ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500')
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {activeWorkSession ? (activeBreak ? 'На відпочинку' : 'На чергуванні') : 'Поза зміною'}
                    </div>
                  </div>

                  {activeWorkSession ? (
                    <div className="mb-6 text-sm space-y-2 text-muted-foreground bg-muted/30 p-4 rounded-2xl border border-border/50">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider">Початок зміни</span>
                        <span className="text-foreground font-medium">{new Date(activeWorkSession.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider">Тривалість</span>
                        <span className="text-foreground font-medium">{formatDuration(activeWorkSession.startTime)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 h-20 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-2xl border border-border/50 border-dashed border-spacing-2">
                      <span className="text-sm">Очікування заступлення</span>
                    </div>
                  )}

                  <div className="mt-auto flex gap-3">
                    <button
                      onClick={() => toggleWorkSession(guard.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        activeWorkSession 
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                      }`}
                    >
                      {activeWorkSession ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {activeWorkSession ? 'Завершити' : 'Заступити'}
                    </button>
                    
                    {activeWorkSession && (
                      <button
                        onClick={() => toggleBreak(activeWorkSession.id)}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          activeBreak
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                            : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border'
                        }`}
                      >
                        <Coffee className="w-4 h-4" />
                        {activeBreak ? 'Повернутися' : 'Відпочинок'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {shiftVisitors.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-border rounded-3xl border-dashed">
                У цій зміні поки що немає чергових співробітників. Додайте їх у налаштуваннях складу.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-16 text-center text-muted-foreground bg-card border border-border rounded-3xl shadow-sm">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Зміни не знайдені</p>
          <p className="text-sm mt-2">Створіть нову зміну для початку роботи</p>
          <button 
            onClick={openAddModal} 
            className="mt-6 px-6 py-2.5 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Створити зміну
          </button>
        </div>
      )}

      {/* Modal Add/Edit Shift */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg p-6 sm:p-8 rounded-3xl shadow-xl border border-border flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-bold mb-6">{editingShiftId ? 'Налаштування зміни' : 'Створити нову зміну'}</h2>
            <form onSubmit={saveShift} className="flex flex-col flex-1 min-h-0">
              <div className="mb-6 shrink-0">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Назва зміни</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={shiftNameInput}
                  onChange={e => setShiftNameInput(e.target.value)}
                  placeholder="Наприклад: Денна зміна"
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                />
              </div>
              
              <div className="flex-1 min-h-0 flex flex-col">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Склад чергових</label>
                <div className="flex-1 overflow-y-auto border border-border rounded-xl bg-background/50 p-2 space-y-1 relative max-h-80">
                  {visitors.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">Немає доданих співробітників у базі</p>
                  ) : visitors.map(v => (
                    <label key={v.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50">
                      <input 
                        type="checkbox" 
                        checked={rosterSelection.includes(v.id)}
                        onChange={() => toggleRosterSelection(v.id)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary/50"
                      />
                      <div className="flex-1 flex justify-between items-center">
                        <span className="font-medium text-sm">{v.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full uppercase">{v.category}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-5 py-2 border border-border rounded-full hover:bg-muted text-sm font-medium transition-colors"
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 text-sm font-medium transition-colors shadow-lg shadow-primary/20"
                >
                  {editingShiftId ? 'Зберегти зміни' : 'Зберегти зміну'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Handover Shift */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm p-6 rounded-3xl shadow-xl border border-border">
            <h2 className="text-xl font-bold mb-6">Передати зміну</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Ця дія завершить чергування всіх співробітників поточної зміни та розпочне чергування для вибраної групи.
            </p>
            <form onSubmit={executeHandover}>
              <div className="mb-6">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Кому передати зміну?</label>
                <select 
                  required
                  value={handoverTarget}
                  onChange={e => setHandoverTarget(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  <option value="">Виберіть групу...</option>
                  {securityShifts.filter(s => s.id !== activeShift?.id).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {handoverTarget && (() => {
                  const targetShift = securityShifts.find(s => s.id === handoverTarget);
                  if (!targetShift) return null;
                  const missingGuards = targetShift.visitorIds.filter(id => visitors.find(v => v.id === id)?.status !== 'in').map(id => visitors.find(v => v.id === id)?.name || 'Невідомий');
                  if (missingGuards.length > 0) {
                    return (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 space-y-1">
                        <p className="font-bold">Група не готова заступити на зміну!</p>
                        <p>Наступні співробітники ще не зайшли:</p>
                        <ul className="list-disc pl-4 mt-1 opacity-80">
                          {missingGuards.map((name, i) => <li key={i}>{name}</li>)}
                        </ul>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600">
                      <p className="font-bold flex items-center gap-2">✓ Група готова заступити на зміну</p>
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsHandoverModalOpen(false)}
                  className="px-5 py-2 border border-border rounded-full hover:bg-muted text-sm font-medium transition-colors"
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  disabled={!handoverTarget || (handoverTarget && securityShifts.find(s => s.id === handoverTarget)?.visitorIds.some(id => visitors.find(v => v.id === id)?.status !== 'in'))}
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 text-sm font-medium transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Підтвердити
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
