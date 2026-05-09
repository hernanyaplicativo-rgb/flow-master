import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTickets } from "@/hooks/useTickets";
import { supabase } from "@/integrations/supabase/client";
import { waitMinutes, type Ticket } from "@/lib/queue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Wifi, WifiOff, RotateCcw, Pause, ArrowRightLeft, Clock, Users, CheckCircle2,
  Accessibility, History, UserCircle2, PhoneCall, Settings, LogOut, AlertTriangle,
  TrendingUp, Timer
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "BCN Flow — Tela do Profissional" },
      { name: "description", content: "Painel do atendente BCN Flow." },
    ],
  }),
  component: StaffPage,
});

// SLA thresholds (minutes)
const SLA_OK = 10;
const SLA_WARN = 15;

function slaState(min: number) {
  if (min >= SLA_WARN) return { label: "Crítico", color: "destructive", bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/40" };
  if (min >= SLA_OK) return { label: "Atenção", color: "warning", bg: "bg-warning/10", text: "text-warning", border: "border-warning/40" };
  return { label: "Em dia", color: "success", bg: "bg-success/10", text: "text-success", border: "border-success/40" };
}

function StaffPage() {
  const { tickets, online, loading } = useTickets();
  const [counter, setCounter] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    return Number(localStorage.getItem("bcn-staff-counter")) || 1;
  });
  useEffect(() => { try { localStorage.setItem("bcn-staff-counter", String(counter)); } catch {} }, [counter]);
  const [attendant] = useState("Carlos Mendes");

  const queue = useMemo(() => {
    return tickets
      .filter((t) => ["waiting", "hold", "called"].includes(t.status))
      .sort((a, b) => {
        if (a.category !== b.category) return a.category === "priority" ? -1 : 1;
        return +new Date(a.created_at) - +new Date(b.created_at);
      });
  }, [tickets]);

  // Only show MY counter's active ticket so multiple stations don't collide
  const serving = useMemo(
    () => tickets.find((t) => (t.status === "called" || t.status === "serving") && t.counter === counter) ?? null,
    [tickets, counter],
  );
  const next = useMemo(() => queue.find((t) => t.id !== serving?.id && t.status === "waiting") ?? null, [queue, serving]);
  const recent = useMemo(
    () => tickets.filter((t) => t.called_at && t.counter === counter).sort((a, b) => +new Date(b.called_at!) - +new Date(a.called_at!)).slice(0, 5),
    [tickets, counter],
  );
  const doneToday = tickets.filter((t) => t.status === "done");
  const avgServe = useMemo(() => {
    const samples = doneToday
      .filter((t) => t.called_at && t.finished_at)
      .map((t) => (+new Date(t.finished_at!) - +new Date(t.called_at!)) / 60000);
    if (!samples.length) return 0;
    return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  }, [doneToday]);

  const slaBreaches = queue.filter((t) => waitMinutes(t) >= SLA_WARN).length;
  const slaWarning = queue.filter((t) => { const w = waitMinutes(t); return w >= SLA_OK && w < SLA_WARN; }).length;
  const slaCompliance = queue.length === 0 ? 100 : Math.round(((queue.length - slaBreaches) / queue.length) * 100);

  // Generate fake SLA data for the chart based on current compliance to simulate a trend
  const slaChartData = useMemo(() => {
    const base = slaCompliance;
    return Array.from({ length: 7 }).map((_, i) => {
      const hour = new Date().getHours() - 6 + i;
      // Add some random variance around the base compliance
      const val = Math.min(100, Math.max(0, base + (Math.random() * 20 - 10)));
      return { time: `${hour}:00`, sla: Math.round(val) };
    });
  }, [slaCompliance]);


  const update = async (id: string, patch: Partial<Ticket>) => {
    const { error } = await supabase.from("tickets").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const callNext = async () => {
    if (serving) return toast.warning("Finalize o ticket atual primeiro.");
    const n = queue.find((t) => t.status !== "called");
    if (!n) return toast.info("Fila vazia.");
    await update(n.id, { status: "called", counter, called_at: new Date().toISOString() });
    toast.success(`Chamando ${n.ticket_code}`);
  };
  const recall = async () => { if (serving) { await update(serving.id, { called_at: new Date().toISOString() }); toast.info(`Rechamando ${serving.ticket_code}`); } };
  const hold = async () => { if (serving) await update(serving.id, { status: "hold", counter: null }); };
  const transfer = async () => { if (serving) { await update(serving.id, { status: "waiting", counter: null, called_at: null }); toast.info("Transferido para fila"); } };
  const finish = async () => { if (serving) { await update(serving.id, { status: "done", finished_at: new Date().toISOString(), served_at: serving.served_at ?? new Date().toISOString() }); toast.success("Atendimento concluído"); } };

  // Keyboard shortcuts (enterprise productivity)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "F2") { e.preventDefault(); if (!serving) callNext(); else finish(); }
      else if (e.key === "F3") { e.preventDefault(); recall(); }
      else if (e.key === "F4") { e.preventDefault(); hold(); }
      else if (e.key === "F5") { e.preventDefault(); transfer(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [serving, queue, counter]);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-secondary/30">
      {/* Top brand bar — red, like reference */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">BCN Flow · Tela do Profissional</h1>
            <p className="mt-0.5 text-sm font-medium opacity-90">Atendente: <span className="font-bold">{attendant}</span> · Balcão {counter}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/10 px-3 py-1.5 text-right backdrop-blur">
              <div className="text-base font-extrabold tabular-nums leading-none"><LiveClock /></div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
            <Badge className={cn("gap-1.5 rounded-full border-0 text-xs", online ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground")}
              aria-label={online ? "Conectado" : "Desconectado"}>
              {online ? <Wifi className="h-3 w-3" aria-hidden /> : <WifiOff className="h-3 w-3" aria-hidden />}
              {online ? "Online" : "Offline"}
            </Badge>
            <Button variant="secondary" size="sm" className="gap-2 bg-white text-primary hover:bg-white/90" aria-label="Sair">
              <LogOut className="h-4 w-4" aria-hidden /> Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        {/* SLA Banner */}
        {slaBreaches > 0 && (
          <div role="alert" className="flex items-center gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/5 px-5 py-3 text-destructive animate-slide-up">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm font-semibold">
              {slaBreaches} cliente(s) acima do SLA crítico ({SLA_WARN} min). Priorize o próximo atendimento.
            </p>
          </div>
        )}

        {/* Metrics bar */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric icon={<Users className="h-4 w-4" />} label="Clientes na fila" value={queue.length} />
          <Metric icon={<Accessibility className="h-4 w-4" />} label="Prioritários" value={queue.filter((t) => t.category === "priority").length} accent />
          <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Atendidos hoje" value={doneToday.length} />
          <Metric icon={<Timer className="h-4 w-4" />} label="Tempo médio" value={`${avgServe}m`} />
          <Metric icon={<TrendingUp className="h-4 w-4" />} label="SLA Compliance" value={`${slaCompliance}%`}
            valueClass={slaCompliance >= 90 ? "text-success" : slaCompliance >= 70 ? "text-warning" : "text-destructive"} />
        </div>

        {/* Main layout */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Center: Próximo / Atual */}
          <Card className="lg:col-span-2 border-2 border-primary/20 p-6 shadow-elegant">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">{serving ? "Cliente Atual" : "Próximo Cliente"}</p>
                <h2 className="mt-1 text-lg font-bold">{serving ? "Em atendimento" : (next ? `Pronto para chamar` : "Aguardando")}</h2>
              </div>
              {serving && (
                <Badge className="gap-1.5 border-0 bg-success text-success-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden /> Em atendimento
                </Badge>
              )}
            </div>

            <div className={cn(
              "mt-4 flex flex-col items-center gap-2 rounded-2xl border-2 py-10 transition-colors",
              serving ? "border-primary bg-primary/5" : "border-dashed border-border bg-secondary/40"
            )}>
              <p className="text-[140px] leading-none font-black tracking-tighter text-primary text-glow">
                {serving?.ticket_code ?? next?.ticket_code ?? "—"}
              </p>
              <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-foreground/70">
                {serving ? `Balcão ${serving.counter}` : (next?.category === "priority" ? "Atendimento Prioritário (PCD)" : "Atendimento Normal")}
              </p>
            </div>

            {!serving ? (
              <Button onClick={callNext} disabled={!next}
                aria-label="Chamar próximo cliente (atalho F2)"
                className="mt-5 h-16 w-full bg-success text-lg font-black uppercase tracking-wider text-success-foreground hover:bg-success/90 focus-visible:ring-4 focus-visible:ring-success/40">
                <PhoneCall className="mr-2 h-6 w-6" aria-hidden />Chamar Agora
                <kbd className="ml-3 hidden rounded border border-white/40 bg-white/10 px-1.5 py-0.5 text-xs font-bold tracking-normal sm:inline-block">F2</kbd>
              </Button>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="outline" onClick={recall} aria-label="Rechamar cliente (F3)"
                  className="h-12 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-4 focus-visible:ring-primary/30">
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden />Rechamar <kbd className="ml-1.5 hidden rounded border border-current/30 px-1 text-[9px] md:inline">F3</kbd>
                </Button>
                <Button variant="outline" onClick={hold} aria-label="Pausar atendimento (F4)"
                  className="h-12 border-2 border-warning text-warning hover:bg-warning hover:text-warning-foreground focus-visible:ring-4 focus-visible:ring-warning/30">
                  <Pause className="mr-2 h-4 w-4" aria-hidden />Pausar <kbd className="ml-1.5 hidden rounded border border-current/30 px-1 text-[9px] md:inline">F4</kbd>
                </Button>
                <Button variant="outline" onClick={transfer} aria-label="Transferir cliente (F5)"
                  className="h-12 border-2 border-foreground/30 text-foreground hover:bg-foreground hover:text-background focus-visible:ring-4 focus-visible:ring-foreground/20">
                  <ArrowRightLeft className="mr-2 h-4 w-4" aria-hidden />Transferir <kbd className="ml-1.5 hidden rounded border border-current/30 px-1 text-[9px] md:inline">F5</kbd>
                </Button>
                <Button onClick={finish} aria-label="Encerrar atendimento (F2)"
                  className="h-12 bg-success font-bold text-success-foreground hover:bg-success/90 focus-visible:ring-4 focus-visible:ring-success/40">
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />Encerrar <kbd className="ml-1.5 hidden rounded border border-white/40 bg-white/10 px-1 text-[9px] md:inline">F2</kbd>
                </Button>
              </div>
            )}
          </Card>

          {/* Right column */}
          <div className="space-y-5">
            <Card className="border-border p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-primary" aria-hidden />
                <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">Dados do Cliente {serving && <span className="text-foreground">{serving.ticket_code}</span>}</p>
              </div>
              {serving ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <Row k="Senha" v={<span className="font-black text-primary">{serving.ticket_code}</span>} />
                  <Row k="Nome" v={serving.customer_name ?? "—"} />
                  <Row k="Tipo" v={serving.category === "priority" ? "Prioritário (PCD)" : "Normal"} />
                  <Row k="Tempo de espera" v={
                    <span className={cn("font-bold", slaState(waitMinutes(serving)).text)}>
                      {waitMinutes(serving)} min · {slaState(waitMinutes(serving)).label}
                    </span>
                  } />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum cliente em atendimento.</p>
              )}
            </Card>

            <Card className="border-border p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" aria-hidden />
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">Chamados Recentes</p>
                </div>
                <Settings className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </div>
              <ul className="mt-3 space-y-2">
                {recent.length === 0 && <li className="text-sm text-muted-foreground">Sem histórico hoje.</li>}
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
                    <span className="text-lg font-black tracking-tight text-primary">{t.ticket_code}</span>
                    <span className="text-xs font-semibold text-muted-foreground">Balcão {t.counter ?? "—"}</span>
                    <button
                      onClick={() => update(t.id, { called_at: new Date().toISOString() })}
                      aria-label={`Rechamar ${t.ticket_code}`}
                      className="flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <PhoneCall className="h-3 w-3" aria-hidden /> Rechamar
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="border-border p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">SLA Histórico</p>
                </div>
              </div>
              <div className="mt-4 h-[120px] w-full">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={slaChartData}>
                      <XAxis dataKey="time" hide />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px", fontWeight: "bold" }}
                        formatter={(val: number) => [`${val}%`, "SLA"]}
                      />
                      <Line type="monotone" dataKey="sla" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* SLA Legend */}
        <Card className="flex flex-wrap items-center gap-4 border-border px-5 py-3 text-xs shadow-soft">
          <span className="font-extrabold uppercase tracking-wider text-muted-foreground">Indicadores SLA:</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden /> Em dia (&lt; {SLA_OK} min)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden /> Atenção ({SLA_OK}–{SLA_WARN - 1} min) · {slaWarning}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden /> Crítico (≥ {SLA_WARN} min) · {slaBreaches}</span>
        </Card>

        {/* Queue table */}
        <Card className="overflow-hidden border-border shadow-soft">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden />
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">Fila Atual</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{queue.length} cliente(s)</span>
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1">
                <label htmlFor="counter" className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Balcão</label>
                <Input id="counter" type="number" min={1} value={counter} onChange={(e) => setCounter(Number(e.target.value) || 1)} className="h-6 w-12 border-0 p-0 text-center text-sm font-bold shadow-none focus-visible:ring-0" />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableHead>Senha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead className="text-right">Espera</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : queue.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Fila vazia</TableCell></TableRow>
                ) : (
                  queue.map((t) => {
                  const w = waitMinutes(t);
                  const sla = slaState(w);
                  return (
                    <TableRow key={t.id} className={cn(sla.color === "destructive" && "bg-destructive/5")}>
                      <TableCell className="text-base font-black tracking-tight text-primary">{t.ticket_code}</TableCell>
                      <TableCell className="text-sm">{t.customer_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={t.category === "priority" ? "border-primary/40 font-bold text-primary" : "border-border text-muted-foreground"}>
                          {t.category === "priority" ? "Prioritário" : "Normal"}
                        </Badge>
                      </TableCell>
                      <TableCell><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.status}</span></TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider", sla.bg, sla.text, sla.border)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full",
                            sla.color === "success" && "bg-success",
                            sla.color === "warning" && "bg-warning",
                            sla.color === "destructive" && "bg-destructive animate-pulse",
                          )} aria-hidden />
                          {sla.label}
                        </span>
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-sm tabular-nums font-bold", sla.text)}>
                        {w}m {sla.color === "destructive" && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" aria-hidden />}
                      </TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </main>
  );
}

function Metric({ icon, label, value, accent, valueClass }: { icon: React.ReactNode; label: string; value: number | string; accent?: boolean; valueClass?: string }) {
  return (
    <Card className="flex items-center justify-between gap-3 border-border px-4 py-3 shadow-soft">
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-black tracking-tight tabular-nums", accent && "text-primary", valueClass)}>{value}</div>
      </div>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground", accent && "bg-primary/10 text-primary")} aria-hidden>{icon}</span>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="text-sm font-semibold">{v}</dd>
    </div>
  );
}

function LiveClock() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  useEffect(() => {
    const i = setInterval(() => setT(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })), 1000);
    return () => clearInterval(i);
  }, []);
  return <span>{t}</span>;
}
