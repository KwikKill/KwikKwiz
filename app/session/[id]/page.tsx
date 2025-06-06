"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuizSession } from "@/lib/hooks/use-quiz-session"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Users, Trophy, AlertCircle, Timer, Clock } from "lucide-react"
import Confetti from "react-confetti"
import { EmojiSelector } from "@/components/emoji-selector"
import { EmojiRain } from "@/components/emoji-rain"

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState<string>("")
  const [showConfetti, setShowConfetti] = useState(false)
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    params.then((resolvedParams) => {
      setSessionId(resolvedParams.id)
    })
  }, [params])

  useEffect(() => {
    const updateWindowDimensions = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateWindowDimensions()
    window.addEventListener("resize", updateWindowDimensions)

    return () => window.removeEventListener("resize", updateWindowDimensions)
  }, [])

  const router = useRouter()
  const { data: authSession, status: authStatus } = useSession()
  const [isHost, setIsHost] = useState(false)
  const [quizDetails, setQuizDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const {
    status,
    currentQuestion,
    participants,
    answers,
    questions,
    hasSubmitted,
    leaderboard,
    isConnected,
    correctionQuestion,
    correctionAnswers,
    currentShownAnswer,
    timeRemaining,
    isTimerActive,
    timerDuration,
    joinSession,
    submitAnswer,
    sendEmojiReaction,
  } = useQuizSession(sessionId, isHost)

  const [selectedAnswer, setSelectedAnswer] = useState("")

  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user && sessionId) {
      // Fetch session details
      fetch(`/api/sessions/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!("error" in data)) {
            setQuizDetails(data)
            setIsHost(data.hostId === authSession.user?.userId)
          }
          setIsLoading(false)
        })
        .catch((error) => {
          console.error("Error fetching session details:", error)
          setIsLoading(false)
        })
    }
  }, [sessionId, authSession, authStatus])

  useEffect(() => {
    // Reset selectedAnswer when the currentQuestion changes
    setSelectedAnswer("")
  }, [currentQuestion])

  useEffect(() => {
    if (isConnected) {
      joinSession()
    }
  }, [isConnected, joinSession])

  // Show confetti when session is completed
  useEffect(() => {
    if (status === "completed") {
      setShowConfetti(true)
    }
  }, [status])

  if (authStatus === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Chargement de la session...</p>
        </div>
      </div>
    )
  }

  if (!quizDetails) {
    return (
      <div className="p-10">
        <Card>
          <CardHeader>
            <CardTitle>Session introuvable</CardTitle>
            <CardDescription>Cette session de kwiz a peut-être pris fin ou n'existe pas.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/dashboard")}>Retour au Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Render different views based on session status
  const renderSessionContent = () => {
    switch (status) {
      case "waiting":
        return renderWaitingRoom()
      case "active":
        return renderActiveSession()
      case "correction":
        return renderCorrectionPhase()
      case "completed":
        return renderResults()
      default:
        return renderWaitingRoom()
    }
  }

  const renderWaitingRoom = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Salle d'attente : {quizDetails.name || quizDetails.quiz.name}
          </CardTitle>
          <CardDescription>{quizDetails.description && quizDetails.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-md text-center">
            <div className="text-sm font-medium text-muted-foreground">Code de session :</div>
            <div className="text-3xl font-bold tracking-widest">{quizDetails.code}</div>
          </div>

          {/* Session Info */}
          <div className="flex flex-col justify-center items-start gap-2 items-center">
            {quizDetails.sessionDate && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>Planifié :</span>
                <Badge variant="secondary">
                  {new Date(quizDetails.sessionDate).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Badge>
              </div>
            )}
            {quizDetails.timerDuration && (
              <div className="flex items-center gap-2 text-sm">
                <Timer className="h-4 w-4" />
                <span>Temps par question :</span>
                <Badge variant="secondary">
                  {quizDetails.timerDuration >= 60
                    ? `${Math.floor(quizDetails.timerDuration / 60)}m ${quizDetails.timerDuration % 60 ? (quizDetails.timerDuration % 60) + "s" : ""}`.trim()
                    : `${quizDetails.timerDuration}s`}
                </Badge>
              </div>
            )}
            <span>
              {isHost
                ? "Votre session de kwiz est prête. Les participants peuvent rejoindre en utilisant le code ci-dessous."
                : "En attente de l'hôte pour démarrer le kwiz..."}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participants ({participants.length})
              </h3>
              <Badge variant="outline">{isConnected ? "Connecté" : "Connexion en cours..."}</Badge>
            </div>

            <div className="bg-card border rounded-md p-4 max-h-40 overflow-y-auto">
              {participants.length > 0 ? (
                <ul className="space-y-2">
                  {participants.map((participant) => (
                    <li key={participant.id} className="text-sm flex items-center justify-between">
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
                      {participant.host && <Badge variant="destructive">Host</Badge>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center">Aucun participant pour le moment</p>
              )}
            </div>
          </div>
        </CardContent>
        {isHost && (
          <CardFooter>
            <Button onClick={() => router.push(`/admin/sessions/${sessionId}/host`)} className="w-full">
              Commencer à hoster
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )

  const renderActiveSession = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {currentQuestion ? (
        <Card className="border-primary/50">
          <CardHeader>
            <div className="flex justify-between items-center">
              <Badge variant="outline">
                {currentQuestion.type === "MULTIPLE_CHOICE" ? "Choix multiple" : "Réponse libre"}
              </Badge>

              <div className="flex items-center gap-2">
                {isTimerActive && timeRemaining !== null && (
                  <Badge
                    variant={timeRemaining <= 10 ? "destructive" : "secondary"}
                    className="flex items-center gap-1"
                  >
                    <Timer className="h-3 w-3" />
                    {formatTime(timeRemaining)}
                  </Badge>
                )}
                <Badge variant={isConnected ? "outline" : "destructive"}>
                  {isConnected ? "Connecté" : "Déconnecté"}
                </Badge>
              </div>
            </div>
            <CardTitle className="text-xl mt-2">{currentQuestion.text}</CardTitle>
          </CardHeader>

          {currentQuestion.imageUrl && (
            <div className="px-6">
              <div className="w-full h-48 md:h-64 bg-muted rounded-md flex items-center justify-center">
                <img
                  src={currentQuestion.imageUrl || "/placeholder.svg"}
                  alt="Question"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          )}

          <CardContent className="pt-6">
            {!isHost && (
              <>
                {currentQuestion.type === "MULTIPLE_CHOICE" ? (
                  <RadioGroup
                    value={selectedAnswer}
                    onValueChange={setSelectedAnswer}
                    disabled={hasSubmitted || (timeRemaining !== null && timeRemaining <= 0)}
                  >
                    <div className="space-y-3">
                      {currentQuestion.options?.map((option: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={`option-${index}`} />
                          <Label htmlFor={`option-${index}`} className="flex-1 py-2">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                ) : (
                  <Textarea
                    placeholder="Type your answer here..."
                    value={selectedAnswer}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    disabled={hasSubmitted || (timeRemaining !== null && timeRemaining <= 0)}
                    rows={4}
                  />
                )}
              </>
            )}

            {isHost && (
              <div className="p-4 bg-muted rounded-md">
                {/* Hardcoded "Minus 1" because host can't reply */}
                <p className="text-center text-muted-foreground">
                  {answers.filter((a) => a.questionId === currentQuestion.id).length} of {participants.length - 1}{" "}
                  answers received
                </p>
                <Progress
                  className="mt-2 border-primary"
                  value={
                    (answers.filter((a) => a.questionId === currentQuestion.id).length / (participants.length - 1)) *
                    100
                  }
                />
              </div>
            )}
          </CardContent>

          <CardFooter>
            {!isHost && (
              <Button
                onClick={() => submitAnswer(currentQuestion.id, selectedAnswer)}
                className="w-full"
                disabled={!selectedAnswer || hasSubmitted || (timeRemaining !== null && timeRemaining <= 0)}
              >
                {hasSubmitted ? "Réponse soumise" : timeRemaining === 0 ? "Temps écoulé" : "Soumettre la réponse"}
              </Button>
            )}

            {isHost && (
              <Button className="w-full" disabled>
                Vous ne pouvez pas soumettre de réponses en tant qu'hôte
              </Button>
            )}
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>En attente d'une question</CardTitle>
            <CardDescription>L'hôte va bientôt sélectionner une question...</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="gap-4 flex flex-col md:flex-row w-full">
        <Card className="md:col-span-2 flex-1">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Statut actuel</h3>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session :</span>
                <span>{quizDetails.name || quizDetails.quiz.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Participants:</span>
                <span>{participants.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statut :</span>
                <Badge variant="secondary">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
              </div>
              {timerDuration && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Minuteur :</span>
                  <span>{timerDuration}s par question</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Utilisateurs connectés</h3>
          </CardHeader>
          <CardContent>
            {participants.length > 0 ? (
              <ul className="space-y-2">
                {participants.map((participant) => (
                  <li key={participant.id} className="text-sm flex items-center gap-2 justify-between">
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
                    {participant.host && <Badge variant="destructive">Host</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center">Aucun participant pour le moment</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderCorrectionPhase = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <Badge variant="secondary">Phase de correction</Badge>
            <Badge variant={isConnected ? "outline" : "destructive"}>{isConnected ? "Connecté" : "Déconnecté"}</Badge>
          </div>
          <CardTitle className="mt-2">{isHost ? "Vérifiez les questions et réponses" : "Correction en cours"}</CardTitle>
          <CardDescription>
            {isHost
              ? "Sélectionnez une question à vérifier, puis affichez et notez chaque réponse"
              : "L'hôte vérifie et note les réponses"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isHost ? (
            <>
              <div>Vous ne pouvez corriger les réponses que depuis le menu hôte</div>
              <Button
                onClick={() => router.push(`/admin/sessions/${sessionId}/host`)}
                className="w-full"
                disabled={!correctionQuestion && correctionAnswers.length === 0}
              >
                Aller au menu hôte
              </Button>
            </>
          ) : (
            <div className="py-10 text-center">
              {correctionQuestion ? (
                <div className="space-y-4">
                  <div className="border border-muted rounded-md mb-4" />
                  <div>
                    <p className="text-lg">{correctionQuestion.text}</p>
                    {/* TODO: Add question image */}
                    <p className="text-sm text-muted-foreground">
                      Réponse attendue : {correctionQuestion.correctAnswer}
                    </p>
                  </div>
                  {currentShownAnswer ? (
                    <Card className="max-w-md mx-auto">
                      <CardHeader>
                        <div className="flex justify-center items-center gap-4">
                          {currentShownAnswer.userImage ? (
                            <img
                              src={currentShownAnswer.userImage || "/placeholder.svg"}
                              alt={currentShownAnswer.userImage || "Unknown"}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                              {currentShownAnswer.userName?.charAt(0).toUpperCase() || "?"}
                            </div>
                          )}
                          <h4 className="font-medium">{currentShownAnswer.userName}'s Answer</h4>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-2">{currentShownAnswer.answer}</p>
                        {currentShownAnswer.isCorrect !== null && (
                          <Badge
                            variant={currentShownAnswer.isCorrect ? "default" : "destructive"}
                            className={currentShownAnswer.isCorrect ? "bg-green-800" : ""}
                          >
                            {currentShownAnswer.isCorrect
                              ? `Correct (${currentShownAnswer.points} pts)`
                              : "Incorrect (0 pts)"}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-muted-foreground">En attente que l'hôte affiche une réponse...</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="h-10 w-10 mx-auto mb-4 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <p className="text-muted-foreground">Attente du choix de question par l'hôte...</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderResults = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Confetti Animation */}
      {showConfetti && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}

      {/* Leaderboard Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Résultats du kwiz : {quizDetails.name || quizDetails.quiz.name}
          </CardTitle>
          <CardDescription>La session de kwiz est terminée. Voici les résultats finaux.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {leaderboard.length > 0 ? (
            <div className="space-y-4">
              {leaderboard.slice(0, 3).length > 0 && (
                <div className="flex justify-center items-end gap-4 h-32 mt-4">
                  {leaderboard[1] && (
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-2">
                        {leaderboard[1].image ? (
                          <img
                            src={leaderboard[1].image || "/placeholder.svg"}
                            alt={leaderboard[1].name}
                            className="w-14 h-14 rounded-full"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-primary-foreground flex items-center justify-center text-2xl font-bold">
                            {leaderboard[1].name?.charAt(0).toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                      <div className="w-20 h-20 bg-secondary rounded-t-md flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-sm font-medium truncate">{leaderboard[1].name}</p>
                          <p className="text-xs text-muted-foreground">{leaderboard[1].score} pts</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {leaderboard[0] && (
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-2">
                        {leaderboard[0].image ? (
                          <img
                            src={leaderboard[0].image || "/placeholder.svg"}
                            alt={leaderboard[0].name}
                            className="w-16 h-16 rounded-full"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary-foreground flex items-center justify-center text-2xl font-bold">
                            {leaderboard[0].name?.charAt(0).toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                      <div className="w-24 h-28 bg-primary rounded-t-md flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-sm font-medium text-primary-foreground truncate">{leaderboard[0].name}</p>
                          <p className="text-xs text-primary-foreground/70">{leaderboard[0].score} pts</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {leaderboard[2] && (
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-2">
                        {leaderboard[2].image ? (
                          <img
                            src={leaderboard[2].image || "/placeholder.svg"}
                            alt={leaderboard[2].name}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary-foreground flex items-center justify-center text-2xl font-bold">
                            {leaderboard[2].name?.charAt(0).toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                      <div className="w-18 h-16 bg-muted rounded-t-md flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-sm font-medium truncate">{leaderboard[2].name}</p>
                          <p className="text-xs text-muted-foreground">{leaderboard[2].score} pts</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border rounded-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">Rang</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Joueur</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr key={entry.userId} className="border-t">
                        <td className="px-4 py-3 text-sm">{index + 1}</td>
                        <td className="px-4 py-3 text-sm">{entry.name}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{entry.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Aucun résultat disponible</p>
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Retour au Dashboard
          </Button>
        </CardFooter>
      </Card>

      {/* Recap Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Récapitulatif de la session
          </CardTitle>
          <CardDescription>Voici les questions et réponses de cette session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Réponses</h3>

              {questions.map((question) => (
                <Card key={question.id} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline">
                        {question.type === "MULTIPLE_CHOICE" ? "Choix multiple" : "Réponse libre"}
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
                          <div key={userId} className="flex items-start gap-2 p-2 rounded-md border items-center">
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
              <p className="mt-2 text-muted-foreground">Aucune question répondue dans cette session</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const handleEmojiSelect = (emoji: string) => {
    sendEmojiReaction(emoji)
  }

  return (
    <div className="p-10">
      {renderSessionContent()}

      {/* Floating Emoji Button */}
      {!isHost && (
        <div className="fixed bottom-6 right-6 z-40">
          <EmojiSelector onEmojiSelect={handleEmojiSelect} />
        </div>
      )}

      {/* Emoji Rain Container */}
      <EmojiRain />
    </div>
  )
}
