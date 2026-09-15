"use client";
import { FormEvent, useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, Candidato, Bloque, Voter, listBloques } from "./shared";
import { useRealtime } from "./realtime";

const CARGO_LABEL: Record<string, string> = { legislador: "Legislador", concejal: "Concejal", delegado_comunal: "Delegado comunal", otro: "Otro" };

export function Candidatos({ token }: { token: string }) {
  const [rows, setRows] = useState<Candidato[]>([]);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [dniQuery, setDniQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Voter[]>([]);
  const [selected, setSelected] = useState<Voter | null>(null);
  const [cargo, setCargo] = useState<Candidato["cargo"]>("legislador");
  const [bloqueId, setBloqueId] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCargo, setEditCargo] = useState<Candidato["cargo"]>("legislador");
  const [editBloqueId, setEditBloqueId] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidatos?select=id,nombre,cargo,activo,bloque_id,dni&order=nombre.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    setRows(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    listBloques(token, true).then((list) => {
      setBloques(list);
      setBloqueId((current) => current || (list[0] ? String(list[0].id) : ""));
    });
  }, [token]);

  useRealtime(["candidatos"], token, load);

  async function searchDni(e: FormEvent) {
    e.preventDefault();
    if (dniQuery.trim().length < 2) return;
    setSearching(true);
    setMessage("");
    setSelected(null);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_padron`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_query: dniQuery, p_limit: 20 }),
      });
      setSearchResults(response.ok ? await response.json() : []);
    } finally {
      setSearching(false);
    }
  }

  function pick(v: Voter) {
    setSelected(v);
    setSearchResults([]);
    setDniQuery("");
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setMessage("Buscá y elegí a la persona por DNI.");
      return;
    }
    if (!bloqueId) {
      setMessage("Elegí a qué bloque pertenece este candidato.");
      return;
    }
    setSaving(true);
    setMessage("");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidatos`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ nombre: selected.apellido_nombre, dni: selected.dni, padron_id: selected.id, cargo, bloque_id: Number(bloqueId) }),
    });
    setSaving(false);
    if (res.ok) {
      setSelected(null);
      setCargo("legislador");
      setMessage("Candidato agregado.");
      load();
    } else {
      setMessage("No se pudo agregar el candidato (¿ya existe con ese DNI?).");
    }
  }

  async function toggleActivo(c: Candidato) {
    await fetch(`${SUPABASE_URL}/rest/v1/candidatos?id=eq.${c.id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !c.activo }),
    });
    load();
  }

  function startEdit(c: Candidato) {
    setEditingId(c.id);
    setEditCargo(c.cargo);
    setEditBloqueId(c.bloque_id ? String(c.bloque_id) : "");
    setMessage("");
  }

  async function saveEdit(id: number) {
    if (!editBloqueId) {
      setMessage("Elegí a qué bloque pertenece este candidato.");
      return;
    }
    const original = rows.find((r) => r.id === id);
    const changingBloque = original && String(original.bloque_id ?? "") !== editBloqueId;
    if (changingBloque) {
      const countRes = await fetch(`${SUPABASE_URL}/rest/v1/person_roles?select=id&candidate_id=eq.${id}&active=is.true&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, Prefer: "count=exact" },
      });
      const range = countRes.headers.get("content-range");
      const count = range ? Number(range.split("/")[1]) : 0;
      if (count > 0) {
        setMessage("Este candidato ya tiene equipo cargado (dirigentes, movilizadores, etc.) — no se puede cambiar de bloque sin dejar datos viejos apuntando al bloque anterior. Creá un candidato nuevo en el bloque correcto en su lugar.");
        return;
      }
    }
    setSaving(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidatos?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cargo: editCargo, bloque_id: Number(editBloqueId) }),
    });
    setSaving(false);
    if (res.ok) {
      setEditingId(null);
      load();
    } else {
      setMessage("No se pudo guardar el cambio.");
    }
  }

  async function remove(c: Candidato) {
    if (!window.confirm(`¿Borrar al candidato "${c.nombre}"? Esto no se puede deshacer.`)) return;
    setDeletingId(c.id);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidatos?id=eq.${c.id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    setDeletingId(null);
    if (res.ok) {
      setMessage("Candidato borrado.");
      load();
    } else {
      setMessage("No se pudo borrar: este candidato ya tiene dirigentes, roles o votantes cargados. Desactivalo en vez de borrarlo, o primero reasigná/borrá lo que tiene adentro.");
    }
  }

  return (
    <div>
      <p className="ext-note" style={{ marginTop: 0 }}>
        Candidatos que comparten esta app (por ejemplo, uno a legislador y otro a concejal de la misma lista). Al crear un dirigente en Usuarios, elegís a qué candidato pertenece, y esa asignación se hereda en cascada a los movilizadores/choferes/fiscales a los que ese dirigente les dé un código.
      </p>

      {!selected ? (
        <form className="search-card" onSubmit={searchDni} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <input required placeholder="Buscar por DNI o nombre en el padrón" value={dniQuery} onChange={(e) => setDniQuery(e.target.value)} style={{ flex: "1 1 220px" }} />
          <button className="ext-btn" disabled={searching}>{searching ? "BUSCANDO…" : "BUSCAR"}</button>
        </form>
      ) : (
        <div className="search-card" style={{ marginBottom: 12 }}>
          <p className="ext-note" style={{ margin: "0 0 8px" }}>
            Candidato elegido: <b>{selected.apellido_nombre}</b> · DNI {selected.dni}{" "}
            <button type="button" className="ext-btn secondary" style={{ marginLeft: 8, padding: "4px 10px", fontSize: 11 }} onClick={() => setSelected(null)}>
              CAMBIAR
            </button>
          </p>
          <form onSubmit={create} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <select value={cargo} onChange={(e) => setCargo(e.target.value as Candidato["cargo"])}>
              <option value="legislador">Legislador</option>
              <option value="concejal">Concejal</option>
              <option value="delegado_comunal">Delegado comunal</option>
              <option value="otro">Otro</option>
            </select>
            <select required value={bloqueId} onChange={(e) => setBloqueId(e.target.value)}>
              <option value="" disabled>Bloque…</option>
              {bloques.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
            <button className="ext-btn" disabled={saving}>{saving ? "GUARDANDO…" : "AGREGAR CANDIDATO"}</button>
          </form>
        </div>
      )}

      {!selected && searchResults.length > 0 && (
        <div className="results" style={{ marginBottom: 16 }}>
          {searchResults.map((v) => (
            <button key={v.id} className="voter-row compact" type="button" onClick={() => pick(v)}>
              <span className="avatar">{v.apellido_nombre.slice(0, 1)}</span>
              <div>
                <b>{v.apellido_nombre}</b>
                <p>DNI {v.dni} · Mesa {v.mesa}</p>
              </div>
              <span>›</span>
            </button>
          ))}
        </div>
      )}

      {message && <p className="ext-note">{message}</p>}
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !rows.length && <p className="empty">Todavía no cargaste ningún candidato.</p>}
      <div className="log-list">
        {rows.map((c) => (
          <div key={c.id} className="log-row" style={{ cursor: "default", flexWrap: "wrap" }}>
            <span className={`badge ${c.activo ? "ok" : "neutral"}`}>{c.activo ? "Activo" : "Inactivo"}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <b>{c.nombre}</b>
              {editingId === c.id ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  <select value={editCargo} onChange={(e) => setEditCargo(e.target.value as Candidato["cargo"])}>
                    <option value="legislador">Legislador</option>
                    <option value="concejal">Concejal</option>
                    <option value="delegado_comunal">Delegado comunal</option>
                    <option value="otro">Otro</option>
                  </select>
                  <select value={editBloqueId} onChange={(e) => setEditBloqueId(e.target.value)}>
                    <option value="" disabled>Bloque…</option>
                    {bloques.map((b) => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p>
                  {c.dni ? `DNI ${c.dni} · ` : ""}
                  {CARGO_LABEL[c.cargo]} · {bloques.find((b) => b.id === c.bloque_id)?.nombre ?? "Sin bloque"}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {editingId === c.id ? (
                <>
                  <button className="ext-btn" type="button" disabled={saving} onClick={() => saveEdit(c.id)}>
                    {saving ? "GUARDANDO…" : "GUARDAR"}
                  </button>
                  <button className="ext-btn secondary" type="button" onClick={() => setEditingId(null)}>
                    CANCELAR
                  </button>
                </>
              ) : (
                <>
                  <button className="ext-btn secondary" type="button" onClick={() => startEdit(c)}>
                    EDITAR
                  </button>
                  <button className="ext-btn secondary" type="button" onClick={() => toggleActivo(c)}>
                    {c.activo ? "DESACTIVAR" : "ACTIVAR"}
                  </button>
                  <button className="ext-btn warn" type="button" disabled={deletingId === c.id} onClick={() => remove(c)}>
                    {deletingId === c.id ? "…" : "BORRAR"}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
