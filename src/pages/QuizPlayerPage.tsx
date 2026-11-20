import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  HelpCircle,
  Pencil,
  RotateCcw,
  X,
} from 'lucide-react';
import type { AnswerMap, Attempt, QuizQuestion, QuizResource } from '../lib/types';
import type { QuizScore } from '../lib/quiz';
import { useLibrary } from '../state/LibraryProvider';
import { useToast } from '../state/ToastProvider';
import { subjectMeta, QUIZ_TYPE_LABEL } from '../lib/constants';
import {
  isCorrect,
  isQuestionAnswered,
  quizDurationMinutes,
  scoreQuiz,
} from '../lib/quiz';
import { formatDateTime, formatDuration, pluralize, shuffle, uid, cn } from '../lib/utils';
import { Badge, Button, EmptyState, ProgressBar } from '../components/ui';
import { ConfirmDialog, Dialog } from '../components/Dialog';

type Phase = 'intro' | 'playing' | 'results';

function optionText(question: QuizQuestion, ids: string[]): string {
  if (!ids.length) return 'No answer';
  if (question.type === 'short_answer') return ids.join(', ');
  if (question.type === 'true_false') return ids.map((id) => (id === 'true' ? 'True' : 'False')).join(', ');
  return ids
    .map((id) => question.options?.find((option) => option.id === id)?.text ?? id)
    .join(', ');
}

export default function QuizPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { resources, attempts, addAttempt, markOpened } = useLibrary();
  const toast = useToast();

  const quiz = resources.find((resource): resource is QuizResource => resource.id === id && resource.type === 'quiz');

  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [optionOrder, setOptionOrder] = useState<Record<string, string[]>>({});
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<QuizScore | null>(null);
  const [savedAttempt, setSavedAttempt] = useState<Attempt | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'unanswered'>('all');
  const submittedRef = useRef(false);

  useEffect(() => {
    if (quiz) void markOpened(quiz.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id]);

  const subject = quiz ? subjectMeta(quiz.subject) : null;
  const history = useMemo(
    () => (quiz ? attempts.filter((attempt) => attempt.quizId === quiz.id).sort((a, b) => b.completedAt - a.completedAt) : []),
    [attempts, quiz],
  );

  const answeredCount = useMemo(
    () => (quiz ? quiz.questions.filter((question) => isQuestionAnswered(question, answers[question.id])).length : 0),
    [quiz, answers],
  );

  const submit = useCallback(
    async (auto = false) => {
      if (!quiz || submittedRef.current) return;
      submittedRef.current = true;
      const score = scoreQuiz(quiz, answers);
      setResult(score);
      const completedAt = Date.now();
      const attempt: Attempt = {
        id: uid('a'),
        quizId: quiz.id,
        quizTitle: quiz.title,
        subject: quiz.subject,
        grade: quiz.grade,
        startedAt,
        completedAt,
        score: score.score,
        maxScore: score.maxScore,
        percentage: score.percentage,
        correct: score.correct,
        incorrect: score.incorrect,
        unanswered: score.unanswered,
        timeSpentMs: Math.max(0, completedAt - startedAt),
        answers,
      };
      setSavedAttempt(attempt);
      try {
        await addAttempt(attempt);
      } catch (error) {
        toast.error('The attempt could not be saved', (error as Error).message);
      }
      setPhase('results');
      setConfirmSubmit(false);
      setOverviewOpen(false);
      if (auto) toast.info('Time is up', 'Your answers were submitted automatically.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [quiz, answers, startedAt, addAttempt, toast],
  );

  useEffect(() => {
    if (phase !== 'playing' || !endsAt) return;
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      if (left <= 0) void submit(true);
    };
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [phase, endsAt, submit]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  if (!quiz) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={HelpCircle}
          title="Questionnaire not found"
          description="It may have been deleted. Choose another questionnaire from a subject."
          action={
            <Link to="/subjects">
              <Button>Browse subjects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const start = () => {
    const ordered = quiz.settings.shuffleQuestions ? shuffle(quiz.questions) : quiz.questions;
    const orders: Record<string, string[]> = {};
    for (const question of ordered) {
      if (question.options && quiz.settings.shuffleOptions) {
        orders[question.id] = shuffle(question.options.map((option) => option.id));
      }
    }
    setQuestions(ordered);
    setOptionOrder(orders);
    setAnswers({});
    setIndex(0);
    setStartedAt(Date.now());
    setEndsAt(quiz.settings.timerMinutes ? Date.now() + quiz.settings.timerMinutes * 60_000 : null);
    setRemaining(quiz.settings.timerMinutes ? quiz.settings.timerMinutes * 60_000 : null);
    setResult(null);
    setSavedAttempt(null);
    setReviewFilter('all');
    submittedRef.current = false;
    setPhase('playing');
    window.scrollTo({ top: 0 });
  };

  const exitToSubject = () => {
    navigate(`/subject/${subject?.slug}?tab=quizzes&grade=${quiz.grade}`);
  };

  const current = questions[index];
  const currentAnswer = current ? (answers[current.id] ?? []) : [];

  const setAnswer = (questionId: string, values: string[]) => {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: values }));
  };

  const orderedOptions = (question: QuizQuestion) => {
    const order = optionOrder[question.id];
    if (!order) return question.options ?? [];
    return order
      .map((optionId) => question.options?.find((option) => option.id === optionId))
      .filter((option): option is { id: string; text: string } => Boolean(option));
  };

  const attemptSummary = savedAttempt;
  const passed = result ? result.percentage >= quiz.settings.passingScore : false;

  const reviewItems = result
    ? result.details.filter((detail) => {
        if (reviewFilter === 'incorrect') return detail.answered && !detail.correct;
        if (reviewFilter === 'unanswered') return !detail.answered;
        return true;
      })
    : [];

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-line bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => (phase === 'playing' ? setConfirmExit(true) : exitToSubject())}
            className="inline-flex items-center gap-1.5 rounded-btn px-1.5 py-1 text-[12px] text-ink2 transition-colors hover:text-accent"
          >
            <ArrowLeft size={15} aria-hidden="true" /> {phase === 'playing' ? 'Exit' : 'Back'}
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[12.5px] font-semibold text-ink">{quiz.title}</p>
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted">
              {quiz.subject} · Grade {quiz.grade}
            </p>
          </div>
          <div className="flex w-16 justify-end">
            {phase === 'playing' && remaining !== null && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] tabular-nums',
                  remaining < 60_000 ? 'border-danger/40 bg-danger/10 text-danger' : 'border-line bg-panel2 text-ink2',
                )}
              >
                <Clock3 size={11} aria-hidden="true" /> {formatDuration(remaining)}
              </span>
            )}
            {phase === 'playing' && remaining === null && (
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Untimed</span>
            )}
          </div>
        </div>
        {phase === 'playing' && (
          <div className="mx-auto max-w-5xl px-4 pb-2 sm:px-6">
            <ProgressBar value={(answeredCount / Math.max(1, quiz.questions.length)) * 100} />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-20 sm:px-6">
        {phase === 'intro' && (
          <div className="flex flex-col gap-6">
            <div className="rounded-panel border border-line bg-panel p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">Questionnaire</Badge>
                <Badge>{quiz.subject}</Badge>
                <Badge>Grade {quiz.grade}</Badge>
                {quiz.difficulty && <Badge tone="warm">{quiz.difficulty}</Badge>}
              </div>
              <h1 className="editorial mt-3 text-[26px] leading-tight text-ink sm:text-[32px]">{quiz.title}</h1>
              {quiz.description ? (
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink2">{quiz.description}</p>
              ) : (
                <p className="mt-2 text-[12.5px] text-muted">No description provided.</p>
              )}

              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
                {[
                  { label: 'Questions', value: String(quiz.questions.length) },
                  { label: 'Estimated time', value: `${quizDurationMinutes(quiz)} min` },
                  { label: 'Pass mark', value: `${quiz.settings.passingScore}%` },
                  { label: 'Attempts', value: String(history.length) },
                ].map((item) => (
                  <div key={item.label} className="bg-panel px-3 py-2.5">
                    <dt className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</dt>
                    <dd className="mt-1 text-[15px] font-semibold tabular-nums text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {quiz.settings.timerMinutes ? <Badge tone="warm">Timed · {quiz.settings.timerMinutes} min</Badge> : <Badge>No timer</Badge>}
                {quiz.settings.shuffleQuestions && <Badge>Shuffled questions</Badge>}
                {quiz.settings.shuffleOptions && <Badge>Shuffled options</Badge>}
                <Badge>{quiz.settings.showExplanations ? 'Explanations after submission' : 'No explanations'}</Badge>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
                <Button size="lg" onClick={start}>
                  Start questionnaire <ArrowRight size={15} />
                </Button>
                <Link to={`/quiz/${quiz.id}/edit`}>
                  <Button variant="outline" size="lg">
                    <Pencil size={14} /> Edit
                  </Button>
                </Link>
              </div>
              <p className="mt-2.5 text-[11px] text-muted">
                Correct answers are hidden until you submit. Leaving mid-attempt asks for confirmation.
              </p>
            </div>

            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Attempt history</h2>
              {history.length === 0 ? (
                <p className="rounded-card border border-dashed border-line bg-panel/40 px-4 py-5 text-[12px] text-ink2">
                  No attempts yet. Finish this questionnaire to record your first score.
                </p>
              ) : (
                <div className="overflow-hidden rounded-card border border-line bg-panel">
                  {history.map((attempt, attemptIndex) => (
                    <div
                      key={attempt.id}
                      className={cn(
                        'flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-[12px]',
                        attemptIndex > 0 && 'border-t border-line',
                      )}
                    >
                      <span className={cn('font-semibold tabular-nums', attempt.percentage >= quiz.settings.passingScore ? 'text-accent' : 'text-accent2')}>
                        {attempt.percentage}%
                      </span>
                      <span className="text-ink2">
                        {attempt.score}/{attempt.maxScore} points
                      </span>
                      <span className="text-[11px] text-muted">
                        {attempt.correct} correct · {attempt.incorrect} incorrect · {attempt.unanswered} unanswered
                      </span>
                      <span className="ml-auto text-[11px] text-muted">{formatDateTime(attempt.completedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {phase === 'playing' && current && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_248px]">
            <div className="min-w-0">
              <div className="rounded-panel border border-line bg-panel p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                    Question {index + 1} of {questions.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Badge>{QUIZ_TYPE_LABEL[current.type]}</Badge>
                    <Badge>{current.points} pt{current.points === 1 ? '' : 's'}</Badge>
                  </div>
                </div>

                <h2 className="mt-3 text-[17px] font-semibold leading-snug text-ink sm:text-[19px]">
                  {current.question}
                </h2>
                {current.type === 'multiple_select' && (
                  <p className="mt-1 text-[11.5px] text-muted">Select every correct answer.</p>
                )}

                <div className="mt-5">
                  {(current.type === 'multiple_choice' || current.type === 'multiple_select') && (
                    <div className="flex flex-col gap-2" role={current.type === 'multiple_choice' ? 'radiogroup' : 'group'} aria-label="Answer options">
                      {orderedOptions(current).map((option, optionIndex) => {
                        const selected = currentAnswer.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role={current.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                            aria-checked={selected}
                            onClick={() => {
                              if (current.type === 'multiple_choice') setAnswer(current.id, [option.id]);
                              else
                                setAnswer(
                                  current.id,
                                  selected
                                    ? currentAnswer.filter((entry) => entry !== option.id)
                                    : [...currentAnswer, option.id],
                                );
                            }}
                            className={cn(
                              'flex items-start gap-3 rounded-card border px-3.5 py-2.5 text-left text-[13px] leading-relaxed transition-colors',
                              selected
                                ? 'border-accent bg-accent/10 text-ink'
                                : 'border-line bg-panel2/50 text-ink2 hover:border-muted/50 hover:text-ink',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-semibold uppercase',
                                selected ? 'border-accent bg-accent text-onaccent' : 'border-line text-muted',
                              )}
                            >
                              {selected ? <Check size={11} /> : String.fromCharCode(97 + optionIndex)}
                            </span>
                            <span>{option.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {current.type === 'true_false' && (
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="True or false">
                      {['true', 'false'].map((value) => {
                        const selected = currentAnswer[0] === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setAnswer(current.id, [value])}
                            className={cn(
                              'h-12 rounded-card border text-[13px] font-medium capitalize transition-colors',
                              selected
                                ? 'border-accent bg-accent/10 text-ink'
                                : 'border-line bg-panel2/50 text-ink2 hover:border-muted/50',
                            )}
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {current.type === 'short_answer' && (
                    <div>
                      <label htmlFor={`answer-${current.id}`} className="mb-1.5 block text-[11.5px] font-medium text-ink2">
                        Your answer
                      </label>
                      <input
                        id={`answer-${current.id}`}
                        value={currentAnswer[0] ?? ''}
                        onChange={(event) => setAnswer(current.id, [event.target.value])}
                        className="field h-10"
                        placeholder="Type your answer…"
                        autoComplete="off"
                      />
                      <p className="mt-1.5 text-[11px] text-muted">
                        Spelling is compared loosely — ignore capitalisation and extra spaces.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between gap-2 border-t border-line pt-4">
                  <Button variant="ghost" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
                    <ChevronLeft size={15} /> Previous
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOverviewOpen(true)}>
                      Overview
                    </Button>
                    {index < questions.length - 1 ? (
                      <Button onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}>
                        Next <ChevronRight size={15} />
                      </Button>
                    ) : (
                      <Button onClick={() => (answeredCount < quiz.questions.length ? setConfirmSubmit(true) : void submit())}>
                        <Flag size={14} /> Submit questionnaire
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel px-3.5 py-2.5 text-[11px] text-muted">
                <span>
                  {answeredCount} of {quiz.questions.length} answered
                </span>
                <button
                  type="button"
                  onClick={() => (answeredCount < quiz.questions.length ? setConfirmSubmit(true) : void submit())}
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <Flag size={12} /> Submit now
                </button>
              </div>
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-card border border-line bg-panel p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Question overview</p>
                <div className="mt-2.5 grid grid-cols-5 gap-1.5">
                  {questions.map((question, questionIndex) => {
                    const answered = isQuestionAnswered(question, answers[question.id]);
                    const active = questionIndex === index;
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => setIndex(questionIndex)}
                        aria-label={`Go to question ${questionIndex + 1}${answered ? ', answered' : ', unanswered'}`}
                        aria-current={active}
                        className={cn(
                          'h-8 rounded border text-[11px] tabular-nums transition-colors',
                          active
                            ? 'border-accent text-accent'
                            : answered
                              ? 'border-accent/30 bg-accent/15 text-ink'
                              : 'border-line bg-panel2 text-muted hover:border-muted/50 hover:text-ink',
                        )}
                      >
                        {questionIndex + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-col gap-1 text-[10.5px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/40" aria-hidden="true" /> Answered
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[2px] border border-line bg-panel2" aria-hidden="true" /> Unanswered
                  </span>
                </div>
                <Button
                  className="mt-4 w-full"
                  variant={answeredCount < quiz.questions.length ? 'outline' : 'primary'}
                  onClick={() => (answeredCount < quiz.questions.length ? setConfirmSubmit(true) : void submit())}
                >
                  <Flag size={14} /> Submit
                </Button>
              </div>
            </aside>
          </div>
        )}

        {phase === 'results' && result && (
          <div className="flex flex-col gap-5">
            <section className="rounded-panel border border-line bg-panel p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Badge tone={passed ? 'accent' : 'warm'}>{passed ? 'Passed' : 'Below pass mark'}</Badge>
                  <p className="editorial mt-2 text-[48px] leading-none text-ink">{result.percentage}%</p>
                  <p className="mt-1.5 text-[13px] text-ink2">
                    {result.score} of {result.maxScore} points · pass mark {quiz.settings.passingScore}%
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" onClick={start}>
                    <RotateCcw size={14} /> Retake
                  </Button>
                  <Link to={`/quiz/${quiz.id}/edit`}>
                    <Button variant="ghost">
                      <Pencil size={14} /> Edit
                    </Button>
                  </Link>
                  <Button onClick={exitToSubject}>Back to questionnaires</Button>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
                {[
                  { label: 'Correct', value: String(result.correct) },
                  { label: 'Incorrect', value: String(result.incorrect) },
                  { label: 'Unanswered', value: String(result.unanswered) },
                  {
                    label: 'Time taken',
                    value: attemptSummary ? formatDuration(attemptSummary.timeSpentMs) : '—',
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-panel px-3 py-2.5">
                    <dt className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</dt>
                    <dd className="mt-1 text-[16px] font-semibold tabular-nums text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[11px] text-muted">
                Attempt saved {attemptSummary ? formatDateTime(attemptSummary.completedAt) : ''} · {quiz.title}
              </p>
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-ink">Review</h2>
                <div className="flex gap-1">
                  {(['all', 'incorrect', 'unanswered'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setReviewFilter(filter)}
                      className={cn(
                        'rounded-btn px-2.5 py-1 text-[11px] capitalize transition-colors',
                        reviewFilter === filter ? 'bg-active text-accent' : 'text-ink2 hover:bg-panel2',
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <ol className="flex flex-col gap-2.5">
                {reviewItems.map((detail, itemIndex) => {
                  const questionIndex = quiz.questions.findIndex((question) => question.id === detail.question.id);
                  return (
                    <li
                      key={detail.question.id}
                      className={cn(
                        'rounded-card border bg-panel p-4',
                        detail.correct ? 'border-accent/30' : detail.answered ? 'border-danger/30' : 'border-line',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium leading-snug text-ink">
                          <span className="mr-1.5 text-muted">{questionIndex + 1}.</span>
                          {detail.question.question}
                        </p>
                        <span
                          className={cn(
                            'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]',
                            detail.correct
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : detail.answered
                                ? 'border-danger/40 bg-danger/10 text-danger'
                                : 'border-line bg-panel2 text-muted',
                          )}
                        >
                          {detail.correct ? 'Correct' : detail.answered ? 'Incorrect' : 'Unanswered'}
                        </span>
                      </div>

                      <div className="mt-2 grid gap-1 text-[11.5px] leading-relaxed sm:grid-cols-2">
                        <p className="text-ink2">
                          <span className="text-muted">Your answer: </span>
                          {optionText(detail.question, detail.given)}
                        </p>
                        <p className="text-ink2">
                          <span className="text-muted">Correct: </span>
                          {optionText(detail.question, detail.question.correctAnswer)}
                        </p>
                      </div>

                      {quiz.settings.showExplanations && detail.question.explanation && (
                        <p className="mt-2 border-t border-line pt-2 text-[11.5px] leading-relaxed text-muted">
                          {detail.question.explanation}
                        </p>
                      )}
                    </li>
                  );
                })}
                {reviewItems.length === 0 && (
                  <li className="rounded-card border border-dashed border-line px-4 py-6 text-center text-[12px] text-ink2">
                    Nothing in this filter — {reviewFilter === 'incorrect' ? 'no incorrect answers' : 'every question was answered'}.
                  </li>
                )}
              </ol>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel2/50 px-4 py-3">
              <p className="text-[11.5px] text-ink2">
                {pluralize(history.length, 'saved attempt')} for this questionnaire.
              </p>
              <Button variant="ghost" size="sm" onClick={() => setPhase('intro')}>
                View attempt history
              </Button>
            </div>
          </div>
        )}
      </main>

      <Dialog
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        title="Question overview"
        size="sm"
        footer={
          <Button
            onClick={() => {
              setOverviewOpen(false);
              if (answeredCount < quiz.questions.length) setConfirmSubmit(true);
              else void submit();
            }}
          >
            <Flag size={14} /> Submit questionnaire
          </Button>
        }
      >
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {questions.map((question, questionIndex) => {
            const answered = isQuestionAnswered(question, answers[question.id]);
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => {
                  setIndex(questionIndex);
                  setOverviewOpen(false);
                }}
                className={cn(
                  'h-9 rounded border text-[11.5px] tabular-nums',
                  questionIndex === index
                    ? 'border-accent text-accent'
                    : answered
                      ? 'border-accent/30 bg-accent/15 text-ink'
                      : 'border-line bg-panel2 text-muted',
                )}
              >
                {questionIndex + 1}
              </button>
            );
          })}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmSubmit}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={() => void submit()}
        title="Submit the questionnaire?"
        confirmLabel="Submit answers"
        message={
          answeredCount < quiz.questions.length
            ? `You have ${quiz.questions.length - answeredCount} unanswered question${
                quiz.questions.length - answeredCount === 1 ? '' : 's'
              }. Unanswered questions score zero.`
            : 'All questions are answered. You cannot change your answers after submitting.'
        }
      />

      <ConfirmDialog
        open={confirmExit}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          exitToSubject();
        }}
        tone="danger"
        title="Leave this attempt?"
        confirmLabel="Discard attempt"
        message="Your answers will be discarded and no result will be saved."
      />
    </div>
  );
}
