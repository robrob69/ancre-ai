import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Settings2,
  Send,
  Plus,
  Trash2,
  Link as LinkIcon,
  FileText,
  StickyNote,
  Plug,
  Bot,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { assistantsApi } from "@/api/assistants";
import { collectionsApi } from "@/api/collections";
import { documentsApi } from "@/api/documents";
import { chatApi } from "@/api/chat";
import {
  integrationsApi,
  type NangoConnection,
} from "@/api/integrations";
import type { Document as DocType } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Provider display names ──
const PROVIDER_NAMES: Record<string, string> = {
  "google-drive": "Google Drive",
  notion: "Notion",
  gmail: "Gmail",
  outlook: "Outlook",
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
  slack: "Slack",
  shopify: "Shopify",
  stripe: "Stripe",
};

// ── Helper: document status label ──
function docStatusLabel(status: string) {
  switch (status) {
    case "ready":
      return "Indexé";
    case "processing":
      return "En cours";
    case "pending":
      return "En attente";
    case "failed":
      return "Erreur";
    default:
      return status;
  }
}

function docStatusVariant(status: string) {
  switch (status) {
    case "ready":
      return "success" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "status" as const;
  }
}

// ── Chat message type ──
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

// ── Component ──
const AssistantPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"chat" | "config">("chat");

  // ── Fetch assistant ──
  const {
    data: assistant,
    isLoading: isLoadingAssistant,
    error: assistantError,
  } = useQuery({
    queryKey: ["assistant", id],
    queryFn: () => assistantsApi.get(id!),
    enabled: !!id,
  });

  // ── Fetch documents for assistant's collection ──
  const collectionId = assistant?.collection_ids?.[0];
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ["documents", collectionId],
    queryFn: () => documentsApi.list(collectionId!),
    enabled: !!collectionId,
    refetchInterval: (query) => {
      // Auto-refresh while any doc is processing
      const docs = query.state.data;
      if (docs?.some((d: DocType) => d.status === "processing" || d.status === "pending")) {
        return 5000;
      }
      return false;
    },
  });

  // ── Fetch Nango connections ──
  const { data: nangoConnections = [] } = useQuery({
    queryKey: ["nango-connections"],
    queryFn: integrationsApi.listConnections,
  });

  // ── Config state ──
  const [consignes, setConsignes] = useState("");
  const [newLink, setNewLink] = useState("");
  const [links, setLinks] = useState<{ url: string; label: string }[]>([]);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [configDirty, setConfigDirty] = useState(false);

  // Initialize config from assistant data
  useEffect(() => {
    if (assistant) {
      setConsignes(assistant.system_prompt || "");
      const savedLinks = (assistant.settings as Record<string, unknown>)?.links;
      setLinks(Array.isArray(savedLinks) ? (savedLinks as { url: string; label: string }[]) : []);
      setSelectedIntegrations(assistant.integration_ids || []);
      setConfigDirty(false);
    }
  }, [assistant]);

  // ── Chat state ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  conversationIdRef.current = conversationId;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Mutations ──

  // Save config (system prompt + links)
  const saveConfigMutation = useMutation({
    mutationFn: () =>
      assistantsApi.update(id!, {
        system_prompt: consignes,
        integration_ids: selectedIntegrations,
        settings: {
          ...(assistant?.settings as Record<string, unknown>),
          links,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant", id] });
      setConfigDirty(false);
      toast({ title: "Configuration sauvegardée" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder." });
    },
  });

  // Upload document
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      let targetCollectionId = collectionId;

      // Auto-create a collection if the assistant doesn't have one
      if (!targetCollectionId) {
        const newCol = await collectionsApi.create({
          name: assistant?.name || "Documents",
        });
        // Link collection to assistant
        await assistantsApi.update(id!, {
          collection_ids: [newCol.id],
        });
        targetCollectionId = newCol.id;
        queryClient.invalidateQueries({ queryKey: ["assistant", id] });
      }

      return documentsApi.upload(targetCollectionId!, file);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document importé", description: data.filename });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'importer le document." });
    },
  });

  // Delete document
  const deleteDocMutation = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document supprimé" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer." });
    },
  });

  // ── Chat handlers ──
  const handleSend = useCallback(() => {
    if (!chatInput.trim() || !id) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput.trim(),
    };
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatInput("");
    setIsChatLoading(true);

    abortRef.current = chatApi.stream(
      id,
      {
        message: chatInput.trim(),
        conversation_id: conversationIdRef.current || undefined,
      },
      // onToken
      (token) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: m.content + token } : m
          )
        );
      },
      // onComplete
      (response) => {
        setConversationId(response.conversationId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );
        setIsChatLoading(false);
      },
      // onError
      (error) => {
        console.error("Chat stream error:", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: "Une erreur s'est produite. Réessayez.", isStreaming: false }
              : m
          )
        );
        setIsChatLoading(false);
      },
      // onConversationId
      (newConvId) => {
        setConversationId(newConvId);
      }
    );
  }, [chatInput, id]);

  // ── Link handlers ──
  const addLink = () => {
    if (!newLink.trim()) return;
    try {
      const url = new URL(newLink.trim());
      setLinks((prev) => [...prev, { url: url.href, label: url.hostname }]);
      setNewLink("");
      setConfigDirty(true);
    } catch {
      toast({ variant: "destructive", title: "URL invalide" });
    }
  };

  const removeLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
    setConfigDirty(true);
  };

  // ── File upload handler ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => uploadMutation.mutate(file));
    e.target.value = "";
  };

  // ── Loading / Error states ──
  if (isLoadingAssistant) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (assistantError || !assistant) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Assistant introuvable</p>
          <Button variant="outline" onClick={() => navigate("/app")}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const settings = (assistant.settings || {}) as Record<string, unknown>;
  const emoji = (settings.emoji as string) || "";
  const role = (settings.role as string) || "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 h-14 px-3 sm:px-5 border-b border-border bg-surface-elevated shrink-0">
        {emoji && <span className="text-lg sm:text-xl">{emoji}</span>}
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-semibold text-foreground text-sm truncate">
            {assistant.name}
          </h1>
          {role && (
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {role}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={activeTab === "chat" ? "default" : "ghost"}
            size="sm"
            className="gap-1 sm:gap-1.5 text-xs sm:text-sm"
            onClick={() => setActiveTab("chat")}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Chat</span>
          </Button>
          <Button
            variant={activeTab === "config" ? "default" : "ghost"}
            size="sm"
            className="gap-1 sm:gap-1.5 text-xs sm:text-sm"
            onClick={() => setActiveTab("config")}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Configurer</span>
          </Button>
        </div>
      </div>

      {/* ═══════ CHAT TAB ═══════ */}
      {activeTab === "chat" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-auto p-5">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-gold-light mx-auto flex items-center justify-center">
                    {emoji ? (
                      <span className="text-3xl">{emoji}</span>
                    ) : (
                      <Bot className="h-8 w-8 text-gold" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-display font-semibold text-foreground text-lg">
                      {assistant.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                      {role || "Posez-moi une question, je m'appuierai sur mes sources connectées pour vous répondre."}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {documents.length > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <FileText className="h-3 w-3" />
                        {documents.length} doc{documents.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {links.length > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <LinkIcon className="h-3 w-3" />
                        {links.length} site{links.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {selectedIntegrations.length > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Plug className="h-3 w-3" />
                        {selectedIntegrations.length} connecteur{selectedIntegrations.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-gold-light flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-gold" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      msg.isStreaming && !msg.content ? (
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border bg-surface-elevated px-3 sm:px-5 py-3 shrink-0">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend()
                }
                placeholder={`Demandez quelque chose à ${assistant.name}…`}
                className="flex-1"
                disabled={isChatLoading}
              />
              <Button
                variant="premium"
                size="icon"
                onClick={handleSend}
                disabled={!chatInput.trim() || isChatLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ═══════ CONFIG TAB ═══════ */
        <div className="flex-1 overflow-auto p-3 sm:p-5">
          <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
            {/* ── Consignes ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-gold" />
                <h3 className="font-display font-semibold text-foreground text-sm">
                  Consignes & Prompt système
                </h3>
              </div>
              <textarea
                value={consignes}
                onChange={(e) => {
                  setConsignes(e.target.value);
                  setConfigDirty(true);
                }}
                rows={5}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground resize-none outline-none focus:border-gold/40 transition-colors placeholder:text-muted-foreground"
                placeholder="Décrivez le comportement de l'assistant, son ton, ses spécialités…"
              />
              <p className="text-xs text-muted-foreground">
                Ces instructions guident le comportement de l'assistant pour
                toutes les conversations.
              </p>
            </section>

            {/* ── Liens de sites ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-gold" />
                <h3 className="font-display font-semibold text-foreground text-sm">
                  Liens de sites
                </h3>
              </div>
              <div className="space-y-2">
                {links.map((link, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card border border-border group"
                  >
                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {link.label}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {link.url}
                      </div>
                    </div>
                    <button
                      onClick={() => removeLink(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                  placeholder="https://example.com"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addLink}
                  disabled={!newLink.trim()}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>
            </section>

            {/* ── Documents ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gold" />
                <h3 className="font-display font-semibold text-foreground text-sm">
                  Documents
                </h3>
                {documents.length > 0 && (
                  <Badge variant="status" className="ml-auto">
                    {documents.length} document{documents.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              {isLoadingDocs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc: DocType) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card border border-border group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gold-light flex items-center justify-center shrink-0">
                        <FileText className="h-3.5 w-3.5 text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">
                          {doc.filename}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {doc.content_type} · {(doc.file_size / 1024).toFixed(0)} Ko
                          {doc.chunk_count != null && ` · ${doc.chunk_count} chunks`}
                        </div>
                      </div>
                      <Badge variant={docStatusVariant(doc.status)}>
                        {doc.status === "processing" && (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        )}
                        {docStatusLabel(doc.status)}
                      </Badge>
                      <button
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                        disabled={deleteDocMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {documents.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucun document importé</p>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.md"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Importer un document
              </Button>
            </section>

            {/* ── Connecteurs disponibles ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-gold" />
                <h3 className="font-display font-semibold text-foreground text-sm">
                  Connecteurs disponibles
                </h3>
                {selectedIntegrations.length > 0 && (
                  <Badge variant="success" className="ml-auto gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {selectedIntegrations.length} sélectionné{selectedIntegrations.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Sélectionnez les connecteurs que cet assistant peut utiliser.
              </p>
              {nangoConnections.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {nangoConnections.map((conn: NangoConnection) => {
                    const isSelected = selectedIntegrations.includes(conn.id);
                    const displayName = PROVIDER_NAMES[conn.provider] || conn.provider;
                    return (
                      <button
                        key={conn.id}
                        onClick={() => {
                          setSelectedIntegrations((prev) =>
                            isSelected
                              ? prev.filter((cid) => cid !== conn.id)
                              : [...prev, conn.id]
                          );
                          setConfigDirty(true);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          isSelected
                            ? "bg-gold/10 border-gold/40 text-gold"
                            : "bg-card border-border text-muted-foreground hover:border-gold/30"
                        )}
                      >
                        {isSelected && <CheckCircle2 className="h-3 w-3" />}
                        <Plug className="h-3 w-3" />
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 rounded-lg border border-dashed border-border">
                  <Plug className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    Aucun connecteur configuré.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-1.5 text-xs"
                    onClick={() => navigate("/app/profile")}
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter dans Réglages
                  </Button>
                </div>
              )}
            </section>

            {/* ── Save button ── */}
            <div className="sticky bottom-0 bg-surface pt-4 pb-2">
              <Button
                variant="premium"
                className="w-full gap-2"
                onClick={() => saveConfigMutation.mutate()}
                disabled={!configDirty || saveConfigMutation.isPending}
              >
                {saveConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Sauvegarder la configuration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { AssistantPage };
export default AssistantPage;
