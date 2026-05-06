import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useTickets } from "@/hooks/useTickets";
import { speak } from "@/lib/queue";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "Painel BCN" },
      { name: "description", content: "Painel de chamadas BCN." },
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
  const recent = called.slice(1, 6);

  useEffect(() => {
    if (current && current.id !== lastSpokenId.current) {
      lastSpokenId.current = current.id;
      const counter = current.counter ?? 1;
      speak(`Senha ${current.ticket_code.split("").join(" ")}, balcão ${counter}`);
    }
  }, [current]);

  return (
    <main className="flex h-screen w-screen flex-col bg-display-gradient text-primary-foreground overflow-hidden">
      <header className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-foreground text-primary font-bold">B</div>
          <div>
            <div className="text-lg font-bold tracking-wide">BCN</div>
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-70">Banco Central Nacional</div>
          </div>
        </div>
        <div className="text-sm font-medium opacity-80"><Clock /></div>
      </header>

      <div className="grid flex-1 grid-cols-5 gap-6 px-10 pb-10">
        {/* 60% Current call */}
        <section className="col-span-3 flex flex-col items-center justify-center rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 p-10">
          {current ? (
            <div key={current.id} className="text-center animate-pulse-call">
              <p className="text-xl uppercase tracking-[0.4em] opacity-60">Chamando senha</p>
              <p className="mt-6 text-[180px] md:text-[240px] leading-none font-extrabold tracking-tighter text-primary text-glow">{current.ticket_code}</p>
              <div className="mt-8 inline-flex items-center gap-4 rounded-2xl bg-white/10 px-12 py-6 backdrop-blur">
                <span className="text-2xl uppercase tracking-[0.3em] opacity-70">Balcão</span>
                <span className="text-7xl font-extrabold">{current.counter ?? 1}</span>
              </div>
            </div>
          ) : (
            <div className="text-center opacity-60">
              <p className="text-3xl font-light">Aguardando próxima chamada</p>
            </div>
          )}
        </section>

        {/* 40% recent + signage */}
        <aside className="col-span-2 flex flex-col gap-6">
          <div className="rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] opacity-70">Chamadas recentes</p>
            <ul className="space-y-2">
              {recent.length === 0 && <li className="text-sm opacity-60">Sem histórico</li>}
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <span className="text-3xl font-bold tracking-tight">{t.ticket_code}</span>
                  <span className="text-sm uppercase tracking-widest opacity-70">Balcão {t.counter ?? 1}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-1 items-center justify-center rounded-3xl bg-gradient-to-br from-white/10 to-white/0 border border-white/10 p-6 text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] opacity-60">Digital Signage</p>
              <p className="mt-3 text-2xl font-light">Conheça os <span className="font-bold">novos investimentos BCN</span></p>
              <p className="mt-2 text-sm opacity-70">Espaço reservado para vídeo institucional em loop.</p>
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
    const tick = () => { if (ref.current) ref.current.textContent = new Date().toLocaleTimeString("pt-BR"); };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return <span ref={ref} />;
}
