import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Database } from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { SUBJECTS, SUBJECT_BY_SLUG } from '../lib/constants';
import { GRADES } from '../lib/types';
import type { Grade } from '../lib/types';
import { Segmented, EmptyState, Button } from '../components/ui';
import { cn } from '../lib/utils';
import PdfSection from '../sections/PdfSection';
import QuizSection from '../sections/QuizSection';
import VideoSection from '../sections/VideoSection';

type TabKey = 'materials' | 'quizzes' | 'videos';

const TABS: Array<{ key: TabKey; label: string; short: string }> = [
  { key: 'materials', label: 'Study Materials', short: 'PDF library' },
  { key: 'quizzes', label: 'Practice Questionnaires', short: 'JSON quizzes' },
  { key: 'videos', label: 'Video Bank', short: 'YouTube' },
];

export default function SubjectPage() {
  const { slug } = useParams();
  const subject = slug ? SUBJECT_BY_SLUG.get(slug) : undefined;
  const [params, setParams] = useSearchParams();
  const { resources } = useLibrary();

  const tabParam = params.get('tab');
  const tab: TabKey = tabParam === 'quizzes' || tabParam === 'videos' ? tabParam : 'materials';
  const gradeParam = Number(params.get('grade'));
  const grade: Grade = GRADES.includes(gradeParam as Grade) ? (gradeParam as Grade) : 7;

  const counts = useMemo(() => {
    if (!subject) return { pdf: 0, quiz: 0, video: 0 };
    const relevant = resources.filter((resource) => resource.subject === subject.name);
    return {
      pdf: relevant.filter((resource) => resource.type === 'pdf').length,
      quiz: relevant.filter((resource) => resource.type === 'quiz').length,
      video: relevant.filter((resource) => resource.type === 'video').length,
    };
  }, [resources, subject]);

  const gradeCounts = useMemo(() => {
    if (!subject) return { 7: 0, 8: 0, 9: 0 } as Record<Grade, number>;
    const type = tab === 'materials' ? 'pdf' : tab === 'quizzes' ? 'quiz' : 'video';
    return {
      7: resources.filter((r) => r.subject === subject.name && r.type === type && r.grade === 7).length,
      8: resources.filter((r) => r.subject === subject.name && r.type === type && r.grade === 8).length,
      9: resources.filter((r) => r.subject === subject.name && r.type === type && r.grade === 9).length,
    } as Record<Grade, number>;
  }, [resources, subject, tab]);

  const setTab = (next: TabKey) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set('tab', next);
        updated.set('grade', String(grade));
        return updated;
      },
      { replace: true },
    );
  };

  const setGrade = (next: Grade) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set('grade', String(next));
        updated.set('tab', tab);
        return updated;
      },
      { replace: true },
    );
  };

  if (!subject) {
    return (
      <EmptyState
        icon={Database}
        title="Subject not found"
        description="That subject is not part of the NOEMA archive. Choose one of the ten disciplines instead."
        action={
          <Link to="/subjects">
            <Button>Browse subjects</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-panel border border-line bg-panel px-5 py-5">
        <span
          className="pointer-events-none absolute -right-2 -top-8 select-none font-serif text-[150px] leading-none text-ink/[0.035]"
          aria-hidden="true"
        >
          {String(SUBJECTS.findIndex((entry) => entry.slug === subject.slug) + 1).padStart(2, '0')}
        </span>
        <svg
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 opacity-60"
          viewBox="0 0 300 220"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <g stroke="rgb(var(--accent))" strokeOpacity="0.1">
            <path d="M60 0V220M140 0V220M220 0V220M300 0V220" />
            <path d="M0 60H300M0 140H300" />
          </g>
        </svg>

        <nav aria-label="Breadcrumb" className="relative flex items-center gap-1.5 text-[10.5px] text-muted">
          <Link to="/subjects" className="transition-colors hover:text-accent">
            Academic library
          </Link>
          <ChevronRight size={10} aria-hidden="true" />
          <span className="text-ink2">{subject.name}</span>
        </nav>

        <div className="relative mt-3 flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-panel border border-line bg-panel2 text-accent">
              <subject.icon size={22} aria-hidden="true" />
            </span>
            <div>
              <h1 className="editorial text-[28px] leading-none text-ink sm:text-[34px]">{subject.name}</h1>
              <p className="mt-1.5 text-[11.5px] tracking-wide text-muted">
                {subject.greek} · {subject.blurb}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-t border-line pt-3 sm:border-none sm:pt-0">
            {[
              { label: 'Materials', value: counts.pdf },
              { label: 'Questionnaires', value: counts.quiz },
              { label: 'Videos', value: counts.video },
            ].map((metric) => (
              <div key={metric.label} className="min-w-[56px]">
                <p className="text-[16px] font-semibold leading-none tabular-nums text-ink">{metric.value}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Section tabs */}
      <div className="border-b border-line">
        <div role="tablist" aria-label="Subject sections" className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <button
                key={item.key}
                role="tab"
                id={`tab-${item.key}`}
                aria-selected={active}
                aria-controls={`panel-${item.key}`}
                type="button"
                onClick={() => setTab(item.key)}
                onKeyDown={(event) => {
                  const index = TABS.findIndex((entry) => entry.key === tab);
                  if (event.key === 'ArrowRight') setTab(TABS[(index + 1) % TABS.length].key);
                  if (event.key === 'ArrowLeft') setTab(TABS[(index - 1 + TABS.length) % TABS.length].key);
                }}
                className={cn(
                  'relative shrink-0 px-3.5 py-3 text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                  active ? 'text-ink' : 'text-ink2 hover:text-ink',
                )}
              >
                <span className="inline-flex items-baseline gap-2">
                  {item.label}
                  <span className="hidden text-[10px] uppercase tracking-[0.12em] text-muted sm:inline">
                    {item.short}
                  </span>
                </span>
                {active && (
                  <motion.span
                    layoutId="subject-tab-indicator"
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent"
                    transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Grade"
          value={grade}
          onChange={(value) => setGrade(value as Grade)}
          options={GRADES.map((entry) => ({
            value: entry,
            label: (
              <>
                Grade {entry}
                <span className="text-[10px] text-muted">{gradeCounts[entry]}</span>
              </>
            ),
            hint:
              entry === 7
                ? 'Grade 7 collection'
                : entry === 8
                  ? 'Grade 8 collection'
                  : 'Grade 9 collection',
          }))}
        />
        <p className="text-[11px] text-muted">
          Grade {grade} · {TABS.find((item) => item.key === tab)?.label}
        </p>
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        key={`${tab}-${grade}`}
      >
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {tab === 'materials' && <PdfSection subject={subject.name} grade={grade} />}
          {tab === 'quizzes' && <QuizSection subject={subject.name} grade={grade} />}
          {tab === 'videos' && <VideoSection subject={subject.name} grade={grade} />}
        </motion.div>
      </div>
    </div>
  );
}
