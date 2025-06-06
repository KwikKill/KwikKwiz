"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"

interface Quiz {
  id: string
  name: string
  description: string | null
}

function CreateSessionContent() {
  const { data: session } = useSession()
  const [selectedQuizId, setSelectedQuizId] = useState<string>("")
  const [sessionName, setSessionName] = useState<string>("")
  const [sessionDescription, setSessionDescription] = useState<string>("")
  const [sessionDate, setSessionDate] = useState<string>("")
  const [timerDuration, setTimerDuration] = useState<string>("")
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const preselectedQuizId = searchParams.get("quizId")

  useEffect(() => {
    if (session?.user?.id) {
      // Fetch user's quizzes
      fetch("/api/quizzes")
        .then((res) => res.json())
        .then((data) => {
          setQuizzes(data)

          // Preselect quiz if ID is provided in URL
          if (preselectedQuizId && data.some((quiz: Quiz) => quiz.id === preselectedQuizId)) {
            setSelectedQuizId(preselectedQuizId)
            // Auto-fill session name with quiz name
            const selectedQuiz = data.find((quiz: Quiz) => quiz.id === preselectedQuizId)
            if (selectedQuiz) {
              setSessionName(selectedQuiz.name)
            }
          }

          setIsLoading(false)
        })
        .catch((error) => {
          console.error("Failed to fetch quizzes:", error)
          setIsLoading(false)
        })
    }
  }, [session, preselectedQuizId])

  // Auto-fill session name when quiz is selected
  useEffect(() => {
    if (selectedQuizId && quizzes.length > 0) {
      const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId)
      if (selectedQuiz && !sessionName) {
        setSessionName(selectedQuiz.name)
      }
    }
  }, [selectedQuizId, quizzes, sessionName])

  const handleCreateSession = async () => {
    if (!selectedQuizId) {
      toast({
        title: "Sélection de kwiz requise",
        description: "Veuillez sélectionner un kwiz pour la session",
        variant: "destructive",
      })
      return
    }

    if (!sessionName.trim()) {
      toast({
        title: "Nom de session requis",
        description: "Veuillez entrer un nom pour la session",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const sessionData: any = {
        quizId: selectedQuizId,
        name: sessionName.trim(),
        description: sessionDescription.trim() || null,
        sessionDate: sessionDate ? new Date(sessionDate).toISOString() : null,
      }

      // Add timer duration if specified
      if (timerDuration && Number.parseInt(timerDuration) > 0) {
        sessionData.timerDuration = Number.parseInt(timerDuration)
      }

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Échec de la création de la session")
      }

      toast({
        title: "Session créée avec succès",
        description: `Code de session : ${data.code}`,
      })

      // Redirect to the session host page
      router.push(`/admin/sessions/${data.id}/host`)
    } catch (error) {
      toast({
        title: "Erreur lors de la création de la session",
        description: error instanceof Error ? error.message : "Échec de la création de la session",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if user is admin
  if (session && !session.user?.isAdmin) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>Vous n'avez pas la permission de créer des sessions de kwiz.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-10 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Créer une nouvelle session de kwiz</CardTitle>
          <CardDescription>Configurez les paramètres de votre session de kwiz</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="quiz-select">Sélectionner un kwiz *</Label>
              {isLoading ? (
                <div className="h-10 bg-muted animate-pulse rounded-md"></div>
              ) : (
                <Select value={selectedQuizId} onValueChange={setSelectedQuizId} disabled={isSubmitting}>
                  <SelectTrigger id="quiz-select">
                    <SelectValue placeholder="Sélectionnez un kwiz" />
                  </SelectTrigger>
                  <SelectContent>
                    {quizzes.length > 0 ? (
                      quizzes.map((quiz) => (
                        <SelectItem key={quiz.id} value={quiz.id}>
                          {quiz.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-quizzes" disabled>
                        Aucun quiz disponible
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="session-name">Nom de la session *</Label>
              <Input
                id="session-name"
                placeholder="Entrez le nom de la session"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="session-description">Description de la session</Label>
              <Textarea
                id="session-description"
                placeholder="Entrez la description de la session (optionnel)"
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="session-date">Date de la session</Label>
              <Input
                id="session-date"
                type="datetime-local"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="timer-duration">Durée du minuteur (secondes)</Label>
              <Input
                id="timer-duration"
                type="number"
                placeholder="e.g., 30 (optional)"
                value={timerDuration}
                onChange={(e) => setTimerDuration(e.target.value)}
                disabled={isSubmitting}
                min="1"
                max="3600"
              />
              <p className="text-sm text-muted-foreground">
                Optionnel : Définir un minuteur de compte à rebours pour chaque question (1-3600 secondes)
              </p>
            </div>

            {selectedQuizId && quizzes.length > 0 && (
              <div className="bg-muted p-4 rounded-md">
                <h3 className="text-sm font-medium mb-1">kwiz sélectionné</h3>
                <p className="text-sm text-muted-foreground">
                  {quizzes.find((q) => q.id === selectedQuizId)?.description || "No description provided"}
                </p>
              </div>
            )}

            {quizzes.length === 0 && !isLoading && (
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground text-center">Vous n'avez pas encore créé de kwiz.</p>
                <Button variant="link" className="w-full mt-2" onClick={() => router.push("/admin/quizzes/new")}>
                  Créez d'abord un kwiz
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleCreateSession}
            className="w-full"
            disabled={isSubmitting || !selectedQuizId || !sessionName.trim()}
          >
            {isSubmitting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                Création en cours...
              </>
            ) : (
              "Créer la session"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function CreateSessionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateSessionContent />
    </Suspense>
  )
}
