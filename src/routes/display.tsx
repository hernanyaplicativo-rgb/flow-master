import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTickets } from "@/hooks/useTickets";
import { speak } from "@/lib/queue";
import { PhoneCall, Clock as ClockIcon, QrCode, TrendingUp, Megaphone } from "lucide-react";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "BCN Flow — Painel" },
      { name: "description", content: "Painel de chamadas BCN Flow." },
    ],
  }),
  component: DisplayPage,
});

const NEWS = [
  "BCN Flow · Agora pode agendar o seu atendimento de casa em www.bcnflow.cv",
  "Câmbios do dia atualizados em tempo real · Consulte o nosso balcão de tesouraria",
  "Novo: empréstimos pessoais com aprovação em 24h para clientes BCN Premium",
  "Lei 10.048 · Atendimento prioritário a idosos, gestantes e pessoas com deficiência",
];

const FX = [
  { c: "USD", r: "108.42", t: "+0.21%" },
  { c: "EUR", r: "110.27", t: "0.00%" },
  { c: "GBP", r: "129.55", t: "-0.14%" },
  { c: "BRL", r: "18.94", t: "+0.42%" },
];

function DisplayPage() {
  const { tickets } = useTickets();
  const lastSpokenId = useRef<string | null>(null);

  const called = useMemo(
    () => tickets.filter((t) => t.called_at).sort((a, b) => +new Date(b.called_at!) - +new Date(a.called_at!)),
    [tickets],
  );
  const current = called[0];
  const recent = called.slice(1, 5);

  const waiting = useMemo(
    () => tickets
      .filter((t) => t.status === "waiting")
      .sort((a, b) => {
        if (a.category !== b.category) return a.category === "priority" ? -1 : 1;
        return +new Date(a.created_at) - +new Date(b.created_at);
      }),
    [tickets],
  );
  const upcoming = waiting.slice(0, 3);
  const avgWait = waiting.length
    ? Math.max(1, Math.round(waiting.reduce((s, t) => s + (Date.now() - +new Date(t.created_at)) / 60000, 0) / waiting.length))
    : 6;

  useEffect(() => {
    if (current && current.id !== lastSpokenId.current) {
      lastSpokenId.current = current.id;
      const counter = current.counter ?? 1;
      // chime
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        [880, 1320].forEach((freq, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.value = freq; o.type = "sine";
          g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
          g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
          o.connect(g); g.connect(ctx.destination);
          o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.4);
        });
      } catch { /* noop */ }
      setTimeout(() => speak(`Senha ${current.ticket_code.split("").join(" ")}, balcão ${counter}`), 600);
    }
  }, [current]);

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <div className="grid flex-1 grid-cols-3 gap-4 overflow-hidden p-5 pb-2">
        {/* LEFT — SENHA ATUAL (2/3) */}
        <section className="col-span-2 flex flex-col rounded-3xl border-[3px] border-primary bg-card p-8 shadow-elegant">
          <div className="flex items-center justify-between">
            <h1 className="text-5xl font-black uppercase tracking-tight text-primary">Senha Atual</h1>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-2xl font-extrabold">B</div>
          </div>

          {current ? (
            <div key={current.id} className="flex flex-1 flex-col items-start justify-center animate-slide-up">
              <p className="text-[clamp(8rem,22vw,22rem)] leading-[0.85] font-black tracking-tighter text-primary text-glow animate-pulse-call">
                {current.ticket_code}
              </p>
              <p className="mt-4 text-3xl font-extrabold uppercase tracking-tight text-foreground/80">Dirija-se ao balcão</p>
              <div className="mt-3 inline-flex items-center justify-center rounded-2xl bg-primary px-12 py-5 text-primary-foreground shadow-elegant">
                <span className="text-5xl font-black uppercase tracking-wider">Balcão {current.counter ?? 1}</span>
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

          {/* Próximas Senhas */}
          <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-muted-foreground">Próximas Senhas</p>
              <p className="text-xs font-bold text-muted-foreground">{waiting.length} na fila · espera ~ <span className="text-primary">{avgWait}m</span></p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {upcoming.length === 0 && (
                <p className="col-span-3 py-3 text-center text-sm text-muted-foreground">Sem clientes em espera</p>
              )}
              {upcoming.map((t, idx) => (
                <div key={t.id} className={`flex flex-col items-center rounded-xl border bg-card p-3 ${idx === 0 ? "border-primary/50 shadow-soft" : "border-border"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {idx === 0 ? "1ª · A seguir" : idx === 1 ? "2ª" : "3ª"}
                  </span>
                  <span className="text-3xl font-black tracking-tight text-primary">{t.ticket_code}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.category === "priority" ? "Prioritário" : "Normal"}
                  </span>
                </div>
              ))}
            </div>
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
                <span className="text-2xl font-black tracking-tight">{t.ticket_code} <span className="text-sm font-semibold text-muted-foreground">· Balcão {t.counter ?? 1}</span></span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {new Date(t.called_at!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>

          {/* FX Rates */}
          <div className="rounded-2xl bg-card p-4 text-foreground shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">Câmbios · CVE</p>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FX.map((f) => (
                <div key={f.c} className="rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground">{f.c}</span>
                    <span className={`text-[9px] font-bold ${f.t.startsWith("+") ? "text-success" : f.t.startsWith("-") ? "text-destructive" : "text-muted-foreground"}`}>{f.t}</span>
                  </div>
                  <div className="text-base font-black tabular-nums">{f.r}</div>
                </div>
              ))}
            </div>
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

      {/* News Ticker */}
      <div className="flex items-center gap-3 overflow-hidden bg-slate-corporate px-5 py-2.5 text-primary-foreground">
        <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.25em]">
          <Megaphone className="h-3 w-3" /> BCN Live
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="animate-marquee flex gap-12 whitespace-nowrap text-sm font-semibold">
            {[...NEWS, ...NEWS].map((n, i) => (
              <span key={i} className="opacity-90">• {n}</span>
            ))}
          </div>
        </div>
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
