import { useEffect, useCallback, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Download,
  Loader2,
  Save,
  AlertCircle,
  Eye,
  PenLine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useDocumentStore } from "@/hooks/use-document-store"
import { useAutosave } from "@/hooks/use-autosave"
import { workspaceDocumentsApi } from "@/api/workspace-documents"
import { BlockRenderer } from "@/components/documents/BlockRenderer"
import { DocumentCopilotActions } from "@/components/documents/DocumentCopilotActions"
import { DocumentPromptBar } from "@/components/documents/DocumentPromptBar"
import { DocumentPreview } from "@/components/documents/DocumentPreview"
import type { DocBlock, DocBlockKind, DocModel } from "@/types"

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  review: "En relecture",
  final: "Final",
  archived: "Archive",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  review: "secondary",
  final: "default",
  archived: "destructive",
}

const DEFAULT_DOC_MODEL: DocModel = {
  version: 1,
  meta: { tags: [], custom: {} },
  blocks: [],
  variables: {},
  sources: [],
}

function generateId() {
  return crypto.randomUUID()
}

export function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { docModel, setDocModel, updateBlock, addBlock, removeBlock } =
    useDocumentStore()
  const { save, isSaving, lastSaved } = useAutosave(id || "")

  const [title, setTitle] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [isPreview, setIsPreview] = useState(false)

  // Fetch document
  const {
    data: doc,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["workspace-document", id],
    queryFn: () => workspaceDocumentsApi.get(id!),
    enabled: !!id,
  })

  // Initialize store from fetched document
  useEffect(() => {
    if (doc) {
      const content = doc.content_json || DEFAULT_DOC_MODEL
      // Ensure content has all required fields
      const normalized: DocModel = {
        version: content.version ?? 1,
        meta: content.meta ?? { tags: [], custom: {} },
        blocks: content.blocks ?? [],
        variables: content.variables ?? {},
        sources: content.sources ?? [],
      }
      setDocModel(normalized)
      setTitle(doc.title)
    }
  }, [doc, setDocModel])

  // Autosave on docModel changes
  useEffect(() => {
    if (docModel && id) {
      save(docModel)
    }
  }, [docModel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save title on blur
  const handleTitleBlur = useCallback(async () => {
    if (id && title !== doc?.title) {
      await workspaceDocumentsApi.update(id, { title })
      queryClient.invalidateQueries({ queryKey: ["workspace-document", id] })
    }
  }, [id, title, doc?.title, queryClient])

  // Block change handler
  const handleBlockChange = useCallback(
    (blockId: string, patch: Partial<DocBlock>) => {
      updateBlock(blockId, patch)
    },
    [updateBlock]
  )

  // Add new block
  const handleAddBlock = useCallback(
    (type: DocBlock["type"]) => {
      const newBlock: DocBlock = {
        type,
        id: generateId(),
        label: "",
      }

      if (type === "rich_text" || type === "clause" || type === "terms") {
        newBlock.content = {
          type: "doc",
          content: [{ type: "paragraph" }],
        }
      }
      if (type === "line_items") {
        newBlock.items = []
        newBlock.columns = [
          "description",
          "quantity",
          "unit",
          "unit_price",
          "tax_rate",
          "total",
        ]
        newBlock.currency = "EUR"
      }
      if (type === "signature") {
        newBlock.parties = [
          { name: "", role: "Emetteur" },
          { name: "", role: "Destinataire" },
        ]
      }
      if (type === "variables") {
        newBlock.variables = {}
      }

      addBlock(newBlock)
    },
    [addBlock]
  )

  // Export PDF
  const handleExportPdf = useCallback(async () => {
    if (!id) return
    setIsExporting(true)
    try {
      const { url } = await workspaceDocumentsApi.exportPdf(id)
      window.open(url, "_blank")
      toast({ title: "PDF exporte", description: "Le PDF a ete genere avec succes." })
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de generer le PDF.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }, [id, toast])

  // Get assistant collection IDs for CopilotKit
  const collectionIds: string[] = [] // Will be populated from assistant if linked

  if (isLoading) {
    return (
      <div className="container py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="container py-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Document introuvable.</span>
        </div>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate("/app/documents")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux documents
        </Button>
      </div>
    )
  }

  const blocksEmpty = !docModel?.blocks || docModel.blocks.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* CopilotKit actions (invisible — registers hooks) */}
      <DocumentCopilotActions
        docId={id!}
        title={title}
        docType={doc.doc_type}
        collectionIds={collectionIds}
      />

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border bg-surface-elevated shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app/documents")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="text-lg font-semibold border-0 shadow-none bg-transparent h-auto py-1 px-2 focus-visible:ring-1 max-w-md"
          placeholder="Sans titre"
        />

        <Badge variant={STATUS_VARIANTS[doc.status] || "outline"}>
          {STATUS_LABELS[doc.status] || doc.status}
        </Badge>

        <div className="flex-1" />

        {/* Save indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Enregistrement...</span>
            </>
          ) : lastSaved ? (
            <>
              <Save className="h-3 w-3" />
              <span>Enregistre</span>
            </>
          ) : null}
        </div>

        {/* Preview toggle */}
        <Button
          variant={isPreview ? "default" : "outline"}
          size="sm"
          onClick={() => setIsPreview((v) => !v)}
          className="gap-1.5"
        >
          {isPreview ? (
            <>
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Editer</span>
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Apercu</span>
            </>
          )}
        </Button>

        {/* Export PDF */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          <span className="hidden sm:inline">Exporter PDF</span>
        </Button>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto bg-surface">
        {isPreview ? (
          /* ── Preview mode ── */
          <div className="px-4 sm:px-6 py-8">
            <DocumentPreview
              title={title}
              docType={doc.doc_type}
              docModel={docModel}
            />
          </div>
        ) : (
          /* ── Edit mode ── */
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4 min-h-full flex flex-col">
            {/* Blocks */}
            <div className="space-y-4 flex-1">
              {docModel?.blocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  onChange={(patch) => handleBlockChange(block.id, patch)}
                  onRemove={() => removeBlock(block.id)}
                />
              ))}

              {/* Sources (if any) */}
              {docModel?.sources && docModel.sources.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Sources RAG
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {docModel.sources.map((src, i) => (
                      <li key={i}>
                        {src.document_filename}
                        {src.page_number && `, p. ${src.page_number}`}
                        {src.excerpt && (
                          <span className="text-xs ml-2 italic">
                            — {src.excerpt.slice(0, 100)}...
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* AI Prompt Bar — always visible at bottom in edit mode */}
            <DocumentPromptBar
              docId={id!}
              docType={doc.doc_type}
              collectionIds={collectionIds}
              onAddBlock={(type: DocBlockKind) => handleAddBlock(type)}
              isEmpty={blocksEmpty}
            />
          </div>
        )}
      </div>
    </div>
  )
}
