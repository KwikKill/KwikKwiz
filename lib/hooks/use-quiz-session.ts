'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/components/socket-provider';
import { useToast } from '@/hooks/use-toast';

type Participant = {
  id: string;
  name: string;
  image: string;
};

type Question = {
  id: string;
  text: string;
  imageUrl?: string;
  type: 'MULTIPLE_CHOICE' | 'FREE_ANSWER';
  options?: string[];
};

type Answer = {
  userId: string;
  questionId: string;
  answer: string;
  isCorrect?: boolean;
  points?: number;
};

type LeaderboardEntry = {
  userId: string;
  name: string;
  image?: string;
  score: number;
};

type SessionStatus = 'waiting' | 'active' | 'correction' | 'completed';

export function useQuizSession(sessionId: string, isHost: boolean = false) {
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();

  const [status, setStatus] = useState<SessionStatus>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const joinSession = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('join-session', sessionId);
    }
  }, [socket, isConnected, sessionId]);

  const selectQuestion = useCallback((questionId: string) => {
    if (socket && isConnected && isHost) {
      socket.emit('select-question', { sessionId, questionId });
    }
  }, [socket, isConnected, sessionId, isHost]);

  const submitAnswer = useCallback((questionId: string, answer: string) => {
    if (socket && isConnected && !isHost) {
      socket.emit('submit-answer', { sessionId, questionId, answer });
      setUserAnswer(answer);
      setHasSubmitted(true);
    }
  }, [socket, isConnected, sessionId, isHost]);

  const startCorrection = useCallback(() => {
    if (socket && isConnected && isHost) {
      socket.emit('start-correction', { sessionId });
    }
  }, [socket, isConnected, sessionId, isHost]);

  const gradeAnswer = useCallback((questionId: string, userId: string, isCorrect: boolean, points: number) => {
    if (socket && isConnected && isHost) {
      socket.emit('grade-answer', { sessionId, questionId, userId, isCorrect, points });
    }
  }, [socket, isConnected, sessionId, isHost]);

  const endSession = useCallback(() => {
    if (socket && isConnected && isHost) {
      socket.emit('end-session', { sessionId });
    }
  }, [socket, isConnected, sessionId, isHost]);

  useEffect(() => {
    if (!isHost) {
      joinSession();
    }
  }, [joinSession, isHost]);

  useEffect(() => {
    if (!socket) return;

    const handleSessionState = (data: any) => {
      setStatus(data.status);
      setCurrentQuestion(data.currentQuestion);
      setParticipants(Array.isArray(data.participants) ? data.participants : []);
    };

    const handleNewQuestion = (data: any) => {
      setCurrentQuestion(data.question);
      setUserAnswer(null);
      setHasSubmitted(false);
    };

    const handleParticipantJoined = (data: any) => {
      if (data.participant) {
        setParticipants(prev => [...prev, data.participant]);
      }
    };

    const handleAnswerReceived = () => {
      toast({
        title: "Answer submitted",
        description: "Your answer has been received",
      });
    };

    const handleParticipantAnswered = (data: any) => {
      if (isHost) {
        toast({
          title: "New answer",
          description: `${data.participantName || 'A participant'} submitted an answer`,
        });

        // Update answers list for the host
        setAnswers(prev => {
          const exists = prev.some(a => a.userId === data.participantId && a.questionId === data.questionId);
          if (exists) return prev;

          return [...prev, {
            userId: data.participantId,
            questionId: data.questionId,
            answer: '(hidden until correction)',
          }];
        });
      }
    };

    const handleCorrectionStarted = () => {
      setStatus('correction');
      toast({
        title: "Correction round started",
        description: isHost
          ? "You can now review and grade all answers"
          : "The host is now reviewing all answers",
      });
    };

    const handleAnswerGraded = (data: any) => {
      setAnswers(prev =>
        prev.map(answer => {
          if (answer.userId === data.userId && answer.questionId === data.questionId) {
            return {
              ...answer,
              isCorrect: data.isCorrect,
              points: data.points,
            };
          }
          return answer;
        })
      );
    };

    const handleSessionEnded = (data: any) => {
      setStatus('completed');
      setLeaderboard(data.leaderboard);
      toast({
        title: "Session ended",
        description: "The quiz session has ended",
      });
    };

    const handleError = (data: any) => {
      toast({
        title: "Error",
        description: data.message,
        variant: "destructive",
      });
    };

    socket.on('session-state', handleSessionState);
    socket.on('new-question', handleNewQuestion);
    socket.on('participant-joined', handleParticipantJoined);
    socket.on('answer-received', handleAnswerReceived);
    socket.on('participant-answered', handleParticipantAnswered);
    socket.on('correction-started', handleCorrectionStarted);
    socket.on('answer-graded', handleAnswerGraded);
    socket.on('session-ended', handleSessionEnded);
    socket.on('error', handleError);

    return () => {
      socket.off('session-state', handleSessionState);
      socket.off('new-question', handleNewQuestion);
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('answer-received', handleAnswerReceived);
      socket.off('participant-answered', handleParticipantAnswered);
      socket.off('correction-started', handleCorrectionStarted);
      socket.off('answer-graded', handleAnswerGraded);
      socket.off('session-ended', handleSessionEnded);
      socket.off('error', handleError);
    };
  }, [socket, toast, isHost]);

  return {
    status,
    currentQuestion,
    participants,
    answers,
    userAnswer,
    hasSubmitted,
    leaderboard,
    isConnected,
    joinSession,
    selectQuestion,
    submitAnswer,
    startCorrection,
    gradeAnswer,
    endSession,
  };
}
