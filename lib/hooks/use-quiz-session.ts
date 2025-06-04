"use client"

import { useState, useEffect, useCallback } from "react"
import { useSocket } from "@/components/socket-provider"
import { useToast } from "@/hooks/use-toast"

type Participant = {
  id: string
  name: string
  image: string
  host: boolean
}

type Question = {
  id: string
  text: string
  imageUrl?: string
  type: "MULTIPLE_CHOICE" | "FREE_ANSWER"
  options?: string[]
  correctAnswer: string
  response?: Record<
    string,
    {
      answer: string
      isCorrect?: boolean | null
    }
  >
}

type Answer = {
  userId: string
  questionId: string
  answer: string
  isCorrect?: boolean
  points?: number
}

type LeaderboardEntry = {
  userId: string
  name: string
  image?: string
  score: number
}

type SessionStatus = "waiting" | "active" | "correction" | "completed"

export function useQuizSession(sessionId: string, isHost = false) {
  const { socket, isConnected } = useSocket()
  const { toast } = useToast()

  const [status, setStatus] = useState<SessionStatus>("waiting")
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [userAnswer, setUserAnswer] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [correctionQuestion, setCorrectionQuestion] = useState<Question | null>(null)
  const [correctionAnswers, setCorrectionAnswers] = useState<any[]>([])
  const [currentShownAnswer, setCurrentShownAnswer] = useState<any | null>(null)
  const [askedQuestions, setAskedQuestions] = useState<string[]>([])
  const [timerDuration, setTimerDuration] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerActive, setIsTimerActive] = useState(false)

  const joinSession = useCallback(() => {
    if (socket && isConnected && sessionId) {
      console.log(`Joining session: ${sessionId}`)
      socket.emit("join-session", sessionId)
    }
  }, [socket, isConnected, sessionId])

  const selectQuestion = useCallback(
    (questionId: string) => {
      if (socket && isConnected && isHost) {
        socket.emit("select-question", { sessionId, questionId })
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

  const submitAnswer = useCallback(
    (questionId: string, answer: string) => {
      if (socket && isConnected && !isHost && !hasSubmitted) {
        socket.emit("submit-answer", { sessionId, questionId, answer })
        setUserAnswer(answer)
        setHasSubmitted(true)
      }
    },
    [socket, isConnected, sessionId, isHost, hasSubmitted],
  )

  const startCorrection = useCallback(() => {
    console.log("Answer state :", answers)
    if (socket && isConnected && isHost) {
      socket.emit("start-correction", { sessionId })
    }
  }, [socket, isConnected, sessionId, isHost])

  const endSession = useCallback(() => {
    if (socket && isConnected && isHost) {
      socket.emit("end-session", { sessionId })
    }
  }, [socket, isConnected, sessionId, isHost])

  const selectCorrectionQuestion = useCallback(
    (questionId: string | null) => {
      if (socket && isConnected && isHost) {
        socket.emit("select-correction-question", { sessionId, questionId })
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

  const showCorrectionAnswer = useCallback(
    (answerId: string) => {
      if (socket && isConnected && isHost) {
        socket.emit("show-correction-answer", { sessionId, answerId })
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

  const gradeCorrectionAnswer = useCallback(
    (answer: { id: string; questionId: string; userId: string }, isCorrect: boolean, points: number) => {
      if (socket && isConnected && isHost) {
        socket.emit("grade-answer", { sessionId, answerId: answer.id, isCorrect, points })
        // Check if correction is complete after grading
        setTimeout(() => {
          socket.emit("check-correction-complete", { sessionId })
        }, 100)

        console.log("Grading answer:", {
          sessionId,
          answer,
          isCorrect,
          points,
          correctionQuestionId: correctionQuestion?.id,
        })

        // Update answer state immediately for the host
        setAnswers((prev) =>
          prev.map((answer) =>
            answer.userId === answer.userId && answer.questionId === correctionQuestion?.id
              ? { ...answer, isCorrect, points }
              : answer,
          ),
        )
        console.log("Updated answers state:", answers)
      }
    },
    [socket, isConnected, sessionId, isHost, answers],
  )

  const updateTimerDuration = useCallback(
    (duration: number | null) => {
      if (socket && isConnected && isHost) {
        socket.emit("update-timer", { sessionId, timerDuration: duration })
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

  const sendEmojiReaction = useCallback(
    (emoji: string) => {
      if (socket && isConnected) {
        socket.emit("send-emoji", { sessionId, emoji })
      }
    },
    [socket, isConnected, sessionId],
  )

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isTimerActive && timeRemaining !== null && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            setIsTimerActive(false)
            // Auto-submit if user hasn't submitted and time is up
            if (!hasSubmitted && currentQuestion && !isHost && status === "active") {
              setHasSubmitted(true)
              toast({
                title: "Time's up!",
                description: "Time limit reached for this question",
                variant: "destructive",
              })
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (timeRemaining === 0) {
      setIsTimerActive(false)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTimerActive, timeRemaining, hasSubmitted, currentQuestion, isHost, toast, status])

  useEffect(() => {
    joinSession()
  }, [joinSession, isHost])

  useEffect(() => {
    if (!socket) return

    const handleSessionState = (data: any) => {
      setStatus(data.status)
      setCurrentQuestion(data.currentQuestion)
      setParticipants(Array.isArray(data.participants) ? data.participants : [])
      setLeaderboard(data.leaderboard || [])
      setQuestions(data.questions || [])
      setAskedQuestions(data.askedQuestions || [])
      setAnswers(data.answers || [])
      setTimerDuration(data.timerDuration || null)

      if (status === "correction") {
        setCorrectionQuestion(data.correctionQuestion || null)
        setCorrectionAnswers(data.correctionAnswers || [])
        setCurrentShownAnswer(data.currentShownAnswer || null)
      }

      // Set timer state if there's an active question with remaining time
      if (data.timeRemaining !== null && data.timeRemaining !== undefined) {
        setTimeRemaining(data.timeRemaining)
        setIsTimerActive(data.timeRemaining > 0)
      } else {
        setTimeRemaining(null)
        setIsTimerActive(false)
      }
    }

    const handleNewQuestion = (data: any) => {
      setStatus(data.status)
      setCurrentQuestion(data.question)
      setUserAnswer(null)
      setHasSubmitted(false)

      // Start timer if duration is set
      if (data.timerDuration && data.timerDuration > 0) {
        setTimeRemaining(data.timeRemaining || data.timerDuration)
        setIsTimerActive(true)
      } else {
        setTimeRemaining(null)
        setIsTimerActive(false)
      }

      // Track that this question was asked
      if (data.question?.id && !askedQuestions.includes(data.question.id)) {
        setAskedQuestions((prev) => [...prev, data.question.id])
      }
    }

    const handleTimerUpdate = (data: any) => {
      setTimerDuration(data.timerDuration)
    }

    const handleParticipantJoined = (data: any) => {
      if (data.participant) {
        // If the participant is already in the list, do not add again
        setParticipants((prev) => {
          if (prev.some((p) => p.id === data.participant.id)) return prev
          return [...prev, data.participant]
        })
      }
    }

    const handleAnswerReceived = () => {
      toast({
        title: "Answer submitted",
        description: "Your answer has been received",
      })
    }

    const handleParticipantAnswered = (data: any) => {
      if (isHost) {
        toast({
          title: "New answer",
          description: `${data.participantName || "A participant"} submitted an answer`,
        })

        // Update answers list for the host
        setAnswers((prev) => {
          const exists = prev.some((a) => a.userId === data.participantId && a.questionId === data.questionId)
          if (exists) {
            return prev.map((a) =>
              a.userId === data.participantId && a.questionId === data.questionId
                ? { ...a, answer: data.answer || "(hidden)", submittedAt: data.submittedAt }
                : a,
            )
          }

          return [
            ...prev,
            {
              userId: data.participantId,
              questionId: data.questionId,
              answer: data.answer || "(hidden)",
              submittedAt: data.submittedAt,
            },
          ]
        })
      }
    }

    const handleCorrectionStarted = (data: any) => {
      setStatus("correction")
      setQuestions(data.questions || [])
      setIsTimerActive(false)
      setTimeRemaining(null)
      toast({
        title: "Correction round started",
        description: isHost ? "You can now review and grade all answers" : "The host is now reviewing all answers",
      })
    }

    const handleCorrectionQuestionSelected = (data: any) => {
      setCorrectionQuestion(data.question)
      setCorrectionAnswers(data.answers || [])
      setCurrentShownAnswer(null)
    }

    const handleCorrectionAnswerShown = (data: any) => {
      setCurrentShownAnswer(data.answer)
    }

    const handleAnswerGraded = (data: any) => {
      // Update the answer in the correction answers list
      setCorrectionAnswers((prev) => prev.map((answer) => (answer.id === data.answer.id ? data.answer : answer)))

      // Update current shown answer if it's the one being graded
      setCurrentShownAnswer((prev: { id: any }) => (prev && prev.id === data.answer.id ? data.answer : prev))
    }

    const handleSessionEnded = (data: any) => {
      console.log("Session ended:", data)
      setStatus("completed")
      setLeaderboard(data.leaderboard)
      setQuestions(data.questions || [])
      setIsTimerActive(false)
      setTimeRemaining(null)
      toast({
        title: "Session ended",
        description: "The quiz session has ended",
      })
    }

    const handleError = (data: any) => {
      toast({
        title: "Error",
        description: data.message,
        variant: "destructive",
      })
    }

    const handleEmojiReaction = (data: any) => {
      // Trigger floating emoji animation
      if ((window as any).addEmojiReaction) {
        ;(window as any).addEmojiReaction(data.emoji)
      }
    }

    socket.on("session-state", handleSessionState)
    socket.on("new-question", handleNewQuestion)
    socket.on("timer-updated", handleTimerUpdate)
    socket.on("participant-joined", handleParticipantJoined)
    socket.on("answer-received", handleAnswerReceived)
    socket.on("participant-answered", handleParticipantAnswered)
    socket.on("correction-started", handleCorrectionStarted)
    socket.on("answer-graded", handleAnswerGraded)
    socket.on("session-ended", handleSessionEnded)
    socket.on("error", handleError)
    socket.on("correction-question-selected", handleCorrectionQuestionSelected)
    socket.on("correction-answer-shown", handleCorrectionAnswerShown)
    socket.on("emoji-reaction", handleEmojiReaction)

    return () => {
      socket.off("session-state", handleSessionState)
      socket.off("new-question", handleNewQuestion)
      socket.off("timer-updated", handleTimerUpdate)
      socket.off("participant-joined", handleParticipantJoined)
      socket.off("answer-received", handleAnswerReceived)
      socket.off("participant-answered", handleParticipantAnswered)
      socket.off("correction-started", handleCorrectionStarted)
      socket.off("answer-graded", handleAnswerGraded)
      socket.off("session-ended", handleSessionEnded)
      socket.off("error", handleError)
      socket.off("correction-question-selected", handleCorrectionQuestionSelected)
      socket.off("correction-answer-shown", handleCorrectionAnswerShown)
      socket.off("emoji-reaction", handleEmojiReaction)
    }
  }, [socket, toast, isHost, askedQuestions])

  return {
    status,
    currentQuestion,
    participants,
    answers,
    userAnswer,
    hasSubmitted,
    leaderboard,
    questions,
    isConnected,
    correctionQuestion,
    correctionAnswers,
    currentShownAnswer,
    askedQuestions,
    timerDuration,
    timeRemaining,
    isTimerActive,
    joinSession,
    selectQuestion,
    submitAnswer,
    startCorrection,
    endSession,
    selectCorrectionQuestion,
    showCorrectionAnswer,
    gradeCorrectionAnswer,
    updateTimerDuration,
    sendEmojiReaction,
  }
}
