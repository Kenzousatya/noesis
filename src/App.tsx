import { Suspense, lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoadingScreen } from './components/Logo';
import { Button, EmptyState, Spinner } from './components/ui';
import { useLibrary } from './state/LibraryProvider';
import { Database } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const SubjectsPage = lazy(() => import('./pages/SubjectsPage'));
const SubjectPage = lazy(() => import('./pages/SubjectPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const RecentlyAddedPage = lazy(() => import('./pages/RecentlyAddedPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const PdfViewerPage = lazy(() => import('./pages/PdfViewerPage'));
const QuizEditorPage = lazy(() => import('./pages/QuizEditorPage'));
const QuizPlayerPage = lazy(() => import('./pages/QuizPlayerPage'));
const VideoPlayerPage = lazy(() => import('./pages/VideoPlayerPage'));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-[12px] text-muted">
      <Spinner /> Opening…
    </div>
  );
}

function NotFound() {
  return (
    <EmptyState
      icon={Database}
      title="This page does not exist"
      description="The address may have changed. Return to the dashboard to keep browsing your archive."
      action={
        <Link to="/">
          <Button>Back to dashboard</Button>
        </Link>
      }
    />
  );
}

export default function App() {
  const { ready, storageError } = useLibrary();

  if (!ready) return <LoadingScreen />;

  return (
    <>
      {storageError && (
        <div role="alert" className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-center text-[12px] text-danger">
          Local storage is unavailable: {storageError} Changes will not be preserved after a refresh.
        </div>
      )}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="subject/:slug" element={<SubjectPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="recent" element={<RecentlyAddedPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="pdf/:id" element={<PdfViewerPage />} />
            <Route path="quiz/new" element={<QuizEditorPage />} />
            <Route path="quiz/:id" element={<QuizPlayerPage />} />
            <Route path="quiz/:id/edit" element={<QuizEditorPage />} />
            <Route path="video/:id" element={<VideoPlayerPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
