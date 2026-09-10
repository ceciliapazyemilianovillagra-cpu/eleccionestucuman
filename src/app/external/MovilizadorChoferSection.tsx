"use client";
import { FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { callFn } from "./api";
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
  mine_as: "cargado" | "asignado";
  chofer_nombre: string | null;
  can_edit_status: boolean;
};

const STATUS_LABEL: Record<string, string> = { buscado: "Buscado", votando: "Votando", devuelta: "Devuelta" };

export function MovilizadorChoferSection({ token, isMovilizador, isChofer }: { token: string; isMovilizador: boolean; isChofer: boolean }) {
  const [query, setQuery] = useState("");
  const [voter, setVoter] = useState<Voter | null>(null);
  const [msg, setMsg] = useState("");
  const [searching, setSearching] = useState(false);

  const [myVoters, setMyVoters] = useState<MyVoter[]>([]);
  const [listFilter, setListFilter] = useState("");
  const { getLocation, locating, geoError } = useGeolocation();
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [devolviendoId, setDevolviendoId] = useState<number | null>(null);
  const [codigoBarra, setCodigoBarra] = useState("");
  const [devolviendoError, setDevolviendoError] = useState("");

  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [choferDni, setChoferDni] = useState("");
  const [assignMsg, setAssignMsg] = useState("");

  useEffect(() => {
    refreshList();
  }, [token]);

  async function refreshList() {
    const d = await callFn("comicios", token, { action: "list_mine" });
    if (Array.isArray(d.voters)) setMyVoters(d.voters);
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setMsg("");
    const d = await callFn("comicios", token, { action: "lookup", dni: query });
    setSearching(false);
    setVoter(d.voter || null);
    setMsg(d.error || "");
  }

  async function capture() {
    if (!voter) return;
    const d = await callFn("comicios", token, { action: "capture", voter_id: voter.id });
    setMsg(d.message || d.error || "");
    if (d.status === "captured" || d.status === "already_yours") {
      setVoter({ ...voter, already_loaded: true, owned_by_you: true });
      refreshList();
    }
  }

  async function markStatus(voterId: number, status: "buscado" | "votando" | "devuelta", barcode?: string) {
    setMarkingId(voterId);
    const point = await getLocation();
    const d = await callFn("comicios", token, {
      action: "mark_status",
      voter_id: voterId,
      status,
      lat: point?.lat,
      lng: point?.lng,
      accuracy: point?.accuracy,
      codigo_barra: barcode,
    });
    setMarkingId(null);
    if (d.success) {
      setMyVoters((prev) => prev.map((v) => (v.voter_id === voterId ? { ...v, last_status: status } : v)));
      setDevolviendoId(null);
      setCodigoBarra("");
      setDevolviendoError("");
    } else if (status === "devuelta") {
      setDevolviendoError(d.error || "No se pudo registrar.");
    }
  }

  function handleStatusClick(voterId: number, status: "buscado" | "votando" | "devuelta") {
    if (status === "devuelta") {
      setDevolviendoId(voterId);
      setCodigoBarra("");
      setDevolviendoError("");
      return;
    }
    markStatus(voterId, status);
  }

  function confirmDevuelta(voterId: number) {
    if (!codigoBarra.trim()) {
      setDevolviendoError("Ingresá los dígitos del código de barras de la boleta.");
      return;
    }
    markStatus(voterId, "devuelta", codigoBarra.trim());
  }

  async function assignChofer(voterId: number) {
    if (!choferDni.trim()) {
      setAssignMsg("Ingresá el DNI del chofer.");
      return;
    }
    const d = await callFn("comicios", token, { action: "assign_chofer", voter_id: voterId, chofer_dni: choferDni.trim() });
    if (d.success) {
      setAssignMsg(d.new_code ? `${d.chofer_nombre} designado como chofer. Código nuevo: ${d.new_code}` : `Chofer asignado: ${d.chofer_nombre}`);
      setAssigningId(null);
      setChoferDni("");
      refreshList();
    } else {
      setAssignMsg(d.error || "No se pudo asignar.");
    }
  }

  const filteredMine = myVoters.filter((v) => {
    if (!listFilter.trim()) return true;
    const q = listFilter.toLowerCase();
    return v.dni.includes(q) || v.apellido_nombre.toLowerCase().includes(q);
  });

  const counts = {
    total: myVoters.length,
    buscado: myVoters.filter((v) => v.last_status === "buscado").length,
    votando: myVoters.filter((v) => v.last_status === "votando").length,
    devuelta: myVoters.filter((v) => v.last_status === "devuelta").length,
    reclamado: myVoters.filter((v) => v.disputed).length,
  };

  return (
    <>
      {isMovilizador && (
        <section className="ext-card">
          <h2>Buscar en el padrón</h2>
          <p className="ext-hint">Ingresá un DNI para ver mesa, escuela y dirección donde vota.</p>
          <form onSubmit={search} className="ext-search">
            <input required inputMode="numeric" placeholder="Ingresá DNI" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button disabled={searching}>{searching ? "BUSCANDO..." : "BUSCAR"}</button>
          </form>
          {searching && <p className="ext-note">Buscando…</p>}
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
      )}

      <section className="ext-card">
        <h2>{isMovilizador ? "Mis votantes" : "Votantes asignados"}</h2>
        <p className="ext-hint">
          {isChofer && !isMovilizador
            ? "Marcá el traslado de cada persona que te asignaron para llevar."
            : "Marcá el traslado de cada persona el día de la elección."}
        </p>
        {counts.total > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <span className="badge sm neutral" style={{ background: "#fff8e1", color: "#7a5e00" }}>Total: {counts.total}</span>
            <span className="badge sm neutral" style={{ background: "#fff8e1", color: "#7a5e00" }}>Buscado: {counts.buscado}</span>
            <span className="badge sm neutral" style={{ background: "#fff8e1", color: "#7a5e00" }}>Votando: {counts.votando}</span>
            <span className="badge sm neutral" style={{ background: "#fff8e1", color: "#7a5e00" }}>Devuelta: {counts.devuelta}</span>
            {counts.reclamado > 0 && <span className="badge sm danger">Reclamado: {counts.reclamado}</span>}
          </div>
        )}
        <button className="ext-btn secondary" style={{ marginBottom: 10 }} onClick={refreshList}>
          ACTUALIZAR
        </button>
        <div className="ext-list-search">
          <Search size={16} strokeWidth={2} />
          <input placeholder="Buscar por nombre o DNI" value={listFilter} onChange={(e) => setListFilter(e.target.value)} />
        </div>
        {geoError && <b className="ext-error">{geoError}</b>}
        {assignMsg && <p className="ext-note">{assignMsg}</p>}
        {filteredMine.length === 0 && <p className="ext-empty">Todavía no hay nadie en tu lista.</p>}
        <div className="ext-voters-list">
          {filteredMine.map((v) => (
            <div className="ext-voter-row" key={v.voter_id}>
              <div className="ext-voter-row-top">
                <div>
                  <b>{v.apellido_nombre}</b>
                  <span className="dni-small">
                    DNI {v.dni} {v.mine_as === "asignado" && "· Asignado para llevar"}
                    {v.chofer_nombre && ` · Chofer: ${v.chofer_nombre}`}
                  </span>
                </div>
                <span className={`badge ${v.disputed ? "danger" : "ok"}`}>{v.disputed ? "Reclamado" : "Único"}</span>
              </div>
              {v.can_edit_status && (
                <div className="ext-status-btns">
                  {(["buscado", "votando", "devuelta"] as const).map((s) => (
                    <button
                      key={s}
                      className={`ext-status-btn ${v.last_status === s ? `active-${s}` : ""}`}
                      disabled={markingId === v.voter_id && locating}
                      onClick={() => handleStatusClick(v.voter_id, s)}
                    >
                      {markingId === v.voter_id && locating ? "..." : STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              )}
              {devolviendoId === v.voter_id && (
                <div className="ext-barcode-box">
                  <label>Código de barras de la boleta</label>
                  <input inputMode="numeric" autoFocus placeholder="Dígitos del código de barras" value={codigoBarra} onChange={(e) => setCodigoBarra(e.target.value)} />
                  {devolviendoError && <b className="ext-error">{devolviendoError}</b>}
                  <div className="ext-barcode-actions">
                    <button className="ext-btn secondary" type="button" onClick={() => setDevolviendoId(null)}>
                      CANCELAR
                    </button>
                    <button className="ext-btn" type="button" disabled={locating} onClick={() => confirmDevuelta(v.voter_id)}>
                      {locating ? "GUARDANDO…" : "CONFIRMAR DEVUELTA"}
                    </button>
                  </div>
                </div>
              )}
              {isMovilizador && v.mine_as === "cargado" && !v.chofer_nombre && (
                <div style={{ marginTop: 8 }}>
                  {assigningId === v.voter_id ? (
                    <div className="ext-barcode-box">
                      <label>DNI del chofer que lo va a llevar</label>
                      <input inputMode="numeric" placeholder="DNI del chofer" value={choferDni} onChange={(e) => setChoferDni(e.target.value)} />
                      <div className="ext-barcode-actions">
                        <button className="ext-btn secondary" type="button" onClick={() => setAssigningId(null)}>
                          CANCELAR
                        </button>
                        <button className="ext-btn" type="button" onClick={() => assignChofer(v.voter_id)}>
                          ASIGNAR CHOFER
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="ext-btn secondary" type="button" onClick={() => { setAssigningId(v.voter_id); setChoferDni(""); setAssignMsg(""); }}>
                      + ASIGNAR CHOFER
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
