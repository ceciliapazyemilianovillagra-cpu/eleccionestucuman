"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "./shared";

const clients = new Map<string, SupabaseClient>();

function getClient(token: string): SupabaseClient {
  let client = clients.get(token);
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, { accessToken: async () => token });
    clients.set(token, client);
    if (clients.size > 4) {
      const oldestKey = clients.keys().next().value;
      if (oldestKey) {
        clients.get(oldestKey)?.removeAllChannels();
        clients.delete(oldestKey);
      }
    }
  }
  return client;
}

/**
 * Refresca `onChange` automáticamente cuando cambia una fila en cualquiera
 * de las tablas indicadas (INSERT/UPDATE/DELETE), vía Supabase Realtime.
 * Los cambios se agrupan (debounce) para no disparar recargas en cadena.
 */
export function useRealtime(tables: string[], token: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const tablesKey = tables.join(",");

  useEffect(() => {
    if (!token || !tablesKey) return;
    const client = getClient(token);
    const channel = client.channel(`rt-${tablesKey}-${Math.random().toString(36).slice(2, 8)}`);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), 350);
    };
    for (const table of tablesKey.split(",")) {
      channel.on("postgres_changes" as never, { event: "*", schema: "public", table }, trigger);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, token]);
}
