'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit, Trash2, Image, FlipVertical as DragVertical, Check, X } from "lucide-react";

interface Quiz {
  id: string;
  name: string;
  description: string | null;
}

interface Question {
  id: string;
  text: string;
  imageUrl: string | null;
  type: 'MULTIPLE_CHOICE' | 'FREE_ANSWER';
  options: string[];
  correctAnswer: string | null;
  order: number;
}

export default function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const [quizId, setQuizId] = useState<string>("");
  useEffect(() => {
    params.then((resolvedParams) => {
      setQuizId(resolvedParams.id);
    });
  }, [params]);


  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isQuizEditMode, setIsQuizEditMode] = useState(false);
  const [editedQuizName, setEditedQuizName] = useState("");
  const [editedQuizDescription, setEditedQuizDescription] = useState("");

  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionImageUrl, setQuestionImageUrl] = useState("");
  const [questionType, setQuestionType] = useState<'MULTIPLE_CHOICE' | 'FREE_ANSWER'>('MULTIPLE_CHOICE');
  const [questionOptions, setQuestionOptions] = useState<string[]>(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      // Fetch quiz details
      fetch(`/api/quizzes/${quizId}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch quiz");
          }
          return res.json();
        })
        .then((data) => {
          setQuiz(data);
          setEditedQuizName(data.name);
          setEditedQuizDescription(data.description || "");

          // Fetch questions
          return fetch(`/api/quizzes/${quizId}/questions`);
        })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch questions");
          }
          return res.json();
        })
        .then((data) => {
          setQuestions(data.sort((a: Question, b: Question) => a.order - b.order));
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error:", error);
          toast({
            title: "Error",
            description: "Failed to load quiz details",
            variant: "destructive",
          });
          setIsLoading(false);
        });
    }
  }, [quizId, session, toast]);

  const handleUpdateQuiz = async () => {
    if (!editedQuizName.trim()) {
      toast({
        title: "Quiz name required",
        description: "Please enter a name for your quiz",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/quizzes/${quizId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editedQuizName.trim(),
          description: editedQuizDescription.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update quiz");
      }

      setQuiz(data);
      setIsQuizEditMode(false);

      toast({
        title: "Quiz updated",
        description: "Your quiz details have been updated",
      });
    } catch (error) {
      toast({
        title: "Error updating quiz",
        description: error instanceof Error ? error.message : "Failed to update quiz",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const validateQuestionForm = () => {
    if (!questionText.trim()) {
      toast({
        title: "Question text required",
        description: "Please enter text for your question",
        variant: "destructive",
      });
      return false;
    }

    if (questionType === 'MULTIPLE_CHOICE') {
      // Check if at least 2 options are provided
      const validOptions = questionOptions.filter(opt => opt.trim().length > 0);
      if (validOptions.length < 2) {
        toast({
          title: "Insufficient options",
          description: "Multiple choice questions need at least 2 options",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleAddQuestion = async () => {
    if (!validateQuestionForm()) return;

    setIsSaving(true);

    try {
      // Filter out empty options
      const validOptions = questionOptions.filter(opt => opt.trim().length > 0);

      const response = await fetch(`/api/quizzes/${quizId}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: questionText.trim(),
          imageUrl: questionImageUrl.trim() || null,
          type: questionType,
          options: questionType === 'MULTIPLE_CHOICE' ? validOptions : [],
          correctAnswer: correctAnswer.trim() || null,
          order: questions.length, // Add to the end
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add question");
      }

      // Add new question to the list
      setQuestions([...questions, data]);

      // Reset form
      resetQuestionForm();
      setIsQuestionDialogOpen(false);

      toast({
        title: "Question added",
        description: "Your question has been added to the quiz",
      });
    } catch (error) {
      toast({
        title: "Error adding question",
        description: error instanceof Error ? error.message : "Failed to add question",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateQuestion = async () => {
    if (!validateQuestionForm() || !currentQuestionId) return;

    setIsSaving(true);

    try {
      // Filter out empty options
      const validOptions = questionOptions.filter(opt => opt.trim().length > 0);

      const response = await fetch(`/api/quizzes/${quizId}/questions/${currentQuestionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: questionText.trim(),
          imageUrl: questionImageUrl.trim() || null,
          type: questionType,
          options: questionType === 'MULTIPLE_CHOICE' ? validOptions : [],
          correctAnswer: correctAnswer.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update question");
      }

      // Update question in the list
      setQuestions(
        questions.map(q => (q.id === currentQuestionId ? data : q))
      );

      // Reset form
      resetQuestionForm();
      setIsQuestionDialogOpen(false);

      toast({
        title: "Question updated",
        description: "Your question has been updated",
      });
    } catch (error) {
      toast({
        title: "Error updating question",
        description: error instanceof Error ? error.message : "Failed to update question",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/quizzes/${quizId}/questions/${questionToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete question");
      }

      // Remove question from the list
      setQuestions(questions.filter(q => q.id !== questionToDelete));

      // Close dialog
      setIsDeleteDialogOpen(false);
      setQuestionToDelete(null);

      toast({
        title: "Question deleted",
        description: "The question has been removed from your quiz",
      });
    } catch (error) {
      toast({
        title: "Error deleting question",
        description: error instanceof Error ? error.message : "Failed to delete question",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const startIndex = result.source.index;
    const endIndex = result.destination.index;

    if (startIndex === endIndex) return;

    const reorderedQuestions = Array.from(questions);
    const [removed] = reorderedQuestions.splice(startIndex, 1);
    reorderedQuestions.splice(endIndex, 0, removed);

    // Update order property
    const updatedQuestions = reorderedQuestions.map((q, index) => ({
      ...q,
      order: index,
    }));

    // Update UI immediately
    setQuestions(updatedQuestions);

    // Save the new order to the database
    try {
      const response = await fetch(`/api/quizzes/${quizId}/questions/reorder`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questions: updatedQuestions.map(q => ({
            id: q.id,
            order: q.order,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reorder questions");
      }
    } catch (error) {
      toast({
        title: "Error reordering questions",
        description: error instanceof Error ? error.message : "Failed to save the new order",
        variant: "destructive",
      });

      // Revert to original order on error
      setQuestions(questions);
    }
  };

  const openAddQuestionDialog = () => {
    resetQuestionForm();
    setIsEditingQuestion(false);
    setIsQuestionDialogOpen(true);
  };

  const openEditQuestionDialog = (question: Question) => {
    setCurrentQuestionId(question.id);
    setQuestionText(question.text);
    setQuestionImageUrl(question.imageUrl || "");
    setQuestionType(question.type);
    setQuestionOptions(
      question.type === 'MULTIPLE_CHOICE'
        ? [...question.options, ...Array(4 - question.options.length).fill("")]
        : ["", "", "", ""]
    );
    setCorrectAnswer(question.correctAnswer || "");
    setIsEditingQuestion(true);
    setIsQuestionDialogOpen(true);
  };

  const openDeleteDialog = (questionId: string) => {
    setQuestionToDelete(questionId);
    setIsDeleteDialogOpen(true);
  };

  const resetQuestionForm = () => {
    setCurrentQuestionId(null);
    setQuestionText("");
    setQuestionImageUrl("");
    setQuestionType('MULTIPLE_CHOICE');
    setQuestionOptions(["", "", "", ""]);
    setCorrectAnswer("");
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...questionOptions];
    newOptions[index] = value;
    setQuestionOptions(newOptions);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Quiz Not Found</CardTitle>
            <CardDescription>This quiz may have been deleted or you don't have permission to access it.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            {isQuizEditMode ? (
              <div className="space-y-2">
                <Input
                  value={editedQuizName}
                  onChange={(e) => setEditedQuizName(e.target.value)}
                  placeholder="Quiz Name"
                  className="text-xl font-bold"
                />
                <Textarea
                  value={editedQuizDescription}
                  onChange={(e) => setEditedQuizDescription(e.target.value)}
                  placeholder="Quiz Description (Optional)"
                  rows={3}
                />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{quiz.name}</CardTitle>
                    <CardDescription>
                      {quiz.description || "No description provided"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsQuizEditMode(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardHeader>
          {isQuizEditMode && (
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditedQuizName(quiz.name);
                  setEditedQuizDescription(quiz.description || "");
                  setIsQuizEditMode(false);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateQuiz} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardFooter>
          )}
        </Card>

        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Questions ({questions.length})</h2>
          <Button onClick={openAddQuestionDialog}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            {questions.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground">No questions added yet</p>
                <Button
                  variant="outline"
                  onClick={openAddQuestionDialog}
                  className="mt-4"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Your First Question
                </Button>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable
                  droppableId="questions"
                  isDropDisabled={isSaving}
                  isCombineEnabled={false}
                  ignoreContainerClipping={true}
                >
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-4"
                    >
                      {questions.map((question, index) => (
                        <Draggable
                          key={question.id}
                          draggableId={question.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="border rounded-md p-4 bg-card"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-start gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="text-muted-foreground hover:text-foreground cursor-grab mt-1"
                                  >
                                    <DragVertical className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="bg-muted text-xs font-medium py-1 px-2 rounded-md">
                                        Q{index + 1}
                                      </span>
                                      <span className="bg-primary/10 text-xs font-medium py-1 px-2 rounded-md">
                                        {question.type === 'MULTIPLE_CHOICE' ? 'Multiple Choice' : 'Free Answer'}
                                      </span>
                                      {question.imageUrl && (
                                        <span className="bg-muted text-xs font-medium py-1 px-2 rounded-md flex items-center">
                                          <Image className="h-3 w-3 mr-1" />
                                          Image
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm font-medium mb-2">{question.text}</p>

                                    {question.type === 'MULTIPLE_CHOICE' && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                        {question.options.map((option, optIndex) => (
                                          <div
                                            key={optIndex}
                                            className="text-xs border rounded-md p-2 flex items-center"
                                          >
                                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center mr-2">
                                              {String.fromCharCode(65 + optIndex)}
                                            </span>
                                            {option}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditQuestionDialog(question)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openDeleteDialog(question.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
            {questions.length > 0 && (
              <Button
                onClick={() => router.push(`/admin/sessions/new?quizId=${quizId}`)}
              >
                Start Quiz Session
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Add/Edit Question Dialog */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {isEditingQuestion ? "Edit Question" : "Add New Question"}
            </DialogTitle>
            <DialogDescription>
              {isEditingQuestion
                ? "Update the details of your question"
                : "Create a new question for your quiz"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="question-text" className="text-sm font-medium">
                Question Text
              </label>
              <Textarea
                id="question-text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter your question"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="question-image" className="text-sm font-medium">
                Image URL (Optional)
              </label>
              <Input
                id="question-image"
                value={questionImageUrl}
                onChange={(e) => setQuestionImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="question-type" className="text-sm font-medium">
                Question Type
              </label>
              <Select
                value={questionType}
                onValueChange={(value: 'MULTIPLE_CHOICE' | 'FREE_ANSWER') => setQuestionType(value)}
              >
                <SelectTrigger id="question-type">
                  <SelectValue placeholder="Select question type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                  <SelectItem value="FREE_ANSWER">Free Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {questionType === 'MULTIPLE_CHOICE' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Answer Options</label>
                <div className="space-y-2">
                  {questionOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                        {String.fromCharCode(65 + index)}
                      </div>
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="correct-answer" className="text-sm font-medium">
                Correct Answer (Optional)
              </label>
              <Input
                id="correct-answer"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder={questionType === 'MULTIPLE_CHOICE' ? "Enter the correct option (A, B, C...)" : "Enter the correct answer"}
              />
              <p className="text-xs text-muted-foreground">
                This is for your reference only and won't be shown to participants
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetQuestionForm();
                setIsQuestionDialogOpen(false);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={isEditingQuestion ? handleUpdateQuestion : handleAddQuestion}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Saving...
                </>
              ) : isEditingQuestion ? (
                "Update Question"
              ) : (
                "Add Question"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Question</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteQuestion}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
