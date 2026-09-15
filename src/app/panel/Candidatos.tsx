"use client";
import { FormEvent, useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, Candidato, Bloque, listBloques } from "./shared";
import { useRealtime } from "./realtime";

const CARGO_LABEL: Record<string, string> = { legislador: "Legislador", concejal: "Concejal", delegado_comunal: "Delegado comunal", otro: "Otro" };

export function Candidatos({ token }: { token: string }) {
  const [rows, setRows] = useState<Candidato[]>([]);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState<Candidato["cargo"]>("legislador");
  const [bloqueId, setBloqueId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidatos?select=id,nombre,cargo,activo,bloque_id&order=nombre.asc`, {
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

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!bloqueId) {
      setMessage("Elegí a qué bloque pertenece este candidato.");
      return;
    }
    setSaving(true);
    setMessage("");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidatos`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ nombre, cargo, bloque_id: Number(bloqueId) }),
    });
    setSaving(false);
    if (res.ok) {
      setNombre("");
      setCargo("legislador");
      setMessage("Candidato agregado.");
      load();
    } else {
      setMessage("No se pudo agregar el candidato.");
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

  return (
    <div>
      <p className="ext-note" style={{ marginTop: 0 }}>
        Candidatos que comparten esta app (por ejemplo, uno a legislador y otro a concejal de la misma lista). Al crear un dirigente en Usuarios, elegís a qué candidato pertenece, y esa asignación se hereda en cascada a los movilizadores/choferes/fiscales a los que ese dirigente les dé un código.
      </p>
      <form className="search-card" onSubmit={create} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <input required placeholder="Nombre del candidato" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ flex: "1 1 200px" }} />
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
        <button className="ext-btn" disabled={saving}>{saving ? "GUARDANDO…" : "AGREGAR"}</button>
      </form>
      {message && <p className="ext-note">{message}</p>}
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !rows.length && <p className="empty">Todavía no cargaste ningún candidato.</p>}
      <div className="log-list">
        {rows.map((c) => (
          <div key={c.id} className="log-row" style={{ cursor: "default" }}>
            <span className={`badge ${c.activo ? "ok" : "neutral"}`}>{c.activo ? "Activo" : "Inactivo"}</span>
            <div style={{ flex: 1 }}>
              <b>{c.nombre}</b>
              <p>
                {CARGO_LABEL[c.cargo]} · {bloques.find((b) => b.id === c.bloque_id)?.nombre ?? "Sin bloque"}
              </p>
            </div>
            <button className="ext-btn secondary" type="button" onClick={() => toggleActivo(c)}>
              {c.activo ? "DESACTIVAR" : "ACTIVAR"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
