"use client";
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, Voter, Candidato, electoralRoles, decodeJwtSub, rpc, copyText, listCandidatos } from "./shared";

type EscuelaOpt = { id: number; circuito: string; circuito_num: string; nombre: string; mesa_desde: number; mesa_hasta: number };

const FISCAL_ROLES = ["fiscal", "fiscal_general", "fiscal_mesa", "fiscal_suplente", "coordinador_circuito", "coordinador_general"];

export function VoterSheet({ voter, token, close }: { voter: Voter; token: string; close: () => void }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("sin_contactar");
  const [notes, setNotes] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [savedRoles, setSavedRoles] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [alreadyHasCode, setAlreadyHasCode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [escuelas, setEscuelas] = useState<EscuelaOpt[]>([]);
  const [escuelaId, setEscuelaId] = useState("");
  const [circuito, setCircuito] = useState("");

  useEffect(() => {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/voter_profiles?select=telefono,estado,observaciones&padron_id=eq.${voter.id}`, { headers }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/person_roles?select=role,candidate_id,circuito,escuela_id&padron_id=eq.${voter.id}&active=is.true`, { headers }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/escuelas?select=id,circuito,circuito_num,nombre,mesa_desde,mesa_hasta&order=id`, { headers }).then((r) => r.json()).catch(() => []),
      listCandidatos(token, true),
      rpc(token, "my_candidate_id").catch(() => null),
    ]).then(([profile, assigned, escuelasList, candidatosList, myCandidateId]) => {
      if (profile?.[0]) {
        setPhone(profile[0].telefono || "");
        setStatus(profile[0].estado || "sin_contactar");
        setNotes(profile[0].observaciones || "");
      }
      const assignedRows: { role: string; candidate_id: number | null; circuito: string | null; escuela_id: number | null }[] = assigned || [];
      setEscuelas(Array.isArray(escuelasList) ? escuelasList : []);
      const fg = assignedRows.find((item) => item.role === "fiscal_general");
      if (fg) setEscuelaId(fg.escuela_id ? String(fg.escuela_id) : fg.circuito === "PENDIENTE" ? "PENDIENTE" : "");
      const coord = assignedRows.find((item) => item.role === "coordinador_circuito");
      if (coord?.circuito && coord.circuito !== "PENDIENTE") setCircuito(coord.circuito);
      const current = assignedRows.map((item) => item.role);
      setRoles(current);
      setSavedRoles(current);
      setCandidatos(candidatosList);
      const existingCandidateId = assignedRows.find((item) => item.candidate_id != null)?.candidate_id;
      if (existingCandidateId) setCandidateId(String(existingCandidateId));
      else if (myCandidateId) setCandidateId(String(myCandidateId));
    });
  }, [voter.id, token]);

  function toggleRole(role: string) {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }

  async function generateAccess() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/comicios`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "provision", padron_id: voter.id }),
    });
    const data = await response.json();
    setAlreadyHasCode(Boolean(data.error && !data.code));
    setAccessCode(data.code || data.error || "No se pudo generar el código.");
    setCopied(false);
  }

  async function resetAccess() {
    setResetting(true);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/comicios`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_code", padron_id: voter.id }),
    });
    const data = await response.json();
    setResetting(false);
    setAlreadyHasCode(false);
    setAccessCode(data.code || data.error || "No se pudo blanquear el código.");
    setCopied(false);
  }

  async function save() {
    const added = roles.filter((role) => !savedRoles.includes(role));
    const kept = roles.filter((role) => savedRoles.includes(role));
    const removed = savedRoles.filter((role) => !roles.includes(role));
    if (roles.length && !candidateId) {
      setSaved("Elegí a qué candidato pertenecen estos roles.");
      return;
    }
    if (roles.includes("fiscal_general") && !escuelaId) {
      setSaved("Elegí la escuela del fiscal general (o dejala pendiente de asignación).");
      return;
    }
    if (roles.includes("coordinador_circuito") && !circuito) {
      setSaved("Elegí el circuito que coordina.");
      return;
    }
    setSaved("Guardando…");
    const extraFor = (role: string): Record<string, unknown> => {
      if (role === "fiscal_general") {
        if (escuelaId === "PENDIENTE") return { circuito: "PENDIENTE", escuela_id: null };
        const esc = escuelas.find((e) => String(e.id) === escuelaId);
        return esc ? { circuito: esc.circuito_num, escuela_id: esc.id } : {};
      }
      if (role === "coordinador_circuito") return { circuito };
      return {};
    };
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const requests = [
      fetch(`${SUPABASE_URL}/rest/v1/rpc/save_voter_profile`, { method: "POST", headers, body: JSON.stringify({ p_padron_id: voter.id, p_telefono: phone, p_estado: status, p_observaciones: notes }) }),
      ...added.map((role) => fetch(`${SUPABASE_URL}/rest/v1/person_roles`, { method: "POST", headers, body: JSON.stringify({ padron_id: voter.id, role, candidate_id: Number(candidateId), ...extraFor(role) }) })),
      ...kept.map((role) => fetch(`${SUPABASE_URL}/rest/v1/person_roles?padron_id=eq.${voter.id}&role=eq.${role}`, { method: "PATCH", headers, body: JSON.stringify({ candidate_id: Number(candidateId), ...extraFor(role) }) })),
      ...removed.map((role) => fetch(`${SUPABASE_URL}/rest/v1/person_roles?padron_id=eq.${voter.id}&role=eq.${role}`, { method: "DELETE", headers })),
    ];
    const results = await Promise.all(requests);
    if (results.every((result) => result.ok)) {
      if (added.includes("colaborador")) {
        const uid = decodeJwtSub(token);
        if (uid) {
          await fetch(`${SUPABASE_URL}/rest/v1/mobilizer_voter_links`, {
            method: "POST",
            headers: { ...headers, Prefer: "resolution=ignore-duplicates" },
            body: JSON.stringify({ voter_id: voter.id, internal_user_id: uid, candidate_id: Number(candidateId) }),
          });
        }
      }
      if (removed.includes("colaborador")) {
        await fetch(`${SUPABASE_URL}/rest/v1/mobilizer_voter_links?voter_id=eq.${voter.id}`, { method: "DELETE", headers });
      }
      await rpc(token, "log_activity", { p_module: "padron", p_action: "save_voter_profile", p_details: { padron_id: voter.id, roles_added: added, roles_removed: removed } }).catch(() => {});
      setSavedRoles(roles);
      setSaved("Cambios guardados");
    } else setSaved("No se pudo guardar");
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <section className="voter-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-title">
          <div>
            <small>FICHA DEL VOTANTE</small>
            <h2>{voter.apellido_nombre}</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <dl>
          <div>
            <dt>DNI</dt>
            <dd>{voter.dni}</dd>
          </div>
          <div>
            <dt>Domicilio</dt>
            <dd>{voter.domicilio || "Sin dato"}</dd>
          </div>
          <div>
            <dt>Circuito</dt>
            <dd>{voter.circuito_codigo ? `${voter.circuito_codigo}${voter.circuito_nombre ? ` · ${voter.circuito_nombre}` : ""}` : voter.circuito_nombre || voter.circuito}</dd>
          </div>
          <div>
            <dt>Escuela</dt>
            <dd>{voter.escuela_nombre ? `${voter.escuela_nombre}${voter.escuela_direccion ? ` · ${voter.escuela_direccion}` : ""}` : "Sin dato"}</dd>
          </div>
          <div>
            <dt>Mesa / Orden</dt>
            <dd>
              {voter.mesa} / {voter.orden ?? "-"}
            </dd>
          </div>
        </dl>
        <div className="profile-form">
          <label>
            Teléfono
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="381 000 0000" />
          </label>
          <label>
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="sin_contactar">Sin contactar</option>
              <option value="contactado">Contactado</option>
              <option value="confirmado">Confirmado</option>
              <option value="no_contactar">No contactar</option>
            </select>
          </label>
          <label>
            Candidato al que pertenecen sus roles
            <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
              <option value="">Elegí un candidato…</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Roles en el equipo</legend>
            <div className="role-checks">
              {electoralRoles.map(([role, label]) => (
                <label key={role}>
                  <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {roles.includes("fiscal_general") && (
            <label>
              Escuela a cargo
              <select value={escuelaId} onChange={(e) => setEscuelaId(e.target.value)}>
                <option value="">Elegí una escuela…</option>
                <option value="PENDIENTE">Pendiente de asignación</option>
                {Array.from(new Set(escuelas.map((e) => e.circuito))).map((code) => (
                  <optgroup key={code} label={`Circuito ${code}`}>
                    {escuelas.filter((e) => e.circuito === code).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre} · mesas {e.mesa_desde}-{e.mesa_hasta}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          {roles.includes("coordinador_circuito") && (
            <label>
              Circuito que coordina
              <select value={circuito} onChange={(e) => setCircuito(e.target.value)}>
                <option value="">Elegí un circuito…</option>
                {Array.from(new Set(escuelas.map((e) => e.circuito_num)))
                  .sort((a, b) => Number(a) - Number(b))
                  .map((c) => (
                    <option key={c} value={c}>
                      Circuito {c}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {(roles.includes("movilizador") || roles.includes("chofer") || roles.includes("dirigente") || roles.includes("candidato") || roles.some((r) => FISCAL_ROLES.includes(r))) && (
            <section className="mobilizer-access">
              <small>ACCESO EXTERNO</small>
              <p className="ext-note" style={{ margin: "0 0 10px" }}>
                Un solo código le da acceso a eleccionestucuman.vercel.app/comicios, donde ve lo que su rol o roles habiliten.
              </p>
              <button type="button" onClick={generateAccess}>
                GENERAR CÓDIGO DE ACCESO
              </button>
              {accessCode && (
                <div className="access-code">
                  <code>{accessCode}</code>
                  {!alreadyHasCode && (
                    <button
                      type="button"
                      aria-label="Copiar código"
                      onClick={async () => {
                        const ok = await copyText(accessCode);
                        if (ok) setCopied(true);
                        else window.prompt("Copiá el código manualmente:", accessCode);
                      }}
                    >
                      ⧉
                    </button>
                  )}
                </div>
              )}
              {copied && <p>Código copiado.</p>}
              {alreadyHasCode && (
                <button type="button" onClick={resetAccess} disabled={resetting} style={{ marginTop: 8 }}>
                  {resetting ? "BLANQUEANDO…" : "BLANQUEAR CÓDIGO"}
                </button>
              )}
            </section>
          )}
          <label>
            Observaciones
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>
          <button onClick={save}>GUARDAR CAMBIOS</button>
          {saved && <p>{saved}</p>}
        </div>
      </section>
    </div>
  );
}
