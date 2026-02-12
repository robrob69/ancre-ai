import { Mail, Download, Clock, Search, Send, ChevronRight, ArrowLeft, Reply, Forward, Mic, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      { subject: "Relance facture #1042", date: "20 jan. 2026", status: "Envoyé", body: "Bonjour Sophie,\n\nJe me permets de vous relancer concernant la facture #1042 d'un montant de 4 500\u20AC, émise le 5 janvier.\n\nMerci de bien vouloir procéder au règlement.\n\nCordialement,\nPierre Durand" },
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

  // Compose new email state
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeTone, setComposeTone] = useState("Diplomate");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const filtered = search
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.company.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      )
    : contacts;

  const handleBack = () => {
    if (composing) {
      setComposing(false);
    } else if (selectedEmail) {
      setSelectedEmail(null);
      setReplying(false);
      setReplyBody("");
    } else if (selectedContact) {
      setSelectedContact(null);
    }
  };

  const openCompose = () => {
    setComposing(true);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setComposeTone("Diplomate");
    setSelectedContact(null);
    setSelectedEmail(null);
    setReplying(false);
    setReplyBody("");
    setSearch("");
  };

  // ── Speech Recognition for compose ──

  const startRecording = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "fr-FR";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setComposeBody((prev) => {
          const separator = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
          return prev + separator + finalTranscript;
        });
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 sm:gap-3 h-auto min-h-[3.5rem] px-3 sm:px-5 py-2 border-b border-border bg-surface-elevated shrink-0 flex-wrap">
        <Mail className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
        <h1 className="font-display font-semibold text-foreground text-sm sm:text-base">Emails</h1>
        <span className="text-xs text-muted-foreground hidden sm:inline">{totalEmails} emails · {contacts.length} contacts</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un contact…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedContact(null); setSelectedEmail(null); }}
              className="pl-9 h-9 w-40 sm:w-56 text-sm"
            />
          </div>
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

      <div className="flex-1 overflow-hidden flex">
        {/* Compose new email */}
        {composing && (
          <div className="flex-1 overflow-auto animate-fade-in">
            <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setComposing(false)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="font-display font-semibold text-foreground text-sm sm:text-base">Nouvel email</h2>
                  <p className="text-xs text-muted-foreground">Composez un email ou dictez son contenu</p>
                </div>
              </div>

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

                {/* Tone selector bar */}
                <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-3 bg-muted/30">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground shrink-0">Ton :</span>
                  <Select value={composeTone} onValueChange={setComposeTone}>
                    <SelectTrigger className="w-32 h-7 text-xs border-0 bg-transparent shadow-none px-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tones.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Body */}
                <div className="relative">
                  <textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    className="w-full min-h-[280px] p-4 pr-14 text-sm leading-relaxed bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground"
                    placeholder="Redigez votre email ou dictez-le en cliquant sur le micro…"
                    autoFocus
                  />
                  <button
                    onClick={toggleRecording}
                    className={`absolute right-3 bottom-3 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isRecording
                        ? "bg-destructive text-destructive-foreground animate-pulse"
                        : "bg-muted hover:bg-accent/20 text-muted-foreground hover:text-foreground"
                    }`}
                    title={isRecording ? "Arreter la dictee" : "Dicter"}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </div>

                {isRecording && (
                  <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-destructive border-t border-border/50 bg-destructive/5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                    </span>
                    Ecoute en cours… Parlez pour dicter le contenu
                  </div>
                )}

                {/* Actions bar */}
                <div className="px-4 py-3 border-t border-border flex items-center gap-2 bg-muted/20">
                  <Button
                    variant="premium"
                    size="sm"
                    className="gap-1.5"
                    disabled={!composeTo.trim() || !composeBody.trim()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Envoyer
                  </Button>
                  <Button variant="outline" size="sm" disabled={!composeBody.trim()}>
                    Brouillon
                  </Button>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact list + email detail (hidden when composing) */}
        {!composing && (
          <>
            <div className={`${selectedContact ? "hidden sm:block sm:w-72 border-r border-border" : "flex-1"} overflow-auto bg-surface transition-all shrink-0`}>
              <div className={`${selectedContact ? "" : "max-w-3xl mx-auto"} p-3 sm:p-4 space-y-1`}>
                {filtered.map((contact) => (
                  <button
                    key={contact.email}
                    onClick={() => { setSelectedContact(contact); setSelectedEmail(null); setReplying(false); }}
                    className={`group flex items-center gap-3 w-full px-3 sm:px-4 py-3 rounded-lg text-left transition-all cursor-pointer ${
                      selectedContact?.email === contact.email
                        ? "bg-accent border border-primary/20"
                        : "bg-card border border-border hover:shadow-soft hover:border-primary/20"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 font-display font-semibold text-sm text-foreground">
                      {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{contact.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{contact.company} · {contact.emails.length} email{contact.emails.length > 1 ? "s" : ""}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground">Aucun contact trouvé</div>
                )}
              </div>
            </div>

            {/* Email list + detail */}
            {selectedContact && (
              <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
                {!selectedEmail ? (
                  <div className="flex-1 overflow-auto p-3 sm:p-5">
                    <div className="max-w-2xl mx-auto space-y-4">
                      <div className="flex items-center gap-3 pb-4 border-b border-border">
                        <Button variant="ghost" size="icon" className="shrink-0 sm:hidden h-8 w-8" onClick={() => setSelectedContact(null)}>
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-muted flex items-center justify-center font-display font-bold text-foreground shrink-0">
                          {selectedContact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-display font-semibold text-foreground text-sm sm:text-base truncate">{selectedContact.name}</h2>
                          <div className="text-xs text-muted-foreground truncate">{selectedContact.email} · {selectedContact.company}</div>
                        </div>
                      </div>
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
                                <Clock className="h-3 w-3" />
                                <span>{email.date}</span>
                              </div>
                            </div>
                            <Badge variant={email.status === "Envoyé" ? "default" : "outline"}>{email.status}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <div className="border-b border-border bg-surface-elevated px-5 py-3 flex items-center gap-3 shrink-0">
                      <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0 h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{selectedEmail.subject}</div>
                        <div className="text-xs text-muted-foreground">À : {selectedContact.email} · {selectedEmail.date}</div>
                      </div>
                      <Badge variant={selectedEmail.status === "Envoyé" ? "default" : "outline"}>{selectedEmail.status}</Badge>
                    </div>

                    <div className="max-w-2xl mx-auto p-6 space-y-6">
                      <div className="bg-card border border-border rounded-lg p-6 shadow-soft">
                        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-display font-semibold text-xs text-foreground">
                            PD
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">Pierre Durand</div>
                            <div className="text-xs text-muted-foreground">à {selectedContact.name} ({selectedContact.email})</div>
                          </div>
                          <div className="ml-auto text-xs text-muted-foreground">{selectedEmail.date}</div>
                        </div>
                        <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                          {selectedEmail.body}
                        </div>
                      </div>

                      {!replying && (
                        <div className="flex items-center gap-2">
                          <Button variant="action" size="sm" className="gap-1.5" onClick={() => setReplying(true)}>
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

                      {replying && (
                        <div className="bg-card border border-border rounded-lg shadow-soft animate-fade-in">
                          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                            <Reply className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">Réponse à {selectedContact.name}</span>
                            <div className="ml-auto flex items-center gap-2">
                              <Select defaultValue="Diplomate">
                                <SelectTrigger className="w-32 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {tones.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="relative">
                            <textarea
                              value={replyBody}
                              onChange={(e) => setReplyBody(e.target.value)}
                              className="w-full min-h-[180px] p-4 pr-14 text-sm leading-relaxed bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground"
                              placeholder="Rédigez votre réponse ou dictez-la…"
                              autoFocus
                            />
                            <button
                              className="absolute right-3 bottom-3 w-9 h-9 rounded-full flex items-center justify-center bg-muted hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-all"
                              title="Dicter"
                            >
                              <Mic className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="px-4 py-3 border-t border-border flex items-center gap-2">
                            <Button variant="premium" size="sm" className="gap-1.5">
                              <Send className="h-3.5 w-3.5" />
                              Envoyer
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setReplying(false); setReplyBody(""); }}>
                              Annuler
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EmailComposer;
