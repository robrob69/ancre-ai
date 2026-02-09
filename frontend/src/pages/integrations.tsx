/**
 * Integrations page - Manage CRM/ERP OAuth connections via Nango.
 *
 * Each "Connect" button initiates an OAuth flow through Nango.
 * The connection is scoped to the current tenant.
 */

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  Plug,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { integrationsApi } from "@/api/integrations"
import type { NangoConnection } from "@/api/integrations"

/** Providers available for connection (extend this list as needed). */
const PROVIDERS = [
  {
    key: "hubspot",
    name: "HubSpot",
    description: "CRM - Contacts, deals, companies",
    color: "bg-orange-500",
  },
  {
    key: "salesforce",
    name: "Salesforce",
    description: "CRM - Full Salesforce data",
    color: "bg-blue-500",
  },
  {
    key: "pipedrive",
    name: "Pipedrive",
    description: "CRM - Deals, contacts, activités",
    color: "bg-green-600",
  },
  {
    key: "gmail",
    name: "Gmail",
    description: "Email - Recherche et envoi d'emails",
    color: "bg-red-500",
  },
  {
    key: "google-drive",
    name: "Google Drive",
    description: "Stockage - Fichiers, dossiers, documents",
    color: "bg-yellow-600",
  },
  {
    key: "outlook",
    name: "Outlook",
    description: "Email - Microsoft Outlook / Office 365",
    color: "bg-blue-600",
  },
  {
    key: "shopify",
    name: "Shopify",
    description: "E-commerce - Commandes, produits, clients",
    color: "bg-green-500",
  },
  {
    key: "stripe",
    name: "Stripe",
    description: "Paiements - Clients, factures, abonnements",
    color: "bg-purple-500",
  },
  {
    key: "notion",
    name: "Notion",
    description: "Productivité - Pages, bases de données",
    color: "bg-gray-800",
  },
  {
    key: "slack",
    name: "Slack",
    description: "Messagerie - Canaux, messages, fichiers",
    color: "bg-purple-600",
  },
  {
    key: "nocrm",
    name: "noCRM.io",
    description: "CRM - Leads, prospection",
    color: "bg-teal-500",
  },
  {
    key: "lemlist",
    name: "Lemlist",
    description: "Outreach - Campagnes, séquences email",
    color: "bg-indigo-500",
  },
  {
    key: "fireflies",
    name: "Fireflies",
    description: "Meetings - Transcriptions, résumés",
    color: "bg-yellow-500",
  },
] as const

function statusBadge(status: string) {
  switch (status) {
    case "connected":
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Connecté
        </Badge>
      )
    case "pending":
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" />
          En attente
        </Badge>
      )
    default:
      return (
        <Badge variant="destructive">
          <AlertCircle className="mr-1 h-3 w-3" />
          Erreur
        </Badge>
      )
  }
}

export function IntegrationsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)

  // Fetch existing connections
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["nango-connections"],
    queryFn: integrationsApi.listConnections,
  })

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: (provider: string) => integrationsApi.connect(provider),
    onSuccess: (data) => {
      // Open Nango OAuth flow in a popup
      if (data.connect_url) {
        const popup = window.open(
          data.connect_url,
          "nango-oauth",
          "width=600,height=700,scrollbars=yes"
        )

        // Poll for popup close, then refresh connections
        if (popup) {
          const interval = setInterval(() => {
            if (popup.closed) {
              clearInterval(interval)
              // Notify backend that callback may have happened
              integrationsApi
                .callback(data.provider, data.connection_id)
                .catch(() => {
                  // Callback may fail if OAuth wasn't completed - that's OK
                })
              queryClient.invalidateQueries({ queryKey: ["nango-connections"] })
              setConnectingProvider(null)
            }
          }, 500)
        }
      }

      toast({
        title: "Connexion initiée",
        description: `Popup OAuth ouverte pour ${data.provider}. Complétez l'autorisation.`,
      })
    },
    onError: (error: Error) => {
      setConnectingProvider(null)
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'initier la connexion",
        variant: "destructive",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: (provider: string) => integrationsApi.deleteConnection(provider),
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: ["nango-connections"] })
      toast({
        title: "Déconnecté",
        description: `Connexion ${provider} supprimée.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la connexion",
        variant: "destructive",
      })
    },
  })

  const getConnectionForProvider = (
    provider: string
  ): NangoConnection | undefined => {
    return connections.find((c) => c.provider === provider)
  }

  const handleConnect = (provider: string) => {
    setConnectingProvider(provider)
    connectMutation.mutate(provider)
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Connecteurs</h1>
        <p className="mt-2 text-muted-foreground">
          Connectez vos outils pour donner à vos assistants l'accès à vos
          données externes en temps réel.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((provider) => {
            const connection = getConnectionForProvider(provider.key)
            const isConnecting = connectingProvider === provider.key

            return (
              <Card key={provider.key} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${provider.color} text-white font-bold text-sm`}
                      >
                        {provider.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {provider.name}
                        </CardTitle>
                        <CardDescription>{provider.description}</CardDescription>
                      </div>
                    </div>
                    {connection && statusBadge(connection.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {connection && connection.status === "connected" ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Déconnecter
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Déconnecter {provider.name} ?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action supprimera la connexion OAuth.
                              Vous devrez vous reconnecter pour accéder aux
                              données de {provider.name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                disconnectMutation.mutate(provider.key)
                              }
                            >
                              Déconnecter
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(provider.key)}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plug className="mr-2 h-4 w-4" />
                        )}
                        Connecter
                      </Button>
                    )}
                    {connection && (
                      <span className="text-xs text-muted-foreground">
                        Depuis le{" "}
                        {new Date(connection.created_at).toLocaleDateString(
                          "fr-FR"
                        )}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Comment ça marche ?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Les intégrations utilisent <strong>Nango</strong> pour gérer les
            connexions OAuth de manière sécurisée.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Cliquez "Connecter" pour ouvrir le popup d'autorisation OAuth
            </li>
            <li>
              Autorisez l'accès dans le popup du fournisseur
            </li>
            <li>
              Les tokens sont gérés par Nango - jamais stockés dans notre base
            </li>
            <li>
              Chaque connexion est isolée par tenant (multi-tenant)
            </li>
          </ul>
          <p className="flex items-center gap-1 pt-2">
            <ExternalLink className="h-3 w-3" />
            <span>
              Pour configurer les providers, consultez la documentation dans{" "}
              <code>docs/integrations/nango.md</code>
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
