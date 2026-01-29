import { useUser, useClerk } from "@clerk/clerk-react"
import { User, Settings, AlertTriangle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function ProfilePage() {
  const { user } = useUser()
  const { openUserProfile } = useClerk()

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mon profil</h1>
        <p className="mt-1 text-muted-foreground">
          Gérez vos informations personnelles
        </p>
      </div>

      {/* Profile info */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Informations personnelles</CardTitle>
          </div>
          <CardDescription>
            Vos informations de compte Clerk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.imageUrl} alt={user?.fullName || ""} />
              <AvatarFallback className="text-lg">
                {getInitials(user?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-lg font-medium">{user?.fullName}</p>
              <p className="text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <Button variant="outline" onClick={() => openUserProfile()}>
              <Settings className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account settings */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Paramètres du compte</CardTitle>
          </div>
          <CardDescription>
            Gérez vos paramètres de connexion et de sécurité
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mot de passe et sécurité</p>
              <p className="text-sm text-muted-foreground">
                Modifiez votre mot de passe, activez la 2FA
              </p>
            </div>
            <Button variant="outline" onClick={() => openUserProfile()}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Gérer
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Méthodes de connexion</p>
              <p className="text-sm text-muted-foreground">
                Email, Google, et autres providers
              </p>
            </div>
            <Button variant="outline" onClick={() => openUserProfile()}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Gérer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Zone de danger</CardTitle>
          </div>
          <CardDescription>
            Actions irréversibles sur votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Supprimer mon compte</p>
              <p className="text-sm text-muted-foreground">
                Cette action est irréversible. Toutes vos données seront
                supprimées.
              </p>
            </div>
            <Button variant="destructive" disabled>
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
