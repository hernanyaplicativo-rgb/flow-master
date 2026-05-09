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
          if (payload.eventType === 'INSERT') {
            setTickets((prev) => {
              const newTicket = payload.new as Ticket;
              // Prevent duplicates just in case
              if (prev.some((t) => t.id === newTicket.id)) return prev;
              return [newTicket, ...prev].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
            });
          } else if (payload.eventType === 'UPDATE') {
            setTickets((prev) =>
              prev.map((t) => (t.id === payload.new.id ? { ...t, ...payload.new } as Ticket : t))
            );
          } else if (payload.eventType === 'DELETE') {
            setTickets((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
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
