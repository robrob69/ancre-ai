/**
 * AI Prompt Bar for the document editor.
 * Allows users to type or dictate instructions to generate document blocks via Mistral.
 * Also provides quick-add buttons for manual block creation.
 */

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Mic,
  MicOff,
  SendHorizontal,
  Plus,
  FileText,
  Table2,
  Scale,
  ScrollText,
  PenLine,
  Variable,
  ChevronUp,
  Sparkles,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnchorLogo } from "@/components/ui/anchor-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { workspaceDocumentsApi } from "@/api/workspace-documents"
import { useDocumentStore } from "@/hooks/use-document-store"
import type { DocBlock, DocBlockKind, DocPatch } from "@/types"

// ── Speech Recognition types (Web Speech API) ──

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

// ── Helpers ──

function generateId() {
  return crypto.randomUUID()
}

function applyPatches(
  patches: DocPatch[],
  updateBlock: (id: string, patch: Partial<DocBlock>) => void,
  addBlock: (block: DocBlock, afterId?: string) => void
) {
  for (const patch of patches) {
    if (patch.op === "add_block" && patch.value) {
      addBlock(patch.value as unknown as DocBlock)
    } else if (patch.op === "replace_block" && patch.block_id && patch.value) {
      updateBlock(patch.block_id, patch.value as Partial<DocBlock>)
    }
  }
}

const BLOCK_TYPES: { type: DocBlockKind; label: string; icon: typeof FileText }[] = [
  { type: "rich_text", label: "Texte riche", icon: FileText },
  { type: "line_items", label: "Lignes (devis/facture)", icon: Table2 },
  { type: "clause", label: "Clause", icon: Scale },
  { type: "terms", label: "Conditions", icon: ScrollText },
  { type: "signature", label: "Signature", icon: PenLine },
  { type: "variables", label: "Variables", icon: Variable },
]

// ── Props ──

interface DocumentPromptBarProps {
  docId: string
  docType: string
  collectionIds?: string[]
  onAddBlock: (type: DocBlockKind) => void
  isEmpty?: boolean
}

export function DocumentPromptBar({
  docId,
  docType,
  collectionIds = [],
  onAddBlock,
  isEmpty = false,
}: DocumentPromptBarProps) {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const { updateBlock, addBlock } = useDocumentStore()

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 120) + "px"
    }
  }, [prompt])

  // Clear AI message after 5s
  useEffect(() => {
    if (aiMessage) {
      const timer = setTimeout(() => setAiMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [aiMessage])

  // ── Speech Recognition ──

  const startRecording = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError("La reconnaissance vocale n'est pas supportee par ce navigateur.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "fr-FR"

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        setPrompt((prev) => {
          const separator = prev && !prev.endsWith(" ") ? " " : ""
          return prev + separator + finalTranscript
        })
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        setError(`Erreur de reconnaissance vocale: ${event.error}`)
      }
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setError(null)
  }, [])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // ── AI Generation ──

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)
    setError(null)
    setAiMessage(null)

    // Stop recording if active
    if (isRecording) {
      stopRecording()
    }

    try {
      const response = await workspaceDocumentsApi.generate(docId, {
        prompt: prompt.trim(),
        collection_ids: collectionIds,
        doc_type: docType,
      })

      applyPatches(response.patches, updateBlock, addBlock)
      setAiMessage(response.message || "Contenu genere avec succes.")
      setPrompt("")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la generation du contenu."
      )
    } finally {
      setIsGenerating(false)
    }
  }, [
    prompt,
    isGenerating,
    isRecording,
    stopRecording,
    docId,
    collectionIds,
    docType,
    updateBlock,
    addBlock,
  ])

  // ── Keyboard handler ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
        e.preventDefault()
        handleGenerate()
      }
    },
    [handleGenerate, prompt]
  )

  return (
    <div className="sticky bottom-0 z-10 bg-gradient-to-t from-surface via-surface to-transparent pt-6 pb-4">
      {/* Status messages */}
      {error && (
        <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 animate-fade-in">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {aiMessage && (
        <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 animate-fade-in">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>{aiMessage}</span>
        </div>
      )}

      {/* Generating indicator with Ancre logo */}
      {isGenerating && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center gap-3 justify-center animate-fade-in">
          <AnchorLogo streaming size="sm" />
          <span className="text-sm text-muted-foreground">Generation du document en cours…</span>
        </div>
      )}

      {/* Prompt bar */}
      <div className="max-w-3xl mx-auto">
        {isEmpty && !isGenerating && (
          <div className="text-center mb-4 animate-fade-in">
            <Sparkles className="h-8 w-8 text-primary/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Decrivez le contenu souhaite ou dictez vos instructions
            </p>
          </div>
        )}

        <div className={`relative bg-card border rounded-xl shadow-elevated overflow-hidden transition-all focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-ring/10 ${isGenerating ? "border-primary/30 ring-4 ring-ring/10" : "border-border"}`}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isGenerating}
            placeholder={
              isEmpty
                ? "Ex : Redige un contrat NDA entre deux parties avec les clauses standards…"
                : "Decrivez ce que vous souhaitez ajouter au document…"
            }
            className="w-full text-sm bg-transparent px-4 pt-3 pb-2 pr-28 outline-none resize-none text-foreground placeholder:text-muted-foreground leading-relaxed disabled:opacity-50"
          />

          {/* Bottom row: block buttons + actions */}
          <div className="flex items-center gap-1.5 px-3 pb-2.5">
            {/* Quick add block dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition-colors"
                  disabled={isGenerating}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Bloc</span>
                  <ChevronUp className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                {BLOCK_TYPES.map((bt) => (
                  <DropdownMenuItem
                    key={bt.type}
                    onClick={() => onAddBlock(bt.type)}
                  >
                    <bt.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                    {bt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* Dictation button */}
            <button
              onClick={toggleRecording}
              disabled={isGenerating}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
              } disabled:opacity-50`}
              title={isRecording ? "Arreter la dictee" : "Dicter"}
            >
              {isRecording ? (
                <MicOff className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Send button */}
            <Button
              variant="premium"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!prompt.trim() || isGenerating}
              onClick={handleGenerate}
            >
              <SendHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isRecording && (
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-destructive animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
            Ecoute en cours… Parlez pour dicter le contenu
          </div>
        )}
      </div>
    </div>
  )
}
