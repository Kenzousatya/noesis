import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, FileText, HelpCircle, Youtube } from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { searchLibrary, resourceHref } from '../lib/search';
import { SUBJECTS } from '../lib/constants';
import { normalizeText, formatBytes } from '../lib/utils';
import type { Resource } from '../lib/types';

const typeIcon = {
  pdf: FileText,
  quiz: HelpCircle,
  video: Youtube,
} as const;

const typeLabel = {
  pdf: 'Study material',
  quiz: 'Questionnaire',
  video: 'Video',
} as const;

export function SearchResultsList({
  query,
  onNavigate,
  limit = 10,
  className,
}: {
  query: string;
  onNavigate?: () => void;
  limit?: number;
  className?: string;
}) {
  const { resources } = useLibrary();
  const navigate = useNavigate();

  const hits = useMemo(() => searchLibrary(resources, query).slice(0, limit), [resources, query, limit]);
  const subjectHits = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return [];
    return SUBJECTS.filter(
      (subject) => normalizeText(subject.name).includes(q) || normalizeText(subject.greek).includes(q),
    ).slice(0, 4);
  }, [query]);

  if (!normalizeText(query)) return null;

  const go = (resource: Resource) => {
    navigate(resourceHref(resource));
    onNavigate?.();
  };

  return (
    <div className={className}>
      {subjectHits.length > 0 && (
        <div className="border-b border-line px-2 py-2">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Subjects</p>
          <div className="flex flex-wrap gap-1.5 px-1">
            {subjectHits.map((subject) => (
              <button
                key={subject.slug}
                type="button"
                onClick={() => {
                  navigate(`/subject/${subject.slug}`);
                  onNavigate?.();
                }}
                className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel2 px-2.5 py-1.5 text-[12px] text-ink2 transition-colors hover:border-accent/40 hover:text-ink"
              >
                <subject.icon size={13} className="text-accent" aria-hidden="true" />
                {subject.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {hits.length === 0 && subjectHits.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-ink2">
          Nothing matched “{query}”. Try a subject, a grade or part of a title.
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          {hits.map(({ resource }) => {
            const Icon = typeIcon[resource.type];
            return (
              <li key={resource.id}>
                <button
                  type="button"
                  onClick={() => go(resource)}
                  className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-panel2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel2 text-accent">
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{resource.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      {typeLabel[resource.type]} · {resource.subject} · Grade {resource.grade}
                      {resource.type === 'pdf' && resource.size ? ` · ${formatBytes(resource.size)}` : ''}
                      {resource.type === 'quiz' ? ` · ${resource.questions.length} questions` : ''}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={14}
                    className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
