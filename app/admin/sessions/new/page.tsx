'use client';

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";

interface Quiz {
  id: string;
  name: string;
  description: string | null;
}

function CreateSessionContent() {
  const { data: session } = useSession();
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const preselectedQuizId = searchParams.get('quizId');

  useEffect(() => {
    if (session?.user?.id) {
      // Fetch user's quizzes
      fetch("/api/quizzes")
        .then((res) => res.json())
        .then((data) => {
          setQuizzes(data);

          // Preselect quiz if ID is provided in URL
          if (preselectedQuizId && data.some((quiz: Quiz) => quiz.id === preselectedQuizId)) {
            setSelectedQuizId(preselectedQuizId);
          }

          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch quizzes:", error);
          setIsLoading(false);
        });
    }
  }, [session, preselectedQuizId]);

  const handleCreateSession = async () => {
    if (!selectedQuizId) {
      toast({
        title: "Quiz selection required",
        description: "Please select a quiz for the session",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: selectedQuizId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      toast({
        title: "Session created successfully",
        description: `Session code: ${data.code}`,
      });

      // Redirect to the session host page
      router.push(`/admin/sessions/${data.id}/host`);
    } catch (error) {
      toast({
        title: "Error creating session",
        description: error instanceof Error ? error.message : "Failed to create session",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user is admin
  if (session && !session.user?.isAdmin) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to create quiz sessions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create a New Quiz Session</CardTitle>
          <CardDescription>
            Select a quiz to start a new session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="quiz-select" className="text-sm font-medium">
                Select Quiz
              </label>
              {isLoading ? (
                <div className="h-10 bg-muted animate-pulse rounded-md"></div>
              ) : (
                <Select
                  value={selectedQuizId}
                  onValueChange={setSelectedQuizId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="quiz-select">
                    <SelectValue placeholder="Select a quiz" />
                  </SelectTrigger>
                  <SelectContent>
                    {quizzes.length > 0 ? (
                      quizzes.map((quiz) => (
                        <SelectItem key={quiz.id} value={quiz.id}>
                          {quiz.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-quizzes" disabled>
                        No quizzes available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedQuizId && quizzes.length > 0 && (
              <div className="bg-muted p-4 rounded-md">
                <h3 className="text-sm font-medium mb-1">Quiz Details</h3>
                <p className="text-sm text-muted-foreground">
                  {quizzes.find(q => q.id === selectedQuizId)?.description || "No description provided"}
                </p>
              </div>
            )}

            {quizzes.length === 0 && !isLoading && (
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground text-center">
                  You haven't created any quizzes yet.
                </p>
                <Button
                  variant="link"
                  className="w-full mt-2"
                  onClick={() => router.push('/admin/quizzes/new')}
                >
                  Create a quiz first
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleCreateSession}
            className="w-full"
            disabled={isSubmitting || !selectedQuizId}
          >
            {isSubmitting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                Creating...
              </>
            ) : (
              "Create Session"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function CreateSessionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateSessionContent />
    </Suspense>
  );
}
