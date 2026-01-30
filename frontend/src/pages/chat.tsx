import { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Send,
  Bot,
  User,
  Loader2,
  ArrowLeft,
  Plus,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { assistantsApi } from "@/api/assistants"
import { chatApi } from "@/api/chat"
import type { Citation, Message } from "@/types"
import { cn } from "@/lib/utils"

interface LocalMessage extends Message {
  isStreaming?: boolean
}

export function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortFnRef = useRef<(() => void) | null>(null)

  const { data: assistant, isLoading: isLoadingAssistant } = useQuery({
    queryKey: ["assistant", id],
    queryFn: () => assistantsApi.get(id!),
    enabled: !!id,
  })

  // Fetch conversation list
  const { data: conversations, refetch: refetchConversations } = useQuery({
    queryKey: ["conversations", id],
    queryFn: () => chatApi.listConversations(id!),
    enabled: !!id,
  })

  // Track if we need to add a new conversation optimistically
  const isNewConversationRef = useRef(false)
  const firstMessageRef = useRef("")

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async () => {
    if (!input.trim() || isLoading || !id) return

    const userMessage: LocalMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    }

    // Track if this is a new conversation
    isNewConversationRef.current = !conversationId
    firstMessageRef.current = userMessage.content

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Add placeholder for assistant response
    const assistantMessageId = (Date.now() + 1).toString()
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        isStreaming: true,
        created_at: new Date().toISOString(),
      },
    ])

    // Use streaming
    abortFnRef.current = chatApi.stream(
      id,
      {
        message: userMessage.content,
        conversation_id: conversationId || undefined,
      },
      // onToken
      (token) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + token }
              : msg
          )
        )
      },
      // onComplete
      (response) => {
        setConversationId(response.conversationId)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false, citations: response.citations }
              : msg
          )
        )
        setIsLoading(false)
        // Refresh conversation list to get the real title from backend
        refetchConversations()
      },
      // onError
      (error) => {
        console.error("Chat error:", error)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: "Désolé, une erreur s'est produite. Veuillez réessayer.",
                  isStreaming: false,
                }
              : msg
          )
        )
        setIsLoading(false)
      },
      // onConversationId - called immediately when conversation is created
      (newConversationId) => {
        if (isNewConversationRef.current) {
          setConversationId(newConversationId)
          // Immediately refetch to show the new conversation in the sidebar
          refetchConversations()
        }
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = () => {
    setMessages([])
    setConversationId(null)
    if (abortFnRef.current) {
      abortFnRef.current()
    }
  }

  const loadConversation = async (convId: string) => {
    if (!id) return
    
    try {
      const history = await chatApi.getConversation(id, convId)
      setMessages(
        history.map((msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
          citations: msg.citations,
          created_at: msg.created_at,
        }))
      )
      setConversationId(convId)
    } catch (error) {
      console.error("Failed to load conversation:", error)
    }
  }

  const toggleCitations = (messageId: string) => {
    setExpandedCitations((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }

  if (isLoadingAssistant) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!assistant) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Assistant non trouvé</CardTitle>
            <CardDescription>
              L'assistant demandé n'existe pas ou a été supprimé.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/app/assistants")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux assistants
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="hidden w-64 flex-shrink-0 border-r bg-muted/30 md:block">
        <div className="flex h-full flex-col">
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleNewConversation}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle conversation
            </Button>
          </div>
          <Separator />
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                HISTORIQUE
              </p>
              {conversations && conversations.length > 0 ? (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={cn(
                        "w-full rounded-md p-2 text-left text-sm transition-colors hover:bg-muted",
                        conversationId === conv.id && "bg-muted"
                      )}
                    >
                      <p className="truncate font-medium">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.last_message_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune conversation
                </p>
              )}
            </div>
          </ScrollArea>
          <Separator />
          <div className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              DOCUMENTS
            </p>
            {assistant.collection_ids.length > 0 ? (
              <Badge variant="secondary">
                <FileText className="mr-1 h-3 w-3" />
                {assistant.collection_ids.length} collection(s)
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun document</p>
            )}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/app/assistants")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">{assistant.name}</p>
                <p className="text-xs text-muted-foreground">{assistant.model}</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleNewConversation}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle conversation
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bot className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  Commencer une conversation
                </h3>
                <p className="mt-2 max-w-sm text-muted-foreground">
                  Posez votre première question à {assistant.name}.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="flex gap-4">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.isStreaming && (
                      <span className="inline-block h-4 w-2 animate-pulse bg-primary" />
                    )}
                  </div>

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-xs text-muted-foreground"
                        onClick={() => toggleCitations(message.id)}
                      >
                        {expandedCitations.has(message.id) ? (
                          <ChevronUp className="mr-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="mr-1 h-3 w-3" />
                        )}
                        {message.citations.length} source(s)
                      </Button>
                      {expandedCitations.has(message.id) && (
                        <div className="mt-2 space-y-2">
                          {message.citations.map((citation: Citation, idx: number) => (
                            <div
                              key={idx}
                              className="rounded-md border bg-muted/50 p-3 text-sm"
                            >
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <FileText className="h-3 w-3" />
                                {citation.document_filename}
                                {citation.page_number && (
                                  <span>- Page {citation.page_number}</span>
                                )}
                              </div>
                              <p className="mt-1 text-xs italic">
                                "{citation.excerpt}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écrivez votre message..."
                className="min-h-[60px] resize-none pr-12"
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="absolute bottom-2 right-2"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Appuyez sur Entrée pour envoyer, Maj+Entrée pour un saut de ligne
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
