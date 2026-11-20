import { useMemo, useState } from 'react';
import { Grid2x2, List, Star } from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { useSettings } from '../state/SettingsProvider';
import { SUBJECTS } from '../lib/constants';
import { GRADES } from '../lib/types';
import type { Grade, ResourceType, SubjectName } from '../lib/types';
import { sortResources } from '../lib/utils';
import { ResourceCard } from '../components/ResourceCard';
import { Button, EmptyState, IconButton, Segmented, Select } from '../components/ui';

export default function FavoritesPage() {
  const { resources } = useLibrary();
  const { settings, setLibraryView } = useSettings();
  const [type, setType] = useState<'all' | ResourceType>('all');
  const [subject, setSubject] = useState<'all' | SubjectName>('all');
  const [grade, setGrade] = useState<'all' | Grade>('all');
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'name-asc'>('date-desc');

  const favorites = useMemo(
    () =>
      sortResources(
        resources.filter(
          (resource) =>
            resource.favorite &&
            (type === 'all' || resource.type === type) &&
            (subject === 'all' || resource.subject === subject) &&
            (grade === 'all' || resource.grade === grade),
        ),
        sort,
      ),
    [resources, type, subject, grade, sort],
  );

  const totalFavorites = resources.filter((resource) => resource.favorite).length;
  const filtersActive = type !== 'all' || subject !== 'all' || grade !== 'all';

  const clearFilters = () => {
    setType('all');
    setSubject('all');
    setGrade('all');
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Curated</p>
        <h1 className="editorial mt-2 text-[28px] leading-tight text-ink sm:text-[34px]">Kept close.</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink2">
          {totalFavorites === 0
            ? 'Star a study material, questionnaire or video to keep it within reach.'
            : `${totalFavorites} starred resource${totalFavorites === 1 ? '' : 's'} across your archive.`}
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
          <Select
            value={subject}
            onChange={(event) => setSubject(event.target.value as 'all' | SubjectName)}
            aria-label="Filter by subject"
          >
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
          <Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort favorites">
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

      {favorites.length === 0 ? (
        <EmptyState
          icon={Star}
          title={filtersActive ? 'No favorites match these filters' : 'No favorites yet'}
          description={
            filtersActive
              ? 'Adjust or clear the filters to see other starred resources.'
              : 'Use the star on any resource card to collect it here. Removing a favorite never deletes the resource.'
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
            {favorites.length} resource{favorites.length === 1 ? '' : 's'}
          </p>
          <div
            className={
              settings.libraryView === 'grid'
                ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3'
                : 'flex flex-col gap-2'
            }
          >
            {favorites.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} view={settings.libraryView} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
