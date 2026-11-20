import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FileText,
  Highlighter,
  Maximize2,
  Minimize2,
  MousePointer2,
  Pen,
  Printer,
  RotateCcw,
  RotateCw,
  Search,
  Star,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { useToast } from '../state/ToastProvider';
import { ANNOTATION_COLORS } from '../lib/constants';
import { clamp, cn, formatBytes, downloadBlob, uid } from '../lib/utils';
import type { Annotation, NormPoint, NormRect, PdfResource } from '../lib/types';
import { Badge, Button, EmptyState, IconButton, SearchField, Spinner } from '../components/ui';
import { ConfirmDialog, Dialog } from '../components/Dialog';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type Tool = 'select' | 'highlight' | 'pen' | 'eraser';
type ScaleMode = 'width' | 'page' | 'custom';

function PdfSearchDialog({
  open,
  onClose,
  pdfDoc,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  pdfDoc: PDFDocumentProxy | null;
  onJump: (page: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ page: number; snippet: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSearched(false);
      setBusy(false);
    }
  }, [open]);

  const run = async () => {
    if (!pdfDoc || !query.trim()) return;
    setBusy(true);
    setSearched(true);
    const needle = query.trim().toLowerCase();
    const found: Array<{ page: number; snippet: string }> = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
        const page = await pdfDoc.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ');
        const index = text.toLowerCase().indexOf(needle);
        if (index >= 0) {
          found.push({
            page: pageNumber,
            snippet: text.slice(Math.max(0, index - 70), index + needle.length + 110).trim(),
          });
        }
        if (found.length >= 60) break;
      }
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Search in document" description="Text is read from the PDF itself; scanned pages without a text layer will not match." size="md">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
        className="flex gap-2"
      >
        <SearchField value={query} onChange={setQuery} placeholder="Search text…" autoFocus ariaLabel="Search within the PDF" className="flex-1" />
        <Button type="submit" loading={busy} disabled={!query.trim()}>
          Search
        </Button>
      </form>

      <div className="mt-3 max-h-[46vh] overflow-y-auto">
        {busy ? (
          <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-muted">
            <Spinner /> Reading pages…
          </p>
        ) : searched && results.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-ink2">No matches for “{query}”.</p>
        ) : results.length > 0 ? (
          <ul className="divide-y divide-line">
            {results.map((result) => (
              <li key={`${result.page}-${result.snippet.slice(0, 12)}`}>
                <button
                  type="button"
                  onClick={() => {
                    onJump(result.page);
                    onClose();
                  }}
                  className="flex w-full items-start gap-3 px-1 py-2.5 text-left transition-colors hover:bg-panel2"
                >
                  <span className="mt-0.5 rounded border border-line bg-panel2 px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
                    p.{result.page}
                  </span>
                  <span className="line-clamp-2 text-[12px] leading-relaxed text-ink2">{result.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-[12px] text-muted">Search for a word or phrase in this document.</p>
        )}
      </div>
    </Dialog>
  );
}

export default function PdfViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { resources, getPdfBlob, updateResource, toggleFavorite, loadAnnotations, saveAnnotations, markOpened } = useLibrary();
  const toast = useToast();

  const resource = resources.find((entry): entry is PdfResource => entry.id === id && entry.type === 'pdf');

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ScaleMode>('width');
  const [zoom, setZoom] = useState(1);
  const [appliedScale, setAppliedScale] = useState(1);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(ANNOTATION_COLORS[0].value);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [draft, setDraft] = useState<{ points: NormPoint[] } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rendering, setRendering] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef<Blob | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const drawingRef = useRef(false);
  const draftPointsRef = useRef<NormPoint[]>([]);
  const pageRef = useRef(1);
  const pageCountRef = useRef(0);
  const unsavedAnnotationsRef = useRef<Annotation[] | null>(null);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  /* Load document */
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      if (!resource) {
        setError('This study material could not be found.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const blob = await getPdfBlob(resource);
        if (!blob) throw new Error('The stored PDF file is missing from this browser.');
        blobRef.current = blob;
        const data = new Uint8Array(await blob.arrayBuffer());
        doc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setPdfDoc(doc);
        pageCountRef.current = doc.numPages;
        setPageCount(doc.numPages);
        const startPage = clamp(resource.lastPage ?? 1, 1, doc.numPages);
        setPage(startPage);
        void markOpened(resource.id, startPage);
      } catch (loadError) {
        if (!cancelled) setError((loadError as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      if (doc) void doc.destroy();
    };
    // The document is opened once per resource id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* Load annotations */
  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setAnnotationsLoaded(false);
    void loadAnnotations(id).then((stored) => {
      if (cancelled) return;
      setAnnotations(stored);
      setAnnotationsLoaded(true);
      setHistory([]);
      setFuture([]);
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadAnnotations]);

  /* Persist annotations (debounced) */
  useEffect(() => {
    if (!id || !annotationsLoaded) return;
    unsavedAnnotationsRef.current = annotations;
    const timer = window.setTimeout(() => {
      unsavedAnnotationsRef.current = null;
      void saveAnnotations(id, annotations);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [annotations, annotationsLoaded, id, saveAnnotations]);

  /* Flush an annotation made just before the reader closed */
  useEffect(() => {
    if (!id) return;
    return () => {
      const pending = unsavedAnnotationsRef.current;
      if (pending) void saveAnnotations(id, pending);
    };
  }, [id, saveAnnotations]);

  /* Save last page when leaving, once the document actually knows its pages */
  useEffect(() => {
    return () => {
      if (id && pageCountRef.current > 0) void markOpened(id, pageRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* Fullscreen state */
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  /* Re-render on resize for fit modes */
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(width);
    });
    observer.observe(element);
    setContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [loading]);

  /* Render page */
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!pdfDoc) return;
      setRendering(true);
      try {
        const pdfPage: PDFPageProxy = await pdfDoc.getPage(page);
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(280, (containerWidth || 900) - 32);
        const availableHeight = Math.max(320, window.innerHeight - 210);
        let scale = zoom;
        if (mode === 'width') scale = availableWidth / base.width;
        else if (mode === 'page') scale = Math.min(availableWidth / base.width, availableHeight / base.height);
        scale = clamp(scale, 0.1, 6);
        setAppliedScale(scale);

        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const textLayer = textLayerRef.current;
        if (!canvas || !textLayer) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        textLayer.style.setProperty('--scale-factor', String(scale));
        textLayer.innerHTML = '';

        renderTaskRef.current?.cancel();
        const context = canvas.getContext('2d');
        if (!context) return;
        const task = pdfPage.render({
          canvasContext: context,
          viewport: pdfPage.getViewport({ scale: scale * dpr }),
        });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;

        try {
          const textContent = await pdfPage.getTextContent();
          if (cancelled) return;
          const TextLayerCtor = (pdfjsLib as unknown as { TextLayer?: new (options: unknown) => { render: () => Promise<void> } }).TextLayer;
          if (TextLayerCtor) {
            const textLayerInstance = new TextLayerCtor({
              textContentSource: textContent,
              container: textLayer,
              viewport,
            });
            await textLayerInstance.render();
          } else {
            textLayer.textContent = textContent.items
              .map((item) => ('str' in item ? item.str : ''))
              .join(' ');
            textLayer.style.padding = '10px';
            textLayer.style.color = 'transparent';
          }
        } catch {
          // A missing text layer must not break page rendering.
        }
      } catch (renderError) {
        const name = (renderError as Error).name;
        if (name !== 'RenderingCancelledException' && !cancelled) {
          setError((renderError as Error).message);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    void render();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdfDoc, page, mode, zoom, containerWidth]);

  /* Keyboard navigation */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        setPage((current) => clamp(current + 1, 1, pageCount || 1));
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        setPage((current) => clamp(current - 1, 1, pageCount || 1));
      } else if (event.key === '+' || event.key === '=') {
        setMode('custom');
        setZoom((current) => clamp(current * 1.15, 0.2, 5));
      } else if (event.key === '-') {
        setMode('custom');
        setZoom((current) => clamp(current / 1.15, 0.2, 5));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pageCount]);

  const commit = useCallback(
    (next: Annotation[]) => {
      setHistory((current) => [...current.slice(-39), annotations]);
      setFuture([]);
      setAnnotations(next);
    },
    [annotations],
  );

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setFuture([annotations, ...future]);
    setAnnotations(previous);
  };

  const redo = () => {
    const [next, ...rest] = future;
    if (!next) return;
    setFuture(rest);
    setHistory([...history, annotations]);
    setAnnotations(next);
  };

  const pageAnnotations = useMemo(() => annotations.filter((annotation) => annotation.page === page), [annotations, page]);

  const normalizedPoint = (event: React.PointerEvent): NormPoint | null => {
    const box = pageBoxRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    return {
      x: clamp((event.clientX - box.left) / box.width, 0, 1),
      y: clamp((event.clientY - box.top) / box.height, 0, 1),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'pen') return;
    const point = normalizedPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    draftPointsRef.current = [point];
    setDraft({ points: [point] });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current || tool !== 'pen') return;
    const point = normalizedPoint(event);
    if (!point) return;
    draftPointsRef.current = [...draftPointsRef.current, point];
    setDraft({ points: draftPointsRef.current });
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const points = draftPointsRef.current;
    draftPointsRef.current = [];
    setDraft(null);
    if (points.length < 2) return;
    commit([
      ...annotations,
      {
        id: uid('a'),
        page,
        kind: 'pen',
        color,
        points,
        createdAt: Date.now(),
      },
    ]);
  };

  const eraseAt = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'eraser') return;
    const point = normalizedPoint(event);
    const box = pageBoxRef.current?.getBoundingClientRect();
    if (!point || !box) return;
    for (let index = pageAnnotations.length - 1; index >= 0; index -= 1) {
      const annotation = pageAnnotations[index];
      const hitHighlight = annotation.rects?.some(
        (rect) =>
          point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h,
      );
      const hitStroke = annotation.points?.some((strokePoint) => {
        const dx = (strokePoint.x - point.x) * box.width;
        const dy = (strokePoint.y - point.y) * box.height;
        return Math.sqrt(dx * dx + dy * dy) < 12;
      });
      if (hitHighlight || hitStroke) {
        commit(annotations.filter((entry) => entry.id !== annotation.id));
        return;
      }
    }
    toast.info('Nothing to erase at that point');
  };

  const handleSelection = () => {
    if (tool !== 'highlight') return;
    const selection = window.getSelection();
    const textLayer = textLayerRef.current;
    const pageBox = pageBoxRef.current;
    if (!selection || selection.isCollapsed || !selection.rangeCount || !textLayer || !pageBox) return;
    const range = selection.getRangeAt(0);
    if (!textLayer.contains(range.commonAncestorContainer)) return;
    const box = pageBox.getBoundingClientRect();
    const rects: NormRect[] = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .map((rect) => ({
        x: (rect.left - box.left) / box.width,
        y: (rect.top - box.top) / box.height,
        w: rect.width / box.width,
        h: rect.height / box.height,
      }))
      .filter((rect) => rect.x >= -0.01 && rect.y >= -0.01 && rect.w > 0 && rect.h > 0);
    const text = selection.toString().trim();
    selection.removeAllRanges();
    if (!rects.length) {
      toast.info(
        'No selectable text on this page',
        'This page may be a scan without a text layer. The pen tool still works, but text highlighting is not possible here.',
      );
      return;
    }
    commit([
      ...annotations,
      {
        id: uid('a'),
        page,
        kind: 'highlight',
        color,
        rects,
        text,
        createdAt: Date.now(),
      },
    ]);
  };

  const zoomIn = () => {
    setMode('custom');
    setZoom(clamp(appliedScale * 1.15, 0.2, 5));
  };
  const zoomOut = () => {
    setMode('custom');
    setZoom(clamp(appliedScale / 1.15, 0.2, 5));
  };

  const fitWidth = () => {
    setMode('width');
    setZoom(1);
  };
  const fitPage = () => {
    setMode('page');
    setZoom(1);
  };

  const download = async () => {
    if (!resource) return;
    try {
      const blob = blobRef.current ?? (await getPdfBlob(resource));
      if (!blob) throw new Error('The file is unavailable.');
      downloadBlob(blob, resource.filename);
      toast.success('Download started', resource.filename);
    } catch (downloadError) {
      toast.error('Download failed', (downloadError as Error).message);
    }
  };

  const print = async () => {
    if (!resource) return;
    try {
      const blob = blobRef.current ?? (await getPdfBlob(resource));
      if (!blob) throw new Error('The file is unavailable.');
      const url = URL.createObjectURL(blob);
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.src = url;
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      };
      document.body.appendChild(frame);
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    } catch (printError) {
      toast.error('Print failed', (printError as Error).message);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewerRef.current?.requestFullscreen();
    } catch {
      toast.error('Fullscreen is not available in this browser');
    }
  };

  const selectTool = (next: Tool) => {
    setTool(next);
    setDraft(null);
    drawingRef.current = false;
  };

  if (!id) return null;

  if (!resource) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={FileText}
          title="Study material not found"
          description="This PDF is no longer in your library."
          action={
            <Link to="/subjects">
              <Button>Browse subjects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div ref={viewerRef} className="flex h-screen flex-col bg-surface">
      <header className="z-20 shrink-0 border-b border-line bg-sidebar/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <IconButton
            label="Back to subject"
            onClick={() => navigate(`/subject/${resource.subject.toLowerCase().replace(/\s+/g, '-')}?tab=materials&grade=${resource.grade}`)}
          >
            <ArrowLeft size={17} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-ink">{resource.title}</p>
            <p className="truncate text-[10.5px] text-muted">
              {resource.subject} · Grade {resource.grade} · {resource.size ? formatBytes(resource.size) : 'Linked file'}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <IconButton
              label={resource.favorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => void toggleFavorite(resource.id)}
              className={resource.favorite ? 'text-accent2' : undefined}
            >
              <Star size={16} fill={resource.favorite ? 'currentColor' : 'none'} />
            </IconButton>
            <IconButton label="Download PDF" onClick={download}>
              <Download size={16} />
            </IconButton>
            <IconButton label="Print PDF" onClick={print}>
              <Printer size={16} />
            </IconButton>
            <IconButton label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => void toggleFullscreen()}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </IconButton>
            <IconButton label="Close reader" onClick={() => navigate(-1)}>
              <X size={17} />
            </IconButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line px-2 py-1.5">
          <div className="flex items-center gap-0.5">
            <IconButton label="Previous page" onClick={() => setPage((current) => clamp(current - 1, 1, pageCount))} disabled={page <= 1}>
              <ChevronLeft size={16} />
            </IconButton>
            <div className="flex items-center gap-1 text-[11.5px] text-ink2">
              <input
                type="number"
                value={page}
                min={1}
                max={pageCount}
                aria-label="Current page"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) setPage(clamp(next, 1, pageCount || 1));
                }}
                className="h-7 w-12 rounded border border-line bg-panel2 px-1.5 text-center text-[11.5px] tabular-nums text-ink focus:border-accent focus:outline-none"
              />
              <span className="text-muted">/ {pageCount || '—'}</span>
            </div>
            <IconButton label="Next page" onClick={() => setPage((current) => clamp(current + 1, 1, pageCount))} disabled={page >= pageCount}>
              <ChevronRight size={16} />
            </IconButton>
          </div>

          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />

          <div className="flex items-center gap-0.5">
            <IconButton label="Zoom out" onClick={zoomOut}>
              <ZoomOut size={15} />
            </IconButton>
            <span className="w-11 text-center text-[11px] tabular-nums text-ink2">{Math.round(appliedScale * 100)}%</span>
            <IconButton label="Zoom in" onClick={zoomIn}>
              <ZoomIn size={15} />
            </IconButton>
            <button
              type="button"
              onClick={fitWidth}
              className={cn(
                'h-7 rounded px-2 text-[10.5px] font-medium transition-colors',
                mode === 'width' ? 'bg-active text-accent' : 'text-ink2 hover:bg-panel2',
              )}
            >
              Fit width
            </button>
            <button
              type="button"
              onClick={fitPage}
              className={cn(
                'h-7 rounded px-2 text-[10.5px] font-medium transition-colors',
                mode === 'page' ? 'bg-active text-accent' : 'text-ink2 hover:bg-panel2',
              )}
            >
              Fit page
            </button>
          </div>

          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />

          <div className="flex items-center gap-0.5">
            <IconButton label="Search in PDF" onClick={() => setSearchOpen(true)}>
              <Search size={15} />
            </IconButton>
            <button
              type="button"
              onClick={() => setShowPages((value) => !value)}
              className={cn(
                'h-7 rounded px-2 text-[10.5px] font-medium transition-colors',
                showPages ? 'bg-active text-accent' : 'text-ink2 hover:bg-panel2',
              )}
            >
              Pages
            </button>
          </div>

          <span className="hidden h-5 w-px bg-line md:block" aria-hidden="true" />

          <div className="flex items-center gap-0.5">
            <IconButton label="Select tool" active={tool === 'select'} onClick={() => selectTool('select')}>
              <MousePointer2 size={15} />
            </IconButton>
            <IconButton label="Highlighter (select text to highlight)" active={tool === 'highlight'} onClick={() => selectTool('highlight')}>
              <Highlighter size={15} />
            </IconButton>
            <IconButton label="Pen" active={tool === 'pen'} onClick={() => selectTool('pen')}>
              <Pen size={15} />
            </IconButton>
            <IconButton label="Eraser" active={tool === 'eraser'} onClick={() => selectTool('eraser')}>
              <Eraser size={15} />
            </IconButton>
            <IconButton label="Undo annotation" onClick={undo} disabled={!history.length}>
              <RotateCcw size={15} />
            </IconButton>
            <IconButton label="Redo annotation" onClick={redo} disabled={!future.length}>
              <RotateCw size={15} />
            </IconButton>
            <IconButton label="Clear page annotations" onClick={() => setClearOpen(true)} disabled={!pageAnnotations.length}>
              <Trash2 size={15} />
            </IconButton>
            <div className="ml-1 flex items-center gap-1" role="group" aria-label="Annotation colour">
              {ANNOTATION_COLORS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  aria-label={`${entry.name} annotation colour`}
                  aria-pressed={color === entry.value}
                  title={entry.name}
                  onClick={() => setColor(entry.value)}
                  className={cn(
                    'h-4 w-4 rounded-full border transition-transform',
                    color === entry.value ? 'scale-110 border-ink' : 'border-transparent hover:scale-110',
                  )}
                  style={{ backgroundColor: entry.value }}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {showPages && (
          <aside className="hidden w-40 shrink-0 overflow-y-auto border-r border-line bg-sidebar px-2 py-3 md:block">
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Pages</p>
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === page}
                  className={cn(
                    'h-8 rounded border text-[11px] tabular-nums transition-colors',
                    pageNumber === page
                      ? 'border-accent bg-active text-accent'
                      : 'border-line bg-panel text-ink2 hover:border-muted/50 hover:text-ink',
                  )}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
          </aside>
        )}

        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-auto bg-bg/60">
          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
              <Spinner className="h-5 w-5" />
              <p className="text-[12px]">Opening document…</p>
            </div>
          )}

          {!loading && error && (
            <div className="mx-auto max-w-xl px-4 py-16">
              <EmptyState
                icon={FileText}
                title="This PDF could not be opened"
                description={error}
                action={
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate(-1)}>
                      Go back
                    </Button>
                    <Button onClick={download}>Download instead</Button>
                  </div>
                }
              />
            </div>
          )}

          {!loading && !error && pdfDoc && (
            <div className="flex min-h-full justify-center px-2 py-4 sm:px-4">
              <div
                ref={pageBoxRef}
                className="pdf-page relative shadow-[0_10px_40px_-20px_rgba(0,0,0,0.5)]"
                style={{ backgroundColor: '#fff' }}
                onMouseUp={handleSelection}
                onTouchEnd={handleSelection}
              >
                <canvas ref={canvasRef} className="block" aria-label={`Page ${page}`} />
                <div
                  ref={textLayerRef}
                  className="textLayer"
                  style={{ pointerEvents: tool === 'select' || tool === 'highlight' ? 'auto' : 'none' }}
                />

                {/* Saved annotations */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {pageAnnotations.map((annotation) =>
                    annotation.kind === 'highlight' ? (
                      annotation.rects?.map((rect, rectIndex) => (
                        <span
                          key={`${annotation.id}-${rectIndex}`}
                          className="absolute rounded-[2px]"
                          style={{
                            left: `${rect.x * 100}%`,
                            top: `${rect.y * 100}%`,
                            width: `${rect.w * 100}%`,
                            height: `${rect.h * 100}%`,
                            backgroundColor: annotation.color,
                            opacity: 0.38,
                            mixBlendMode: 'multiply',
                          }}
                        />
                      ))
                    ) : null,
                  )}
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {pageAnnotations.map((annotation) =>
                      annotation.kind === 'pen' && annotation.points ? (
                        <polyline
                          key={annotation.id}
                          points={annotation.points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')}
                          fill="none"
                          stroke={annotation.color}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          {...{ 'vector-effect': 'non-scaling-stroke' }}
                        />
                      ) : null,
                    )}
                    {draft && draft.points.length > 1 && (
                      <polyline
                        points={draft.points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        {...{ 'vector-effect': 'non-scaling-stroke' }}
                      />
                    )}
                  </svg>
                </div>

                {/* Interaction layer for pen and eraser */}
                {(tool === 'pen' || tool === 'eraser') && (
                  <div
                    className={cn(
                      'absolute inset-0 z-10 touch-none',
                      tool === 'pen' ? 'cursor-crosshair' : 'cursor-cell',
                    )}
                    onPointerDown={tool === 'pen' ? onPointerDown : eraseAt}
                    onPointerMove={onPointerMove}
                    onPointerUp={finishStroke}
                    onPointerLeave={finishStroke}
                    onPointerCancel={finishStroke}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          )}

          {rendering && !loading && (
            <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-line bg-panel/90 px-2 py-1 text-[10px] text-muted">
              rendering…
            </div>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-sidebar px-3 py-1.5 text-[10.5px] text-muted">
        <span>
          {tool === 'highlight'
            ? 'Select text to highlight it — only real PDF text is highlighted.'
            : tool === 'pen'
              ? 'Draw freely with the pen. Annotations are saved automatically.'
              : tool === 'eraser'
                ? 'Click an annotation to erase it.'
                : 'Arrow keys turn pages · + / − zoom'}
        </span>
        <span className="flex items-center gap-2">
          <Badge tone={annotations.length ? 'accent' : 'neutral'}>
            {annotations.length} annotation{annotations.length === 1 ? '' : 's'}
          </Badge>
          <span className="hidden sm:inline">Stored separately from the PDF</span>
        </span>
      </footer>

      <PdfSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        pdfDoc={pdfDoc}
        onJump={(target) => setPage(clamp(target, 1, pageCount))}
      />

      <ConfirmDialog
        open={clearOpen}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          commit(annotations.filter((annotation) => annotation.page !== page));
          setClearOpen(false);
          toast.success(`Annotations cleared on page ${page}`);
        }}
        tone="danger"
        title={`Clear annotations on page ${page}?`}
        confirmLabel="Clear this page"
        message="Highlights and pen strokes on this page will be removed. Other pages keep their annotations."
      />

    </div>
  );
}
