import type { Server } from "node:http"

import { Server as IOServer } from "socket.io"
import { prisma } from "@/lib/prisma"

export type SessionState = {
  sessionId: string
  currentQuestion: any | null
  participants: Map<string, { id: string; name: string; image: string; host: boolean }>
  answers: Map<string, Map<string, { answer: string; submittedAt: Date }>>
  status: "waiting" | "active" | "correction" | "completed"
  allowAnswerEdit: boolean
  askedQuestions: Set<string>
  leaderboard?: Array<{
    userId: string
    name: string | null
    image?: string | null
    score: number
  }>
  questions: {
    id: string
    text: string
    imageUrl?: string | null
    type: "MULTIPLE_CHOICE" | "FREE_ANSWER" | "DRAG_TO_ORDER"
    options?: string[]
    correctAnswer?: string | null
    response?: Record<
      string,
      {
        answer: string
        isCorrect?: boolean | null
      }
    >
  }[]
  timerDuration: number | null
  questionStartTime: Date | null
  timerModificationSeconds: number
  timerPaused: boolean
  pausedRemaining: number | null
  currentShownAnswer: {
    id: string
    userId: string
    userName: string
    userImage: string
    answer: string
    isCorrect?: boolean | null
    points?: number | null
  } | null
}

export const sessionStates = new Map<string, SessionState>()

export function initSocketServer(server: Server) {
  const io = new IOServer(server)

  const sanitizeQuestionForParticipant = (question: any) => {
    if (!question) return question
    const { correctAnswer, ...rest } = question
    return rest
  }

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId

    if (!userId) {
      socket.disconnect()
      return
    }

    console.log(`User connected to socket: ${userId}`)

    // Join a session
    socket.on("join-session", async (sessionId: string) => {
      try {
        // Find the session
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
        })

        if (!session) {
          socket.emit("error", { message: "Session not found" })
          return
        }

        // Join the room
        socket.join(sessionId)

        // Initialize session state if not exists
        if (!sessionStates.has(sessionId)) {
          const participants = new Map()

          session.participants.forEach((participant) => {
            participants.set(participant.userId, {
              id: participant.userId,
              name: participant.user.name || "Anonymous",
              image: participant.user.image || "",
              host: session.hostId === participant.userId,
            })
          })

          sessionStates.set(sessionId, {
            sessionId,
            currentQuestion: null,
            participants,
            answers: new Map(),
            status: session.status.toLowerCase() as "waiting" | "active" | "correction" | "completed",
            allowAnswerEdit: session.allowAnswerEdit ?? false,
            askedQuestions: new Set(),
            leaderboard: [],
            questions: [],
            timerDuration: session.timerDuration,
            questionStartTime: null,
            timerModificationSeconds: 0,
            timerPaused: false,
            pausedRemaining: null,
            currentShownAnswer: null,
          })
        }

        const sessionState = sessionStates.get(sessionId)!

        if (sessionState.allowAnswerEdit === undefined) {
          sessionState.allowAnswerEdit = session.allowAnswerEdit ?? false
        }

        if (sessionState.timerPaused === undefined) {
          sessionState.timerPaused = false
          sessionState.pausedRemaining = null
        }

        if (typeof sessionState.timerModificationSeconds !== "number") {
          sessionState.timerModificationSeconds = 0
        }

        if (sessionState.currentQuestion && sessionState.currentQuestion.correctAnswer === undefined) {
          const questionWithAnswer = await prisma.question.findUnique({
            where: { id: sessionState.currentQuestion.id },
            select: {
              id: true,
              text: true,
              imageUrl: true,
              type: true,
              options: true,
              correctAnswer: true,
            },
          })

          if (questionWithAnswer) {
            sessionState.currentQuestion = {
              ...sessionState.currentQuestion,
              ...questionWithAnswer,
            }
          }
        }

        // Add participant if not already in the session
        if (!sessionState.participants.has(userId)) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, image: true },
          })

          if (user) {
            sessionState.participants.set(userId, {
              id: user.id,
              name: user.name || "Anonymous",
              image: user.image || "",
              host: session.hostId === userId,
            })
          }

          // Notify others that a new participant joined
          socket.to(sessionId).emit("participant-joined", {
            participant: sessionState.participants.get(userId),
          })
        }

        // If the session is completed, send the leaderboard and the details of the session
        if (sessionState.status === "completed" && sessionState.leaderboard?.length === 0) {
          // Get final leaderboard
          const leaderboard = await prisma.participation.findMany({
            where: { sessionId },
            orderBy: { score: "desc" },
            select: {
              userId: true,
              score: true,
              user: {
                select: {
                  name: true,
                  image: true,
                },
              },
            },
          })

          sessionState.leaderboard = []

          leaderboard.forEach((entry) => {
            if (session.hostId !== entry.userId) {
              sessionState.leaderboard!.push({
                userId: entry.userId,
                name: entry.user.name,
                image: entry.user.image,
                score: entry.score,
              })
            }
          })

          // Get quizId
          const quiz = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            select: { quizId: true },
          })

          // compute the questions and their responses
          const questions = await prisma.question.findMany({
            where: { quizId: quiz?.quizId },
            select: {
              id: true,
              text: true,
              imageUrl: true,
              type: true,
              options: true,
              correctAnswer: true,
              answers: {
                select: {
                  userId: true,
                  answer: true,
                  isCorrect: true,
                },
                where: {
                  sessionId,
                },
              },
            },
          })

          sessionState.questions = questions
            .map((question) => {
              if (question.answers.length !== 0) {
                return {
                  id: question.id,
                  text: question.text,
                  imageUrl: question.imageUrl || null,
                  type: question.type,
                  options: question.type === "MULTIPLE_CHOICE" ? question.options : undefined,
                  correctAnswer: question.correctAnswer || null,
                  response: question.answers.reduce(
                    (acc: Record<string, { answer: string; isCorrect?: boolean | null }>, answer) => {
                      acc[answer.userId] = {
                        answer: answer.answer,
                        isCorrect: answer.isCorrect,
                      }
                      return acc
                    },
                    {},
                  ),
                }
              }
              return undefined
            })
            .filter((question): question is NonNullable<typeof question> => question !== undefined)
        }

        // Get all answers for this session to send to the client
        const allAnswers = await prisma.playerAnswer.findMany({
          where: { sessionId },
          select: {
            userId: true,
            questionId: true,
            answer: true,
            isCorrect: true,
            points: true,
            submittedAt: true,
          },
        })

        // Calculate remaining time if there's an active question with timer
        let timeRemaining = null
        if (sessionState.currentQuestion && sessionState.timerDuration) {
          if (sessionState.timerPaused && sessionState.pausedRemaining !== null) {
            timeRemaining = sessionState.pausedRemaining
          } else if (sessionState.questionStartTime) {
            const elapsed = Math.floor((Date.now() - sessionState.questionStartTime.getTime()) / 1000)
            const total = sessionState.timerDuration + (sessionState.timerModificationSeconds || 0)
            timeRemaining = Math.max(0, total - elapsed)
          }
        }

        const isHostUser = session.hostId === userId
        const currentQuestionForSocket = isHostUser
          ? sessionState.currentQuestion
          : sanitizeQuestionForParticipant(sessionState.currentQuestion)

        if (sessionState.status === "correction") {
          // Get all answers for this question
          const answers = await prisma.playerAnswer.findMany({
            where: {
              sessionId,
              questionId: sessionState.currentQuestion?.id,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          })

          // Send session state to the client
          socket.emit("session-state", {
            sessionId,
            status: sessionState.status,
            currentQuestion: currentQuestionForSocket,
            participants: Array.from(sessionState.participants.values()),
            leaderboard: sessionState.leaderboard || [],
            questions: [],
            askedQuestions: Array.from(sessionState.askedQuestions),
            answers: allAnswers,
            timerDuration: sessionState.timerDuration,
            allowAnswerEdit: sessionState.allowAnswerEdit,
            timerPaused: sessionState.timerPaused,
            timeRemaining,
            questionStartTime: sessionState.questionStartTime ? sessionState.questionStartTime.toISOString() : null,
            timerModificationSeconds: sessionState.timerModificationSeconds || 0,
            correctionQuestion: sessionState.currentQuestion,
            correctionAnswers: answers.map((answer) => ({
              id: answer.id,
              userId: answer.userId,
              userName: answer.user.name,
              userImage: answer.user.image,
              answer: answer.answer,
              isCorrect: answer.isCorrect,
              points: answer.points,
            })),
            currentShownAnswer: sessionState.currentShownAnswer || null,
          })
        } else {
          // Send session state to the client
          socket.emit("session-state", {
            sessionId,
            status: sessionState.status,
            currentQuestion: currentQuestionForSocket,
            participants: Array.from(sessionState.participants.values()),
            leaderboard: sessionState.leaderboard || [],
            questions: sessionState.status === "completed" ? sessionState.questions : [],
            askedQuestions: Array.from(sessionState.askedQuestions),
            answers: allAnswers,
            timerDuration: sessionState.timerDuration,
            allowAnswerEdit: sessionState.allowAnswerEdit,
            timerPaused: sessionState.timerPaused,
            timeRemaining,
            questionStartTime: sessionState.questionStartTime ? sessionState.questionStartTime.toISOString() : null,
            timerModificationSeconds: sessionState.timerModificationSeconds || 0,
          })
        }
      } catch (error) {
        console.error("Error joining session:", error)
        socket.emit("error", { message: "Failed to join session" })
      }
    })

    // Send emoji reaction
    socket.on("send-emoji", async (data: { sessionId: string; emoji: string }) => {
      try {
        const { sessionId, emoji } = data

        // Verify user is in the session
        const sessionState = sessionStates.get(sessionId)
        if (!sessionState || !sessionState.participants.has(userId)) {
          socket.emit("error", { message: "You are not in this session" })
          return
        }

        const participant = sessionState.participants.get(userId)

        // Broadcast emoji to all participants in the session
        io.to(sessionId).emit("emoji-reaction", {
          emoji,
          userId,
          userName: participant?.name || "Anonymous",
          userImage: participant?.image || "",
        })
      } catch (error) {
        console.error("Error sending emoji:", error)
        socket.emit("error", { message: "Failed to send emoji" })
      }
    })

    // Host selects a question
    socket.on("select-question", async (data: { sessionId: string; questionId: string }) => {
      try {
        const { sessionId, questionId } = data

        // Check if user is the host
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can select questions" })
          return
        }

        // Get question details
        const question = await prisma.question.findUnique({
          where: { id: questionId },
          select: {
            id: true,
            text: true,
            imageUrl: true,
            type: true,
            options: true,
            correctAnswer: true,
          },
        })

        if (!question) {
          socket.emit("error", { message: "Question not found" })
          return
        }

        // Update session state
        const sessionState = sessionStates.get(sessionId)
        if (sessionState) {
          if (sessionState.status === "waiting" || sessionState.status === "active") {
            sessionState.currentQuestion = question
            sessionState.status = "active"
            sessionState.questionStartTime = new Date()
            sessionState.timerModificationSeconds = 0
            sessionState.timerPaused = false
            sessionState.pausedRemaining = null

            // Track that this question was asked
            sessionState.askedQuestions.add(questionId)

            // Update session in database
            await prisma.quizSession.update({
              where: { id: sessionId },
              data: {
                status: "ACTIVE",
                currentQuestionId: questionId,
                startedAt: { set: new Date() },
              },
            })

            // Calculate time remaining
            let timeRemaining = null
            if (sessionState.timerDuration) {
              timeRemaining = sessionState.timerDuration
            }

            // Broadcast the question to all participants
            const questionForParticipants = sanitizeQuestionForParticipant({
              id: question.id,
              text: question.text,
              imageUrl: question.imageUrl,
              type: question.type,
              options: (question.type === "MULTIPLE_CHOICE" || question.type === "DRAG_TO_ORDER") ? question.options : undefined,
              correctAnswer: question.correctAnswer || null,
            })

            const questionForHost = {
              id: question.id,
              text: question.text,
              imageUrl: question.imageUrl,
              type: question.type,
              options: (question.type === "MULTIPLE_CHOICE" || question.type === "DRAG_TO_ORDER") ? question.options : undefined,
              correctAnswer: question.correctAnswer || null,
            }

            socket.emit("new-question", {
              status: sessionState.status,
              question: questionForHost,
              timerDuration: sessionState.timerDuration,
              timerPaused: sessionState.timerPaused,
              timeRemaining,
              questionStartTime: sessionState.questionStartTime ? sessionState.questionStartTime.toISOString() : null,
              timerModificationSeconds: sessionState.timerModificationSeconds || 0,
            })

            socket.to(sessionId).emit("new-question", {
              status: sessionState.status,
              question: questionForParticipants,
              timerDuration: sessionState.timerDuration,
              timerPaused: sessionState.timerPaused,
              timeRemaining,
              questionStartTime: sessionState.questionStartTime ? sessionState.questionStartTime.toISOString() : null,
              timerModificationSeconds: sessionState.timerModificationSeconds || 0,
            })
          } else if (sessionState.status === "correction") {
            // If in correction mode, just update the current question
            sessionState.currentQuestion = question

            // Update session in database
            await prisma.quizSession.update({
              where: { id: sessionId },
              data: {
                currentQuestionId: questionId,
              },
            })

            // Notify all participants about the selected question
            io.to(sessionId).emit("correction-question-selected", {
              question: {
                id: question.id,
                text: question.text,
                imageUrl: question.imageUrl,
                type: question.type,
                options: (question.type === "MULTIPLE_CHOICE" || question.type === "DRAG_TO_ORDER") ? question.options : undefined,
              },
            })
          }
        }
      } catch (error) {
        console.error("Error selecting question:", error)
        socket.emit("error", { message: "Failed to select question" })
      }
    })

    // Submit answer
    socket.on("submit-answer", async (data: { sessionId: string; questionId: string; answer: string }) => {
      try {
        const { sessionId, questionId, answer } = data

        const sessionState = sessionStates.get(sessionId)
        if (!sessionState || sessionState.status !== "active") {
          socket.emit("error", { message: "Cannot submit answer at this time" })
          return
        }

        if (!sessionState.allowAnswerEdit) {
          const existingAnswer = sessionState.answers.get(questionId)?.get(userId)
          if (existingAnswer) {
            socket.emit("error", { message: "Answer already submitted" })
            return
          }

          const storedAnswer = await prisma.playerAnswer.findUnique({
            where: {
              sessionId_questionId_userId: {
                sessionId,
                questionId,
                userId,
              },
            },
            select: { id: true },
          })

          if (storedAnswer) {
            socket.emit("error", { message: "Answer already submitted" })
            return
          }
        }

        // Check if timer has expired (with 1 second grace period)
        if (sessionState.timerDuration && sessionState.questionStartTime && !sessionState.timerPaused) {
          const elapsed = Math.floor((Date.now() - sessionState.questionStartTime.getTime()) / 1000)
          const timeLimit = sessionState.timerDuration + (sessionState.timerModificationSeconds || 0) + 1 // 1 second grace period

          if (elapsed > timeLimit) {
            socket.emit("error", { message: "Time limit exceeded" })
            return
          }
        }

        // Initialize answers map for this question if not exists
        if (!sessionState.answers.has(questionId)) {
          sessionState.answers.set(questionId, new Map())
        }

        const questionAnswers = sessionState.answers.get(questionId)!

        // Store the answer
        questionAnswers.set(userId, {
          answer,
          submittedAt: new Date(),
        })

        // Save answer to database
        const participation = await prisma.participation.findUnique({
          where: {
            sessionId_userId: {
              sessionId,
              userId,
            },
          },
        })

        if (participation) {
          await prisma.playerAnswer.upsert({
            where: {
              sessionId_questionId_userId: {
                sessionId,
                questionId,
                userId,
              },
            },
            update: {
              answer,
              submittedAt: new Date(),
            },
            create: {
              sessionId,
              questionId,
              userId,
              participationId: participation.id,
              answer,
            },
          })
        }

        // Acknowledge receipt
        socket.emit("answer-received", { questionId })

        // Notify host with answer details
        socket.to(sessionId).emit("participant-answered", {
          participantId: userId,
          participantName: sessionState.participants.get(userId)?.name,
          questionId,
          answer: answer,
          submittedAt: new Date(),
          edited: sessionState.allowAnswerEdit,
        })
      } catch (error) {
        console.error("Error submitting answer:", error)
        socket.emit("error", { message: "Failed to submit answer" })
      }
    })

    // Update answer edit setting
    socket.on("update-allow-answer-edit", async (data: { sessionId: string; allowAnswerEdit: boolean }) => {
      try {
        const { sessionId, allowAnswerEdit } = data

        // Check if user is the host
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can update answer settings" })
          return
        }

        const sessionState = sessionStates.get(sessionId)
        if (sessionState) {
          sessionState.allowAnswerEdit = allowAnswerEdit
        }

        await prisma.quizSession.update({
          where: { id: sessionId },
          data: { allowAnswerEdit },
        })

        io.to(sessionId).emit("answer-edit-updated", { allowAnswerEdit })
      } catch (error) {
        console.error("Error updating answer edit setting:", error)
        socket.emit("error", { message: "Failed to update answer settings" })
      }
    })

    // Pause timer
    socket.on("pause-timer", async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data

        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can pause the timer" })
          return
        }

        const sessionState = sessionStates.get(sessionId)
        if (!sessionState || sessionState.status !== "active" || !sessionState.timerDuration) {
          socket.emit("error", { message: "Timer is not active" })
          return
        }

        if (!sessionState.timerPaused) {
          const elapsed = sessionState.questionStartTime
            ? Math.floor((Date.now() - sessionState.questionStartTime.getTime()) / 1000)
            : 0
          const total = sessionState.timerDuration + (sessionState.timerModificationSeconds || 0)
          sessionState.pausedRemaining = Math.max(0, total - elapsed)
          sessionState.timerPaused = true
        }

        io.to(sessionId).emit("timer-paused", {
          timeRemaining: sessionState.pausedRemaining ?? null,
          questionStartTime: sessionState.questionStartTime ? sessionState.questionStartTime.toISOString() : null,
          timerModificationSeconds: sessionState.timerModificationSeconds || 0,
        })
      } catch (error) {
        console.error("Error pausing timer:", error)
        socket.emit("error", { message: "Failed to pause timer" })
      }
    })

    // Resume timer
    socket.on("resume-timer", async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data

        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can resume the timer" })
          return
        }

        const sessionState = sessionStates.get(sessionId)
        if (!sessionState || sessionState.status !== "active" || !sessionState.timerDuration) {
          socket.emit("error", { message: "Timer is not active" })
          return
        }

        let remaining = sessionState.timerDuration

        if (sessionState.timerPaused) {
          remaining = sessionState.pausedRemaining ?? sessionState.timerDuration
          const total = sessionState.timerDuration + (sessionState.timerModificationSeconds || 0)
          const elapsed = Math.max(0, total - remaining)
          sessionState.questionStartTime = new Date(Date.now() - elapsed * 1000)
          sessionState.timerPaused = false
          sessionState.pausedRemaining = null
        }

        io.to(sessionId).emit("timer-resumed", {
          timeRemaining: remaining,
          questionStartTime: sessionState.questionStartTime ? sessionState.questionStartTime.toISOString() : null,
          timerModificationSeconds: sessionState.timerModificationSeconds || 0,
        })
      } catch (error) {
        console.error("Error resuming timer:", error)
        socket.emit("error", { message: "Failed to resume timer" })
      }
    })

    // Focus timer on participants
    socket.on("focus-timer", async (data: { sessionId: string; durationMs?: number }) => {
      try {
        const { sessionId, durationMs } = data

        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can focus the timer" })
          return
        }

        const sessionState = sessionStates.get(sessionId)
        if (!sessionState || sessionState.status !== "active" || !sessionState.timerDuration) {
          socket.emit("error", { message: "Timer is not active" })
          return
        }

        const safeDuration = Math.max(1000, Math.min(15000, Math.floor(durationMs || 5000)))

        io.to(sessionId).emit("timer-focused", {
          durationMs: safeDuration,
        })
      } catch (error) {
        console.error("Error focusing timer:", error)
        socket.emit("error", { message: "Failed to focus timer" })
      }
    })

    // Add/remove time to current question (seconds can be negative)
    socket.on("add-time", async (data: { sessionId: string; seconds: number }) => {
      try {
        const { sessionId, seconds } = data

        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can add time" })
          return
        }

        const sessionState = sessionStates.get(sessionId)
        if (!sessionState || sessionState.status !== "active" || !sessionState.timerDuration) {
          socket.emit("error", { message: "Timer is not active" })
          return
        }

        const rawDeltaSeconds = Number.isFinite(seconds) ? Math.trunc(seconds) : 0
        const requestedDeltaSeconds = Math.max(-3600, Math.min(3600, rawDeltaSeconds))
        if (!requestedDeltaSeconds) return

        if (!sessionState.questionStartTime) {
          sessionState.questionStartTime = new Date()
        }

        const totalBefore = sessionState.timerDuration + (sessionState.timerModificationSeconds || 0)

        const getRemainingSeconds = (): number => {
          if (sessionState.timerPaused) {
            return typeof sessionState.pausedRemaining === "number" ? sessionState.pausedRemaining : totalBefore
          }
          const elapsed = Math.floor((Date.now() - sessionState.questionStartTime!.getTime()) / 1000)
          return Math.max(0, totalBefore - elapsed)
        }

        const previousRemaining = getRemainingSeconds()

        // Prevent timer total (duration + modification) from going below 0.
        const currentModification = sessionState.timerModificationSeconds || 0
        const minModification = -sessionState.timerDuration
        const maxModification = 3600
        const nextModification = Math.max(
          minModification,
          Math.min(maxModification, currentModification + requestedDeltaSeconds),
        )
        const appliedDeltaSeconds = nextModification - currentModification

        // If we're already at 0 and host tries to subtract more, do nothing.
        if (appliedDeltaSeconds === 0) return

        sessionState.timerModificationSeconds = nextModification

        if (sessionState.timerPaused && typeof sessionState.pausedRemaining === "number") {
          sessionState.pausedRemaining = Math.max(0, sessionState.pausedRemaining + appliedDeltaSeconds)
        }

        const totalAfter = sessionState.timerDuration + nextModification
        const nextRemaining = sessionState.timerPaused
          ? (typeof sessionState.pausedRemaining === "number" ? sessionState.pausedRemaining : totalAfter)
          : Math.max(
              0,
              totalAfter -
                Math.floor((Date.now() - sessionState.questionStartTime.getTime()) / 1000),
            )

        io.to(sessionId).emit("timer-extended", {
          timeRemaining: nextRemaining,
          deltaSeconds: appliedDeltaSeconds,
          addedSeconds: appliedDeltaSeconds,
          previousRemaining,
          previousTimeRemaining: previousRemaining,
          reopened: previousRemaining === 0 && nextRemaining > 0,
          questionStartTime: sessionState.questionStartTime ? sessionState.questionStartTime.toISOString() : null,
          timerModificationSeconds: sessionState.timerModificationSeconds || 0,
        })
      } catch (error) {
        console.error("Error adding time:", error)
        socket.emit("error", { message: "Failed to add time" })
      }
    })

    // Update timer duration
    socket.on("update-timer", async (data: { sessionId: string; timerDuration: number | null }) => {
      try {
        const { sessionId, timerDuration } = data

        // Check if user is the host
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can update timer settings" })
          return
        }

        // Update session state
        const sessionState = sessionStates.get(sessionId)
        if (sessionState) {
          sessionState.timerDuration = timerDuration
        }

        // Update session in database
        await prisma.quizSession.update({
          where: { id: sessionId },
          data: { timerDuration },
        })

        // Notify all participants
        io.to(sessionId).emit("timer-updated", { timerDuration })
      } catch (error) {
        console.error("Error updating timer:", error)
        socket.emit("error", { message: "Failed to update timer" })
      }
    })

    // Start correction round
    socket.on("start-correction", async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data

        // Check if user is the host
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can start correction" })
          return
        }

        // Update session state
        const sessionState = sessionStates.get(sessionId)
        if (sessionState) {
          sessionState.status = "correction"
          sessionState.questionStartTime = null // Clear timer
          sessionState.timerPaused = false
          sessionState.pausedRemaining = null

          // Update session in database
          await prisma.quizSession.update({
            where: { id: sessionId },
            data: { status: "CORRECTION" },
          })

          // Notify all participants
          io.to(sessionId).emit("correction-started", {})
        }
      } catch (error) {
        console.error("Error starting correction:", error)
        socket.emit("error", { message: "Failed to start correction" })
      }
    })

    // Select question for correction
    socket.on("select-correction-question", async (data: { sessionId: string; questionId: string }) => {
      try {
        const { sessionId, questionId } = data

        // Check if user is the host
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can select correction questions" })
          return
        }

        const sessionState = sessionStates.get(sessionId)
        if (!sessionState || sessionState.status !== "correction") {
          socket.emit("error", { message: "Session is not in correction mode" })
          return
        }

        // Get question details
        if (questionId == null) {
          // If questionId is null, reset current question
          sessionState.currentQuestion = null
          io.to(sessionId).emit("correction-question-selected", { question: null, answers: [] })
          return
        }

        const question = await prisma.question.findUnique({
          where: { id: questionId },
          select: {
            id: true,
            text: true,
            imageUrl: true,
            type: true,
            options: true,
            correctAnswer: true,
          },
        })

        if (!question) {
          socket.emit("error", { message: "Question not found" })
          return
        }

        // Get all answers for this question
        const answers = await prisma.playerAnswer.findMany({
          where: {
            sessionId,
            questionId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        })

        // Update session state
        sessionState.currentQuestion = question

        // Update session in database
        await prisma.quizSession.update({
          where: { id: sessionId },
          data: {
            currentQuestionId: questionId,
          },
        })

        // Notify all participants about the selected question
        io.to(sessionId).emit("correction-question-selected", {
          question,
          answers: answers.map((answer) => ({
            id: answer.id,
            userId: answer.userId,
            userName: answer.user.name,
            userImage: answer.user.image,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            points: answer.points,
          })),
        })
      } catch (error) {
        console.error("Error selecting correction question:", error)
        socket.emit("error", { message: "Failed to select correction question" })
      }
    })

    // Show specific answer during correction
    socket.on("show-correction-answer", async (data: { sessionId: string; answerId: string }) => {
      try {
        const { sessionId, answerId } = data

        // Check if user is the host
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can show answers" })
          return
        }

        // Get the answer details
        const answer = await prisma.playerAnswer.findUnique({
          where: { id: answerId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        })
        if (!answer) {
          socket.emit("error", { message: "Answer not found" })
          return
        }

        const sessionState = sessionStates.get(sessionId)
        if (!sessionState || sessionState.status !== "correction") {
          socket.emit("error", { message: "Session is not in correction mode" })
          return
        }

        sessionState.currentShownAnswer = {
          id: answer.id,
          userId: answer.userId,
          userName: answer.user.name || "Anonymous",
          userImage: answer.user.image || "",
          answer: answer.answer,
          isCorrect: answer.isCorrect,
          points: answer.points,
        }

        if (!answer) {
          socket.emit("error", { message: "Answer not found" })
          return
        }

        // Notify all participants about the shown answer
        io.to(sessionId).emit("correction-answer-shown", {
          answer: sessionState.currentShownAnswer,
        })
      } catch (error) {
        console.error("Error showing correction answer:", error)
        socket.emit("error", { message: "Failed to show answer" })
      }
    })

    // Grade answer (update the existing event)
    socket.on(
      "grade-answer",
      async (data: {
        sessionId: string
        answerId: string
        isCorrect: boolean
        points: number
      }) => {
        try {
          const { sessionId, answerId, isCorrect, points } = data

          // Check if user is the host
          const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            select: { hostId: true },
          })

          if (!session || session.hostId !== userId) {
            socket.emit("error", { message: "Only the host can grade answers" })
            return
          }

          // Update the answer in the database
          const updatedAnswer = await prisma.playerAnswer.update({
            where: { id: answerId },
            data: {
              isCorrect,
              points,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          })

          // Update participant's score
          const participation = await prisma.participation.findUnique({
            where: {
              sessionId_userId: {
                sessionId,
                userId: updatedAnswer.userId,
              },
            },
          })

          if (participation) {
            // Get total points from all answers
            const totalPoints = await prisma.playerAnswer.aggregate({
              where: {
                participationId: participation.id,
              },
              _sum: {
                points: true,
              },
            })

            // Update participation score
            await prisma.participation.update({
              where: {
                id: participation.id,
              },
              data: {
                score: totalPoints._sum.points || 0,
              },
            })
          }

          // Notify all participants about the grading
          io.to(sessionId).emit("answer-graded", {
            answer: {
              id: updatedAnswer.id,
              userId: updatedAnswer.userId,
              userName: updatedAnswer.user.name,
              userImage: updatedAnswer.user.image,
              answer: updatedAnswer.answer,
              isCorrect: updatedAnswer.isCorrect,
              points: updatedAnswer.points,
            },
          })
        } catch (error) {
          console.error("Error grading answer:", error)
          socket.emit("error", { message: "Failed to grade answer" })
        }
      },
    )

    // Check if correction is complete
    socket.on("check-correction-complete", async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data

        // Check if user is the host
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can check correction status" })
          return
        }

        // Check if all answers have been graded
        const ungradedAnswers = await prisma.playerAnswer.count({
          where: {
            sessionId,
            isCorrect: null,
          },
        })

        if (ungradedAnswers === 0) {
          // All answers are graded, end the session automatically
          const sessionState = sessionStates.get(sessionId)
          if (sessionState) {
            sessionState.status = "completed"
            sessionState.questionStartTime = null // Clear timer

            // Update session in database
            await prisma.quizSession.update({
              where: { id: sessionId },
              data: {
                status: "COMPLETED",
                endedAt: new Date(),
              },
            })

            // Get final leaderboard
            const leaderboard = await prisma.participation.findMany({
              where: { sessionId },
              orderBy: { score: "desc" },
              select: {
                userId: true,
                score: true,
                user: {
                  select: {
                    name: true,
                    image: true,
                  },
                },
              },
            })

            const leaderboard_state: Array<{
              userId: string
              name: string | null
              image?: string | null
              score: number
            }> = []

            leaderboard.forEach((entry) => {
              if (session.hostId !== entry.userId) {
                leaderboard_state!.push({
                  userId: entry.userId,
                  name: entry.user.name,
                  image: entry.user.image,
                  score: entry.score,
                })
              }
            })

            sessionState.leaderboard = leaderboard_state

            // Get quizId
            const quiz = await prisma.quizSession.findUnique({
              where: { id: sessionId },
              select: { quizId: true },
            })

            // compute the questions and their responses
            const questions = await prisma.question.findMany({
              where: { quizId: quiz?.quizId },
              select: {
                id: true,
                text: true,
                imageUrl: true,
                type: true,
                options: true,
                correctAnswer: true,
                answers: {
                  select: {
                    userId: true,
                    answer: true,
                    isCorrect: true,
                  },
                  where: {
                    sessionId,
                  },
                },
              },
            })

            sessionState.questions = questions
              .map((question) => {
                if (question.answers.length !== 0) {
                  return {
                    id: question.id,
                    text: question.text,
                    imageUrl: question.imageUrl || null,
                    type: question.type,
                    options: (question.type === "MULTIPLE_CHOICE" || question.type === "DRAG_TO_ORDER") ? question.options : undefined,
                    correctAnswer: question.correctAnswer || null,
                    response: question.answers.reduce(
                      (acc: Record<string, { answer: string; isCorrect?: boolean | null }>, answer) => {
                        acc[answer.userId] = {
                          answer: answer.answer,
                          isCorrect: answer.isCorrect,
                        }
                        return acc
                      },
                      {},
                    ),
                  }
                }
                return undefined
              })
              .filter((question): question is NonNullable<typeof question> => question !== undefined)

            // Notify all participants
            io.to(sessionId).emit("session-ended", {
              leaderboard: leaderboard_state,
              questions: sessionState.questions,
            })

            // Clean up session state after some time
            setTimeout(() => {
              sessionStates.delete(sessionId)
            }, 3600000) // 1 hour
          }
        }
      } catch (error) {
        console.error("Error checking correction completion:", error)
        socket.emit("error", { message: "Failed to check correction status" })
      }
    })

    // End session
    socket.on("end-session", async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data

        // Check if user is the host
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          select: { hostId: true },
        })

        if (!session || session.hostId !== userId) {
          socket.emit("error", { message: "Only the host can end the session" })
          return
        }

        // Update session state
        const sessionState = sessionStates.get(sessionId)
        if (sessionState) {
          sessionState.status = "completed"
          sessionState.questionStartTime = null // Clear timer
          sessionState.timerPaused = false
          sessionState.pausedRemaining = null
          sessionState.timerPaused = false
          sessionState.pausedRemaining = null

          // Update session in database
          await prisma.quizSession.update({
            where: { id: sessionId },
            data: {
              status: "COMPLETED",
              endedAt: new Date(),
            },
          })

          // Get final leaderboard
          const leaderboard = await prisma.participation.findMany({
            where: { sessionId },
            orderBy: { score: "desc" },
            select: {
              userId: true,
              score: true,
              user: {
                select: {
                  name: true,
                  image: true,
                },
              },
            },
          })

          const leaderboard_state: Array<{
            userId: string
            name: string | null
            image?: string | null
            score: number
          }> = []

          leaderboard.forEach((entry) => {
            if (session.hostId !== entry.userId) {
              leaderboard_state!.push({
                userId: entry.userId,
                name: entry.user.name,
                image: entry.user.image,
                score: entry.score,
              })
            }
          })

          // Get quizId
          const quiz = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            select: { quizId: true },
          })

          // compute the questions and their responses
          const questions = await prisma.question.findMany({
            where: { quizId: quiz?.quizId },
            select: {
              id: true,
              text: true,
              imageUrl: true,
              type: true,
              options: true,
              correctAnswer: true,
              answers: {
                select: {
                  userId: true,
                  answer: true,
                  isCorrect: true,
                },
                where: {
                  sessionId,
                },
              },
            },
          })

          sessionState.questions = questions
            .map((question) => {
              if (question.answers.length !== 0) {
                return {
                  id: question.id,
                  text: question.text,
                  imageUrl: question.imageUrl || null,
                  type: question.type,
                  options: (question.type === "MULTIPLE_CHOICE" || question.type === "DRAG_TO_ORDER") ? question.options : undefined,
                  correctAnswer: question.correctAnswer || null,
                  response: question.answers.reduce(
                    (acc: Record<string, { answer: string; isCorrect?: boolean | null }>, answer) => {
                      acc[answer.userId] = {
                        answer: answer.answer,
                        isCorrect: answer.isCorrect,
                      }
                      return acc
                    },
                    {},
                  ),
                }
              }
              return undefined
            })
            .filter((question): question is NonNullable<typeof question> => question !== undefined)

          // Notify all participants
          io.to(sessionId).emit("session-ended", {
            leaderboard: leaderboard_state,
            questions: sessionState.questions,
          })

          // Clean up session state after some time
          setTimeout(() => {
            sessionStates.delete(sessionId)
          }, 3600000) // 1 hour
        }
      } catch (error) {
        console.error("Error ending session:", error)
        socket.emit("error", { message: "Failed to end session" })
      }
    })

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId}`)
    })
  })
}
