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
import { Wifi, WifiOff, Play, RotateCcw, Pause, ArrowRightLeft, Clock, Users, CheckCircle2, Accessibility } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Atendente — BCN Queuing" },
      { name: "description", content: "Painel do atendente com fila em tempo real." },
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
    const next = queue.find((t) => t.status !== "called");
    if (!next) return toast.info("Fila vazia.");
    await update(next.id, { status: "called", counter, called_at: new Date().toISOString() });
    toast.success(`Chamando ${next.ticket_code}`);
  };
  const recall = async () => {
    if (!serving) return;
    await update(serving.id, { called_at: new Date().toISOString() });
    toast.info(`Rechamando ${serving.ticket_code}`);
  };
  const hold = async () => {
    if (!serving) return;
    await update(serving.id, { status: "hold", counter: null });
  };
  const transfer = async () => {
    if (!serving) return;
    await update(serving.id, { status: "waiting", counter: null, called_at: null });
    toast.info("Transferido para fila");
  };
  const finish = async () => {
    if (!serving) return;
    await update(serving.id, { status: "done", finished_at: new Date().toISOString(), served_at: serving.served_at ?? new Date().toISOString() });
    toast.success("Atendimento concluído");
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-secondary/30 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Painel do Atendente</h1>
            <p className="text-sm text-muted-foreground">Gerenciamento de fila em tempo real</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={online ? "default" : "destructive"} className="gap-1.5">
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online" : "Modo offline"}
            </Badge>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Balcão</label>
              <Input type="number" min={1} value={counter} onChange={(e) => setCounter(Number(e.target.value) || 1)} className="h-9 w-20" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Em espera" value={queue.length} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Atendidos hoje" value={doneToday.length} />
          <StatCard icon={<Clock className="h-4 w-4" />} label="Tempo médio" value={`${avgServe}m`} />
          <StatCard icon={<Accessibility className="h-4 w-4" />} label="Prioritários" value={queue.filter((t) => t.category === "priority").length} />
        </div>

        <Card className="overflow-hidden">
          <div className="bg-brand-gradient p-6 text-primary-foreground">
            <p className="text-xs uppercase tracking-[0.3em] opacity-80">Atendimento atual</p>
            {serving ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-5xl font-bold tracking-tight">{serving.ticket_code}</p>
                  <p className="mt-1 text-sm opacity-90">{serving.customer_name ?? "Sem nome"} · Balcão {serving.counter}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={recall}><RotateCcw className="mr-2 h-4 w-4" />Recall</Button>
                  <Button variant="secondary" onClick={hold}><Pause className="mr-2 h-4 w-4" />Hold</Button>
                  <Button variant="secondary" onClick={transfer}><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</Button>
                  <Button onClick={finish} className="bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="mr-2 h-4 w-4" />Finalizar</Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <p className="text-2xl font-light opacity-90">Nenhum cliente em atendimento</p>
                <Button size="lg" onClick={callNext} className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  <Play className="mr-2 h-4 w-4" />Próximo
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                      <TableCell className="font-bold tracking-tight">{t.ticket_code}</TableCell>
                      <TableCell className="text-sm">{t.customer_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={t.category === "priority" ? "default" : "secondary"} className={t.category === "priority" ? "bg-warning text-warning-foreground" : ""}>
                          {t.category === "priority" ? "Prioritário" : "Normal"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                      <TableCell className={cn("text-right font-mono text-sm", sla && "font-bold text-destructive")}>
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}
