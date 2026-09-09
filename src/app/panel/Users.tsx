"use client";
import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, UploadCloud, Download } from "lucide-react";
import { AppUser, Candidato, ManagedUser, listCandidatos, manageUsers, modules, moduleNames, roleNames } from "./shared";
import { useRealtime } from "./realtime";

const BULK_CHUNK_SIZE = 25;

type BulkRow = { email: string; user_type: "operador" | "dirigente"; allowed_modules: string[]; password?: string; error?: string };
type BulkResult = { email: string; password?: string; status: "created" | "error"; error?: string };

export function Users({ token }: { token: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<AppUser["user_type"]>("operador");
  const [allowedModules, setAllowedModules] = useState<string[]>(["padron"]);
  const [candidateId, setCandidateId] = useState<string>("");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showList, setShowList] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkMessage, setBulkMessage] = useState("");

  const visibleUsers = users.filter((user) => {
    const search = userSearch.trim().toLowerCase();
    return !search || user.email.toLowerCase().includes(search) || roleNames[user.user_type].toLowerCase().includes(search) || (user.active ? "activo" : "inactivo").includes(search);
  });

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await manageUsers(token, { action: "list" });
      setUsers(data.users || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    listCandidatos(token, true).then(setCandidatos);
  }, [token]);

  useRealtime(["app_user_roles"], token, loadUsers);

  function toggleModule(module: string) {
    setAllowedModules((current) => (current.includes(module) ? current.filter((item) => item !== module) : [...current, module]));
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await manageUsers(token, { action: "create", email, password, user_type: userType, allowed_modules: allowedModules, candidate_id: candidateId || null });
      setEmail("");
      setPassword("");
      setUserType("operador");
      setAllowedModules(["padron"]);
      setCandidateId("");
      setMessage("Usuario creado correctamente.");
      setShowCreate(false);
      setShowList(true);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(user: ManagedUser) {
    setMessage("");
    try {
      await manageUsers(token, { action: "set_active", user_id: user.user_id, active: !user.active });
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el usuario.");
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const data = [
      { correo: "juan.perez@ejemplo.com", tipo: "operador", modulos: "padron,fiscales", contraseña: "Tucuman2027!" },
      { correo: "maria.gomez@ejemplo.com", tipo: "dirigente", modulos: "padron", contraseña: "" },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    XLSX.writeFile(wb, "plantilla_usuarios.xlsx");
  }

  async function handleBulkFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBulkMessage("");
    setBulkResults([]);
    setBulkFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const rows: BulkRow[] = raw.map((r) => {
        const emailVal = String(r.correo ?? r.email ?? "").trim().toLowerCase();
        const tipoVal = String(r.tipo ?? r.user_type ?? "").trim().toLowerCase();
        const modulosVal = String(r.modulos ?? r.allowed_modules ?? "")
          .split(",")
          .map((m) => m.trim().toLowerCase())
          .filter(Boolean);
        const passwordVal = String(r["contraseña"] ?? r.contrasena ?? r.password ?? "").trim();

        let rowError = "";
        if (!/^\S+@\S+\.\S+$/.test(emailVal)) rowError = "Correo inválido";
        else if (!["operador", "dirigente"].includes(tipoVal)) rowError = "Tipo debe ser operador o dirigente";
        else if (!modulosVal.length || !modulosVal.every((m) => modules.includes(m))) rowError = "Módulos inválidos";
        else if (passwordVal && passwordVal.length < 8) rowError = "Contraseña debe tener al menos 8 caracteres";

        return {
          email: emailVal,
          user_type: (tipoVal === "dirigente" ? "dirigente" : "operador") as "operador" | "dirigente",
          allowed_modules: modulosVal,
          password: passwordVal || undefined,
          error: rowError || undefined,
        };
      });

      setBulkRows(rows);
      if (!rows.length) setBulkMessage("El archivo no tiene filas.");
    } catch {
      setBulkMessage("No se pudo leer el archivo. Usá la plantilla de ejemplo.");
    }
  }

  async function runBulkUpload() {
    const valid = bulkRows.filter((r) => !r.error);
    if (!valid.length) return;
    setBulkProcessing(true);
    setBulkProgress(0);
    setBulkResults([]);
    setBulkMessage("");
    const allResults: BulkResult[] = [];
    try {
      for (let i = 0; i < valid.length; i += BULK_CHUNK_SIZE) {
        const chunk = valid.slice(i, i + BULK_CHUNK_SIZE).map((r) => ({ email: r.email, user_type: r.user_type, allowed_modules: r.allowed_modules, password: r.password }));
        const data = await manageUsers(token, { action: "bulk_create", rows: chunk });
        allResults.push(...(data.results || []));
        setBulkResults([...allResults]);
        setBulkProgress(allResults.length);
      }
      const created = allResults.filter((r) => r.status === "created").length;
      setBulkMessage(`Listo: ${created} de ${allResults.length} usuarios creados. Guardá o exportá las contraseñas antes de cerrar esta pantalla.`);
      setShowList(true);
      await loadUsers();
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : "No se pudo completar la carga masiva.");
    } finally {
      setBulkProcessing(false);
    }
  }

  async function exportBulkResults() {
    const XLSX = await import("xlsx");
    const data = bulkResults.map((r) => ({
      Correo: r.email,
      Contraseña: r.password ?? "",
      Estado: r.status === "created" ? "Creado" : "Error",
      Detalle: r.error ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Accesos");
    XLSX.writeFile(wb, "usuarios_creados.xlsx");
  }

  async function deleteUser(user: ManagedUser) {
    if (!window.confirm(`¿Borrar el acceso de ${user.email}? Esta acción no modifica el padrón.`)) return;
    setMessage("");
    try {
      await manageUsers(token, { action: "delete", user_id: user.user_id });
      setMessage("Usuario eliminado correctamente.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el usuario.");
    }
  }

  return (
    <>
      <section className="users-content">
        <button type="button" className="collapse-toggle" onClick={() => setShowCreate((v) => !v)}>
          <span>+ CREAR USUARIO</span>
          {showCreate ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
        </button>
        {showCreate && (
          <form className="user-form" onSubmit={createUser}>
            <p className="eyebrow">NUEVO ACCESO</p>
            <h2>Crear usuario</h2>
            <label>
              Correo
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" autoComplete="off" />
            </label>
            <label>
              Contraseña
              <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
            </label>
            <label>
              Tipo de usuario
              <select value={userType} onChange={(event) => setUserType(event.target.value as AppUser["user_type"])}>
                <option value="operador">Operador</option>
                <option value="dirigente">Dirigente</option>
                <option value="administrador">Administrador</option>
                <option value="superadmin">Superadministrador</option>
              </select>
            </label>
            {userType === "dirigente" && (
              <label>
                Candidato al que pertenece
                <select required value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
                  <option value="">Elegí un candidato…</option>
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.cargo === "legislador" ? "Legislador" : c.cargo === "concejal" ? "Concejal" : "Otro"})</option>
                  ))}
                </select>
              </label>
            )}
            {userType !== "superadmin" && userType !== "administrador" && (
              <fieldset>
                <legend>Módulos habilitados</legend>
                <div className="module-checks">
                  {modules.map((module) => (
                    <label key={module}>
                      <input type="checkbox" checked={allowedModules.includes(module)} onChange={() => toggleModule(module)} />
                      <span>{moduleNames[module]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {(userType === "superadmin" || userType === "administrador") && <p className="admin-note">Tiene acceso a todos los módulos.</p>}
            <button disabled={saving}>{saving ? "CREANDO…" : "CREAR USUARIO"}</button>
            {message && <p className="form-message">{message}</p>}
          </form>
        )}
        <button type="button" className="collapse-toggle" onClick={() => setShowBulk((v) => !v)} style={{ marginTop: 10 }}>
          <span>+ CARGA MASIVA (EXCEL)</span>
          {showBulk ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
        </button>
        {showBulk && (
          <div className="search-card" style={{ marginTop: 10, display: "grid", gap: 12 }}>
            <p className="ext-note" style={{ margin: 0 }}>
              Para crear muchos accesos de una sola vez (operador o dirigente): descargá la plantilla, completá correo/tipo/módulos por fila, y subila acá. La columna "contraseña" es opcional: si la dejás vacía se genera una sola automáticamente. Al terminar podés exportar la lista completa (correo + contraseña) para entregarle a cada usuario.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="ext-btn secondary" onClick={downloadTemplate}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} strokeWidth={2.5} /> PLANTILLA
                </span>
              </button>
              <label className="ext-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <UploadCloud size={14} strokeWidth={2.5} /> {bulkFileName || "SUBIR ARCHIVO"}
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkFile} style={{ display: "none" }} />
              </label>
            </div>

            {bulkRows.length > 0 && !bulkResults.length && (
              <>
                <p className="ext-note" style={{ margin: 0 }}>
                  {bulkRows.filter((r) => !r.error).length} de {bulkRows.length} filas listas para crear.
                </p>
                <div className="results" style={{ maxHeight: 220, overflow: "auto" }}>
                  {bulkRows.map((r, i) => (
                    <div key={i} className="voter-row compact-row" style={{ cursor: "default" }}>
                      <b>{r.email || "(sin correo)"}</b>
                      {r.error ? <span className="badge sm danger">{r.error}</span> : <span className="badge sm ok">{roleNames[r.user_type]}</span>}
                    </div>
                  ))}
                </div>
                <button type="button" className="ext-btn full" onClick={runBulkUpload} disabled={bulkProcessing || !bulkRows.some((r) => !r.error)}>
                  {bulkProcessing ? `CREANDO… (${bulkProgress}/${bulkRows.filter((r) => !r.error).length})` : `CREAR ${bulkRows.filter((r) => !r.error).length} USUARIOS`}
                </button>
              </>
            )}

            {bulkResults.length > 0 && (
              <>
                <div className="results" style={{ maxHeight: 260, overflow: "auto" }}>
                  {bulkResults.map((r, i) => (
                    <div key={i} className="voter-row compact-row" style={{ cursor: "default" }}>
                      <b>{r.email}</b>
                      <span className={`badge sm ${r.status === "created" ? "ok" : "danger"}`}>{r.status === "created" ? "Creado" : r.error}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className="ext-btn full" onClick={exportBulkResults}>
                  EXPORTAR EXCEL CON CONTRASEÑAS
                </button>
                <button
                  type="button"
                  className="ext-btn secondary"
                  onClick={() => {
                    setBulkRows([]);
                    setBulkResults([]);
                    setBulkFileName("");
                    setBulkMessage("");
                  }}
                >
                  CARGAR OTRO ARCHIVO
                </button>
              </>
            )}
            {bulkMessage && <p className="form-message">{bulkMessage}</p>}
          </div>
        )}
        <button type="button" className="collapse-toggle" onClick={() => setShowList((v) => !v)} style={{ marginTop: 14 }}>
          <span>USUARIOS ({users.length})</span>
          {showList ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
        </button>
        {showList && (
        <>
        <label className="users-search">
          <span>⌕</span>
          <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar por correo, rol o estado" autoComplete="off" />
        </label>
        {loading ? (
          <p className="empty">Cargando usuarios…</p>
        ) : (
          <div className="users-list">
            {visibleUsers.map((user) => (
              <article className="user-row" key={user.user_id}>
                <div className="user-avatar">{user.email.slice(0, 1).toUpperCase()}</div>
                <div>
                  <b>{user.email}</b>
                  <p>
                    {roleNames[user.user_type]} · {user.active ? "Activo" : "Inactivo"}
                  </p>
                </div>
                <div className="user-actions">
                  <button className={user.active ? "status-active" : "status-inactive"} onClick={() => changeStatus(user)}>
                    {user.active ? "ACTIVO" : "INACTIVO"}
                  </button>
                  <button className="edit-user" onClick={() => setEditing(user)}>
                    EDITAR
                  </button>
                  <button className="delete-user" onClick={() => deleteUser(user)}>
                    BORRAR
                  </button>
                </div>
              </article>
            ))}
            {!visibleUsers.length && <p className="empty">No hay usuarios que coincidan.</p>}
          </div>
        )}
        </>
        )}
      </section>
      {editing && (
        <EditUserSheet
          token={token}
          user={editing}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            setMessage("Cambios guardados.");
            await loadUsers();
          }}
        />
      )}
    </>
  );
}

function EditUserSheet({ token, user, close, saved }: { token: string; user: ManagedUser; close: () => void; saved: () => Promise<void> }) {
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<AppUser["user_type"]>(user.user_type);
  const [allowedModules, setAllowedModules] = useState<string[]>(user.allowed_modules);
  const [candidateId, setCandidateId] = useState<string>(user.candidate_id ? String(user.candidate_id) : "");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCandidatos(token, true).then(setCandidatos);
  }, [token]);

  function toggleModule(module: string) {
    setAllowedModules((current) => (current.includes(module) ? current.filter((item) => item !== module) : [...current, module]));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await manageUsers(token, { action: "update", user_id: user.user_id, email, password, user_type: userType, allowed_modules: allowedModules, candidate_id: candidateId || null });
      await saved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <form className="voter-sheet edit-user-sheet" onSubmit={save} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-title">
          <div>
            <small>EDITAR ACCESO</small>
            <h2>{user.email}</h2>
          </div>
          <button type="button" onClick={close}>
            ×
          </button>
        </div>
        <label>
          Correo
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Nueva contraseña <small>(dejar vacía para conservar)</small>
          <input minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
        </label>
        <label>
          Tipo de usuario
          <select value={userType} onChange={(event) => setUserType(event.target.value as AppUser["user_type"])}>
            <option value="operador">Operador</option>
            <option value="dirigente">Dirigente</option>
            <option value="administrador">Administrador</option>
            <option value="superadmin">Superadministrador</option>
          </select>
        </label>
        {userType === "dirigente" && (
          <label>
            Candidato al que pertenece
            <select required value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
              <option value="">Elegí un candidato…</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.cargo === "legislador" ? "Legislador" : c.cargo === "concejal" ? "Concejal" : "Otro"})</option>
              ))}
            </select>
          </label>
        )}
        {userType !== "superadmin" && userType !== "administrador" && (
          <fieldset>
            <legend>Módulos habilitados</legend>
            <div className="module-checks">
              {modules.map((module) => (
                <label key={module}>
                  <input type="checkbox" checked={allowedModules.includes(module)} onChange={() => toggleModule(module)} />
                  <span>{moduleNames[module]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {userType === "superadmin" && <p className="admin-note">El superadministrador tiene acceso a todos los módulos.</p>}
        <button disabled={saving}>{saving ? "GUARDANDO…" : "GUARDAR CAMBIOS"}</button>
        {message && <p className="form-error">{message}</p>}
      </form>
    </div>
  );
}
