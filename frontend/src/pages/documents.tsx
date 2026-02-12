import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  Plus,
  FileEdit,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { workspaceDocumentsApi } from "@/api/workspace-documents"
import type { WorkspaceDocumentListItem } from "@/types"

const DOC_TYPES = [
  { value: "generic", label: "Generique" },
  { value: "quote", label: "Devis" },
  { value: "invoice", label: "Facture" },
  { value: "contract", label: "Contrat" },
  { value: "nda", label: "NDA" },
  { value: "email", label: "Email" },
  { value: "procedure", label: "Procedure" },
]

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

export function DocumentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDocType, setNewDocType] = useState("generic")
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ["workspace-documents", statusFilter],
    queryFn: () => workspaceDocumentsApi.list(statusFilter),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      workspaceDocumentsApi.create({
        title: newTitle || "Sans titre",
        doc_type: newDocType,
      }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-documents"] })
      setIsCreateOpen(false)
      setNewTitle("")
      setNewDocType("generic")
      toast({ title: "Document cree", description: `"${doc.title}" a ete cree.` })
      navigate(`/app/documents/${doc.id}`)
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le document.", variant: "destructive" })
    },
  })

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau document
        </Button>
      </div>

      {/* Status filter tabs */}
      <Tabs
        value={statusFilter || "all"}
        onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}
      >
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="draft">Brouillons</TabsTrigger>
          <TabsTrigger value="review">En relecture</TabsTrigger>
          <TabsTrigger value="final">Finaux</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Erreur lors du chargement des documents.</span>
        </div>
      )}

      {/* Documents grid */}
      {documents && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileEdit className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium">Aucun document</p>
          <p className="text-muted-foreground mb-4">
            Creez votre premier document pour commencer.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Creer un document
          </Button>
        </div>
      )}

      {documents && documents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc: WorkspaceDocumentListItem) => (
            <Card
              key={doc.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/app/documents/${doc.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant={STATUS_VARIANTS[doc.status] || "outline"}>
                    {STATUS_LABELS[doc.status] || doc.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {DOC_TYPES.find((t) => t.value === doc.doc_type)?.label ||
                      doc.doc_type}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-2">{doc.title}</CardTitle>
                <CardDescription>
                  v{doc.version} — Modifie le{" "}
                  {new Date(doc.updated_at).toLocaleDateString("fr-FR")}
                </CardDescription>
              </CardHeader>
              <CardFooter className="text-xs text-muted-foreground">
                Cree le{" "}
                {new Date(doc.created_at).toLocaleDateString("fr-FR")}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau document</DialogTitle>
            <DialogDescription>
              Creez un document vierge ou a partir d'un modele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Sans titre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc_type">Type de document</Label>
              <Select value={newDocType} onValueChange={setNewDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Creer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
