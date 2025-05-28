import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const quizId = params.id;
    
    // Check if quiz exists and user has access
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });
    
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    
    // Allow access if user is author or it's a session participant
    let hasAccess = quiz.authorId === session.user.id;
    
    if (!hasAccess) {
      // Check if user is a participant in an active session for this quiz
      const activeSession = await prisma.quizSession.findFirst({
        where: {
          quizId,
          participants: {
            some: {
              userId: session.user.id,
            },
          },
        },
      });
      
      hasAccess = !!activeSession;
    }
    
    if (!hasAccess && !session.user.isAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to access these questions" },
        { status: 403 }
      );
    }
    
    // Get questions for the quiz
    const questions = await prisma.question.findMany({
      where: { quizId },
      orderBy: { order: "asc" },
    });
    
    return NextResponse.json(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const quizId = params.id;
    const { text, imageUrl, type, options, correctAnswer, order } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: "Question text is required" },
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
        { error: "You don't have permission to add questions to this quiz" },
        { status: 403 }
      );
    }
    
    // Create new question
    const question = await prisma.question.create({
      data: {
        quizId,
        text,
        imageUrl,
        type,
        options,
        correctAnswer,
        order,
      },
    });
    
    return NextResponse.json(question);
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 }
    );
  }
}