import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Accessibility, User, QrCode, Loader2, ArrowLeft, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTicket, type TicketCategory } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "Quiosque BCN" },
      { name: "description", content: "Terminal de autoatendimento BCN." },
    ],
  }),
  component: KioskPage,
});

type Mode = "home" | "checkin" | "result";

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
      if (!data) { toast.error("Ticket não encontrado."); return; }
      toast.success(`Check-in: ${data.ticket_code}`);
      setIssued({ code: data.ticket_code, category: data.category as TicketCategory });
      setMode("result");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no check-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col px-6 py-10">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">Loja Praia · Quiosque</p>
            <h1 className="mt-2 text-5xl font-extrabold tracking-tight">Bem-vindo ao <span className="text-primary">BCN</span></h1>
          </div>
          <div className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-extrabold shadow-elegant md:flex">B</div>
        </div>

        {mode === "home" && (
          <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-3 animate-slide-up">
            <KioskCard
              onClick={() => issue("normal")}
              title="Senha Normal"
              subtitle="Atendimento padrão"
              icon={<User className="h-16 w-16" strokeWidth={1.5} />}
              variant="white"
            />
            <KioskCard
              onClick={() => issue("priority")}
              title="Senha Prioritária"
              subtitle="Idosos · PCD · Gestantes"
              icon={<Accessibility className="h-16 w-16" strokeWidth={1.5} />}
              variant="red"
            />
            <KioskCard
              onClick={() => setMode("checkin")}
              title="Confirmar Agendamento"
              subtitle="Check-in com QR Code"
              icon={<QrCode className="h-16 w-16" strokeWidth={1.5} />}
              variant="white"
            />
          </div>
        )}

        {mode === "checkin" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 rounded-3xl border border-border bg-card p-12 shadow-elegant animate-slide-up">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <ScanLine className="h-14 w-14" />
            </div>
            <h2 className="text-3xl font-bold">Digite o código do seu ticket</h2>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: N001"
              className="h-20 max-w-sm text-center text-4xl font-extrabold tracking-[0.3em]"
              autoFocus
            />
            <div className="flex gap-3">
              <Button size="lg" variant="outline" onClick={() => setMode("home")}><ArrowLeft className="mr-2 h-5 w-5" />Voltar</Button>
              <Button size="lg" onClick={checkin} disabled={loading} className="px-10">
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}Confirmar
              </Button>
            </div>
          </div>
        )}

        {mode === "result" && issued && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-3xl border border-border bg-card p-12 shadow-elegant animate-slide-up">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">Sua Senha</p>
            <p className="text-[180px] leading-none font-extrabold tracking-tighter text-primary">{issued.code}</p>
            <p className="text-xl font-semibold">{issued.category === "priority" ? "Atendimento Prioritário" : "Atendimento Normal"}</p>
            <p className="text-sm text-muted-foreground">Aguarde sua senha ser chamada no painel.</p>
            <Button size="lg" onClick={() => { setIssued(null); setCode(""); setMode("home"); }} className="mt-4 px-12 h-14 text-base">Concluir</Button>
          </div>
        )}

        <footer className="mt-10 flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <span>BCN · Banco Caboverdiano de Negócios</span>
          <span>Sistema Omni-channel Queuing</span>
        </footer>
      </div>
    </main>
  );
}

function KioskCard({ onClick, title, subtitle, icon, variant }: { onClick: () => void; title: string; subtitle: string; icon: React.ReactNode; variant: "white" | "red" }) {
  const isRed = variant === "red";
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center justify-center gap-6 rounded-[28px] border p-12 transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 ${
        isRed
          ? "border-primary bg-primary text-primary-foreground shadow-[0_20px_50px_-15px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          : "border-border bg-card text-card-foreground shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] hover:border-primary/40"
      }`}
    >
      <div className={`flex h-28 w-28 items-center justify-center rounded-3xl ${isRed ? "bg-white/15 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
        {icon}
      </div>
      <div className="text-center">
        <div className="text-2xl font-extrabold tracking-tight">{title}</div>
        <div className={`mt-1 text-sm ${isRed ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{subtitle}</div>
      </div>
    </button>
  );
}
