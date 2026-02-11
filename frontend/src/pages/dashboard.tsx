import { useNavigate } from "react-router-dom";
import { FileText, Mail, Search, Mic, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const actions = [
  {
    id: "document",
    label: "Rédiger un document",
    description: "Contrat, devis, NDA, compte-rendu, note…",
    icon: FileText,
    path: "/app/workspace",
  },
  {
    id: "email",
    label: "Composer un email",
    description: "Avec ton, contexte et sources",
    icon: Mail,
    path: "/app/email",
  },
  {
    id: "search",
    label: "Rechercher une info",
    description: "Interroger vos documents et sources",
    icon: Search,
    path: "/app/search",
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">
              Que souhaitez-vous faire ?
            </h1>
            <p className="text-sm text-muted-foreground">
              Choisissez une action ou décrivez votre besoin ci-dessous.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(a.path)}
                className="group flex flex-col items-center gap-3 w-full px-4 py-5 rounded-xl bg-card border border-border shadow-soft hover:shadow-elevated hover:border-gold/30 transition-all text-center"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gold-light group-hover:bg-gradient-gold transition-colors shrink-0">
                  <a.icon className="h-5 w-5 text-gold group-hover:text-gold-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{a.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Prompt bar */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ou décrivez votre besoin</p>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
                    e.preventDefault();
                    navigate("/app/search");
                  }
                }}
                rows={3}
                placeholder="Ex : Rédige un email de relance pour le client TechCo concernant le devis en attente…"
                className="w-full text-sm bg-card border border-border rounded-xl px-5 py-4 pr-28 outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground shadow-soft resize-none leading-relaxed"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isRecording
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-muted hover:bg-accent/20 text-muted-foreground hover:text-foreground"
                  }`}
                  title={isRecording ? "Arrêter la dictée" : "Dicter"}
                >
                  <Mic className="h-4 w-4" />
                </button>
                <Button variant="premium" size="icon" className="h-10 w-10 rounded-full" disabled={!prompt.trim()}>
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
