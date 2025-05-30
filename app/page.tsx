"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 py-4 md:px-6 md:py-4">
        <div className="flex items-center gap-2 font-bold text-2xl">
          <img src="/icon.png" alt="Logo" className="h-8 w-8" />
          <span>KwikKwiz</span>
        </div>
        <div className="flex items-center gap-4">
          {session ? (
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button>Se connecter</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                Kwiz de merde garantis - sauce KwikKill
              </h1>
              { /* TODO: Replace with a GIF for better effect */}
              <img
                src="/icon.png"
                alt="Logo"
                className="inline-block h-32 w-32 rounded-full"
                style={{ animation: "spin 50ms linear infinite, shadow-pulsate 2s infinite" }}
              />
              <p className="mx-auloginto max-w-[700px] text-muted-foreground md:text-xl">
                Attention, ce site ne fonctionne que sur invitation.
              </p>
            </div>
            <div className="space-x-4">
              {session ? (
                <Link href="/dashboard">
                  <Button size="lg" className="animate-pulse">
                  Let's gooooo 🚀
                  </Button>
                </Link>
              ) : (
                <Link href="/login">
                  <Button size="lg" className="animate-pulse">
                    Let's gooooo 🚀
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="w-full py-12 bg-muted flex flex-col items-center justify-center gap-4">
          <div
            className="mb-6 text-center text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl"
          >
            <Sparkles className="inline-block mr-2" />
            Koment ça marche ?
          </div>

          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div
                className="flex flex-row items-center justify-center text-center mb-4 gap-4"
              >
                <div className="text-4xl font-bold">🎮</div>
                <h3 className="text-xl font-bold">Connectez vous via discord</h3>
              </div>
              <p className="text-muted-foreground">Vous aurez besoin de vous connecter avec votre compte Discord pour participer.</p>
              <p className="text-muted-foreground">Seuls les comptes autorisés pourront participer.</p>
            </div>
            <div className="rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div
                className="flex flex-row items-center justify-center text-center mb-4 gap-4"
              >
                <div className="mb-4 text-4xl font-bold">📝</div>
                <h3 className="text-xl font-bold">Participez à mes Kwiz de merde</h3>
              </div>
              <p className="text-muted-foreground">Combien de terrains de foots entre Rennes et le Groenland ?</p>
              <p className="text-muted-foreground">Qui gagne entre deux chats ? Pourquoi ?</p>
            </div>
            <div className="rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div
                className="flex flex-row items-center justify-center text-center mb-4 gap-4"
              >
                <div className="mb-4 text-4xl font-bold">🏆</div>
                <h3 className="text-xl font-bold">Gagnez (mon respect)</h3>
              </div>
              <p className="text-muted-foreground">Bon, y'a pas grand chose à gagner mais c'est pour le fun.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 md:py-0">
        <div className="flex flex-col items-center justify-center gap-4 md:h-24 md:flex-row text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} KwikKwiz. All rights reserved - Made by KwikKill
          <img src="/icon.png" alt="Logo" className="h-6 w-6 ml-2 inline-block" />
        </div>
      </footer>
    </div>
  );
}
