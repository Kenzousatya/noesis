import {
  Atom,
  BookMarked,
  Compass,
  Dna,
  Feather,
  Globe2,
  HeartHandshake,
  Languages,
  Landmark,
  Quote,
  Sigma,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Grade, Resource, SubjectName } from './types';

export interface SubjectMeta {
  name: SubjectName;
  slug: string;
  icon: LucideIcon;
  greek: string;
  blurb: string;
}

export const SUBJECTS: SubjectMeta[] = [
  { name: 'Mathematics', slug: 'mathematics', icon: Sigma, greek: 'Μαθηματικά', blurb: 'Numbers, structures and proof' },
  { name: 'Physics', slug: 'physics', icon: Atom, greek: 'Φυσική', blurb: 'Matter, motion and energy' },
  { name: 'Biology', slug: 'biology', icon: Dna, greek: 'Βιολογία', blurb: 'Life and living systems' },
  { name: 'Social Studies', slug: 'social-studies', icon: Globe2, greek: 'Κοινωνικές Σπουδές', blurb: 'People, place and society' },
  { name: 'Indonesian', slug: 'indonesian', icon: Quote, greek: 'Ινδονησιακά', blurb: 'Language and literature' },
  { name: 'English', slug: 'english', icon: Type, greek: 'Αγγλικά', blurb: 'Language and composition' },
  { name: 'Deutsch', slug: 'deutsch', icon: Languages, greek: 'Γερμανικά', blurb: 'Sprache und Kultur' },
  { name: 'Sundanese', slug: 'sundanese', icon: Feather, greek: 'Σουνδανικά', blurb: 'Basa jeung budaya' },
  { name: 'Religion', slug: 'religion', icon: HeartHandshake, greek: 'Θρησκεία', blurb: 'Faith, ethics and practice' },
  { name: 'Pancasila', slug: 'pancasila', icon: Landmark, greek: 'Πανκασίλα', blurb: 'Civics and national values' },
];

export const SUBJECT_BY_NAME = new Map(SUBJECTS.map((s) => [s.name, s]));
export const SUBJECT_BY_SLUG = new Map(SUBJECTS.map((s) => [s.slug, s]));

export function subjectMeta(name: string): SubjectMeta {
  return (
    SUBJECT_BY_NAME.get(name as SubjectName) ?? {
      name: name as SubjectName,
      slug: slugify(name),
      icon: BookMarked,
      greek: '',
      blurb: '',
    }
  );
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isSubjectName(value: unknown): value is SubjectName {
  return typeof value === 'string' && SUBJECT_BY_NAME.has(value as SubjectName);
}

export function isGrade(value: unknown): value is Grade {
  return value === 7 || value === 8 || value === 9;
}

export const RESOURCE_TYPE_LABEL: Record<Resource['type'], string> = {
  pdf: 'Study material',
  quiz: 'Questionnaire',
  video: 'Video',
};

export const ANNOTATION_COLORS = [
  { name: 'Sage', value: '#8BBFA8' },
  { name: 'Parchment', value: '#C4AD84' },
  { name: 'Clay', value: '#D57C77' },
  { name: 'Slate', value: '#8FA6C4' },
  { name: 'Olive', value: '#B6C48B' },
];

export const QUIZ_TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Multiple choice',
  multiple_select: 'Multiple select',
  true_false: 'True or false',
  short_answer: 'Short answer',
};

