import type {
  AnswerMap,
  Grade,
  QuizOption,
  QuizQuestion,
  QuizResource,
  QuizSettings,
  QuestionType,
  SubjectName,
} from './types';
import { GRADES, SUBJECT_NAMES } from './types';
import { isGrade, isSubjectName } from './constants';
import { normalizeText, uid } from './utils';

export const QUESTION_TYPES: QuestionType[] = [
  'multiple_choice',
  'multiple_select',
  'true_false',
  'short_answer',
];

export function defaultSettings(): QuizSettings {
  return {
    shuffleQuestions: false,
    shuffleOptions: false,
    showExplanations: true,
    timerMinutes: null,
    passingScore: 70,
  };
}

function optionLetters(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String.fromCharCode(97 + index));
}

export function newOption(index: number, text = ''): QuizOption {
  return { id: String.fromCharCode(97 + index), text };
}

export function defaultOptions(): QuizOption[] {
  return optionLetters(4).map((id) => ({ id, text: '' }));
}

export function newQuestion(type: QuestionType = 'multiple_choice'): QuizQuestion {
  const base: QuizQuestion = {
    id: uid('q'),
    type,
    question: '',
    correctAnswer: [],
    explanation: '',
    points: 1,
  };
  if (type === 'multiple_choice' || type === 'multiple_select') {
    return { ...base, options: defaultOptions() };
  }
  if (type === 'true_false') {
    return { ...base, options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }] };
  }
  return base;
}

export function newQuiz(subject: SubjectName, grade: Grade): QuizResource {
  const now = Date.now();
  return {
    id: uid('q'),
    type: 'quiz',
    subject,
    grade,
    title: 'Untitled questionnaire',
    description: '',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    difficulty: 'medium',
    settings: defaultSettings(),
    questions: [newQuestion()],
  };
}

export function cloneQuiz(quiz: QuizResource): QuizResource {
  const now = Date.now();
  return {
    ...structuredClone(quiz),
    id: uid('q'),
    title: `${quiz.title} (copy)`,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    questions: quiz.questions.map((question) => ({ ...structuredClone(question), id: uid('q') })),
  };
}

export function isQuestionAnswered(question: QuizQuestion, answer: string[] | undefined): boolean {
  if (!answer || !answer.length) return false;
  if (question.type === 'short_answer') return Boolean(answer[0]?.trim());
  return answer.some(Boolean);
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function isCorrect(question: QuizQuestion, answer: string[] | undefined): boolean {
  if (!isQuestionAnswered(question, answer)) return false;
  const given = answer ?? [];
  if (question.type === 'short_answer') {
    const normalized = normalizeText(given[0] ?? '');
    return question.correctAnswer.some((accepted) => normalizeText(accepted) === normalized);
  }
  if (question.type === 'multiple_select') {
    return sameSet(given, question.correctAnswer);
  }
  return given.length === 1 && given[0] === question.correctAnswer[0];
}

export interface ScoreDetail {
  question: QuizQuestion;
  given: string[];
  correct: boolean;
  answered: boolean;
}

export interface QuizScore {
  score: number;
  maxScore: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  details: ScoreDetail[];
}

export function scoreQuiz(quiz: QuizResource, answers: AnswerMap): QuizScore {
  let score = 0;
  let maxScore = 0;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const details: ScoreDetail[] = quiz.questions.map((question) => {
    const given = answers[question.id] ?? [];
    const answered = isQuestionAnswered(question, given);
    const isRight = answered && isCorrect(question, given);
    const points = Number.isFinite(question.points) ? question.points : 1;
    maxScore += points;
    if (!answered) unanswered += 1;
    else if (isRight) {
      correct += 1;
      score += points;
    } else incorrect += 1;
    return { question, given, correct: isRight, answered };
  });
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { score, maxScore, percentage, correct, incorrect, unanswered, details };
}

export function quizDurationMinutes(quiz: QuizResource): number {
  if (quiz.settings.timerMinutes) return quiz.settings.timerMinutes;
  return Math.max(1, Math.round(quiz.questions.length * 1.25));
}

export interface ValidationResult {
  quiz?: QuizResource;
  errors: string[];
}

function normalizeOptions(raw: unknown): { options: QuizOption[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { options: [], errors: ['"options" must be an array.'] };
  const options: QuizOption[] = [];
  raw.forEach((entry, index) => {
    if (typeof entry === 'string') {
      if (!entry.trim()) errors.push(`Option ${index + 1} is empty.`);
      options.push({ id: String.fromCharCode(97 + index), text: entry.trim() });
      return;
    }
    if (!entry || typeof entry !== 'object') {
      errors.push(`Option ${index + 1} must be an object with "id" and "text".`);
      return;
    }
    const option = entry as Record<string, unknown>;
    const text = typeof option.text === 'string' ? option.text.trim() : '';
    const id = typeof option.id === 'string' && option.id.trim() ? option.id.trim() : String.fromCharCode(97 + index);
    if (!text) errors.push(`Option ${index + 1} has no text.`);
    if (options.some((existing) => existing.id === id)) errors.push(`Duplicate option id "${id}".`);
    options.push({ id, text });
  });
  if (options.length < 2) errors.push('At least two options are required.');
  return { options, errors };
}

export function validateQuestion(raw: unknown, index: number): { question?: QuizQuestion; errors: string[] } {
  const path = `Question ${index + 1}`;
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { errors: [`${path}: expected an object.`] };
  }
  const input = raw as Record<string, unknown>;
  const type = input.type;
  if (typeof type !== 'string' || !QUESTION_TYPES.includes(type as QuestionType)) {
    errors.push(
      `${path}: unsupported type "${String(type)}". Supported types: ${QUESTION_TYPES.join(', ')}.`,
    );
    return { errors };
  }
  const questionType = type as QuestionType;
  const text =
    typeof input.question === 'string'
      ? input.question
      : typeof input.text === 'string'
        ? input.text
        : typeof input.prompt === 'string'
          ? input.prompt
          : '';
  if (!text.trim()) errors.push(`${path}: the question text is missing.`);

  const pointsRaw = input.points;
  const points = typeof pointsRaw === 'number' && pointsRaw > 0 ? pointsRaw : 1;
  if (pointsRaw !== undefined && (typeof pointsRaw !== 'number' || pointsRaw <= 0)) {
    errors.push(`${path}: "points" must be a positive number.`);
  }

  let options: QuizOption[] | undefined;
  if (questionType === 'multiple_choice' || questionType === 'multiple_select') {
    const normalized = normalizeOptions(input.options);
    options = normalized.options;
    errors.push(...normalized.errors.map((error) => `${path}: ${error}`));
  }
  if (questionType === 'true_false') {
    options = [
      { id: 'true', text: 'True' },
      { id: 'false', text: 'False' },
    ];
  }

  const answerRaw = input.correctAnswer ?? input.answer;
  let correctAnswer: string[] = [];
  if (Array.isArray(answerRaw)) {
    correctAnswer = answerRaw.map((entry) => String(entry).trim()).filter(Boolean);
  } else if (typeof answerRaw === 'string' || typeof answerRaw === 'number') {
    correctAnswer = [String(answerRaw).trim()].filter(Boolean);
  } else if (answerRaw !== undefined) {
    errors.push(`${path}: "correctAnswer" must be an array of strings.`);
  }

  if (!correctAnswer.length) {
    errors.push(`${path}: "correctAnswer" is required.`);
  }

  if (questionType === 'multiple_choice' && correctAnswer.length > 1) {
    errors.push(`${path}: multiple choice questions accept exactly one correct answer.`);
  }
  if (questionType === 'multiple_select' && correctAnswer.length < 1) {
    errors.push(`${path}: multiple select questions need at least one correct answer.`);
  }
  if (questionType === 'true_false') {
    const lowered = correctAnswer.map((value) => value.toLowerCase());
    if (lowered.length !== 1 || (lowered[0] !== 'true' && lowered[0] !== 'false')) {
      errors.push(`${path}: true/false answers must be "true" or "false".`);
    } else {
      correctAnswer = [lowered[0]];
    }
  }
  if (options && (questionType === 'multiple_choice' || questionType === 'multiple_select')) {
    const validIds = new Set(options.map((option) => option.id));
    for (const answer of correctAnswer) {
      if (!validIds.has(answer)) {
        errors.push(`${path}: correct answer "${answer}" does not reference an option id (${[...validIds].join(', ')}).`);
      }
    }
  }
  if (questionType === 'short_answer' && correctAnswer.some((value) => !value.trim())) {
    errors.push(`${path}: accepted answers cannot be blank.`);
  }

  if (errors.length) return { errors };

  const question: QuizQuestion = {
    id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : uid('q'),
    type: questionType,
    question: text.trim(),
    correctAnswer,
    explanation: typeof input.explanation === 'string' ? input.explanation.trim() : '',
    points,
  };
  if (options) question.options = options;
  return { question, errors: [] };
}

export interface ParsedQuizFile {
  quizzes: QuizResource[];
  errors: string[];
}

export function parseQuizJson(text: string, filename = 'quiz.json', fallbackSubject?: SubjectName, fallbackGrade?: Grade): ParsedQuizFile {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { quizzes: [], errors: [`${filename}: invalid JSON — ${(error as Error).message}`] };
  }

  let entries: unknown[] = [];
  if (Array.isArray(raw)) entries = raw;
  else if (raw && typeof raw === 'object') {
    const object = raw as Record<string, unknown>;
    if (Array.isArray(object.quizzes)) entries = object.quizzes;
    else if (Array.isArray(object.questions)) entries = [object];
    else errors.push(`${filename}: expected a quiz object, an array of quizzes, or { "quizzes": [...] }.`);
  } else {
    errors.push(`${filename}: the file does not contain a JSON object.`);
  }
  if (!entries.length) {
    if (!errors.length) errors.push(`${filename}: no quizzes found in this file.`);
    return { quizzes: [], errors };
  }

  const quizzes: QuizResource[] = [];
  entries.forEach((entry, index) => {
    const label = entries.length > 1 ? `${filename} — quiz ${index + 1}` : filename;
    const result = validateQuiz(entry, label, fallbackSubject, fallbackGrade);
    errors.push(...result.errors);
    if (result.quiz) quizzes.push(result.quiz);
  });
  return { quizzes, errors };
}

export function validateQuiz(
  raw: unknown,
  label = 'quiz',
  fallbackSubject?: SubjectName,
  fallbackGrade?: Grade,
): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { errors: [`${label}: expected a quiz object.`] };
  }
  const input = raw as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) errors.push(`${label}: "title" is required.`);

  if (input.schemaVersion !== undefined && typeof input.schemaVersion !== 'number') {
    errors.push(`${label}: "schemaVersion" must be a number.`);
  }

  const subject = isSubjectName(input.subject) ? input.subject : fallbackSubject;
  if (!subject) {
    errors.push(`${label}: "subject" must be one of ${SUBJECT_NAMES.join(', ')}.`);
  }

  const grade = isGrade(input.grade) ? input.grade : isGrade(Number(input.grade)) ? (Number(input.grade) as Grade) : fallbackGrade;
  if (!grade) {
    errors.push(`${label}: "grade" must be 7, 8 or 9.`);
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    errors.push(`${label}: "questions" must be a non-empty array.`);
  }

  const questions: QuizQuestion[] = [];
  const questionIds = new Set<string>();
  if (Array.isArray(input.questions)) {
    input.questions.forEach((entry, index) => {
      const result = validateQuestion(entry, index);
      errors.push(...result.errors.map((error) => `${label}: ${error}`));
      if (result.question) {
        if (questionIds.has(result.question.id)) result.question.id = uid('q');
        questionIds.add(result.question.id);
        questions.push(result.question);
      }
    });
  }

  const settingsInput = (input.settings && typeof input.settings === 'object' ? input.settings : {}) as Record<string, unknown>;
  const settings: QuizSettings = {
    shuffleQuestions: Boolean(settingsInput.shuffleQuestions),
    shuffleOptions: Boolean(settingsInput.shuffleOptions),
    showExplanations: settingsInput.showExplanations !== false,
    timerMinutes:
      typeof settingsInput.timerMinutes === 'number' && settingsInput.timerMinutes > 0
        ? Math.round(settingsInput.timerMinutes)
        : null,
    passingScore:
      typeof settingsInput.passingScore === 'number' && settingsInput.passingScore >= 0 && settingsInput.passingScore <= 100
        ? settingsInput.passingScore
        : 70,
  };

  const difficultyRaw = input.difficulty;
  const difficulty =
    difficultyRaw === 'easy' || difficultyRaw === 'medium' || difficultyRaw === 'hard' ? difficultyRaw : undefined;

  if (errors.length || !subject || !grade) return { errors };

  const now = Date.now();
  return {
    quiz: {
      id: uid('q'),
      type: 'quiz',
      subject,
      grade,
      title,
      description: typeof input.description === 'string' ? input.description : '',
      favorite: false,
      createdAt: now,
      updatedAt: now,
      difficulty,
      settings,
      questions,
    },
    errors: [],
  };
}

export function exportQuizJson(quiz: QuizResource) {
  return {
    schemaVersion: 1,
    title: quiz.title,
    description: quiz.description ?? '',
    subject: quiz.subject,
    grade: quiz.grade,
    difficulty: quiz.difficulty,
    settings: {
      shuffleQuestions: quiz.settings.shuffleQuestions,
      shuffleOptions: quiz.settings.shuffleOptions,
      showExplanations: quiz.settings.showExplanations,
      timerMinutes: quiz.settings.timerMinutes,
      passingScore: quiz.settings.passingScore,
    },
    questions: quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      question: question.question,
      ...(question.options ? { options: question.options } : {}),
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? '',
      points: question.points,
    })),
  };
}

export function quizValidationErrors(quiz: QuizResource): string[] {
  const errors: string[] = [];
  if (!quiz.title.trim()) errors.push('Give the questionnaire a title.');
  if (!quiz.questions.length) errors.push('Add at least one question.');
  quiz.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question.question.trim()) errors.push(`${label}: the question text is empty.`);
    if (question.type === 'multiple_choice' || question.type === 'multiple_select') {
      const options = question.options ?? [];
      if (options.length < 2) errors.push(`${label}: add at least two options.`);
      if (options.some((option) => !option.text.trim())) errors.push(`${label}: every option needs text.`);
      if (!question.correctAnswer.length) errors.push(`${label}: mark the correct answer.`);
      const ids = new Set(options.map((option) => option.id));
      if (question.correctAnswer.some((answer) => !ids.has(answer))) {
        errors.push(`${label}: the marked correct answer no longer exists.`);
      }
      if (question.type === 'multiple_choice' && question.correctAnswer.length > 1) {
        errors.push(`${label}: multiple choice allows a single correct answer.`);
      }
    }
    if (question.type === 'true_false' && question.correctAnswer.length !== 1) {
      errors.push(`${label}: choose true or false.`);
    }
    if (question.type === 'short_answer' && !question.correctAnswer.filter((value) => value.trim()).length) {
      errors.push(`${label}: add at least one accepted answer.`);
    }
  });
  return errors;
}

export const QUIZ_GRADES = GRADES;
