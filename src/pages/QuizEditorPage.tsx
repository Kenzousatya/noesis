import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Download,
  HelpCircle,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type { Grade, QuestionType, QuizQuestion, QuizResource, SubjectName } from '../lib/types';
import { GRADES } from '../lib/types';
import { SUBJECTS, QUIZ_TYPE_LABEL, subjectMeta } from '../lib/constants';
import {
  QUESTION_TYPES,
  defaultOptions,
  exportQuizJson,
  newQuestion,
  newQuiz,
  quizValidationErrors,
} from '../lib/quiz';
import { downloadJson, safeFilename, pluralize, cn, uid } from '../lib/utils';
import { useLibrary } from '../state/LibraryProvider';
import { useToast } from '../state/ToastProvider';
import { Button, CheckRow, EmptyState, Field, IconButton, Input, Menu, Select, Textarea, Badge } from '../components/ui';
import { ConfirmDialog } from '../components/Dialog';

function changeQuestionType(question: QuizQuestion, type: QuestionType): QuizQuestion {
  const base: QuizQuestion = { ...question, type, correctAnswer: [] };
  if (type === 'multiple_choice' || type === 'multiple_select') {
    base.options = question.options && question.options.length >= 2 ? question.options : defaultOptions();
  } else if (type === 'true_false') {
    base.options = [
      { id: 'true', text: 'True' },
      { id: 'false', text: 'False' },
    ];
  } else {
    base.options = undefined;
  }
  return base;
}

export default function QuizEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { resources, addResources, updateResource } = useLibrary();
  const toast = useToast();

  const storedQuiz = useMemo(
    () => (id && id !== 'new' ? resources.find((resource): resource is QuizResource => resource.id === id && resource.type === 'quiz') : undefined),
    [resources, id],
  );

  const [quiz, setQuiz] = useState<QuizResource | null>(() => {
    if (storedQuiz) return structuredClone(storedQuiz);
    if (id && id !== 'new') return null;
    const subjectParam = params.get('subject');
    const gradeParam = Number(params.get('grade'));
    const subject = (SUBJECTS.find((entry) => entry.name === subjectParam)?.name ?? 'Mathematics') as SubjectName;
    const grade = (GRADES.includes(gradeParam as Grade) ? gradeParam : 7) as Grade;
    return newQuiz(subject, grade);
  });

  const [dirty, setDirty] = useState(!storedQuiz);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [leaveOpen, setLeaveOpen] = useState(false);

  const errors = quiz ? quizValidationErrors(quiz) : [];

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (id !== 'new' && !storedQuiz && quiz === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={HelpCircle}
          title="Questionnaire not found"
          description="It may have been deleted. Return to a subject to choose another questionnaire."
          action={
            <Link to="/subjects">
              <Button>Browse subjects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!quiz) return null;

  const subject = subjectMeta(quiz.subject);

  const patchQuiz = (patch: Partial<QuizResource>) => {
    setQuiz((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  };

  const patchSettings = (patch: Partial<QuizResource['settings']>) => {
    setQuiz((current) => (current ? { ...current, settings: { ...current.settings, ...patch } } : current));
    setDirty(true);
  };

  const patchQuestion = (questionId: string, patch: Partial<QuizQuestion>) => {
    setQuiz((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question) =>
              question.id === questionId ? { ...question, ...patch } : question,
            ),
          }
        : current,
    );
    setDirty(true);
  };

  const addQuestion = (type: QuestionType) => {
    setQuiz((current) => (current ? { ...current, questions: [...current.questions, newQuestion(type)] } : current));
    setDirty(true);
  };

  const removeQuestion = (questionId: string) => {
    setQuiz((current) =>
      current ? { ...current, questions: current.questions.filter((question) => question.id !== questionId) } : current,
    );
    setDirty(true);
  };

  const duplicateQuestion = (questionId: string) => {
    setQuiz((current) => {
      if (!current) return current;
      const index = current.questions.findIndex((question) => question.id === questionId);
      if (index < 0) return current;
      const copy = { ...structuredClone(current.questions[index]), id: uid('q') };
      const questions = [...current.questions];
      questions.splice(index + 1, 0, copy);
      return { ...current, questions };
    });
    setDirty(true);
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuiz((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.questions.length) return current;
      const questions = [...current.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...current, questions };
    });
    setDirty(true);
  };

  const toggleCorrect = (question: QuizQuestion, optionId: string) => {
    if (question.type === 'multiple_choice') {
      patchQuestion(question.id, { correctAnswer: [optionId] });
      return;
    }
    const exists = question.correctAnswer.includes(optionId);
    patchQuestion(question.id, {
      correctAnswer: exists
        ? question.correctAnswer.filter((entry) => entry !== optionId)
        : [...question.correctAnswer, optionId],
    });
  };

  const updateOption = (question: QuizQuestion, optionId: string, text: string) => {
    patchQuestion(question.id, {
      options: question.options?.map((option) => (option.id === optionId ? { ...option, text } : option)),
    });
  };

  const addOption = (question: QuizQuestion) => {
    const options = question.options ?? [];
    if (options.length >= 8) {
      toast.info('Eight options is the practical maximum');
      return;
    }
    const nextId = String.fromCharCode(97 + options.length);
    patchQuestion(question.id, { options: [...options, { id: nextId, text: '' }] });
  };

  const removeOption = (question: QuizQuestion, optionId: string) => {
    const options = question.options ?? [];
    if (options.length <= 2) {
      toast.info('A question needs at least two options');
      return;
    }
    patchQuestion(question.id, {
      options: options.filter((option) => option.id !== optionId),
      correctAnswer: question.correctAnswer.filter((entry) => entry !== optionId),
    });
  };

  const save = async () => {
    if (errors.length) {
      setShowErrors(true);
      toast.error('The questionnaire is not ready to save', errors[0]);
      return;
    }
    setSaving(true);
    try {
      const payload: QuizResource = { ...quiz, updatedAt: Date.now() };
      if (storedQuiz) {
        await updateResource(payload.id, payload);
        toast.success('Questionnaire saved');
      } else {
        await addResources([payload]);
        toast.success('Questionnaire created', `${payload.questions.length} questions ready to practise.`);
        navigate(`/quiz/${payload.id}/edit`, { replace: true });
      }
      setDirty(false);
      setShowErrors(false);
    } catch (error) {
      toast.error('Could not save', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exportJson = () => {
    downloadJson(exportQuizJson(quiz), `${safeFilename(quiz.title)}.json`);
    toast.success('JSON exported');
  };

  const goBack = () => {
    if (dirty) setLeaveOpen(true);
    else navigate(`/subject/${subject.slug}?tab=quizzes&grade=${quiz.grade}`);
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-line bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <IconButton label="Back to questionnaires" onClick={goBack}>
            <ArrowLeft size={17} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
              {storedQuiz ? 'Editing questionnaire' : 'New questionnaire'}
            </p>
            <p className="truncate text-[13px] font-semibold text-ink">{quiz.title || 'Untitled questionnaire'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {dirty && <Badge tone="warm">Unsaved</Badge>}
            <Button variant="ghost" size="sm" onClick={exportJson}>
              <Download size={14} /> Export JSON
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              <Save size={14} /> Save
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 pb-20 sm:px-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 xl:order-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-[15px] font-semibold text-ink">
                Questions <span className="ml-1 text-[12px] font-normal text-muted">{quiz.questions.length}</span>
              </h1>
              <Menu
                label="Add question"
                align="right"
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus size={14} /> Add question <ChevronDown size={13} />
                  </Button>
                }
                items={QUESTION_TYPES.map((type) => ({
                  label: QUIZ_TYPE_LABEL[type],
                  icon: Plus,
                  onClick: () => addQuestion(type),
                }))}
              />
            </div>

            {showErrors && errors.length > 0 && (
              <div className="mb-3 rounded-card border border-danger/30 bg-danger/10 p-3">
                <p className="text-[12px] font-semibold text-danger">Fix these before saving</p>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-[11.5px] leading-relaxed text-danger/90">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {quiz.questions.map((question, index) => {
                const isCollapsed = collapsed[question.id];
                return (
                  <section key={question.id} className="rounded-card border border-line bg-panel">
                    <header className="flex items-center gap-1.5 border-b border-line px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setCollapsed((current) => ({ ...current, [question.id]: !isCollapsed }))}
                        className="flex flex-1 items-center gap-2 text-left"
                        aria-expanded={!isCollapsed}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded border border-line bg-panel2 text-[11px] font-semibold tabular-nums text-ink2">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink2">
                          {question.question || <span className="text-muted">Untitled question</span>}
                        </span>
                        <ChevronDown size={14} className={cn('shrink-0 text-muted transition-transform', isCollapsed && '-rotate-90')} aria-hidden="true" />
                      </button>
                      <div className="flex items-center gap-0.5">
                        <IconButton label="Move question up" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>
                          <ArrowUp size={14} />
                        </IconButton>
                        <IconButton label="Move question down" onClick={() => moveQuestion(index, 1)} disabled={index === quiz.questions.length - 1}>
                          <ArrowDown size={14} />
                        </IconButton>
                        <IconButton label="Duplicate question" onClick={() => duplicateQuestion(question.id)}>
                          <Copy size={14} />
                        </IconButton>
                        <IconButton label="Delete question" onClick={() => removeQuestion(question.id)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </header>

                    {!isCollapsed && (
                      <div className="flex flex-col gap-3 p-3.5">
                        <div className="grid gap-3 sm:grid-cols-[1fr_170px_90px]">
                          <Field label="Question" htmlFor={`q-${question.id}`}>
                            <Textarea
                              id={`q-${question.id}`}
                              rows={2}
                              value={question.question}
                              onChange={(event) => patchQuestion(question.id, { question: event.target.value })}
                              placeholder="Type the question…"
                            />
                          </Field>
                          <Field label="Type" htmlFor={`type-${question.id}`}>
                            <Select
                              id={`type-${question.id}`}
                              value={question.type}
                              className="w-full"
                              onChange={(event) =>
                                patchQuestion(question.id, changeQuestionType(question, event.target.value as QuestionType))
                              }
                            >
                              {QUESTION_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {QUIZ_TYPE_LABEL[type]}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Points" htmlFor={`points-${question.id}`}>
                            <Input
                              id={`points-${question.id}`}
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={question.points}
                              onChange={(event) =>
                                patchQuestion(question.id, { points: Math.max(0.5, Number(event.target.value) || 1) })
                              }
                            />
                          </Field>
                        </div>

                        {(question.type === 'multiple_choice' || question.type === 'multiple_select') && (
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <p className="text-[11.5px] font-semibold text-ink2">
                                Options{' '}
                                <span className="font-normal text-muted">
                                  {question.type === 'multiple_choice' ? '· choose one correct' : '· choose every correct answer'}
                                </span>
                              </p>
                              <Button size="sm" variant="ghost" onClick={() => addOption(question)}>
                                <Plus size={13} /> Add option
                              </Button>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {(question.options ?? []).map((option, optionIndex) => {
                                const correct = question.correctAnswer.includes(option.id);
                                return (
                                  <div key={option.id} className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      role={question.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                                      aria-checked={correct}
                                      aria-label={`Mark option ${option.id} correct`}
                                      onClick={() => toggleCorrect(question, option.id)}
                                      className={cn(
                                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold uppercase transition-colors',
                                        correct
                                          ? 'border-accent bg-accent text-onaccent'
                                          : 'border-line bg-panel2 text-muted hover:border-muted/50',
                                      )}
                                    >
                                      {correct ? <Check size={12} /> : String.fromCharCode(97 + optionIndex)}
                                    </button>
                                    <Input
                                      value={option.text}
                                      onChange={(event) => updateOption(question, option.id, event.target.value)}
                                      placeholder={`Option ${String.fromCharCode(97 + optionIndex)}`}
                                      aria-label={`Option ${String.fromCharCode(97 + optionIndex)} text`}
                                    />
                                    <IconButton label="Remove option" onClick={() => removeOption(question, option.id)}>
                                      <X size={14} />
                                    </IconButton>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {question.type === 'true_false' && (
                          <div>
                            <p className="mb-1.5 text-[11.5px] font-semibold text-ink2">Correct answer</p>
                            <div className="flex gap-2">
                              {['true', 'false'].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  aria-pressed={question.correctAnswer[0] === value}
                                  onClick={() => patchQuestion(question.id, { correctAnswer: [value] })}
                                  className={cn(
                                    'h-8 rounded-btn border px-4 text-[12px] capitalize transition-colors',
                                    question.correctAnswer[0] === value
                                      ? 'border-accent bg-accent/15 text-accent'
                                      : 'border-line bg-panel2 text-ink2 hover:border-muted/50',
                                  )}
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {question.type === 'short_answer' && (
                          <Field
                            label="Accepted answers"
                            htmlFor={`answers-${question.id}`}
                            hint="One accepted answer per line. Matching ignores case and extra spaces."
                          >
                            <Textarea
                              id={`answers-${question.id}`}
                              rows={2}
                              value={question.correctAnswer.join('\n')}
                              onChange={(event) =>
                                patchQuestion(question.id, {
                                  correctAnswer: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
                                })
                              }
                              placeholder={'12\n twelve'}
                            />
                          </Field>
                        )}

                        <Field label="Explanation" htmlFor={`explanation-${question.id}`} hint="Shown after submission when explanations are enabled.">
                          <Textarea
                            id={`explanation-${question.id}`}
                            rows={2}
                            value={question.explanation ?? ''}
                            onChange={(event) => patchQuestion(question.id, { explanation: event.target.value })}
                            placeholder="Why is this the answer?"
                          />
                        </Field>
                      </div>
                    )}
                  </section>
                );
              })}

              {quiz.questions.length === 0 && (
                <div className="rounded-card border border-dashed border-line bg-panel/40 px-4 py-8 text-center">
                  <p className="text-[13px] font-medium text-ink">No questions yet</p>
                  <p className="mt-1 text-[12px] text-ink2">Add your first question to build the questionnaire.</p>
                  <Button className="mt-3" size="sm" onClick={() => addQuestion('multiple_choice')}>
                    <Plus size={14} /> Add multiple choice
                  </Button>
                </div>
              )}
            </div>
          </main>

          <aside className="flex min-w-0 flex-col gap-3 xl:order-2">
            <div className="rounded-card border border-line bg-panel p-4">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Details</h2>
              <div className="mt-3 flex flex-col gap-3">
                <Field label="Title" htmlFor="quiz-title">
                  <Input id="quiz-title" value={quiz.title} onChange={(event) => patchQuiz({ title: event.target.value })} />
                </Field>
                <Field label="Description" htmlFor="quiz-description">
                  <Textarea
                    id="quiz-description"
                    rows={3}
                    value={quiz.description ?? ''}
                    onChange={(event) => patchQuiz({ description: event.target.value })}
                    placeholder="What does this questionnaire cover?"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Subject" htmlFor="quiz-subject">
                    <Select
                      id="quiz-subject"
                      value={quiz.subject}
                      className="w-full"
                      onChange={(event) => patchQuiz({ subject: event.target.value as SubjectName })}
                    >
                      {SUBJECTS.map((entry) => (
                        <option key={entry.slug} value={entry.name}>
                          {entry.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Grade" htmlFor="quiz-grade">
                    <Select
                      id="quiz-grade"
                      value={quiz.grade}
                      className="w-full"
                      onChange={(event) => patchQuiz({ grade: Number(event.target.value) as Grade })}
                    >
                      {GRADES.map((entry) => (
                        <option key={entry} value={entry}>
                          Grade {entry}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Difficulty" htmlFor="quiz-difficulty">
                  <Select
                    id="quiz-difficulty"
                    value={quiz.difficulty ?? 'medium'}
                    className="w-full"
                    onChange={(event) => patchQuiz({ difficulty: event.target.value as QuizResource['difficulty'] })}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="rounded-card border border-line bg-panel p-4">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Quiz settings</h2>
              <div className="mt-3 flex flex-col gap-2.5">
                <CheckRow id="shuffle-questions" checked={quiz.settings.shuffleQuestions} onChange={(value) => patchSettings({ shuffleQuestions: value })}>
                  Shuffle questions
                </CheckRow>
                <CheckRow id="shuffle-options" checked={quiz.settings.shuffleOptions} onChange={(value) => patchSettings({ shuffleOptions: value })}>
                  Shuffle answer options
                </CheckRow>
                <CheckRow id="show-explanations" checked={quiz.settings.showExplanations} onChange={(value) => patchSettings({ showExplanations: value })}>
                  Show explanations after submission
                </CheckRow>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Field label="Timer (minutes)" htmlFor="quiz-timer" hint="Empty = no timer">
                    <Input
                      id="quiz-timer"
                      type="number"
                      min={1}
                      max={240}
                      value={quiz.settings.timerMinutes ?? ''}
                      onChange={(event) =>
                        patchSettings({ timerMinutes: event.target.value ? Number(event.target.value) : null })
                      }
                    />
                  </Field>
                  <Field label="Pass mark (%)" htmlFor="quiz-pass">
                    <Input
                      id="quiz-pass"
                      type="number"
                      min={0}
                      max={100}
                      value={quiz.settings.passingScore}
                      onChange={(event) => patchSettings({ passingScore: Number(event.target.value) })}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="rounded-card border border-line bg-panel p-4 text-[11.5px] leading-relaxed text-ink2">
              <p className="font-medium text-ink">Questionnaire summary</p>
              <p className="mt-1">
                {pluralize(quiz.questions.length, 'question')} ·{' '}
                {quiz.questions.reduce((sum, question) => sum + question.points, 0)} points total
              </p>
              <Button variant="outline" size="sm" className="mt-2.5 w-full" onClick={exportJson}>
                <Download size={13} /> Export as JSON
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setDirty(false);
          setLeaveOpen(false);
          navigate(`/subject/${subject.slug}?tab=quizzes&grade=${quiz.grade}`);
        }}
        tone="danger"
        title="Leave without saving?"
        confirmLabel="Discard changes"
        message="Your edits to this questionnaire have not been saved and will be lost."
      />
    </div>
  );
}
