"use client";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Camera, Check } from "lucide-react";
import { callFn } from "./api";
import { useGeolocation } from "./useGeolocation";
import { describeItem, useOfflineQueue } from "./offlineQueue";

type EscuelaEstado = { fiscal_general_padron_id: number; fiscal_general_nombre: string; presente: boolean; mesas_cerradas: number };
type EquipoMiembro = { padron_id: number; nombre: string; rol: string; presente: boolean; mesa: string | null; cerrada: boolean };
type FiscalDashboard =
  | { role: "coordinador_circuito"; circuito: string | null; escuelas: EscuelaEstado[] }
  | { role: "fiscal_general"; circuito: string | null; equipo: EquipoMiembro[] }
  | { role: null };

const ROL_LABEL: Record<string, string> = { fiscal_mesa: "Fiscal de mesa", fiscal_suplente: "Fiscal suplente" };

function FiscalDashboardPanel({ token, roles }: { token: string; roles: string[] }) {
  const [data, setData] = useState<FiscalDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const d = await callFn("comicios", token, { action: "fiscal_dashboard" });
    setData(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  if (!roles.includes("coordinador_circuito") && !roles.includes("fiscal_general")) return null;

  return (
    <section className="ext-card">
      <h2>{data?.role === "coordinador_circuito" ? "Mi circuito" : "Mi escuela"}</h2>
      <p className="ext-hint">
        {data?.role === "coordinador_circuito"
          ? "Estado de los fiscales generales de tu circuito."
          : "Estado de los fiscales de mesa y suplentes a tu cargo."}
      </p>
      <button type="button" className="ext-btn secondary" style={{ marginBottom: 10 }} onClick={load} disabled={loading}>
        {loading ? "…" : "ACTUALIZAR"}
      </button>
      {loading && <p className="ext-note">Cargando…</p>}
      {!loading && data?.role === "coordinador_circuito" && (
        <div className="log-list">
          {!data.escuelas.length && <p className="ext-empty">Todavía no hay fiscales generales cargados en tu circuito.</p>}
          {data.escuelas.map((e) => (
            <div key={e.fiscal_general_padron_id} className="log-row" style={{ cursor: "default" }}>
              <span className={`badge sm ${e.presente ? "ok" : "neutral"}`}>{e.presente ? "Presente" : "Sin marcar"}</span>
              <div>
                <b>{e.fiscal_general_nombre}</b>
                <p>{e.mesas_cerradas} mesa{e.mesas_cerradas === 1 ? "" : "s"} cerrada{e.mesas_cerradas === 1 ? "" : "s"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && data?.role === "fiscal_general" && (
        <div className="log-list">
          {!data.equipo.length && <p className="ext-empty">Todavía no tenés fiscales de mesa ni suplentes a cargo.</p>}
          {data.equipo.map((m) => (
            <div key={m.padron_id} className="log-row" style={{ cursor: "default" }}>
              <span className={`badge sm ${m.cerrada ? "ok" : m.presente ? "neutral" : "danger"}`}>{m.cerrada ? "Mesa cerrada" : m.presente ? "Presente" : "Sin marcar"}</span>
              <div>
                <b>{m.nombre}</b>
                <p>
                  {ROL_LABEL[m.rol] ?? m.rol} {m.mesa ? `· Mesa ${m.mesa}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function FiscalSection({ token, roles, candidatoNombre, ownerKey }: { token: string; roles: string[]; candidatoNombre?: string | null; ownerKey: string }) {
  const { items: pending, flushing, submit, flush, discard } = useOfflineQueue(token, ownerKey);
  const [mesa, setMesa] = useState("");
  const [presentOk, setPresentOk] = useState(false);
  const [presentMsg, setPresentMsg] = useState("");
  const { getLocation, locating, geoError } = useGeolocation();

  const [voterCount, setVoterCount] = useState("");
  const [turnoutMsg, setTurnoutMsg] = useState("");
  const [turnoutHistory, setTurnoutHistory] = useState<string[]>([]);

  const [nagleVotes, setNagleVotes] = useState("");
  const [actaFile, setActaFile] = useState<File | null>(null);
  const [closeMsg, setCloseMsg] = useState("");
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);

  async function markPresent() {
    if (!mesa.trim()) {
      setPresentMsg("Ingresá el número de mesa.");
      return;
    }
    const point = await getLocation();
    const r = await submit("mark_present", { mesa, lat: point?.lat, lng: point?.lng, accuracy: point?.accuracy });
    if (r.status === "sent") {
      setPresentOk(true);
      setPresentMsg("Presencia registrada con ubicación y hora.");
    } else if (r.status === "queued") {
      setPresentOk(true);
      setPresentMsg("Sin señal: tu presencia quedó guardada en el teléfono y se envía sola cuando vuelva la conexión.");
    } else {
      setPresentMsg(r.error || "No se pudo registrar.");
    }
  }

  async function reportTurnout(e: FormEvent) {
    e.preventDefault();
    if (!mesa.trim()) {
      setTurnoutMsg("Ingresá el número de mesa arriba.");
      return;
    }
    const r = await submit("report_turnout", { mesa, voter_count: Number(voterCount) });
    if (r.status === "error") {
      setTurnoutMsg(r.error || "No se pudo enviar.");
      return;
    }
    setTurnoutMsg("");
    const suffix = r.status === "queued" ? " (pendiente de envío)" : "";
    setTurnoutHistory((prev) => [`${voterCount} votantes — ${new Date().toLocaleTimeString()}${suffix}`, ...prev].slice(0, 8));
    setVoterCount("");
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    setActaFile(e.target.files?.[0] ?? null);
  }

  async function closeMesa(e: FormEvent) {
    e.preventDefault();
    setCloseMsg("");
    if (!mesa.trim()) {
      setCloseMsg("Ingresá el número de mesa arriba.");
      return;
    }
    if (!actaFile) {
      setCloseMsg("Subí la foto del acta.");
      return;
    }
    setClosing(true);
    const r = await submit("close_mesa", { mesa, nagle_votes: Number(nagleVotes) }, actaFile);
    setClosing(false);
    if (r.status === "sent") {
      setClosed(true);
      setCloseMsg("Cierre de mesa enviado correctamente.");
    } else if (r.status === "queued") {
      setClosed(true);
      setCloseMsg("Sin señal: el cierre y la foto del acta quedaron guardados en el teléfono y se envían solos cuando vuelva la conexión. No cierres la app hasta que desaparezca el aviso de pendientes.");
    } else {
      setCloseMsg(r.error || "No se pudo cerrar la mesa.");
    }
  }

  return (
    <>
      {pending.length > 0 && (
        <section className="ext-card" style={{ background: "#fff8e1", borderColor: "#f2c94c" }}>
          <h2>Envíos pendientes ({pending.length})</h2>
          <p className="ext-hint">Estos datos están guardados en tu teléfono y se envían solos cuando hay señal.</p>
          <div className="log-list">
            {pending.map((item) => (
              <div key={item.id} className="ext-voter-row-top" style={{ marginBottom: 6 }}>
                <div>
                  <b>{describeItem(item)}</b>
                  {item.lastError && <span className="dni-small" style={{ color: "#a3231e" }}>{item.lastError}</span>}
                </div>
                {item.lastError && (
                  <button type="button" className="ext-btn secondary" style={{ padding: "6px 10px" }} onClick={() => discard(item.id)}>
                    DESCARTAR
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="ext-btn full" style={{ marginTop: 8 }} disabled={flushing} onClick={() => flush(true)}>
            {flushing ? "ENVIANDO…" : "REINTENTAR AHORA"}
          </button>
        </section>
      )}
      <FiscalDashboardPanel token={token} roles={roles} />
      <section className="ext-card">
        <h2>Mesa</h2>
        <p className="ext-hint">Ingresá el número de mesa donde sos fiscal. Se usa en todas las acciones de abajo.</p>
        <input className="ext-mesa-input" inputMode="numeric" placeholder="N.º de mesa" value={mesa} onChange={(e) => setMesa(e.target.value)} />
      </section>

      <section className="ext-card">
        <h2>Presencia</h2>
        <p className="ext-hint">Marcá tu llegada a la mesa. Se registra fecha, hora y ubicación.</p>
        <button className="ext-btn full" onClick={markPresent} disabled={locating || presentOk}>
          {locating ? (
            "OBTENIENDO UBICACIÓN..."
          ) : presentOk ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Check size={14} strokeWidth={3} /> PRESENCIA REGISTRADA
            </span>
          ) : (
            "MARCAR PRESENTE"
          )}
        </button>
        {presentMsg && <p className={presentOk ? "ext-success-msg" : "ext-error"}>{presentMsg}</p>}
        {geoError && <p className="ext-error">{geoError}</p>}
      </section>

      <section className="ext-card">
        <h2>Votantes en mesa</h2>
        <p className="ext-hint">Enviá cada tanto cuántas personas van votando, para seguimiento en tiempo real.</p>
        <form onSubmit={reportTurnout} className="ext-field-row">
          <input inputMode="numeric" placeholder="Cantidad de votantes" value={voterCount} onChange={(e) => setVoterCount(e.target.value)} required />
          <button className="ext-btn">ENVIAR</button>
        </form>
        {turnoutMsg && <p className="ext-error">{turnoutMsg}</p>}
        {turnoutHistory.length > 0 && <p className="ext-note">Últimos envíos: {turnoutHistory.join(" · ")}</p>}
      </section>

      <section className="ext-card">
        <h2>Fin de comicio</h2>
        <p className="ext-hint">Al cierre de la votación, cargá los votos totales de {candidatoNombre || "tu candidato"} y subí la foto del acta.</p>
        <form onSubmit={closeMesa}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", margin: "0 0 6px" }}>{candidatoNombre ? `VOTOS ${candidatoNombre.toUpperCase()}` : "VOTOS DEL CANDIDATO"}</label>
          <input className="ext-mesa-input" style={{ marginBottom: 14 }} inputMode="numeric" placeholder="Total de votos" value={nagleVotes} onChange={(e) => setNagleVotes(e.target.value)} required disabled={closed} />
          <label className={`ext-file-btn ${actaFile ? "has-file" : ""}`}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Camera size={16} strokeWidth={2} /> {actaFile ? actaFile.name : "Subir foto del acta"}
            </span>
            <input type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{ display: "none" }} disabled={closed} />
          </label>
          <button className="ext-btn full" style={{ marginTop: 14 }} disabled={closing || closed}>
            {closing ? (
              "ENVIANDO..."
            ) : closed ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Check size={14} strokeWidth={3} /> MESA CERRADA
              </span>
            ) : (
              "CERRAR MESA"
            )}
          </button>
        </form>
        {closeMsg && <p className={closed ? "ext-success-msg" : "ext-error"}>{closeMsg}</p>}
      </section>
    </>
  );
}
