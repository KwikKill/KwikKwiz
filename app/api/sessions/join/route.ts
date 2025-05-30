import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Session code is required" },
        { status: 400 }
      );
    }

    // Find the quiz session by code
    const quizSession = await prisma.quizSession.findUnique({
      where: {
        code: code.toUpperCase(),
      },
    });

    if (!quizSession) {
      return NextResponse.json(
        { error: "Invalid session code" },
        { status: 404 }
      );
    }

    if (quizSession.status === "COMPLETED") {
      return NextResponse.json(
        { error: "This session has already ended" },
        { status: 400 }
      );
    }

    // Check if user is already a participant
    const existingParticipation = await prisma.participation.findUnique({
      where: {
        sessionId_userId: {
          sessionId: quizSession.id,
          userId: session.user.userId,
        },
      },
    });

    if (!existingParticipation) {
      // Add user as a participant
      await prisma.participation.create({
        data: {
          sessionId: quizSession.id,
          userId: session.user.userId,
        },
      });
    }

    return NextResponse.json({ sessionId: quizSession.id });
  } catch (error) {
    console.error("Error joining session:", error);
    return NextResponse.json(
      { error: "Failed to join session" },
      { status: 500 }
    );
  }
}
