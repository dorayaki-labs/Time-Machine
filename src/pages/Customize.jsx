// The Customization Studio: a full appearance editor for Time Machine.
// Visitors pick a built-in theme, tweak every visual token, build their own
// themes, and save them locally — no account, no backend. Everything is
// previewed live on the actual site while editing; nothing is kept until
// Save, and nothing here can touch archive data or accounts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import Icon from '@/components/Icon.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useTheme from '@/hooks/useTheme.jsx';
import {
  BASE_THEMES, COLOR_GROUPS, SETTINGS_SCHEMA, SCHEMA_VERSION, EMPTY_SETTINGS,
  parseThemeFile, serializeTheme, themeFileName,
  contrastRatio, effectiveVar,
} from '@/lib/themeSchema.js';
import { ColorControl, RangeControl, SegmentControl, ToggleControl, ResetButton } from '@/components/studio/Controls.jsx';
import StudioPreview from '@/components/studio/Preview.jsx';

// Sections carry a nav group so the studio navigation reads as a hierarchy:
// getting started → look → behaviour. The labels render as small headings
// inside the section nav, and every section opens with its one-line
// description so it is always clear what the controls below will change.
const SECTIONS = [
  { id: 'overview', label: 'Overview', group: 'Start' },
  { id: 'saved', label: 'Saved themes', group: 'Start' },
  { id: 'colors', label: 'Colours', group: 'The look', desc: 'Every colour of the site, one group at a time — page, text, accents and status colours. The readability check at the bottom tells you if any text becomes hard to read.' },
  { id: 'typography', label: 'Typography', group: 'The look', desc: 'The typeface of the whole site and the base size every other size is derived from.' },
  { id: 'layout', label: 'Layout', group: 'The look', desc: 'How airy the pages feel (spacing) and how wide the content column reaches.' },
  { id: 'surfaces', label: 'Surfaces', group: 'The look', desc: 'The look of panels and cards: corner roundness, shadows and the glass blur behind overlays.' },
  { id: 'catalogue', label: 'Catalogue', group: 'The look', desc: 'The episode and movie cards on catalogue pages: how wide they are, whether descriptions show, and the hover effects.' },
  { id: 'motion', label: 'Motion', group: 'Behaviour', desc: 'How much the site animates. Your system’s reduced-motion setting always wins over this.' },
  { id: 'accessibility', label: 'Accessibility', group: 'Behaviour', desc: 'Underlines on links and stronger focus outlines — small changes that make the site easier to follow.' },
];
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
const EDITOR_SECTIONS = new Set(['colors', 'typography', 'layout', 'surfaces', 'catalogue', 'motion', 'accessibility']);

const newId = () => `custom:${crypto.randomUUID?.() ?? `f${Date.now()}${Math.random().toString(36).slice(2, 8)}`}`;
const clone = (x) => JSON.parse(JSON.stringify(x));
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

export default function Customize() {
  useDocumentTitle('Customize');
  const {
    activeId, activeTheme, isPreviewing, customThemes,
    applyBuiltin, applyCustom, preview, clearPreview,
    saveTheme, deleteTheme, renameTheme, duplicateTheme,
    resetCustomization, storageWarning,
  } = useTheme();

  const [draft, setDraft] = useState(null); // { id, name, description, baseTheme, settings }
  const [section, setSection] = useState('overview');
  const [importMessage, setImportMessage] = useState(null); // { ok, text }
  const [exportFor, setExportFor] = useState(null); // theme-like object for the export dialog
  const [contrast, setContrast] = useState([]);
  const fileInput = useRef(null);

  // The draft is applied to the whole site as it changes.
  useEffect(() => {
    if (draft) preview({ baseTheme: draft.baseTheme, settings: draft.settings });
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the studio reverts to whatever is saved (the preview is
  // session-only by design).
  useEffect(() => () => clearPreview(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const savedSource = draft?.id ? customThemes.find((t) => t.id === draft.id) : null;
  const dirty = useMemo(() => {
    if (!draft) return false;
    const reference = savedSource
      ? { name: savedSource.name, description: savedSource.description, baseTheme: savedSource.baseTheme, settings: savedSource.settings }
      : { name: '', description: '', baseTheme: draft.baseTheme, settings: {} };
    return JSON.stringify({ ...draft }) !== JSON.stringify({ ...draft, ...reference });
  }, [draft, savedSource]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  // Contrast report for the colours section, read from the live document so
  // it reflects overrides and the base palette together.
  useEffect(() => {
    if (section !== 'colors') return undefined;
    const t = setTimeout(() => {
      const pairs = [
        ['Text on the page background', effectiveVar('--text'), effectiveVar('--bg')],
        ['Secondary text on the page background', effectiveVar('--text-2'), effectiveVar('--bg')],
        ['Text on surfaces', effectiveVar('--text'), effectiveVar('--surface')],
        ['Text on the accent colour', effectiveVar('--on-accent'), effectiveVar('--accent')],
      ];
      setContrast(pairs.map(([label, a, b]) => ({ label, ratio: contrastRatio(a, b) })));
    }, 0);
    return () => clearTimeout(t);
  }, [section, draft]);

  // ---- draft helpers ------------------------------------------------------

  const editDraft = (patch) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const setColor = (key, value) => setDraft((d) => {
    if (!d) return d;
    const settings = clone(d.settings);
    settings.colors ??= {};
    if (value) settings.colors[key] = value;
    else delete settings.colors[key];
    return { ...d, settings };
  });

  const setField = (group, field, value) => setDraft((d) => {
    if (!d) return d;
    const settings = clone(d.settings);
    settings[group] ??= {};
    if (value === undefined) delete settings[group][field];
    else settings[group][field] = value;
    return { ...d, settings };
  });

  const resetGroup = (group) => setDraft((d) => (d ? { ...d, settings: { ...d.settings, [group]: {} } } : d));

  const closeDraft = ({ force = false } = {}) => {
    if (dirty && !force && !window.confirm('You have unsaved changes. Discard them?')) return false;
    setDraft(null);
    setSection('overview');
    clearPreview();
    return true;
  };

  const startNew = () => {
    setDraft({ id: null, name: 'My theme', description: '', baseTheme: activeTheme?.baseTheme ?? 'light', settings: EMPTY_SETTINGS() });
    setSection('colors');
  };

  const startFromPreset = (baseId) => {
    const base = BASE_THEMES.find((t) => t.id === baseId);
    setDraft({ id: null, name: `My ${base ? base.label : 'theme'}`, description: '', baseTheme: baseId, settings: EMPTY_SETTINGS() });
    setSection('colors');
  };

  const editSaved = (theme) => {
    setDraft({ id: theme.id, name: theme.name, description: theme.description ?? '', baseTheme: theme.baseTheme, settings: clone(theme.settings) });
    setSection('colors');
  };

  const save = ({ asNew = false } = {}) => {
    if (!draft) return;
    const id = asNew || !draft.id ? newId() : draft.id;
    const clean = saveTheme({
      id, name: draft.name || 'My theme', description: draft.description ?? '',
      baseTheme: draft.baseTheme, settings: draft.settings,
      createdAt: savedSource?.createdAt ?? new Date().toISOString(),
    });
    setDraft({ id: clean.id, name: clean.name, description: clean.description, baseTheme: clean.baseTheme, settings: clean.settings });
  };

  // ---- import / export ------------------------------------------------------

  const doImport = async (file) => {
    setImportMessage(null);
    if (!file) return;
    if (file.size > 64 * 1024) {
      setImportMessage({ ok: false, text: 'That file is too large to be a theme (over 64 kB).' });
      return;
    }
    try {
      const result = parseThemeFile(await file.text());
      if (!result.ok) {
        setImportMessage({ ok: false, text: result.error });
        return;
      }
      const base = BASE_THEMES.find((t) => t.id === result.theme.baseTheme);
      const ok = window.confirm(
        `Import “${result.theme.name}” (${base ? base.label : result.theme.baseTheme} base)`
        + `${result.dropped ? ` — ${result.dropped} unknown setting${result.dropped === 1 ? '' : 's'} will be skipped` : ''}?`
        + '\nIt will be saved and made active.',
      );
      if (!ok) return;
      if (draft && !window.confirm('Importing replaces what you are editing. Continue?')) return;
      const clean = saveTheme(result.theme);
      editSaved(clean);
      setImportMessage({
        ok: true,
        text: `Imported “${clean.name}”${result.dropped ? ` (${result.dropped} unknown setting${result.dropped === 1 ? '' : 's'} skipped)` : ''}.`,
      });
    } catch {
      setImportMessage({ ok: false, text: 'That file could not be read.' });
    }
  };

  const download = (theme) => {
    const blob = new Blob([serializeTheme(theme)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = themeFileName(theme);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ---- render helpers -------------------------------------------------------

  const renderField = (groupKey, fieldKey, field) => {
    const value = draft?.settings?.[groupKey]?.[fieldKey];
    const props = {
      key: fieldKey,
      label: field.label,
      help: field.help,
      value,
      fallback: field.default,
      onChange: (v) => setField(groupKey, fieldKey, v),
      onReset: () => setField(groupKey, fieldKey, undefined),
    };
    if (field.type === 'enum') return <SegmentControl {...props} options={field.options} />;
    if (field.type === 'range') return <RangeControl {...props} min={field.min} max={field.max} step={field.step} unit={field.unit} />;
    return <ToggleControl {...props} />;
  };

  const activeBase = BASE_THEMES.find((t) => t.id === activeTheme?.baseTheme);
  const activeName = activeId === 'preview'
    ? (draft ? `${draft.name} (unsaved)` : 'Preview')
    : (savedCustomName(activeId, customThemes) ?? activeBase?.label ?? 'Theme');

  return (
    <PageContainer className="customize">
      <header className="page-opening">
        <p className="eyebrow">Customization studio</p>
        <h1>Make Time Machine yours.</h1>
        <p className="page-opening__lead">
          Pick a theme, tune any part of it, and save your own. Themes live in this browser only —
          no account needed. <Link to="/" className="text-link">Back to the archive</Link>
        </p>
      </header>

      {storageWarning ? <p className="notice notice--warn" role="alert"><Icon name="alert" size={15} /> {storageWarning}</p> : null}

      {/* -------- editor bar -------- */}
      {draft ? (
        <div className="studio-bar" data-dirty={dirty ? 'on' : 'off'}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => closeDraft()}>
            <Icon name="arrowLeft" size={14} /> Back to overview
          </button>
          <div className="studio-bar__name">
            <input
              type="text"
              value={draft.name}
              maxLength={60}
              aria-label="Theme name"
              onChange={(e) => editDraft({ name: e.target.value })}
            />
            <select
              value={draft.baseTheme}
              aria-label="Base palette"
              onChange={(e) => editDraft({ baseTheme: e.target.value })}
            >
              {BASE_THEMES.map((t) => <option key={t.id} value={t.id}>Base: {t.label}</option>)}
            </select>
          </div>
          <span className={`studio-bar__dirty${dirty ? ' is-dirty' : ''}`} title={dirty ? 'Unsaved changes' : 'All changes saved'}>
            {dirty ? 'Unsaved' : 'Saved'}
          </span>
          <div className="studio-bar__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setExportFor({ ...draft, id: draft.id ?? newId() })}>
              <Icon name="download" size={14} /> Export JSON
            </button>
            {draft.id ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => save({ asNew: true })}>Save as new</button>
            ) : null}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => closeDraft()}>Discard</button>
            <button type="button" className="btn btn--primary btn--sm" disabled={!dirty} onClick={() => save()}>
              {dirty ? 'Save theme' : 'Saved'}
            </button>
          </div>
        </div>
      ) : null}
      {draft ? (
        <p className="studio-bar__hint">
          You are editing a draft — every change previews live across the whole site. Nothing is
          kept until you press <strong>Save theme</strong>.
        </p>
      ) : null}

      <div className="studio">
        {/* -------- section navigation -------- */}
        <nav className="studio-nav" aria-label="Studio sections">
          {(() => {
            const visible = SECTIONS.filter((s) => !EDITOR_SECTIONS.has(s.id) || draft);
            const out = [];
            let lastGroup = null;
            for (const s of visible) {
              if (s.group !== lastGroup) {
                lastGroup = s.group;
                out.push(<p key={`group-${s.group}`} className="studio-nav__group" aria-hidden="true">{s.group}</p>);
              }
              out.push(
                <button
                  key={s.id}
                  type="button"
                  className={section === s.id ? 'is-active' : ''}
                  aria-current={section === s.id ? 'true' : undefined}
                  onClick={() => {
                    if (EDITOR_SECTIONS.has(s.id) && !draft) return;
                    setSection(s.id);
                  }}
                  disabled={EDITOR_SECTIONS.has(s.id) && !draft}
                  title={EDITOR_SECTIONS.has(s.id) && !draft ? 'Start editing a theme first (New theme, or Customize on a preset)' : null}
                >{s.label}</button>,
              );
            }
            return out;
          })()}
        </nav>

        {/* -------- controls -------- */}
        <div className="studio-main">
          {section === 'overview' ? (
            <OverviewSection
              activeName={activeName}
              activeBase={activeBase}
              isPreviewing={isPreviewing}
              customThemes={customThemes}
              onPreset={(id) => (draft ? closeDraft({ force: false }) && applyBuiltin(id) : applyBuiltin(id))}
              onCustomizePreset={startFromPreset}
              onNew={startNew}
              onImport={() => fileInput.current?.click()}
              importMessage={importMessage}
              onRestoreDefault={() => { if (draft) closeDraft({ force: false }); applyBuiltin('light'); }}
              onResetAll={() => {
                if (!window.confirm('Delete every saved custom theme and return to the default look?')) return;
                setDraft(null);
                resetCustomization();
              }}
              savedCount={customThemes.length}
              onOpenSaved={() => setSection('saved')}
            />
          ) : null}

          {section === 'saved' ? (
            <SavedSection
              customThemes={customThemes}
              activeId={activeId}
              onApply={(t) => { if (draft) closeDraft({ force: false }); applyCustom(t.id); }}
              onEdit={editSaved}
              onRename={(t) => {
                const name = window.prompt('Rename this theme', t.name);
                if (name && name.trim()) renameTheme(t.id, name.trim());
              }}
              onDuplicate={(t) => duplicateTheme(t.id)}
              onExport={(t) => setExportFor(t)}
              onDelete={(t) => {
                if (window.confirm(`Delete “${t.name}”? This cannot be undone (export it first if you want a copy).`)) {
                  if (draft?.id === t.id) setDraft(null);
                  deleteTheme(t.id);
                }
              }}
              onImport={() => fileInput.current?.click()}
              importMessage={importMessage}
              onNew={startNew}
            />
          ) : null}

          {section === 'colors' && draft ? (
            <section className="studio-section" aria-label="Colours">
              <p className="studio-section__intro">{SECTION_BY_ID.colors.desc}</p>
              {COLOR_GROUPS.map((group) => (
                <div key={group.id} className="studio-group">
                  <div className="studio-group__head">
                    <h3>{group.label}</h3>
                    {Object.keys(draft.settings.colors ?? {}).some((k) => group.colors.some((c) => c.key === k)) ? (
                      <ResetButton onReset={() => resetGroup('colors')} label="Reset group" />
                    ) : null}
                  </div>
                  {group.colors.map((c) => (
                    <ColorControl
                      key={c.key}
                      label={c.label}
                      value={draft.settings.colors?.[c.key]}
                      fallback={baseColor(draft.baseTheme, c.key) ?? '#000000'}
                      onChange={(v) => setColor(c.key, v)}
                      onReset={() => setColor(c.key, undefined)}
                    />
                  ))}
                </div>
              ))}
              <div className="studio-group">
                <h3>Readability check</h3>
                <ul className="studio-contrast">
                  {contrast.map((c) => (
                    <li key={c.label} data-level={level(c.ratio)}>
                      <span>{c.label}</span>
                      <span className="mono">{c.ratio ? `${c.ratio.toFixed(2)}:1` : '—'}</span>
                      <span className="studio-contrast__note">{level(c.ratio) === 'ok' ? 'fine' : level(c.ratio) === 'low' ? 'low contrast' : 'hard to read'}</span>
                    </li>
                  ))}
                </ul>
                <p className="studio-control__help">
                  Low contrast is allowed — this is your theme — but text under 3:1 is genuinely hard to read.
                </p>
              </div>
            </section>
          ) : null}

          {draft && ['typography', 'layout', 'surfaces', 'catalogue', 'motion', 'accessibility'].includes(section) ? (
            <section className="studio-section" aria-label={section}>
              <p className="studio-section__intro">{SECTION_BY_ID[section]?.desc}</p>
              <div className="studio-group">
                <div className="studio-group__head">
                  <h3>{SETTINGS_SCHEMA[section].label}</h3>
                  {Object.keys(draft.settings[section] ?? {}).length ? (
                    <ResetButton onReset={() => resetGroup(section)} label="Reset section" />
                  ) : null}
                </div>
                {Object.entries(SETTINGS_SCHEMA[section].fields).map(([fieldKey, field]) => renderField(section, fieldKey, field))}
              </div>
            </section>
          ) : null}
        </div>

        {/* -------- live preview -------- */}
        <aside className="studio-side">
          <StudioPreview />
        </aside>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }}
      />

      {exportFor ? (
        <ExportDialog
          theme={exportFor}
          onClose={() => setExportFor(null)}
          onExport={(theme) => { download(theme); setExportFor(null); }}
        />
      ) : null}
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------

function OverviewSection({
  activeName, activeBase, isPreviewing, customThemes, savedCount,
  onPreset, onCustomizePreset, onNew, onImport, importMessage,
  onRestoreDefault, onResetAll, onOpenSaved,
}) {
  return (
    <div className="studio-section">
      {/* How this studio works, in three steps — the page used to open with
          controls and no orientation, which is what made it confusing. */}
      <div className="studio-steps">
        <div className="studio-steps__item">
          <span className="studio-steps__num mono">1</span>
          <div><strong>Pick a starting point.</strong> Use a built-in theme as-is, or press Customize on one to start tweaking it.</div>
        </div>
        <div className="studio-steps__item">
          <span className="studio-steps__num mono">2</span>
          <div><strong>Tune it.</strong> Colours, fonts, spacing, cards — every change previews live across the whole site while you edit.</div>
        </div>
        <div className="studio-steps__item">
          <span className="studio-steps__num mono">3</span>
          <div><strong>Save it.</strong> Your themes live in this browser — no account. Export a JSON file to move them anywhere.</div>
        </div>
      </div>

      <div className="studio-twins">
        <div>
          <p className="studio-twins__title"><Icon name="palette" size={15} /> This studio</p>
          <p className="studio-twins__text">Everything visual — colours, typography, layout, cards, motion.</p>
        </div>
        <div>
          <p className="studio-twins__title"><Icon name="settings" size={15} /> Settings</p>
          <p className="studio-twins__text">Everything behavioural — the top bar layout, its buttons, popups.</p>
          <Link to="/settings" className="text-link">Open Settings →</Link>
        </div>
      </div>

      <div className="studio-active">
        <div>
          <p className="studio-active__label">Current look</p>
          <p className="studio-active__name">{activeName}{isPreviewing ? ' — previewing' : ''}</p>
          {activeBase ? <p className="studio-active__meta">{activeBase.dark ? 'Dark' : 'Light'} palette · {activeBase.label}</p> : null}
        </div>
        <div className="studio-active__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={onNew}><Icon name="plus" size={14} /> New theme</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onImport}>Import JSON</button>
        </div>
      </div>

      {importMessage ? (
        <p className={`notice${importMessage.ok ? '' : ' notice--warn'}`} role="status">{importMessage.text}</p>
      ) : null}

      <h3 className="studio-subhead">Built-in themes</h3>
      <ul className="studio-presets">
        {BASE_THEMES.map((t) => (
          <li key={t.id} className="studio-preset">
            <button type="button" className="studio-preset__swatch" onClick={() => onPreset(t.id)} aria-hidden="true" tabIndex={-1}>
              <span style={{ background: t.swatch[0] }} />
              <span style={{ background: t.swatch[1] }} />
            </button>
            <div className="studio-preset__body">
              <span className="studio-preset__name">{t.label}</span>
              <span className="studio-preset__meta">{t.dark ? 'Dark' : 'Light'} palette</span>
              <div className="studio-preset__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPreset(t.id)}>Use</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onCustomizePreset(t.id)}>Customize</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="studio-subhead">Your themes <span className="muted">({savedCount})</span></h3>
      {savedCount ? (
        <p className="studio-inline">
          <button type="button" className="text-link" onClick={onOpenSaved}>Open saved themes</button>
        </p>
      ) : (
        <p className="muted">You have not saved any themes of your own yet. Start from a built-in theme and make it yours.</p>
      )}

      <h3 className="studio-subhead">Defaults</h3>
      <div className="studio-danger">
        <div>
          <p className="studio-danger__title">Restore the default look</p>
          <p className="studio-danger__text">Go back to the classic light theme. Your saved themes are kept.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRestoreDefault}>Restore</button>
      </div>
      <div className="studio-danger">
        <div>
          <p className="studio-danger__title">Delete all custom themes</p>
          <p className="studio-danger__text">Removes every theme you saved in this browser and restores the default look.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={onResetAll} disabled={!savedCount}>Delete all</button>
      </div>
      <p className="studio-control__help">Theme format version {SCHEMA_VERSION} — themes you export can be imported on any copy of the site.</p>
    </div>
  );
}

function SavedSection({
  customThemes, activeId, importMessage,
  onApply, onEdit, onRename, onDuplicate, onExport, onDelete, onImport, onNew,
}) {
  return (
    <div className="studio-section">
      <div className="studio-active">
        <div>
          <p className="studio-active__label">Saved in this browser</p>
          <p className="studio-active__name">{customThemes.length} theme{customThemes.length === 1 ? '' : 's'}</p>
        </div>
        <div className="studio-active__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={onNew}><Icon name="plus" size={14} /> New theme</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onImport}>Import JSON</button>
        </div>
      </div>

      {importMessage ? (
        <p className={`notice${importMessage.ok ? '' : ' notice--warn'}`} role="status">{importMessage.text}</p>
      ) : null}

      {customThemes.length === 0 ? (
        <p className="muted">Nothing saved yet. Build one from a preset, or import a theme file.</p>
      ) : (
        <ul className="studio-saved">
          {customThemes.map((t) => (
            <li key={t.id} className="studio-saved__item" data-active={activeId === t.id ? 'on' : 'off'}>
              <div className="studio-saved__head">
                <SavedSwatch theme={t} />
                <div className="studio-saved__who">
                  <span className="studio-saved__name">{t.name}</span>
                  <span className="studio-saved__meta">
                    {baseLabel(t.baseTheme)} · updated {fmtDay(t.updatedAt)}
                  </span>
                </div>
                {activeId === t.id ? <span className="chip chip--mono mono">Active</span> : null}
              </div>
              {t.description ? <p className="studio-saved__desc">{t.description}</p> : null}
              <div className="studio-saved__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onApply(t)} disabled={activeId === t.id}>Use</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(t)}>Edit</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onRename(t)}>Rename</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDuplicate(t)}>Duplicate</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onExport(t)}><Icon name="download" size={13} /> Export</button>
                <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => onDelete(t)}><Icon name="trash" size={13} /> Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExportDialog({ theme, onClose, onExport }) {
  const [name, setName] = useState(theme.name || 'My theme');
  const [description, setDescription] = useState(theme.description ?? '');
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal studio-export" role="dialog" aria-modal="true" aria-label="Export theme">
        <div className="modal__head">
          <h3>Export theme as JSON</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={19} /></button>
        </div>
        <div className="modal__body">
          <div className="field">
            <label htmlFor="export-name">Theme name</label>
            <input id="export-name" type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="export-desc">Description <span className="field__opt">(optional)</span></label>
            <input id="export-desc" type="text" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="What kind of look is this?" />
          </div>
          <p className="studio-control__help">
            Saves as <span className="mono">{themeFileName({ name })}</span> — a small JSON file with your
            colours and settings only. Import it on any copy of Time Machine.
          </p>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={() => onExport({ ...theme, name: name.trim() || 'My theme', description })}>
            <Icon name="download" size={15} /> Export
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The swatch pair for a saved theme (its base palette + accent override). */
function SavedSwatch({ theme }) {
  const base = BASE_THEMES.find((t) => t.id === theme.baseTheme) ?? BASE_THEMES[0];
  const bg = theme.settings?.colors?.bg || base.swatch[0];
  const accent = theme.settings?.colors?.accent || base.swatch[1];
  return (
    <span className="studio-saved__swatch" aria-hidden="true">
      <span style={{ background: bg }} />
      <span style={{ background: accent }} />
    </span>
  );
}

// Base palette values, for colour fallbacks in the editor. Mirrors the
// :root[data-theme] blocks in variables.css (which are the applied source of
// truth; this map is only used for chips and placeholders).
const BASE_COLORS = {
  light: { bg: '#f4f1ea', surface: '#faf8f2', text: '#26231d', text2: '#5c574c', text3: '#8d8779', accent: '#2b5d8f', onAccent: '#f7f5ef', ok: '#2e7d4f', warn: '#8a6217', bad: '#a34141', review: '#6b5ea8', border: '#d9d3c4' },
  dark: { bg: '#151a22', surface: '#1c222d', text: '#ecebe5', text2: '#b3b1a6', text3: '#83817a', accent: '#8fb8e3', onAccent: '#101823', ok: '#86c9a4', warn: '#d9b676', bad: '#d98f8f', review: '#ab9fe3', border: '#303949' },
  midnight: { bg: '#0d1220', surface: '#141b2d', text: '#e3e9f5', text2: '#a4b1c9', text3: '#6d7c99', accent: '#7aa5e8', onAccent: '#0c1526', ok: '#7fd0a0', warn: '#e0c07e', bad: '#e29a9a', review: '#b3a6ef', border: '#263352' },
  sakura: { bg: '#faf3f4', surface: '#fdf9fa', text: '#3a2a30', text2: '#7a5f68', text3: '#a98f98', accent: '#c25574', onAccent: '#fdf7f9', ok: '#3f8757', warn: '#9a6b1d', bad: '#b23f3f', review: '#8a5fa8', border: '#e3ccd4' },
  ocean: { bg: '#071824', surface: '#0c2231', text: '#e0eef4', text2: '#9db8c6', text3: '#64879a', accent: '#4cc9d9', onAccent: '#04222a', ok: '#63c79a', warn: '#d9c06c', bad: '#e08f8f', review: '#9a8ce0', border: '#1a4258' },
  forest: { bg: '#10160f', surface: '#18211a', text: '#e6ece2', text2: '#adbcaa', text3: '#7d8a77', accent: '#93c78e', onAccent: '#12200f', ok: '#93c78e', warn: '#d4bb77', bad: '#dd9090', review: '#a99ad9', border: '#2c3a2e' },
  amethyst: { bg: '#14101d', surface: '#1d1729', text: '#ece7f5', text2: '#b7aecd', text3: '#857b9c', accent: '#b79aec', onAccent: '#150f24', ok: '#8fd0a8', warn: '#d9bc7a', bad: '#dd9296', review: '#d9a9e0', border: '#332a4a' },
};

const baseColor = (baseTheme, key) => BASE_COLORS[baseTheme]?.[key] ?? BASE_COLORS.light[key];
const baseLabel = (id) => BASE_THEMES.find((t) => t.id === id)?.label ?? id;
const level = (ratio) => (ratio === null ? 'none' : ratio >= 4.5 ? 'ok' : ratio >= 3 ? 'low' : 'bad');
const savedCustomName = (activeIdValue, themes) => themes.find((t) => t.id === activeIdValue)?.name;
