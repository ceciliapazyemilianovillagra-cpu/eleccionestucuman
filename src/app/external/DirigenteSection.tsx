"use client";
import { FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { callFn } from "./api";

type Person = { id: number; dni: string; apellido_nombre: string; mesa: string | null; circuito_nombre: string | null; current_roles: string[] };
type Assigned = { padron_id: number; roles: string[]; dni: string; apellido_nombre: string; has_code: boolean; disputed: boolean | null };
type RoleResult = { role: string; status: string; message?: string };
type Credential = { status: "created" | "existing" | "none"; code: string | null };

const ROLE_OPTIONS = [
  { key: "movilizador", label: "Movilizador" },
  { key: "chofer", label: "Chofer" },
  { key: "fiscal_general", label: "Fiscal general" },
  { key: "fiscal_mesa", label: "Fiscal de mesa" },
  { key: "fiscal_suplente", label: "Fiscal suplente" },
  { key: "colaborador", label: "Votante" },
  { key: "colaborador_comicio", label: "Colaborador de comicio" },
] as const;

const NEEDS_CODE_ROLES = ["movilizador", "chofer", "fiscal_general", "fiscal_mesa", "fiscal_suplente"];
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.key, r.label]));

export function DirigenteSection({ token }: { token: string }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [telefono, setTelefono] = useState("");
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<RoleResult[]>([]);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [msg, setMsg] = useState("");

  const [assignedList, setAssignedList] = useState<Assigned[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetCode, setResetCode] = useState<{ padron_id: number; code: string } | null>(null);
  const [listFilter, setListFilter] = useState("");

  async function loadAssigned() {
    setListLoading(true);
    const d = await callFn("comicios", token, { action: "dirigente_list_assigned" });
    setAssignedList(d.people || []);
    setListLoading(false);
  }

  useEffect(() => {
    loadAssigned();
  }, [token]);

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setMsg("");
    setSelected(null);
    setResults([]);
    setCredential(null);
    const d = await callFn("comicios", token, { action: "dirigente_search", query });
    setSearching(false);
    setPeople(d.people || []);
    if (!d.people?.length) setMsg("No encontramos a nadie con ese dato.");
  }

  function pick(p: Person) {
    setSelected(p);
    setRoles(p.current_roles.filter((r) => ROLE_OPTIONS.some((o) => o.key === r)));
    setTelefono("");
    setResults([]);
    setCredential(null);
  }

  function toggleRole(role: string) {
    setRoles((cur) => (cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]));
  }

  async function assign() {
    if (!selected || !roles.length) return;
    setSaving(true);
    const d = await callFn("comicios", token, { action: "dirigente_assign_roles", padron_id: selected.id, roles, telefono });
    setSaving(false);
    setResults(d.results || []);
    setCredential(d.credential || null);
    loadAssigned();
  }

  async function resetCredential(padronId: number) {
    setResettingId(padronId);
    const d = await callFn("comicios", token, { action: "dirigente_reset_code", padron_id: padronId });
    setResettingId(null);
    if (d.code) setResetCode({ padron_id: padronId, code: d.code });
  }

  const filteredAssigned = assignedList.filter((a) => {
    if (!listFilter.trim()) return true;
    const q = listFilter.toLowerCase();
    return a.dni.includes(q) || a.apellido_nombre.toLowerCase().includes(q);
  });

  return (
    <>
      <section className="ext-card">
        <h2>Asignar roles</h2>
        <p className="ext-hint">Buscá por DNI o nombre, tildá los roles que corresponden, cargá su celular y generá el código de acceso.</p>
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
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", margin: "10px 0 6px" }}>CELULAR</label>
            <input inputMode="tel" placeholder="381 000 0000" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            <div className="role-checks" style={{ marginTop: 14 }}>
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
                      <p>{r.message || "Rol asignado."}</p>
                    </div>
                  </div>
                ))}
                {credential?.status === "created" && (
                  <div className="log-row" style={{ cursor: "default", background: "#fff8e1" }}>
                    <span className="badge ok">Código único</span>
                    <div>
                      <b>{credential.code}</b>
                      <p>Entregáselo junto con su DNI para que ingrese a eleccionestucuman.vercel.app/comicios. Le sirve para todos los roles que tenga.</p>
                    </div>
                  </div>
                )}
                {credential?.status === "existing" && (
                  <div className="log-row" style={{ cursor: "default" }}>
                    <span className="badge neutral">Ya tenía código</span>
                    <div>
                      <p>Esta persona ya tenía un código de acceso de antes; sigue siendo el mismo y ahora también le habilita estos roles nuevos.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="ext-card">
        <h2>Gente que fuiste cargando</h2>
        <p className="ext-hint">Un código sirve para todos los roles de la persona. Los códigos no se pueden volver a mostrar (quedan guardados de forma segura) — si alguien lo perdió, blanqueáselo y le das el nuevo.</p>
        <button className="ext-btn secondary" style={{ marginBottom: 10 }} onClick={loadAssigned}>
          ACTUALIZAR
        </button>
        <div className="ext-list-search">
          <Search size={16} strokeWidth={2} />
          <input placeholder="Buscar por nombre o DNI en esta lista" value={listFilter} onChange={(e) => setListFilter(e.target.value)} />
        </div>
        {listLoading && <p className="ext-note">Buscando…</p>}
        {!listLoading && !filteredAssigned.length && <p className="ext-empty">{listFilter ? "Nadie coincide con esa búsqueda." : "Todavía no cargaste a nadie."}</p>}
        {resetCode && (
          <div className="log-row" style={{ cursor: "default", background: "#fff8e1", marginBottom: 10 }}>
            <span className="badge ok">Código nuevo</span>
            <div>
              <b>{resetCode.code}</b>
              <p>El código anterior de esa persona dejó de funcionar. Entregale este.</p>
            </div>
          </div>
        )}
        <div className="ext-voters-list">
          {filteredAssigned.map((p) => {
            const needsCode = p.roles.some((r) => NEEDS_CODE_ROLES.includes(r));
            return (
              <div className="ext-voter-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }} key={p.padron_id}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.apellido_nombre}</b>
                  <span className="dni-small">
                    DNI {p.dni} - {p.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "none" }}>
                  {p.disputed !== null && <span className={`badge sm ${p.disputed ? "danger" : "ok"}`}>{p.disputed ? "Reclamado" : "Único"}</span>}
                  {needsCode && <span className={`badge sm ${p.has_code ? "ok" : "danger"}`}>{p.has_code ? "Código listo" : "Sin código"}</span>}
                  {needsCode && (
                    <button
                      type="button"
                      className="ext-btn secondary"
                      style={{ padding: "6px 10px", fontSize: 11 }}
                      disabled={resettingId === p.padron_id}
                      onClick={() => resetCredential(p.padron_id)}
                    >
                      {resettingId === p.padron_id ? "…" : p.has_code ? "BLANQUEAR" : "GENERAR"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
