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
  const [correctionQuestion, setCorrectionQuestion] = useState<Question | null>(null)
  const [correctionAnswers, setCorrectionAnswers] = useState<any[]>([])
  const [currentShownAnswer, setCurrentShownAnswer] = useState<any | null>(null)

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
      if (socket && isConnected && !isHost) {
        socket.emit("submit-answer", { sessionId, questionId, answer })
        setUserAnswer(answer)
        setHasSubmitted(true)
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

  const startCorrection = useCallback(() => {
    if (socket && isConnected && isHost) {
      socket.emit("start-correction", { sessionId })
    }
  }, [socket, isConnected, sessionId, isHost])

  const gradeAnswer = useCallback(
    (questionId: string, userId: string, isCorrect: boolean, points: number) => {
      if (socket && isConnected && isHost) {
        socket.emit("grade-answer", { sessionId, questionId, userId, isCorrect, points })
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

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
    (answerId: string, isCorrect: boolean, points: number) => {
      if (socket && isConnected && isHost) {
        socket.emit("grade-answer", { sessionId, answerId, isCorrect, points })
        // Check if correction is complete after grading
        setTimeout(() => {
          socket.emit("check-correction-complete", { sessionId })
        }, 100)
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

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
    }

    const handleNewQuestion = (data: any) => {
      setStatus(data.status)
      setCurrentQuestion(data.question)
      setUserAnswer(null)
      setHasSubmitted(false)
    }

    const handleParticipantJoined = (data: any) => {
      if (data.participant) {
        setParticipants((prev) => [...prev, data.participant])
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
          if (exists) return prev

          return [
            ...prev,
            {
              userId: data.participantId,
              questionId: data.questionId,
              answer: "(hidden until correction)",
            },
          ]
        })
      }
    }

    const handleCorrectionStarted = () => {
      setStatus("correction")
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
      setStatus("completed")
      setLeaderboard(data.leaderboard)
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

    socket.on("session-state", handleSessionState)
    socket.on("new-question", handleNewQuestion)
    socket.on("participant-joined", handleParticipantJoined)
    socket.on("answer-received", handleAnswerReceived)
    socket.on("participant-answered", handleParticipantAnswered)
    socket.on("correction-started", handleCorrectionStarted)
    socket.on("answer-graded", handleAnswerGraded)
    socket.on("session-ended", handleSessionEnded)
    socket.on("error", handleError)
    socket.on("correction-question-selected", handleCorrectionQuestionSelected)
    socket.on("correction-answer-shown", handleCorrectionAnswerShown)
    socket.on("answer-graded", handleAnswerGraded)

    return () => {
      socket.off("session-state", handleSessionState)
      socket.off("new-question", handleNewQuestion)
      socket.off("participant-joined", handleParticipantJoined)
      socket.off("answer-received", handleAnswerReceived)
      socket.off("participant-answered", handleParticipantAnswered)
      socket.off("correction-started", handleCorrectionStarted)
      socket.off("answer-graded", handleAnswerGraded)
      socket.off("session-ended", handleSessionEnded)
      socket.off("error", handleError)
      socket.off("correction-question-selected", handleCorrectionQuestionSelected)
      socket.off("correction-answer-shown", handleCorrectionAnswerShown)
      socket.off("answer-graded", handleAnswerGraded)
    }
  }, [socket, toast, isHost])

  return {
    status,
    currentQuestion,
    participants,
    answers,
    userAnswer,
    hasSubmitted,
    leaderboard,
    isConnected,
    correctionQuestion,
    correctionAnswers,
    currentShownAnswer,
    joinSession,
    selectQuestion,
    submitAnswer,
    startCorrection,
    gradeAnswer,
    endSession,
    selectCorrectionQuestion,
    showCorrectionAnswer,
    gradeCorrectionAnswer,
  }
}
