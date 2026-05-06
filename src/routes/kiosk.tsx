import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Accessibility, QrCode, Loader2, ArrowLeft, ScanLine, Briefcase, Banknote, HelpCircle, Clock, Smartphone, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTicket, type TicketCategory, waitMinutes } from "@/lib/queue";
import { useTickets } from "@/hooks/useTickets";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "BCN Flow — Quiosque" },
      { name: "description", content: "Terminal de autoatendimento BCN Flow." },
    ],
  }),
  component: KioskPage,
});

type Mode = "home" | "checkin" | "result";

const SERVICES = [
  { id: "comercial", title: "Atendimento Comercial", subtitle: "Novas Contas · Empréstimos · Consultas", icon: Briefcase, category: "normal" as TicketCategory },
  { id: "caixa", title: "Caixa e Tesouraria", subtitle: "Depósitos · Levantamentos · Pagamentos", icon: Banknote, category: "normal" as TicketCategory },
  { id: "apoio", title: "Apoio e Informações", subtitle: "Esclarecimentos · Entregas", icon: HelpCircle, category: "normal" as TicketCategory },
];

function KioskPage() {
  const { tickets } = useTickets();
  const [mode, setMode] = useState<Mode>("home");
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<{ code: string; category: TicketCategory } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const avgWait = useMemo(() => {
    const waiting = tickets.filter((t) => t.status === "waiting");
    if (!waiting.length) return 5;
    const avg = waiting.reduce((s, t) => s + waitMinutes(t), 0) / waiting.length;
    return Math.max(1, Math.round(avg));
  }, [tickets]);

  const issue = async (category: TicketCategory, key: string) => {
    setLoading(key);
    try {
      const t = await createTicket({ category });
      setIssued({ code: t.ticket_code, category });
      setMode("result");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao emitir senha.");
    } finally {
      setLoading(null);
    }
  };

  const checkin = async () => {
    if (code.trim().length < 3) return toast.error("Código inválido.");
    setLoading("checkin");
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
      setLoading(null);
    }
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col px-5 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold">B</div>
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-tight">BCN <span className="font-light text-muted-foreground">Flow</span></div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Quiosque de Atendimento</div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-semibold tabular-nums text-foreground">{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
            <div className="uppercase tracking-[0.2em]">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>
          </div>
        </header>

        {mode === "home" && (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">Selecione o seu serviço</h1>
            <p className="mt-1 text-sm text-muted-foreground">Toque numa opção para retirar a sua senha.</p>

            <div className="mt-6 flex flex-1 flex-col gap-3 animate-slide-up">
              {SERVICES.map((s) => (
                <ServiceRow
                  key={s.id}
                  icon={<s.icon className="h-6 w-6" strokeWidth={2} />}
                  title={s.title}
                  subtitle={s.subtitle}
                  meta={`Espera ~ ${avgWait} min`}
                  loading={loading === s.id}
                  onClick={() => issue(s.category, s.id)}
                />
              ))}

              <ServiceRow
                accent
                icon={<Accessibility className="h-6 w-6" strokeWidth={2} />}
                title="Prioritário"
                subtitle="Idosos · PCDs · Gestantes"
                meta="Check-in Prioritário"
                loading={loading === "priority"}
                onClick={() => issue("priority", "priority")}
              />

              <button
                onClick={() => setMode("checkin")}
                className="mt-2 flex items-center justify-between rounded-xl border border-dashed border-border bg-secondary/40 px-5 py-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-semibold">Check-in com QR / Código</div>
                    <div className="text-xs text-muted-foreground">Já tem agendamento? Confirme aqui.</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <footer className="mt-8 flex items-center justify-between border-t border-border pt-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              <span>BCN · Banco Caboverdiano de Negócios</span>
              <span>v1.0</span>
            </footer>
          </>
        )}

        {mode === "checkin" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 rounded-2xl border border-border bg-card p-10 shadow-elegant animate-slide-up">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ScanLine className="h-10 w-10" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight">Digite o código do seu ticket</h2>
              <p className="mt-1 text-sm text-muted-foreground">Encontra-o no SMS ou e-mail de confirmação.</p>
            </div>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="N001"
              className="h-16 max-w-xs text-center text-3xl font-extrabold tracking-[0.3em]"
              autoFocus
            />
            <div className="flex gap-3">
              <Button size="lg" variant="outline" onClick={() => setMode("home")} className="border-primary text-primary hover:bg-primary/5">
                <ArrowLeft className="mr-2 h-4 w-4" />Voltar
              </Button>
              <Button size="lg" onClick={checkin} disabled={loading === "checkin"} className="bg-success px-10 text-success-foreground hover:bg-success/90">
                {loading === "checkin" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
              </Button>
            </div>
          </div>
        )}

        {mode === "result" && issued && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-10 shadow-elegant animate-slide-up">
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">Sua Senha</p>
            <p className="text-[140px] leading-none font-black tracking-tighter text-primary">{issued.code}</p>
            <p className="text-lg font-semibold">{issued.category === "priority" ? "Atendimento Prioritário" : "Atendimento Normal"}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Tempo estimado de espera: {avgWait} min</p>
            <Button
              size="lg"
              onClick={() => { setIssued(null); setCode(""); setMode("home"); }}
              className="mt-4 h-12 bg-success px-12 text-base text-success-foreground hover:bg-success/90"
            >
              Concluir
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function ServiceRow({ icon, title, subtitle, meta, onClick, loading, accent }: { icon: React.ReactNode; title: string; subtitle: string; meta: string; onClick: () => void; loading?: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`group flex items-center gap-4 rounded-xl border bg-card px-5 py-4 text-left shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-elegant active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 ${
        accent ? "border-primary/30 bg-primary/[0.03]" : "border-border"
      }`}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold tracking-tight">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-foreground/60">
          <Clock className="h-3 w-3" /> {meta}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
