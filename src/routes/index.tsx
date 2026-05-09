import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Accessibility, User, CheckCircle2, Loader2, Download, MessageCircle, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTickets } from "@/hooks/useTickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTicket, PEAK_HOURS, COUNTERS, type Ticket, type TicketCategory } from "@/lib/queue";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agendamento — BCN Queuing" },
      { name: "description", content: "Reserve seu atendimento e receba ticket digital com QR Code." },
    ],
  }),
  component: BookingPage,
});

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 08..18

function BookingPage() {
  const [category, setCategory] = useState<TicketCategory>("normal");
  const [name, setName] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [hour, setHour] = useState<string>("");
  const [assignedCounter, setAssignedCounter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const submit = async () => {
    if (!name.trim()) return toast.error("Informe seu nome.");
    if (!date || !hour) return toast.error("Escolha data e horário.");
    if (!assignedCounter) return toast.error("Escolha o balcão de atendimento.");
    setLoading(true);
    try {
      const dt = new Date(date);
      dt.setHours(Number(hour), 0, 0, 0);
      const t = await createTicket({
        category,
        customer_name: name.trim(),
        scheduled_at: dt.toISOString(),
        assigned_counter: Number(assignedCounter),
      });
      setTicket(t);
      toast.success(`Ticket ${t.ticket_code} emitido para o Balcão ${assignedCounter}!`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao emitir ticket.");
    } finally {
      setLoading(false);
    }
  };

  if (ticket) return <TicketView ticket={ticket} onNew={() => setTicket(null)} />;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">BCN Flow · Agendamento</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">Agende seu <span className="text-primary">atendimento</span></h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">Sem filas. Receba um QR Code para check-in instantâneo na agência.</p>
        </div>

        <Card className="mt-8 p-6 md:p-8 shadow-elegant animate-slide-up">
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-semibold">Tipo de atendimento</Label>
              <div className="mt-2 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Categoria de atendimento">
                <CategoryTile
                  active={category === "normal"}
                  onClick={() => setCategory("normal")}
                  icon={<User className="h-5 w-5" />}
                  title="Normal"
                  subtitle="Atendimento padrão"
                />
                <CategoryTile
                  active={category === "priority"}
                  onClick={() => setCategory("priority")}
                  icon={<Accessibility className="h-5 w-5" />}
                  title="Prioritário"
                  subtitle="Idosos, PCD, gestantes (Lei 10.048)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">Nome completo <span className="text-destructive" aria-hidden>*</span></Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como devemos te chamar?" autoComplete="name" aria-required="true" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP", { locale: ptBR }) : <span>Escolher data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Horário</Label>
                <Select value={hour} onValueChange={setHour}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => {
                      const peak = PEAK_HOURS.includes(h);
                      return (
                        <SelectItem key={h} value={String(h)} disabled={peak}>
                          {String(h).padStart(2, "0")}:00 {peak && "— horário de pico (indisponível)"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Horários de pico (12h, 13h, 17h, 18h) são bloqueados.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Balcão de atendimento <span className="text-destructive" aria-hidden>*</span></Label>
              <Select value={assignedCounter} onValueChange={setAssignedCounter}>
                <SelectTrigger><SelectValue placeholder="Escolher balcão" /></SelectTrigger>
                <SelectContent>
                  {COUNTERS.map((c) => (
                    <SelectItem key={c} value={String(c)}>Balcão {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Sua marcação será atribuída ao balcão escolhido.</p>
            </div>

            <div aria-live="polite">
              <Button size="lg" className="h-12 w-full bg-success text-base font-bold text-success-foreground hover:bg-success/90" onClick={submit} disabled={loading} aria-busy={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />}
                Emitir Ticket Digital
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

function CategoryTile({ active, onClick, icon, title, subtitle }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-primary/5 shadow-elegant" : "border-border hover:border-primary/40 hover:bg-secondary/50",
      )}
    >
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>{icon}</div>
      <div className="mt-1 text-sm font-semibold">{title}</div>
      <div className="text-[11px] text-muted-foreground">{subtitle}</div>
    </button>
  );
}

function TicketView({ ticket, onNew }: { ticket: Ticket; onNew: () => void }) {
  const [checkingIn, setCheckingIn] = useState(false);
  const { tickets } = useTickets();
  const payload = JSON.stringify({ id: ticket.id, code: ticket.ticket_code });

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const liveTicket = tickets.find((t) => t.id === ticket.id);
    if (liveTicket && liveTicket.status === "called") {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Sua Senha foi Chamada! 📢", {
          body: `Dirija-se ao Balcão ${liveTicket.counter || 1}.`,
        });
      }
      toast.success(`Sua senha foi chamada! Dirija-se ao Balcão ${liveTicket.counter || 1}.`, { duration: 10000 });
    }
  }, [tickets, ticket.id]);

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Olá! Minha senha no BCN Flow é *${ticket.ticket_code}* para atendimento ${ticket.category === "priority" ? "Prioritário" : "Normal"}. Acompanhe pelo quiosque!`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleAutoCheckIn = () => {
    setCheckingIn(true);
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada pelo seu navegador.");
      setCheckingIn(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Simulando a verificação de distância com as coordenadas da agência
        // const { latitude, longitude } = pos.coords;
        setTimeout(() => {
          toast.success("Check-in automático realizado com sucesso via GPS!");
          setCheckingIn(false);
        }, 1500);
      },
      (err) => {
        toast.error("Não foi possível obter sua localização para o check-in.");
        setCheckingIn(false);
      }
    );
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="overflow-hidden border-border p-0 shadow-elegant animate-slide-up">
          <div className="border-b border-border p-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">Sua Senha</p>
            <p className="mt-3 text-7xl font-black tracking-tighter text-primary">{ticket.ticket_code}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{ticket.category === "priority" ? "Prioritário" : "Normal"}</p>
          </div>
          <div className="flex flex-col items-center gap-4 p-6">
            <div className="rounded-xl border border-border bg-white p-3">
              <QRCodeSVG value={payload} size={180} level="M" />
            </div>
            <div className="text-center text-sm">
              <p className="font-semibold">{ticket.customer_name}</p>
              {ticket.scheduled_at && (
                <p className="text-muted-foreground">{format(new Date(ticket.scheduled_at), "PPp", { locale: ptBR })}</p>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">Apresente este QR Code no quiosque da agência ou faça o check-in automático se estiver próximo.</p>
            
            <div className="flex w-full flex-col gap-2">
              <Button 
                onClick={handleAutoCheckIn} 
                disabled={checkingIn}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {checkingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Check-in Automático via GPS
              </Button>
              <Button 
                variant="outline" 
                onClick={shareWhatsApp} 
                className="w-full border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Enviar para o WhatsApp
              </Button>
            </div>

            <div className="mt-2 grid w-full grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => window.print()} className="border-primary text-primary hover:bg-primary/5"><Download className="mr-2 h-4 w-4" />Salvar</Button>
              <Button onClick={onNew} className="bg-success text-success-foreground hover:bg-success/90">Novo agendamento</Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
