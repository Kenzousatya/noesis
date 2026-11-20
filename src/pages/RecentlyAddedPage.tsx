import { useMemo, useState } from 'react';
import { Clock3, Grid2x2, List } from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { useSettings } from '../state/SettingsProvider';
import { SUBJECTS } from '../lib/constants';
import { GRADES } from '../lib/types';
import type { Grade, ResourceType, SubjectName } from '../lib/types';
import { sortResources } from '../lib/utils';
import { ResourceCard } from '../components/ResourceCard';
import { Button, EmptyState, IconButton, Segmented, Select } from '../components/ui';

export default function RecentlyAddedPage() {
  const { resources } = useLibrary();
  const { settings, setLibraryView } = useSettings();
  const [type, setType] = useState<'all' | ResourceType>('all');
  const [subject, setSubject] = useState<'all' | SubjectName>('all');
  const [grade, setGrade] = useState<'all' | Grade>('all');
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'name-asc'>('date-desc');

  const list = useMemo(
    () =>
      sortResources(
        resources.filter(
          (resource) =>
            (type === 'all' || resource.type === type) &&
            (subject === 'all' || resource.subject === subject) &&
            (grade === 'all' || resource.grade === grade),
        ),
        sort,
      ),
    [resources, type, subject, grade, sort],
  );

  const filtersActive = type !== 'all' || subject !== 'all' || grade !== 'all';
  const clearFilters = () => {
    setType('all');
    setSubject('all');
    setGrade('all');
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Archive</p>
        <h1 className="editorial mt-2 text-[28px] leading-tight text-ink sm:text-[34px]">Recently added.</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink2">
          Everything in NOEMA, ordered by the date it entered your library.
        </p>
      </header>

      <div className="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Resource type"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pdf', label: 'Materials' },
              { value: 'quiz', label: 'Quizzes' },
              { value: 'video', label: 'Videos' },
            ]}
            size="sm"
          />
          <Select value={subject} onChange={(event) => setSubject(event.target.value as 'all' | SubjectName)} aria-label="Filter by subject">
            <option value="all">All subjects</option>
            {SUBJECTS.map((entry) => (
              <option key={entry.slug} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </Select>
          <Select
            value={grade}
            onChange={(event) => setGrade(event.target.value === 'all' ? 'all' : (Number(event.target.value) as Grade))}
            aria-label="Filter by grade"
          >
            <option value="all">All grades</option>
            {GRADES.map((entry) => (
              <option key={entry} value={entry}>
                Grade {entry}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort resources">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="name-asc">Name A–Z</option>
          </Select>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex items-center gap-0.5 self-start rounded-input border border-line bg-panel2 p-0.5 lg:self-auto">
          <IconButton label="Grid view" active={settings.libraryView === 'grid'} onClick={() => setLibraryView('grid')}>
            <Grid2x2 size={15} />
          </IconButton>
          <IconButton label="List view" active={settings.libraryView === 'list'} onClick={() => setLibraryView('list')}>
            <List size={15} />
          </IconButton>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title={filtersActive ? 'Nothing matches these filters' : 'Nothing in the archive yet'}
          description={
            filtersActive
              ? 'Clear the filters, or add another resource from a subject page.'
              : 'Upload a PDF, import a questionnaire or save a video — it will appear here immediately.'
          }
          action={
            filtersActive ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-[11px] text-muted">
            {list.length} resource{list.length === 1 ? '' : 's'}
          </p>
          <div
            className={
              settings.libraryView === 'grid'
                ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3'
                : 'flex flex-col gap-2'
            }
          >
            {list.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} view={settings.libraryView} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
