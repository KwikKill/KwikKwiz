"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Clock, Users, Calendar, Timer } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface Quiz {
  id: string
  name: string
  description: string | null
  createdAt: string
  questionsCount: number
}

interface Session {
  id: string
  code: string
  name: string
  quizName: string
  description: string | null
  sessionDate: string | null
  status: string
  startedAt: string | null
  participantsCount: number
  hostId: string
  timerDuration: number | null
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([])
  const [activeSessions, setActiveSessions] = useState<Session[]>([])
  const [participantSessions, setParticipantSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const joinSession = async (code: string) => {
    try {
      const response = await fetch(`/api/sessions/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to join session")
      }

      // Redirect to the session page
      router.push(`/session/${data.sessionId}`)
    } catch (error) {
      toast({
        title: "Erreur lors de la connexion à la session",
        description: error instanceof Error ? error.message : "Échec de la connexion à la session",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      // Fetch recent quizzes
      fetch("/api/quizzes/recent")
        .then((res) => res.json())
        .then((data) => {
          setRecentQuizzes(data)
        })
        .catch((error) => console.error("Failed to fetch recent quizzes:", error))

      // Fetch active sessions
      fetch("/api/sessions/active")
        .then((res) => res.json())
        .then((data) => {
          setActiveSessions(data)
        })
        .catch((error) => console.error("Failed to fetch active sessions:", error))

      // Fetch sessions where the user is a participant
      fetch("/api/sessions/participant")
        .then((res) => res.json())
        .then((data) => {
          setParticipantSessions(data)
        })
        .catch((error) => console.error("Failed to fetch active sessions:", error))
        .finally(() => setIsLoading(false))
    }
  }, [status])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  const formatSessionDate = (dateString: string | null) => {
    if (!dateString) return null
    try {
      return format(new Date(dateString), "PPp")
    } catch {
      return null
    }
  }

  const formatTimerDuration = (seconds: number | null) => {
    if (!seconds) return null
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  return (
    <div className="p-10">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground">Bon retour, {session?.user?.name || "Utilisateur"}!</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions actives</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSessions.length}</div>
              <p className="text-xs text-muted-foreground">Sessions de kwiz en direct que vous pouvez rejoindre</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total des participations</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{participantSessions.length}</div>
              <p className="text-xs text-muted-foreground">Sessions auxquelles vous avez participé</p>
            </CardContent>
          </Card>
          {session?.user?.isAdmin && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vos kwiz</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{recentQuizzes.length}</div>
                  <p className="text-xs text-muted-foreground">kwiz que vous avez créés</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Tabs defaultValue="active-sessions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active-sessions">Sessions actives</TabsTrigger>
            <TabsTrigger value="participant-sessions">Vos sessions de participation</TabsTrigger>
            {session?.user?.isAdmin && <TabsTrigger value="your-quizzes">Vos kwiz</TabsTrigger>}
          </TabsList>
          <TabsContent value="active-sessions" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                <p>Chargement des sessions...</p>
              ) : activeSessions.length > 0 ? (
                activeSessions.map((_session) => (
                  <Card key={_session.id} className="overflow-hidden">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{_session.name}</CardTitle>
                          <CardDescription className="mt-1">kwiz : {_session.quizName}</CardDescription>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {_session.code}
                        </Badge>
                      </div>
                      {_session.description && (
                        <p className="text-sm text-muted-foreground mt-2">{_session.description}</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4" />
                          <span>{_session.participantsCount} participants</span>
                        </div>

                        {_session.sessionDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4" />
                            <span>{formatSessionDate(_session.sessionDate)}</span>
                          </div>
                        )}

                        {_session.timerDuration && (
                          <div className="flex items-center gap-2 text-sm">
                            <Timer className="h-4 w-4" />
                            <span>{formatTimerDuration(_session.timerDuration)} par question</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>
                            {_session.startedAt
                              ? `Commencé ${format(new Date(_session.startedAt), "PPp")}`
                              : "Pas encore commencé"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {_session.hostId === session?.user?.userId ? (
                        <Link href={`/admin/sessions/${_session.id}/host`} className="w-full">
                          <Button className="w-full">Animer la session</Button>
                        </Link>
                      ) : (
                        <Button className="w-full" onClick={() => joinSession(_session.code)}>
                          Rejoindre la session
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-10">
                  <p className="text-muted-foreground">Aucune session active trouvée.</p>
                  <p className="mt-2">
                    <Link href="/quiz/join">
                      <Button variant="outline" className="mt-2">
                        Rejoindre une session avec un code
                      </Button>
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="participant-sessions" className="space-y-4">
            <h2 className="text-xl font-semibold">Vos sessions de participation</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                <p>Chargement des sessions...</p>
              ) : participantSessions.length > 0 ? (
                participantSessions.map((_session) => (
                  <Card key={_session.id} className="overflow-hidden">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{_session.name}</CardTitle>
                          <CardDescription className="mt-1">kwiz : {_session.quizName}</CardDescription>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {_session.code}
                        </Badge>
                      </div>
                      {_session.description && (
                        <p className="text-sm text-muted-foreground mt-2">{_session.description}</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4" />
                          <span>{_session.participantsCount} participants</span>
                        </div>

                        {_session.sessionDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4" />
                            <span>{formatSessionDate(_session.sessionDate)}</span>
                          </div>
                        )}

                        {_session.timerDuration && (
                          <div className="flex items-center gap-2 text-sm">
                            <Timer className="h-4 w-4" />
                            <span>{formatTimerDuration(_session.timerDuration)} par question</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>
                            {_session.startedAt
                              ? `Commencé ${format(new Date(_session.startedAt), "PPp")}`
                              : "Pas encore commencé"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {_session.hostId === session?.user?.userId ? (
                        <Link href={`/admin/sessions/${_session.id}/host`} className="w-full">
                          <Button className="w-full">Afficher le menu hôte</Button>
                        </Link>
                      ) : (
                        <Button className="w-full" onClick={() => joinSession(_session.code)}>
                          {_session.status === "COMPLETED" ? "Afficher les résultats" : "Rejoindre la session"}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-10">
                  <p className="text-muted-foreground">Vous n'avez pas encore participé à des sessions.</p>
                  <Link href="/quiz/join">
                    <Button variant="outline" className="mt-2">
                      Rejoindre une session avec un code
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </TabsContent>
          {session?.user?.isAdmin && (
            <TabsContent value="your-quizzes" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Vos kwiz</h2>
                <Link href="/admin/quizzes/new">
                  <Button>Créer un nouveau kwiz</Button>
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  <p>Chargement des kwiz...</p>
                ) : recentQuizzes.length > 0 ? (
                  recentQuizzes.map((quiz) => (
                    <Card key={quiz.id}>
                      <CardHeader>
                        <CardTitle>{quiz.name}</CardTitle>
                        <CardDescription>{quiz.description || "Aucune description"}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>Créé {format(new Date(quiz.createdAt), "PPp")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm mt-2">
                          <Sparkles className="h-4 w-4" />
                          <span>{quiz.questionsCount} questions</span>
                        </div>
                      </CardContent>
                      <CardFooter className="flex gap-2">
                        <Link href={`/admin/quizzes/${quiz.id}`} className="flex-1">
                          <Button variant="outline" className="w-full">
                            Modifier
                          </Button>
                        </Link>
                        <Link href={`/admin/sessions/new?quizId=${quiz.id}`} className="flex-1">
                          <Button className="w-full">Démarrer une session</Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-10">
                    <p className="text-muted-foreground">Vous n'avez pas encore créé de kwiz.</p>
                    <Link href="/admin/quizzes/new">
                      <Button className="mt-2">Créez votre premier kwiz</Button>
                    </Link>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
