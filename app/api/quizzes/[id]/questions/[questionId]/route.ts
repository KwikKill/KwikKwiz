import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string; questionId: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { id: quizId, questionId } = params;
    
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
        { error: "You don't have permission to access this question" },
        { status: 403 }
      );
    }
    
    // Get question
    const question = await prisma.question.findUnique({
      where: {
        id: questionId,
        quizId,
      },
    });
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    
    return NextResponse.json(question);
  } catch (error) {
    console.error("Error fetching question:", error);
    return NextResponse.json(
      { error: "Failed to fetch question" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string; questionId: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { id: quizId, questionId } = params;
    const { text, imageUrl, type, options, correctAnswer } = await request.json();
    
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
        { error: "You don't have permission to update questions in this quiz" },
        { status: 403 }
      );
    }
    
    // Check if question exists
    const question = await prisma.question.findUnique({
      where: {
        id: questionId,
        quizId,
      },
    });
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    
    // Update question
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        text,
        imageUrl,
        type,
        options,
        correctAnswer,
      },
    });
    
    return NextResponse.json(updatedQuestion);
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; questionId: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { id: quizId, questionId } = params;
    
    // Check if quiz exists and user is the author
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });
    
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    
    if (quiz.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete questions from this quiz" },
        { status: 403 }
      );
    }
    
    // Check if question exists
    const question = await prisma.question.findUnique({
      where: {
        id: questionId,
        quizId,
      },
    });
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    
    // Delete question
    await prisma.question.delete({
      where: { id: questionId },
    });
    
    // Reorder remaining questions
    const remainingQuestions = await prisma.question.findMany({
      where: { quizId },
      orderBy: { order: "asc" },
    });
    
    for (let i = 0; i < remainingQuestions.length; i++) {
      await prisma.question.update({
        where: { id: remainingQuestions[i].id },
        data: { order: i },
      });
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
}