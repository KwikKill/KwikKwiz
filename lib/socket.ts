import type { Server } from "node:http"

import { Server as IOServer } from "socket.io"
import { prisma } from "@/lib/prisma"

export type SessionState = {
  sessionId: string
  currentQuestion: any | null
  participants: Map<string, { id: string; name: string; image: string }>
  answers: Map<string, Map<string, { answer: string; submittedAt: Date }>>
  status: "waiting" | "active" | "correction" | "completed"
}

export const sessionStates = new Map<string, SessionState>()

export function initSocketServer(server: Server) {
  const io = new IOServer(server)

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
            })
          })

          sessionStates.set(sessionId, {
            sessionId,
            currentQuestion: null,
            participants,
            answers: new Map(),
            status: session.status.toLowerCase() as "waiting" | "active" | "correction" | "completed",
          })
        }

        const sessionState = sessionStates.get(sessionId)!

        console.log(`User ${userId} joined session ${sessionId}`)
        console.log("Participants :", sessionState.participants)

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
            })
          }

          // Notify others that a new participant joined
          socket.to(sessionId).emit("participant-joined", {
            participant: sessionState.participants.get(userId),
          })
        }

        // Send session state to the client
        socket.emit("session-state", {
          sessionId,
          status: sessionState.status,
          currentQuestion: sessionState.currentQuestion,
          participants: Array.from(sessionState.participants.values()),
        })
      } catch (error) {
        console.error("Error joining session:", error)
        socket.emit("error", { message: "Failed to join session" })
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

            // Update session in database
            await prisma.quizSession.update({
              where: { id: sessionId },
              data: {
                status: "ACTIVE",
                currentQuestionId: questionId,
                startedAt: { set: new Date() },
              },
            })

            // Broadcast the question to all participants
            io.to(sessionId).emit("new-question", {
              question: {
                id: question.id,
                text: question.text,
                imageUrl: question.imageUrl,
                type: question.type,
                options: question.type === "MULTIPLE_CHOICE" ? question.options : undefined,
              },
            })
          } else if (sessionState.status === "correction") {
            // If in correction mode, just update the current question
            sessionState.currentQuestion = question

            // Update session in database
            await prisma.quizSession.update({
              where: { id: sessionId },
              data: {
                currentQuestionId: questionId,
              }
            })

            // Notify all participants about the selected question
            io.to(sessionId).emit("correction-question-selected", {
              question: {
                id: question.id,
                text: question.text,
                imageUrl: question.imageUrl,
                type: question.type,
                options: question.type === "MULTIPLE_CHOICE" ? question.options : undefined,
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

        // Notify host
        socket.to(sessionId).emit("participant-answered", {
          participantId: userId,
          participantName: sessionState.participants.get(userId)?.name,
          questionId,
        })
      } catch (error) {
        console.error("Error submitting answer:", error)
        socket.emit("error", { message: "Failed to submit answer" })
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
          }
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

        // Notify all participants about the shown answer
        io.to(sessionId).emit("correction-answer-shown", {
          answer: {
            id: answer.id,
            userId: answer.userId,
            userName: answer.user.name,
            userImage: answer.user.image,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            points: answer.points,
          },
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

            // Notify all participants
            io.to(sessionId).emit("session-ended", {
              leaderboard: leaderboard.map((entry) => ({
                userId: entry.userId,
                name: entry.user.name,
                image: entry.user.image,
                score: entry.score,
              })),
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

          // Notify all participants
          io.to(sessionId).emit("session-ended", {
            leaderboard: leaderboard.map((entry) => ({
              userId: entry.userId,
              name: entry.user.name,
              image: entry.user.image,
              score: entry.score,
            })),
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
