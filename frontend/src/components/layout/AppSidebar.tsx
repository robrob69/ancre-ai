import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  Mail,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Anchor,
  MessageSquare,
  CreditCard,
  Bot,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { assistantsApi } from "@/api/assistants";
import type { Assistant } from "@/types";

const mainNav = [
  { label: "Accueil", icon: LayoutDashboard, path: "/app" },
  { label: "Documents", icon: FileText, path: "/app/workspace" },
  { label: "Emails", icon: Mail, path: "/app/email" },
  { label: "Recherche", icon: Search, path: "/app/search" },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();

  // Fetch assistants from API
  const { data: assistants = [], isLoading } = useQuery({
    queryKey: ["assistants"],
    queryFn: assistantsApi.list,
  });

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
        <Anchor className="h-5 w-5 text-gold shrink-0" />
        {!collapsed && (
          <span className="ml-2.5 font-display text-lg font-bold text-sidebar-primary tracking-tight">
            Ancre
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="py-3 px-2 space-y-0.5">
        <div className={cn("mb-3", collapsed && "hidden")}>
          <span className="px-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">
            Navigation
          </span>
        </div>
        {mainNav.map((item) => {
          const active = location.pathname === item.path || (item.path !== "/app" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Assistants section */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className={cn("mb-2 mt-2", collapsed && "hidden")}>
          <span className="px-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">
            Assistants
          </span>
        </div>

        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-sidebar-muted" />
          </div>
        )}

        {!collapsed &&
          assistants.map((a: Assistant) => {
            const settings = (a.settings || {}) as Record<string, unknown>;
            const emoji = (settings.emoji as string) || "";
            const role = (settings.role as string) || a.model;
            const assistantPath = `/app/assistant/${a.id}`;

            return (
              <Link
                key={a.id}
                to={assistantPath}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors w-full text-left group",
                  location.pathname === assistantPath
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                {emoji ? (
                  <span className="text-base shrink-0">{emoji}</span>
                ) : (
                  <Bot className="h-4 w-4 shrink-0 text-sidebar-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sidebar-accent-foreground truncate">{a.name}</div>
                  <div className="text-[11px] text-sidebar-muted truncate">{role}</div>
                </div>
                <MessageSquare className="h-3.5 w-3.5 text-sidebar-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            );
          })}

        {collapsed &&
          assistants.map((a: Assistant) => {
            const settings = (a.settings || {}) as Record<string, unknown>;
            const emoji = (settings.emoji as string) || "";
            const assistantPath = `/app/assistant/${a.id}`;

            return (
              <Link
                key={a.id}
                to={assistantPath}
                className={cn(
                  "flex items-center justify-center py-2 rounded-md transition-colors w-full",
                  location.pathname === assistantPath
                    ? "bg-sidebar-accent"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                title={a.name}
              >
                {emoji ? (
                  <span className="text-base">{emoji}</span>
                ) : (
                  <Bot className="h-4 w-4 text-sidebar-muted" />
                )}
              </Link>
            );
          })}
      </div>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2 space-y-0.5">
        <Link
          to="/app/billing"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <CreditCard className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Facturation</span>}
        </Link>
        <Link
          to="/app/profile"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Réglages</span>}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="w-full flex justify-center text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
