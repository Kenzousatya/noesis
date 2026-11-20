import type { Grade, PdfResource, QuizQuestion, QuizResource, SubjectName } from './types';
import { isGrade, isSubjectName } from './constants';
import { uid } from './utils';
import { defaultSettings } from './quiz';

interface LegacyEntry {
  id?: string;
  type?: string;
  subject?: string;
  grade?: number | string;
  title?: string;
  file?: string;
  src?: string;
  quiz?: LegacyQuestion[];
  createdAt?: number;
}

interface LegacyQuestion {
  n?: number;
  text?: string;
  question?: string;
  options?: Array<string | { label?: string; text?: string }>;
  answer?: unknown;
  correctAnswer?: unknown;
  explanation?: string;
}

export interface BundledLibrary {
  pdfs: PdfResource[];
  quizzes: QuizResource[];
  skipped: string[];
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

const LETTERS = 'abcdefghijklmnop';

function legacyOptions(raw: LegacyQuestion): { options: Array<{ id: string; text: string }>; answerIds: string[] } {
  const options = (raw.options ?? []).map((option, index) => {
    if (typeof option === 'string') return { id: LETTERS[index], text: option.trim() };
    const label = (option.label ?? LETTERS[index]).toString().trim().toLowerCase();
    return { id: label || LETTERS[index], text: (option.text ?? '').trim() };
  });
  const answerRaw = raw.answer ?? raw.correctAnswer;
  let answers: string[] = [];
  if (Array.isArray(answerRaw)) answers = answerRaw.map((value) => String(value));
  else if (typeof answerRaw === 'string' || typeof answerRaw === 'number') answers = [String(answerRaw)];
  const validIds = new Set(options.map((option) => option.id));
  const answerIds: string[] = [];
  for (const value of answers) {
    const normalized = value.trim().toLowerCase();
    if (validIds.has(normalized)) {
      answerIds.push(normalized);
      continue;
    }
    // Legacy answers are occasionally written as "C" or "B, D" — extract letters.
    const letters = normalized.match(/[a-p]/g);
    if (letters) {
      for (const letter of letters) {
        if (validIds.has(letter) && !answerIds.includes(letter)) answerIds.push(letter);
      }
    }
  }
  return { options, answerIds };
}

function convertQuiz(entry: LegacyEntry, index: number): QuizResource | null {
  if (!entry.quiz?.length) return null;
  const grade = Number(entry.grade);
  if (!isGrade(grade)) return null;
  const now = Date.now();
  const questions: QuizQuestion[] = [];
  for (const raw of entry.quiz) {
    const { options, answerIds } = legacyOptions(raw);
    const text = (raw.text ?? raw.question ?? '').trim();
    if (!text || options.length < 2 || !answerIds.length) continue;
    questions.push({
      id: uid('q'),
      type: answerIds.length > 1 ? 'multiple_select' : 'multiple_choice',
      question: text,
      options,
      correctAnswer: answerIds,
      explanation: raw.explanation ?? '',
      points: 1,
    });
  }
  if (!questions.length) return null;
  return {
    id: uid('q'),
    type: 'quiz',
    subject: entry.subject as SubjectName,
    grade: grade as Grade,
    title: entry.title ?? `Bundled questionnaire ${index + 1}`,
    description: 'Imported from the bundled NOEMA library.',
    favorite: false,
    createdAt: entry.createdAt ?? now,
    updatedAt: now,
    settings: defaultSettings(),
    questions,
  };
}

async function fileExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return false;
    // A dev/SPA fallback answers with HTML and a 200 status; only accept real PDFs.
    const type = response.headers.get('content-type') ?? '';
    return type.includes('pdf') || type.includes('octet-stream');
  } catch {
    return false;
  }
}

/**
 * Reads the library that ships with the repository (public/library) and turns it
 * into NOEMA resources. Nothing is saved until the user confirms the import.
 */
export async function fetchBundledLibrary(baseUrl: string): Promise<BundledLibrary> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const manifestUrl = `${base}library/library.json`;
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error(`Bundled library not found (${response.status}).`);
  const entries = (await response.json()) as LegacyEntry[];
  if (!Array.isArray(entries)) throw new Error('Bundled library manifest is not a list of resources.');

  const skipped: string[] = [];
  const pdfs: PdfResource[] = [];
  const quizzes: QuizResource[] = [];

  const pdfEntries = entries.filter((entry) => entry.type === 'pdf' && entry.file);
  const resolved = await Promise.all(
    pdfEntries.map(async (entry) => {
      const url = `${base}library/files/${encodePath(entry.file!)}`;
      return { entry, url, exists: await fileExists(url) };
    }),
  );
  for (const { entry, url, exists } of resolved) {
    if (!entry.title || !isSubjectName(entry.subject) || !isGrade(Number(entry.grade))) {
      skipped.push(entry.file ?? entry.title ?? 'Unknown file');
      continue;
    }
    if (!exists) {
      skipped.push(entry.file!);
      continue;
    }
    pdfs.push({
      id: uid('p'),
      type: 'pdf',
      subject: entry.subject,
      grade: Number(entry.grade) as Grade,
      title: entry.title,
      favorite: false,
      createdAt: entry.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      filename: entry.file!.split('/').pop() ?? entry.file!,
      size: 0,
      sourceUrl: url,
    });
  }

  entries.forEach((entry, index) => {
    if (entry.type !== 'quiz') return;
    if (!isSubjectName(entry.subject)) {
      skipped.push(entry.title ?? 'Unknown quiz');
      return;
    }
    const quiz = convertQuiz(entry, index);
    if (quiz) quizzes.push(quiz);
    else skipped.push(entry.title ?? 'Unknown quiz');
  });

  return { pdfs, quizzes, skipped };
}
