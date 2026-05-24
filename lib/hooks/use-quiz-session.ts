"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
  type: "MULTIPLE_CHOICE" | "FREE_ANSWER" | "DRAG_TO_ORDER"
  options?: string[]
  order: number
  correctAnswer?: string | null
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
  const [isTimerPaused, setIsTimerPaused] = useState(false)
  const [isTimerFocused, setIsTimerFocused] = useState(false)
  const [timerStartTimeMs, setTimerStartTimeMs] = useState<number | null>(null)
  const [timerModificationSeconds, setTimerModificationSeconds] = useState<number>(0)
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null)
  const [allowAnswerEdit, setAllowAnswerEdit] = useState(false)
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimeRemainingRef = useRef<number | null>(null)

  const parseStartTimeMs = (value: any): number | null => {
    if (value === null || value === undefined) return null
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = Date.parse(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  const computeRemainingSeconds = useCallback(
    (params?: {
      duration?: number | null
      startTimeMs?: number | null
      modificationSeconds?: number
      timerPaused?: boolean
      pausedRemaining?: number | null
    }) => {
      const duration = params?.duration ?? timerDuration
      const startTime = params?.startTimeMs ?? timerStartTimeMs
      const modification = params?.modificationSeconds ?? timerModificationSeconds
      const paused = params?.timerPaused ?? isTimerPaused
      const pausedRem = params?.pausedRemaining ?? pausedRemaining

      if (!duration || duration <= 0 || !startTime) return null
      if (paused) return typeof pausedRem === "number" ? pausedRem : null

      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const total = duration + modification
      return Math.max(0, total - elapsed)
    },
    [timerDuration, timerStartTimeMs, timerModificationSeconds, isTimerPaused, pausedRemaining],
  )

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
      const canEdit = allowAnswerEdit && (timeRemaining === null || timeRemaining > 0)
      if (socket && isConnected && !isHost && (!hasSubmitted || canEdit)) {
        socket.emit("submit-answer", { sessionId, questionId, answer })
        setUserAnswer(answer)
        setHasSubmitted(true)
      }
    },
    [socket, isConnected, sessionId, isHost, hasSubmitted, allowAnswerEdit, timeRemaining],
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

  const updateAllowAnswerEdit = useCallback(
    (enabled: boolean) => {
      if (socket && isConnected && isHost) {
        socket.emit("update-allow-answer-edit", { sessionId, allowAnswerEdit: enabled })
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

  const pauseTimer = useCallback(() => {
    if (socket && isConnected && isHost) {
      socket.emit("pause-timer", { sessionId })
    }
  }, [socket, isConnected, sessionId, isHost])

  const resumeTimer = useCallback(() => {
    if (socket && isConnected && isHost) {
      socket.emit("resume-timer", { sessionId })
    }
  }, [socket, isConnected, sessionId, isHost])

  const addTimeToQuestion = useCallback(
    (seconds: number) => {
      if (socket && isConnected && isHost) {
        socket.emit("add-time", { sessionId, seconds })
      }
    },
    [socket, isConnected, sessionId, isHost],
  )

  const focusTimer = useCallback(
    (durationMs?: number) => {
      if (socket && isConnected && isHost) {
        socket.emit("focus-timer", { sessionId, durationMs })
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

  // Timer effect: compute remaining time from (duration + modification - elapsed)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const recompute = () => {
      const next = computeRemainingSeconds()
      setTimeRemaining(next)
      setIsTimerActive(typeof next === "number" && next > 0)
    }

    // Recompute immediately when inputs change
    recompute()

    if (!isTimerPaused && timerDuration && timerDuration > 0 && timerStartTimeMs) {
      interval = setInterval(recompute, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [computeRemainingSeconds, isTimerPaused, timerDuration, timerStartTimeMs])

  useEffect(() => {
    lastTimeRemainingRef.current = timeRemaining
  }, [timeRemaining])

  useEffect(() => {
    if (!hasSubmitted && currentQuestion && !isHost && status === "active" && timeRemaining === 0) {
      setHasSubmitted(true)
      toast({
        title: "Time's up!",
        description: "Time limit reached for this question",
        variant: "destructive",
      })
    }
  }, [hasSubmitted, currentQuestion, isHost, status, timeRemaining, toast])

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
      setAllowAnswerEdit(!!data.allowAnswerEdit)
      setIsTimerPaused(!!data.timerPaused)
      setPausedRemaining(!!data.timerPaused && typeof data.timeRemaining === "number" ? data.timeRemaining : null)
      setTimerStartTimeMs(parseStartTimeMs(data.questionStartTime))
      setTimerModificationSeconds(
        typeof data.timerModificationSeconds === "number" ? Math.trunc(data.timerModificationSeconds) : 0,
      )

      if (data.status === "correction") {
        setCorrectionQuestion(data.correctionQuestion || null)
        setCorrectionAnswers(data.correctionAnswers || [])
        setCurrentShownAnswer(data.currentShownAnswer || null)
      }
    }

    const handleNewQuestion = (data: any) => {
      setStatus(data.status)
      setCurrentQuestion(data.question)
      setUserAnswer(null)
      setHasSubmitted(false)

      const nextStart = parseStartTimeMs(data.questionStartTime)
      const nextModification =
        typeof data.timerModificationSeconds === "number" ? Math.trunc(data.timerModificationSeconds) : 0
      const nextPaused = !!data.timerPaused

      setTimerDuration(data.timerDuration || null)
      setTimerStartTimeMs(nextStart)
      setTimerModificationSeconds(nextModification)
      setIsTimerPaused(nextPaused)
      setPausedRemaining(nextPaused && typeof data.timeRemaining === "number" ? data.timeRemaining : null)

      // Start timer if duration is set
      const nextRemaining = computeRemainingSeconds({
        duration: data.timerDuration || null,
        startTimeMs: nextStart,
        modificationSeconds: nextModification,
        timerPaused: nextPaused,
        pausedRemaining: nextPaused && typeof data.timeRemaining === "number" ? data.timeRemaining : null,
      })
      setTimeRemaining(nextRemaining)
      setIsTimerActive(typeof nextRemaining === "number" && nextRemaining > 0)

      // Track that this question was asked
      if (data.question?.id && !askedQuestions.includes(data.question.id)) {
        setAskedQuestions((prev) => [...prev, data.question.id])
      }
    }

    const handleTimerUpdate = (data: any) => {
      setTimerDuration(data.timerDuration)

      if (!isHost) {
        const duration = data.timerDuration
        toast({
          title: "Minuteur mis à jour",
          description:
            typeof duration === "number" && duration > 0
              ? `Temps par question : ${duration}s`
              : "Le minuteur a été désactivé",
        })
      }
    }

    const handleTimerPaused = (data: any) => {
      setPausedRemaining(typeof data.timeRemaining === "number" ? data.timeRemaining : null)
      setTimeRemaining(typeof data.timeRemaining === "number" ? data.timeRemaining : null)
      setIsTimerPaused(true)
      setIsTimerActive(false)

      if (typeof data.timerModificationSeconds === "number") {
        setTimerModificationSeconds(Math.trunc(data.timerModificationSeconds))
      }
      const nextStart = parseStartTimeMs(data.questionStartTime)
      if (nextStart) setTimerStartTimeMs(nextStart)
    }

    const handleTimerResumed = (data: any) => {
      setPausedRemaining(null)
      setIsTimerPaused(false)

      if (typeof data.timerModificationSeconds === "number") {
        setTimerModificationSeconds(Math.trunc(data.timerModificationSeconds))
      }

      const nextStart = parseStartTimeMs(data.questionStartTime)
      if (nextStart) setTimerStartTimeMs(nextStart)

      const nextRemaining = computeRemainingSeconds({
        startTimeMs: nextStart ?? timerStartTimeMs,
        modificationSeconds:
          typeof data.timerModificationSeconds === "number"
            ? Math.trunc(data.timerModificationSeconds)
            : timerModificationSeconds,
        timerPaused: false,
        pausedRemaining: null,
      })

      setTimeRemaining(nextRemaining)
      setIsTimerActive(typeof nextRemaining === "number" && nextRemaining > 0)
    }

    const handleTimerExtended = (data: any) => {
      if (typeof data.timerModificationSeconds === "number") {
        setTimerModificationSeconds(Math.trunc(data.timerModificationSeconds))
      } else if (typeof data.deltaSeconds === "number") {
        setTimerModificationSeconds((prev) => prev + Math.trunc(data.deltaSeconds))
      }

      const nextStart = parseStartTimeMs(data.questionStartTime)
      if (nextStart) setTimerStartTimeMs(nextStart)

      const nextRemaining = computeRemainingSeconds({
        startTimeMs: nextStart ?? timerStartTimeMs,
        modificationSeconds:
          typeof data.timerModificationSeconds === "number"
            ? Math.trunc(data.timerModificationSeconds)
            : timerModificationSeconds,
        timerPaused: isTimerPaused,
        pausedRemaining,
      })

      setTimeRemaining(nextRemaining)
      setIsTimerActive(typeof nextRemaining === "number" && nextRemaining > 0)

      if (isHost) return

      const prevRemaining =
        typeof data.previousRemaining === "number" ? data.previousRemaining : lastTimeRemainingRef.current

      const deltaSecondsRaw =
        typeof data.deltaSeconds === "number"
          ? data.deltaSeconds
          : typeof data.addedSeconds === "number"
            ? data.addedSeconds
            : 0

      const deltaSeconds = Number.isFinite(deltaSecondsRaw) ? Math.trunc(deltaSecondsRaw) : 0

      if (prevRemaining === 0 && (nextRemaining ?? 0) > 0) {
        setHasSubmitted(false)
        toast({
          title: "Question relancée",
          description:
            deltaSeconds !== 0
              ? `Temps modifié (${deltaSeconds > 0 ? "+" : ""}${deltaSeconds}s). Vous pouvez répondre à nouveau.`
              : "Vous pouvez répondre à nouveau.",
        })
        return
      }

      if (deltaSeconds > 0) {
        toast({
          title: "Temps ajouté",
          description: `+${deltaSeconds}s sur cette question`,
        })
      } else if (deltaSeconds < 0) {
        toast({
          title: "Temps retiré",
          description: `${deltaSeconds}s sur cette question`,
        })
      }
    }

    const handleTimerFocused = (data: any) => {
      const durationMs = Math.max(1000, Math.min(15000, Math.floor(data.durationMs || 5000)))

      setIsTimerFocused(true)
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current)
      }
      focusTimeoutRef.current = setTimeout(() => {
        setIsTimerFocused(false)
      }, durationMs)
    }

    const handleAnswerEditUpdated = (data: any) => {
      setAllowAnswerEdit(!!data.allowAnswerEdit)
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
    socket.on("timer-paused", handleTimerPaused)
    socket.on("timer-resumed", handleTimerResumed)
    socket.on("timer-extended", handleTimerExtended)
    socket.on("timer-focused", handleTimerFocused)
    socket.on("answer-edit-updated", handleAnswerEditUpdated)
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
      socket.off("timer-paused", handleTimerPaused)
      socket.off("timer-resumed", handleTimerResumed)
      socket.off("timer-extended", handleTimerExtended)
      socket.off("timer-focused", handleTimerFocused)
      socket.off("answer-edit-updated", handleAnswerEditUpdated)
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
    isTimerPaused,
    isTimerFocused,
    allowAnswerEdit,
    joinSession,
    selectQuestion,
    submitAnswer,
    startCorrection,
    endSession,
    selectCorrectionQuestion,
    showCorrectionAnswer,
    gradeCorrectionAnswer,
    updateTimerDuration,
    updateAllowAnswerEdit,
    pauseTimer,
    resumeTimer,
    addTimeToQuestion,
    focusTimer,
    sendEmojiReaction,
  }
}
