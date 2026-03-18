import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Clock, Copy, CheckCircle2, Wifi,
  History, ChevronLeft, ChevronDown, ChevronUp, Shield, Send
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ZoneLog {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface StationLog {
  id: string;
  name: string;
  zones: ZoneLog[];
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function getUserId(): string {
  const key = 'patrol_user_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(key, id);
  }
  return id;
}

function getShiftId(date = new Date()): string {
  const h = date.getHours();
  if (h >= 6 && h < 18) {
    return `${date.toISOString().split('T')[0]}-D`;
  } else if (h >= 18) {
    return `${date.toISOString().split('T')[0]}-N`;
  } else {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return `${d.toISOString().split('T')[0]}-N`;
  }
}

function getShiftMeta(shiftId: string): { type: string; date: string; times: string } {
  const isNight = shiftId[11] === 'N';
  const dateStr = shiftId.slice(0, 10);
  const date = new Date(dateStr + 'T12:00:00');
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  if (isNight) {
    return {
      type: 'Night Shift',
      date: fmtDate(date),
      times: '18:00 – 06:00',
    };
  }
  return {
    type: 'Day Shift',
    date: fmtDate(date),
    times: '06:00 – 18:00',
  };
}

function getShiftLabel(shiftId: string): string {
  const { type, date, times } = getShiftMeta(shiftId);
  return `${type}  ·  ${date}  ·  ${times}`;
}

function storageKey(userId: string, shiftId: string): string {
  return `patrol_log_${userId}_${shiftId}`;
}

const USER_ID = getUserId();
const SHIFT_KEY_PREFIX = `patrol_log_${USER_ID}_`;
const ACTIVE_SHIFT_KEY = `patrol_active_shift_${USER_ID}`;

function getOrCreateActiveShiftId(): string {
  let id = localStorage.getItem(ACTIVE_SHIFT_KEY);
  if (!id) {
    id = getShiftId();
    localStorage.setItem(ACTIVE_SHIFT_KEY, id);
  }
  return id;
}

function clearActiveShiftId() {
  localStorage.removeItem(ACTIVE_SHIFT_KEY);
}

function createNewShiftId(prevShiftId: string): string {
  const base = getShiftId();
  if (base !== prevShiftId && !prevShiftId.startsWith(base)) return base;
  let n = 2;
  while (true) {
    const candidate = `${base}-${n}`;
    if (!localStorage.getItem(storageKey(USER_ID, candidate))) return candidate;
    n++;
  }
}

function blankStations(): StationLog[] {
  return [{ id: 's1', name: '', zones: [{ id: 'z1', name: 'Zone1', startTime: '', endTime: '' }] }];
}

function loadShift(shiftId: string): StationLog[] {
  try {
    const raw = localStorage.getItem(storageKey(USER_ID, shiftId));
    if (!raw) return blankStations();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : blankStations();
  } catch {
    return blankStations();
  }
}

function saveShift(shiftId: string, data: StationLog[]) {
  try { localStorage.setItem(storageKey(USER_ID, shiftId), JSON.stringify(data)); } catch {}
}

function deleteShift(shiftId: string) {
  localStorage.removeItem(storageKey(USER_ID, shiftId));
}

function getAllPastShifts(activeShiftId: string): { shiftId: string; stations: StationLog[] }[] {
  const results: { shiftId: string; stations: StationLog[] }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(SHIFT_KEY_PREFIX)) continue;
    const shiftId = key.slice(SHIFT_KEY_PREFIX.length);
    if (shiftId === activeShiftId) continue;
    if (!/^\d{4}-\d{2}-\d{2}-[DN](-\d+)?$/.test(shiftId)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const stations = JSON.parse(raw);
      if (Array.isArray(stations)) results.push({ shiftId, stations });
    } catch {}
  }
  return results.sort((a, b) => b.shiftId.localeCompare(a.shiftId));
}

function calcDuration(start: string, end: string): string {
  if (!start || !end || start.length < 5 || end.length < 5) return '--';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return '--';
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 1440;
  return diff >= 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : `${diff}m`;
}

function generateLogText(stations: StationLog[]): string {
  return stations.map(s => {
    const zones = s.zones.map(z => `${z.name} ${z.startTime || '--:--'} - ${z.endTime || '--:--'}`).join('\n');
    return `Station: ${s.name || '[Station Name]'}\n${zones}`;
  }).join('\n\n').trim();
}

// ─── Shared Components ────────────────────────────────────────────────────────

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const base = size === 'sm'
    ? 'text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all'
    : 'text-[11px] flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-all';
  return (
    <button onClick={handleCopy} className={`${base} ${
      copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
             : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'}`}>
      {copied ? <CheckCircle2 size={size === 'sm' ? 14 : 12} /> : <Copy size={size === 'sm' ? 14 : 12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ─── Shift Log (current shift editor) ────────────────────────────────────────

function ShiftLogView({ shiftId, onSubmit }: { shiftId: string; onSubmit: () => void }) {
  const [stations, setStations] = useState<StationLog[]>(() => loadShift(shiftId));
  const [saved, setSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    saveShift(shiftId, stations);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [stations, shiftId]);

  const addStation = () => setStations(prev => [
    ...prev, { id: crypto.randomUUID(), name: '', zones: [{ id: crypto.randomUUID(), name: 'Zone1', startTime: '', endTime: '' }] }
  ]);
  const removeStation = (id: string) => setStations(prev => prev.filter(s => s.id !== id));
  const updateStation = (id: string, name: string) => setStations(prev => prev.map(s => s.id === id ? { ...s, name } : s));

  const addZone = (stationId: string) => setStations(prev => prev.map(s => s.id !== stationId ? s : {
    ...s, zones: [...s.zones, { id: crypto.randomUUID(), name: `Zone${s.zones.length + 1}`, startTime: '', endTime: '' }]
  }));
  const updateZone = (sid: string, zid: string, field: keyof ZoneLog, value: string) =>
    setStations(prev => prev.map(s => s.id !== sid ? s : {
      ...s, zones: s.zones.map(z => z.id === zid ? { ...z, [field]: value } : z)
    }));

  const setTimeNow = (sid: string, zid: string, field: 'startTime' | 'endTime') => {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    updateZone(sid, zid, field, t);
  };

  const handleTimeInput = (sid: string, zid: string, field: 'startTime' | 'endTime', value: string) => {
    if (!value) { updateZone(sid, zid, field, ''); return; }
    const digits = value.replace(/\D/g, '');
    if (digits.length > 4) return;
    updateZone(sid, zid, field, digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
  };

  const handleSubmit = () => {
    saveShift(shiftId, stations);
    setShowConfirm(false);
    onSubmit();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <span className={`flex items-center gap-1 text-xs transition-all ${saved ? 'text-emerald-400' : 'text-zinc-600'}`}>
          <Wifi size={11} />{saved ? 'Saved' : 'Offline'}
        </span>
      </div>

      {stations.map((station, sIdx) => (
        <div key={station.id} className="bg-zinc-900 p-5 md:p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <label className="block text-sm font-medium text-zinc-300 ml-1">
                Station {stations.length > 1 ? sIdx + 1 : ''}
              </label>
              <input
                type="text" value={station.name}
                onChange={e => updateStation(station.id, e.target.value)}
                placeholder="e.g. Freezone"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>
            {stations.length > 1 && (
              <button onClick={() => removeStation(station.id)}
                className="mt-7 text-zinc-500 hover:text-red-400 p-2.5 rounded-xl hover:bg-red-500/10 transition-colors">
                <Trash2 size={18} />
              </button>
            )}
          </div>

          <div className="h-px bg-zinc-800/50" />

          <div className="space-y-4">
            <div className="flex items-center justify-between ml-1">
              <h2 className="text-sm font-medium text-zinc-300">Patrol Zones</h2>
              <button onClick={() => addZone(station.id)}
                className="text-xs flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 font-medium">
                <Plus size={14} /> Add Zone
              </button>
            </div>

            <div className="space-y-3">
              {station.zones.map(zone => (
                <div key={zone.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4 transition-all hover:border-zinc-700">
                  <div className="flex items-center gap-2">
                    <input
                      type="text" value={zone.name}
                      onChange={e => updateZone(station.id, zone.id, 'name', e.target.value)}
                      className="bg-transparent border-none text-base font-medium text-zinc-200 focus:outline-none flex-1 placeholder:text-zinc-700"
                      placeholder="Zone Name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {(['startTime', 'endTime'] as const).map(field => (
                      <div key={field} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-medium text-zinc-500">{field === 'startTime' ? 'Start' : 'End'}</label>
                          <button onClick={() => setTimeNow(station.id, zone.id, field)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 uppercase tracking-wider font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            <Clock size={10} /> Now
                          </button>
                        </div>
                        <input
                          type="text" inputMode="numeric" placeholder="00:00" maxLength={5}
                          value={zone[field]}
                          onChange={e => handleTimeInput(station.id, zone.id, field, e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-center tracking-widest font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end items-center pt-3 border-t border-zinc-800/50">
                    <div className="text-xs text-zinc-500 flex items-center gap-1.5 bg-zinc-900/50 px-2.5 py-1.5 rounded-md border border-zinc-800/30">
                      <Clock size={12} />
                      Duration: <span className="text-zinc-300 font-medium">{calcDuration(zone.startTime, zone.endTime)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <button onClick={addStation}
        className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all flex items-center justify-center gap-2 font-medium">
        <Plus size={18} /> Add Another Station
      </button>

      <div className="bg-zinc-900 p-5 md:p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between ml-1">
          <h2 className="text-sm font-medium text-zinc-300">Preview</h2>
          <CopyButton text={generateLogText(stations)} />
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
          <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
            {generateLogText(stations)}
          </pre>
        </div>
      </div>

      {/* Submit / close patrol */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg">
          <Send size={18} /> Submit Patrol Log
        </button>
      ) : (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-4">
          <p className="text-sm text-zinc-200 font-medium text-center">Close this patrol and move it to history?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-sm font-medium">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors text-sm font-semibold">
              Yes, Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ entry, onDelete }: { entry: { shiftId: string; stations: StationLog[] }; onDelete: (shiftId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const totalZones = entry.stations.reduce((n, s) => n + s.zones.length, 0);
  const logText = generateLogText(entry.stations);
  const hasData = entry.stations.some(s => s.name || s.zones.some(z => z.startTime || z.endTime));

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const confirmDeleteAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(entry.shiftId);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-indigo-400">
            {getShiftMeta(entry.shiftId).type}
          </p>
          <p className="text-sm font-semibold text-zinc-100 truncate">{getShiftMeta(entry.shiftId).date}</p>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="font-mono">{getShiftMeta(entry.shiftId).times}</span>
            <span className="flex items-center gap-1">
              <Shield size={11} /> {entry.stations.length} stn
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} /> {totalZones} zone{totalZones !== 1 ? 's' : ''}
            </span>
            {!hasData && <span className="text-zinc-600 italic">No data</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasData && <CopyButton text={logText} size="xs" />}
          {!confirmDelete ? (
            <button
              onClick={handleDelete}
              className="text-zinc-600 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 transition-colors">
              <Trash2 size={15} />
            </button>
          ) : (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={cancelDelete} className="text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
                No
              </button>
              <button onClick={confirmDeleteAction} className="text-xs px-2 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white transition-colors">
                Delete
              </button>
            </div>
          )}
          <span className="text-zinc-500">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800">
          {entry.stations.map((station, idx) => (
            <div key={station.id} className={`px-5 py-4 ${idx < entry.stations.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
              <p className="text-sm font-semibold text-zinc-200 mb-3">
                {station.name || <span className="text-zinc-600 italic">Unnamed Station</span>}
              </p>
              <div className="space-y-2">
                {station.zones.map(zone => (
                  <div key={zone.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium w-1/3 truncate">{zone.name}</span>
                    <span className="font-mono text-zinc-300">
                      {zone.startTime || '--:--'} – {zone.endTime || '--:--'}
                    </span>
                    <span className="text-zinc-500 w-16 text-right">
                      {calcDuration(zone.startTime, zone.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="px-5 pb-5 pt-3 bg-zinc-950/40">
            <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">{logText}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────────────────────

function HistoryView({ activeShiftId }: { activeShiftId: string }) {
  const [shifts, setShifts] = useState(() => getAllPastShifts(activeShiftId));

  const handleDelete = (shiftId: string) => {
    deleteShift(shiftId);
    setShifts(prev => prev.filter(s => s.shiftId !== shiftId));
  };

  if (shifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <History size={24} className="text-zinc-600" />
        </div>
        <p className="text-zinc-400 text-sm font-medium">No previous patrols yet</p>
        <p className="text-zinc-600 text-xs max-w-xs">
          Submitted patrols will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shifts.map(entry => (
        <HistoryCard key={entry.shiftId} entry={entry} onDelete={handleDelete} />
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<'log' | 'history'>('log');
  const [activeShiftId, setActiveShiftId] = useState<string>(getOrCreateActiveShiftId);

  const handleSubmit = () => {
    const newId = createNewShiftId(activeShiftId);
    clearActiveShiftId();
    localStorage.setItem(ACTIVE_SHIFT_KEY, newId);
    setActiveShiftId(newId);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      <div className="max-w-md mx-auto px-4 pb-24">
        {/* Header */}
        <header className="pt-6 pb-4 space-y-4">
          {/* Logo bar */}
          <div className="flex items-center justify-between">
            <img
              src="/falcon-samsic-nobg.png"
              alt="Falcon Samsic Security Services"
              className="h-14 w-auto object-contain brightness-0 invert"
            />
            <div className="flex flex-col items-end gap-1">
              <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-medium">Client</p>
              <img
                src="/metro.png"
                alt="Metro"
                className="h-9 w-auto object-contain"
              />
            </div>
          </div>

          {/* Title + History */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-50">Patrol Log</h1>
              <p className="text-[10px] text-zinc-500 tracking-wide mt-0.5">Security Operations</p>
            </div>
            <button
              onClick={() => setView(v => v === 'log' ? 'history' : 'log')}
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border font-medium transition-all ${
                view === 'history'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
              }`}>
              {view === 'history' ? (
                <><ChevronLeft size={14} /> Current Patrol</>
              ) : (
                <><History size={14} /> History</>
              )}
            </button>
          </div>

          {/* Shift badge */}
          <div className={`rounded-xl border px-4 py-3 ${
            view === 'history' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-indigo-500/10 border-indigo-500/25'
          }`}>
            {view === 'log' ? (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">
                    {getShiftMeta(activeShiftId).type}
                  </p>
                  <p className="text-sm font-semibold text-zinc-100">{getShiftMeta(activeShiftId).date}</p>
                  <p className="text-xs font-mono text-zinc-400">{getShiftMeta(activeShiftId).times}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.4)] animate-pulse" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <History size={14} className="text-zinc-500" />
                <p className="text-sm text-zinc-400">Patrol history</p>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        {view === 'log'
          ? <ShiftLogView key={activeShiftId} shiftId={activeShiftId} onSubmit={handleSubmit} />
          : <HistoryView activeShiftId={activeShiftId} />
        }
      </div>
    </div>
  );
}
