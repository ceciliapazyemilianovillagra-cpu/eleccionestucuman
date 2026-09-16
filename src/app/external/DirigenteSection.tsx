"use client";
import { FormEvent, useEffect, useState } from "react";
import { Search, UserCheck, Car, ShieldCheck, Users, Flag, Check, X, UserCog, MapPin } from "lucide-react";
import { callFn } from "./api";

type Person = {
  id: number;
  dni: string;
  apellido_nombre: string;
  mesa: string | null;
  circuito_nombre: string | null;
  current_roles: string[];
  current_circuito: string | null;
  current_supervisor_padron_id: number | null;
};
type Assigned = { padron_id: number; roles: string[]; dni: string; apellido_nombre: string; has_code: boolean; disputed: boolean | null };
type RoleResult = { role: string; status: string; message?: string };
type Credential = { status: "created" | "existing" | "none"; code: string | null };
type Circuito = { circuito: string; circuito_nombre: string | null };
type FiscalGeneral = { padron_id: number; apellido_nombre: string; circuito: string | null };

const ROLES_NEED_CIRCUITO = ["fiscal_general", "coordinador_circuito"];
const ROLES_NEED_SUPERVISOR = ["fiscal_mesa", "fiscal_suplente"];

const ALL_ROLE_OPTIONS = [
  { key: "dirigente", label: "Dirigente", icon: UserCog, color: "navy", adminOnly: true },
  { key: "movilizador", label: "Movilizador", icon: UserCheck, color: "blue", adminOnly: false },
  { key: "chofer", label: "Chofer", icon: Car, color: "navy", adminOnly: false },
  { key: "fiscal_general", label: "Fiscal general", icon: ShieldCheck, color: "blue", adminOnly: false },
  { key: "fiscal_mesa", label: "Fiscal de mesa", icon: ShieldCheck, color: "green", adminOnly: false },
  { key: "fiscal_suplente", label: "Fiscal suplente", icon: ShieldCheck, color: "navy", adminOnly: false },
  { key: "colaborador", label: "Votante", icon: Users, color: "navy", adminOnly: false },
  { key: "colaborador_comicio", label: "Colaborador de comicio", icon: Flag, color: "green", adminOnly: true },
  { key: "coordinador_circuito", label: "Coordinador de circuito", icon: MapPin, color: "blue", adminOnly: true },
] as const;

const NEEDS_CODE_ROLES = ["dirigente", "movilizador", "chofer", "fiscal_general", "fiscal_mesa", "fiscal_suplente", "coordinador_circuito"];
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ALL_ROLE_OPTIONS.map((r) => [r.key, r.label]));

export function DirigenteSection({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const ROLE_OPTIONS = ALL_ROLE_OPTIONS.filter((r) => isAdmin || !r.adminOnly);
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
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [circuito, setCircuito] = useState("");
  const [fiscalesGenerales, setFiscalesGenerales] = useState<FiscalGeneral[]>([]);
  const [supervisorId, setSupervisorId] = useState("");

  async function loadAssigned() {
    setListLoading(true);
    const d = await callFn("comicios", token, { action: "dirigente_list_assigned" });
    setAssignedList(d.people || []);
    setListLoading(false);
  }

  useEffect(() => {
    loadAssigned();
  }, [token]);

  const needsCircuito = roles.some((r) => ROLES_NEED_CIRCUITO.includes(r));
  const needsSupervisor = roles.some((r) => ROLES_NEED_SUPERVISOR.includes(r));

  useEffect(() => {
    if (needsCircuito && !circuitos.length) {
      callFn("comicios", token, { action: "dirigente_list_circuitos" }).then((d) => setCircuitos(d.circuitos || []));
    }
    if (needsSupervisor && !fiscalesGenerales.length) {
      callFn("comicios", token, { action: "dirigente_list_fiscales_generales" }).then((d) => setFiscalesGenerales(d.fiscales_generales || []));
    }
  }, [needsCircuito, needsSupervisor]);

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
    setCircuito(p.current_circuito ?? "");
    setSupervisorId(p.current_supervisor_padron_id ? String(p.current_supervisor_padron_id) : "");
    setResults([]);
    setCredential(null);
  }

  function toggleRole(role: string) {
    setRoles((cur) => (cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]));
  }

  async function assign() {
    if (!selected || !roles.length) return;
    setSaving(true);
    const d = await callFn("comicios", token, {
      action: "dirigente_assign_roles",
      padron_id: selected.id,
      roles,
      telefono,
      circuito: needsCircuito ? circuito : undefined,
      supervisor_padron_id: needsSupervisor ? supervisorId : undefined,
    });
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

  async function removeAssigned(padronId: number, nombre: string) {
    if (!window.confirm(`¿Eliminar a ${nombre} de tu lista? Se le sacan los roles que le asignaste.`)) return;
    setRemovingId(padronId);
    const d = await callFn("comicios", token, { action: "dirigente_remove_assigned", padron_id: padronId });
    setRemovingId(null);
    if (d.success) {
      setAssignedList((prev) => prev.filter((p) => p.padron_id !== padronId));
    } else {
      window.alert(d.error || "No se pudo eliminar.");
    }
  }

  const filteredAssigned = assignedList.filter((a) => {
    if (roleFilter && !a.roles.includes(roleFilter)) return false;
    if (!listFilter.trim()) return true;
    const q = listFilter.toLowerCase();
    return a.dni.includes(q) || a.apellido_nombre.toLowerCase().includes(q);
  });

  const roleCounts = ROLE_OPTIONS.map((opt) => ({
    ...opt,
    count: assignedList.filter((a) => a.roles.includes(opt.key)).length,
  })).filter((r) => r.count > 0);

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
            <div className="role-cards" style={{ marginTop: 14 }}>
              {ROLE_OPTIONS.map((r) => {
                const Icon = r.icon;
                const active = roles.includes(r.key);
                return (
                  <button
                    type="button"
                    key={r.key}
                    className={`role-card ${active ? "selected" : ""}`}
                    onClick={() => toggleRole(r.key)}
                  >
                    {active && (
                      <span className="role-card-check">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                    <span className={`role-card-ico ${r.color}`}>
                      <Icon size={17} strokeWidth={2} />
                    </span>
                    <b>{r.label}</b>
                  </button>
                );
              })}
            </div>
            {needsCircuito && (
              <label style={{ display: "block", marginTop: 14 }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>
                  ESCUELA / CIRCUITO A CARGO
                </span>
                <select required value={circuito} onChange={(e) => setCircuito(e.target.value)}>
                  <option value="">Elegí un circuito…</option>
                  {!roles.includes("coordinador_circuito") && <option value="PENDIENTE">Pendiente de asignación</option>}
                  {circuitos.map((c) => (
                    <option key={c.circuito} value={c.circuito}>
                      {c.circuito} {c.circuito_nombre ? `· ${c.circuito_nombre}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {needsSupervisor && (
              <label style={{ display: "block", marginTop: 14 }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>
                  REPORTA A ESTE FISCAL GENERAL
                </span>
                <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
                  <option value="">Pendiente de asignación (sin fiscal general todavía)</option>
                  {fiscalesGenerales.map((f) => (
                    <option key={f.padron_id} value={f.padron_id}>
                      {f.apellido_nombre} {f.circuito ? `· Circuito ${f.circuito}` : ""}
                    </option>
                  ))}
                </select>
                {!fiscalesGenerales.length && <p className="ext-note">Todavía no cargaste ningún fiscal general.</p>}
              </label>
            )}
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
        {roleCounts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {roleCounts.map((r) => (
              <button
                type="button"
                key={r.key}
                className="badge sm neutral"
                onClick={() => setRoleFilter((current) => (current === r.key ? null : r.key))}
                style={{
                  background: roleFilter === r.key ? "#7a5e00" : "#fff8e1",
                  color: roleFilter === r.key ? "#fff8e1" : "#7a5e00",
                  cursor: "pointer",
                  border: roleFilter === r.key ? "1px solid #7a5e00" : "1px solid transparent",
                }}
              >
                {r.label}: {r.count}
              </button>
            ))}
            {roleFilter && (
              <button type="button" className="badge sm neutral" style={{ cursor: "pointer" }} onClick={() => setRoleFilter(null)}>
                Ver todos ×
              </button>
            )}
          </div>
        )}
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
              <div className="ext-voter-row" style={{ display: "flex", flexDirection: "column", gap: 6 }} key={p.padron_id}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ display: "block", wordBreak: "break-word" }}>{p.apellido_nombre}</b>
                  <span className="dni-small" style={{ display: "block", wordBreak: "break-word" }}>
                    DNI {p.dni} - {p.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  {p.disputed !== null && <span className={`badge sm ${p.disputed ? "danger" : "ok"}`}>{p.disputed ? "Reclamado" : "Único"}</span>}
                  {needsCode && <span className={`badge sm ${p.has_code ? "ok" : "danger"}`}>{p.has_code ? "Código listo" : "Sin código"}</span>}
                  {needsCode && (
                    <button
                      type="button"
                      className="ext-btn secondary"
                      style={{ padding: "6px 10px", fontSize: 11, whiteSpace: "nowrap" }}
                      disabled={resettingId === p.padron_id}
                      onClick={() => resetCredential(p.padron_id)}
                    >
                      {resettingId === p.padron_id ? "…" : p.has_code ? "BLANQUEAR" : "GENERAR"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="ext-iconbtn-x"
                    aria-label="Eliminar"
                    disabled={removingId === p.padron_id}
                    onClick={() => removeAssigned(p.padron_id, p.apellido_nombre)}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
