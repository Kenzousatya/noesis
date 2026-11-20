import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { SUBJECTS } from '../lib/constants';
import { countBySubject } from '../lib/utils';

export default function SubjectsPage() {
  const { resources } = useLibrary();
  const counts = countBySubject(resources);
  const total = resources.length;

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Ten disciplines</p>
        <h1 className="editorial mt-2 text-[28px] leading-tight text-ink sm:text-[34px]">
          A library for every subject.
        </h1>
        <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-ink2">
          Each subject keeps its own study materials, questionnaires and videos, separated by grade. Choose a
          discipline to enter its collection.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SUBJECTS.map((subject, index) => {
          const entry = counts[subject.name] ?? { pdf: 0, quiz: 0, video: 0, total: 0 };
          const featured = index === 0 && total > 0;
          return (
            <Link
              key={subject.slug}
              to={`/subject/${subject.slug}`}
              className={`group relative flex flex-col gap-4 overflow-hidden rounded-panel border border-line bg-panel p-5 transition-[transform,border-color,box-shadow] duration-200 ease-calm hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-lift ${
                featured ? 'sm:col-span-2' : ''
              }`}
            >
              {featured && (
                <svg
                  className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 opacity-70"
                  viewBox="0 0 240 200"
                  preserveAspectRatio="none"
                  fill="none"
                  aria-hidden="true"
                >
                  <g stroke="rgb(var(--accent))" strokeOpacity="0.12">
                    <path d="M40 0V200M120 0V200M200 0V200" />
                    <path d="M0 60H240M0 140H240" />
                  </g>
                </svg>
              )}
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-card border border-line bg-panel2 text-accent">
                    <subject.icon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className={`font-semibold text-ink ${featured ? 'text-[18px]' : 'text-[15px]'}`}>
                      {subject.name}
                    </h2>
                    <p className="mt-0.5 text-[10.5px] tracking-wide text-muted">
                      {String(index + 1).padStart(2, '0')} · {subject.greek}
                    </p>
                  </div>
                </div>
                <ArrowUpRight
                  size={15}
                  className="text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                  aria-hidden="true"
                />
              </div>

              <p className="relative max-w-lg text-[12.5px] leading-relaxed text-ink2">{subject.blurb}</p>

              <div className="relative mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3">
                {[
                  { label: 'Materials', value: entry.pdf },
                  { label: 'Quizzes', value: entry.quiz },
                  { label: 'Videos', value: entry.video },
                ].map((metric) => (
                  <div key={metric.label}>
                    <p className="text-[16px] font-semibold leading-none tabular-nums text-ink">{metric.value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted">{metric.label}</p>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
