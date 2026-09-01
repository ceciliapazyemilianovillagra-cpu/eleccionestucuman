"use client";

import { FormEvent, useEffect, useState } from "react";

const SUPABASE_URL = "https://hhdxnkjchncupvbksklf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoZHhua2pjaG5jdXB2Ymtza2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMzkzNTIsImV4cCI6MjEwMzgxNTM1Mn0.kbqZDu8aifd2plMz0uZ-BNvUXbmAUGN7tQidd5HWGpc";

type Voter = { id: number; dni: string; apellido_nombre: string; domicilio: string | null; circuito: string; circuito_nombre: string | null; mesa: string; orden: number | null; anio_nacimiento: number | null };

export default function Home() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [moduleOpen, setModuleOpen] = useState(false);

  useEffect(() => { setToken(sessionStorage.getItem("et_token") || ""); }, []);

  async function login(event: FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok) return setError("Correo o contraseña incorrectos.");
    sessionStorage.setItem("et_token", data.access_token); setToken(data.access_token);
  }

  if (!token) return <Login email={email} password={password} error={error} setEmail={setEmail} setPassword={setPassword} submit={login} />;
  if (moduleOpen) return <Padron token={token} close={() => setModuleOpen(false)} />;

  return <main className="app-shell"><section className="mobile-page"><header className="topbar"><div className="brand"><img src="/icon.svg" alt="Logo"/><div><small>ELECCIONES</small><h1>TUCUMÁN</h1></div></div><button className="logout" onClick={() => { sessionStorage.clear(); setToken(""); }}>Salir</button></header><div className="welcome"><p>Panel principal</p><h2>Buen día, Emiliano</h2></div><section className="module-section"><div className="section-title"><h3>Módulos</h3><span>1 disponible</span></div><button className="module-card" onClick={() => setModuleOpen(true)}><span className="module-icon">⌕</span><div><b>PADRÓN</b><p>Buscar, consultar y editar votantes</p></div><span className="arrow">›</span></button></section><nav className="bottom-nav"><b>⌂<small>Inicio</small></b><span>⌕<small>Padrón</small></span><span>◎<small>Perfil</small></span></nav></section></main>;
}

function Login({email,password,error,setEmail,setPassword,submit}:{email:string;password:string;error:string;setEmail:(v:string)=>void;setPassword:(v:string)=>void;submit:(e:FormEvent)=>void}) {
  return <main className="login-page"><form className="login-card" onSubmit={submit}><img className="login-logo" src="/icon.svg" alt="Logo Elecciones Tucumán"/><h1>Elecciones Tucumán</h1><p>Ingresá</p><label>Correo<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Contraseña<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{error&&<div className="form-error">{error}</div>}<button>INGRESAR A LA APP</button></form></main>;
}

function Padron({token,close}:{token:string;close:()=>void}) {
  const [query,setQuery]=useState(""); const [circuit,setCircuit]=useState(""); const [table,setTable]=useState(""); const [rows,setRows]=useState<Voter[]>([]); const [loading,setLoading]=useState(false); const [selected,setSelected]=useState<Voter|null>(null); const [message,setMessage]=useState("");
  async function search(event?:FormEvent){event?.preventDefault();setLoading(true);setMessage("");const endpoint=new URL(`${SUPABASE_URL}/rest/v1/padron`);endpoint.searchParams.set("select","id,dni,apellido_nombre,domicilio,circuito,circuito_nombre,mesa,orden,anio_nacimiento");endpoint.searchParams.set("limit","50");endpoint.searchParams.set("order","apellido_nombre.asc");const clean=query.trim();if(clean) endpoint.searchParams.set("or",/^\d+$/.test(clean)?`(dni.eq.${clean},apellido_nombre.ilike.*${clean}*)`:`(apellido_nombre.ilike.*${clean}*)`);if(circuit.trim())endpoint.searchParams.set("circuito",`eq.${circuit.trim()}`);if(table.trim())endpoint.searchParams.set("mesa",`eq.${table.trim()}`);const response=await fetch(endpoint,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok){setRows([]);setMessage("No se pudo consultar el padrón.");}else{setRows(data);if(!data.length)setMessage("No encontramos coincidencias.");}setLoading(false);}
  return <main className="padron-page"><header className="padron-header"><button onClick={close}>←</button><div><small>MÓDULO</small><h1>PADRÓN</h1></div><img src="/icon.svg" alt="Logo"/></header><section className="padron-content"><form className="search-card" onSubmit={search}><label>Buscar votante<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="DNI o apellido y nombre"/></label><div className="filters"><label>Circuito<input value={circuit} onChange={e=>setCircuit(e.target.value)} placeholder="Ej. 1"/></label><label>Mesa<input value={table} onChange={e=>setTable(e.target.value)} placeholder="Ej. 120"/></label></div><button>{loading?"BUSCANDO…":"BUSCAR"}</button></form><div className="results-head"><b>Resultados</b><span>{rows.length} mostrados</span></div>{message&&<p className="empty">{message}</p>}<div className="results">{rows.map(v=><button key={v.id} className="voter-row" onClick={()=>setSelected(v)}><span className="avatar">{v.apellido_nombre.slice(0,1)}</span><div><b>{v.apellido_nombre}</b><p>DNI {v.dni} · Mesa {v.mesa}</p></div><span>›</span></button>)}</div></section>{selected&&<VoterSheet voter={selected} token={token} close={()=>setSelected(null)}/>}</main>;
}

function VoterSheet({voter,token,close}:{voter:Voter;token:string;close:()=>void}) {
  const [phone,setPhone]=useState(""); const [status,setStatus]=useState("sin_contactar"); const [notes,setNotes]=useState(""); const [saved,setSaved]=useState("");
  useEffect(()=>{fetch(`${SUPABASE_URL}/rest/v1/voter_profiles?select=telefono,estado,observaciones&padron_id=eq.${voter.id}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(d?.[0]){setPhone(d[0].telefono||"");setStatus(d[0].estado||"sin_contactar");setNotes(d[0].observaciones||"");}})},[voter.id,token]);
  async function save(){setSaved("Guardando…");const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_voter_profile`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({p_padron_id:voter.id,p_telefono:phone,p_estado:status,p_observaciones:notes})});setSaved(r.ok?"Cambios guardados":"No se pudo guardar");}
  return <div className="sheet-backdrop" onClick={close}><section className="voter-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-grab"/><div className="sheet-title"><div><small>FICHA DEL VOTANTE</small><h2>{voter.apellido_nombre}</h2></div><button onClick={close}>×</button></div><dl><div><dt>DNI</dt><dd>{voter.dni}</dd></div><div><dt>Domicilio</dt><dd>{voter.domicilio||"Sin dato"}</dd></div><div><dt>Circuito</dt><dd>{voter.circuito_nombre||voter.circuito}</dd></div><div><dt>Mesa / Orden</dt><dd>{voter.mesa} / {voter.orden??"-"}</dd></div></dl><div className="profile-form"><label>Teléfono<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="381 000 0000"/></label><label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}><option value="sin_contactar">Sin contactar</option><option value="contactado">Contactado</option><option value="confirmado">Confirmado</option><option value="no_contactar">No contactar</option></select></label><label>Observaciones<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label><button onClick={save}>GUARDAR CAMBIOS</button>{saved&&<p>{saved}</p>}</div></section></div>;
}
