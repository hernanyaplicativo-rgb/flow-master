import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useTickets } from "@/hooks/useTickets";
import { speak } from "@/lib/queue";
import { PhoneCall } from "lucide-react";

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
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-background p-6">
      {/* Header */}
      <header className="flex items-center justify-between pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-extrabold shadow-elegant">B</div>
          <div className="leading-tight">
            <div className="text-xl font-extrabold tracking-tight">BCN <span className="font-light text-muted-foreground">Flow</span></div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Painel de Atendimento</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold tabular-nums"><Clock /></div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-5 gap-5 overflow-hidden">
        {/* Current call — 60% */}
        <section className="col-span-3 flex flex-col rounded-3xl border border-border bg-card p-10 shadow-elegant">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">Senha Atual</p>
          {current ? (
            <div key={current.id} className="flex flex-1 flex-col items-center justify-center text-center animate-slide-up">
              <p className="text-[clamp(8rem,22vw,22rem)] leading-none font-black tracking-tighter text-primary text-glow animate-pulse-call">{current.ticket_code}</p>
              <p className="mt-6 text-2xl font-bold uppercase tracking-[0.3em] text-foreground/80">Dirija-se ao</p>
              <div className="mt-3 inline-flex items-center gap-4 rounded-2xl bg-primary px-12 py-5 text-primary-foreground shadow-elegant">
                <span className="text-2xl uppercase tracking-[0.25em] opacity-80">Balcão</span>
                <span className="text-6xl font-black tabular-nums">{current.counter ?? 1}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <PhoneCall className="mx-auto h-16 w-16 text-muted-foreground/40" />
                <p className="mt-4 text-3xl font-light text-muted-foreground">Aguardando próxima chamada</p>
              </div>
            </div>
          )}
          <div className="mt-auto rounded-xl border border-border bg-secondary/40 px-5 py-3 text-center text-sm font-semibold text-foreground/70">
            Tempo médio de espera estimado: <span className="text-primary">{avgWait} minutos</span>
          </div>
        </section>

        {/* Right column — 40% */}
        <aside className="col-span-2 flex flex-col gap-5 overflow-hidden">
          <div className="flex-1 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-elegant">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">Chamadas Recentes</p>
            <ul className="space-y-2">
              {recent.length === 0 && <li className="text-sm text-muted-foreground">Sem histórico</li>}
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3">
                  <span className="text-3xl font-black tracking-tight text-primary">{t.ticket_code}</span>
                  <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Balcão {t.counter ?? 1}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-1 items-center justify-center rounded-3xl border border-border bg-secondary/30 p-6 text-center shadow-soft">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">Digital Signage</p>
              <p className="mt-3 text-2xl font-bold tracking-tight">Conheça o <span className="text-primary">BCN Flow Business</span></p>
              <p className="mt-1 text-sm text-muted-foreground">Agilidade para a sua empresa.</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Clock() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = () => { if (ref.current) ref.current.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return <span ref={ref} />;
}
