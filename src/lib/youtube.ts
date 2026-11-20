const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (YOUTUBE_ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && YOUTUBE_ID.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v');
    if (v && YOUTUBE_ID.test(v)) return v;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
      const id = segments[1];
      return YOUTUBE_ID.test(id) ? id : null;
    }
  }
  return null;
}

export function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function youtubeWatchUrl(videoId: string, seconds?: number): string {
  const suffix = seconds ? `&t=${Math.floor(seconds)}` : '';
  return `https://www.youtube.com/watch?v=${videoId}${suffix}`;
}

export interface VideoMetadata {
  title: string;
  author?: string;
  thumbnail?: string;
}

/**
 * Best-effort metadata lookup through public oEmbed endpoints. Both endpoints
 * are optional: when CORS or the network blocks them, the caller falls back to
 * manual entry instead of pretending the lookup succeeded.
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  const watch = canonicalYouTubeUrl(videoId);
  const endpoints = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(watch)}`,
  ];
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) continue;
      const data = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
      if (data?.title) {
        return {
          title: data.title,
          author: data.author_name,
          thumbnail: data.thumbnail_url,
        };
      }
    } catch {
      // Ignore and try the next provider, then fall back to manual entry.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}
