'use client';

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DiscIcon as Discord } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    try {
      const result = await signIn("dev-login", {
        username: username.trim(),
        isAdmin: isAdmin.toString(),
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result?.ok) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Development login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-muted to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Bienvenue au KwikKiz</CardTitle>
          <CardDescription>
            Connectez-vous pour participer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4">
          {isDevelopment && (
            <>
              <form onSubmit={handleDevLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username (Development)</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter any username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="admin"
                    checked={isAdmin}
                    onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="admin">Login as admin</Label>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!username.trim() || isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign in (Dev)"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
            </>
          )}

          <Button
            onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
            className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white"
          >
            <Discord className="mr-2 h-4 w-4" />
            Sign in with Discord
          </Button>

          {isDevelopment && (
            <p className="text-xs text-muted-foreground text-center">
              Development mode: You can use the simple login above or Discord OAuth
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
