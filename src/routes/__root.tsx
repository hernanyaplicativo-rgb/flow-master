import { Link, Outlet, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import { Calendar, Monitor, Tv, LayoutDashboard, BarChart3 } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Voltar</Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BCN — Omni-channel Queuing" },
      { name: "description", content: "Plataforma enterprise de gestão de experiência do cliente do BCN." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  { to: "/", label: "Agendamento", icon: Calendar },
  { to: "/kiosk", label: "Quiosque", icon: Monitor },
  { to: "/display", label: "Painel TV", icon: Tv },
  { to: "/staff", label: "Atendente", icon: LayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

function RootComponent() {
  const loc = useLocation();
  const fullscreen = loc.pathname === "/display";

  return (
    <>
      {!fullscreen && (
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-extrabold text-base shadow-elegant">B</div>
              <div className="leading-tight">
                <div className="text-sm font-extrabold tracking-tight">BCN</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Banco Caboverdiano de Negócios</div>
              </div>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-secondary text-foreground" }}
                  activeOptions={{ exact: true }}
                >
                  <n.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </header>
      )}
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  );
}
