import type { Resource, SearchHit } from './types';
import { normalizeText } from './utils';

/** Ranked search across titles, descriptions, filenames, subjects and grades. */
export function searchLibrary(resources: Resource[], query: string): SearchHit[] {
  const q = normalizeText(query);
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const resource of resources) {
    const title = normalizeText(resource.title);
    const description = normalizeText(resource.description ?? '');
    const filename = resource.type === 'pdf' ? normalizeText(resource.filename) : '';
    const subject = normalizeText(resource.subject);
    const grade = `grade ${resource.grade}`;
    let score = 0;
    let matchedField = '';
    if (title === q) {
      score = 120;
      matchedField = 'title';
    } else if (title.startsWith(q)) {
      score = 100;
      matchedField = 'title';
    } else if (title.includes(q)) {
      score = 80;
      matchedField = 'title';
    } else if (filename.includes(q)) {
      score = 62;
      matchedField = 'filename';
    } else if (subject.includes(q)) {
      score = 50;
      matchedField = 'subject';
    } else if (description.includes(q)) {
      score = 40;
      matchedField = 'description';
    } else if (grade.includes(q)) {
      score = 30;
      matchedField = 'grade';
    }
    if (score) hits.push({ resource, score, matchedField });
  }
  return hits.sort((a, b) => b.score - a.score || b.resource.createdAt - a.resource.createdAt);
}

export function resourceHref(resource: Resource): string {
  if (resource.type === 'pdf') return `/pdf/${resource.id}`;
  if (resource.type === 'quiz') return `/quiz/${resource.id}`;
  return `/video/${resource.id}`;
}
