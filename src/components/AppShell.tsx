import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  CheckSquare,
  Clock3,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  Menu as MenuIcon,
  Moon,
  PanelLeftClose,
  Pin,
  Search,
  Settings2,
  Star,
  Sun,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SUBJECTS, SUBJECT_BY_SLUG } from '../lib/constants';
import { cn } from '../lib/utils';
import { useSettings } from '../state/SettingsProvider';
import { useWorkspace } from '../state/WorkspaceProvider';
import { isDueToday, isOverdue } from '../lib/tasks';
import { BrandLockup, LambdaMark, Wordmark } from './Logo';
import { GlobalSearch } from './GlobalSearch';
import { IconButton } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
  dot?: boolean;
}

function useSectionLabel() {
  const location = useLocation();
  const path = location.pathname;
  if (path.startsWith('/subject/')) {
    const slug = path.split('/')[2];
    const subject = SUBJECT_BY_SLUG.get(slug);
    return { eyebrow: 'Academic library', title: subject?.name ?? 'Subject' };
  }
  if (path.startsWith('/subjects')) return { eyebrow: 'Academic library', title: 'All subjects' };
  if (path.startsWith('/tasks')) return { eyebrow: 'Personal organisation', title: 'Homework & Tasks' };
  if (path.startsWith('/schedule')) return { eyebrow: 'Personal organisation', title: 'School Schedule' };
  if (path.startsWith('/favorites')) return { eyebrow: 'Collections', title: 'Favorites' };
  if (path.startsWith('/recent')) return { eyebrow: 'Collections', title: 'Recently added' };
  if (path.startsWith('/settings')) return { eyebrow: 'System', title: 'Settings' };
  return { eyebrow: 'Command centre', title: 'Dashboard' };
}

function GroupLabel({ children, collapsed }: { children: string; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="my-2 flex justify-center" aria-hidden="true">
        <span className="h-px w-6 bg-line" />
      </div>
    );
  }
  return (
    <p className="mb-1 mt-4 px-2.5 text-[9.5px] font-semibold uppercase tracking-[0.19em] text-muted first:mt-0">
      {children}
    </p>
  );
}

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center rounded-btn text-[12.5px] transition-colors duration-150 ease-calm',
          collapsed ? 'h-9.5 w-full justify-center' : 'h-9 gap-2.5 px-2.5',
          isActive ? 'bg-active text-ink' : 'text-ink2 hover:bg-panel2 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent" aria-hidden="true" />
          )}
          <span className="relative shrink-0">
            <item.icon
              size={15.5}
              className={cn(isActive ? 'text-accent' : 'text-muted group-hover:text-ink2')}
              aria-hidden="true"
            />
            {item.dot && (
              <span
                className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-danger ring-2 ring-sidebar"
                aria-hidden="true"
              />
            )}
          </span>
          {!collapsed && (
            <>
              <span className="truncate">{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="ml-auto rounded-full border border-line bg-panel2 px-1.5 py-px text-[10px] font-semibold tabular-nums text-ink2">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

function NavContent({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { tasks } = useWorkspace();
  const pending = tasks.filter((task) => task.status !== 'done').length;
  const urgent = tasks.some((task) => task.status !== 'done' && (isOverdue(task) || isDueToday(task)));

  const main: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/tasks', label: 'Homework & Tasks', icon: CheckSquare, badge: pending, dot: urgent },
    { to: '/schedule', label: 'School Schedule', icon: CalendarDays },
  ];

  const collections: NavItem[] = [
    { to: '/favorites', label: 'Favorites', icon: Star },
    { to: '/recent', label: 'Recently added', icon: Clock3 },
  ];

  return (
    <nav
      className={cn(
        'thin-scroll flex flex-1 flex-col overflow-y-auto overflow-x-hidden',
        collapsed ? 'px-2 py-3' : 'px-2.5 py-3',
      )}
      aria-label="Primary"
    >
      <GroupLabel collapsed={collapsed}>Workspace</GroupLabel>
      <div className="flex flex-col gap-0.5">
        {main.map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>

      <GroupLabel collapsed={collapsed}>Academic library</GroupLabel>
      <div className="flex flex-col gap-0.5">
        {!collapsed && (
          <NavLink
            to="/subjects"
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex h-9 items-center gap-2.5 rounded-btn px-2.5 text-[12.5px] transition-colors',
                isActive ? 'bg-active text-ink' : 'text-ink2 hover:bg-panel2 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <LibraryBig
                  size={15.5}
                  className={cn('shrink-0', isActive ? 'text-accent' : 'text-muted group-hover:text-ink2')}
                  aria-hidden="true"
                />
                <span className="truncate">All subjects</span>
                <span className="ml-auto text-[10px] tabular-nums text-muted">10</span>
              </>
            )}
          </NavLink>
        )}
        {SUBJECTS.map((subject) => (
          <NavLink
            key={subject.slug}
            to={`/subject/${subject.slug}`}
            onClick={onNavigate}
            title={collapsed ? subject.name : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center rounded-btn text-[12px] transition-colors duration-150 ease-calm',
                collapsed ? 'h-8.5 justify-center' : 'h-8 gap-2.5 px-2.5',
                isActive ? 'bg-active text-ink' : 'text-ink2 hover:bg-panel2 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <subject.icon
                  size={14}
                  className={cn('shrink-0', isActive ? 'text-accent' : 'text-muted group-hover:text-ink2')}
                  aria-hidden="true"
                />
                {!collapsed && <span className="truncate">{subject.name}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <GroupLabel collapsed={collapsed}>Collections</GroupLabel>
      <div className="flex flex-col gap-0.5">
        {collections.map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>

      <GroupLabel collapsed={collapsed}>System</GroupLabel>
      <NavRow
        item={{ to: '/settings', label: 'Settings', icon: Settings2 }}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      {!collapsed && (
        <p className="mt-auto px-2.5 pt-6 text-[9.5px] uppercase tracking-[0.16em] text-muted/80">
          Local archive · v1.1
        </p>
      )}
    </nav>
  );
}

function Sidebar() {
  const { settings, setSidebarCollapsed } = useSettings();
  // `pinned` is the saved preference; the rail peeks open on hover so it can be
  // used without permanently taking space away from the page.
  const pinned = !settings.sidebarCollapsed;
  const [peeking, setPeeking] = useState(false);
  const collapsed = !pinned && !peeking;

  const collapse = () => {
    setPeeking(false);
    setSidebarCollapsed(true);
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-sidebar transition-[width,box-shadow] duration-200 ease-calm md:flex',
        peeking && !pinned && 'z-40 shadow-lift',
      )}
      style={{ width: collapsed ? 76 : 256 }}
      onMouseEnter={() => {
        if (!pinned) setPeeking(true);
      }}
      onMouseLeave={() => setPeeking(false)}
      onFocus={() => {
        if (!pinned) setPeeking(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPeeking(false);
      }}
      aria-label="Primary"
    >
      <div
        className={cn(
          'flex h-[68px] shrink-0 items-center border-b border-line',
          collapsed ? 'justify-center px-2' : 'justify-between px-3',
        )}
      >
        {collapsed ? (
          <Link to="/" aria-label="NOEMA home" className="rounded p-1 text-accent">
            <LambdaMark size={22} />
          </Link>
        ) : (
          <>
            <Link to="/" className="rounded p-0.5" aria-label="NOEMA home">
              <BrandLockup />
            </Link>
            <div className="flex items-center gap-0.5">
              {!pinned && (
                <IconButton label="Keep sidebar open" onClick={() => setSidebarCollapsed(false)}>
                  <Pin size={15} />
                </IconButton>
              )}
              <IconButton label="Collapse sidebar" onClick={collapse}>
                <PanelLeftClose size={16} />
              </IconButton>
            </div>
          </>
        )}
      </div>

      <NavContent collapsed={collapsed} />

      <div
        className={cn(
          'flex shrink-0 items-center border-t border-line py-2.5',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {collapsed ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            <ListChecks size={11} aria-hidden="true" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            <ListChecks size={11} aria-hidden="true" /> Local · IndexedDB
          </span>
        )}
      </div>
    </aside>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-line bg-sidebar"
            initial={{ x: -24, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            aria-label="Primary"
          >
            <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-line px-4">
              <Link to="/" onClick={onClose} className="flex items-center gap-3" aria-label="NOEMA home">
                <LambdaMark size={24} className="text-accent" />
                <Wordmark />
              </Link>
              <IconButton label="Close navigation" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </div>
            <NavContent onNavigate={onClose} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function Topbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { resolvedTheme, setTheme } = useSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { eyebrow, title } = useSectionLabel();

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-line bg-surface/85 px-[18px] backdrop-blur-md sm:px-7 lg:px-10">
        <IconButton label="Open navigation" onClick={() => setDrawerOpen(true)} className="md:hidden">
          <MenuIcon size={18} />
        </IconButton>

        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[9.5px] font-medium uppercase tracking-[0.2em] text-muted">{eyebrow}</span>
          <span className="truncate text-[13px] font-semibold text-ink">{title}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-9 items-center gap-2 rounded-input border border-line bg-panel2 px-2.5 text-[12px] text-muted transition-colors hover:border-muted/40 hover:text-ink2"
            aria-label="Search the library"
          >
            <Search size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Search the library</span>
            <kbd className="ml-2 hidden rounded border border-line bg-panel px-1.5 py-0.5 font-sans text-[10px] text-muted lg:inline">
              ⌘K
            </kbd>
          </button>
          <IconButton
            label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
        </div>
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

export function AppShell() {
  const { settings } = useSettings();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const collapsed = settings.sidebarCollapsed;
  const isFocus = /^\/(pdf|video)\//.test(location.pathname) || /^\/quiz\//.test(location.pathname);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  if (isFocus) {
    return (
      <div className="relative min-h-screen bg-bg">
        <div className="atmosphere" aria-hidden="true" />
        <div className="relative z-10 min-h-screen">
          <Outlet />
        </div>
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-surface">
      <div className="atmosphere" aria-hidden="true" />
      <Sidebar />
      <div
        className={cn(
          'relative z-10 min-h-screen transition-[padding] duration-200 ease-calm',
          collapsed ? 'md:pl-[76px]' : 'md:pl-[256px]',
        )}
      >
        <Topbar onOpenSearch={() => setSearchOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-[18px] pb-20 pt-7 sm:px-7 lg:px-10 lg:pb-16">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
