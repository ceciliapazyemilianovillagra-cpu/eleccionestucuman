"use client";
import { useEffect, useState } from "react";
import { rpc } from "./shared";

type Colaborador = {
  padron_id: number;
  dni: string;
  apellido_nombre: string;
  mesa: string | null;
  circuito_nombre: string | null;
  disputed: boolean;
  loaded_by_nombre: string | null;
  loaded_by_email: string | null;
};

export function Colaboradores({ token, close }: { token: string; close: () => void }) {
  const [rows, setRows] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load(q = "") {
    setLoading(true);
    try {
      const data = await rpc(token, "list_colaboradores", { p_query: q || null });
      setRows(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  const total = rows.length;
  const disputed = rows.filter((r) => r.disputed).length;
  const unicos = total - disputed;

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = rows.map((r) => ({
      DNI: r.dni,
      "Apellido y Nombre": r.apellido_nombre,
      Mesa: r.mesa ?? "",
      Circuito: r.circuito_nombre ?? "",
      Estado: r.disputed ? "Reclamado" : "Único",
      "Cargado por": r.loaded_by_nombre ?? r.loaded_by_email ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
    XLSX.writeFile(wb, "colaboradores.xlsx");
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.text("Colaboradores", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["DNI", "Apellido y Nombre", "Mesa", "Circuito", "Estado", "Cargado por"]],
      body: rows.map((r) => [r.dni, r.apellido_nombre, r.mesa ?? "", r.circuito_nombre ?? "", r.disputed ? "Reclamado" : "Único", r.loaded_by_nombre ?? r.loaded_by_email ?? ""]),
      styles: { fontSize: 8 },
    });
    doc.save("colaboradores.pdf");
  }

  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>COLABORADORES</h1>
        </div>
        <img src="/icon.svg" alt="Logo" />
      </header>
      <section className="padron-content">
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon sky">👥</span>
            <b>{total}</b>
            <p>Cargados</p>
          </div>
          <div className="stat-card">
            <span className="stat-icon green">☑</span>
            <b>{unicos}</b>
            <p>Únicos</p>
          </div>
          <div className="stat-card">
            <span className="stat-icon orange">⚠</span>
            <b>{disputed}</b>
            <p>Reclamados</p>
          </div>
        </div>
        <form
          className="search-card"
          onSubmit={(e) => {
            e.preventDefault();
            load(query);
          }}
        >
          <label>
            Buscar colaborador
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="DNI o nombre" autoComplete="off" />
          </label>
          <button disabled={loading}>{loading ? "BUSCANDO…" : "BUSCAR"}</button>
        </form>
        <div className="results-head">
          <b>Resultados</b>
          <span>{rows.length} mostrados</span>
        </div>
        <div className="export-row">
          <button className="ext-btn secondary" type="button" onClick={exportExcel} disabled={!rows.length}>
            EXPORTAR EXCEL
          </button>
          <button className="ext-btn secondary" type="button" onClick={exportPdf} disabled={!rows.length}>
            EXPORTAR PDF
          </button>
        </div>
        {!loading && !rows.length && <p className="empty">No hay colaboradores cargados.</p>}
        <div className="results">
          {rows.map((r) => (
            <div key={r.padron_id} className="voter-row" style={{ cursor: "default" }}>
              <span className="avatar">{r.apellido_nombre.slice(0, 1)}</span>
              <div>
                <b>{r.apellido_nombre}</b>
                <p>
                  DNI {r.dni} · Mesa {r.mesa ?? "-"} · Cargado por {r.loaded_by_nombre ?? r.loaded_by_email ?? "—"}
                </p>
              </div>
              <span className={`badge ${r.disputed ? "danger" : "ok"}`}>{r.disputed ? "Reclamado" : "Único"}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
