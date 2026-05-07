import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTickets } from "@/hooks/useTickets";
import { speak } from "@/lib/queue";
import { PhoneCall, Clock as ClockIcon, QrCode } from "lucide-react";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "BCN Flow — Painel" },
      { name: "description", content: "Painel de chamadas BCN Flow." },
    ],
  }),
  component: DisplayPage,
});

function DisplayPage() {
  const { tickets } = useTickets();
  const lastSpokenId = useRef<string | null>(null);

  const called = useMemo(
    () => tickets.filter((t) => t.called_at).sort((a, b) => +new Date(b.called_at!) - +new Date(a.called_at!)),
    [tickets],
  );
  const current = called[0];
  const recent = called.slice(1, 5);

  const waiting = tickets.filter((t) => t.status === "waiting");
  const avgWait = waiting.length
    ? Math.max(1, Math.round(waiting.reduce((s, t) => s + (Date.now() - +new Date(t.created_at)) / 60000, 0) / waiting.length))
    : 6;

  useEffect(() => {
    if (current && current.id !== lastSpokenId.current) {
      lastSpokenId.current = current.id;
      const counter = current.counter ?? 1;
      speak(`Senha ${current.ticket_code.split("").join(" ")}, balcão ${counter}`);
    }
  }, [current]);

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-background p-5">
      <div className="grid flex-1 grid-cols-3 gap-4 overflow-hidden">
        {/* LEFT — SENHA ATUAL (2/3) */}
        <section className="col-span-2 flex flex-col rounded-3xl border-[3px] border-primary bg-card p-8 shadow-elegant">
          <div className="flex items-center justify-between">
            <h1 className="text-5xl font-black uppercase tracking-tight text-primary">Senha Atual</h1>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-2xl font-extrabold">B</div>
          </div>

          {current ? (
            <div key={current.id} className="flex flex-1 flex-col items-start justify-center animate-slide-up">
              <p className="text-[clamp(10rem,28vw,28rem)] leading-[0.85] font-black tracking-tighter text-primary text-glow animate-pulse-call">
                {current.ticket_code}
              </p>
              <p className="mt-6 text-4xl font-extrabold uppercase tracking-tight text-foreground/80">Dirija-se ao balcão</p>
              <div className="mt-4 inline-flex items-center justify-center rounded-2xl bg-primary px-16 py-6 text-primary-foreground shadow-elegant">
                <span className="text-6xl font-black uppercase tracking-wider">Balcão {current.counter ?? 1}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <PhoneCall className="mx-auto h-20 w-20 text-muted-foreground/40" />
                <p className="mt-4 text-4xl font-light text-muted-foreground">Aguardando próxima chamada</p>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-primary/5 px-6 py-4 text-2xl font-bold text-foreground/80">
            <ClockIcon className="h-6 w-6 text-primary" />
            Tempo médio de espera estimado: <span className="text-primary">{avgWait} minutos</span>
          </div>
        </section>

        {/* RIGHT — Sidebar (1/3) on red panel */}
        <aside className="col-span-1 flex flex-col gap-4 overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-elegant">
          {/* Recent calls */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-[0.3em]">Chamadas Recentes</p>
              <ClockIcon className="h-4 w-4 opacity-80" />
            </div>
            {recent.length === 0 && <p className="text-sm opacity-80">Sem histórico</p>}
            {recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-foreground shadow-soft">
                <span className="text-2xl font-black tracking-tight">{t.ticket_code} <span className="text-base font-semibold text-muted-foreground">- Balcão {t.counter ?? 1}</span></span>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <PhoneCall className="h-3 w-3" /> Rechamar
                </span>
              </div>
            ))}
          </div>

          {/* Digital Signage */}
          <div className="flex-1 rounded-2xl bg-card p-5 text-foreground shadow-soft">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">Digital Signage</p>
            <p className="mt-3 text-2xl font-extrabold leading-tight">
              Conheça o <span className="text-primary">BCN Flow Business</span>.
            </p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Agilidade para a sua empresa com IA.</p>
            <p className="mt-3 text-xs font-semibold text-foreground/70">Acesse: www.bcnflow.cv</p>
          </div>

          {/* Footer: clock + QR */}
          <div className="flex items-center justify-between rounded-2xl bg-card p-4 text-foreground shadow-soft">
            <div>
              <div className="text-3xl font-black tabular-nums leading-none"><Clock /></div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[10px] font-extrabold uppercase tracking-wider">Agendamento</div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider">de Casa</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground text-background">
                <QrCode className="h-8 w-8" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Clock() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  useEffect(() => {
    const i = setInterval(() => setT(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })), 1000);
    return () => clearInterval(i);
  }, []);
  return <span>{t}</span>;
}
