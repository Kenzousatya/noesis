import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppSettings, DashboardSectionKey, ThemeMode, ViewMode } from '../lib/types';

const STORAGE_KEY = 'noema.settings.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  sidebarCollapsed: false,
  libraryView: 'grid',
  dashboardHidden: [],
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'system' ? parsed.theme : 'dark',
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      libraryView: parsed.libraryView === 'list' ? 'list' : 'grid',
      dashboardHidden: Array.isArray(parsed.dashboardHidden)
        ? parsed.dashboardHidden.filter((key): key is DashboardSectionKey =>
            ['today', 'priority', 'timetable', 'continue', 'subjects', 'recent', 'activity'].includes(key),
          )
        : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  resolvedTheme: 'dark' | 'light';
  update: (patch: Partial<AppSettings>) => void;
  setTheme: (theme: ThemeMode) => void;
  setLibraryView: (view: ViewMode) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true,
  );

  const resolvedTheme: 'dark' | 'light' =
    settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#101411' : '#F1F0EA');
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // A blocked localStorage should not break the interface.
    }
  }, [settings]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => update({ theme }), [update]);
  const setLibraryView = useCallback((libraryView: ViewMode) => update({ libraryView }), [update]);
  const toggleSidebar = useCallback(
    () => setSettings((current) => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed })),
    [],
  );
  const setSidebarCollapsed = useCallback(
    (sidebarCollapsed: boolean) => setSettings((current) => ({ ...current, sidebarCollapsed })),
    [],
  );

  const value = useMemo(
    () => ({ settings, resolvedTheme, update, setTheme, setLibraryView, toggleSidebar, setSidebarCollapsed }),
    [settings, resolvedTheme, update, setTheme, setLibraryView, toggleSidebar, setSidebarCollapsed],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
