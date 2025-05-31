'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Clock, Users, Trophy } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface Quiz {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  questionsCount: number;
}

interface Session {
  id: string;
  code: string;
  quizName: string;
  status: string;
  startedAt: string | null;
  participantsCount: number;
  hostId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);


  const joinSession = async (code: string) => {
    try {
      const response = await fetch(`/api/sessions/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join session");
      }

      // Redirect to the session page
      router.push(`/session/${data.sessionId}`);
    } catch (error) {
      toast({
        title: "Error joining session",
        description: error instanceof Error ? error.message : "Failed to join session",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      // Fetch recent quizzes
      fetch("/api/quizzes/recent")
        .then((res) => res.json())
        .then((data) => {
          setRecentQuizzes(data);
        })
        .catch((error) => console.error("Failed to fetch recent quizzes:", error));

      // Fetch active sessions
      fetch("/api/sessions/active")
        .then((res) => res.json())
        .then((data) => {
          setActiveSessions(data);
        })
        .catch((error) => console.error("Failed to fetch active sessions:", error))
        .finally(() => setIsLoading(false));
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session?.user?.name || "User"}!
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSessions.length}</div>
              <p className="text-xs text-muted-foreground">
                Live quiz sessions you can join
              </p>
            </CardContent>
          </Card>
          {session?.user?.isAdmin && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Your Quizzes</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{recentQuizzes.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Quizzes you've created
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                  <p className="text-xs text-muted-foreground">
                    People who've joined your quizzes
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                  <p className="text-xs text-muted-foreground">
                    Best performance in your quizzes
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Tabs defaultValue="active-sessions" className="space-y-4">
          {session?.user?.isAdmin && (
            <TabsList>
              <TabsTrigger value="active-sessions">Active Sessions</TabsTrigger>
              <TabsTrigger value="your-quizzes">Your Quizzes</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="active-sessions" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                <p>Loading sessions...</p>
              ) : activeSessions.length > 0 ? (
                activeSessions.map((_session) => (
                  <Card key={_session.id} className="overflow-hidden">
                    <CardHeader>
                      <CardTitle>{_session.quizName}</CardTitle>
                      <CardDescription>
                        Session Code: <span className="font-mono">{_session.code}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4" />
                        <span>{_session.participantsCount} participants</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {_session.startedAt
                            ? `Started ${format(new Date(_session.startedAt), "PPp")}`
                            : "Not started yet"}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {_session.hostId === session?.user?.userId ? (
                      <Link href={`/admin/sessions/${_session.id}/host`} className="w-full">
                        <Button className="w-full">Host Session</Button>
                      </Link>
                      ) : (
                      <Button className="w-full" onClick={() => joinSession(_session.code)}>
                        Join Session
                      </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-10">
                  <p className="text-muted-foreground">No active sessions found.</p>
                  <p className="mt-2">
                    <Link href="/quiz/join">
                      <Button variant="outline" className="mt-2">
                        Join a Session with Code
                      </Button>
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
          {session?.user?.isAdmin && (
            <TabsContent value="your-quizzes" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Your Quizzes</h2>
                <Link href="/admin/quizzes/new">
                  <Button>Create New Quiz</Button>
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  <p>Loading quizzes...</p>
                ) : recentQuizzes.length > 0 ? (
                  recentQuizzes.map((quiz) => (
                    <Card key={quiz.id}>
                      <CardHeader>
                        <CardTitle>{quiz.name}</CardTitle>
                        <CardDescription>
                          {quiz.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>Created {format(new Date(quiz.createdAt), "PPp")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm mt-2">
                          <Sparkles className="h-4 w-4" />
                          <span>{quiz.questionsCount} questions</span>
                        </div>
                      </CardContent>
                      <CardFooter className="flex gap-2">
                        <Link href={`/admin/quizzes/${quiz.id}`} className="flex-1">
                          <Button variant="outline" className="w-full">
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/admin/sessions/new?quizId=${quiz.id}`} className="flex-1">
                          <Button className="w-full">Start Session</Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-10">
                    <p className="text-muted-foreground">You haven't created any quizzes yet.</p>
                    <Link href="/admin/quizzes/new">
                      <Button className="mt-2">Create Your First Quiz</Button>
                    </Link>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
