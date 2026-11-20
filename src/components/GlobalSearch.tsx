import { useEffect, useState } from 'react';
import { SearchResultsList } from './SearchResults';
import { Dialog } from './Dialog';
import { SearchField } from './ui';

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Search the library"
      description="Across study materials, questionnaires and videos — by title, description, subject or grade."
      size="lg"
      bodyClassName="px-3 pb-3 pt-3"
    >
      <SearchField value={query} onChange={setQuery} placeholder="Search titles, subjects, “grade 9”…" autoFocus ariaLabel="Search all resources" />
      <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-card border border-line bg-panel2/40">
        {query.trim() ? (
          <SearchResultsList query={query} onNavigate={onClose} limit={14} />
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-ink2">Start typing to search your archive.</p>
            <p className="mt-1.5 text-[11.5px] text-muted">Try “biology”, “grade 9”, “reproduction” or “pancasila”.</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
