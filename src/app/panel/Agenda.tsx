"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, GraduationCap, Flag, Paperclip, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { rpc, decodeJwtSub, formatDateTime, SUPABASE_URL, SUPABASE_KEY } from "./shared";
import { ScrollTopButton } from "./ScrollTopButton";
import { useRealtime } from "./realtime";

type Event = {
  id: number;
  title: string;
  description: string | null;
  event_type: "reunion" | "capacitacion" | "evento" | "otro";
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  created_by: string;
  reminder_enabled: boolean;
  reminder_sent_at?: string | null;
  digest_sent_at?: string | null;
};

const TYPE_LABEL: Record<string, string> = { reunion: "Reunión", capacitacion: "Capacitación", evento: "Evento", otro: "Otro" };
const TYPE_ICON: Record<string, typeof CalendarDays> = { reunion: CalendarDays, capacitacion: GraduationCap, evento: Flag, otro: Paperclip };
const TYPE_COLOR: Record<string, string> = { reunion: "#1478b8", capacitacion: "#28b88a", evento: "#e04b3f", otro: "#8b5cf6" };
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function TYPE_ICON_COMPONENT({ type }: { type: string }) {
  const Icon = TYPE_ICON[type] ?? CalendarDays;
  return (
    <span className="avatar" style={{ background: TYPE_COLOR[type] ?? "#1478b8", color: "#fff" }}>
      <Icon size={16} strokeWidth={2} />
    </span>
  );
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function keyToLocalDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ReminderBadge({ ev }: { ev: Event }) {
  if (!ev.reminder_enabled) return null;
  const sent = ev.reminder_sent_at || ev.digest_sent_at;
  return (
    <span title={sent ? "Recordatorio de WhatsApp enviado" : "Recordatorio programado"} style={{ marginLeft: 6, color: sent ? "#147354" : "#8a5407", verticalAlign: "middle" }}>
      <MessageCircle size={13} strokeWidth={2.5} style={{ display: "inline" }} />
    </span>
  );
}

function MonthCalendar({ events, month, setMonth, selected, setSelected }: { events: Event[]; month: Date; setMonth: (d: Date) => void; selected: string | null; setSelected: (k: string | null) => void }) {
  const byDay = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (const ev of events) {
      const k = dateKey(new Date(ev.starts_at));
      (map[k] ||= []).push(ev);
    }
    return map;
  }, [events]);

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  const cells: (Date | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, m, i + 1))];

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button type="button" onClick={() => setMonth(new Date(year, m - 1, 1))}>
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        <b>{month.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</b>
        <button type="button" onClick={() => setMonth(new Date(year, m + 1, 1))}>
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>
      <div className="calendar-grid calendar-weekdays">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = dateKey(d);
          const has = byDay[k]?.length;
          return (
            <button key={i} type="button" className={`calendar-day ${k === todayKey ? "today" : ""} ${selected === k ? "selected" : ""}`} onClick={() => setSelected(selected === k ? null : k)}>
              {d.getDate()}
              {has ? <span className="calendar-dot" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditEventSheet({ event, token, close }: { event: Event; token: string; close: () => void }) {
  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState<Event["event_type"]>(event.event_type);
  const [startsAt, setStartsAt] = useState(toLocalInputValue(event.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInputValue(event.ends_at));
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(event.reminder_enabled);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/agenda_events?id=eq.${event.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title, event_type: type,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          location: location || null, description: description || null,
          reminder_enabled: reminderEnabled,
        }),
      });
      if (!response.ok) throw new Error("No se pudieron guardar los cambios.");
      close();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`¿Borrar el evento "${event.title}"?`)) return;
    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/agenda_events?id=eq.${event.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("No se pudo borrar el evento.");
      close();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo borrar el evento.");
      setDeleting(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <form className="voter-sheet edit-user-sheet" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-title">
          <div>
            <small>EDITAR EVENTO</small>
            <h2>{event.title}</h2>
          </div>
          <button type="button" onClick={close}>×</button>
        </div>
        <label>
          Título
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as Event["event_type"])}>
            <option value="reunion">Reunión</option>
            <option value="capacitacion">Capacitación</option>
            <option value="evento">Evento</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label>
          Inicio
          <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label>
          Fin (opcional)
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <label>
          Lugar
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label>
          Descripción
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row", marginTop: 14 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
          Enviar recordatorio por WhatsApp (2hs antes + resumen 7am)
        </label>
        <button disabled={saving}>{saving ? "GUARDANDO…" : "GUARDAR CAMBIOS"}</button>
        <button type="button" className="ext-btn warn full" style={{ marginTop: 10 }} onClick={remove} disabled={deleting}>
          {deleting ? "BORRANDO…" : "BORRAR EVENTO"}
        </button>
        {message && <p className="form-error">{message}</p>}
      </form>
    </div>
  );
}

export function Agenda({ token, close }: { token: string; close: () => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"lista" | "calendario">("calendario");
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Event["event_type"]>("reunion");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Event | null>(null);
  const uid = decodeJwtSub(token);

  async function load() {
    setLoading(true);
    try {
      const data = await rpc(token, "list_upcoming_agenda", { p_days: 365 });
      setEvents((data || []).sort((a: Event, b: Event) => a.starts_at.localeCompare(b.starts_at)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  useRealtime(["agenda_events"], token, load);

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/agenda_events`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title, event_type: type, starts_at: new Date(startsAt).toISOString(), ends_at: endsAt ? new Date(endsAt).toISOString() : null, location: location || null, description: description || null, reminder_enabled: reminderEnabled, created_by: uid }),
      });
      if (!response.ok) throw new Error("No se pudo crear el evento.");
      setTitle(""); setLocation(""); setDescription(""); setStartsAt(""); setEndsAt(""); setReminderEnabled(true); setShowForm(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo crear el evento.");
    }
  }

  const grouped = events.reduce<Record<string, Event[]>>((acc, ev) => {
    const day = new Date(ev.starts_at).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    (acc[day] ||= []).push(ev);
    return acc;
  }, {});

  const dayEvents = selectedDay ? events.filter((ev) => dateKey(new Date(ev.starts_at)) === selectedDay) : null;

  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>AGENDA</h1>
        </div>
        <img src="/icon.svg" alt="Logo" />
      </header>
      <section className="padron-content">
        <div className="config-tabs" style={{ marginBottom: 14 }}>
          <button className={view === "calendario" ? "active" : ""} onClick={() => setView("calendario")}>CALENDARIO</button>
          <button className={view === "lista" ? "active" : ""} onClick={() => setView("lista")}>LISTA</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <button className="ext-btn full" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "CANCELAR" : "+ NUEVO EVENTO"}
          </button>
          <button className="ext-btn secondary" onClick={load} disabled={loading}>
            {loading ? "…" : "ACTUALIZAR"}
          </button>
        </div>
        {showForm && (
          <form className="search-card" onSubmit={createEvent} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <label>
              Título
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Tipo
              <select value={type} onChange={(e) => setType(e.target.value as Event["event_type"])}>
                <option value="reunion">Reunión</option>
                <option value="capacitacion">Capacitación</option>
                <option value="evento">Evento</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label>
              Inicio
              <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label>
              Fin (opcional)
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
            <label>
              Lugar
              <input value={location} onChange={(e) => setLocation(e.target.value)} />
            </label>
            <label>
              Descripción
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
              Enviar recordatorio por WhatsApp
            </label>
            <button>GUARDAR EVENTO</button>
            {message && <p className="form-error">{message}</p>}
          </form>
        )}
        {loading && <p className="empty">Cargando agenda…</p>}

        {!loading && view === "calendario" && (
          <>
            <MonthCalendar events={events} month={month} setMonth={setMonth} selected={selectedDay} setSelected={setSelectedDay} />
            <p className="eyebrow" style={{ margin: "16px 2px 8px" }}>
              {selectedDay ? keyToLocalDate(selectedDay).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase() : "TODOS LOS EVENTOS DEL MES"}
            </p>
            <div className="results">
              {(dayEvents ?? events.filter((ev) => {
                const d = new Date(ev.starts_at);
                return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
              })).map((ev) => (
                <button key={ev.id} className="voter-row" onClick={() => setEditing(ev)}>
                  <TYPE_ICON_COMPONENT type={ev.event_type} />
                  <div>
                    <b>
                      {ev.title}
                      <ReminderBadge ev={ev} />
                    </b>
                    <p>
                      {TYPE_LABEL[ev.event_type]} · {formatDateTime(ev.starts_at)}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </p>
                  </div>
                  <span>›</span>
                </button>
              ))}
              {(dayEvents ?? []).length === 0 && selectedDay && <p className="empty">Sin eventos ese día.</p>}
            </div>
          </>
        )}

        {!loading && view === "lista" && (
          <>
            {!events.length && <p className="empty">No hay eventos cargados.</p>}
            {Object.entries(grouped).map(([day, list]) => (
              <div key={day} style={{ marginBottom: 14 }}>
                <p className="eyebrow" style={{ margin: "10px 2px" }}>{day.toUpperCase()}</p>
                <div className="results">
                  {list.map((ev) => (
                    <button key={ev.id} className="voter-row" onClick={() => setEditing(ev)}>
                      <TYPE_ICON_COMPONENT type={ev.event_type} />
                      <div>
                        <b>
                          {ev.title}
                          <ReminderBadge ev={ev} />
                        </b>
                        <p>
                          {TYPE_LABEL[ev.event_type]} · {formatDateTime(ev.starts_at)}
                          {ev.location ? ` · ${ev.location}` : ""}
                        </p>
                      </div>
                      <span>›</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </section>
      {editing && (
        <EditEventSheet
          event={editing}
          token={token}
          close={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      <ScrollTopButton />
    </main>
  );
}
