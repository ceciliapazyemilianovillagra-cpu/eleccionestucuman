"use client";
import { FormEvent, useEffect, useState } from "react";
import { AppUser, ManagedUser, manageUsers, modules, moduleNames, roleNames } from "./shared";

export function Users({ token }: { token: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<AppUser["user_type"]>("operador");
  const [allowedModules, setAllowedModules] = useState<string[]>(["padron"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [userSearch, setUserSearch] = useState("");

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
  }, [token]);

  function toggleModule(module: string) {
    setAllowedModules((current) => (current.includes(module) ? current.filter((item) => item !== module) : [...current, module]));
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await manageUsers(token, { action: "create", email, password, user_type: userType, allowed_modules: allowedModules });
      setEmail("");
      setPassword("");
      setUserType("operador");
      setAllowedModules(["padron"]);
      setMessage("Usuario creado correctamente.");
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
              <option value="superadmin">Superadministrador</option>
            </select>
          </label>
          {userType !== "superadmin" && (
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
          <button disabled={saving}>{saving ? "CREANDO…" : "CREAR USUARIO"}</button>
          {message && <p className="form-message">{message}</p>}
        </form>
        <div className="users-list-head">
          <div>
            <p className="eyebrow">ACCESOS CREADOS</p>
            <h2>Usuarios</h2>
          </div>
          <span>{users.length}</span>
        </div>
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
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleModule(module: string) {
    setAllowedModules((current) => (current.includes(module) ? current.filter((item) => item !== module) : [...current, module]));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await manageUsers(token, { action: "update", user_id: user.user_id, email, password, user_type: userType, allowed_modules: allowedModules });
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
            <option value="superadmin">Superadministrador</option>
          </select>
        </label>
        {userType !== "superadmin" && (
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
