import { Server as HTTPServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { NextApiRequest } from 'next';
import { NextApiResponse } from 'next';
import { Server as NetServer } from 'net';
import { prisma } from '@/lib/prisma';

export type SessionState = {
  sessionId: string;
  currentQuestion: any | null;
  participants: Map<string, { id: string; name: string }>;
  answers: Map<string, Map<string, { answer: string; submittedAt: Date }>>;
  status: 'waiting' | 'active' | 'correction' | 'completed';
};

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: NetServer & {
    server?: HTTPServer;
  };
};

export const sessionStates = new Map<string, SessionState>();

export function initSocketServer(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      const userId = socket.handshake.auth.userId;
      
      if (!userId) {
        socket.disconnect();
        return;
      }

      console.log(`User connected: ${userId}`);

      // Join a session
      socket.on('join-session', async (sessionId: string) => {
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
                    },
                  },
                },
              },
            },
          });

          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          // Join the room
          socket.join(sessionId);

          // Initialize session state if not exists
          if (!sessionStates.has(sessionId)) {
            const participants = new Map();
            
            session.participants.forEach((participant) => {
              participants.set(participant.userId, {
                id: participant.userId,
                name: participant.user.name || 'Anonymous',
              });
            });

            sessionStates.set(sessionId, {
              sessionId,
              currentQuestion: null,
              participants,
              answers: new Map(),
              status: session.status.toLowerCase() as 'waiting' | 'active' | 'correction' | 'completed',
            });
          }

          const sessionState = sessionStates.get(sessionId)!;

          // Add participant if not already in the session
          if (!sessionState.participants.has(userId)) {
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, name: true },
            });

            if (user) {
              sessionState.participants.set(userId, {
                id: user.id,
                name: user.name || 'Anonymous',
              });
            }
          }

          // Send session state to the client
          socket.emit('session-state', {
            sessionId,
            status: sessionState.status,
            currentQuestion: sessionState.currentQuestion,
            participants: Array.from(sessionState.participants.values()),
          });

          // Notify others that a new participant joined
          socket.to(sessionId).emit('participant-joined', {
            participant: sessionState.participants.get(userId),
          });
        } catch (error) {
          console.error('Error joining session:', error);
          socket.emit('error', { message: 'Failed to join session' });
        }
      });

      // Host selects a question
      socket.on('select-question', async (data: { sessionId: string; questionId: string }) => {
        try {
          const { sessionId, questionId } = data;
          
          // Check if user is the host
          const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            select: { hostId: true },
          });

          if (!session || session.hostId !== userId) {
            socket.emit('error', { message: 'Only the host can select questions' });
            return;
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
          });

          if (!question) {
            socket.emit('error', { message: 'Question not found' });
            return;
          }

          // Update session state
          const sessionState = sessionStates.get(sessionId);
          if (sessionState) {
            sessionState.currentQuestion = question;
            sessionState.status = 'active';
            
            // Update session in database
            await prisma.quizSession.update({
              where: { id: sessionId },
              data: { 
                status: 'ACTIVE',
                currentQuestionId: questionId,
                startedAt: { set: new Date() },
              },
            });

            // Broadcast the question to all participants
            io.to(sessionId).emit('new-question', {
              question: {
                id: question.id,
                text: question.text,
                imageUrl: question.imageUrl,
                type: question.type,
                options: question.type === 'MULTIPLE_CHOICE' ? question.options : undefined,
              },
            });
          }
        } catch (error) {
          console.error('Error selecting question:', error);
          socket.emit('error', { message: 'Failed to select question' });
        }
      });

      // Submit answer
      socket.on('submit-answer', async (data: { sessionId: string; questionId: string; answer: string }) => {
        try {
          const { sessionId, questionId, answer } = data;
          
          const sessionState = sessionStates.get(sessionId);
          if (!sessionState || sessionState.status !== 'active') {
            socket.emit('error', { message: 'Cannot submit answer at this time' });
            return;
          }

          // Initialize answers map for this question if not exists
          if (!sessionState.answers.has(questionId)) {
            sessionState.answers.set(questionId, new Map());
          }

          const questionAnswers = sessionState.answers.get(questionId)!;
          
          // Store the answer
          questionAnswers.set(userId, {
            answer,
            submittedAt: new Date(),
          });

          // Save answer to database
          const participation = await prisma.participation.findUnique({
            where: {
              sessionId_userId: {
                sessionId,
                userId,
              },
            },
          });

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
            });
          }

          // Acknowledge receipt
          socket.emit('answer-received', { questionId });
          
          // Notify host
          socket.to(sessionId).emit('participant-answered', {
            participantId: userId,
            participantName: sessionState.participants.get(userId)?.name,
            questionId,
          });
        } catch (error) {
          console.error('Error submitting answer:', error);
          socket.emit('error', { message: 'Failed to submit answer' });
        }
      });

      // Start correction round
      socket.on('start-correction', async (data: { sessionId: string }) => {
        try {
          const { sessionId } = data;
          
          // Check if user is the host
          const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            select: { hostId: true },
          });

          if (!session || session.hostId !== userId) {
            socket.emit('error', { message: 'Only the host can start correction' });
            return;
          }

          // Update session state
          const sessionState = sessionStates.get(sessionId);
          if (sessionState) {
            sessionState.status = 'correction';
            
            // Update session in database
            await prisma.quizSession.update({
              where: { id: sessionId },
              data: { status: 'CORRECTION' },
            });

            // Notify all participants
            io.to(sessionId).emit('correction-started', {});
          }
        } catch (error) {
          console.error('Error starting correction:', error);
          socket.emit('error', { message: 'Failed to start correction' });
        }
      });

      // Grade answer
      socket.on('grade-answer', async (data: { 
        sessionId: string;
        questionId: string;
        userId: string;
        isCorrect: boolean;
        points: number;
      }) => {
        try {
          const { sessionId, questionId, userId: answeredUserId, isCorrect, points } = data;
          
          // Check if user is the host
          const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            select: { hostId: true },
          });

          if (!session || session.hostId !== userId) {
            socket.emit('error', { message: 'Only the host can grade answers' });
            return;
          }

          // Update the answer in the database
          await prisma.playerAnswer.update({
            where: {
              sessionId_questionId_userId: {
                sessionId,
                questionId,
                userId: answeredUserId,
              },
            },
            data: {
              isCorrect,
              points,
            },
          });

          // Update participant's score
          const participation = await prisma.participation.findUnique({
            where: {
              sessionId_userId: {
                sessionId,
                userId: answeredUserId,
              },
            },
          });

          if (participation) {
            // Get total points from all answers
            const totalPoints = await prisma.playerAnswer.aggregate({
              where: {
                participationId: participation.id,
              },
              _sum: {
                points: true,
              },
            });

            // Update participation score
            await prisma.participation.update({
              where: {
                id: participation.id,
              },
              data: {
                score: totalPoints._sum.points || 0,
              },
            });
          }

          // Notify all participants about the grading
          io.to(sessionId).emit('answer-graded', {
            userId: answeredUserId,
            questionId,
            isCorrect,
            points,
          });
        } catch (error) {
          console.error('Error grading answer:', error);
          socket.emit('error', { message: 'Failed to grade answer' });
        }
      });

      // End session
      socket.on('end-session', async (data: { sessionId: string }) => {
        try {
          const { sessionId } = data;
          
          // Check if user is the host
          const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            select: { hostId: true },
          });

          if (!session || session.hostId !== userId) {
            socket.emit('error', { message: 'Only the host can end the session' });
            return;
          }

          // Update session state
          const sessionState = sessionStates.get(sessionId);
          if (sessionState) {
            sessionState.status = 'completed';
            
            // Update session in database
            await prisma.quizSession.update({
              where: { id: sessionId },
              data: { 
                status: 'COMPLETED',
                endedAt: new Date(),
              },
            });

            // Get final leaderboard
            const leaderboard = await prisma.participation.findMany({
              where: { sessionId },
              orderBy: { score: 'desc' },
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
            });

            // Notify all participants
            io.to(sessionId).emit('session-ended', {
              leaderboard: leaderboard.map(entry => ({
                userId: entry.userId,
                name: entry.user.name,
                image: entry.user.image,
                score: entry.score,
              })),
            });

            // Clean up session state after some time
            setTimeout(() => {
              sessionStates.delete(sessionId);
            }, 3600000); // 1 hour
          }
        } catch (error) {
          console.error('Error ending session:', error);
          socket.emit('error', { message: 'Failed to end session' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${userId}`);
      });
    });
  }

  return res.socket.server.io;
}