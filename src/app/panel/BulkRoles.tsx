"use client";
import { useEffect, useState } from "react";
import { UploadCloud, Download } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, Candidato, electoralRoles, listCandidatos, rpc } from "./shared";

const ROLE_LABELS = Object.fromEntries(electoralRoles) as Record<string, string>;
const VALID_ROLES: string[] = electoralRoles.map(([key]) => key);
// Roles que entran al portal externo con codigo de acceso (los votantes y colaboradores de comicio no).
const LOGIN_ROLES = ["dirigente", "movilizador", "chofer", "fiscal_general", "fiscal_mesa", "fiscal_suplente", "coordinador_circuito", "coordinador_general", "candidato"];

type EscuelaRef = { id: number; circuito: string; circuito_num: string; nombre: string; direccion: string | null; mesa_desde: number; mesa_hasta: number };

const CHUNK_SIZE = 30;

type ParsedRow = { dni: string; role: string; generar: boolean; escuelaId: number | null; circuito: string; telefono: string; error?: string };
type ResultRow = { dni: string; role: string; nombre: string; status: string; message: string; codigo?: string };

export function BulkRoles({ token }: { token: string }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [escuelas, setEscuelas] = useState<EscuelaRef[]>([]);

  useEffect(() => {
    listCandidatos(token, true).then(setCandidatos);
    fetch(`${SUPABASE_URL}/rest/v1/escuelas?select=id,circuito,circuito_num,nombre,direccion,mesa_desde,mesa_hasta&order=id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((rows) => setEscuelas(Array.isArray(rows) ? rows : []))
      .catch(() => setEscuelas([]));
  }, [token]);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const data = [
      { dni: "30111222", rol: "movilizador", generar_codigo: "si", telefono: "3815551111", escuela_id: "", circuito: "" },
      { dni: "28333444", rol: "fiscal_general", generar_codigo: "si", telefono: "3815552222", escuela_id: 31, circuito: "" },
      { dni: "25555666", rol: "coordinador_circuito", generar_codigo: "si", telefono: "", escuela_id: "", circuito: "10" },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        [`Roles válidos: ${VALID_ROLES.join(", ")}`],
        ["escuela_id: solo para fiscal_general (mirá la hoja Escuelas). Si lo dejás vacío queda pendiente de asignación."],
        ["circuito: solo para coordinador_circuito (número, por ejemplo 10)."],
      ],
      { origin: "H1" },
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Roles");
    const escData = escuelas.map((e) => ({ escuela_id: e.id, circuito: e.circuito, nombre: e.nombre, direccion: e.direccion ?? "", mesas: `${e.mesa_desde}-${e.mesa_hasta}` }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(escData), "Escuelas");
    XLSX.writeFile(wb, "plantilla_roles.xlsx");
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setResults([]);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsed: ParsedRow[] = raw
        .filter((r) => String(r.dni ?? "").trim() !== "")
        .map((r) => {
          const dni = String(r.dni ?? "").replace(/\D/g, "");
          const role = String(r.rol ?? r.role ?? "").trim().toLowerCase();
          const generarVal = String(r.generar_codigo ?? r.generar ?? "").trim().toLowerCase();
          const escuelaRaw = String(r.escuela_id ?? "").replace(/\D/g, "");
          const escuelaId = escuelaRaw ? Number(escuelaRaw) : null;
          const circuito = String(r.circuito ?? "").trim();
          const telefono = String(r.telefono ?? "").trim();
          let error = "";
          if (!dni) error = "DNI inválido";
          else if (!VALID_ROLES.includes(role)) error = "Rol inválido";
          else if (escuelaId != null && !escuelas.some((e) => e.id === escuelaId)) error = "escuela_id no existe";
          else if (role === "coordinador_circuito" && !escuelas.some((e) => e.circuito_num === circuito)) error = "Falta el circuito del coordinador";
          return { dni, role, generar: ["si", "sí", "yes", "true", "1"].includes(generarVal), escuelaId, circuito, telefono, error: error || undefined };
        });

      setRows(parsed);
      if (!parsed.length) setMessage("El archivo no tiene filas.");
    } catch {
      setMessage("No se pudo leer el archivo. Usá la plantilla de ejemplo.");
    }
  }

  async function provisionCode(role: string, padronId: number): Promise<string | undefined> {
    if (!LOGIN_ROLES.includes(role)) return undefined;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/comicios`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "provision", padron_id: padronId }),
      });
      const data = await res.json();
      return data.code as string | undefined;
    } catch {
      return undefined;
    }
  }

  // Escuela / circuito del rol y celular: se completan despues de asignar el rol.
  async function applyExtras(original: ParsedRow, padronId: number, candId: number) {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    let patch: Record<string, unknown> | null = null;
    if (original.role === "fiscal_general") {
      const esc = original.escuelaId != null ? escuelas.find((e) => e.id === original.escuelaId) : null;
      patch = esc ? { escuela_id: esc.id, circuito: esc.circuito_num } : { escuela_id: null, circuito: "PENDIENTE" };
    } else if (original.role === "coordinador_circuito" && original.circuito) {
      patch = { circuito: original.circuito };
    }
    if (patch) {
      await fetch(`${SUPABASE_URL}/rest/v1/person_roles?padron_id=eq.${padronId}&role=eq.${original.role}&candidate_id=eq.${candId}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
    }
    if (original.telefono) {
      await fetch(`${SUPABASE_URL}/rest/v1/voter_profiles`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ padron_id: padronId, telefono: original.telefono }),
      });
    }
  }

  async function runUpload() {
    const valid = rows.filter((r) => !r.error);
    if (!valid.length) return;
    if (!candidateId) {
      setMessage("Elegí a qué candidato pertenece esta carga.");
      return;
    }
    setProcessing(true);
    setProgress(0);
    setResults([]);
    setMessage("");
    const allResults: ResultRow[] = [];
    try {
      for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
        const chunk = valid.slice(i, i + CHUNK_SIZE);
        const data = await rpc(token, "bulk_assign_roles", { p_rows: chunk.map((r) => ({ dni: r.dni, role: r.role })), p_candidate_id: Number(candidateId) });
        for (let j = 0; j < data.length; j++) {
          const r = data[j];
          const original = chunk[j];
          let codigo: string | undefined;
          if (r.r_status === "ok" && r.r_padron_id) {
            await applyExtras(original, r.r_padron_id, Number(candidateId));
          }
          if (r.r_status === "ok" && original.generar && r.r_padron_id) {
            codigo = await provisionCode(r.r_role, r.r_padron_id);
          }
          allResults.push({
            dni: r.r_dni,
            role: r.r_role,
            nombre: r.r_apellido_nombre ?? "",
            status: r.r_status,
            message: r.r_message,
            codigo,
          });
        }
        setResults([...allResults]);
        setProgress(allResults.length);
      }
      const ok = allResults.filter((r) => r.status === "ok").length;
      setMessage(`Listo: ${ok} de ${allResults.length} roles asignados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la carga.");
    } finally {
      setProcessing(false);
    }
  }

  async function exportResults() {
    const XLSX = await import("xlsx");
    const data = results.map((r) => ({
      DNI: r.dni,
      Nombre: r.nombre,
      Rol: ROLE_LABELS[r.role] ?? r.role,
      Estado: r.status === "ok" ? "Asignado" : "Error",
      Detalle: r.message,
      "Código de acceso": r.codigo ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Roles");
    XLSX.writeFile(wb, "roles_asignados.xlsx");
  }

  return (
    <div>
      <p className="ext-note" style={{ marginTop: 0 }}>
        Subí un Excel con DNI y rol para asignar roles a mucha gente de una sola vez (movilizador, chofer, fiscal, dirigente, etc.). Si tildás "generar_codigo" para un rol con portal externo (movilizador/chofer/fiscal/candidato), también se genera el código de acceso en el mismo paso.
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

      {rows.length > 0 && !results.length && (
        <>
          <p className="ext-note" style={{ marginTop: 0 }}>
            {rows.filter((r) => !r.error).length} de {rows.length} filas listas para asignar.
          </p>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>
              CANDIDATO AL QUE PERTENECE ESTA CARGA
            </span>
            <select required value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
              <option value="">Elegí un candidato…</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <div className="results" style={{ maxHeight: 240, overflow: "auto", marginBottom: 14 }}>
            {rows.map((r, i) => (
              <div key={i} className="voter-row compact-row" style={{ cursor: "default" }}>
                <b>DNI {r.dni || "—"}</b>
                {r.error ? <span className="badge sm danger">{r.error}</span> : <span className="badge sm ok">{ROLE_LABELS[r.role] ?? r.role}</span>}
              </div>
            ))}
          </div>
          <button type="button" className="ext-btn full" onClick={runUpload} disabled={processing || !rows.some((r) => !r.error)}>
            {processing ? `ASIGNANDO… (${progress}/${rows.filter((r) => !r.error).length})` : `ASIGNAR ${rows.filter((r) => !r.error).length} ROLES`}
          </button>
        </>
      )}

      {results.length > 0 && (
        <>
          <div className="results" style={{ maxHeight: 280, overflow: "auto", marginBottom: 14 }}>
            {results.map((r, i) => (
              <div key={i} className="voter-row compact-row" style={{ cursor: "default" }}>
                <b>
                  {r.nombre || `DNI ${r.dni}`} {r.codigo ? `· ${r.codigo}` : ""}
                </b>
                <span className={`badge sm ${r.status === "ok" ? "ok" : "danger"}`}>{r.status === "ok" ? ROLE_LABELS[r.role] ?? r.role : r.message}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="ext-btn full" onClick={exportResults}>
              EXPORTAR EXCEL
            </button>
            <button
              type="button"
              className="ext-btn secondary"
              onClick={() => {
                setRows([]);
                setResults([]);
                setFileName("");
                setMessage("");
              }}
            >
              CARGAR OTRO ARCHIVO
            </button>
          </div>
        </>
      )}
      {message && <p className="form-message">{message}</p>}
    </div>
  );
}
