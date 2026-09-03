"use client";
import { FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import "./external.css";
import { callFn, clearToken, loadToken, saveToken } from "./api";
import { ExternalLoginCard, ExternalShell } from "./ExternalShell";
import { useGeolocation } from "./useGeolocation";

type Voter = {
  id: number;
  dni: string;
  apellido_nombre: string;
  domicilio: string | null;
  mesa: string | null;
  circuito_nombre: string | null;
  escuela_nombre: string | null;
  escuela_direccion: string | null;
  already_loaded: boolean;
  owned_by_you: boolean;
  disputed: boolean;
};

type MyVoter = {
  voter_id: number;
  dni: string;
  apellido_nombre: string;
  disputed: boolean;
  last_status: "buscado" | "votando" | "devuelta" | null;
};

const STATUS_LABEL: Record<string, string> = { buscado: "Buscado", votando: "Votando", devuelta: "Devuelta" };

export function MobilizerPortal({ fn, label }: { fn: "movilizadores" | "choferes"; label: string }) {
  const [token, setToken] = useState("");
  const [person, setPerson] = useState("");
  const [dni, setDni] = useState("");
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [query, setQuery] = useState("");
  const [voter, setVoter] = useState<Voter | null>(null);
  const [msg, setMsg] = useState("");
  const [searching, setSearching] = useState(false);

  const [myVoters, setMyVoters] = useState<MyVoter[]>([]);
  const [listFilter, setListFilter] = useState("");
  const { getLocation, locating, geoError } = useGeolocation();
  const [markingId, setMarkingId] = useState<number | null>(null);

  useEffect(() => {
    const saved = loadToken(fn);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) refreshList();
  }, [token]);

  async function refreshList() {
    const d = await callFn(fn, token, { action: "list_mine" });
    if (Array.isArray(d.voters)) setMyVoters(d.voters);
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const d = await callFn(fn, "", { action: "login", dni, code });
    setLoggingIn(false);
    if (d.token) {
      setToken(d.token);
      setPerson(d.person?.nombre ?? "");
      saveToken(fn, d.token);
    } else {
      setLoginError(d.error || "No se pudo ingresar.");
    }
  }

  async function logout() {
    await callFn(fn, token, { action: "logout" });
    clearToken(fn);
    setToken("");
    setVoter(null);
    setMyVoters([]);
    setDni("");
    setCode("");
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setMsg("");
    const d = await callFn(fn, token, { action: "lookup", dni: query });
    setSearching(false);
    setVoter(d.voter || null);
    setMsg(d.error || "");
  }

  async function capture() {
    if (!voter) return;
    const d = await callFn(fn, token, { action: "capture", voter_id: voter.id });
    setMsg(d.message || d.error || "");
    if (d.status === "captured" || d.status === "already_yours") {
      setVoter({ ...voter, already_loaded: true, owned_by_you: true });
      refreshList();
    }
  }

  async function markStatus(voterId: number, status: "buscado" | "votando" | "devuelta") {
    setMarkingId(voterId);
    const point = await getLocation();
    const d = await callFn(fn, token, {
      action: "mark_status",
      voter_id: voterId,
      status,
      lat: point?.lat,
      lng: point?.lng,
      accuracy: point?.accuracy,
    });
    setMarkingId(null);
    if (d.success) {
      setMyVoters((prev) => prev.map((v) => (v.voter_id === voterId ? { ...v, last_status: status } : v)));
    }
  }

  if (!token) {
    return (
      <ExternalLoginCard>
        <form onSubmit={login}>
          <img src="/icon.svg" alt="Elecciones Tucumán" />
          <small>ACCESO EXTERNO</small>
          <h1>{label}</h1>
          <p>Ingresá con los datos que te entregó tu dirigente.</p>
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

  const filteredMine = myVoters.filter((v) => {
    if (!listFilter.trim()) return true;
    const q = listFilter.toLowerCase();
    return v.dni.includes(q) || v.apellido_nombre.toLowerCase().includes(q);
  });

  return (
    <ExternalShell
      eyebrow={label.toUpperCase()}
      title="Carga de votantes"
      person={person}
      onLogout={logout}
      onBack={
        voter
          ? () => {
              setVoter(null);
              setQuery("");
              setMsg("");
            }
          : undefined
      }
    >
      <section className="ext-card">
        <h2>Buscar en el padrón</h2>
        <p className="ext-hint">Ingresá un DNI para ver mesa, escuela y dirección donde vota.</p>
        <form onSubmit={search} className="ext-search">
          <input required inputMode="numeric" placeholder="Ingresá DNI" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button disabled={searching}>{searching ? "BUSCANDO..." : "BUSCAR"}</button>
        </form>
        {voter && (
          <div className="ext-voter">
            <span className="dni">DNI {voter.dni}</span>
            <h3>{voter.apellido_nombre}</h3>
            <dl>
              <div><dt>Domicilio</dt><dd>{voter.domicilio || "Sin datos"}</dd></div>
              <div><dt>Mesa</dt><dd>{voter.mesa || "Sin datos"}</dd></div>
              <div><dt>Circuito</dt><dd>{voter.circuito_nombre || "Sin datos"}</dd></div>
              <div><dt>Escuela</dt><dd>{voter.escuela_nombre || "Aún sin cargar"}</dd></div>
              <div><dt>Dirección escuela</dt><dd>{voter.escuela_direccion || "Aún sin cargar"}</dd></div>
            </dl>
            <button className="ext-btn full" onClick={capture}>
              {voter.owned_by_you ? "YA CARGADO POR VOS" : voter.already_loaded ? "RECLAMAR PERTENENCIA" : "CARGAR VOTANTE"}
            </button>
          </div>
        )}
        {msg && <b className="ext-error" style={{ background: "#eaf7ff", color: "#156a9e" }}>{msg}</b>}
      </section>

      <section className="ext-card">
        <h2>Mis cargados</h2>
        <p className="ext-hint">Marcá el traslado de cada persona el día de la elección.</p>
        <button className="ext-btn secondary" style={{ marginBottom: 10 }} onClick={refreshList}>
          ACTUALIZAR
        </button>
        <div className="ext-list-search">
          <Search size={16} strokeWidth={2} />
          <input placeholder="Buscar por nombre o DNI" value={listFilter} onChange={(e) => setListFilter(e.target.value)} />
        </div>
        {geoError && <b className="ext-error">{geoError}</b>}
        {filteredMine.length === 0 && <p className="ext-empty">Todavía no cargaste a nadie.</p>}
        <div className="ext-voters-list">
          {filteredMine.map((v) => (
            <div className="ext-voter-row" key={v.voter_id}>
              <div className="ext-voter-row-top">
                <div>
                  <b>{v.apellido_nombre}</b>
                  <span className="dni-small">DNI {v.dni}</span>
                </div>
                <span className={`badge ${v.disputed ? "danger" : "ok"}`}>{v.disputed ? "Reclamado" : "Único"}</span>
              </div>
              <div className="ext-status-btns">
                {(["buscado", "votando", "devuelta"] as const).map((s) => (
                  <button
                    key={s}
                    className={`ext-status-btn ${v.last_status === s ? `active-${s}` : ""}`}
                    disabled={markingId === v.voter_id && locating}
                    onClick={() => markStatus(v.voter_id, s)}
                  >
                    {markingId === v.voter_id && locating ? "..." : STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </ExternalShell>
  );
}
