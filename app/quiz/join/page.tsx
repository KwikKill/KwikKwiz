'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function JoinQuizPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionCode.trim()) {
      toast({
        title: "Session code required",
        description: "Please enter a valid session code",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/sessions/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: sessionCode.trim() }),
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
  };

  return (
    <div className="container py-10 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Join a Quiz Session</CardTitle>
          <CardDescription>
            Enter the session code provided by the quiz host
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleJoinSession}>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Input
                  id="session-code"
                  placeholder="Enter session code"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value)}
                  className="text-center uppercase tracking-widest text-xl font-mono"
                  maxLength={6}
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Joining...
                </>
              ) : (
                "Join Quiz"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}