import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Accessibility, User, ScanLine, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTicket, type TicketCategory } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "Quiosque BCN" },
      { name: "description", content: "Terminal de autoatendimento do BCN." },
    ],
  }),
  component: KioskPage,
});

type Mode = "home" | "checkin" | "issue" | "result";

function KioskPage() {
  const [mode, setMode] = useState<Mode>("home");
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<{ code: string; category: TicketCategory } | null>(null);
  const [loading, setLoading] = useState(false);

  const issue = async (category: TicketCategory) => {
    setLoading(true);
    try {
      const t = await createTicket({ category });
      setIssued({ code: t.ticket_code, category });
      setMode("result");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao emitir senha.");
    } finally {
      setLoading(false);
    }
  };

  const checkin = async () => {
    if (code.trim().length < 3) return toast.error("Código inválido.");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .ilike("ticket_code", code.trim())
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Ticket não encontrado.");
        return;
      }
      toast.success(`Check-in realizado: ${data.ticket_code}`);
      setIssued({ code: data.ticket_code, category: data.category as TicketCategory });
      setMode("result");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no check-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-brand-gradient p-6">
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-3xl flex-col">
        <div className="mb-8 text-center text-primary-foreground">
          <p className="text-sm uppercase tracking-[0.4em] opacity-80">Quiosque BCN</p>
          <h1 className="mt-2 text-4xl font-bold">Bem-vindo</h1>
        </div>

        {mode === "home" && (
          <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2">
            <KioskTile onClick={() => setMode("checkin")} title="Check-in Rápido" subtitle="Já tenho ticket digital" icon={<ScanLine className="h-16 w-16" />} />
            <KioskTile onClick={() => setMode("issue")} title="Emitir Senha" subtitle="Atendimento sem agendamento" icon={<User className="h-16 w-16" />} />
          </div>
        )}

        {mode === "checkin" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-3xl bg-card p-10 shadow-elegant">
            <ScanLine className="h-20 w-20 text-primary" />
            <h2 className="text-2xl font-bold">Digite o código do seu ticket</h2>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: N001"
              className="h-16 max-w-xs text-center text-3xl font-bold tracking-widest"
              autoFocus
            />
            <div className="flex gap-3">
              <Button size="lg" variant="outline" onClick={() => setMode("home")}><ArrowLeft className="mr-2 h-5 w-5" />Voltar</Button>
              <Button size="lg" onClick={checkin} disabled={loading} className="px-8">
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}Confirmar
              </Button>
            </div>
          </div>
        )}

        {mode === "issue" && (
          <div className="flex flex-1 flex-col gap-6">
            <h2 className="text-center text-2xl font-bold text-primary-foreground">Selecione o atendimento</h2>
            <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2">
              <KioskTile onClick={() => issue("normal")} title="Normal" subtitle="Atendimento padrão" icon={<User className="h-16 w-16" />} />
              <KioskTile onClick={() => issue("priority")} title="Prioritário" subtitle="Idosos · PCD · Gestantes" icon={<Accessibility className="h-16 w-16" />} highlight />
            </div>
            <Button size="lg" variant="outline" onClick={() => setMode("home")} className="self-center">
              <ArrowLeft className="mr-2 h-5 w-5" />Voltar
            </Button>
          </div>
        )}

        {mode === "result" && issued && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-3xl bg-card p-10 shadow-elegant animate-slide-up">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Sua Senha</p>
            <p className="text-[160px] leading-none font-bold tracking-tight text-primary text-glow">{issued.code}</p>
            <p className="text-lg font-medium">{issued.category === "priority" ? "Atendimento Prioritário" : "Atendimento Normal"}</p>
            <p className="text-sm text-muted-foreground">Aguarde sua senha ser chamada no painel.</p>
            <Button size="lg" onClick={() => { setIssued(null); setCode(""); setMode("home"); }} className="px-10">Concluir</Button>
          </div>
        )}
      </div>
    </main>
  );
}

function KioskTile({ onClick, title, subtitle, icon, highlight }: { onClick: () => void; title: string; subtitle: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center justify-center gap-4 rounded-3xl border-4 p-10 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring ${
        highlight
          ? "border-warning/60 bg-warning/10 text-warning-foreground hover:bg-warning/20"
          : "border-card bg-card text-card-foreground hover:border-primary hover:shadow-elegant"
      }`}
    >
      <div className={`flex h-28 w-28 items-center justify-center rounded-full ${highlight ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground"}`}>
        {icon}
      </div>
      <div className="text-3xl font-bold">{title}</div>
      <div className="text-base text-muted-foreground">{subtitle}</div>
    </button>
  );
}
