import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const activeSessions = await prisma.quizSession.findMany({
      where: {
        status: {
          in: ["WAITING", "ACTIVE", "CORRECTION"],
        },
      },
      include: {
        quiz: {
          select: {
            name: true,
          },
        },
        participants: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const formattedSessions = activeSessions.map((session) => ({
      id: session.id,
      code: session.code,
      name: session.name || session.quiz.name, // Use session name if available, fallback to quiz name
      quizName: session.quiz.name,
      description: session.description,
      sessionDate: session.sessionDate,
      status: session.status,
      startedAt: session.startedAt,
      participantsCount: session.participants.length,
      hostId: session.hostId,
      timerDuration: session.timerDuration,
    }))

    return NextResponse.json(formattedSessions)
  } catch (error) {
    console.error("Error fetching active sessions:", error)
    return NextResponse.json({ error: "Failed to fetch active sessions" }, { status: 500 })
  }
}
