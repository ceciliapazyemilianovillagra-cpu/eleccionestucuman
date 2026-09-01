"use client";

import { FormEvent, useEffect, useState } from "react";

const SUPABASE_URL = "https://hhdxnkjchncupvbksklf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoZHhua2pjaG5jdXB2Ymtza2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMzkzNTIsImV4cCI6MjEwMzgxNTM1Mn0.kbqZDu8aifd2plMz0uZ-BNvUXbmAUGN7tQidd5HWGpc";

type Voter = { id: number; dni: string; apellido_nombre: string; domicilio: string | null; circuito: string; circuito_nombre: string | null; mesa: string; orden: number | null; anio_nacimiento: number | null };
type AppUser = { email: string; user_type: "superadmin" | "dirigente" | "operador"; allowed_modules: string[]; active: boolean };
type ManagedUser = AppUser & { user_id: string; created_at?: string };

const modules = ["padron", "dirigentes", "fiscales", "movilizadores", "choferes", "votantes"];
const moduleNames: Record<string,string> = { padron:"Padrón", dirigentes:"Dirigentes", fiscales:"Fiscales", movilizadores:"Movilizadores", choferes:"Choferes", votantes:"Votantes" };
const roleNames: Record<AppUser["user_type"],string> = { superadmin:"Superadministrador", dirigente:"Dirigente", operador:"Operador" };

async function manageUsers(token:string, body:Record<string,unknown>) {
  const response=await fetch(`${SUPABASE_URL}/functions/v1/manage-users`,{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const data=await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

export default function Home() {
  const [token, setToken] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<AppUser|null>(null);
  const [moduleOpen, setModuleOpen] = useState<"padron"|"users"|null>(null);

  useEffect(() => {
    let active=true;

    async function restoreSession() {
      try {
        const saved=localStorage.getItem("et_session");
        if (!saved) return;

        const session=JSON.parse(saved);
        const stillValid=session.access_token && (!session.expires_at || session.expires_at*1000>Date.now()+60000);

        if (stillValid) {
          if (active) setToken(session.access_token);
          return;
        }

        if (!session.refresh_token) {
          localStorage.removeItem("et_session");
          return;
        }

        const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
          method:"POST",
          headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
          body:JSON.stringify({refresh_token:session.refresh_token})
        });
        const refreshed=await response.json();

        if (!response.ok) {
          localStorage.removeItem("et_session");
          return;
        }

        localStorage.setItem("et_session",JSON.stringify(refreshed));
        if (active) setToken(refreshed.access_token);
      } catch {
        localStorage.removeItem("et_session");
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    restoreSession();
    return ()=>{active=false;};
  }, []);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }

    let active=true;
    manageUsers(token,{action:"me"})
      .then(data=>{if(active)setCurrentUser(data.user);})
      .catch(()=>{
        localStorage.removeItem("et_session");
        if(active){setToken("");setError("Tu usuario no tiene acceso a la aplicación.");}
      });
    return ()=>{active=false;};
  }, [token]);

  async function login(event: FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok) return setError("Correo o contraseña incorrectos.");
    localStorage.setItem("et_session",JSON.stringify(data)); setToken(data.access_token);
  }

  if (checkingSession) return <main className="login-page"><img className="login-logo" src="/icon.svg" alt="Logo Elecciones Tucumán"/></main>;
  if (!token) return <Login email={email} password={password} error={error} setEmail={setEmail} setPassword={setPassword} submit={login} />;
  if (!currentUser) return <main className="login-page"><img className="login-logo" src="/icon.svg" alt="Logo Elecciones Tucumán"/></main>;
  if (moduleOpen === "padron") return <Padron token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "users") return <Users token={token} close={() => setModuleOpen(null)} />;

  const canUsePadron=currentUser.allowed_modules.includes("padron");
  const isAdmin=currentUser.user_type === "superadmin";
  return <main className="app-shell"><section className="mobile-page"><header className="topbar"><div className="brand"><img src="/icon.svg" alt="Logo"/><div><small>ELECCIONES TUCUMÁN</small><b className="brand-email">{currentUser.email}</b><span className="brand-role">{roleNames[currentUser.user_type]}</span></div></div><button className="logout" onClick={() => { localStorage.removeItem("et_session"); setToken(""); }}>Salir</button></header><section className="module-section"><div className="section-title"><h3>Módulos</h3><span>{(canUsePadron?1:0)+(isAdmin?1:0)} disponibles</span></div>{canUsePadron&&<button className="module-card" onClick={() => setModuleOpen("padron")}><span className="module-icon">⌕</span><div><b>PADRÓN</b><p>Buscar, consultar y editar votantes</p></div><span className="arrow">›</span></button>}{isAdmin&&<button className="module-card users-card" onClick={() => setModuleOpen("users")}><span className="module-icon">♙</span><div><b>USUARIOS</b><p>Crear accesos y asignar módulos</p></div><span className="arrow">›</span></button>}{!canUsePadron&&!isAdmin&&<p className="empty">No tenés módulos habilitados. Consultá al administrador.</p>}</section></section></main>;
}

function Login({email,password,error,setEmail,setPassword,submit}:{email:string;password:string;error:string;setEmail:(v:string)=>void;setPassword:(v:string)=>void;submit:(e:FormEvent)=>void}) {
  return <main className="login-page"><form className="login-card" onSubmit={submit}><img className="login-logo" src="/icon.svg" alt="Logo Elecciones Tucumán"/><h1>Elecciones Tucumán</h1><p>Ingresá</p><label>Correo<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Contraseña<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{error&&<div className="form-error">{error}</div>}<button>INGRESAR A LA APP</button></form></main>;
}

function Users({token,close}:{token:string;close:()=>void}) {
  const [users,setUsers]=useState<ManagedUser[]>([]);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [userType,setUserType]=useState<AppUser["user_type"]>("operador");
  const [allowedModules,setAllowedModules]=useState<string[]>(["padron"]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [editing,setEditing]=useState<ManagedUser|null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const data=await manageUsers(token,{action:"list"});
      setUsers(data.users || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{loadUsers();},[token]);

  function toggleModule(module:string) {
    setAllowedModules(current=>current.includes(module) ? current.filter(item=>item!==module) : [...current,module]);
  }

  async function createUser(event:FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await manageUsers(token,{action:"create",email,password,user_type:userType,allowed_modules:allowedModules});
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

  async function changeStatus(user:ManagedUser) {
    setMessage("");
    try {
      await manageUsers(token,{action:"set_active",user_id:user.user_id,active:!user.active});
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el usuario.");
    }
  }

  async function deleteUser(user:ManagedUser) {
    if (!window.confirm(`¿Borrar el acceso de ${user.email}? Esta acción no modifica el padrón.`)) return;
    setMessage("");
    try {
      await manageUsers(token,{action:"delete",user_id:user.user_id});
      setMessage("Usuario eliminado correctamente.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el usuario.");
    }
  }

  return <main className="users-page"><header className="padron-header"><button onClick={close}>←</button><div><small>MÓDULO</small><h1>USUARIOS</h1></div><img src="/icon.svg" alt="Logo"/></header><section className="users-content"><form className="user-form" onSubmit={createUser}><p className="eyebrow">NUEVO ACCESO</p><h2>Crear usuario</h2><label>Correo<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="correo@ejemplo.com" autoComplete="off"/></label><label>Contraseña<input required minLength={8} type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password"/></label><label>Tipo de usuario<select value={userType} onChange={event=>setUserType(event.target.value as AppUser["user_type"])}><option value="operador">Operador</option><option value="dirigente">Dirigente</option><option value="superadmin">Superadministrador</option></select></label>{userType!=="superadmin"&&<fieldset><legend>Módulos habilitados</legend><div className="module-checks">{modules.map(module=><label key={module}><input type="checkbox" checked={allowedModules.includes(module)} onChange={()=>toggleModule(module)}/><span>{moduleNames[module]}</span></label>)}</div></fieldset>}{userType==="superadmin"&&<p className="admin-note">El superadministrador tiene acceso a todos los módulos.</p>}<button disabled={saving}>{saving?"CREANDO…":"CREAR USUARIO"}</button>{message&&<p className="form-message">{message}</p>}</form><div className="users-list-head"><div><p className="eyebrow">ACCESOS CREADOS</p><h2>Usuarios</h2></div><span>{users.length}</span></div>{loading?<p className="empty">Cargando usuarios…</p>:<div className="users-list">{users.map(user=><article className="user-row" key={user.user_id}><div className="user-avatar">{user.email.slice(0,1).toUpperCase()}</div><div><b>{user.email}</b><p>{roleNames[user.user_type]} · {user.active?"Activo":"Inactivo"}</p><small>{user.user_type==="superadmin"?"Todos los módulos":user.allowed_modules.map(module=>moduleNames[module]||module).join(" · ")}</small></div><div className="user-actions"><button className={user.active?"status-active":"status-inactive"} onClick={()=>changeStatus(user)}>{user.active?"ACTIVO":"INACTIVO"}</button><button className="edit-user" onClick={()=>setEditing(user)}>EDITAR</button><button className="delete-user" onClick={()=>deleteUser(user)}>BORRAR</button></div></article>)}</div>}</section>{editing&&<EditUserSheet token={token} user={editing} close={()=>setEditing(null)} saved={async()=>{setEditing(null);setMessage("Cambios guardados.");await loadUsers();}}/>}</main>;
}

function EditUserSheet({token,user,close,saved}:{token:string;user:ManagedUser;close:()=>void;saved:()=>Promise<void>}) {
  const [email,setEmail]=useState(user.email);
  const [password,setPassword]=useState("");
  const [userType,setUserType]=useState<AppUser["user_type"]>(user.user_type);
  const [allowedModules,setAllowedModules]=useState<string[]>(user.allowed_modules);
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);

  function toggleModule(module:string) {
    setAllowedModules(current=>current.includes(module) ? current.filter(item=>item!==module) : [...current,module]);
  }

  async function save(event:FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await manageUsers(token,{action:"update",user_id:user.user_id,email,password,user_type:userType,allowed_modules:allowedModules});
      await saved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="sheet-backdrop" onClick={close}><form className="voter-sheet edit-user-sheet" onSubmit={save} onClick={event=>event.stopPropagation()}><div className="sheet-grab"/><div className="sheet-title"><div><small>EDITAR ACCESO</small><h2>{user.email}</h2></div><button type="button" onClick={close}>×</button></div><label>Correo<input required type="email" value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Nueva contraseña <small>(dejar vacía para conservar)</small><input minLength={8} type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password"/></label><label>Tipo de usuario<select value={userType} onChange={event=>setUserType(event.target.value as AppUser["user_type"])}><option value="operador">Operador</option><option value="dirigente">Dirigente</option><option value="superadmin">Superadministrador</option></select></label>{userType!=="superadmin"&&<fieldset><legend>Módulos habilitados</legend><div className="module-checks">{modules.map(module=><label key={module}><input type="checkbox" checked={allowedModules.includes(module)} onChange={()=>toggleModule(module)}/><span>{moduleNames[module]}</span></label>)}</div></fieldset>}{userType==="superadmin"&&<p className="admin-note">El superadministrador tiene acceso a todos los módulos.</p>}<button disabled={saving}>{saving?"GUARDANDO…":"GUARDAR CAMBIOS"}</button>{message&&<p className="form-error">{message}</p>}</form></div>;
}

function Padron({token,close}:{token:string;close:()=>void}) {
  const [query,setQuery]=useState("");
  const [rows,setRows]=useState<Voter[]>([]);
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState<Voter|null>(null);
  const [message,setMessage]=useState("Buscá por DNI completo, apellido o nombre.");

  async function search(event?:FormEvent) {
    event?.preventDefault();
    const clean=query.trim();

    if (clean.length < 2) {
      setRows([]);
      setMessage("Escribí al menos 2 caracteres para buscar.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_padron`,{
        method:"POST",
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:`Bearer ${token}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({p_query:clean,p_limit:50})
      });
      const data=await response.json();

      if (!response.ok) {
        setRows([]);
        setMessage("No se pudo consultar el padrón. Intentá nuevamente.");
        return;
      }

      setRows(data);
      if (!data.length) setMessage("No encontramos coincidencias.");
    } catch {
      setRows([]);
      setMessage("No hay conexión. Revisá internet e intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="padron-page"><header className="padron-header"><button onClick={close}>←</button><div><small>MÓDULO</small><h1>PADRÓN</h1></div><img src="/icon.svg" alt="Logo"/></header><section className="padron-content"><form className="search-card" onSubmit={search}><label>Buscar votante<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="DNI, apellido o nombre" inputMode="search" autoComplete="off" autoFocus/></label><button disabled={loading}>{loading?"BUSCANDO…":"BUSCAR"}</button></form><div className="results-head"><b>Resultados</b><span>{rows.length} mostrados</span></div>{message&&<p className="empty">{message}</p>}<div className="results">{rows.map(v=><button key={v.id} className="voter-row" onClick={()=>setSelected(v)}><span className="avatar">{v.apellido_nombre.slice(0,1)}</span><div><b>{v.apellido_nombre}</b><p>DNI {v.dni} · Mesa {v.mesa}</p></div><span>›</span></button>)}</div></section>{selected&&<VoterSheet voter={selected} token={token} close={()=>setSelected(null)}/>}</main>;
}

function VoterSheet({voter,token,close}:{voter:Voter;token:string;close:()=>void}) {
  const [phone,setPhone]=useState(""); const [status,setStatus]=useState("sin_contactar"); const [notes,setNotes]=useState(""); const [saved,setSaved]=useState("");
  useEffect(()=>{fetch(`${SUPABASE_URL}/rest/v1/voter_profiles?select=telefono,estado,observaciones&padron_id=eq.${voter.id}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(d?.[0]){setPhone(d[0].telefono||"");setStatus(d[0].estado||"sin_contactar");setNotes(d[0].observaciones||"");}})},[voter.id,token]);
  async function save(){setSaved("Guardando…");const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_voter_profile`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({p_padron_id:voter.id,p_telefono:phone,p_estado:status,p_observaciones:notes})});setSaved(r.ok?"Cambios guardados":"No se pudo guardar");}
  return <div className="sheet-backdrop" onClick={close}><section className="voter-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-grab"/><div className="sheet-title"><div><small>FICHA DEL VOTANTE</small><h2>{voter.apellido_nombre}</h2></div><button onClick={close}>×</button></div><dl><div><dt>DNI</dt><dd>{voter.dni}</dd></div><div><dt>Domicilio</dt><dd>{voter.domicilio||"Sin dato"}</dd></div><div><dt>Circuito</dt><dd>{voter.circuito_nombre||voter.circuito}</dd></div><div><dt>Mesa / Orden</dt><dd>{voter.mesa} / {voter.orden??"-"}</dd></div></dl><div className="profile-form"><label>Teléfono<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="381 000 0000"/></label><label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}><option value="sin_contactar">Sin contactar</option><option value="contactado">Contactado</option><option value="confirmado">Confirmado</option><option value="no_contactar">No contactar</option></select></label><label>Observaciones<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label><button onClick={save}>GUARDAR CAMBIOS</button>{saved&&<p>{saved}</p>}</div></section></div>;
}

