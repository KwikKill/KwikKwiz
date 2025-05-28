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
    // Get quizzes created by the user
    const quizzes = await prisma.quiz.findMany({
      where: {
        authorId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
      take: 10,
    });
    
    // Transform the data for the frontend
    const formattedQuizzes = quizzes.map((quiz) => ({
      id: quiz.id,
      name: quiz.name,
      description: quiz.description,
      createdAt: quiz.createdAt.toISOString(),
      questionsCount: quiz._count.questions,
    }));
    
    return NextResponse.json(formattedQuizzes);
  } catch (error) {
    console.error("Error fetching recent quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent quizzes" },
      { status: 500 }
    );
  }
}