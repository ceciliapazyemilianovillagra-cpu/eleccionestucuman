"use client";
import { FormEvent, useEffect, useState } from "react";
import { Search, Check, Trash2 } from "lucide-react";
import { rpc, formatDateTime, SUPABASE_URL, SUPABASE_KEY } from "./shared";
import { Users } from "./Users";

type WhatsappRecipient = { id: number; name: string; phone: string; notify_reminder: boolean; notify_digest: boolean };

type LogRow = {
  id: number;
  occurred_at: string;
  source: "internal" | "external";
  module: string;
  action: string;
  actor_label: string | null;
  details: Record<string, unknown> | null;
};

type Claim = {
  id: string;
  status: string;
  voter_dni: string;
  voter_nombre: string;
  actor_dni: string;
  actor_nombre: string;
  owner_nombre: string | null;
  owner_internal_email: string | null;
};

const EXTERNAL_LINKS = [
  { path: "/movilizadores", label: "Movilizadores", desc: "Portal para movilizadores: carga de votantes y traslado el día de la elección." },
  { path: "/choferes", label: "Choferes", desc: "Portal para choferes: carga de votantes y traslado el día de la elección." },
  { path: "/fiscales", label: "Fiscales", desc: "Portal para fiscales de mesa: presencia, votantes en mesa y cierre de comicio." },
  { path: "/candidato", label: "Candidato", desc: "Sala de situación de la campaña: indicadores, mesas, traslados y alertas en vivo." },
];

function LinksSection() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="results">
      {EXTERNAL_LINKS.map((link) => {
        const url = origin ? `${origin}${link.path}` : link.path;
        return (
          <div key={link.path} className="link-row">
            <div>
              <b>{link.label}</b>
              <p>{link.desc}</p>
              <code>{url}</code>
            </div>
            <button className="ext-btn secondary" onClick={() => copy(url)} disabled={!origin}>
              {copied === url ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Check size={13} strokeWidth={3} /> COPIADO
                </span>
              ) : (
                "COPIAR"
              )}
            </button>
          </div>
        );
      })}
      <p className="ext-note">Compartí cada enlace con el grupo correspondiente. El acceso lo da igual el DNI + código único que se genera desde la ficha del votante en Padrón.</p>
    </div>
  );
}

function AlertsSection({ token }: { token: string }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  async function load(includeResolved: boolean) {
    setLoading(true);
    try {
      setClaims(await rpc(token, "list_voter_claims", { p_include_resolved: includeResolved }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(showResolved);
  }, [token, showResolved]);

  async function resolve(id: string) {
    await rpc(token, "resolve_voter_claim", { p_id: id }).catch(() => {});
    load(showResolved);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <label className="module-checks" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} style={{ width: "auto" }} />
          <span>Mostrar también resueltos</span>
        </label>
        <button className="ext-btn secondary" onClick={() => load(showResolved)} disabled={loading}>
          {loading ? "…" : "ACTUALIZAR"}
        </button>
      </div>
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !claims.length && <p className="empty">No hay reclamos {showResolved ? "" : "pendientes"}.</p>}
      <div className="log-list">
        {claims.map((c) => (
          <div key={c.id} className="log-row" style={{ alignItems: "flex-start" }}>
            <span className={`badge ${c.status === "unread" ? "danger" : "ok"}`}>{c.status === "unread" ? "Pendiente" : "Resuelto"}</span>
            <div>
              <b>
                {c.actor_nombre} (DNI {c.actor_dni}) reclama a {c.voter_nombre} (DNI {c.voter_dni})
              </b>
              <p>Cargado por {c.owner_nombre || c.owner_internal_email || "un interno"}</p>
              {c.status === "unread" && (
                <button className="ext-btn secondary" style={{ marginTop: 8 }} onClick={() => resolve(c.id)}>
                  MARCAR RESUELTO
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsSection({ token }: { token: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  function load() {
    setLoading(true);
    rpc(token, "list_activity_log", { p_limit: 200 })
      .then(setRows)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token]);

  const filtered = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return r.module.includes(q) || r.action.includes(q) || (r.actor_label ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <label className="users-search" style={{ flex: 1, marginBottom: 0 }}>
          <Search size={16} strokeWidth={2} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por módulo, acción o usuario" />
        </label>
        <button className="ext-btn secondary" onClick={load} disabled={loading}>
          {loading ? "…" : "ACTUALIZAR"}
        </button>
      </div>
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !filtered.length && <p className="empty">Sin registros.</p>}
      <div className="log-list">
        {filtered.map((r) => (
          <div key={r.id} className="log-row">
            <span className={`badge ${r.source === "internal" ? "ok" : "neutral"}`}>{r.source === "internal" ? "Interno" : "Externo"}</span>
            <div>
              <b>
                {r.module} · {r.action}
              </b>
              <p>
                {r.actor_label || "—"} · {formatDateTime(r.occurred_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function RemindersSection({ token }: { token: string }) {
  const [rows, setRows] = useState<WhatsappRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyReminder, setNotifyReminder] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testing, setTesting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_recipients?select=*&order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      });
      setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function addRecipient(e: FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (!name.trim() || cleanPhone.length < 8) return;
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_recipients`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: cleanPhone, notify_reminder: notifyReminder, notify_digest: notifyDigest }),
    });
    setName(""); setPhone(""); setNotifyReminder(true); setNotifyDigest(true);
    load();
  }

  async function togglePref(r: WhatsappRecipient, field: "notify_reminder" | "notify_digest") {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_recipients?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !r[field] }),
    });
    load();
  }

  async function remove(r: WhatsappRecipient) {
    if (!window.confirm(`¿Quitar a ${r.name} de los recordatorios?`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_recipients?id=eq.${r.id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    load();
  }

  async function sendTest() {
    const cleanPhone = testPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 8) return;
    setTesting(true);
    setTestMsg("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agenda-whatsapp`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", phone: cleanPhone }),
      });
      const data = await res.json();
      setTestMsg(res.ok && data.ok ? "Mensaje de prueba enviado correctamente." : `Error: ${JSON.stringify(data.json || data.error || data)}`);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "No se pudo enviar la prueba.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <p className="ext-note" style={{ marginTop: 0 }}>
        Estos números reciben por WhatsApp el recordatorio de cada evento (2hs antes) y el resumen de la agenda del día (7am), si hay eventos cargados. Usá el formato con código de país, sin espacios ni "+" (ej: 5493811234567).
      </p>
      <form className="search-card" onSubmit={addRecipient} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <input placeholder="Teléfono (ej: 5493811234567)" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={notifyReminder && notifyDigest} onChange={(e) => { setNotifyReminder(e.target.checked); setNotifyDigest(e.target.checked); }} />
            <span>Todo</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={notifyDigest} onChange={(e) => setNotifyDigest(e.target.checked)} />
            <span>Resumen 7am</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={notifyReminder} onChange={(e) => setNotifyReminder(e.target.checked)} />
            <span>Recordatorio 2hs antes</span>
          </label>
        </div>
        <button className="ext-btn full">AGREGAR</button>
      </form>
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !rows.length && <p className="empty">No hay números cargados todavía.</p>}
      <div className="results" style={{ marginBottom: 20 }}>
        {rows.map((r) => (
          <div key={r.id} className="voter-row" style={{ cursor: "default", flexWrap: "wrap" }}>
            <span className="avatar">{r.name.slice(0, 1).toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 140 }}>
              <b>{r.name}</b>
              <p>{r.phone}</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginRight: 8 }} onClick={(e) => e.stopPropagation()}>
              <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={r.notify_digest} onChange={() => togglePref(r, "notify_digest")} />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>7am</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={r.notify_reminder} onChange={() => togglePref(r, "notify_reminder")} />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>2hs antes</span>
              </label>
            </div>
            <button className="ext-btn secondary" onClick={() => remove(r)} style={{ padding: "8px 10px" }}>
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
      <div className="search-card">
        <b style={{ display: "block", marginBottom: 8 }}>Probar el envío</b>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input placeholder="Tu número de WhatsApp" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button className="ext-btn secondary" onClick={sendTest} disabled={testing}>
            {testing ? "ENVIANDO…" : "ENVIAR PRUEBA"}
          </button>
        </div>
        {testMsg && <p className="ext-note">{testMsg}</p>}
      </div>
    </div>
  );
}

const TABS = [
  { key: "usuarios", label: "USUARIOS" },
  { key: "alertas", label: "ALERTAS" },
  { key: "links", label: "ENLACES" },
  { key: "recordatorios", label: "RECORDATORIOS" },
  { key: "logs", label: "LOGS" },
] as const;
export type ConfigTabKey = (typeof TABS)[number]["key"];

export function Configuracion({ token, close, initialTab }: { token: string; close: () => void; initialTab?: ConfigTabKey }) {
  const [tab, setTab] = useState<ConfigTabKey>(initialTab ?? "usuarios");

  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>CONFIGURACIÓN</h1>
        </div>
        <img src="/icon.svg" alt="Logo" />
      </header>
      <section className="padron-content">
        <div className="config-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "usuarios" && <Users token={token} />}
        {tab === "alertas" && <AlertsSection token={token} />}
        {tab === "links" && <LinksSection />}
        {tab === "recordatorios" && <RemindersSection token={token} />}
        {tab === "logs" && <LogsSection token={token} />}
      </section>
    </main>
  );
}
