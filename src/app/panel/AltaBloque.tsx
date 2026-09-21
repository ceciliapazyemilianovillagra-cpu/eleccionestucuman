"use client";
import { FormEvent, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, Voter, copyText } from "./shared";

const CARGOS: [string, string][] = [["legislador", "Legislador"], ["concejal", "Concejal"], ["delegado_comunal", "Delegado comunal"], ["otro", "Otro"]];

type Acceso = { nombre: string; dni: string; rol: string; codigo: string | null; error?: string };

function PersonSearch({ token, label, value, onChange }: { token: string; label: string; value: Voter | null; onChange: (v: Voter | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Voter[]>([]);
  const [searching, setSearching] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_padron`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_query: query, p_limit: 8 }),
      });
      setResults(res.ok ? await res.json() : []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>{label}</span>
      {value ? (
        <div className="voter-row" style={{ cursor: "default" }}>
          <span className="avatar">{value.apellido_nombre.slice(0, 1)}</span>
          <div>
            <b>{value.apellido_nombre}</b>
            <p>DNI {value.dni}</p>
          </div>
          <button type="button" className="ext-btn secondary" style={{ padding: "6px 10px" }} onClick={() => onChange(null)}>
            CAMBIAR
          </button>
        </div>
      ) : (
        <>
          <div className="ext-field-row">
            <input
              placeholder="DNI o apellido y nombre"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search(e as unknown as FormEvent);
              }}
            />
            <button type="button" className="ext-btn" disabled={searching} onClick={(e) => search(e as unknown as FormEvent)}>
              {searching ? "BUSCANDO…" : "BUSCAR"}
            </button>
          </div>
          <div className="results" style={{ marginTop: 8 }}>
            {results.map((v) => (
              <button
                type="button"
                key={v.id}
                className="voter-row compact"
                onClick={() => {
                  onChange(v);
                  setResults([]);
                  setQuery("");
                }}
              >
                <span className="avatar">{v.apellido_nombre.slice(0, 1)}</span>
                <div>
                  <b>{v.apellido_nombre}</b>
                  <p>
                    DNI {v.dni} · Mesa {v.mesa}
                  </p>
                </div>
                <span>›</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AltaBloque({ token, onDone }: { token: string; onDone: () => void }) {
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("legislador");
  const [candidato, setCandidato] = useState<Voter | null>(null);
  const [dirigente, setDirigente] = useState<Voter | null>(null);
  const [accesoCandidato, setAccesoCandidato] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{ bloque: string; accesos: Acceso[] } | null>(null);
  const [copiado, setCopiado] = useState("");

  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function trabajaEnOtroBloque(padronId: number) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/person_roles?select=role&padron_id=eq.${padronId}&active=is.true&bloque_id=not.is.null&limit=1`, { headers });
    const rows = res.ok ? await res.json() : [];
    return Array.isArray(rows) && rows.length > 0;
  }

  async function provision(padronId: number): Promise<{ code: string | null; error?: string }> {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/comicios`, { method: "POST", headers, body: JSON.stringify({ action: "provision", padron_id: padronId }) });
      const d = await res.json();
      return d.code ? { code: d.code } : { code: null, error: d.error || "No se pudo generar el código." };
    } catch {
      return { code: null, error: "Sin conexión al generar el código." };
    }
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) return setError("Escribí el nombre del bloque.");
    if (!candidato) return setError("Elegí al candidato buscándolo por DNI.");
    if (!dirigente) return setError("Elegí al dirigente administrador buscándolo por DNI.");
    setBusy(true);
    const created: { bloque?: number; candidato?: number } = {};
    try {
      for (const p of [candidato, dirigente]) {
        if (await trabajaEnOtroBloque(p.id)) {
          throw new Error(`${p.apellido_nombre} ya trabaja en el equipo de otro bloque. Una persona no puede estar en dos bloques.`);
        }
      }
      const b = await fetch(`${SUPABASE_URL}/rest/v1/bloques`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ nombre: nombre.trim() }) });
      if (!b.ok) throw new Error("No se pudo crear el bloque.");
      created.bloque = (await b.json())[0].id;

      const c = await fetch(`${SUPABASE_URL}/rest/v1/candidatos`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ nombre: candidato.apellido_nombre, dni: candidato.dni, padron_id: candidato.id, cargo, bloque_id: created.bloque }),
      });
      if (!c.ok) throw new Error("No se pudo crear el candidato (¿ya existe como candidato de otro bloque?).");
      created.candidato = (await c.json())[0].id;

      const roles: { padron_id: number; role: string; candidate_id: number }[] = [{ padron_id: dirigente.id, role: "dirigente", candidate_id: created.candidato as number }];
      if (accesoCandidato) roles.push({ padron_id: candidato.id, role: "candidato", candidate_id: created.candidato as number });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/person_roles`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(roles) });
      if (!r.ok) throw new Error("No se pudieron asignar los roles.");
    } catch (err) {
      // Deshace lo que se alcanzo a crear para no dejar un bloque a medias.
      if (created.candidato) {
        await fetch(`${SUPABASE_URL}/rest/v1/person_roles?candidate_id=eq.${created.candidato}`, { method: "DELETE", headers });
        await fetch(`${SUPABASE_URL}/rest/v1/candidatos?id=eq.${created.candidato}`, { method: "DELETE", headers });
      }
      if (created.bloque) await fetch(`${SUPABASE_URL}/rest/v1/bloques?id=eq.${created.bloque}`, { method: "DELETE", headers });
      setBusy(false);
      setError(err instanceof Error ? err.message : "No se pudo crear el bloque.");
      return;
    }

    const accesos: Acceso[] = [];
    const dirCode = await provision(dirigente.id);
    accesos.push({ nombre: dirigente.apellido_nombre, dni: dirigente.dni, rol: "Dirigente administrador", codigo: dirCode.code, error: dirCode.error });
    if (accesoCandidato) {
      if (candidato.id === dirigente.id) {
        accesos[0].rol = "Dirigente administrador y candidato";
      } else {
        const candCode = await provision(candidato.id);
        accesos.push({ nombre: candidato.apellido_nombre, dni: candidato.dni, rol: "Candidato (sala de situación)", codigo: candCode.code, error: candCode.error });
      }
    }
    setResultado({ bloque: nombre.trim(), accesos });
    setBusy(false);
    onDone();
  }

  function mensaje(a: Acceso, bloque: string) {
    return `Hola ${a.nombre.split(" ").slice(0, 2).join(" ")}! Ya está listo tu acceso a Pulso Electoral (${bloque}).\n\nIngresá desde el celular a: ${window.location.origin}/comicios\nDNI: ${a.dni}\nCódigo de acceso: ${a.codigo}\n\nGuardá el código: no se vuelve a mostrar. Si lo perdés, pedí que te lo blanqueen.`;
  }

  async function copiar(a: Acceso, bloque: string) {
    const ok = await copyText(mensaje(a, bloque));
    setCopiado(ok ? a.dni : "");
  }

  function reiniciar() {
    setResultado(null);
    setNombre("");
    setCandidato(null);
    setDirigente(null);
    setCopiado("");
  }

  if (resultado) {
    return (
      <div className="search-card" style={{ marginBottom: 16 }}>
        <b style={{ display: "block", marginBottom: 4 }}>Bloque “{resultado.bloque}” creado</b>
        <p className="ext-note" style={{ marginTop: 0 }}>
          Estos códigos se muestran una sola vez. Copiá el mensaje de cada persona y mandáselo por WhatsApp ahora.
        </p>
        <div className="log-list">
          {resultado.accesos.map((a) => (
            <div key={a.dni} className="log-row" style={{ display: "block", cursor: "default" }}>
              <b>{a.nombre}</b>
              <p style={{ margin: "2px 0" }}>
                {a.rol} · DNI {a.dni}
              </p>
              {a.codigo ? (
                <>
                  <p style={{ margin: "2px 0 8px", fontSize: 18, fontWeight: 800, letterSpacing: ".04em" }}>{a.codigo}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="ext-btn" onClick={() => copiar(a, resultado.bloque)}>
                      {copiado === a.dni ? "MENSAJE COPIADO" : "COPIAR MENSAJE"}
                    </button>
                    <a className="ext-btn secondary" style={{ textDecoration: "none" }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(mensaje(a, resultado.bloque))}`}>
                      ABRIR WHATSAPP
                    </a>
                  </div>
                </>
              ) : (
                <p className="ext-error">{a.error} Podés generarlo después desde el Padrón, en la ficha de la persona.</p>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="ext-btn secondary" style={{ marginTop: 12 }} onClick={reiniciar}>
          CREAR OTRO BLOQUE
        </button>
      </div>
    );
  }

  return (
    <form className="search-card" onSubmit={crear} style={{ marginBottom: 16 }}>
      <b style={{ display: "block", marginBottom: 4 }}>Alta rápida de un bloque nuevo</b>
      <p className="ext-note" style={{ marginTop: 0 }}>
        Crea el bloque, el candidato y el dirigente administrador en un solo paso y te da los códigos de acceso con el mensaje listo para WhatsApp.
      </p>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>NOMBRE DEL BLOQUE</span>
        <input required placeholder="Ej: Bloque Frente Capital" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <PersonSearch token={token} label="CANDIDATO" value={candidato} onChange={setCandidato} />
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>CARGO</span>
        <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
          {CARGOS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <PersonSearch token={token} label="DIRIGENTE ADMINISTRADOR (quien va a cargar al equipo)" value={dirigente} onChange={setDirigente} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={accesoCandidato} onChange={(e) => setAccesoCandidato(e.target.checked)} />
        Darle también acceso al candidato a su sala de situación
      </label>
      {error && <p className="ext-error">{error}</p>}
      <button className="ext-btn full" disabled={busy}>
        {busy ? "CREANDO…" : "CREAR BLOQUE Y GENERAR ACCESOS"}
      </button>
    </form>
  );
}
