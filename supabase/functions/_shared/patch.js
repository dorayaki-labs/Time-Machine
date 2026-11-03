// Archive patch application. A patch describes one complete, final record:
//
//   { entityType: 'episode'|'movie'|'character'|'gadget',
//     entityId:   'anime-1979-0004' | 'char-nobita' | …,
//     mode:       'update' | 'create',
//     record:     { …the complete new record… } }
//
// The server never trusts the client's paths: it derives every path from the
// entity type, series and number, fetches the CURRENT file from GitHub,
// validates the result against the archive schema, and computes the change
// list by diffing real before/after data.

import { deepDiff } from './diff.js';
import {
  SERIES, validateEntryRecord, validateEntityRecord, validateEntityFile,
} from './validate.js';

const pad = (n, width = 4) => String(n).padStart(width, '0');
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

export const ENTITY_TYPES = ['episode', 'movie', 'character', 'gadget'];

/** Where an entity lives inside the repository. All paths are REPO paths:
 *  Vite serves the public/ directory at the site root, so the archive's
 *  source of truth lives under public/ and the GitHub API must address it
 *  from the repository root. */
export function resolvePaths(entityType, entityId) {
  if (entityType === 'episode') {
    const seriesId = String(entityId ?? '').split('-').slice(0, 2).join('-');
    const series = SERIES[seriesId];
    if (!series || series.kind !== 'episode') return { error: `"${entityId}" is not an episode id.` };
    const number = Number(String(entityId).split('-').pop());
    return {
      seriesId,
      kind: 'episode',
      recordPath: `public/${series.dir}/episodes/${pad(number)}.json`,
      recordPathInIndex: `episodes/${pad(number)}.json`,
      indexPath: `public/${series.dir}/index.json`,
      entityId, number,
    };
  }
  if (entityType === 'movie') {
    const number = Number(String(entityId ?? '').replace(/^movie-/, ''));
    if (!Number.isInteger(number) || number < 1) return { error: `"${entityId}" is not a movie id.` };
    return {
      seriesId: 'movies',
      kind: 'movie',
      recordPath: `public/archive/movies/${pad(number)}.json`,
      recordPathInIndex: `${pad(number)}.json`,
      indexPath: 'public/archive/movies/index.json',
      entityId, number,
    };
  }
  if (entityType === 'character') {
    return { kind: 'character', arrayPath: 'public/data/characters.json', entityId };
  }
  if (entityType === 'gadget') {
    return { kind: 'gadget', arrayPath: 'public/data/gadgets.json', entityId };
  }
  return { error: `entityType must be one of ${ENTITY_TYPES.join(', ')}.` };
}

/**
 * Applies a patch to the current repository state.
 * Returns { files: [{path, content}], changes, entity, indexChanged, error }.
 */
export async function applyArchivePatch(github, patch) {
  if (!patch || typeof patch !== 'object') return { error: 'patch must be an object.' };
  const { entityType, mode } = patch;
  if (!ENTITY_TYPES.includes(entityType)) return { error: `entityType must be one of ${ENTITY_TYPES.join(', ')}.` };
  if (!['update', 'create'].includes(mode)) return { error: 'mode must be "update" or "create".' };

  const paths = resolvePaths(entityType, patch.entityId);
  if (paths.error) return { error: paths.error };
  const record = patch.record;

  // ---- entities stored as one record per file (episodes, movies) ----------
  if (paths.kind === 'episode' || paths.kind === 'movie') {
    const currentFile = await github.getJsonFile(paths.recordPath);
    if (mode === 'update' && currentFile.missing) {
      return { error: `${patch.entityId} does not exist in the archive — use "create" mode.` };
    }
    // Optimistic concurrency: when the caller states which version it based
    // the edit on, refuse to overwrite a record that changed since.
    if (mode === 'update' && patch.baseRecord !== undefined
        && deepDiff(patch.baseRecord, currentFile.content).length > 0) {
      return { error: `${patch.entityId} changed since it was loaded — reopen the editor with the latest version and reapply your changes.` };
    }
    if (mode === 'create' && !currentFile.missing) {
      return { error: `${patch.entityId} already exists — use "update" mode.` };
    }
    if (record?.id !== paths.entityId) {
      return { error: `record.id must be "${paths.entityId}".` };
    }
    if (record?.number !== paths.number) {
      return { error: `record.number must be ${paths.number}.` };
    }

    const validation = validateEntryRecord(record);
    if (!validation.ok) return { error: `The proposed record is not valid: ${validation.errors.join(' ')}` };

    const files = [{ path: paths.recordPath, content: serialize(record) }];
    let indexChanged = false;

    if (mode === 'create') {
      const indexFile = await github.getJsonFile(paths.indexPath);
      if (indexFile.missing) return { error: `Index file ${paths.indexPath} not found.` };
      const index = indexFile.content;
      if (index.entries.some((e) => e.id === paths.entityId)) {
        return { error: `${paths.entityId} is already listed in the index.` };
      }
      index.entries.push({ id: paths.entityId, number: paths.number, path: paths.recordPathInIndex });
      index.entries.sort((a, b) => a.number - b.number);
      files.push({ path: paths.indexPath, content: serialize(index) });
      indexChanged = true;
    }

    const changes = mode === 'update'
      ? deepDiff(currentFile.content, record)
      : [{ field: '(new entry)', before: null, after: `${record.id} — ${record.title?.en ?? record.title?.ja ?? ''}`.trim() }];
    if (mode === 'update' && changes.length === 0) {
      return { error: 'The proposed values are identical to the current record — nothing to change.' };
    }
    return { files, changes, indexChanged, entity: { type: entityType, id: paths.entityId, number: paths.number } };
  }

  // ---- entities stored inside an array file (characters, gadgets) ---------
  const arrayFile = await github.getJsonFile(paths.arrayPath);
  if (arrayFile.missing) return { error: `Data file ${paths.arrayPath} not found.` };
  const list = arrayFile.content;
  const index = list.findIndex((r) => r?.id === patch.entityId);
  if (mode === 'update' && index === -1) {
    return { error: `${patch.entityId} does not exist — use "create" mode.` };
  }
  if (mode === 'update' && patch.baseRecord !== undefined
      && deepDiff(patch.baseRecord, list[index]).length > 0) {
    return { error: `${patch.entityId} changed since it was loaded — reopen the editor with the latest version and reapply your changes.` };
  }
  if (mode === 'create' && index !== -1) {
    return { error: `${patch.entityId} already exists — use "update" mode.` };
  }
  if (record?.id !== patch.entityId) return { error: `record.id must be "${patch.entityId}".` };

  const validation = validateEntityRecord(record, entityType);
  if (!validation.ok) return { error: `The proposed record is not valid: ${validation.errors.join(' ')}` };

  const nextList = mode === 'update'
    ? list.map((r, i) => (i === index ? record : r))
    : [...list, record];
  const fileValidation = validateEntityFile(nextList, entityType);
  if (!fileValidation.ok) return { error: `The resulting file is not valid: ${fileValidation.errors.join(' ')}` };

  const before = mode === 'update' ? list[index] : null;
  const changes = mode === 'update'
    ? deepDiff(before, record)
    : [{ field: '(new record)', before: null, after: record.name?.en ?? record.name?.ja ?? record.id }];

  if (mode === 'update' && changes.length === 0) {
    return { error: 'The proposed values are identical to the current record — nothing to change.' };
  }
  return {
    files: [{ path: paths.arrayPath, content: serialize(nextList) }],
    changes, indexChanged: false,
    entity: { type: entityType, id: patch.entityId, number: null },
  };
}
