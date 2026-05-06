import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTickets } from "@/hooks/useTickets";
import { supabase } from "@/integrations/supabase/client";
import { waitMinutes, type Ticket } from "@/lib/queue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wifi, WifiOff, Play, RotateCcw, Pause, ArrowRightLeft, Clock, Users, CheckCircle2, Accessibility, History, UserCircle2, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "BCN Flow — Atendente" },
      { name: "description", content: "Painel do atendente BCN Flow." },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const { tickets, online } = useTickets();
  const [counter, setCounter] = useState(1);

  const queue = useMemo(() => {
    return tickets
      .filter((t) => ["waiting", "hold", "called"].includes(t.status))
      .sort((a, b) => {
        if (a.category !== b.category) return a.category === "priority" ? -1 : 1;
        return +new Date(a.created_at) - +new Date(b.created_at);
      });
  }, [tickets]);

  const serving = useMemo(
    () => tickets.find((t) => t.status === "called" || t.status === "serving") ?? null,
    [tickets],
  );
  const next = useMemo(() => queue.find((t) => t.id !== serving?.id) ?? null, [queue, serving]);
  const recent = useMemo(
    () => tickets.filter((t) => t.called_at).sort((a, b) => +new Date(b.called_at!) - +new Date(a.called_at!)).slice(0, 5),
    [tickets],
  );
  const doneToday = tickets.filter((t) => t.status === "done");
  const avgServe = useMemo(() => {
    const samples = doneToday
      .filter((t) => t.called_at && t.finished_at)
      .map((t) => (+new Date(t.finished_at!) - +new Date(t.called_at!)) / 60000);
    if (!samples.length) return 0;
    return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  }, [doneToday]);

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

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">BCN Flow · Tela do Profissional</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Atendente <span className="text-muted-foreground font-medium">· Balcão {counter}</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={online ? "default" : "destructive"} className={cn("gap-1.5 rounded-full border-0", online ? "bg-success/10 text-success" : "")}>
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online" : "Offline"}
            </Badge>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Balcão</label>
              <Input type="number" min={1} value={counter} onChange={(e) => setCounter(Number(e.target.value) || 1)} className="h-7 w-14 border-0 p-0 text-center text-sm font-bold shadow-none focus-visible:ring-0" />
            </div>
          </div>
        </div>

        {/* Metrics bar */}
        <Card className="overflow-hidden border-border shadow-soft">
          <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
            <Metric icon={<Users className="h-4 w-4" />} label="Clientes na fila" value={queue.length} />
            <Metric icon={<Accessibility className="h-4 w-4" />} label="Prioritários" value={queue.filter((t) => t.category === "priority").length} accent />
            <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Atendidos hoje" value={doneToday.length} />
            <Metric icon={<Clock className="h-4 w-4" />} label="Tempo médio" value={`${avgServe}m`} />
          </div>
        </Card>

        {/* Main layout */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Center: Próximo / Atual */}
          <Card className="lg:col-span-2 border-border p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">{serving ? "Cliente atual" : "Próximo cliente"}</p>
              {serving && <Badge variant="outline" className="border-success/40 text-success">Em atendimento</Badge>}
            </div>

            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-border bg-secondary/40 py-10">
              <p className="text-[140px] leading-none font-black tracking-tighter text-primary">
                {serving?.ticket_code ?? next?.ticket_code ?? "—"}
              </p>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {serving ? `Balcão ${serving.counter}` : (next?.category === "priority" ? "Atendimento Prioritário" : "Atendimento Normal")}
              </p>
            </div>

            {!serving ? (
              <Button onClick={callNext} disabled={!next} className="mt-5 h-14 w-full bg-success text-base font-bold text-success-foreground hover:bg-success/90">
                <PhoneCall className="mr-2 h-5 w-5" />Chamar Agora
              </Button>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="outline" onClick={recall} className="border-primary text-primary hover:bg-primary/5"><RotateCcw className="mr-2 h-4 w-4" />Rechamar</Button>
                <Button variant="outline" onClick={hold} className="border-primary text-primary hover:bg-primary/5"><Pause className="mr-2 h-4 w-4" />Pausar</Button>
                <Button variant="outline" onClick={transfer} className="border-primary text-primary hover:bg-primary/5"><ArrowRightLeft className="mr-2 h-4 w-4" />Transferir</Button>
                <Button onClick={finish} className="bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="mr-2 h-4 w-4" />Encerrar</Button>
              </div>
            )}
          </Card>

          {/* Right column */}
          <div className="space-y-5">
            <Card className="border-border p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Dados do cliente</p>
              </div>
              {serving ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <Row k="Senha" v={<span className="font-bold text-primary">{serving.ticket_code}</span>} />
                  <Row k="Nome" v={serving.customer_name ?? "—"} />
                  <Row k="Tipo" v={serving.category === "priority" ? "Prioritário" : "Normal"} />
                  <Row k="Tempo de espera" v={`${waitMinutes(serving)} min`} />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum cliente em atendimento.</p>
              )}
            </Card>

            <Card className="border-border p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Chamados recentes</p>
              </div>
              <ul className="mt-3 space-y-2">
                {recent.length === 0 && <li className="text-sm text-muted-foreground">Sem histórico hoje.</li>}
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-base font-bold tracking-tight text-primary">{t.ticket_code}</span>
                    <span className="text-xs text-muted-foreground">Balcão {t.counter ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        {/* Queue table */}
        <Card className="overflow-hidden border-border shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Fila atual</p>
            <span className="text-xs text-muted-foreground">{queue.length} cliente(s)</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableHead>Senha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Espera</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Fila vazia</TableCell></TableRow>
                )}
                {queue.map((t) => {
                  const w = waitMinutes(t);
                  const sla = w >= 15;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-bold tracking-tight text-primary">{t.ticket_code}</TableCell>
                      <TableCell className="text-sm">{t.customer_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={t.category === "priority" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}>
                          {t.category === "priority" ? "Prioritário" : "Normal"}
                        </Badge>
                      </TableCell>
                      <TableCell><span className="text-xs uppercase tracking-wider text-muted-foreground">{t.status}</span></TableCell>
                      <TableCell className={cn("text-right font-mono text-sm tabular-nums", sla && "font-bold text-destructive")}>
                        {w}m {sla && "⚠"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </main>
  );
}

function Metric({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-extrabold tracking-tight tabular-nums", accent && "text-primary")}>{value}</div>
      </div>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground", accent && "bg-primary/10 text-primary")}>{icon}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="text-sm font-semibold">{v}</dd>
    </div>
  );
}
