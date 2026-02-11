import { useEffect, useCallback, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Save,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useDocumentStore } from "@/hooks/use-document-store"
import { useAutosave } from "@/hooks/use-autosave"
import { workspaceDocumentsApi } from "@/api/workspace-documents"
import { BlockRenderer } from "@/components/documents/BlockRenderer"
import { DocumentCopilotActions } from "@/components/documents/DocumentCopilotActions"
import type { DocBlock, DocModel } from "@/types"

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

  return (
    <div className="container py-6 max-w-4xl space-y-6">
      {/* CopilotKit actions (invisible — registers hooks) */}
      <DocumentCopilotActions
        docId={id!}
        title={title}
        docType={doc.doc_type}
        collectionIds={collectionIds}
      />

      {/* Top bar */}
      <div className="flex items-center gap-3">
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
          className="text-xl font-semibold border-0 shadow-none bg-transparent h-auto py-1 px-2 focus-visible:ring-1"
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
          Exporter PDF
        </Button>
      </div>

      {/* Blocks */}
      <div className="space-y-4">
        {docModel?.blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            onChange={(patch) => handleBlockChange(block.id, patch)}
            onRemove={() => removeBlock(block.id)}
          />
        ))}

        {(!docModel?.blocks || docModel.blocks.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground mb-4">
              Ce document est vide. Ajoutez des blocs pour commencer.
            </p>
          </div>
        )}
      </div>

      {/* Add block button */}
      <div className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un bloc
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem onClick={() => handleAddBlock("rich_text")}>
              Texte riche
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddBlock("line_items")}>
              Lignes (devis/facture)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddBlock("clause")}>
              Clause
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddBlock("terms")}>
              Conditions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddBlock("signature")}>
              Signature
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddBlock("variables")}>
              Variables
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sources (if any) */}
      {docModel?.sources && docModel.sources.length > 0 && (
        <div className="border-t pt-4 mt-8">
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
  )
}
