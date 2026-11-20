import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink, Pencil, Star, Trash2, Youtube } from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { useToast } from '../state/ToastProvider';
import { subjectMeta } from '../lib/constants';
import { formatDateTime } from '../lib/utils';
import { youtubeEmbedUrl, youtubeThumbnail, youtubeWatchUrl } from '../lib/youtube';
import type { VideoResource } from '../lib/types';
import { Button, Badge, EmptyState, IconButton } from '../components/ui';
import { ConfirmDialog } from '../components/Dialog';
import { VideoDialog } from '../sections/VideoSection';
import { LoadingScreen } from '../components/Logo';

export default function VideoPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { resources, markOpened, toggleFavorite, deleteResource } = useLibrary();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const video = resources.find((resource): resource is VideoResource => resource.id === id && resource.type === 'video');

  useEffect(() => {
    if (video) void markOpened(video.id);
    // Only on first open of this video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  const related = useMemo(
    () =>
      video
        ? resources
            .filter(
              (resource): resource is VideoResource =>
                resource.type === 'video' &&
                resource.id !== video.id &&
                resource.subject === video.subject &&
                resource.grade === video.grade,
            )
            .slice(0, 4)
        : [],
    [resources, video],
  );

  if (!video) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={Youtube}
          title="Video not found"
          description="This video is no longer in your library. It may have been deleted."
          action={
            <Link to="/subjects">
              <Button>Browse subjects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const subject = subjectMeta(video.subject);

  const remove = async () => {
    setDeleting(true);
    await deleteResource(video.id);
    setDeleting(false);
    setConfirmOpen(false);
    toast.success('Video removed from NOEMA');
    navigate(`/subject/${subject.slug}?tab=videos&grade=${video.grade}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-16 sm:px-7 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/subject/${subject.slug}?tab=videos&grade=${video.grade}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink2 transition-colors hover:text-accent"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to the video bank
        </Link>
        <div className="flex items-center gap-1.5">
          <IconButton
            label={video.favorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => void toggleFavorite(video.id)}
            className={video.favorite ? 'text-accent2' : undefined}
          >
            <Star size={16} fill={video.favorite ? 'currentColor' : 'none'} />
          </IconButton>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={13} /> Edit metadata
          </Button>
          <a href={youtubeWatchUrl(video.videoId)} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm">
              <ExternalLink size={13} /> Open on YouTube
            </Button>
          </a>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-panel border border-line bg-black">
        <div className="aspect-video w-full">
          <iframe
            key={video.videoId}
            src={youtubeEmbedUrl(video.videoId)}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-7 lg:grid-cols-[1fr_286px]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">Video</Badge>
            <Badge>{video.subject}</Badge>
            <Badge>Grade {video.grade}</Badge>
            {video.favorite && <Badge tone="warm">Favorite</Badge>}
          </div>
          <h1 className="editorial mt-2.5 text-[24px] leading-tight text-ink sm:text-[28px]">{video.title}</h1>
          <p className="mt-1.5 text-[11px] text-muted">
            Added {formatDateTime(video.createdAt)} · Video ID {video.videoId}
          </p>

          {video.description ? (
            <p className="mt-4 whitespace-pre-line text-[13px] leading-relaxed text-ink2">{video.description}</p>
          ) : (
            <p className="mt-4 text-[12.5px] text-muted">
              No description yet. Use “Edit metadata” to add chapter notes or a reason to revisit this video.
            </p>
          )}

          <div className="mt-6 flex gap-2.5 rounded-card border border-line bg-panel2/60 p-3.5 text-[11.5px] leading-relaxed text-ink2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent2" aria-hidden="true" />
            <p>
              Playback uses YouTube’s official embed. If the player reports an error, the video may be private,
              deleted, age-restricted, or embedding may be disabled by its owner. NOEMA does not bypass those
              restrictions — use “Open on YouTube” to view it there.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-2 border-t border-line pt-4">
            <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 size={13} /> Remove from library
            </Button>
          </div>
        </article>

        <aside>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            More in {video.subject} · Grade {video.grade}
          </h2>
          {related.length === 0 ? (
            <p className="mt-3 rounded-card border border-dashed border-line px-3 py-4 text-[11.5px] leading-relaxed text-muted">
              No other videos in this collection yet.
            </p>
          ) : (
            <ul className="mt-2.5 flex flex-col gap-2">
              {related.map((entry) => (
                <li key={entry.id}>
                  <Link
                    to={`/video/${entry.id}`}
                    className="group flex gap-2.5 rounded-card border border-line bg-panel p-2 transition-colors hover:border-muted/50"
                  >
                    <img
                      src={entry.thumbnail || youtubeThumbnail(entry.videoId)}
                      alt=""
                      loading="lazy"
                      className="h-12 w-20 shrink-0 rounded-[6px] border border-line object-cover"
                    />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[11.5px] font-medium leading-snug text-ink">{entry.title}</span>
                      <span className="mt-0.5 block text-[10px] text-muted">Grade {entry.grade}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <VideoDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        subject={video.subject}
        grade={video.grade}
        video={video}
      />
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
        loading={deleting}
        tone="danger"
        title="Remove this video?"
        confirmLabel="Remove video"
        message={`"${video.title}" will be removed from your library. The video itself remains on YouTube.`}
      />
    </div>
  );
}
