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
import { useQuizSession } from "@/lib/hooks/use-quiz-session"
import { useToast } from "@/hooks/use-toast"
import { Users, Clock, CheckCircle, XCircle, AlertCircle, Trophy, Share } from "lucide-react"

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
  quizId: string
  hostId: string
  status: "waiting" | "active" | "correction" | "completed"
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

  const {
    status,
    currentQuestion,
    participants,
    answers,
    leaderboard,
    isConnected,
    correctionQuestion,
    correctionAnswers,
    currentShownAnswer,
    selectQuestion,
    startCorrection,
    endSession,
    selectCorrectionQuestion,
    showCorrectionAnswer,
    gradeCorrectionAnswer,
  } = useQuizSession(sessionId, true)

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

          // Check if user is the host
          if (data.hostId !== authSession.user?.userId) {
            toast({
              title: "Access Denied",
              description: "You are not the host of this session",
              variant: "destructive",
            })
            router.push(`/session/${sessionId}`)
          }

          setIsLoading(false)
        })
        .catch((error) => {
          console.error("Error fetching session:", error)
          toast({
            title: "Error",
            description: "Failed to load session details",
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
      title: "Session code copied",
      description: "Share this code with your participants",
    })
  }

  const handleSelectQuestion = (questionId: string) => {
    selectQuestion(questionId)
    setCurrentTab("participants")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!quizSession) {
    return (
      <div className="p-10">
        <Card>
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>This quiz session may have ended or doesn't exist.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
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
              <h1 className="text-2xl font-bold">{quizSession.quiz.name}</h1>
              <p className="text-muted-foreground">Host Interface</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "outline" : "destructive"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Badge variant="secondary">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
              <Button variant="outline" size="sm" onClick={handleCopySessionCode}>
                <Share className="h-4 w-4 mr-1" />
                {quizSession.code}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="questions" value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="responses">Responses</TabsTrigger>
            </TabsList>

            <TabsContent value="questions" className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">Quiz Questions</h2>
                <Badge>{quizSession.quiz.questions.length} Questions</Badge>
              </div>

              <ScrollArea className="h-[60vh]">
                <div className="space-y-4">
                  {quizSession.quiz.questions.map((question) => (
                    <Card key={question.id} className="overflow-hidden">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline">
                            {question.type === "MULTIPLE_CHOICE" ? "Multiple Choice" : "Free Answer"}
                          </Badge>
                          <Badge variant="secondary">Q{question.order + 1}</Badge>
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
                        {status !== "completed" && <Button
                          onClick={() => handleSelectQuestion(question.id)}
                          className="w-full"
                          disabled={currentQuestion?.id === question.id}
                        >
                          {currentQuestion?.id === question.id ? "Current Question" : "Select Question"}
                        </Button>}
                      </CardFooter>
                    </Card>
                  ))}

                  {quizSession.quiz.questions.length === 0 && (
                    <div className="text-center py-10">
                      <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">No questions in this quiz</p>
                      <Button
                        variant="link"
                        onClick={() => router.push(`/admin/quizzes/${quizSession.quizId}`)}
                        className="mt-2"
                      >
                        Add questions
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
                              <Badge variant="destructive">Host</Badge>
                            ) : answers.some(
                              (a) => a.userId === participant.id && a.questionId === currentQuestion.id,
                            ) ? (
                              <Badge variant="outline">
                                <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                                Answered
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1 text-yellow-500" />
                                Waiting
                              </Badge>
                            )}
                          </div>
                        ) : (
                          participant.id === quizSession.hostId && (<Badge variant="destructive">Host</Badge>)
                        )}
                      </div>
                    ))}
                    {currentQuestion && status === "active" && (
                      <div className="p-4 bg-muted rounded-md">
                        {/* Hardcoded "Minus 1" because host can't reply */}
                        <p className="text-center text-muted-foreground">
                          {answers.filter((a) => a.questionId === currentQuestion.id).length} of {participants.length - 1} answers
                          received
                        </p>
                        <Progress
                          className="mt-2 border-primary"
                          value={
                            (answers.filter((a) => a.questionId === currentQuestion.id).length / (participants.length - 1)) * 100
                          }
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">No participants have joined yet</p>
                    <div className="mt-4 p-4 bg-muted rounded-md max-w-md mx-auto">
                      <p className="text-sm font-medium">Share this code with participants:</p>
                      <p className="mt-1 text-xl font-mono tracking-widest text-center">{quizSession.code}</p>
                      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={handleCopySessionCode}>
                        <Share className="h-4 w-4 mr-1" />
                        Copy Code
                      </Button>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="responses" className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">Responses</h2>
                <div className="flex gap-2">
                  {status === "active" && (
                    <Button onClick={startCorrection} size="sm">
                      Start Correction
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[60vh]">
                {status === "completed" ? (
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-md">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        Final Results
                      </h3>

                      <div className="mt-4 border rounded-md overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-background">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium">Rank</th>
                              <th className="px-4 py-2 text-left text-sm font-medium">Player</th>
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
                  </div>
                ) : status === "correction" ? (
                  <div className="space-y-4">
                    {!correctionQuestion ? (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-md">
                          <h3 className="font-medium">Correction Mode - Select a Question</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Choose a question to review and grade answers
                          </p>
                        </div>

                        <div className="space-y-2">
                          {quizSession?.quiz?.questions?.map((question, index) => (
                            <Card
                              key={question.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => selectCorrectionQuestion(question.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <Badge variant="outline" className="mb-2">
                                      Q{index + 1}
                                    </Badge>
                                    <p className="text-sm font-medium">{question.text}</p>
                                    {question.type === "MULTIPLE_CHOICE" && (
                                      <p className="text-xs text-muted-foreground mt-1">Multiple Choice</p>
                                    )}
                                  </div>
                                  <Button variant="outline" size="sm">
                                    Review Answers
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-md">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-medium">Reviewing: {correctionQuestion.text}</h3>
                              <p className="text-sm text-muted-foreground">
                                {correctionAnswers.length} answers to review
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
                              Back to Questions
                            </Button>
                          </div>
                        </div>

                        {currentShownAnswer ? (
                          <Card className="border-primary/50">
                            <CardHeader>
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium">{currentShownAnswer.userName}'s Answer</h4>
                                {currentShownAnswer.isCorrect !== null ? (
                                  <Badge variant={currentShownAnswer.isCorrect ? "default" : "destructive"}>
                                    {currentShownAnswer.isCorrect
                                      ? `Correct (${currentShownAnswer.points} pts)`
                                      : "Incorrect (0 pts)"}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Pending Review</Badge>
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
                                    className="flex-1 border-red-200 hover:bg-red-50"
                                    onClick={() => gradeCorrectionAnswer(currentShownAnswer.id, false, 0)}
                                  >
                                    <XCircle className="h-4 w-4 mr-1 text-red-500" />
                                    Incorrect (0 pts)
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="flex-1 border-green-200 hover:bg-green-50"
                                    onClick={() => gradeCorrectionAnswer(currentShownAnswer.id, true, 1)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                                    Correct (1 pt)
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="space-y-2">
                            <h4 className="font-medium">Select an answer to show and grade:</h4>
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
                                        <Badge variant="outline">Not Reviewed</Badge>
                                      )}
                                      <Button variant="outline" size="sm">
                                        Show & Grade
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}

                            {correctionAnswers.length === 0 && (
                              <div className="text-center py-8">
                                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                                <p className="mt-2 text-muted-foreground">No answers found for this question</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : currentQuestion ? (
                  // Active session content (existing code)
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-md">
                      <h3 className="font-medium">Current Question</h3>
                      <p className="mt-1">{currentQuestion.text}</p>
                    </div>

                    <div className="space-y-2">
                      {answers
                        .filter((a) => a.questionId === currentQuestion.id)
                        .map((answer) => {
                          const participant = participants.find((p) => p.id === answer.userId)
                          return (
                            <Card key={`${answer.userId}-${answer.questionId}`} className="border">
                              <CardHeader className="py-3 px-4">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-sm font-medium">{participant?.name || "Unknown User"}</h4>
                                  <Badge variant="outline">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Submitted
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2 px-4">
                                <p className="text-sm">(Answer hidden until correction phase)</p>
                              </CardContent>
                            </Card>
                          )
                        })}

                      {answers.filter((a) => a.questionId === currentQuestion.id).length === 0 && (
                        <div className="text-center py-8">
                          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="mt-2 text-muted-foreground">No answers submitted yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">No question selected</p>
                    <Button variant="link" onClick={() => setCurrentTab("questions")} className="mt-2">
                      Select a question
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
              <CardTitle>Session Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Session Code</label>
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
                  <label className="text-sm font-medium">Status</label>
                  <div className="bg-muted p-2 rounded-md flex justify-between items-center">
                    <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    <Badge variant={isConnected ? "outline" : "destructive"} className="ml-2">
                      {isConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Participants</label>
                  <div className="bg-muted p-2 rounded-md">
                    <div className="flex items-center justify-between">
                      <span>{participants.length}</span>
                      <Button variant="ghost" size="sm" onClick={() => setCurrentTab("participants")}>
                        View
                      </Button>
                    </div>
                  </div>
                </div>

                {currentQuestion && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Current Question</label>
                    <div className="bg-muted p-2 rounded-md">
                      <p className="line-clamp-2 text-sm">{currentQuestion.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline">
                          {currentQuestion.type === "MULTIPLE_CHOICE" ? "Multiple Choice" : "Free Answer"}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentTab("responses")}>
                          View Responses
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
                  Start Correction Round
                </Button>
              )}

              {status === "correction" && (
                <Button onClick={endSession} className="w-full" variant="destructive">
                  End Session & Show Results
                </Button>
              )}

              <Button variant="outline" className="w-full" onClick={() => router.push(`/session/${sessionId}`)}>
                View Participant View
              </Button>
            </CardFooter>
          </Card>

          {status === "completed" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Final Results
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
    </div>
  )
}
