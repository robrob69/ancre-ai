import { Mail, Download, Clock, Search, Send, ChevronRight, Reply, Forward, Mic, Plus, Sparkles, Bot, Loader2, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assistantsApi } from "@/api/assistants";
import { chatApi } from "@/api/chat";
import type { Assistant } from "@/types";

interface EmailData {
  subject: string;
  date: string;
  status: string;
  body: string;
}

interface Contact {
  name: string;
  email: string;
  company: string;
  emails: EmailData[];
}

const contacts: Contact[] = [
  {
    name: "Julie Martin",
    email: "j.martin@techco.fr",
    company: "TechCo",
    emails: [
      { subject: "Relance devis TechCo", date: "10 fév. 2026", status: "Envoyé", body: "Bonjour Julie,\n\nJe me permets de revenir vers vous concernant le devis envoyé la semaine dernière pour la refonte de votre infrastructure cloud.\n\nPourriez-vous me confirmer si vous avez eu l'occasion de l'examiner ? Je reste disponible pour en discuter.\n\nCordialement,\nPierre Durand" },
      { subject: "Proposition commerciale Q1", date: "28 jan. 2026", status: "Envoyé", body: "Bonjour Julie,\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint notre proposition commerciale pour le premier trimestre 2026.\n\nLes conditions tarifaires sont valables jusqu'au 28 février.\n\nBien à vous,\nPierre Durand" },
    ],
  },
  {
    name: "Contact Acme",
    email: "contact@acme.com",
    company: "Acme",
    emails: [
      { subject: "Proposition partenariat Acme", date: "8 fév. 2026", status: "Brouillon", body: "Bonjour,\n\nNous souhaiterions vous proposer un partenariat stratégique entre nos deux entreprises.\n\nSeriez-vous disponible pour un call cette semaine ?\n\nCordialement" },
    ],
  },
  {
    name: "Sophie Dupont",
    email: "s.dupont@client.fr",
    company: "Client SA",
    emails: [
      { subject: "Confirmation RDV vendredi", date: "7 fév. 2026", status: "Envoyé", body: "Bonjour Sophie,\n\nJe vous confirme notre rendez-vous ce vendredi à 14h dans vos locaux.\n\nN'hésitez pas si vous avez des points à ajouter à l'ordre du jour.\n\nÀ vendredi,\nPierre Durand" },
      { subject: "Suivi projet phase 2", date: "1 fév. 2026", status: "Envoyé", body: "Bonjour Sophie,\n\nVoici le récapitulatif de l'avancement du projet phase 2 :\n- Développement : 80%\n- Tests : en cours\n- Livraison prévue : 15 mars\n\nCordialement,\nPierre Durand" },
      { subject: "Relance facture #1042", date: "20 jan. 2026", status: "Envoyé", body: "Bonjour Sophie,\n\nJe me permets de vous relancer concernant la facture #1042 d'un montant de 4 500€, émise le 5 janvier.\n\nMerci de bien vouloir procéder au règlement.\n\nCordialement,\nPierre Durand" },
    ],
  },
  {
    name: "Service Juridique",
    email: "legal@partenaire.fr",
    company: "Partenaire & Co",
    emails: [
      { subject: "Demande d'informations RGPD", date: "5 fév. 2026", status: "Envoyé", body: "Bonjour,\n\nDans le cadre de notre mise en conformité RGPD, pourriez-vous nous transmettre les documents suivants :\n- Politique de traitement des données\n- Registre des sous-traitants\n- DPA signé\n\nMerci d'avance,\nPierre Durand" },
    ],
  },
  {
    name: "Nicolas Bernard",
    email: "n.bernard@newco.fr",
    company: "NewCo",
    emails: [
      { subject: "Suivi onboarding nouveau client", date: "3 fév. 2026", status: "Brouillon", body: "Bonjour Nicolas,\n\nBienvenue parmi nos clients ! Voici les prochaines étapes de votre onboarding :\n1. Configuration de votre espace\n2. Formation de vos équipes\n3. Mise en production\n\nCordialement,\nPierre Durand" },
      { subject: "Bienvenue chez nous", date: "30 jan. 2026", status: "Envoyé", body: "Bonjour Nicolas,\n\nNous sommes ravis de vous compter parmi nos clients.\n\nVotre chargé de compte est Pierre Durand, n'hésitez pas à le contacter pour toute question.\n\nBienvenue !" },
    ],
  },
];

const tones = ["Direct", "Diplomate", "Ferme", "Amical", "Formel"];
const totalEmails = contacts.reduce((sum, c) => sum + c.emails.length, 0);

// ── Speech Recognition types (Web Speech API) ──

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export const EmailComposer = () => {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);
  const [search, setSearch] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyTone, setReplyTone] = useState("Diplomate");
  const [replyInstruction, setReplyInstruction] = useState("");

  // Compose new email state
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeTone, setComposeTone] = useState("Diplomate");
  const [composeInstruction, setComposeInstruction] = useState("");

  // Shared state
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const wantsRecordingRef = useRef(false);
  const abortGenerationRef = useRef<(() => void) | null>(null);
  // Track which setter dictation should write to
  const dictationTargetRef = useRef<React.Dispatch<React.SetStateAction<string>>>(setComposeBody);

  // Fetch assistants for context selection
  const { data: assistants = [] } = useQuery({
    queryKey: ["assistants"],
    queryFn: assistantsApi.list,
    staleTime: 30_000,
  });

  // Auto-select first assistant
  useEffect(() => {
    const first = assistants[0];
    if (first && !selectedAssistantId) {
      setSelectedAssistantId(first.id);
    }
  }, [assistants, selectedAssistantId]);

  const filtered = search
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.company.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      )
    : contacts;

  const openCompose = () => {
    setComposing(true);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setComposeTone("Diplomate");
    setComposeInstruction("");
    setSelectedContact(null);
    setSelectedEmail(null);
    setReplying(false);
    setReplyBody("");
    setReplyInstruction("");
    setSearch("");
  };

  // ── Speech Recognition (context-aware target) ──

  const startRecording = useCallback((targetSetter: React.Dispatch<React.SetStateAction<string>>) => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    // Stop any existing recording first
    if (recognitionRef.current) {
      wantsRecordingRef.current = false;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    dictationTargetRef.current = targetSetter;
    wantsRecordingRef.current = true;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "fr-FR";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal) {
          finalTranscript += result[0]?.transcript ?? "";
        }
      }
      if (finalTranscript) {
        dictationTargetRef.current((prev) => {
          const separator = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
          return prev + separator + finalTranscript;
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantsRecordingRef.current = false;
        recognitionRef.current = null;
        setIsRecording(false);
        return;
      }
    };

    recognition.onend = () => {
      if (wantsRecordingRef.current) {
        try { recognition.start(); } catch {
          wantsRecordingRef.current = false;
          recognitionRef.current = null;
          setIsRecording(false);
        }
        return;
      }
      recognitionRef.current = null;
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    wantsRecordingRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleRecordingFor = useCallback((targetSetter: React.Dispatch<React.SetStateAction<string>>) => {
    if (isRecording) stopRecording();
    else startRecording(targetSetter);
  }, [isRecording, startRecording, stopRecording]);

  // ── AI Generation (streaming) ──

  const generateWithAI = useCallback((
    prompt: string,
    targetSetter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (!selectedAssistantId) return;

    // Stop any existing generation
    if (abortGenerationRef.current) {
      abortGenerationRef.current();
      abortGenerationRef.current = null;
    }

    setIsGenerating(true);
    // Clear the target field before generating
    targetSetter("");

    const abort = chatApi.stream(
      selectedAssistantId,
      { message: prompt },
      // onToken: append each token to target
      (token) => {
        targetSetter((prev) => prev + token);
      },
      // onComplete
      () => {
        setIsGenerating(false);
        abortGenerationRef.current = null;
      },
      // onError
      (error) => {
        console.error("AI generation error:", error);
        setIsGenerating(false);
        abortGenerationRef.current = null;
      },
    );

    abortGenerationRef.current = abort;
  }, [selectedAssistantId]);

  const stopGeneration = useCallback(() => {
    if (abortGenerationRef.current) {
      abortGenerationRef.current();
      abortGenerationRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const generateReply = useCallback(() => {
    if (!selectedContact || !selectedEmail) return;
    if (!replyInstruction.trim()) return;
    const prompt = `Tu es un assistant de rédaction d'emails professionnels. Rédige une réponse à l'email suivant sur un ton "${replyTone}".

Email original de ${selectedContact.name} (${selectedContact.email}, ${selectedContact.company}) :
Objet : ${selectedEmail.subject}
---
${selectedEmail.body}
---

Consigne de l'utilisateur : ${replyInstruction.trim()}

Rédige UNIQUEMENT le corps de la réponse (pas d'objet, pas de "Re:"). Commence directement par la formule de salutation.`;

    generateWithAI(prompt, setReplyBody);
  }, [selectedContact, selectedEmail, replyInstruction, replyTone, generateWithAI]);

  const generateComposeEmail = useCallback(() => {
    if (!composeInstruction.trim()) return;
    const prompt = `Tu es un assistant de rédaction d'emails professionnels. Rédige un email sur un ton "${composeTone}".

${composeTo ? `Destinataire : ${composeTo}` : ""}
${composeSubject ? `Objet : ${composeSubject}` : ""}

Consigne : ${composeInstruction.trim()}

Rédige UNIQUEMENT le corps de l'email. Commence directement par la formule de salutation.`;

    generateWithAI(prompt, setComposeBody);
  }, [composeTo, composeSubject, composeInstruction, composeTone, generateWithAI]);

  // ── Determine current view ──
  const isContactList = !composing && !selectedContact;
  const isEmailList = !composing && !!selectedContact && !selectedEmail;
  const isEmailDetail = !composing && !!selectedContact && !!selectedEmail;

  // ── Assistant selector widget (reusable) ──
  const AssistantSelector = () => (
    assistants.length > 0 ? (
      <>
        <div className="w-px h-4 bg-border/50" />
        <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <select
          value={selectedAssistantId || ""}
          onChange={(e) => setSelectedAssistantId(e.target.value)}
          className="bg-transparent border-0 text-xs text-muted-foreground hover:text-foreground outline-none cursor-pointer py-0.5 pr-4 max-w-[140px] truncate"
        >
          {assistants.map((a: Assistant) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </>
    ) : null
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header with breadcrumb ── */}
      <div className="flex items-center gap-2 sm:gap-3 h-auto min-h-[3.5rem] px-3 sm:px-5 py-2 border-b border-border bg-surface-elevated shrink-0 flex-wrap">
        {/* Breadcrumb navigation */}
        {isContactList && (
          <>
            <Mail className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
            <h1 className="font-display font-semibold text-foreground text-sm sm:text-base">Emails</h1>
            <span className="text-xs text-muted-foreground hidden lg:inline">{totalEmails} emails · {contacts.length} contacts</span>
          </>
        )}

        {isEmailList && selectedContact && (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              onClick={() => { setSelectedContact(null); setSearch(""); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Emails</span>
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{selectedContact.name}</span>
            <Badge variant="outline" className="ml-1 text-[10px] shrink-0 hidden sm:inline-flex">
              {selectedContact.emails.length} email{selectedContact.emails.length > 1 ? "s" : ""}
            </Badge>
          </div>
        )}

        {isEmailDetail && selectedContact && selectedEmail && (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              onClick={() => { setSelectedContact(null); setSelectedEmail(null); setReplying(false); setReplyBody(""); setSearch(""); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Emails</span>
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <button
              onClick={() => { setSelectedEmail(null); setReplying(false); setReplyBody(""); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 truncate max-w-[120px]"
            >
              {selectedContact.name}
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{selectedEmail.subject}</span>
            <Badge variant={selectedEmail.status === "Envoyé" ? "default" : "outline"} className="ml-1 shrink-0 hidden sm:inline-flex text-[10px]">
              {selectedEmail.status}
            </Badge>
          </div>
        )}

        {composing && (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              onClick={() => setComposing(false)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Emails</span>
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground">Nouvel email</span>
          </div>
        )}

        {/* Right-side actions */}
        <div className="ml-auto flex items-center gap-2">
          {isContactList && (
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-36 lg:w-56 text-sm"
              />
            </div>
          )}
          <Button
            variant="premium"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={openCompose}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nouvel email</span>
            <span className="sm:hidden">Nouveau</span>
          </Button>
        </div>
      </div>

      {/* ── Content: single view at a time ── */}
      <div className="flex-1 overflow-auto">

        {/* ═══ Level 1: Contact list (full width grid) ═══ */}
        {isContactList && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            {/* Search on mobile */}
            <div className="relative sm:hidden mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher un contact…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((contact) => (
                <button
                  key={contact.email}
                  onClick={() => { setSelectedContact(contact); setSelectedEmail(null); setReplying(false); }}
                  className="group flex flex-col text-left p-4 rounded-lg bg-card border border-border hover:shadow-soft hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 font-display font-semibold text-sm text-foreground">
                      {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{contact.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{contact.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-auto">
                    <span className="text-[11px] text-muted-foreground">{contact.company}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {contact.emails.length} email{contact.emails.length > 1 ? "s" : ""}
                    </Badge>
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16 text-sm text-muted-foreground">
                <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                Aucun contact trouvé
              </div>
            )}
          </div>
        )}

        {/* ═══ Level 2: Email list for a contact (full width) ═══ */}
        {isEmailList && selectedContact && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4 animate-fade-in">
            {/* Contact header */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center font-display font-bold text-foreground shrink-0">
                {selectedContact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display font-semibold text-foreground text-base truncate">{selectedContact.name}</h2>
                <div className="text-xs text-muted-foreground truncate">{selectedContact.email} · {selectedContact.company}</div>
              </div>
            </div>

            {/* Email cards */}
            <div className="space-y-2">
              {selectedContact.emails.map((email) => (
                <button
                  key={email.subject}
                  onClick={() => setSelectedEmail(email)}
                  className="group flex items-center gap-4 w-full px-4 py-4 rounded-lg bg-card border border-border hover:shadow-soft hover:border-primary/20 transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{email.subject}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{email.date}</span>
                    </div>
                  </div>
                  <Badge variant={email.status === "Envoyé" ? "default" : "outline"} className="shrink-0 hidden sm:inline-flex">{email.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Level 3: Email detail (full width) ═══ */}
        {isEmailDetail && selectedContact && selectedEmail && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
            {/* Email body card */}
            <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-soft">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-display font-semibold text-xs text-foreground shrink-0">
                  PD
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">Pierre Durand</div>
                  <div className="text-xs text-muted-foreground truncate">à {selectedContact.name} ({selectedContact.email})</div>
                </div>
                <div className="ml-auto text-xs text-muted-foreground shrink-0 hidden sm:block">{selectedEmail.date}</div>
              </div>
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                {selectedEmail.body}
              </div>
            </div>

            {/* Action buttons */}
            {!replying && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="action" size="sm" className="gap-1.5" onClick={() => { setReplying(true); setReplyBody(""); setReplyTone("Diplomate"); }}>
                  <Reply className="h-3.5 w-3.5" />
                  Répondre
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Forward className="h-3.5 w-3.5" />
                  Transférer
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            )}

            {/* Reply composer */}
            {replying && (
              <div className="bg-card border border-border rounded-lg shadow-soft animate-fade-in">
                {/* Toolbar: tone + assistant */}
                <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 flex-wrap bg-muted/30">
                  <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground shrink-0">Réponse à {selectedContact.name}</span>
                  <div className="w-px h-4 bg-border/50" />
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground shrink-0">Ton :</span>
                  <Select value={replyTone} onValueChange={setReplyTone}>
                    <SelectTrigger className="w-28 h-7 text-xs border-0 bg-transparent shadow-none px-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tones.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AssistantSelector />
                </div>

                {/* Main email body field */}
                <div className="relative">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    className="w-full min-h-[160px] sm:min-h-[200px] p-4 pr-14 text-sm leading-relaxed bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground"
                    placeholder="Rédigez directement votre réponse ici ou dictez-la…"
                    autoFocus
                  />
                  <button
                    onClick={() => toggleRecordingFor(setReplyBody)}
                    className={`absolute right-3 bottom-3 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isRecording && dictationTargetRef.current === setReplyBody
                        ? "bg-destructive text-destructive-foreground animate-pulse"
                        : "bg-muted hover:bg-accent/20 text-muted-foreground hover:text-foreground"
                    }`}
                    title={isRecording ? "Arrêter la dictée" : "Dicter le contenu"}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </div>

                {/* Generating indicator on body */}
                {isGenerating && (
                  <div className="flex items-center gap-2 px-4 py-2 text-xs text-primary border-t border-border/50 bg-primary/5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="flex-1">L'IA rédige votre réponse…</span>
                    <button onClick={stopGeneration} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <Square className="h-3 w-3" />
                      Arrêter
                    </button>
                  </div>
                )}

                {/* AI instruction field */}
                <div className="border-t border-border bg-muted/20">
                  <div className="px-4 pt-3 pb-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Consigne IA
                    </label>
                  </div>
                  <div className="relative px-4 pb-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={replyInstruction}
                          onChange={(e) => setReplyInstruction(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && replyInstruction.trim() && !isGenerating) generateReply(); }}
                          className="w-full h-9 px-3 pr-10 text-sm bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
                          placeholder="Ex : Confirmer la réception et proposer un rendez-vous…"
                          disabled={isGenerating}
                        />
                        <button
                          onClick={() => toggleRecordingFor(setReplyInstruction)}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            isRecording && dictationTargetRef.current === setReplyInstruction
                              ? "bg-destructive text-destructive-foreground animate-pulse"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          title="Dicter la consigne"
                        >
                          <Mic className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Button
                        variant="premium"
                        size="sm"
                        className="gap-1.5 shrink-0 h-9"
                        onClick={generateReply}
                        disabled={!replyInstruction.trim() || isGenerating || !selectedAssistantId}
                      >
                        {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Générer
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Recording indicator */}
                {isRecording && (
                  <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-destructive border-t border-border/50 bg-destructive/5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                    </span>
                    Écoute en cours… Parlez pour dicter
                  </div>
                )}

                {/* Action bar */}
                <div className="px-4 py-3 border-t border-border flex items-center gap-2 flex-wrap">
                  <Button variant="premium" size="sm" className="gap-1.5" disabled={!replyBody.trim() || isGenerating}>
                    <Send className="h-3.5 w-3.5" />
                    Envoyer
                  </Button>
                  <Button variant="outline" size="sm" disabled={!replyBody.trim() || isGenerating}>
                    Brouillon
                  </Button>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => { setReplying(false); setReplyBody(""); setReplyInstruction(""); stopGeneration(); stopRecording(); }}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Compose new email (full width) ═══ */}
        {composing && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
            <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
              {/* To + Subject fields */}
              <div className="border-b border-border">
                <div className="flex items-center border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground pl-4 w-10 shrink-0">À</span>
                  <Input
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="border-0 shadow-none rounded-none h-10 text-sm focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-center">
                  <span className="text-xs font-medium text-muted-foreground pl-4 w-10 shrink-0">Obj.</span>
                  <Input
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Objet de l'email"
                    className="border-0 shadow-none rounded-none h-10 text-sm focus-visible:ring-0"
                  />
                </div>
              </div>

              {/* Tone + Assistant selector bar */}
              <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-3 bg-muted/30 flex-wrap">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">Ton :</span>
                <Select value={composeTone} onValueChange={setComposeTone}>
                  <SelectTrigger className="w-28 h-7 text-xs border-0 bg-transparent shadow-none px-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tones.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AssistantSelector />
              </div>

              {/* Body */}
              <div className="relative">
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full min-h-[220px] p-4 pr-14 text-sm leading-relaxed bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground"
                  placeholder="Rédigez votre email ici ou dictez-le…"
                  autoFocus
                />
                <button
                  onClick={() => toggleRecordingFor(setComposeBody)}
                  className={`absolute right-3 bottom-3 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isRecording && dictationTargetRef.current === setComposeBody
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-muted hover:bg-accent/20 text-muted-foreground hover:text-foreground"
                  }`}
                  title={isRecording ? "Arrêter la dictée" : "Dicter le contenu"}
                >
                  <Mic className="h-4 w-4" />
                </button>
              </div>

              {/* Generating indicator on body */}
              {isGenerating && (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-primary border-t border-border/50 bg-primary/5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="flex-1">L'IA rédige votre email…</span>
                  <button onClick={stopGeneration} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Square className="h-3 w-3" />
                    Arrêter
                  </button>
                </div>
              )}

              {/* AI instruction field */}
              <div className="border-t border-border bg-muted/20">
                <div className="px-4 pt-3 pb-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Consigne IA
                  </label>
                </div>
                <div className="relative px-4 pb-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={composeInstruction}
                        onChange={(e) => setComposeInstruction(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && composeInstruction.trim() && !isGenerating) generateComposeEmail(); }}
                        className="w-full h-9 px-3 pr-10 text-sm bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
                        placeholder="Ex : Email de relance suite au devis envoyé la semaine dernière…"
                        disabled={isGenerating}
                      />
                      <button
                        onClick={() => toggleRecordingFor(setComposeInstruction)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isRecording && dictationTargetRef.current === setComposeInstruction
                            ? "bg-destructive text-destructive-foreground animate-pulse"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Dicter la consigne"
                      >
                        <Mic className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Button
                      variant="premium"
                      size="sm"
                      className="gap-1.5 shrink-0 h-9"
                      onClick={generateComposeEmail}
                      disabled={!composeInstruction.trim() || isGenerating || !selectedAssistantId}
                    >
                      {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Générer
                    </Button>
                  </div>
                </div>
              </div>

              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-destructive border-t border-border/50 bg-destructive/5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                  </span>
                  Écoute en cours… Parlez pour dicter
                </div>
              )}

              {/* Actions bar */}
              <div className="px-4 py-3 border-t border-border flex items-center gap-2 bg-muted/20 flex-wrap">
                <Button
                  variant="premium"
                  size="sm"
                  className="gap-1.5"
                  disabled={!composeTo.trim() || !composeBody.trim() || isGenerating}
                >
                  <Send className="h-3.5 w-3.5" />
                  Envoyer
                </Button>
                <Button variant="outline" size="sm" disabled={!composeBody.trim() || isGenerating}>
                  Brouillon
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => { setComposing(false); setComposeInstruction(""); stopGeneration(); stopRecording(); }}>
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailComposer;
