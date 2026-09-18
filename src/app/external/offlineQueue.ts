"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { callFn } from "./api";

export type QueueKind = "mark_present" | "report_turnout" | "close_mesa";

export type QueueItem = {
  id: string;
  owner: string;
  kind: QueueKind;
  payload: Record<string, unknown>;
  ts: string;
  file?: Blob;
  contentType?: string;
  actaPath?: string;
  lastError?: string;
};

type Result = { ok: true } | { networkError: true } | { error: string };

const DB_NAME = "et_offline";
const STORE = "queue";
const memory = new Map<string, QueueItem>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function putItem(item: QueueItem) {
  memory.set(item.id, item);
  try {
    await run("readwrite", (s) => s.put(item));
  } catch {}
}

async function removeItem(id: string) {
  memory.delete(id);
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch {}
}

async function listItems(): Promise<QueueItem[]> {
  try {
    return await run<QueueItem[]>("readonly", (s) => s.getAll());
  } catch {
    return Array.from(memory.values());
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function processItem(token: string, item: QueueItem): Promise<Result> {
  if (item.kind === "close_mesa" && !item.actaPath) {
    if (!item.file) return { error: "Falta la foto del acta." };
    const upload = await callFn("comicios", token, {
      action: "upload_acta",
      mesa: item.payload.mesa,
      file_base64: await blobToBase64(item.file),
      content_type: item.contentType,
    });
    if (upload.networkError) return { networkError: true };
    if (!upload.acta_path) return { error: upload.error || "No se pudo subir la foto." };
    item.actaPath = upload.acta_path;
  }
  const body = item.kind === "close_mesa" ? { ...item.payload, acta_path: item.actaPath } : item.payload;
  const d = await callFn("comicios", token, { action: item.kind, ...body });
  if (d.networkError) return { networkError: true };
  if (d.success) return { ok: true };
  return { error: d.error || "No se pudo enviar." };
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function describeItem(item: QueueItem) {
  const mesa = String(item.payload.mesa ?? "");
  const hora = new Date(item.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (item.kind === "mark_present") return `Presencia en mesa ${mesa} (${hora})`;
  if (item.kind === "report_turnout") return `${item.payload.voter_count} votantes en mesa ${mesa} (${hora})`;
  return `Cierre de mesa ${mesa} (${hora})`;
}

export function useOfflineQueue(token: string, ownerKey: string) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [flushing, setFlushing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    const all = await listItems();
    setItems(all.filter((i) => i.owner === ownerKey).sort((a, b) => a.ts.localeCompare(b.ts)));
  }, [ownerKey]);

  const flush = useCallback(
    async (force = false) => {
      if (busy.current) return;
      busy.current = true;
      setFlushing(true);
      try {
        const all = (await listItems()).filter((i) => i.owner === ownerKey).sort((a, b) => a.ts.localeCompare(b.ts));
        for (const item of all) {
          if (item.lastError && !force) continue;
          const result = await processItem(token, item);
          if ("ok" in result) {
            await removeItem(item.id);
          } else if ("networkError" in result) {
            await putItem(item);
            break;
          } else {
            item.lastError = result.error;
            await putItem(item);
          }
        }
      } finally {
        busy.current = false;
        setFlushing(false);
        await refresh();
      }
    },
    [token, ownerKey, refresh],
  );

  useEffect(() => {
    refresh().then(() => flush());
    const onOnline = () => flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => flush(), 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh, flush]);

  const submit = useCallback(
    async (kind: QueueKind, payload: Record<string, unknown>, file?: File | null) => {
      const ts = new Date().toISOString();
      const item: QueueItem = {
        id: newId(),
        owner: ownerKey,
        kind,
        payload: { ...payload, client_ts: ts },
        ts,
        file: file ?? undefined,
        contentType: file?.type,
      };
      const result = await processItem(token, item);
      if ("ok" in result) return { status: "sent" as const };
      if ("networkError" in result) {
        await putItem(item);
        await refresh();
        return { status: "queued" as const };
      }
      return { status: "error" as const, error: result.error };
    },
    [token, ownerKey, refresh],
  );

  const discard = useCallback(
    async (id: string) => {
      await removeItem(id);
      await refresh();
    },
    [refresh],
  );

  return { items, flushing, submit, flush, discard };
}
