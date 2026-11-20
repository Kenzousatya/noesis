import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, Upload, X } from 'lucide-react';
import type { Grade, QuizResource, SubjectName } from '../lib/types';
import { SUBJECTS } from '../lib/constants';
import { GRADES } from '../lib/types';
import { parseQuizJson, quizValidationErrors } from '../lib/quiz';
import { QUIZ_TYPE_LABEL } from '../lib/constants';
import { cn, pluralize } from '../lib/utils';
import { useLibrary } from '../state/LibraryProvider';
import { useToast } from '../state/ToastProvider';
import { Button, Field, IconButton, Input, Select } from '../components/ui';
import { Dialog } from '../components/Dialog';

export function QuizImportDialog({
  open,
  onClose,
  subject,
  grade,
}: {
  open: boolean;
  onClose: () => void;
  subject: SubjectName;
  grade: Grade;
}) {
  const { addResources } = useLibrary();
  const toast = useToast();
  const [staged, setStaged] = useState<QuizResource[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStaged([]);
      setErrors([]);
      setImporting(false);
      setDragActive(false);
    }
  }, [open]);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    const imported: QuizResource[] = [];
    const problems: string[] = [];
    for (const file of files) {
      if (!/\.json$/i.test(file.name)) {
        problems.push(`${file.name} — only .json files can be imported.`);
        continue;
      }
      try {
        const result = parseQuizJson(await file.text(), file.name, subject, grade);
        imported.push(...result.quizzes);
        problems.push(...result.errors);
      } catch (error) {
        problems.push(`${file.name} — ${(error as Error).message}`);
      }
    }
    if (imported.length) {
      setStaged((current) => [...current, ...imported]);
      toast.success(`${pluralize(imported.length, 'questionnaire')} validated`, 'Review the details, then save.');
    }
    setErrors(problems);
    if (problems.length) {
      toast.error(
        `${pluralize(problems.length, 'problem')} found`,
        imported.length ? 'The other quizzes were still validated.' : 'No questionnaire could be imported.',
      );
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  };

  const save = async () => {
    const problems: string[] = [];
    staged.forEach((quiz, index) => {
      quizValidationErrors(quiz).forEach((error) => problems.push(`Quiz ${index + 1}: ${error}`));
    });
    if (!staged.length) problems.push('Add at least one JSON file first.');
    if (problems.length) {
      setErrors(problems);
      toast.error('Fix the highlighted problems before saving');
      return;
    }
    setImporting(true);
    try {
      await addResources(staged);
      toast.success(
        `${pluralize(staged.length, 'questionnaire')} imported`,
        staged.map((quiz) => quiz.title).slice(0, 3).join(' · '),
      );
      onClose();
    } catch (error) {
      toast.error('Import failed', (error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import questionnaires"
      description="Drop one or more .json files. Every quiz is validated before anything is saved."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={save} loading={importing} disabled={!staged.length}>
            Save {staged.length ? pluralize(staged.length, 'questionnaire') : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed px-5 py-7 text-center transition-colors',
            dragActive ? 'border-accent bg-accent/10' : 'border-line bg-panel2/50',
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel text-accent">
            <FileJson size={18} aria-hidden="true" />
          </span>
          <p className="text-[13px] font-medium text-ink">Drop JSON files here, or choose files</p>
          <p className="text-[11.5px] text-muted">
            Supports one quiz per file, arrays of quizzes, and {"{ quizzes: [...] }"}.
          </p>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="mt-1">
            <Upload size={14} /> Choose JSON files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) void handleFiles(Array.from(event.target.files));
              event.target.value = '';
            }}
          />
        </div>

        {errors.length > 0 && (
          <div className="rounded-card border border-danger/30 bg-danger/10 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-danger">
              <AlertTriangle size={13} aria-hidden="true" /> Validation problems
            </p>
            <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-[11.5px] leading-relaxed text-danger/90">
              {errors.slice(0, 12).map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
              {errors.length > 12 && <li>…and {errors.length - 12} more.</li>}
            </ul>
          </div>
        )}

        {staged.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[11.5px] text-success">
              <CheckCircle2 size={13} aria-hidden="true" /> {pluralize(staged.length, 'questionnaire')} ready — confirm
              the title, subject and grade.
            </p>
            {staged.map((quiz) => (
              <div key={quiz.id} className="rounded-card border border-line bg-panel2/50 p-3">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_150px_110px]">
                    <Field label="Title">
                      <Input
                        value={quiz.title}
                        onChange={(event) =>
                          setStaged((current) =>
                            current.map((entry) =>
                              entry.id === quiz.id ? { ...entry, title: event.target.value } : entry,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Subject">
                      <Select
                        value={quiz.subject}
                        onChange={(event) =>
                          setStaged((current) =>
                            current.map((entry) =>
                              entry.id === quiz.id ? { ...entry, subject: event.target.value as SubjectName } : entry,
                            ),
                          )
                        }
                        className="w-full"
                      >
                        {SUBJECTS.map((entry) => (
                          <option key={entry.slug} value={entry.name}>
                            {entry.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Grade">
                      <Select
                        value={quiz.grade}
                        onChange={(event) =>
                          setStaged((current) =>
                            current.map((entry) =>
                              entry.id === quiz.id ? { ...entry, grade: Number(event.target.value) as Grade } : entry,
                            ),
                          )
                        }
                        className="w-full"
                      >
                        {GRADES.map((entry) => (
                          <option key={entry} value={entry}>
                            Grade {entry}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <IconButton
                    label="Remove from import"
                    onClick={() => setStaged((current) => current.filter((entry) => entry.id !== quiz.id))}
                  >
                    <X size={14} />
                  </IconButton>
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  {pluralize(quiz.questions.length, 'question')} ·{' '}
                  {Array.from(new Set(quiz.questions.map((question) => QUIZ_TYPE_LABEL[question.type]))).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}

        <details className="rounded-card border border-line bg-panel2/40 px-3 py-2.5">
          <summary className="cursor-pointer text-[12px] font-medium text-ink2">Supported JSON structure</summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-sidebar p-3 text-[10.5px] leading-relaxed text-ink2">
{`{
  "schemaVersion": 1,
  "title": "Example Mathematics Quiz",
  "description": "Practice questions for Grade 7.",
  "subject": "Mathematics",
  "grade": 7,
  "settings": {
    "shuffleQuestions": false,
    "shuffleOptions": false,
    "showExplanations": true,
    "timerMinutes": null,
    "passingScore": 70
  },
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "What is 5 + 7?",
      "options": [
        { "id": "a", "text": "10" },
        { "id": "b", "text": "11" },
        { "id": "c", "text": "12" },
        { "id": "d", "text": "13" }
      ],
      "correctAnswer": ["c"],
      "explanation": "5 + 7 = 12.",
      "points": 1
    }
  ]
}`}
          </pre>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Types: multiple_choice, multiple_select, true_false, short_answer. Short answers list every accepted
            spelling in <code>correctAnswer</code>.
          </p>
        </details>
      </div>
    </Dialog>
  );
}
