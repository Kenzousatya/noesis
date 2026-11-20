import type { Grade, Resource, ResourceType, SubjectName } from './types';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function uid(prefix = 'r'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}${random}`;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : decimals)} ${units[index]}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} d ago`;
  return formatDate(ts);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

export function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'noema-export';
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}

export function gradeLabel(grade: Grade): string {
  return `Grade ${grade}`;
}

export function resourceMatches(resource: Resource, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const haystack = [
    resource.title,
    resource.description ?? '',
    resource.subject,
    `grade ${resource.grade}`,
    resource.type === 'pdf' ? resource.filename : '',
    resource.type === 'video' ? resource.url : '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function countBySubject(
  resources: Resource[],
): Record<string, { pdf: number; quiz: number; video: number; total: number }> {
  const counts: Record<string, { pdf: number; quiz: number; video: number; total: number }> = {};
  for (const resource of resources) {
    const entry = (counts[resource.subject] ??= { pdf: 0, quiz: 0, video: 0, total: 0 });
    entry[resource.type] += 1;
    entry.total += 1;
  }
  return counts;
}

export function typeCount(resources: Resource[], type: ResourceType, subject?: SubjectName, grade?: Grade): number {
  return resources.filter(
    (r) => r.type === type && (!subject || r.subject === subject) && (!grade || r.grade === grade),
  ).length;
}

export function sortResources<T extends Resource>(
  resources: T[],
  sort: 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc',
): T[] {
  const copy = [...resources];
  switch (sort) {
    case 'date-asc':
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case 'name-asc':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'name-desc':
      return copy.sort((a, b) => b.title.localeCompare(a.title));
    case 'size-desc':
      return copy.sort((a, b) => sizeOf(b) - sizeOf(a));
    case 'size-asc':
      return copy.sort((a, b) => sizeOf(a) - sizeOf(b));
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

function sizeOf(resource: Resource): number {
  return resource.type === 'pdf' ? resource.size : 0;
}
