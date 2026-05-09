import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useTickets } from "@/hooks/useTickets";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Users, CheckCircle2, Clock, Accessibility, AlertTriangle, TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { waitMinutes } from "@/lib/queue";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "BCN Flow — Analytics" },
      { name: "description", content: "Analytics em tempo real do BCN Flow." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { tickets } = useTickets();

  const stats = useMemo(() => {
    const total = tickets.length;
    const done = tickets.filter((t) => t.status === "done");
    const waiting = tickets.filter((t) => t.status === "waiting");
    const priority = tickets.filter((t) => t.category === "priority").length;
    const breaches = waiting.filter((t) => waitMinutes(t) >= 15).length;
    const serveTimes = done
      .filter((t) => t.called_at && t.finished_at)
      .map((t) => (+new Date(t.finished_at!) - +new Date(t.called_at!)) / 60000);
    const avgServe = serveTimes.length ? Math.round(serveTimes.reduce((a, b) => a + b, 0) / serveTimes.length) : 0;
    const waitTimes = done
      .filter((t) => t.called_at)
      .map((t) => (+new Date(t.called_at!) - +new Date(t.created_at)) / 60000);
    const avgWait = waitTimes.length ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;
    return { total, done: done.length, waiting: waiting.length, priority, breaches, avgServe, avgWait };
  }, [tickets]);

  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({ hour: `${String(i + 8).padStart(2, "0")}h`, h: i + 8, atendidos: 0, emitidos: 0 }));
    tickets.forEach((t) => {
      const h = new Date(t.created_at).getHours();
      const b = buckets.find((x) => x.h === h);
      if (b) {
        b.emitidos += 1;
        if (t.status === "done") b.atendidos += 1;
      }
    });
    return buckets;
  }, [tickets]);

  const categoryData = [
    { name: "Normal", value: tickets.filter((t) => t.category === "normal").length, color: "var(--color-foreground)" },
    { name: "Prioritário", value: stats.priority, color: "var(--color-primary)" },
  ];

  const slaData = [
    { name: "Em dia", value: tickets.filter((t) => t.status === "waiting" && waitMinutes(t) < 10).length, color: "oklch(0.68 0.18 145)" },
    { name: "Atenção", value: tickets.filter((t) => t.status === "waiting" && waitMinutes(t) >= 10 && waitMinutes(t) < 15).length, color: "oklch(0.78 0.16 75)" },
    { name: "Crítico", value: stats.breaches, color: "oklch(0.566 0.214 27.5)" },
  ];

  const exportCSV = () => {
    const rows = [
      ["ticket_code", "category", "status", "counter", "customer_name", "created_at", "called_at", "finished_at"],
      ...tickets.map((t) => [
        t.ticket_code, t.category, t.status, t.counter ?? "", t.customer_name ?? "",
        t.created_at, t.called_at ?? "", t.finished_at ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bcn-flow-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [dateStr, setDateStr] = useState("");
  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("pt-BR", { dateStyle: "long" }));
  }, []);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-secondary/30">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">BCN Flow · Inteligência</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Analytics Operacional</h1>
            <p className="text-sm text-muted-foreground">Métricas em tempo real do dia · {dateStr}</p>
          </div>
          <Button onClick={exportCSV} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Kpi icon={<Users />} label="Total emitido" value={stats.total} />
          <Kpi icon={<CheckCircle2 />} label="Atendidos" value={stats.done} valueClass="text-success" />
          <Kpi icon={<Clock />} label="Em espera" value={stats.waiting} />
          <Kpi icon={<Accessibility />} label="Prioritários" value={stats.priority} accent />
          <Kpi icon={<AlertTriangle />} label="Breaches SLA" value={stats.breaches} valueClass="text-destructive" />
          <Kpi icon={<Clock />} label="Espera média" value={`${stats.avgWait}m`} />
          <Kpi icon={<TrendingUp />} label="Atend. médio" value={`${stats.avgServe}m`} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-5 shadow-soft">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">Throughput por Hora</p>
            <h2 className="text-lg font-bold">Emitidos vs. Atendidos</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="emitidos" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="atendidos" fill="oklch(0.68 0.18 145)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 shadow-soft">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">Categoria</p>
            <h2 className="text-lg font-bold">Distribuição</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="lg:col-span-3 p-5 shadow-soft">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">SLA · Fila de espera atual</p>
            <h2 className="text-lg font-bold">Compliance por estado</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slaData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} width={80} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {slaData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Kpi({ icon, label, value, accent, valueClass }: { icon: React.ReactNode; label: string; value: number | string; accent?: boolean; valueClass?: string }) {
  return (
    <Card className="p-3 shadow-soft">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5", accent && "bg-primary/10 text-primary")}>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-black tabular-nums tracking-tight", accent && "text-primary", valueClass)}>{value}</div>
    </Card>
  );
}
