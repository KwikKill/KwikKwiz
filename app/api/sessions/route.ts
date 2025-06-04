import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Function to generate a random 6-character code
function generateSessionCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Excludes similar-looking characters
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return code
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is an admin
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  try {
    const { quizId, name, description, sessionDate, timerDuration } = await request.json()

    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Session name is required" }, { status: 400 })
    }

    // Check if quiz exists and belongs to the user
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        authorId: session.user.userId,
      },
    })

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found or you don't have permission to use it" }, { status: 404 })
    }

    // Generate a unique session code
    let sessionCode
    let isCodeUnique = false

    while (!isCodeUnique) {
      sessionCode = generateSessionCode()

      // Check if code is already in use
      const existingSession = await prisma.quizSession.findUnique({
        where: { code: sessionCode },
      })

      if (!existingSession) {
        isCodeUnique = true
      }
    }

    // Prepare session data
    const sessionData: any = {
      quizId,
      hostId: session.user.userId,
      code: sessionCode!,
      name: name.trim(),
    }

    // Add optional fields if provided
    if (description && description.trim()) {
      sessionData.description = description.trim()
    }

    if (sessionDate) {
      sessionData.sessionDate = new Date(sessionDate)
    }

    if (timerDuration && Number.parseInt(timerDuration) > 0) {
      sessionData.timerDuration = Number.parseInt(timerDuration)
    }

    // Create new quiz session
    const quizSession = await prisma.quizSession.create({
      data: sessionData,
    })

    return NextResponse.json(quizSession)
  } catch (error) {
    console.error("Error creating session:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
