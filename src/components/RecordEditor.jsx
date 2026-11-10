// The structured record editor, shared by the staff archive editor and the
// member "edit & send for review" dialog. Edits the RAW record file (no
// derived catalogue fields), binds deep paths, and offers dropdowns wherever
// a field only has a fixed set of valid values so nobody has to type (and
// mistype) vocabulary like language codes or category ids.

import Icon from './Icon.jsx';
import { getLanguages, getCategories, getCharacters, getGadgets, getRawEntry } from '@/lib/catalog.js';

/** One field bound to a deep path of the draft record. */
export function RecordField({ label, value, onChange, multiline, rows = 3, optional = true, placeholder, options = null, listId = null, listOptions = null, help }) {
  const id = `rf-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional ? <span className="field__opt"> (optional)</span> : <span className="field__req"> *</span>}</label>
      {options ? (
        <div className="select-wrap">
          <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}>
            <option value="">Choose…</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Icon name="chevronDown" size={16} className="select-wrap__chev" />
        </div>
      ) : listOptions ? (
        <>
          <input id={id} type="text" list={listId} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value || null)} />
          <datalist id={listId}>{listOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</datalist>
        </>
      ) : multiline ? (
        <textarea id={id} rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value || null)} />
      ) : (
        <input id={id} type="text" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value || null)} />
      )}
      {help ? <p className="field__help">{help}</p> : null}
    </div>
  );
}

/** Language select options built from data/languages.json. */
export function languageOptions() {
  return getLanguages().map((l) => ({ value: l.code, label: `${l.name}${l.native && l.native !== l.name ? ` — ${l.native}` : ''}` }));
}

/** Character category options from data/categories.json. */
export function categoryOptions() {
  return (getCategories().characterCategories ?? []).map((c) => ({ value: c.id, label: c.label }));
}

/**
 * A list of ids (characters on an entry, gadgets on an entry) edited as
 * removable chips: pick from the catalogue with a datalist, or type a new id.
 */
export function IdListField({ label, ids = [], onChange, kind }) {
  const options = kind === 'character'
    ? getCharacters().map((c) => ({ value: c.id, label: c.name?.en ?? c.id }))
    : getGadgets().map((g) => ({ value: g.id, label: g.name?.en ?? g.id }));
  const listId = `ids-${kind}`;
  const add = (value) => {
    const v = String(value ?? '').trim();
    if (!v || ids.includes(v)) return;
    onChange([...ids, v]);
  };
  return (
    <div className="field span-2">
      <label>{label} <span className="field__opt">(pick from the list or type an id)</span></label>
      {ids.length ? (
        <p className="chip-row">
          {ids.map((id) => (
            <span key={id} className="chip chip--removable">
              <span className="mono">{id}</span>
              <button type="button" aria-label={`Remove ${id}`} onClick={() => onChange(ids.filter((x) => x !== id))}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </p>
      ) : null}
      <input type="text" list={listId} placeholder={kind === 'character' ? 'e.g. char-nobita' : 'e.g. gadget-anywhere-door'}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(e.target.value); e.target.value = ''; } }}
        onBlur={(e) => { add(e.target.value); e.target.value = ''; }} />
      <datalist id={listId}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</datalist>
    </div>
  );
}

/**
 * Voice actors: repeatable rows.
 *  - On characters: { name, language, version } — a character is voiced by
 *    different people across the 1979/2005 series, so rows carry a version.
 *  - On episodes and movies (withCharacter): { name, characterId, language }
 *    — the row is about WHO voiced WHICH character in THIS entry, so it
 *    carries a character instead of a version (each entry is itself a
 *    version). Rows keep no `version` key: legacy values are stripped the
 *    moment the list is edited so committed JSON matches the schema.
 */
export function VoiceActorRows({ value = [], onChange, withCharacter = false }) {
  const clean = (rows) => rows.map((r) => {
    if (!withCharacter) return r;
    const { version, ...rest } = r;
    return rest;
  });
  const update = (i, patch) => onChange(clean(value.map((r, j) => (j === i ? { ...r, ...patch } : r))));
  const remove = (i) => onChange(clean(value.filter((_, j) => j !== i)));
  const add = () => onChange(clean([...value, withCharacter
    ? { name: { en: '', ja: null }, characterId: null, language: null }
    : { name: { en: '', ja: null }, language: null, version: null }]));
  const langs = languageOptions();
  const charOptions = getCharacters().map((c) => ({ value: c.id, label: c.name?.en ?? c.id }));
  return (
    <div className="field span-2">
      <label>Voice actors <span className="field__opt">{withCharacter ? '(who voiced which character in this entry)' : '(who voiced this character)'}</span></label>
      {value.map((v, i) => (
        <div key={i} className="repeat-row">
          <input type="text" placeholder="Name (English)" value={v.name?.en ?? ''} onChange={(e) => update(i, { name: { ...v.name, en: e.target.value || null } })} aria-label={`Voice actor ${i + 1} English name`} />
          <input type="text" placeholder="Name (Japanese)" lang="ja" value={v.name?.ja ?? ''} onChange={(e) => update(i, { name: { ...v.name, ja: e.target.value || null } })} aria-label={`Voice actor ${i + 1} Japanese name`} />
          <div className="select-wrap">
            <select value={v.language ?? ''} onChange={(e) => update(i, { language: e.target.value || null })} aria-label={`Voice actor ${i + 1} language`}>
              <option value="">Language…</option>
              {langs.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <Icon name="chevronDown" size={16} className="select-wrap__chev" />
          </div>
          {withCharacter ? (
            <input type="text" list="va-character-ids" placeholder="Character (e.g. char-nobita)" value={v.characterId ?? ''}
              onChange={(e) => update(i, { characterId: e.target.value || null })}
              aria-label={`Voice actor ${i + 1} character`} />
          ) : (
            <input type="text" placeholder="Version (e.g. 1979 anime)" value={v.version ?? ''} onChange={(e) => update(i, { version: e.target.value || null })} aria-label={`Voice actor ${i + 1} version`} />
          )}
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => remove(i)} aria-label={`Remove voice actor ${i + 1}`}><Icon name="trash" size={15} /></button>
        </div>
      ))}
      <datalist id="va-character-ids">{charOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</datalist>
      <div className="btn-row"><button type="button" className="btn btn--ghost btn--sm" onClick={add}><Icon name="plus" size={15} /> Add a voice actor</button></div>
    </div>
  );
}

/** Screenshots: repeatable { url, alt } rows, in display order. */
export function ScreenshotRows({ value = [], onChange }) {
  const update = (i, patch) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...value, { url: '', alt: null }]);
  return (
    <div className="field span-2">
      <label>Screenshots <span className="field__opt">(shown on the entry page as a gallery)</span></label>
      {value.map((s, i) => (
        <div key={i} className="repeat-row">
          <input type="url" placeholder="https://…/screenshot.png" value={s.url ?? ''} onChange={(e) => update(i, { url: e.target.value || null })} aria-label={`Screenshot ${i + 1} URL`} />
          <input type="text" placeholder="Alt text — what it shows" value={s.alt ?? ''} onChange={(e) => update(i, { alt: e.target.value || null })} aria-label={`Screenshot ${i + 1} alt text`} />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move screenshot ${i + 1} up`}><Icon name="chevronDown" size={15} className="is-flipped" /></button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move screenshot ${i + 1} down`}><Icon name="chevronDown" size={15} /></button>
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => remove(i)} aria-label={`Remove screenshot ${i + 1}`}><Icon name="trash" size={15} /></button>
        </div>
      ))}
      <div className="btn-row"><button type="button" className="btn btn--ghost btn--sm" onClick={add}><Icon name="plus" size={15} /> Add a screenshot</button></div>
    </div>
  );
}

/** Viewing sources: repeatable rows with dropdowns for type and subtitles. */
export function SourceRows({ sources, onChange }) {
  const update = (i, patch) => onChange(sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const remove = (i) => onChange(sources.filter((_, j) => j !== i));
  const add = () => onChange([...sources, { type: 'direct', data: '', label: null, language: null, subtitles: 'none', quality: null, notes: null }]);
  const langs = languageOptions();
  return (
    <div className="field span-2">
      <label>Viewing sources <span className="field__opt">(shown on the entry page; leave empty for none)</span></label>
      {sources.map((s, i) => (
        <div key={i} className="submission" style={{ padding: '0.8rem' }}>
          <div className="submission__fields">
            <div className="row"><dt>Type</dt><dd>
              <div className="select-wrap">
                <select value={s.type ?? ''} onChange={(e) => update(i, { type: e.target.value || null })}>
                  <option value="">auto</option><option value="direct">direct</option>
                  <option value="embed">embed</option><option value="youtube">youtube</option>
                </select>
                <Icon name="chevronDown" size={16} className="select-wrap__chev" />
              </div>
            </dd></div>
            <div className="row"><dt>URL / iframe</dt><dd><input type="text" value={s.data ?? ''} onChange={(e) => update(i, { data: e.target.value })} /></dd></div>
            <div className="row"><dt>Label</dt><dd><input type="text" value={s.label ?? ''} onChange={(e) => update(i, { label: e.target.value || null })} /></dd></div>
            <div className="row"><dt>Audio language</dt><dd>
              <div className="select-wrap">
                <select value={s.language ?? ''} onChange={(e) => update(i, { language: e.target.value || null })}>
                  <option value="">Choose…</option>
                  {langs.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <Icon name="chevronDown" size={16} className="select-wrap__chev" />
              </div>
            </dd></div>
            <div className="row"><dt>Subtitles</dt><dd>
              <div className="select-wrap">
                <select value={typeof s.subtitles === 'object' ? (s.subtitles.type ?? 'yes') : (s.subtitles ?? 'none')}
                  onChange={(e) => update(i, { subtitles: e.target.value === 'none' ? 'none' : e.target.value === 'yes' ? true : e.target.value })}>
                  <option value="none">none</option><option value="hard">hard sub</option>
                  <option value="soft">soft sub</option><option value="yes">yes (unknown)</option>
                </select>
                <Icon name="chevronDown" size={16} className="select-wrap__chev" />
              </div>
            </dd></div>
            <div className="row"><dt>Subtitle languages</dt><dd>
              <input type="text" value={Array.isArray(s.subtitles?.languages) ? s.subtitles.languages.join(', ') : ''}
                onChange={(e) => {
                  const langsList = e.target.value ? e.target.value.split(',').map((x) => x.trim()).filter(Boolean) : [];
                  const base = typeof s.subtitles === 'object' && s.subtitles ? s.subtitles : { has: true, type: null, languages: [] };
                  update(i, { subtitles: { ...base, has: base.has ?? true, languages: langsList } });
                }} />
            </dd></div>
            <div className="row"><dt>Quality</dt><dd><input type="text" value={s.quality ?? ''} onChange={(e) => update(i, { quality: e.target.value || null })} /></dd></div>
            <div className="row"><dt>Notes</dt><dd><input type="text" value={s.notes ?? ''} onChange={(e) => update(i, { notes: e.target.value || null })} /></dd></div>
          </div>
          <div className="btn-row"><button type="button" className="btn btn--ghost btn--danger btn--sm" onClick={() => remove(i)}>Remove source</button></div>
        </div>
      ))}
      <div className="btn-row"><button type="button" className="btn btn--ghost btn--sm" onClick={add}><Icon name="plus" size={15} /> Add a source</button></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The structured grid itself
// ---------------------------------------------------------------------------

/** A blank story segment with the complete schema-4 shape. */
export function blankSegment(entityId, position) {
  return {
    id: `${entityId}-${String(position).padStart(2, '0')}`,
    segmentNumber: position,
    title: { en: '', ja: null },
    alternateTitles: [],
    summary: null,
    description: null,
    image: { url: null, alt: null },
    screenshots: [],
    characters: [],
    gadgets: [],
    voiceActors: [],
    durationMinutes: null,
  };
}

/** Next free two-digit segment suffix, so ids are never reused or colliding. */
function nextSegmentSuffix(segments) {
  const used = new Set((segments ?? []).map((s) => Number(String(s.id ?? '').split('-').pop())).filter(Number.isFinite));
  let n = 1;
  while (used.has(n)) n += 1;
  return String(n).padStart(2, '0');
}

/** One expandable per-segment editor with its own complete set of story fields. */
function SegmentEditor({ draft, index, total, setField }) {
  const seg = draft.segments[index];
  const removeSegment = (i) => {
    if ((draft.segments?.length ?? 0) <= 1) return;
    setField('segments', (draft.segments ?? []).filter((_, j) => j !== i).map((s, j) => ({ ...s, segmentNumber: j + 1 })));
  };
  const moveSegment = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= (draft.segments?.length ?? 0)) return;
    const next = [...draft.segments];
    [next[i], next[j]] = [next[j], next[i]];
    // Display order travels with the array; stable ids do not move.
    setField('segments', next.map((s, k) => ({ ...s, segmentNumber: k + 1 })));
  };
  const segTitle = seg.title?.en || seg.title?.ja || `Segment ${index + 1}`;

  return (
    <details className="segment-editor" open={index === 0}>
      <summary className="segment-editor__head">
        <span className="segment-editor__number mono">Segment {index + 1}</span>
        <span className="segment-editor__title">{segTitle}</span>
        <span className="segment-editor__tools" onClick={(e) => e.preventDefault()}>
          <button type="button" className="btn btn--ghost btn--sm" disabled={index === 0}
            aria-label={`Move segment ${index + 1} up`} onClick={() => moveSegment(index, -1)}>
            <Icon name="chevronDown" size={14} className="is-flipped" />
          </button>
          <button type="button" className="btn btn--ghost btn--sm" disabled={index === total - 1}
            aria-label={`Move segment ${index + 1} down`} onClick={() => moveSegment(index, 1)}>
            <Icon name="chevronDown" size={14} />
          </button>
          <button type="button" className="btn btn--ghost btn--sm btn--danger" disabled={total <= 1}
            title={total <= 1 ? 'An episode always keeps at least one segment' : `Remove segment ${index + 1}`}
            aria-label={`Remove segment ${index + 1}`} onClick={() => removeSegment(index)}>
            <Icon name="trash" size={14} />
          </button>
        </span>
      </summary>
      <div className="segment-editor__body">
        <RecordField label={`Segment ${index + 1} English title`} value={seg.title?.en} onChange={(v) => setField(`segments.${index}.title.en`, v ?? '')} optional={false} />
        <RecordField label={`Segment ${index + 1} Japanese title`} value={seg.title?.ja} onChange={(v) => setField(`segments.${index}.title.ja`, v)} />
        <RecordField label="Alternate titles" placeholder="Comma-separated" value={(seg.alternateTitles ?? []).join(', ')}
          onChange={(v) => setField(`segments.${index}.alternateTitles`, v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [])} />
        <RecordField label="Synopsis" multiline rows={4} value={seg.summary} onChange={(v) => setField(`segments.${index}.summary`, v)} />
        <RecordField label="Description (longer, optional)" multiline rows={4} value={seg.description} onChange={(v) => setField(`segments.${index}.description`, v)} />
        <RecordField label="Runtime (minutes)" value={seg.durationMinutes} onChange={(v) => setField(`segments.${index}.durationMinutes`, v ? Number(v) : null)} />
        <RecordField label="Segment artwork URL" value={seg.image?.url} onChange={(v) => setField(`segments.${index}.image.url`, v)} />
        <RecordField label="Artwork alt text" value={seg.image?.alt} onChange={(v) => setField(`segments.${index}.image.alt`, v)} />
        <IdListField label="Characters in this segment" ids={seg.characters ?? []} onChange={(list) => setField(`segments.${index}.characters`, list)} kind="character" />
        <IdListField label="Gadgets in this segment" ids={seg.gadgets ?? []} onChange={(list) => setField(`segments.${index}.gadgets`, list)} kind="gadget" />
        <VoiceActorRows value={seg.voiceActors ?? []} onChange={(list) => setField(`segments.${index}.voiceActors`, list)} withCharacter />
        <ScreenshotRows value={seg.screenshots ?? []} onChange={(list) => setField(`segments.${index}.screenshots`, list)} />
      </div>
    </details>
  );
}

/**
 * Renders the structured editing grid for a draft record. The parent owns
 * `draft` and the setField(path, value) deep-path setter; this component is
 * purely presentational so staff and member flows behave identically.
 * Episodes separate broadcast-level fields from per-segment story fields.
 */
export default function RecordEditor({ entityType, draft, setField }) {
  if (!draft) return null;
  const langs = languageOptions();

  if (entityType === 'episode') {
    const segments = draft.segments ?? [];
    return (
      <div className="contribution-form__grid">
        <h3 className="section-heading span-2">Broadcast information <span className="muted small">(shared by every segment)</span></h3>
        <RecordField label="Episode name" placeholder="e.g. Episode 4" value={draft.title?.en} onChange={(v) => setField('title.en', v ?? '')}
          help="The broadcast's name. The stories themselves are named on their segments." />
        <RecordField label="Episode name (Japanese)" value={draft.title?.ja} onChange={(v) => setField('title.ja', v)} />
        <RecordField label="Broadcast date" placeholder="YYYY, YYYY-MM or YYYY-MM-DD" value={draft.release?.date} onChange={(v) => setField('release.date', v)} />
        <RecordField label="Date precision" value={draft.release?.precision} onChange={(v) => setField('release.precision', v)}
          options={[{ value: 'day', label: 'Exact day' }, { value: 'month', label: 'Month only' }, { value: 'year', label: 'Year only' }]}
          help="Used when the full date is not known." />
        <RecordField label="Original language" value={draft.originalLanguage} onChange={(v) => setField('originalLanguage', v)} options={langs} />
        <RecordField label="Region" placeholder="e.g. Japan" value={draft.release?.region} onChange={(v) => setField('release.region', v)} />
        <SourceRows sources={draft.sources ?? []} onChange={(list) => setField('sources', list)} />

        <h3 className="section-heading span-2">Segments <span className="muted small">({segments.length} — each holds one story)</span></h3>
        <div className="span-2 segment-list">
          {segments.map((seg, i) => (
            <SegmentEditor key={seg.id ?? i} draft={draft} index={i} total={segments.length} setField={setField} />
          ))}
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => {
              const added = { ...blankSegment(draft.id, segments.length + 1), id: `${draft.id}-${nextSegmentSuffix(segments)}` };
              setField('segments', [...segments, added].map((s, i) => ({ ...s, segmentNumber: i + 1 })));
            }}>
              <Icon name="plus" size={15} /> Add Segment
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (entityType === 'movie') {
    return (
      <div className="contribution-form__grid">
        <RecordField label="English title" value={draft.title?.en} onChange={(v) => setField('title.en', v ?? '')} optional={false} />
        <RecordField label="Japanese title" value={draft.title?.ja} onChange={(v) => setField('title.ja', v)} />
        <RecordField label="Release date" placeholder="YYYY, YYYY-MM or YYYY-MM-DD" value={draft.release?.date} onChange={(v) => setField('release.date', v)} />
        <RecordField label="Date precision" value={draft.release?.precision} onChange={(v) => setField('release.precision', v)}
          options={[{ value: 'day', label: 'Exact day' }, { value: 'month', label: 'Month only' }, { value: 'year', label: 'Year only' }]}
          help="Used when the full date is not known." />
        <RecordField label="Original language" value={draft.originalLanguage} onChange={(v) => setField('originalLanguage', v)} options={langs} />
        <RecordField label="Region" placeholder="e.g. Japan" value={draft.release?.region} onChange={(v) => setField('release.region', v)} />
        <RecordField label="Summary" multiline rows={4} value={draft.summary} onChange={(v) => setField('summary', v)} />
        <RecordField label="Runtime (minutes)" value={draft.durationMinutes} onChange={(v) => setField('durationMinutes', v ? Number(v) : null)} />
        <RecordField label="Director (English)" value={draft.director?.en} onChange={(v) => setField('director.en', v)} />
        <RecordField label="Director (Japanese)" value={draft.director?.ja} onChange={(v) => setField('director.ja', v)} />
        <RecordField label="Main image URL" value={draft.image?.url} onChange={(v) => setField('image.url', v)} />
        <RecordField label="Image alt text" value={draft.image?.alt} onChange={(v) => setField('image.alt', v)} />
        <IdListField label="Characters in this entry" ids={draft.characters ?? []} onChange={(list) => setField('characters', list)} kind="character" />
        <IdListField label="Gadgets in this entry" ids={draft.gadgets ?? []} onChange={(list) => setField('gadgets', list)} kind="gadget" />
        <VoiceActorRows value={draft.voiceActors ?? []} onChange={(list) => setField('voiceActors', list)} withCharacter />
        <ScreenshotRows value={draft.screenshots ?? []} onChange={(list) => setField('screenshots', list)} />
        <SourceRows sources={draft.sources ?? []} onChange={(list) => setField('sources', list)} />
      </div>
    );
  }

  // characters and gadgets
  return (
    <div className="contribution-form__grid">
      <RecordField label="English name" value={draft.name?.en} onChange={(v) => setField('name.en', v ?? '')} optional={false} />
      <RecordField label="Japanese name" value={draft.name?.ja} onChange={(v) => setField('name.ja', v)} />
      <RecordField label="Aliases" placeholder="Comma-separated" value={(draft.aliases ?? []).join(', ')} onChange={(v) => setField('aliases', v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [])} />
      {entityType === 'character'
        ? <RecordField label="Category" value={draft.category} onChange={(v) => setField('category', v)} options={categoryOptions()} />
        : <RecordField label="How it works" multiline value={draft.howItWorks} onChange={(v) => setField('howItWorks', v)} />}
      <RecordField label="Description" multiline rows={5} value={draft.description} onChange={(v) => setField('description', v)} optional={false} />
      <RecordField label="Image URL" value={draft.image?.url} onChange={(v) => setField('image.url', v)} />
      <RecordField label="Image alt text" value={draft.image?.alt} onChange={(v) => setField('image.alt', v)} />
      <RecordField label="First appearance" placeholder="Entry id (anime-1979-0004) or a short note"
        value={draft.firstAppearance?.note ?? draft.firstAppearance?.entryId}
        onChange={(v) => setField('firstAppearance', {
          entryId: v && /^(anime-(1979|2005|1973)-\d{4}|movie-\d{4})$/.test(v) ? v : null,
          note: v && !/^(anime-(1979|2005|1973)-\d{4}|movie-\d{4})$/.test(v) ? v : null,
        })} />
      {entityType === 'character'
        ? <VoiceActorRows value={draft.voiceActors ?? []} onChange={(list) => setField('voiceActors', list)} />
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record lookup + blank record builders (used by staff editor and dialogs)
// ---------------------------------------------------------------------------

export function findEntity(entityType, entityId) {
  // The editor MUST edit the raw record file, not the merged catalogue entry:
  // the server compares the submitted baseRecord against the file on GitHub,
  // and any derived field (path, kind, forced arrays, normalized sources)
  // would make every edit fail with "changed since it was loaded".
  if (entityType === 'character') return getCharacters().find((c) => c.id === entityId) ?? null;
  if (entityType === 'gadget') return getGadgets().find((g) => g.id === entityId) ?? null;
  return getRawEntry(entityId);
}

export function buildNewRecord(entityType, entityId) {
  if (entityType === 'character') {
    return { id: entityId, name: { en: '', ja: null }, aliases: [], description: null, category: 'main',
      image: { url: null, alt: null }, voiceActors: [], firstAppearance: { entryId: null, note: null } };
  }
  if (entityType === 'gadget') {
    return { id: entityId, name: { en: '', ja: null }, aliases: [], description: null,
      image: { url: null, alt: null }, firstAppearance: { entryId: null, note: null }, howItWorks: null };
  }
  const isMovie = entityType === 'movie';
  const number = isMovie ? Number(entityId.replace(/^movie-/, '')) : Number(entityId.split('-').pop());
  const seriesId = isMovie ? 'movies' : entityId.split('-').slice(0, 2).join('-');
  if (isMovie) {
    return {
      schemaVersion: 3, id: entityId, type: 'movie', seriesId, number,
      title: { en: '', ja: null }, alternateTitles: [], originalLanguage: 'ja',
      release: { date: null, precision: null, region: null }, summary: null,
      image: { url: null, alt: null }, screenshots: [], characters: [], gadgets: [], voiceActors: [],
      sources: [], durationMinutes: null, director: { en: null, ja: null },
    };
  }
  // Schema 4: a new episode starts as a broadcast with exactly one segment.
  // `title` is the broadcast name ("Episode N"); segment titles name stories.
  return {
    schemaVersion: 4, id: entityId, type: 'episode', seriesId, number,
    title: { en: `Episode ${number}`, ja: null },
    originalLanguage: 'ja',
    release: { date: null, precision: null, region: null },
    sources: [],
    segments: [blankSegment(entityId, 1)],
  };
}
