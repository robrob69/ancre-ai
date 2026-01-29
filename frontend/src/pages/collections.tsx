import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDropzone } from "react-dropzone"
import {
  Plus,
  FolderOpen,
  FileText,
  Trash2,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
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
import { useToast } from "@/hooks/use-toast"
import { collectionsApi } from "@/api/collections"
import { documentsApi } from "@/api/documents"
import type { Collection, Document } from "@/types"

interface UploadingFile {
  file: File
  progress: number
  status: "uploading" | "success" | "error"
  error?: string
}

export function CollectionsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  // Fetch collections
  const { data: collections, isLoading: collectionsLoading, error: collectionsError } = useQuery({
    queryKey: ["collections"],
    queryFn: collectionsApi.list,
  })

  // Fetch documents for selected collection
  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", selectedCollection?.id],
    queryFn: () => selectedCollection ? documentsApi.list(selectedCollection.id) : Promise.resolve([]),
    enabled: !!selectedCollection,
  })

  // Create collection mutation
  const createCollectionMutation = useMutation({
    mutationFn: (name: string) => collectionsApi.create({ name }),
    onSuccess: (collection) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] })
      toast({
        title: "Collection créée",
        description: `La collection "${collection.name}" a été créée.`,
      })
      setIsCreateModalOpen(false)
      setNewCollectionName("")
      setSelectedCollection(collection)
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la collection.",
      })
    },
  })

  // Delete collection mutation
  const deleteCollectionMutation = useMutation({
    mutationFn: collectionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] })
      toast({
        title: "Collection supprimée",
        description: "La collection a été supprimée.",
      })
      if (selectedCollection) {
        setSelectedCollection(null)
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la collection.",
      })
    },
  })

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", selectedCollection?.id] })
      queryClient.invalidateQueries({ queryKey: ["collections"] })
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé.",
      })
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer le document.",
      })
    },
  })

  // Dropzone
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!selectedCollection) return

      acceptedFiles.forEach(async (file) => {
        const uploadingFile: UploadingFile = {
          file,
          progress: 0,
          status: "uploading",
        }

        setUploadingFiles((prev) => [...prev, uploadingFile])

        try {
          // Simulate progress (actual progress would require axios onUploadProgress)
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file ? { ...f, progress: 50 } : f
            )
          )

          await documentsApi.upload(selectedCollection.id, file)

          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file ? { ...f, progress: 100, status: "success" } : f
            )
          )

          // Refresh documents
          queryClient.invalidateQueries({ queryKey: ["documents", selectedCollection.id] })
          queryClient.invalidateQueries({ queryKey: ["collections"] })

          // Remove from uploading list after delay
          setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((f) => f.file !== file))
          }, 2000)
        } catch {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file
                ? { ...f, status: "error", error: "Échec de l'upload" }
                : f
            )
          )
        }
      })
    },
    [selectedCollection, queryClient]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    disabled: !selectedCollection,
  })

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "pending":
        return <FileText className="h-4 w-4 text-yellow-500" />
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (collectionsError) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            Impossible de charger les collections. Veuillez réessayer.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
          <p className="mt-1 text-muted-foreground">
            Gérez vos collections de documents pour vos assistants
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle collection
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Collections list */}
        <div className="lg:col-span-1">
          <h2 className="mb-4 text-lg font-semibold">Mes collections</h2>

          {collectionsLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          )}

          {!collectionsLoading && collections?.length === 0 && (
            <Card className="flex flex-col items-center justify-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Aucune collection
              </p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Créer une collection
              </Button>
            </Card>
          )}

          {!collectionsLoading && collections && collections.length > 0 && (
            <div className="space-y-3">
              {collections.map((collection) => (
                <Card
                  key={collection.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedCollection?.id === collection.id
                      ? "border-primary bg-muted/50"
                      : ""
                  }`}
                  onClick={() => setSelectedCollection(collection)}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <FolderOpen className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-sm">
                            {collection.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {collection.documents_count} document(s)
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteCollectionMutation.mutate(collection.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Documents panel */}
        <div className="lg:col-span-2">
          {!selectedCollection ? (
            <Card className="flex h-full min-h-[400px] flex-col items-center justify-center">
              <FolderOpen className="h-16 w-16 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                Sélectionnez une collection
              </h3>
              <p className="mt-2 text-center text-muted-foreground">
                Choisissez une collection pour voir et uploader des documents
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {selectedCollection.name}
                </h2>
                <Badge variant="secondary">
                  {selectedCollection.documents_count} document(s)
                </Badge>
              </div>

              {/* Upload zone */}
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm font-medium">
                  {isDragActive
                    ? "Déposez les fichiers ici..."
                    : "Glissez-déposez des fichiers ou cliquez pour sélectionner"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  PDF, TXT, MD, DOCX (max 10 MB)
                </p>
              </div>

              {/* Uploading files */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadingFiles.map((upload, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-center gap-3">
                        {upload.status === "uploading" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : upload.status === "success" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {upload.file.name}
                          </p>
                          {upload.status === "uploading" && (
                            <Progress value={upload.progress} className="mt-1 h-1" />
                          )}
                          {upload.status === "error" && (
                            <p className="text-xs text-red-500">{upload.error}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            setUploadingFiles((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Documents list */}
              {documentsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : documents && documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <Card key={doc.id} className="p-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(doc.status)}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size)} • {doc.chunk_count || 0} chunks
                          </p>
                        </div>
                        <Badge
                          variant={
                            doc.status === "ready"
                              ? "default"
                              : doc.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {doc.status === "ready"
                            ? "Prêt"
                            : doc.status === "processing"
                            ? "En cours"
                            : doc.status === "failed"
                            ? "Erreur"
                            : doc.status === "pending"
                            ? "En attente"
                            : doc.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteDocumentMutation.mutate(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aucun document dans cette collection
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Uploadez des fichiers pour commencer
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create collection modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle collection</DialogTitle>
            <DialogDescription>
              Créez une collection pour organiser vos documents.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name">Nom de la collection</Label>
            <Input
              id="name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Ma collection"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => createCollectionMutation.mutate(newCollectionName)}
              disabled={!newCollectionName.trim() || createCollectionMutation.isPending}
            >
              {createCollectionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
