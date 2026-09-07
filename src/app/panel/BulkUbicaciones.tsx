"use client";
import { useEffect, useState } from "react";
import { UploadCloud, Download, Trash2, Pencil } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, decodeJwtSub } from "./shared";

const TYPE_LABELS: Record<string, string> = { bunker: "Bunker", punto_caliente: "Punto caliente", otro: "Otro" };
const VALID_TYPES = Object.keys(TYPE_LABELS);
const CHUNK_SIZE = 50;

type MapPoint = { id: number; type: string; label: string; description: string | null; latitude: number; longitude: number };
type ParsedRow = { type: string; label: string; description: string; latitude: number; longitude: number; error?: string };

export function BulkUbicaciones({ token }: { token: string }) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState("otro");
  const [editDescription, setEditDescription] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/map_points?select=*&order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      });
      setPoints(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const data = [
      { tipo: "bunker", etiqueta: "Bunker Circuito 4", descripcion: "Sede de campaña", latitud: -26.8241, longitud: -65.2226 },
      { tipo: "punto_caliente", etiqueta: "Esquina conflictiva", descripcion: "", latitud: -26.83, longitud: -65.21 },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.sheet_add_aoa(ws, [[`Tipos válidos: ${VALID_TYPES.join(", ")}`]], { origin: "G1" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ubicaciones");
    XLSX.writeFile(wb, "plantilla_ubicaciones.xlsx");
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsed: ParsedRow[] = raw
        .filter((r) => String(r.etiqueta ?? r.label ?? "").trim() !== "")
        .map((r) => {
          const type = String(r.tipo ?? r.type ?? "").trim().toLowerCase();
          const label = String(r.etiqueta ?? r.label ?? "").trim();
          const description = String(r.descripcion ?? r.description ?? "").trim();
          const latitude = Number(r.latitud ?? r.latitude);
          const longitude = Number(r.longitud ?? r.longitude);
          let error = "";
          if (!VALID_TYPES.includes(type)) error = "Tipo inválido";
          else if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) error = "Latitud inválida";
          else if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) error = "Longitud inválida";
          return { type, label, description, latitude, longitude, error: error || undefined };
        });

      setRows(parsed);
      if (!parsed.length) setMessage("El archivo no tiene filas.");
    } catch {
      setMessage("No se pudo leer el archivo. Usá la plantilla de ejemplo.");
    }
  }

  async function runUpload() {
    const valid = rows.filter((r) => !r.error);
    if (!valid.length) return;
    const uid = decodeJwtSub(token);
    setProcessing(true);
    setProgress(0);
    setMessage("");
    try {
      for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
        const chunk = valid.slice(i, i + CHUNK_SIZE).map((r) => ({
          type: r.type, label: r.label, description: r.description || null, latitude: r.latitude, longitude: r.longitude, created_by: uid,
        }));
        const res = await fetch(`${SUPABASE_URL}/rest/v1/map_points`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        });
        if (!res.ok) throw new Error("No se pudo subir un lote de ubicaciones.");
        setProgress((p) => p + chunk.length);
      }
      setMessage(`Listo: ${valid.length} ubicaciones cargadas.`);
      setRows([]);
      setFileName("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la carga.");
    } finally {
      setProcessing(false);
    }
  }

  async function deletePoint(id: number) {
    if (!window.confirm("¿Borrar esta ubicación?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/map_points?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    load();
  }

  function startEdit(p: MapPoint) {
    setEditingId(p.id);
    setEditLabel(p.label);
    setEditType(p.type);
    setEditDescription(p.description ?? "");
    setEditLat(String(p.latitude));
    setEditLng(String(p.longitude));
  }

  async function saveEdit(id: number) {
    const lat = Number(editLat);
    const lng = Number(editLng);
    if (!editLabel.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/map_points?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel, type: editType, description: editDescription || null, latitude: lat, longitude: lng }),
    });
    setEditingId(null);
    load();
  }

  return (
    <div>
      <p className="ext-note" style={{ marginTop: 0 }}>
        Cargá muchos bunkers o puntos calientes de una sola vez con un Excel (tipo, etiqueta, descripción, latitud, longitud). Aparecen enseguida en Comicios → Mapa Interactivo. También podés seguir agregando de a uno desde ese mismo mapa.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <button type="button" className="ext-btn secondary" onClick={downloadTemplate}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={14} strokeWidth={2.5} /> PLANTILLA
          </span>
        </button>
        <label className="ext-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <UploadCloud size={14} strokeWidth={2.5} /> {fileName || "SUBIR ARCHIVO"}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>

      {rows.length > 0 && (
        <>
          <p className="ext-note" style={{ marginTop: 0 }}>
            {rows.filter((r) => !r.error).length} de {rows.length} filas listas para cargar.
          </p>
          <div className="results" style={{ maxHeight: 220, overflow: "auto", marginBottom: 14 }}>
            {rows.map((r, i) => (
              <div key={i} className="voter-row compact-row" style={{ cursor: "default" }}>
                <b>{r.label || "(sin etiqueta)"}</b>
                {r.error ? <span className="badge sm danger">{r.error}</span> : <span className="badge sm ok">{TYPE_LABELS[r.type]}</span>}
              </div>
            ))}
          </div>
          <button type="button" className="ext-btn full" onClick={runUpload} disabled={processing || !rows.some((r) => !r.error)} style={{ marginBottom: 14 }}>
            {processing ? `CARGANDO… (${progress}/${rows.filter((r) => !r.error).length})` : `CARGAR ${rows.filter((r) => !r.error).length} UBICACIONES`}
          </button>
        </>
      )}
      {message && <p className="form-message">{message}</p>}

      <div className="results-head" style={{ padding: "10px 3px" }}>
        <b>Ubicaciones cargadas</b>
        <span>{points.length}</span>
      </div>
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !points.length && <p className="empty">No hay ubicaciones cargadas todavía.</p>}
      <div className="results">
        {points.map((p) =>
          editingId === p.id ? (
            <div key={p.id} className="search-card" style={{ display: "grid", gap: 8, marginBottom: 8 }}>
              <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Etiqueta" />
              <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                <option value="bunker">Bunker</option>
                <option value="punto_caliente">Punto caliente</option>
                <option value="otro">Otro</option>
              </select>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descripción" rows={2} />
              <div style={{ display: "flex", gap: 8 }}>
                <input value={editLat} onChange={(e) => setEditLat(e.target.value)} placeholder="Latitud" style={{ flex: 1 }} />
                <input value={editLng} onChange={(e) => setEditLng(e.target.value)} placeholder="Longitud" style={{ flex: 1 }} />
              </div>
              <p className="ext-note" style={{ margin: 0 }}>
                Para reubicar arrastrando el pin, hacelo desde Comicios → Mapa Interactivo. Acá también podés escribir la latitud/longitud directamente.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="ext-btn full" onClick={() => saveEdit(p.id)}>GUARDAR</button>
                <button type="button" className="ext-btn secondary" onClick={() => setEditingId(null)}>CANCELAR</button>
              </div>
            </div>
          ) : (
            <div key={p.id} className="voter-row compact" style={{ cursor: "default" }}>
              <div>
                <b>{p.label}</b>
                <p>
                  {TYPE_LABELS[p.type] ?? p.type} · {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                </p>
              </div>
              <button className="ext-btn secondary" onClick={() => startEdit(p)} style={{ padding: "8px 10px" }}>
                <Pencil size={14} strokeWidth={2} />
              </button>
              <button className="ext-btn secondary" onClick={() => deletePoint(p.id)} style={{ padding: "8px 10px" }}>
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
