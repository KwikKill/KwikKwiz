import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const quizId = resolvedParams.id;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Check if user is the author or an admin
    if (quiz.authorId !== session.user.id && !session.user.isAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to access this quiz" },
        { status: 403 }
      );
    }

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return NextResponse.json(
      { error: "Failed to fetch quiz details" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const quizId = resolvedParams.id;
    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Quiz name is required" },
        { status: 400 }
      );
    }

    // Check if quiz exists and user is the author
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    if (quiz.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to update this quiz" },
        { status: 403 }
      );
    }

    // Update quiz
    const updatedQuiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(updatedQuiz);
  } catch (error) {
    console.error("Error updating quiz:", error);
    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const quizId = resolvedParams.id;

    // Check if quiz exists and user is the author
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    if (quiz.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this quiz" },
        { status: 403 }
      );
    }

    // Check if quiz has active sessions
    const activeSessions = await prisma.quizSession.findMany({
      where: {
        quizId,
        status: {
          in: ["WAITING", "ACTIVE", "CORRECTION"],
        },
      },
    });

    if (activeSessions.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete quiz with active sessions" },
        { status: 400 }
      );
    }

    // Delete quiz and all related questions
    await prisma.quiz.delete({
      where: { id: quizId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    );
  }
}
