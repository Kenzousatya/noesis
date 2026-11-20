import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock3, Grid2x2, HelpCircle, Import, List, Plus } from 'lucide-react';
import type { Grade, QuizResource, SubjectName } from '../lib/types';
import { useLibrary } from '../state/LibraryProvider';
import { useSettings } from '../state/SettingsProvider';
import {
  formatDateTime,
  formatDuration,
  pluralize,
  resourceMatches,
  sortResources,
} from '../lib/utils';
import { quizDurationMinutes } from '../lib/quiz';
import { QUIZ_TYPE_LABEL } from '../lib/constants';
import { ResourceCard } from '../components/ResourceCard';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  SearchField,
  Select,
} from '../components/ui';
import { Dialog } from '../components/Dialog';
import { QuizImportDialog } from './QuizImportDialog';

function QuizPreview({ quiz, onClose }: { quiz: QuizResource | null; onClose: () => void }) {
  return (
    <Dialog
      open={Boolean(quiz)}
      onClose={onClose}
      title={quiz?.title ?? ''}
      description={
        quiz
          ? `${quiz.subject} · Grade ${quiz.grade} · ${pluralize(quiz.questions.length, 'question')} · ~${quizDurationMinutes(
              quiz,
            )} min`
          : undefined
      }
      size="xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close preview
        </Button>
      }
    >
      {quiz && (
        <div className="flex flex-col gap-4">
          {quiz.description && <p className="text-[12.5px] leading-relaxed text-ink2">{quiz.description}</p>}
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="accent">{quiz.settings.showExplanations ? 'Explanations on' : 'Explanations off'}</Badge>
            <Badge>{quiz.settings.timerMinutes ? `${quiz.settings.timerMinutes} min timer` : 'No timer'}</Badge>
            <Badge>Pass mark {quiz.settings.passingScore}%</Badge>
            {quiz.settings.shuffleQuestions && <Badge>Shuffled questions</Badge>}
            {quiz.settings.shuffleOptions && <Badge>Shuffled options</Badge>}
          </div>
          <ol className="flex flex-col gap-2.5">
            {quiz.questions.map((question, index) => (
              <li key={question.id} className="rounded-card border border-line bg-panel2/50 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12.5px] font-medium leading-snug text-ink">
                    <span className="mr-1.5 text-muted">{index + 1}.</span>
                    {question.question}
                  </p>
                  <Badge>{QUIZ_TYPE_LABEL[question.type]}</Badge>
                </div>
                {question.options && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {question.options.map((option) => {
                      const correct = question.correctAnswer.includes(option.id);
                      return (
                        <li
                          key={option.id}
                          className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[12px] ${
                            correct
                              ? 'border-accent/40 bg-accent/10 text-ink'
                              : 'border-transparent text-ink2'
                          }`}
                        >
                          <span className="w-3 text-[10px] uppercase text-muted">{option.id}</span>
                          <span className="flex-1">{option.text}</span>
                          {correct && <Check size={12} className="text-accent" aria-label="Correct answer" />}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {question.type === 'short_answer' && (
                  <p className="mt-2 text-[11.5px] text-ink2">
                    Accepted answers: <span className="text-ink">{question.correctAnswer.join(' · ')}</span>
                  </p>
                )}
                {question.explanation && (
                  <p className="mt-2 border-t border-line pt-2 text-[11.5px] leading-relaxed text-muted">
                    {question.explanation}
                  </p>
                )}
                <p className="mt-1.5 text-[10.5px] text-muted">{question.points} point{question.points === 1 ? '' : 's'}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Dialog>
  );
}

export default function QuizSection({ subject, grade }: { subject: SubjectName; grade: Grade }) {
  const { resources, attempts } = useLibrary();
  const { settings, setLibraryView } = useSettings();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'name-asc'>('date-desc');
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<QuizResource | null>(null);

  const quizzes = useMemo(
    () =>
      resources.filter(
        (resource): resource is QuizResource =>
          resource.type === 'quiz' &&
          resource.subject === subject &&
          resource.grade === grade &&
          resourceMatches(resource, query),
      ),
    [resources, subject, grade, query],
  );
  const sorted = useMemo(() => sortResources(quizzes, sort), [quizzes, sort]);
  const totalQuestions = quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);

  const collectionAttempts = useMemo(
    () =>
      attempts
        .filter((attempt) => attempt.subject === subject && attempt.grade === grade)
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, 6),
    [attempts, subject, grade],
  );

  const createQuiz = () => {
    navigate(`/quiz/new?subject=${encodeURIComponent(subject)}&grade=${grade}`);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search questionnaires…"
            className="w-full sm:max-w-xs"
            ariaLabel="Search questionnaires"
          />
          <Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort questionnaires">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="name-asc">Name A–Z</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-input border border-line bg-panel2 p-0.5">
            <IconButton label="Grid view" active={settings.libraryView === 'grid'} onClick={() => setLibraryView('grid')}>
              <Grid2x2 size={15} />
            </IconButton>
            <IconButton label="List view" active={settings.libraryView === 'list'} onClick={() => setLibraryView('list')}>
              <List size={15} />
            </IconButton>
          </div>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Import size={15} /> Import JSON
          </Button>
          <Button onClick={createQuiz}>
            <Plus size={15} /> New questionnaire
          </Button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-[11px] text-muted">
        <span>
          {quizzes.length} {quizzes.length === 1 ? 'questionnaire' : 'questionnaires'}
          {totalQuestions > 0 ? ` · ${pluralize(totalQuestions, 'question')}` : ''}
        </span>
        <span className="hidden sm:inline">JSON import and export supported</span>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title={query ? 'No questionnaires match' : 'No practice questionnaires yet'}
          description={
            query
              ? 'Try another search term, or clear the field to see the whole collection.'
              : `Create a questionnaire from scratch or import a JSON file for Grade ${grade} ${subject}.`
          }
          action={
            query ? (
              <Button variant="outline" onClick={() => setQuery('')}>
                Clear search
              </Button>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Import size={15} /> Import JSON
                </Button>
                <Button onClick={createQuiz}>
                  <Plus size={15} /> Create questionnaire
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div
          className={
            settings.libraryView === 'grid'
              ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3'
              : 'flex flex-col gap-2'
          }
        >
          {sorted.map((quiz) => (
            <ResourceCard
              key={quiz.id}
              resource={quiz}
              view={settings.libraryView}
              showSubject={false}
              onPreview={(value) => setPreview(value)}
            />
          ))}
        </div>
      )}

      {collectionAttempts.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            <Clock3 size={12} aria-hidden="true" /> Recent attempts
          </h2>
          <div className="overflow-hidden rounded-card border border-line bg-panel">
            {collectionAttempts.map((attempt, index) => (
              <div
                key={attempt.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-[12px] ${
                  index > 0 ? 'border-t border-line' : ''
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{attempt.quizTitle}</span>
                <span className={`tabular-nums ${attempt.percentage >= 70 ? 'text-accent' : 'text-accent2'}`}>
                  {attempt.percentage}% · {attempt.score}/{attempt.maxScore}
                </span>
                <span className="text-[11px] text-muted">{formatDuration(attempt.timeSpentMs)}</span>
                <span className="text-[11px] text-muted">{formatDateTime(attempt.completedAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <QuizImportDialog open={importOpen} onClose={() => setImportOpen(false)} subject={subject} grade={grade} />
      <QuizPreview quiz={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
