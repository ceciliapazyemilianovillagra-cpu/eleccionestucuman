"use client";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import "../external/external.css";
import { callFn, clearToken, loadToken, saveToken } from "../external/api";
import { ExternalLoginCard, ExternalShell } from "../external/ExternalShell";
import { useGeolocation } from "../external/useGeolocation";

const FN = "fiscales";

export default function Fiscales() {
  const [token, setToken] = useState("");
  const [person, setPerson] = useState("");
  const [dni, setDni] = useState("");
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

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

  useEffect(() => {
    const saved = loadToken(FN);
    if (saved) setToken(saved);
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const d = await callFn(FN, "", { action: "login", dni, code });
    setLoggingIn(false);
    if (d.token) {
      setToken(d.token);
      setPerson(d.person?.nombre ?? "");
      saveToken(FN, d.token);
    } else {
      setLoginError(d.error || "No se pudo ingresar.");
    }
  }

  async function logout() {
    await callFn(FN, token, { action: "logout" });
    clearToken(FN);
    setToken("");
  }

  async function markPresent() {
    if (!mesa.trim()) { setPresentMsg("Ingresá el número de mesa."); return; }
    const point = await getLocation();
    const d = await callFn(FN, token, { action: "mark_present", mesa, lat: point?.lat, lng: point?.lng, accuracy: point?.accuracy });
    if (d.success) {
      setPresentOk(true);
      setPresentMsg("Presencia registrada con ubicación y hora.");
    } else {
      setPresentMsg(d.error || "No se pudo registrar.");
    }
  }

  async function reportTurnout(e: FormEvent) {
    e.preventDefault();
    if (!mesa.trim()) { setTurnoutMsg("Ingresá el número de mesa arriba."); return; }
    const d = await callFn(FN, token, { action: "report_turnout", mesa, voter_count: Number(voterCount) });
    if (d.success) {
      setTurnoutMsg("");
      setTurnoutHistory((prev) => [`${voterCount} votantes — ${new Date().toLocaleTimeString()}`, ...prev].slice(0, 8));
      setVoterCount("");
    } else {
      setTurnoutMsg(d.error || "No se pudo enviar.");
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    setActaFile(e.target.files?.[0] ?? null);
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function closeMesa(e: FormEvent) {
    e.preventDefault();
    setCloseMsg("");
    if (!mesa.trim()) { setCloseMsg("Ingresá el número de mesa arriba."); return; }
    if (!actaFile) { setCloseMsg("Subí la foto del acta."); return; }
    setClosing(true);
    const base64 = await fileToBase64(actaFile);
    const upload = await callFn(FN, token, { action: "upload_acta", mesa, file_base64: base64, content_type: actaFile.type });
    if (!upload.acta_path) {
      setClosing(false);
      setCloseMsg(upload.error || "No se pudo subir la foto.");
      return;
    }
    const d = await callFn(FN, token, { action: "close_mesa", mesa, nagle_votes: Number(nagleVotes), acta_path: upload.acta_path });
    setClosing(false);
    if (d.success) {
      setClosed(true);
      setCloseMsg("Cierre de mesa enviado correctamente.");
    } else {
      setCloseMsg(d.error || "No se pudo cerrar la mesa.");
    }
  }

  if (!token) {
    return (
      <ExternalLoginCard>
        <form onSubmit={login}>
          <img src="/icon.svg" alt="Elecciones Tucumán" />
          <small>ACCESO EXTERNO</small>
          <h1>Fiscales</h1>
          <p>Ingresá con los datos que te entregó tu coordinador.</p>
          <label>DNI</label>
          <input required inputMode="numeric" placeholder="Tu DNI" value={dni} onChange={(e) => setDni(e.target.value)} />
          <label>Código único</label>
          <input required placeholder="Código de acceso" value={code} onChange={(e) => setCode(e.target.value)} />
          <button disabled={loggingIn}>{loggingIn ? "INGRESANDO..." : "INGRESAR"}</button>
          {loginError && <b className="ext-error">{loginError}</b>}
        </form>
      </ExternalLoginCard>
    );
  }

  return (
    <ExternalShell eyebrow="FISCALES" title="Jornada electoral" person={person} onLogout={logout}>
      <section className="ext-card">
        <h2>Mesa</h2>
        <p className="ext-hint">Ingresá el número de mesa donde sos fiscal. Se usa en todas las acciones de abajo.</p>
        <input className="ext-mesa-input" inputMode="numeric" placeholder="N.º de mesa" value={mesa} onChange={(e) => setMesa(e.target.value)} />
      </section>

      <section className="ext-card">
        <h2>Presencia</h2>
        <p className="ext-hint">Marcá tu llegada a la mesa. Se registra fecha, hora y ubicación.</p>
        <button className="ext-btn full" onClick={markPresent} disabled={locating || presentOk}>
          {locating ? "OBTENIENDO UBICACIÓN..." : presentOk ? "PRESENCIA REGISTRADA ✓" : "MARCAR PRESENTE"}
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
        {turnoutHistory.length > 0 && (
          <p className="ext-note">Últimos envíos: {turnoutHistory.join(" · ")}</p>
        )}
      </section>

      <section className="ext-card">
        <h2>Fin de comicio</h2>
        <p className="ext-hint">Al cierre de la votación, cargá los votos totales de Nagle y subí la foto del acta.</p>
        <form onSubmit={closeMesa}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", margin: "0 0 6px" }}>VOTOS NAGLE</label>
          <input className="ext-mesa-input" style={{ marginBottom: 14 }} inputMode="numeric" placeholder="Total de votos" value={nagleVotes} onChange={(e) => setNagleVotes(e.target.value)} required disabled={closed} />
          <label className={`ext-file-btn ${actaFile ? "has-file" : ""}`}>
            {actaFile ? `📷 ${actaFile.name}` : "📷 Subir foto del acta"}
            <input type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{ display: "none" }} disabled={closed} />
          </label>
          <button className="ext-btn full" style={{ marginTop: 14 }} disabled={closing || closed}>
            {closing ? "ENVIANDO..." : closed ? "MESA CERRADA ✓" : "CERRAR MESA"}
          </button>
        </form>
        {closeMsg && <p className={closed ? "ext-success-msg" : "ext-error"}>{closeMsg}</p>}
      </section>
    </ExternalShell>
  );
}
