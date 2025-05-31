import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get active quiz sessions
    const activeSessions = await prisma.quizSession.findMany({
      where: {
        status: {
          in: ["WAITING", "ACTIVE"],
        },
      },
      include: {
        quiz: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform the data for the frontend
    const formattedSessions = activeSessions.map((session) => ({
      id: session.id,
      code: session.code,
      quizName: session.quiz.name,
      status: session.status,
      startedAt: session.startedAt?.toISOString() || null,
      participantsCount: session._count.participants,
      hostId: session.hostId,
    }));

    return NextResponse.json(formattedSessions);
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch active sessions" },
      { status: 500 }
    );
  }
}
