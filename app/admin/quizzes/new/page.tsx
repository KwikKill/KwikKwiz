"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"

export default function CreateQuizPage() {
  const { data: session } = useSession()
  const [quizName, setQuizName] = useState("")
  const [quizDescription, setQuizDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!quizName.trim()) {
      toast({
        title: "Nom du kwiz requis",
        description: "Veuillez entrer un nom pour votre kwiz",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: quizName.trim(),
          description: quizDescription.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Échec de la création du kwiz")
      }

      toast({
        title: "Quiz créé avec succès",
        description: "Vous pouvez maintenant ajouter des questions à votre kwiz",
      })

      // Redirect to the quiz edit page
      router.push(`/admin/quizzes/${data.id}`)
    } catch (error) {
      toast({
        title: "Erreur lors de la création du kwiz",
        description: error instanceof Error ? error.message : "Échec de la création du kwiz",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if user is admin
  if (session && !session.user?.isAdmin) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>Vous n'avez pas la permission de créer des kwiz.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-10 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Créer un nouveau kwiz</CardTitle>
          <CardDescription>Configurez les informations de base de votre kwiz</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateQuiz}>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="quiz-name" className="text-sm font-medium">
                  Nom du kwiz
                </label>
                <Input
                  id="quiz-name"
                  placeholder="Entrez le nom du kwiz"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="quiz-description" className="text-sm font-medium">
                  Description (Optionnel)
                </label>
                <Textarea
                  id="quiz-description"
                  placeholder="Entrez une description pour votre kwiz"
                  rows={4}
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Création en cours...
                </>
              ) : (
                "Créer le kwiz"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
