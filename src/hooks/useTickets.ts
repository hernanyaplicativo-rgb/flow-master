import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Ticket } from "@/lib/queue";

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) {
        setOnline(false);
        return;
      }
      setOnline(true);
      setTickets((data ?? []) as Ticket[]);
    };
    load();

    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => load(),
      )
      .subscribe();

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { tickets, online };
}
