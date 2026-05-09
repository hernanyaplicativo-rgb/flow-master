import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Ticket } from "@/lib/queue";

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      // Include: tickets created today OR scheduled appointments from today onwards
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .or(`created_at.gte.${startOfToday},scheduled_at.gte.${startOfToday}`)
        .order("created_at", { ascending: false });
      
      if (!mounted) return;
      
      if (error) {
        setOnline(false);
      } else {
        setOnline(true);
        setTickets((data ?? []) as Ticket[]);
      }
      setLoading(false);
    };

    load(true);

    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          // Optimization: We could handle payload.new/old here to avoid full reload
          // but for now, re-loading is safe and ensures consistency with DB state
          load();
        },
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

  return { tickets, online, loading };
}
