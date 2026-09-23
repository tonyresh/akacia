import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { useToast } from '../store/ToastContext';
import { ShieldAlert, Plus, Play, Square, Coffee, Trash2, Settings, Users, X, Check } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';
import { formatNameAbbreviated } from '../utils/nameUtils';

export default function Security() {
  const { visitors, securityShifts, setSecurityShifts, shifts, setShifts, performShiftBackupAndReset, dirtySkyEvents, customIcons, addDutyEvent } = useData();
  const { showToast } = useToast();
  
  const activeDirtySky = dirtySkyEvents.find(e => !e.endTime);
  
  const [activeTab, setActiveTab] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
  
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);

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
          showToast(`Чергову зміну передано групі: ${targetGroup.name}`, 'success');
        }, 50);

        setSecurityShifts(prev => prev.map(s => ({
          ...s,
          status: s.id === targetGroup.id ? 'active' : 'inactive'
        })));

        if (activeShift) {
          addDutyEvent(activeShift.id, activeShift.name, 'end', now);
        }
        addDutyEvent(targetGroup.id, targetGroup.name, 'start', now);
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
      showToast('Зміни в черговій зміні збережено', 'success');
    } else {
      const newId = Date.now().toString();
      setSecurityShifts(prev => [...prev, { id: newId, name: shiftNameInput, visitorIds: rosterSelection }]);
      setActiveTab(newId);
      showToast(`Чергову зміну "${shiftNameInput}" створено`, 'success');
    }
    setIsShiftModalOpen(false);
  };

  const deleteShift = (id: string) => {
    setShiftToDelete(id);
  };

  const confirmDeleteShift = () => {
    if (shiftToDelete) {
      const shift = securityShifts.find(s => s.id === shiftToDelete);
      setSecurityShifts(prev => prev.filter(s => s.id !== shiftToDelete));
      showToast(`Чергову зміну "${shift?.name || ''}" видалено`, 'info');
      setShiftToDelete(null);
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

  const stopShiftWorkSession = () => {
    if (!activeShift) return;
    const now = new Date().toISOString();
    
    // Stop all active guard sessions
    setShifts(prev => prev.map(s => s.endTime ? s : { ...s, endTime: now }));

    // Update shift statuses to inactive
    setSecurityShifts(prev => prev.map(s => ({ ...s, status: 'inactive' })));

    // Record in reports: which shift and at what time finished duty
    addDutyEvent(activeShift.id, activeShift.name, 'end', now);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    showToast(`Чергування зміни "${activeShift.name}" зупинено о ${timeStr}`, 'info');
  };

  const startShiftWorkSession = () => {
    if (!activeShift) return;
    const now = new Date().toISOString();
    
    // Set endTime for all guards from previous shifts who are currently active
    setShifts(prev => {
      const endedShifts = prev.map(s => s.endTime ? s : { ...s, endTime: now });

      const newShifts = (activeShift.visitorIds || []).map((guardId, i) => ({
        id: Date.now().toString() + i + '-' + Math.random(),
        guardId: guardId,
        startTime: now,
        restPeriods: []
      }));

      return [...endedShifts, ...newShifts];
    });

    // Mark this shift as active and others as inactive
    setSecurityShifts(prev => prev.map(s => ({
      ...s,
      status: s.id === activeShift.id ? 'active' : 'inactive'
    })));

    // Record in reports: which shift and at what time started duty
    addDutyEvent(activeShift.id, activeShift.name, 'start', now);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    showToast(`Зміна "${activeShift.name}" заступила на чергування о ${timeStr}`, 'success');
  };

  // Find the sessions for the active shift's guards
  const getActiveShiftSessions = () => {
    if (!activeShift) return [];
    return shifts.filter(s => activeShift.visitorIds.includes(s.guardId) && !s.endTime);
  };

  const getFinishedShiftSessions = () => {
    if (!activeShift) return [];
    // Get last finished sessions for this group
    const groupShifts = shifts.filter(s => activeShift.visitorIds.includes(s.guardId) && s.endTime).sort((a,b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());
    if (groupShifts.length === 0) return [];
    // Take sessions that ended around the same time (within 1 minute)
    const lastEnd = new Date(groupShifts[0].endTime!).getTime();
    return groupShifts.filter(s => Math.abs(new Date(s.endTime!).getTime() - lastEnd) < 60000);
  };

  const activeSessions = getActiveShiftSessions();
  const finishedSessions = getFinishedShiftSessions();

  const formatDuration = (start: string, end?: string) => {
    const min = differenceInMinutes(end ? new Date(end) : new Date(), new Date(start));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}г ${m}хв`;
  };

  const shiftVisitors = visitors.filter(v => activeShift?.visitorIds.includes(v.id));
  const isShiftOnDuty = activeSessions.length > 0 || activeShift?.status === 'active';
  const isAnyShiftOnDuty = securityShifts.some(s => s.status === 'active') || shifts.some(s => !s.endTime);
  const isAfter600 = currentTime.getHours() >= 6;
  const allGuardsIn = shiftVisitors.length > 0 && shiftVisitors.every(guard => guard.status === 'in');
  const isAnyOtherShiftReady = securityShifts.some(s => 
    s.id !== activeShift?.id && 
    s.visitorIds.length > 0 && 
    s.visitorIds.every(id => visitors.find(v => v.id === id)?.status === 'in')
  );

  const canHandover = isShiftOnDuty && isAfter600 && allGuardsIn && isAnyOtherShiftReady;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex gap-3 overflow-x-auto pb-3 hide-scrollbar snap-x">
        {securityShifts.map(s => {
          const shiftActive = shifts.some(session => s.visitorIds.includes(session.guardId) && !session.endTime) || s.status === 'active';
          return (
            <button
              key={s.id}
              onClick={() => setActiveTab(s.id)}
              className={`px-5 py-2.5 rounded-2xl text-sm font-normal whitespace-nowrap transition-all shadow-sm snap-start flex items-center gap-2 ${
                activeTab === s.id 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                  : 'bg-card text-muted-foreground hover:bg-secondary border border-border'
              }`}
            >
              <span>{s.name}</span>
              {shiftActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="На чергуванні" />
              )}
            </button>
          );
        })}
        <button 
          onClick={openAddModal} 
          className="px-5 py-2.5 rounded-2xl text-sm font-normal bg-card text-muted-foreground border border-border border-dashed hover:bg-secondary whitespace-nowrap flex items-center gap-2 transition-colors snap-start"
        >
          <Plus className="w-4 h-4"/> Створити чергову зміну
        </button>
      </div>

      {activeShift ? (
        <>
          <div className="flex flex-col bg-card rounded-3xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-normal truncate">{activeShift.name}</h2>
                  {isShiftOnDuty ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> На чергуванні
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/50">
                      Не на чергуванні
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 font-normal">
                  <Users className="w-4 h-4" /> Чергових: {activeSessions.length} з {activeShift.visitorIds.length}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {isShiftOnDuty && (
                  <button 
                    onClick={stopShiftWorkSession}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-all text-sm shadow-lg shadow-rose-600/20 active:scale-95 cursor-pointer"
                    title="Зупинити чергування цієї зміни без будь-яких додаткових умов"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Зупинити чергування
                  </button>
                )}
                <button 
                  onClick={() => {
                    setHandoverTarget('');
                    setIsHandoverModalOpen(true);
                  }}
                  disabled={!canHandover}
                  className={`flex items-center gap-2 px-4 py-2 font-normal rounded-xl transition-colors text-sm shadow-lg ${
                    canHandover 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'
                      : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50 shadow-none'
                  }`}
                  title={!canHandover ? (!isShiftOnDuty ? "Зміна не на посту" : !isAfter600 ? "Передача можлива тільки після 06:00" : !allGuardsIn ? "Не всі охоронці поточної зміни на локації" : !isAnyOtherShiftReady ? "Немає іншої групи, де всі охоронці зайшли" : "") : "Передати чергову зміну іншій групі"}
                >
                  Передати чергову зміну
                </button>
                <button 
                  onClick={() => openEditModal(activeShift)} 
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground font-normal rounded-xl hover:bg-secondary/80 transition-colors text-sm"
                >
                  <Settings className="w-4 h-4"/> Налаштування
                </button>
                <button 
                  onClick={() => deleteShift(activeShift.id)} 
                  className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                  title="Видалити чергову зміну"
                >
                  <Trash2 className="w-5 h-5"/>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center mt-6 pt-6 border-t border-border/50">
              {isShiftOnDuty ? (
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                   {(() => {
                     const firstStart = activeSessions.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]?.startTime || new Date().toISOString();
                     return (
                       <>
                         <div className="flex flex-1 justify-between items-center bg-emerald-500/5 py-2 px-4 rounded-2xl border border-emerald-500/20">
                           <div className="flex flex-col gap-0.5">
                             <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-600/70">Чергування розпочато</span>
                             <span className="text-foreground font-bold text-lg">{new Date(firstStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}</span>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                             <Play className="w-5 h-5 text-emerald-600 fill-emerald-600" />
                           </div>
                         </div>
                         <div className="flex flex-1 justify-between items-center bg-primary/5 py-2 px-4 rounded-2xl border border-primary/20">
                           <div className="flex flex-col gap-0.5">
                             <span className="text-[9px] uppercase font-bold tracking-wider text-primary/70">Тривалість чергування</span>
                             <span className="text-foreground font-bold text-lg tabular-nums animate-pulse-slow">
                               {(() => {
                                 const now = new Date();
                                 const shiftStart = new Date(now);
                                 if (now.getHours() < 8) shiftStart.setDate(shiftStart.getDate() - 1);
                                 shiftStart.setHours(8, 0, 0, 0);
                                 
                                 const effectiveStart = new Date(firstStart) > shiftStart ? new Date(firstStart) : shiftStart;
                                 return formatDuration(effectiveStart.toISOString());
                               })()}
                             </span>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                             <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                           </div>
                         </div>
                         <div className="flex items-center">
                           <button 
                             onClick={stopShiftWorkSession}
                             className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                             title="Зупинити чергування цієї зміни"
                           >
                             <Square className="w-4 h-4 fill-white" />
                             Зупинити чергування
                           </button>
                         </div>
                       </>
                     );
                   })()}
                </div>
              ) : (
                <div className="flex w-full flex-col sm:flex-row items-center justify-between p-2 gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border border-dashed flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {!isAnyShiftOnDuty 
                          ? 'Чергування зупинено. Натисніть «Заступити», щоб розпочати чергування.' 
                          : 'Група очікує чергової зміни (інша зміна зараз на посту)'}
                      </span>
                      {finishedSessions.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mt-1">
                          Попередня зміна: {formatDuration(finishedSessions[0].startTime, finishedSessions[0].endTime)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={startShiftWorkSession}
                    disabled={isAnyShiftOnDuty && !isShiftOnDuty}
                    className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${
                      !isAnyShiftOnDuty || isShiftOnDuty
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer'
                        : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50 shadow-none'
                    }`}
                    title={isAnyShiftOnDuty ? "Інша зміна вже на чергуванні. Спочатку зупиніть її чергування або здійсніть передачу" : "Заступити на чергування"}
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Заступити
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shiftVisitors.map(guard => {
              const activeWorkSession = getActiveWorkSession(guard.id);
              const activeBreak = activeWorkSession?.restPeriods.find(r => !r.end);
              
              return (
                <div key={guard.id} className="bg-card rounded-3xl p-6 flex flex-col shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 max-w-full">
                      {(() => {
                        const customIcon = customIcons.find(icon => icon.id === guard.customIconId);
                        return (
                          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center overflow-hidden ${customIcon ? '' : 'bg-primary/10 text-primary'}`} style={{ backgroundColor: customIcon ? 'transparent' : (guard.color ? guard.color : undefined), color: (!customIcon && guard.color) ? '#fff' : undefined }}>
                            {customIcon ? <img src={customIcon.data} alt="guard icon" className="w-full h-full object-cover" /> : <ShieldAlert className="w-5 h-5" />}
                          </div>
                        );
                      })()}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">
                          {guard.category || 'Користувач'}
                        </span>
                        <span className="font-normal text-lg truncate" title={guard.name}>{formatNameAbbreviated(guard.name)}</span>
                        {guard.callsign && (
                          <div className="text-[11px] font-bold text-primary/80 uppercase tracking-widest leading-none mt-1">
                            {guard.callsign}
                          </div>
                        )}
                        <div className={`mt-2 self-start px-2 py-0.5 rounded-full text-[9px] font-normal uppercase tracking-wider whitespace-nowrap ${
                          activeWorkSession 
                            ? (activeBreak ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500')
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {activeWorkSession ? (activeBreak ? 'На відпочинку' : 'На чергуванні') : 'Поза черговою зміною'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {shiftVisitors.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-border rounded-3xl border-dashed">
                У цій черговій зміні поки що немає чергових користувачів. Додайте їх у налаштуваннях складу.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-16 text-center text-muted-foreground bg-card rounded-3xl shadow-sm">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Чергові зміни не знайдені</p>
          <p className="text-sm mt-2">Створіть нову чергову зміну для початку роботи</p>
          <button 
            onClick={openAddModal} 
            className="mt-6 px-6 py-2.5 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Створити чергову зміну
          </button>
        </div>
      )}

      {/* Modal Add/Edit Shift */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg p-6 sm:p-8 rounded-3xl shadow-xl border border-border flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-bold mb-6">{editingShiftId ? 'Налаштування чергової зміни' : 'Створити нову чергову зміну'}</h2>
            <form onSubmit={saveShift} className="flex flex-col flex-1 min-h-0">
              <div className="mb-6 shrink-0">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Назва чергової зміни</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={shiftNameInput}
                  onChange={e => setShiftNameInput(e.target.value)}
                  placeholder="Наприклад: Денна чергова зміна"
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                />
              </div>
              
              <div className="flex-1 min-h-0 flex flex-col">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Склад чергових</label>
                <div className="flex-1 overflow-y-auto border border-border rounded-xl bg-background/50 p-2 space-y-1 relative max-h-80">
                  {visitors.filter(v => (v.groupId === '3' || (v.group || '').toLowerCase().includes('охорон') || (v.group || '').toLowerCase().includes('рота') || (v.category || '').toLowerCase().includes('охорон') || (v.location || '').toLowerCase().includes('охорон')) && v.name !== 'Невідомий').length === 0 ? (
                    <p className="text-center text-muted-foreground p-4 text-xs">Немає користувачів з групи охорони або роти</p>
                  ) : visitors.filter(v => (v.groupId === '3' || (v.group || '').toLowerCase().includes('охорон') || (v.group || '').toLowerCase().includes('рота') || (v.category || '').toLowerCase().includes('охорон') || (v.location || '').toLowerCase().includes('охорон')) && v.name !== 'Невідомий').map(v => (
                    <label key={v.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50">
                      <input 
                        type="checkbox" 
                        checked={rosterSelection.includes(v.id)}
                        onChange={() => toggleRosterSelection(v.id)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary/50"
                      />
                      <div className="flex-1 flex flex-col items-start">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{v.category}</span>
                        <span className="font-medium text-sm">{formatNameAbbreviated(v.name)}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsShiftModalOpen(false)}
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
      {/* Modal Handover Shift */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm p-6 rounded-3xl shadow-xl border border-border">
            <h2 className="text-xl font-bold mb-6">Передати чергову зміну</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Ця дія завершить чергування всіх співробітників поточної чергової зміни та розпочне чергування для вибраної групи.
            </p>
            <form onSubmit={executeHandover}>
              <div className="mb-6">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Кому передати чергову зміну?</label>
                <select 
                  required
                  value={handoverTarget}
                  onChange={e => setHandoverTarget(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  <option key="default-handover" value="">Виберіть групу...</option>
                  {securityShifts.filter(s => s.id !== activeShift?.id).map((s, idx) => (
                    <option key={s.id ? `sec-shift-${s.id}` : `sec-shift-idx-${idx}`} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {handoverTarget && (() => {
                  const targetShift = securityShifts.find(s => s.id === handoverTarget);
                  if (!targetShift) return null;
                  const missingGuards = targetShift.visitorIds.filter(id => visitors.find(v => v.id === id)?.status !== 'in').map(id => formatNameAbbreviated(visitors.find(v => v.id === id)?.name || 'Невідомий'));
                  if (missingGuards.length > 0) {
                    return (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 space-y-1">
                        <p className="font-bold">Група не готова заступити на чергову зміну!</p>
                        <p>Наступні співробітники ще не зайшли:</p>
                        <ul className="list-disc pl-4 mt-1 opacity-80">
                          {missingGuards.map((name, i) => <li key={i}>{name}</li>)}
                        </ul>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600">
                      <p className="font-bold flex items-center gap-2">✓ Група готова заступити на чергову зміну</p>
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsHandoverModalOpen(false)}
                  title="Скасувати"
                  className="p-3 border border-border rounded-2xl hover:bg-muted text-muted-foreground transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <button 
                  type="submit"
                  title="Підтвердити"
                  disabled={!handoverTarget || (handoverTarget && securityShifts.find(s => s.id === handoverTarget)?.visitorIds.some(id => visitors.find(v => v.id === id)?.status !== 'in'))}
                  className="p-3 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete */}
      {shiftToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm p-6 rounded-3xl shadow-xl border border-border">
            <h2 className="text-xl font-bold mb-4 text-red-500">Видалити чергову зміну?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Ви впевнені, що хочете видалити цю чергову зміну? Цю дію неможливо скасувати.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShiftToDelete(null)}
                title="Скасувати"
                className="p-3 border border-border rounded-2xl hover:bg-muted text-muted-foreground transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <button 
                onClick={confirmDeleteShift}
                title="Видалити"
                className="p-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all"
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
