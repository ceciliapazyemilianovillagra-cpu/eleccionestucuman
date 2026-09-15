"use client";
import { FormEvent, useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, Bloque } from "./shared";
import { useRealtime } from "./realtime";

export function Bloques({ token }: { token: string }) {
  const [rows, setRows] = useState<Bloque[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bloques?select=id,nombre,activo&order=nombre.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    setRows(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  useRealtime(["bloques"], token, load);

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bloques`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ nombre }),
    });
    setSaving(false);
    if (res.ok) {
      setNombre("");
      setMessage("Bloque agregado.");
      load();
    } else {
      setMessage("No se pudo agregar el bloque.");
    }
  }

  async function toggleActivo(b: Bloque) {
    await fetch(`${SUPABASE_URL}/rest/v1/bloques?id=eq.${b.id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !b.activo }),
    });
    load();
  }

  return (
    <div>
      <p className="ext-note" style={{ marginTop: 0 }}>
        Equipos de campaña que comparten esta misma app pero no deben ver nada del otro (por ejemplo, dos bloques partidarios distintos, aunque sean del mismo partido). Cada bloque tiene sus propios candidatos, dirigentes, movilizadores, fiscales y votantes cargados — totalmente separado de los demás bloques.
      </p>
      <form className="search-card" onSubmit={create} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <input required placeholder="Nombre del bloque" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ flex: "1 1 200px" }} />
        <button className="ext-btn" disabled={saving}>{saving ? "GUARDANDO…" : "AGREGAR"}</button>
      </form>
      {message && <p className="ext-note">{message}</p>}
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !rows.length && <p className="empty">Todavía no cargaste ningún bloque.</p>}
      <div className="log-list">
        {rows.map((b) => (
          <div key={b.id} className="log-row" style={{ cursor: "default" }}>
            <span className={`badge ${b.activo ? "ok" : "neutral"}`}>{b.activo ? "Activo" : "Inactivo"}</span>
            <div style={{ flex: 1 }}>
              <b>{b.nombre}</b>
            </div>
            <button className="ext-btn secondary" type="button" onClick={() => toggleActivo(b)}>
              {b.activo ? "DESACTIVAR" : "ACTIVAR"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
