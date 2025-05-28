'use client';

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Disc as Discord } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-muted to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Bienvenue au KwikKiz</CardTitle>
          <CardDescription>
            Connectez-vous avec discord pour participer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4">
          <Button
            onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
            className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white"
          >
            <Discord className="mr-2 h-4 w-4" />
            Sign in with Discord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}