#!/bin/bash
# Makes the staff editor edit the RAW record file instead of the merged
# catalogue entry — fixes the 422 "changed since it was loaded" on every edit.
# Run from the repo root. No function redeploy needed (frontend only).
set -e
test -f src/pages/Staff.jsx || { echo "ERROR: run this from the repo root (no src/ directory here)."; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 required"; exit 1; }
python3 - <<'PYEOF'
import pathlib, sys

def patch(path, old, new):
    p = pathlib.Path(path)
    text = p.read_text()
    if old not in text:
        if new in text:
            print(f"{path}: already patched, skipped")
            return
        sys.exit(f"ERROR: anchor not found in {path} — repo differs from what this script expects; NOTHING was written")
    if text.count(old) != 1:
        sys.exit(f"ERROR: anchor is ambiguous in {path}; NOTHING was written")
    p.write_text(text.replace(old, new, 1))
    print(f"{path}: patched")

# ---- catalog.js: keep raw record files available to the editor
patch('src/lib/catalog.js',
"""  series: new Map(),
  characters: [],""",
"""  series: new Map(),
  rawEntries: new Map(),
  characters: [],""")

patch('src/lib/catalog.js',
"""  state.entries = [];""",
"""  // Raw record files, exactly as stored in the repository. The staff editor
  // commits against THESE — the merged entry carries derived fields (path,
  // kind, forced arrays, normalized sources) that never exist in the file,
  // so using it as an edit base fails the server's concurrency check.
  state.rawEntries = new Map(Object.values(recordsBySeries).flatMap((recs) => Object.entries(recs)));

  state.entries = [];""")

patch('src/lib/catalog.js',
"""export async function loadRecord(entryOrId) {
  const entry = typeof entryOrId === 'string' ? getEntry(entryOrId) : entryOrId;
  return entry ?? null;
}""",
"""export async function loadRecord(entryOrId) {
  const entry = typeof entryOrId === 'string' ? getEntry(entryOrId) : entryOrId;
  return entry ?? null;
}

/**
 * The RAW record file behind an entry id, exactly as stored in the repository
 * (no roster merge, no derived fields). This is what editing and committing
 * must round-trip through. Null when the id is unknown or its file failed to
 * load.
 */
export const getRawEntry = (id) => state.rawEntries.get(id) ?? null;""")

# ---- Staff.jsx: edit raw records, drop the incomplete strip hack
patch('src/pages/Staff.jsx',
"import { getEntry, getCharacter, getCharacters, getGadget, getGadgets, getSeries, getAllEntries } from '@/lib/catalog.js';",
"import { getEntry, getRawEntry, getCharacter, getCharacters, getGadget, getGadgets, getSeries, getAllEntries } from '@/lib/catalog.js';")

patch('src/pages/Staff.jsx',
"""function findEntity(entityType, entityId) {
  if (entityType === 'character') return getCharacters().find((c) => c.id === entityId) ?? null;
  if (entityType === 'gadget') return getGadgets().find((g) => g.id === entityId) ?? null;
  return getEntry(entityId);
}""",
"""function findEntity(entityType, entityId) {
  // The editor MUST edit the raw record file, not the merged catalogue entry:
  // the server compares the submitted baseRecord against the file on GitHub,
  // and any derived field (path, kind, forced arrays, normalized sources)
  // would make every edit fail with "changed since it was loaded".
  if (entityType === 'character') return getCharacters().find((c) => c.id === entityId) ?? null;
  if (entityType === 'gadget') return getGadgets().find((g) => g.id === entityId) ?? null;
  return getRawEntry(entityId);
}""")

patch('src/pages/Staff.jsx',
"""    const existing = findEntity(type, id);
    if (existing) {
      const raw = JSON.parse(JSON.stringify(existing));
      // The merged entry carries derived fields; strip them so the committed
      // record matches the file schema.
      delete raw.url; delete raw.availability; delete raw.status;
      if (raw.sources) raw.sources = raw.sources.map((s) => ({
        type: s.type, data: s.data, label: s.label ?? null, language: s.language ?? null,
        subtitles: s.subtitles ?? 'none', quality: s.quality ?? null, notes: s.notes ?? null,
      }));
      setBase(JSON.parse(JSON.stringify(raw))); setDraft(raw); setRawJson(JSON.stringify(raw, null, 2));
    } else {""",
"""    const existing = findEntity(type, id);
    if (existing) {
      // Raw record file content — no derived fields to strip, so the committed
      // JSON matches the file schema and the server's baseRecord check passes.
      const raw = JSON.parse(JSON.stringify(existing));
      setBase(JSON.parse(JSON.stringify(raw))); setDraft(raw); setRawJson(JSON.stringify(raw, null, 2));
    } else {""")

print("ALL PATCHES APPLIED")
PYEOF
echo
echo "Now run:"
echo "  git add -A && git commit -m \"Editor: edit raw record files, not merged entries\" && git push"
echo "  Then wait ~1-2 min for the Pages build and hard-refresh the site (Ctrl+Shift+R)."
