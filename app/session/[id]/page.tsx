'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuizSession } from '@/lib/hooks/use-quiz-session';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users, Trophy, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function SessionPage({ params }: { params: { id: string } }) {
  const sessionId = params.id;
  const router = useRouter();
  const { data: authSession, status: authStatus } = useSession();
  const [isHost, setIsHost] = useState(false);
  const [quizDetails, setQuizDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
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
  } = useQuizSession(sessionId, isHost);

  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [correctionFilter, setCorrectionFilter] = useState('all');

  useEffect(() => {
    if (authStatus === 'authenticated' && authSession?.user) {
      // Fetch session details
      fetch(`/api/sessions/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setQuizDetails(data);
          setIsHost(data.hostId === authSession.user?.id);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching session details:', error);
          setIsLoading(false);
        });
    }
  }, [sessionId, authSession, authStatus]);

  useEffect(() => {
    if (isConnected) {
      joinSession();
    }
  }, [isConnected, joinSession]);

  if (authStatus === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!quizDetails) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>This quiz session may have ended or doesn't exist.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Render different views based on session status
  const renderSessionContent = () => {
    switch (status) {
      case 'waiting':
        return renderWaitingRoom();
      case 'active':
        return renderActiveSession();
      case 'correction':
        return renderCorrectionPhase();
      case 'completed':
        return renderResults();
      default:
        return renderWaitingRoom();
    }
  };

  const renderWaitingRoom = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Waiting Room: {quizDetails.quiz.name}
          </CardTitle>
          <CardDescription>
            {isHost
              ? 'Your quiz session is ready. Participants can join using the code below.'
              : 'Waiting for the host to start the quiz...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-md text-center">
            <div className="text-sm font-medium text-muted-foreground">Session Code:</div>
            <div className="text-3xl font-bold tracking-widest">{quizDetails.code}</div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participants ({participants.length})
              </h3>
              <Badge variant="outline">{isConnected ? 'Connected' : 'Connecting...'}</Badge>
            </div>
            
            <div className="bg-card border rounded-md p-4 max-h-40 overflow-y-auto">
              {participants.length > 0 ? (
                <ul className="space-y-2">
                  {participants.map((participant) => (
                    <li key={participant.id} className="text-sm">
                      {participant.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center">No participants yet</p>
              )}
            </div>
          </div>
        </CardContent>
        {isHost && (
          <CardFooter>
            <Button 
              onClick={() => router.push(`/admin/sessions/${sessionId}/host`)}
              className="w-full"
            >
              Start Hosting
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );

  const renderActiveSession = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {currentQuestion ? (
        <Card className="border-primary/50">
          <CardHeader>
            <div className="flex justify-between items-center">
              <Badge variant="outline">{currentQuestion.type === 'MULTIPLE_CHOICE' ? 'Multiple Choice' : 'Free Answer'}</Badge>
              <Badge variant={isConnected ? 'outline' : 'destructive'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <CardTitle className="text-xl mt-2">{currentQuestion.text}</CardTitle>
          </CardHeader>
          
          {currentQuestion.imageUrl && (
            <div className="px-6">
              <div className="w-full h-48 md:h-64 bg-muted rounded-md flex items-center justify-center">
                <img 
                  src={currentQuestion.imageUrl} 
                  alt="Question" 
                  className="max-w-full max-h-full object-contain" 
                />
              </div>
            </div>
          )}
          
          <CardContent className="pt-6">
            {!isHost && (
              <>
                {currentQuestion.type === 'MULTIPLE_CHOICE' ? (
                  <RadioGroup 
                    value={selectedAnswer} 
                    onValueChange={setSelectedAnswer}
                    disabled={hasSubmitted}
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
                    disabled={hasSubmitted}
                    rows={4}
                  />
                )}
              </>
            )}
            
            {isHost && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-center text-muted-foreground">
                  {answers.filter(a => a.questionId === currentQuestion.id).length} of {participants.length} answers received
                </p>
                <Progress 
                  className="mt-2" 
                  value={(answers.filter(a => a.questionId === currentQuestion.id).length / participants.length) * 100} 
                />
              </div>
            )}
          </CardContent>
          
          <CardFooter>
            {!isHost && (
              <Button 
                onClick={() => submitAnswer(currentQuestion.id, selectedAnswer)}
                className="w-full"
                disabled={!selectedAnswer || hasSubmitted}
              >
                {hasSubmitted ? 'Answer Submitted' : 'Submit Answer'}
              </Button>
            )}
            
            {isHost && (
              <Button 
                onClick={startCorrection}
                className="w-full"
              >
                Start Correction Round
              </Button>
            )}
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for Question</CardTitle>
            <CardDescription>The host will select a question soon...</CardDescription>
          </CardHeader>
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Current Status</h3>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quiz:</span>
                <span>{quizDetails.quiz.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Participants:</span>
                <span>{participants.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="secondary">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Connected Users</h3>
          </CardHeader>
          <CardContent>
            <div className="text-sm max-h-24 overflow-y-auto">
              {participants.length > 0 ? (
                <ul className="space-y-1">
                  {participants.map((participant) => (
                    <li key={participant.id}>{participant.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No participants yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCorrectionPhase = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <Badge variant="secondary">Correction Phase</Badge>
            <Badge variant={isConnected ? 'outline' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <CardTitle className="mt-2">
            {isHost ? 'Review and Score Answers' : 'Waiting for Results'}
          </CardTitle>
          <CardDescription>
            {isHost 
              ? 'Review each answer and assign points based on correctness' 
              : 'The host is reviewing all answers and assigning points'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isHost && (
            <>
              <div className="flex gap-2 pb-2 border-b">
                <Button 
                  variant={correctionFilter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setCorrectionFilter('all')}
                >
                  All
                </Button>
                <Button 
                  variant={correctionFilter === 'pending' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setCorrectionFilter('pending')}
                >
                  Pending
                </Button>
                <Button 
                  variant={correctionFilter === 'graded' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setCorrectionFilter('graded')}
                >
                  Graded
                </Button>
              </div>
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {answers
                  .filter(answer => {
                    if (correctionFilter === 'pending') return answer.isCorrect === undefined;
                    if (correctionFilter === 'graded') return answer.isCorrect !== undefined;
                    return true;
                  })
                  .map((answer) => {
                    const participant = participants.find(p => p.id === answer.userId);
                    return (
                      <Card key={`${answer.userId}-${answer.questionId}`} className="border border-muted">
                        <CardHeader className="py-3 px-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium">{participant?.name || 'Unknown User'}</h4>
                            {answer.isCorrect !== undefined && (
                              <Badge variant={answer.isCorrect ? 'success' : 'destructive'}>
                                {answer.isCorrect ? 'Correct' : 'Incorrect'}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="py-2 px-4">
                          <p className="text-sm">{answer.answer}</p>
                        </CardContent>
                        {isHost && answer.isCorrect === undefined && (
                          <CardFooter className="pt-0 px-4 pb-3">
                            <div className="flex flex-col w-full gap-2">
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  className="flex-1 border-red-200 hover:bg-red-50"
                                  onClick={() => gradeAnswer(answer.questionId, answer.userId, false, 0)}
                                >
                                  <XCircle className="h-4 w-4 mr-1 text-red-500" />
                                  Incorrect (0 pts)
                                </Button>
                                <Button 
                                  variant="outline"
                                  className="flex-1 border-green-200 hover:bg-green-50"
                                  onClick={() => gradeAnswer(answer.questionId, answer.userId, true, 1)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                                  Correct (1 pt)
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => gradeAnswer(answer.questionId, answer.userId, true, 2)}
                                >
                                  2 pts
                                </Button>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => gradeAnswer(answer.questionId, answer.userId, true, 3)}
                                >
                                  3 pts
                                </Button>
                              </div>
                            </div>
                          </CardFooter>
                        )}
                      </Card>
                    );
                  })}
                
                {answers.length === 0 && (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">No answers to review</p>
                  </div>
                )}
              </div>
            </>
          )}
          
          {!isHost && (
            <div className="py-10 text-center">
              <div className="h-10 w-10 mx-auto mb-4 animate-bounce rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-muted-foreground">The host is reviewing all answers...</p>
              {userAnswer && (
                <div className="mt-4 p-4 bg-muted rounded-md max-w-md mx-auto">
                  <p className="text-sm font-medium">Your answer:</p>
                  <p className="mt-1">{userAnswer}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
        
        {isHost && (
          <CardFooter>
            <Button 
              onClick={endSession}
              className="w-full"
            >
              End Session & Show Results
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );

  const renderResults = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Quiz Results: {quizDetails.quiz.name}
          </CardTitle>
          <CardDescription>
            The quiz session has ended. Here are the final results.
          </CardDescription>
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
                            src={leaderboard[1].image} 
                            alt={leaderboard[1].name} 
                            className="w-14 h-14 rounded-full" 
                          />
                        ) : (
                          <span className="text-xl font-bold">2</span>
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
                            src={leaderboard[0].image} 
                            alt={leaderboard[0].name} 
                            className="w-18 h-18 rounded-full" 
                          />
                        ) : (
                          <span className="text-2xl font-bold text-primary-foreground">1</span>
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
                            src={leaderboard[2].image} 
                            alt={leaderboard[2].name} 
                            className="w-12 h-12 rounded-full" 
                          />
                        ) : (
                          <span className="text-lg font-bold">3</span>
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
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">No results available</p>
            </div>
          )}
        </CardContent>
        
        <CardFooter>
          <Button 
            onClick={() => router.push('/dashboard')}
            className="w-full"
          >
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  return (
    <div className="container py-10">
      {renderSessionContent()}
    </div>
  );
}