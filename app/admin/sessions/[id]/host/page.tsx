"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQuizSession } from "@/lib/hooks/use-quiz-session"
import { useToast } from "@/hooks/use-toast"
import { Users, Clock, CheckCircle, XCircle, AlertCircle, Trophy, Share, Timer } from "lucide-react"
import { EmojiSelector } from "@/components/emoji-selector"
import { EmojiRain } from "@/components/emoji-rain"

interface Question {
  id: string
  text: string
  imageUrl: string | null
  type: "MULTIPLE_CHOICE" | "FREE_ANSWER"
  options: string[]
  order: number
}

interface QuizSessionDetails {
  id: string
  code: string
  name: string
  description: string | null
  sessionDate: string | null
  quizId: string
  hostId: string
  status: "waiting" | "active" | "correction" | "completed"
  timerDuration: number | null
  quiz: {
    id: string
    name: string
    description: string | null
    questions: Question[]
  }
}

export default function HostSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState<string>("")
  useEffect(() => {
    params.then((resolvedParams) => {
      setSessionId(resolvedParams.id)
    })
  }, [params])

  const router = useRouter()
  const { data: authSession } = useSession()
  const { toast } = useToast()

  const [quizSession, setQuizSession] = useState<QuizSessionDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState("questions")
  const [newTimerDuration, setNewTimerDuration] = useState<string>("")

  const {
    status,
    currentQuestion,
    participants,
    questions,
    answers,
    leaderboard,
    isConnected,
    correctionQuestion,
    correctionAnswers,
    currentShownAnswer,
    timerDuration,
    timeRemaining,
    isTimerActive,
    selectQuestion,
    startCorrection,
    endSession,
    selectCorrectionQuestion,
    showCorrectionAnswer,
    gradeCorrectionAnswer,
    updateTimerDuration,
    sendEmojiReaction,
  } = useQuizSession(sessionId, true)

  const handleEmojiSelect = (emoji: string) => {
    sendEmojiReaction(emoji)
  }

  useEffect(() => {
    if (authSession?.user?.id && sessionId) {
      // Fetch session details
      fetch(`/api/sessions/${sessionId}`)
        .then((res) => {
          if (!res.ok) {
            console.log(res)
            throw new Error("Failed to fetch session")
          }
          return res.json()
        })
        .then((data) => {
          setQuizSession(data)
          setNewTimerDuration(data.timerDuration?.toString() || "")

          // Check if user is the host
          if (data.hostId !== authSession.user?.userId) {
            toast({
              title: "Accès refusé",
              description: "Vous n'êtes pas l'hôte de cette session",
              variant: "destructive",
            })
            router.push(`/session/${sessionId}`)
          }

          setIsLoading(false)
        })
        .catch((error) => {
          console.error("Error fetching session:", error)
          toast({
            title: "Erreur",
            description: "Échec du chargement des détails de la session",
            variant: "destructive",
          })
          setIsLoading(false)
        })
    }
  }, [sessionId, authSession, router, toast])

  const handleCopySessionCode = () => {
    if (!quizSession) return

    navigator.clipboard.writeText(quizSession.code)
    toast({
      title: "Code de session copié",
      description: "Partagez ce code avec vos participants",
    })
  }

  const handleSelectQuestion = (questionId: string) => {
    selectQuestion(questionId)
    setCurrentTab("participants")
  }

  const handleUpdateTimer = () => {
    const duration = Number.parseInt(newTimerDuration)
    if (isNaN(duration) || duration < 0) {
      updateTimerDuration(null)
      toast({
        title: "Minuteur désactivé",
        description: "Les questions n'auront pas de limite de temps",
      })
    } else {
      updateTimerDuration(duration)
      toast({
        title: "Minuteur mis à jour",
        description: `Les questions auront ${duration} secondes`,
      })
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Chargement de la session...</p>
        </div>
      </div>
    )
  }

  if (!quizSession) {
    return (
      <div className="p-10">
        <Card>
          <CardHeader>
            <CardTitle>Session introuvable</CardTitle>
            <CardDescription>Cette session de kwiz a peut-être pris fin ou n'existe pas.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/dashboard")}>Retour au tableau de bord</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">{quizSession.name}</h1>
              <p className="text-muted-foreground">Interface hôte</p>
              {quizSession.description && (
                <p className="text-sm text-muted-foreground mt-1">{quizSession.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "outline" : "destructive"}>{isConnected ? "Connecté" : "Déconnecté"}</Badge>
              <Badge variant="secondary">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
              {isTimerActive && timeRemaining !== null && (
                <Badge variant={timeRemaining <= 10 ? "destructive" : "default"} className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {formatTime(timeRemaining)}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleCopySessionCode}>
                <Share className="h-4 w-4 mr-1" />
                {quizSession.code}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="questions" value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="responses">Réponses</TabsTrigger>
              <TabsTrigger value="settings">Paramètres</TabsTrigger>
            </TabsList>

            {/* Status Summary */}
            {(status === "active" || status === "correction") && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Card className="p-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{quizSession.quiz.questions.length}</div>
                    <div className="text-xs text-muted-foreground">Total des questions</div>
                  </div>
                </Card>

                {status === "active" && (
                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">
                        {new Set(answers.map((a) => a.questionId)).size}
                      </div>
                      <div className="text-xs text-muted-foreground">Questions posées</div>
                    </div>
                  </Card>
                )}

                {status === "active" && timerDuration && (
                  <Card className="p-3">
                    <div className="text-center">
                      <div
                        className={`text-2xl font-bold ${timeRemaining !== null && timeRemaining <= 10 ? "text-red-500" : "text-blue-500"}`}
                      >
                        {timeRemaining !== null ? formatTime(timeRemaining) : formatTime(timerDuration)}
                      </div>
                      <div className="text-xs text-muted-foreground">Temps restant</div>
                    </div>
                  </Card>
                )}

                {status === "correction" && (
                  <>
                    <Card className="p-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-500">
                          {
                            Array.from(new Set(answers.map((a) => a.questionId))).filter((questionId) => {
                              const questionAnswers = answers.filter((a) => a.questionId === questionId)
                              return questionAnswers.some((a) => a.isCorrect === undefined || a.isCorrect === null)
                            }).length
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">Nécessite une correction</div>
                      </div>
                    </Card>

                    <Card className="p-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-500">
                          {
                            Array.from(new Set(answers.map((a) => a.questionId))).filter((questionId) => {
                              const questionAnswers = answers.filter((a) => a.questionId === questionId)
                              return (
                                questionAnswers.length > 0 &&
                                questionAnswers.every((a) => a.isCorrect !== undefined && a.isCorrect !== null)
                              )
                            }).length
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">Corrigé</div>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}

            <TabsContent value="settings" className="border rounded-md p-4">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium mb-4">Paramètres de la session</h2>

                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="timer-duration">Durée du minuteur (secondes)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="timer-duration"
                          type="number"
                          placeholder="e.g., 30 (0 to disable)"
                          value={newTimerDuration}
                          onChange={(e) => setNewTimerDuration(e.target.value)}
                          min="0"
                          max="3600"
                          className="flex-1"
                        />
                        <Button onClick={handleUpdateTimer} variant="outline">
                          Mettre à jour
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Actuel : {timerDuration ? `${timerDuration} secondes` : "Pas de minuteur"}
                      </p>
                    </div>

                    <div className="bg-muted p-4 rounded-md">
                      <h3 className="font-medium mb-2">Informations de la session</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nom de la session :</span>
                          <span>{quizSession.name}</span>
                        </div>
                        {quizSession.description && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Description :</span>
                            <span className="text-right max-w-xs">{quizSession.description}</span>
                          </div>
                        )}
                        {quizSession.sessionDate && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Planifié :</span>
                            <span>{new Date(quizSession.sessionDate).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">kwiz :</span>
                          <span>{quizSession.quiz.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Questions :</span>
                          <span>{quizSession.quiz.questions.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="questions" className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">Questions du kwiz</h2>
                <Badge>{quizSession.quiz.questions.length} Questions</Badge>
              </div>

              <ScrollArea className="h-[60vh]">
                <div className="space-y-4">
                  {quizSession.quiz.questions.map((question) => {
                    // Check if question was asked (has answers in current session)
                    const wasAsked = answers.some((a) => a.questionId === question.id)

                    // Check if question was corrected (all answers for this question are graded)
                    const questionAnswers = answers.filter((a) => a.questionId === question.id)
                    const wasCorreted =
                      questionAnswers.length > 0 &&
                      questionAnswers.every((a) => a.isCorrect !== undefined && a.isCorrect !== null)

                    return (
                      <Card key={question.id} className="overflow-hidden">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {question.type === "MULTIPLE_CHOICE" ? "Multiple Choice" : "Free Answer"}
                              </Badge>
                              <Badge variant="secondary">Q{question.order + 1}</Badge>

                              {/* Status indicators */}
                              {status === "active" && wasAsked && (
                                <Badge variant="default" className="bg-blue-500">
                                  Posée
                                </Badge>
                              )}
                              {status === "correction" && wasAsked && (
                                <Badge variant="default" className={wasCorreted ? "bg-green-500" : "bg-yellow-500"}>
                                  {wasCorreted ? "Corrigé" : "Nécessite une correction"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <CardTitle className="text-base mt-2">{question.text}</CardTitle>
                        </CardHeader>

                        {question.imageUrl && (
                          <div className="px-4">
                            <div className="w-full h-40 bg-muted rounded-md flex items-center justify-center">
                              <img
                                src={question.imageUrl || "/placeholder.svg"}
                                alt="Question"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                          </div>
                        )}

                        {question.type === "MULTIPLE_CHOICE" && (
                          <CardContent className="p-4 pt-2">
                            <div className="space-y-2 mt-2">
                              {question.options.map((option, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 rounded-md border">
                                  <span className="text-xs font-medium bg-muted w-6 h-6 rounded-full flex items-center justify-center">
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                  <span className="text-sm">{option}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        )}

                        <CardFooter className="p-4 pt-0">
                          {status !== "completed" && (
                            <Button
                              onClick={() => handleSelectQuestion(question.id)}
                              className="w-full"
                              disabled={currentQuestion?.id === question.id}
                            >
                              {currentQuestion?.id === question.id ? "Question actuelle" : "Sélectionner la question"}
                            </Button>
                          )}
                        </CardFooter>
                      </Card>
                    )
                  })}

                  {quizSession.quiz.questions.length === 0 && (
                    <div className="text-center py-10">
                      <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">Aucune question dans ce kwiz</p>
                      <Button
                        variant="link"
                        onClick={() => router.push(`/admin/quizzes/${quizSession.quizId}`)}
                        className="mt-2"
                      >
                        Ajouter des questions
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="participants" className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">Participants</h2>
                <Badge>
                  {participants.length} {participants.length === 1 ? "Participant" : "Participants"}
                </Badge>
              </div>

              <ScrollArea className="h-[60vh]">
                {participants.length > 0 ? (
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex items-center gap-2">
                          {participant.image ? (
                            <img
                              src={participant.image || "/placeholder.svg"}
                              alt={participant.name || "Unknown"}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                              {participant.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                          )}
                          <span>{participant.name}</span>
                        </div>

                        {currentQuestion && status === "active" ? (
                          <div className="flex items-center gap-2">
                            {participant.id === quizSession.hostId ? (
                              <Badge variant="destructive">Hôte</Badge>
                            ) : (
                              (() => {
                                const participantAnswer = answers.find(
                                  (a) => a.userId === participant.id && a.questionId === currentQuestion.id,
                                )

                                if (participantAnswer) {
                                  return (
                                    <Badge variant="outline">
                                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                                      Répondu
                                    </Badge>
                                  )
                                } else if (timeRemaining === 0 || !isTimerActive) {
                                  return (
                                    <Badge variant="destructive">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Temps écoulé
                                    </Badge>
                                  )
                                } else {
                                  return (
                                    <Badge variant="outline">
                                      <Clock className="h-3 w-3 mr-1 text-yellow-500" />
                                      En attente
                                    </Badge>
                                  )
                                }
                              })()
                            )}
                          </div>
                        ) : (
                          participant.id === quizSession.hostId && <Badge variant="destructive">Hôte</Badge>
                        )}
                      </div>
                    ))}
                    {currentQuestion && status === "active" && (
                      <div className="p-4 bg-muted rounded-md">
                        {(() => {
                          const answeredCount = answers.filter((a) => a.questionId === currentQuestion.id).length
                          const totalParticipants = participants.length - 1 // Minus host
                          const timeoutCount =
                            timeRemaining === 0 || !isTimerActive ? totalParticipants - answeredCount : 0
                          const completedCount = answeredCount + timeoutCount

                          return (
                            <>
                              <p className="text-center text-muted-foreground">
                                {answeredCount} ont répondu, {timeoutCount > 0 ? `${timeoutCount} temps écoulé, ` : ""}
                                {completedCount} sur {totalParticipants} terminé
                              </p>
                              <Progress
                                className="mt-2 border-primary"
                                value={(completedCount / totalParticipants) * 100}
                              />
                              {timeRemaining !== null && (
                                <div className="mt-2 text-center">
                                  <span
                                    className={`text-sm font-medium ${timeRemaining <= 10 ? "text-red-500" : "text-muted-foreground"}`}
                                  >
                                    {isTimerActive ? `${formatTime(timeRemaining)} restant` : "Temps expiré"}
                                  </span>
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">Aucun participant n'a encore rejoint</p>
                    <div className="mt-4 p-4 bg-muted rounded-md max-w-md mx-auto">
                      <p className="text-sm font-medium">Partagez ce code avec les participants :</p>
                      <p className="mt-1 text-xl font-mono tracking-widest text-center">{quizSession.code}</p>
                      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={handleCopySessionCode}>
                        <Share className="h-4 w-4 mr-1" />
                        Copier le code
                      </Button>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="responses" className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-4 w-full">
                {status === "completed" ? (
                  <h2 className="text-lg font-medium">Résultats finaux</h2>
                ) : (
                  <h2 className="text-lg font-medium">Réponses</h2>
                )}
                <div className="flex gap-2">
                  {status === "active" && (
                    <Button onClick={startCorrection} size="sm">
                      Commencer la correction
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[60vh]">
                {status === "completed" ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="text-lg font-medium">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">Podium</CardTitle>
                        </div>
                      </CardHeader>

                      <CardContent>
                        <table className="w-full">
                          <thead className="bg-background">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium">Rang</th>
                              <th className="px-4 py-2 text-left text-sm font-medium">Joueur</th>
                              <th className="px-4 py-2 text-right text-sm font-medium">Score</th>
                            </tr>
                          </thead>
                          <tbody className="bg-muted">
                            {leaderboard.map((entry, index) => (
                              <tr key={entry.userId} className="border-t">
                                <td className="px-4 py-3 text-sm">{index + 1}</td>
                                <td className="px-4 py-3 text-sm">{entry.name}</td>
                                <td className="px-4 py-3 text-sm text-right font-medium">{entry.score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>

                    <div>
                      {questions.length > 0 ? (
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-center">Responses</h3>

                          {questions.map((question) => (
                            <Card key={question.id} className="overflow-hidden">
                              <CardHeader className="p-4 pb-2">
                                <div className="flex justify-between items-start">
                                  <Badge variant="outline">
                                    {question.type === "MULTIPLE_CHOICE" ? "Multiple Choice" : "Free Answer"}
                                  </Badge>
                                </div>
                                <CardTitle className="text-base mt-2">{question.text}</CardTitle>
                              </CardHeader>

                              {question.imageUrl && (
                                <div className="px-4">
                                  <div className="w-full h-40 bg-muted rounded-md flex items-center justify-center">
                                    <img
                                      src={question.imageUrl || "/placeholder.svg"}
                                      alt="Question"
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  </div>
                                </div>
                              )}

                              <CardContent className="p-4 pt-2">
                                <div className="space-y-2 mt-2">
                                  {Object.entries(question.response ?? {}).map(([userId, response]) => {
                                    const participant = participants.find((p) => p.id === userId)
                                    return (
                                      <div
                                        key={userId}
                                        className="flex items-start gap-2 p-2 rounded-md border items-center"
                                      >
                                        {participant?.image ? (
                                          <img
                                            src={participant.image || "/placeholder.svg"}
                                            alt={participant.name || "Unknown"}
                                            className="w-8 h-8 rounded-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                            {participant?.name?.charAt(0).toUpperCase() || "?"}
                                          </div>
                                        )}
                                        <div className="flex-1 flex flex-row justify-between items-center">
                                          <p className="text-sm">{response.answer}</p>
                                          {response.isCorrect !== undefined && (
                                            <Badge
                                              variant={response.isCorrect ? "default" : "destructive"}
                                              className={response.isCorrect ? "bg-green-500" : "bg-red-500"}
                                            >
                                              {response.isCorrect ? `Correct (1 pts)` : "Incorrect (0 pts)"}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="mt-2 text-muted-foreground">No questions answered in this session</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : status === "correction" ? (
                  <div className="space-y-4">
                    {!correctionQuestion ? (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-md">
                          <h3 className="font-medium">Mode correction - Sélectionnez une question</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Choisissez une question à réviser et notez les réponses
                          </p>
                        </div>

                        <div className="space-y-2">
                          {quizSession?.quiz?.questions?.map((question, index) => {
                            const questionAnswers = answers.filter((a) => a.questionId === question.id)
                            const wasCorreted =
                              questionAnswers.length > 0 &&
                              questionAnswers.every((a) => a.isCorrect !== undefined && a.isCorrect !== null)

                            return (
                              <Card
                                key={question.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => selectCorrectionQuestion(question.id)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">Q{index + 1}</Badge>
                                        <p className="text-sm font-medium">{question.text}</p>
                                        <Badge
                                          variant="default"
                                          className={wasCorreted ? "bg-green-500" : "bg-yellow-500"}
                                        >
                                          {wasCorreted ? "Corrigé" : "Nécessite une correction"}
                                        </Badge>
                                      </div>
                                      {question.type === "MULTIPLE_CHOICE" && (
                                        <p className="text-xs text-muted-foreground mt-1">Multiple Choice</p>
                                      )}
                                      {question.type === "FREE_ANSWER" && (
                                        <p className="text-xs text-muted-foreground mt-1">Free Answer</p>
                                      )}
                                    </div>
                                    <Button variant="outline" size="sm">
                                      Réviser les réponses
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-md">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-medium">Révision : {correctionQuestion.text}</h3>
                              <p className="text-sm text-muted-foreground">
                                {correctionAnswers.length} réponses à réviser
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Reset correction question selection
                                selectCorrectionQuestion(null)
                              }}
                            >
                              Retour aux questions
                            </Button>
                          </div>
                        </div>

                        {currentShownAnswer ? (
                          <div className="gap-4 flex flex-col">
                            {/* Expected answer */}
                            <Card className="border-primary/50">
                              <CardHeader>
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                                    <h4 className="font-medium">Réponse attendue</h4>
                                  </div>
                                  <Badge variant="outline">
                                    {correctionQuestion.type === "MULTIPLE_CHOICE" ? "Multiple Choice" : "Free Answer"}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <p className="text-lg font-medium bg-muted p-4 rounded-md">
                                  {correctionQuestion.correctAnswer}
                                </p>
                              </CardContent>
                            </Card>

                            {/* Display current answer being reviewed */}
                            <Card className="border-primary/50">
                              <CardHeader>
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    {currentShownAnswer.userImage ? (
                                      <img
                                        src={currentShownAnswer.userImage || "/placeholder.svg"}
                                        alt={currentShownAnswer.userName}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                        {currentShownAnswer.userName?.charAt(0).toUpperCase() || "?"}
                                      </div>
                                    )}
                                    <h4 className="font-medium">{currentShownAnswer.userName} - Réponse</h4>
                                  </div>
                                  {currentShownAnswer.isCorrect !== null ? (
                                    <Badge
                                      variant={currentShownAnswer.isCorrect ? "default" : "destructive"}
                                      className={currentShownAnswer.isCorrect ? "bg-green-500" : "bg-red-500"}
                                    >
                                      {currentShownAnswer.isCorrect
                                        ? `Correct (${currentShownAnswer.points} pts)`
                                        : "Incorrect (0 pts)"}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">Non révisé</Badge>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-4">
                                  <div className="p-4 bg-muted rounded-md">
                                    <p className="font-medium text-lg">{currentShownAnswer.answer}</p>
                                  </div>

                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      className={`flex-1 border-red-200 hover:bg-red-800 ${
                                        currentShownAnswer.isCorrect === false ? "bg-red-500" : ""
                                      }`}
                                      onClick={() => gradeCorrectionAnswer(currentShownAnswer, false, 0)}
                                    >
                                      <XCircle
                                        className={`h-4 w-4 mr-1 ${currentShownAnswer.isCorrect === false ? "" : "text-red-500"}`}
                                      />
                                      Incorrect (0 pts)
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className={`flex-1 border-green-200 hover:bg-green-800 ${
                                        currentShownAnswer.isCorrect === true ? "bg-green-500" : ""
                                      }`}
                                      onClick={() => gradeCorrectionAnswer(currentShownAnswer, true, 1)}
                                    >
                                      <CheckCircle
                                        className={`h-4 w-4 mr-1 ${currentShownAnswer.isCorrect === true ? "" : "text-green-500"}`}
                                      />
                                      Correct (1 pt)
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            {/* Previous and next answer buttons in correctionAnswers*/}
                            <div className="flex justify-center">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={correctionAnswers[0].id === currentShownAnswer.id}
                                  onClick={() => {
                                    const currentIndex = correctionAnswers.findIndex(
                                      (a) => a.id === currentShownAnswer.id,
                                    )
                                    if (currentIndex > 0) {
                                      showCorrectionAnswer(correctionAnswers[currentIndex - 1].id)
                                    }
                                  }}
                                >
                                  Réponse précédente
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    correctionAnswers[correctionAnswers.length - 1].id === currentShownAnswer.id
                                  }
                                  onClick={() => {
                                    const currentIndex = correctionAnswers.findIndex(
                                      (a) => a.id === currentShownAnswer.id,
                                    )
                                    if (currentIndex < correctionAnswers.length - 1) {
                                      showCorrectionAnswer(correctionAnswers[currentIndex + 1].id)
                                    }
                                  }}
                                >
                                  Réponse suivante
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <h4 className="font-medium">Sélectionnez une réponse à afficher et noter :</h4>
                            {correctionAnswers.map((answer) => (
                              <Card
                                key={answer.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => showCorrectionAnswer(answer.id)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      {answer.userImage && (
                                        <img
                                          src={answer.userImage || "/placeholder.svg"}
                                          alt={answer.userName}
                                          className="w-6 h-6 rounded-full"
                                        />
                                      )}
                                      <span className="font-medium">{answer.userName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {answer.isCorrect !== null ? (
                                        <Badge variant={answer.isCorrect ? "default" : "destructive"}>
                                          {answer.isCorrect ? `✓ ${answer.points} pts` : "✗ 0 pts"}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline">Non révisé</Badge>
                                      )}
                                      <Button variant="outline" size="sm">
                                        Afficher et noter
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}

                            {correctionAnswers.length === 0 && (
                              <div className="text-center py-8">
                                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                                <p className="mt-2 text-muted-foreground">Aucune réponse trouvée pour cette question</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : currentQuestion ? (
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-md">
                      <p className="mt-1">{currentQuestion.text}</p>
                      {timeRemaining !== null && (
                        <div className="mt-2 flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          <span className={`text-sm font-medium ${timeRemaining <= 10 ? "text-red-500" : ""}`}>
                            {isTimerActive ? `${formatTime(timeRemaining)} restant` : "Temps expiré"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Show answered participants */}
                      {answers
                        .filter((a) => a.questionId === currentQuestion.id)
                        .map((answer) => {
                          const participant = participants.find((p) => p.id === answer.userId)
                          return (
                            <Card key={`${answer.userId}-${answer.questionId}`} className="border">
                              <CardHeader className="py-3 px-4">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    {participant?.image ? (
                                      <img
                                        src={participant.image || "/placeholder.svg"}
                                        alt={participant.name || "Unknown"}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                        {participant?.name?.charAt(0).toUpperCase() || "?"}
                                      </div>
                                    )}
                                    <h4 className="text-sm font-medium">{participant?.name || "Unknown User"}</h4>
                                  </div>
                                  <Badge variant="outline">
                                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                                    Soumis
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2 px-4">
                                <p className="text-sm">{answer.answer}</p>
                              </CardContent>
                            </Card>
                          )
                        })}

                      {/* Show timeout participants when time is up */}
                      {(timeRemaining === 0 || !isTimerActive) &&
                        participants
                          .filter(
                            (p) =>
                              p.id !== quizSession.hostId &&
                              !answers.some((a) => a.userId === p.id && a.questionId === currentQuestion.id),
                          )
                          .map((participant) => (
                            <Card key={`timeout-${participant.id}`} className="border border-red-200">
                              <CardHeader className="py-3 px-4">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    {participant.image ? (
                                      <img
                                        src={participant.image || "/placeholder.svg"}
                                        alt={participant.name || "Unknown"}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                        {participant.name?.charAt(0).toUpperCase() || "?"}
                                      </div>
                                    )}
                                    <h4 className="text-sm font-medium">{participant.name}</h4>
                                  </div>
                                  <Badge variant="destructive">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Temps écoulé
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2 px-4">
                                <p className="text-sm text-muted-foreground italic">Aucune réponse soumise</p>
                              </CardContent>
                            </Card>
                          ))}

                      {answers.filter((a) => a.questionId === currentQuestion.id).length === 0 &&
                        (timeRemaining === null || timeRemaining > 0) && (
                          <div className="text-center py-8">
                            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                            <p className="mt-2 text-muted-foreground">Aucune réponse soumise pour le moment</p>
                          </div>
                        )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">Aucune question sélectionnée</p>
                    <Button variant="link" onClick={() => setCurrentTab("questions")} className="mt-2">
                      Sélectionnez une question
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Infos de la session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code de session</label>
                  <div className="flex">
                    <div className="bg-muted px-3 py-2 rounded-l-md border-y border-l font-mono tracking-wider flex-1 text-center">
                      {quizSession.code}
                    </div>
                    <Button variant="outline" className="rounded-l-none" onClick={handleCopySessionCode}>
                      <Share className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Statut</label>
                  <div className="bg-muted p-2 rounded-md flex justify-between items-center">
                    <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    <Badge variant={isConnected ? "outline" : "destructive"} className="ml-2">
                      {isConnected ? "Connecté" : "Déconnecté"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Participants</label>
                  <div className="bg-muted p-2 rounded-md">
                    <div className="flex items-center justify-between">
                      <span>{participants.length}</span>
                      <Button variant="ghost" size="sm" onClick={() => setCurrentTab("participants")}>
                        Voir
                      </Button>
                    </div>
                  </div>
                </div>

                {currentQuestion && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Question actuelle</label>
                    <div className="bg-muted p-2 rounded-md">
                      <p className="line-clamp-2 text-sm">{currentQuestion.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline">
                          {currentQuestion.type === "MULTIPLE_CHOICE" ? "Multiple Choice" : "Free Answer"}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentTab("responses")}>
                          Voir les réponses
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              {status === "active" && (
                <Button onClick={startCorrection} className="w-full">
                  Commencer la phase de correction
                </Button>
              )}

              {status === "correction" && (
                <Button onClick={endSession} className="w-full" variant="destructive">
                  Terminer la session et afficher les résultats
                </Button>
              )}

              <Button variant="outline" className="w-full" onClick={() => router.push(`/session/${sessionId}`)}>
                Voir la vue participant
              </Button>
            </CardFooter>
          </Card>

          {status === "completed" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Résultats finaux
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry, index) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center justify-between p-2 rounded-md ${index === 0 ? "bg-primary/10 border border-primary/30" : "border"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                        >
                          {index + 1}
                        </div>
                        <span className={index === 0 ? "font-medium" : ""}>{entry.name}</span>
                      </div>
                      <span className="font-mono">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* Floating Emoji Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <EmojiSelector onEmojiSelect={handleEmojiSelect} />
      </div>

      {/* Emoji Rain Container */}
      <EmojiRain />
    </div>
  )
}
