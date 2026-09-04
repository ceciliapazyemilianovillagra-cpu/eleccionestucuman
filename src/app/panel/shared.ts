export const SUPABASE_URL = "https://dcdtbinqlsvsvmrymyjr.supabase.co";
export const MOVILIZADORES_URL = `${SUPABASE_URL}/functions/v1/movilizadores`;
export const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZHRiaW5xbHN2c3ZtcnlteWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNDU3NTQsImV4cCI6MjEwMzkyMTc1NH0.Dha8bpiFQ7THgKszkFak1vn5XrsY0XZWz_Lu9MGMKz0";

export type Voter = { id: number; dni: string; apellido_nombre: string; domicilio: string | null; circuito: string; circuito_nombre: string | null; mesa: string; orden: number | null; anio_nacimiento: number | null };
export type AppUser = { email: string; user_type: "superadmin" | "administrador" | "dirigente" | "operador"; allowed_modules: string[]; active: boolean };
export type ManagedUser = AppUser & { user_id: string; created_at?: string };

export const modules = ["padron", "dirigentes", "fiscales", "movilizadores", "choferes", "votantes"];
export const moduleNames: Record<string, string> = { padron: "Padrón", dirigentes: "Dirigentes", fiscales: "Fiscales", movilizadores: "Movilizadores", choferes: "Choferes", votantes: "Votantes" };
export const roleNames: Record<AppUser["user_type"], string> = { superadmin: "Superadministrador", administrador: "Administrador", dirigente: "Dirigente", operador: "Operador" };
export const electoralRoles = [
  ["dirigente", "Dirigente"], ["chofer", "Chofer"], ["movilizador", "Movilizador"], ["coordinador_circuito", "Coordinador de circuito"], ["fiscal_general", "Fiscal general"], ["fiscal_mesa", "Fiscal de mesa"], ["fiscal_suplente", "Fiscal suplente"], ["colaborador", "Colaborador"], ["coordinador_general", "Coordinador general"], ["candidato", "Candidato"]
] as const;

export async function manageUsers(token: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-users`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

export async function rpc(token: string, name: string, args: Record<string, unknown> = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "No se pudo completar la operación.");
  return data;
}

export function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json.sub ?? null;
  } catch {
    return null;
  }
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
