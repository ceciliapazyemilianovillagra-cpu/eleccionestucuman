"use client";
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, MOVILIZADORES_URL, Voter, electoralRoles, decodeJwtSub, rpc } from "./shared";

export function VoterSheet({ voter, token, close }: { voter: Voter; token: string; close: () => void }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("sin_contactar");
  const [notes, setNotes] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [savedRoles, setSavedRoles] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/voter_profiles?select=telefono,estado,observaciones&padron_id=eq.${voter.id}`, { headers }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/person_roles?select=role&padron_id=eq.${voter.id}&active=is.true`, { headers }).then((r) => r.json()),
    ]).then(([profile, assigned]) => {
      if (profile?.[0]) {
        setPhone(profile[0].telefono || "");
        setStatus(profile[0].estado || "sin_contactar");
        setNotes(profile[0].observaciones || "");
      }
      const current = (assigned || []).map((item: { role: string }) => item.role);
      setRoles(current);
      setSavedRoles(current);
    });
  }, [voter.id, token]);

  function toggleRole(role: string) {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }

  async function generateMobilizerAccess() {
    const response = await fetch(MOVILIZADORES_URL, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "provision", padron_id: voter.id }),
    });
    const data = await response.json();
    setAccessCode(data.code || data.error || "No se pudo generar el código.");
  }

  async function save() {
    setSaved("Guardando…");
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const added = roles.filter((role) => !savedRoles.includes(role));
    const removed = savedRoles.filter((role) => !roles.includes(role));
    const requests = [
      fetch(`${SUPABASE_URL}/rest/v1/rpc/save_voter_profile`, { method: "POST", headers, body: JSON.stringify({ p_padron_id: voter.id, p_telefono: phone, p_estado: status, p_observaciones: notes }) }),
      ...added.map((role) => fetch(`${SUPABASE_URL}/rest/v1/person_roles`, { method: "POST", headers, body: JSON.stringify({ padron_id: voter.id, role }) })),
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
            body: JSON.stringify({ voter_id: voter.id, internal_user_id: uid }),
          });
        }
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
            <dd>{voter.circuito_nombre || voter.circuito}</dd>
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
          {roles.includes("movilizador") && (
            <section className="mobilizer-access">
              <small>ACCESO EXTERNO</small>
              <button type="button" onClick={generateMobilizerAccess}>
                GENERAR CÓDIGO MOVILIZADOR
              </button>
              {accessCode && (
                <div className="access-code">
                  <code>{accessCode}</code>
                  <button
                    type="button"
                    aria-label="Copiar código"
                    onClick={async () => {
                      await navigator.clipboard.writeText(accessCode);
                      setCopied(true);
                    }}
                  >
                    ⧉
                  </button>
                </div>
              )}
              {copied && <p>Código copiado.</p>}
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
