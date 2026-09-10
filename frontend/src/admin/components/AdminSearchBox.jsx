import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, X, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { hasPermission } from '../adminPermissions';
import { useAdminPanel } from '../context/AdminPanelContext';
import {
  buildAdminSearchEntries,
  searchAdmin,
  normalizeSearchText,
  normalizeWithMap,
} from '../adminSearchIndex';

const RECENT_KEY = 'marketplus_admin_cmdk_recent';
const MAX_RECENT = 6;
const isMac = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

/** Wrap the parts of `text` that match any query token with <mark>. */
function Highlight({ text, tokens }) {
  if (!tokens.length || !text) return text;
  const { norm, map } = normalizeWithMap(text);
  const ranges = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    while (from <= norm.length) {
      const idx = norm.indexOf(token, from);
      if (idx === -1) break;
      const srcStart = map[idx];
      const srcEnd = map[idx + token.length - 1] + 1;
      if (srcStart != null && srcEnd != null) ranges.push([srcStart, srcEnd]);
      from = idx + token.length;
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i += 1) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
    else merged.push(ranges[i]);
  }
  const out = [];
  let cursor = 0;
  merged.forEach(([start, end], i) => {
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(<mark key={i} className="rounded bg-amber-200/70 px-0.5 text-inherit">{text.slice(start, end)}</mark>);
    cursor = end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/**
 * Inline admin search — a normal field in the header that drops a results
 * list directly beneath it. No modal, no overlay.
 */
export default function AdminSearchBox({ isAr, className = 'w-40 sm:w-56 lg:w-72' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showRevenue } = useAdminPanel();
  const [recent, setRecent] = useLocalStorage(RECENT_KEY, []);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const entries = useMemo(() => buildAdminSearchEntries(), []);

  const canAccess = useCallback((entry) => {
    if (entry.requiresRevenue && !showRevenue) return false;
    if (!entry.permission) return true;
    return hasPermission(user, entry.permission);
  }, [user, showRevenue]);

  const recentKeys = useMemo(() => (Array.isArray(recent) ? recent : []), [recent]);

  const results = useMemo(
    () => searchAdmin(entries, query, { isAr, canAccess, recentKeys }),
    [entries, query, isAr, canAccess, recentKeys],
  );

  const tokens = useMemo(() => {
    const n = normalizeSearchText(query);
    return n ? n.split(' ').filter(Boolean) : [];
  }, [query]);

  const activeIdx = results.length ? Math.min(active, results.length - 1) : 0;
  const showingRecent = !tokens.length;
  const panelOpen = open && (results.length > 0 || tokens.length > 0);

  const close = useCallback(() => {
    setOpen(false);
    setActive(0);
  }, []);

  const updateQuery = (value) => {
    setQuery(value);
    setActive(0);
    setOpen(true);
  };

  const go = useCallback((item) => {
    if (!item) return;
    const { entry } = item;
    setRecent((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return [entry.key, ...list.filter((k) => k !== entry.key)].slice(0, MAX_RECENT);
    });
    setQuery('');
    close();
    inputRef.current?.blur();
    if (entry.external) window.open(entry.path, '_blank', 'noopener');
    else navigate(entry.path);
  }, [navigate, close, setRecent]);

  // close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  // global shortcut: Ctrl/Cmd+K or "/" focuses the field
  useEffect(() => {
    const onKey = (e) => {
      const cmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      const target = e.target;
      const typing = target instanceof HTMLElement
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (cmdK || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // keep the active row visible
  useEffect(() => {
    if (!panelOpen) return;
    const node = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, panelOpen]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (open) { e.preventDefault(); e.stopPropagation(); close(); inputRef.current?.blur(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      if (results.length) setActive((activeIdx + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) setActive((activeIdx - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (results[activeIdx]) { e.preventDefault(); go(results[activeIdx]); }
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setActive(Math.max(0, results.length - 1));
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        className={[
          'flex items-center gap-2 rounded-lg border bg-white px-2.5 py-2 transition-colors',
          panelOpen ? 'border-primary-300 ring-2 ring-primary-100' : 'border-border hover:border-slate-300',
        ].join(' ')}
      >
        <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={isAr ? 'بحث…' : 'Search…'}
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={panelOpen}
          aria-controls="admin-search-list"
          aria-activedescendant={panelOpen && results[activeIdx] ? `admin-search-opt-${activeIdx}` : undefined}
          aria-label={isAr ? 'بحث في لوحة الإدارة' : 'Search the admin panel'}
        />
        {query ? (
          <button
            type="button"
            onClick={() => { updateQuery(''); inputRef.current?.focus(); }}
            className="rounded p-0.5 text-text-muted hover:bg-slate-100 hover:text-text"
            aria-label={isAr ? 'مسح' : 'Clear'}
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded border border-border bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:inline">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        )}
      </div>

      {panelOpen && (
        <div
          className="absolute end-0 top-full z-40 mt-2 w-full min-w-[18rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-white shadow-xl"
        >
          <ul
            ref={listRef}
            id="admin-search-list"
            role="listbox"
            className="max-h-[min(70vh,26rem)] overflow-y-auto p-1.5 scrollbar-thin"
          >
            {showingRecent && results.length > 0 && (
              <li className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                <Clock className="h-3 w-3" aria-hidden />
                {isAr ? 'الأخيرة' : 'Recent'}
              </li>
            )}

            {results.map((item, idx) => {
              const { entry } = item;
              const Icon = entry.Icon;
              const title = isAr ? entry.titleAr : entry.titleEn;
              const group = isAr ? (entry.groupAr || '') : (entry.groupEn || '');
              const desc = isAr ? (entry.descAr || '') : (entry.descEn || '');
              const isActive = idx === activeIdx;
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    id={`admin-search-opt-${idx}`}
                    data-idx={idx}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => go(item)}
                    onMouseMove={() => setActive(idx)}
                    className={[
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors',
                      isActive ? 'bg-primary-50 text-primary-800' : 'text-text hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                        isActive ? 'border-primary-200 bg-white text-primary-700' : 'border-border bg-slate-50 text-text-muted',
                      ].join(' ')}
                    >
                      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">
                          <Highlight text={title} tokens={tokens} />
                        </span>
                        {item.recent && !showingRecent && (
                          <Clock className="h-3 w-3 shrink-0 text-text-muted" aria-hidden />
                        )}
                      </span>
                      {(group || desc) && (
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                          {group && <span className="truncate">{group}</span>}
                          {group && desc && <span aria-hidden>·</span>}
                          {desc && <span className="truncate">{desc}</span>}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}

            {!results.length && tokens.length > 0 && (
              <li className="px-3 py-6 text-center text-sm text-text-muted">
                {isAr ? `لا يوجد ما يطابق «${query}»` : `Nothing matches “${query}”`}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
