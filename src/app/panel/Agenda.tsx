"use client";
import { FormEvent, useEffect, useState } from "react";
import { rpc, decodeJwtSub, formatDateTime } from "./shared";

type Event = {
  id: number;
  title: string;
  description: string | null;
  event_type: "reunion" | "capacitacion" | "evento" | "otro";
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  created_by: string;
};

const TYPE_LABEL: Record<string, string> = { reunion: "Reunión", capacitacion: "Capacitación", evento: "Evento", otro: "Otro" };

export function Agenda({ token, close }: { token: string; close: () => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Event["event_type"]>("reunion");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
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

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const { SUPABASE_URL, SUPABASE_KEY } = await import("./shared");
      const response = await fetch(`${SUPABASE_URL}/rest/v1/agenda_events`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title, event_type: type, starts_at: new Date(startsAt).toISOString(), ends_at: endsAt ? new Date(endsAt).toISOString() : null, location: location || null, description: description || null, created_by: uid }),
      });
      if (!response.ok) throw new Error("No se pudo crear el evento.");
      setTitle(""); setLocation(""); setDescription(""); setStartsAt(""); setEndsAt(""); setShowForm(false);
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
        <button className="ext-btn full" style={{ marginBottom: 16 }} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "CANCELAR" : "+ NUEVO EVENTO"}
        </button>
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
            <button>GUARDAR EVENTO</button>
            {message && <p className="form-error">{message}</p>}
          </form>
        )}
        {loading && <p className="empty">Cargando agenda…</p>}
        {!loading && !events.length && <p className="empty">No hay eventos cargados.</p>}
        {Object.entries(grouped).map(([day, list]) => (
          <div key={day} style={{ marginBottom: 14 }}>
            <p className="eyebrow" style={{ margin: "10px 2px" }}>{day.toUpperCase()}</p>
            <div className="results">
              {list.map((ev) => (
                <div key={ev.id} className="voter-row" style={{ cursor: "default" }}>
                  <span className="avatar">{ev.event_type === "reunion" ? "🗓" : ev.event_type === "capacitacion" ? "🎓" : "📌"}</span>
                  <div>
                    <b>{ev.title}</b>
                    <p>
                      {TYPE_LABEL[ev.event_type]} · {formatDateTime(ev.starts_at)}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
