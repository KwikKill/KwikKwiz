import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const { questions } = await request.json();

    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { error: "Invalid question order data" },
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

    if (quiz.authorId !== session.user.userId) {
      return NextResponse.json(
        { error: "You don't have permission to reorder questions in this quiz" },
        { status: 403 }
      );
    }

    // Update question order
    for (const question of questions) {
      await prisma.question.update({
        where: {
          id: question.id,
          quizId,
        },
        data: {
          order: question.order,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering questions:", error);
    return NextResponse.json(
      { error: "Failed to reorder questions" },
      { status: 500 }
    );
  }
}
