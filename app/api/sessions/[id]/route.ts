import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sessionId = resolvedParams.id

    const quizSession = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          select: {
            id: true,
            name: true,
            description: true,
            questions: {
              orderBy: {
                order: "asc",
              },
              select: {
                id: true,
                text: true,
                imageUrl: true,
                type: true,
                options: true,
                order: true,
              },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    })

    if (!quizSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Check if user is a participant or host
    const isParticipant = quizSession.participants.some((p) => p.userId === session.user?.userId)
    const isHost = quizSession.hostId === session.user?.userId

    if (!isParticipant && !isHost) {
      // Add user as a participant
      await prisma.participation.create({
        data: {
          sessionId: quizSession.id,
          userId: session.user.userId,
        },
      })
    }

    return NextResponse.json(quizSession)
  } catch (error) {
    console.error("Error fetching session:", error)
    return NextResponse.json({ error: "Failed to fetch session details" }, { status: 404 })
  }
}
