"use client";
import { FormEvent, useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, Voter, rpc } from "./shared";
import { VoterSheet } from "./VoterSheet";

type RolePerson = {
  padron_id: number;
  dni: string;
  apellido_nombre: string;
  mesa: string | null;
  circuito_nombre: string | null;
  active: boolean;
  has_code: boolean;
  last_access_at: string | null;
};

export function RoleRoster({ token, role, label }: { token: string; role: "movilizador" | "chofer"; label: string }) {
  const [rows, setRows] = useState<RolePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<Voter[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Voter | null>(null);

  async function load(q = "") {
    setLoading(true);
    try {
      setRows(await rpc(token, "list_role_people", { p_role: role, p_query: q || null }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, role]);

  async function searchToAdd(e: FormEvent) {
    e.preventDefault();
    if (addQuery.trim().length < 2) return;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_padron`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_query: addQuery, p_limit: 20 }),
    });
    setAddResults(await response.json());
  }

  function openExisting(row: RolePerson) {
    setSelected({
      id: row.padron_id,
      dni: row.dni,
      apellido_nombre: row.apellido_nombre,
      domicilio: null,
      circuito: row.circuito_nombre || "",
      circuito_nombre: row.circuito_nombre,
      mesa: row.mesa || "",
      orden: null,
      anio_nacimiento: null,
    });
  }

  return (
    <div>
      <button className="ext-btn full" style={{ marginBottom: 14 }} onClick={() => setAddOpen((v) => !v)}>
        {addOpen ? "CANCELAR" : `+ AGREGAR ${label.toUpperCase()}`}
      </button>
      {addOpen && (
        <div className="search-card" style={{ marginBottom: 16 }}>
          <form onSubmit={searchToAdd} className="ext-field-row">
            <input placeholder="Buscar por DNI o nombre en el padrón" value={addQuery} onChange={(e) => setAddQuery(e.target.value)} />
            <button className="ext-btn">BUSCAR</button>
          </form>
          <div className="results" style={{ marginTop: 10 }}>
            {addResults.map((v) => (
              <button
                key={v.id}
                className="voter-row"
                onClick={() => {
                  setSelected(v);
                  setAddOpen(false);
                  setAddResults([]);
                  setAddQuery("");
                }}
              >
                <span className="avatar">{v.apellido_nombre.slice(0, 1)}</span>
                <div>
                  <b>{v.apellido_nombre}</b>
                  <p>
                    DNI {v.dni} · Mesa {v.mesa}
                  </p>
                </div>
                <span>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="users-search">
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(query)}
          placeholder={`Buscar ${label.toLowerCase()} por DNI o nombre`}
        />
      </label>
      <div className="results-head">
        <b>{label}</b>
        <span>{rows.length} mostrados</span>
      </div>
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !rows.length && <p className="empty">No hay {label.toLowerCase()} cargados.</p>}
      <div className="results">
        {rows.map((r) => (
          <button key={r.padron_id} className="voter-row" onClick={() => openExisting(r)}>
            <span className="avatar">{r.apellido_nombre.slice(0, 1)}</span>
            <div>
              <b>{r.apellido_nombre}</b>
              <p>
                DNI {r.dni} · Mesa {r.mesa ?? "-"} · {r.has_code ? "Código activo" : "Sin código"}
                {r.last_access_at ? ` · último acceso ${new Date(r.last_access_at).toLocaleDateString("es-AR")}` : ""}
              </p>
            </div>
            <span>›</span>
          </button>
        ))}
      </div>
      {selected && (
        <VoterSheet
          voter={selected}
          token={token}
          close={() => {
            setSelected(null);
            load(query);
          }}
        />
      )}
    </div>
  );
}
