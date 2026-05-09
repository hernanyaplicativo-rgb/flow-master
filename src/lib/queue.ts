import { supabase } from "@/integrations/supabase/client";

export type TicketCategory = "normal" | "priority";
export type TicketStatus = "waiting" | "called" | "serving" | "done" | "hold" | "transferred";

export interface Ticket {
  id: string;
  ticket_code: string;
  category: TicketCategory;
  status: TicketStatus;
  counter: number | null;
  assigned_counter: number | null;
  customer_name: string | null;
  scheduled_at: string | null;
  created_at: string;
  called_at: string | null;
  served_at: string | null;
  finished_at: string | null;
}

export const PEAK_HOURS = [12, 13, 17, 18];
export const COUNTERS = [1, 2, 3, 4, 5];

export async function createTicket(input: {
  category: TicketCategory;
  customer_name?: string | null;
  scheduled_at?: string | null;
  assigned_counter?: number | null;
}): Promise<Ticket> {
  const { data: codeData, error: codeErr } = await supabase.rpc("next_ticket_code", {
    p_category: input.category,
  });
  if (codeErr) throw codeErr;
  const ticket_code = codeData as string;

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      ticket_code,
      category: input.category,
      customer_name: input.customer_name ?? null,
      scheduled_at: input.scheduled_at ?? null,
      assigned_counter: input.assigned_counter ?? null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as Ticket;
}

export function waitMinutes(t: Ticket): number {
  const start = new Date(t.created_at).getTime();
  return Math.floor((Date.now() - start) / 60000);
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.95;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* noop */
  }
}
