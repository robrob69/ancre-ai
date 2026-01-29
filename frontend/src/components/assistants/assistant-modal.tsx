import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { assistantsApi } from "@/api/assistants"
import { collectionsApi } from "@/api/collections"
import type { Assistant } from "@/types"

const assistantSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  system_prompt: z.string().optional(),
  model: z.string().default("gpt-4o-mini"),
  collection_ids: z.array(z.string()).default([]),
})

type AssistantFormData = z.infer<typeof assistantSchema>

interface AssistantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assistant: Assistant | null
}

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Rapide)" },
  { value: "gpt-4o", label: "GPT-4o (Puissant)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
]

export function AssistantModal({
  open,
  onOpenChange,
  assistant,
}: AssistantModalProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isEditing = !!assistant

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: collectionsApi.list,
    enabled: open,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssistantFormData>({
    resolver: zodResolver(assistantSchema),
    defaultValues: {
      name: "",
      system_prompt: "",
      model: "gpt-4o-mini",
      collection_ids: [],
    },
  })

  const selectedModel = watch("model")

  useEffect(() => {
    if (assistant) {
      reset({
        name: assistant.name,
        system_prompt: assistant.system_prompt || "",
        model: assistant.model,
        collection_ids: assistant.collection_ids,
      })
    } else {
      reset({
        name: "",
        system_prompt: "",
        model: "gpt-4o-mini",
        collection_ids: [],
      })
    }
  }, [assistant, reset])

  const createMutation = useMutation({
    mutationFn: assistantsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistants"] })
      toast({
        title: "Assistant créé",
        description: "Votre assistant a été créé avec succès.",
      })
      onOpenChange(false)
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer l'assistant.",
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssistantFormData }) =>
      assistantsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistants"] })
      toast({
        title: "Assistant mis à jour",
        description: "Les modifications ont été enregistrées.",
      })
      onOpenChange(false)
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour l'assistant.",
      })
    },
  })

  const onSubmit = (data: AssistantFormData) => {
    if (isEditing && assistant) {
      updateMutation.mutate({ id: assistant.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier l'assistant" : "Créer un assistant"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifiez les paramètres de votre assistant."
              : "Configurez votre nouvel assistant IA."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'assistant</Label>
              <Input
                id="name"
                placeholder="Mon assistant"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modèle</Label>
              <Select
                value={selectedModel}
                onValueChange={(value) => setValue("model", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un modèle" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_prompt">Prompt système</Label>
              <Textarea
                id="system_prompt"
                placeholder="Tu es un assistant utile et amical..."
                rows={5}
                {...register("system_prompt")}
              />
              <p className="text-xs text-muted-foreground">
                Le prompt système définit le comportement et la personnalité de
                votre assistant.
              </p>
            </div>

            {collections && collections.length > 0 && (
              <div className="space-y-2">
                <Label>Collections de documents</Label>
                <div className="grid gap-2">
                  {collections.map((collection) => (
                    <label
                      key={collection.id}
                      className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        value={collection.id}
                        {...register("collection_ids")}
                        className="rounded border-gray-300"
                      />
                      <div>
                        <p className="text-sm font-medium">{collection.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {collection.documents_count} document(s)
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
