"use client";
import { FormEvent, useState } from "react";
import { callFn } from "./api";

type Person = { id: number; dni: string; apellido_nombre: string; mesa: string | null; circuito_nombre: string | null; current_roles: string[] };

const ROLE_OPTIONS = [
  { key: "movilizador", label: "Movilizador" },
  { key: "chofer", label: "Chofer" },
  { key: "fiscal_general", label: "Fiscal general" },
  { key: "fiscal_mesa", label: "Fiscal de mesa" },
  { key: "fiscal_suplente", label: "Fiscal suplente" },
  { key: "colaborador", label: "Votante" },
  { key: "colaborador_comicio", label: "Colaborador de comicio" },
] as const;

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.key, r.label]));

export function DirigenteSection({ token }: { token: string }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<{ role: string; status: string; code?: string; message?: string }[]>([]);
  const [msg, setMsg] = useState("");

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setMsg("");
    setSelected(null);
    setResults([]);
    const d = await callFn("comicios", token, { action: "dirigente_search", query });
    setSearching(false);
    setPeople(d.people || []);
    if (!d.people?.length) setMsg("No encontramos a nadie con ese dato.");
  }

  function pick(p: Person) {
    setSelected(p);
    setRoles(p.current_roles.filter((r) => ROLE_OPTIONS.some((o) => o.key === r)));
    setResults([]);
  }

  function toggleRole(role: string) {
    setRoles((cur) => (cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]));
  }

  async function assign() {
    if (!selected || !roles.length) return;
    setSaving(true);
    const d = await callFn("comicios", token, { action: "dirigente_assign_roles", padron_id: selected.id, roles });
    setSaving(false);
    setResults(d.results || []);
  }

  return (
    <section className="ext-card">
      <h2>Asignar roles</h2>
      <p className="ext-hint">Buscá por DNI o nombre, tildá los roles que corresponden y generá los códigos de acceso.</p>
      <form onSubmit={search} className="ext-search">
        <input required placeholder="DNI o nombre" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button disabled={searching}>{searching ? "BUSCANDO..." : "BUSCAR"}</button>
      </form>
      {searching && <p className="ext-note">Buscando…</p>}
      {msg && <p className="ext-error">{msg}</p>}

      {!selected && people.length > 0 && (
        <div className="ext-voters-list" style={{ marginTop: 12 }}>
          {people.map((p) => (
            <button key={p.id} type="button" className="ext-voter-row" style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => pick(p)}>
              <div className="ext-voter-row-top">
                <div>
                  <b>{p.apellido_nombre}</b>
                  <span className="dni-small">DNI {p.dni} {p.mesa ? `· Mesa ${p.mesa}` : ""}</span>
                </div>
                {p.current_roles.length > 0 && <span className="badge ok">{p.current_roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="ext-voter" style={{ marginTop: 12 }}>
          <span className="dni">DNI {selected.dni}</span>
          <h3>{selected.apellido_nombre}</h3>
          <div className="role-checks" style={{ marginTop: 10 }}>
            {ROLE_OPTIONS.map((r) => (
              <label key={r.key}>
                <input type="checkbox" checked={roles.includes(r.key)} onChange={() => toggleRole(r.key)} />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button type="button" className="ext-btn secondary" onClick={() => setSelected(null)}>
              VOLVER A BUSCAR
            </button>
            <button type="button" className="ext-btn" disabled={saving || !roles.length} onClick={assign}>
              {saving ? "GUARDANDO…" : "GUARDAR ROLES"}
            </button>
          </div>
          {results.length > 0 && (
            <div className="log-list" style={{ marginTop: 14 }}>
              {results.map((r) => (
                <div key={r.role} className="log-row" style={{ cursor: "default" }}>
                  <span className={`badge ${r.status === "ok" ? "ok" : "danger"}`}>{ROLE_LABEL[r.role] ?? r.role}</span>
                  <div>
                    {r.code ? (
                      <>
                        <b>Código: {r.code}</b>
                        <p>Entregáselo junto con su DNI para que ingrese a eleccionestucuman.vercel.app/comicios</p>
                      </>
                    ) : (
                      <p>{r.message || "Rol asignado."}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
