// Headless-logic test for the voice actor suggestion picker: verifies the
// character → options mapping used by VoiceActorSuggest (RecordEditor.jsx).
import { readFileSync } from 'node:fs';

const chars = JSON.parse(readFileSync('public/data/characters.json', 'utf8'));
const byId = new Map(chars.map((c) => [c.id, c]));

function characterVoiceActorOptions(characterId) {
  const character = characterId ? byId.get(characterId) : null;
  const seen = new Set();
  return (character?.voiceActors ?? [])
    .filter((va) => {
      const name = va?.name?.en ?? va?.name?.ja ?? null;
      if (!name) return false;
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((va) => ({ label: va.name.en ?? va.name.ja, ja: va.name.ja ?? null, version: va.version ?? null }));
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };

const shizuka = characterVoiceActorOptions('char-shizuka');
assert(shizuka.length === 4, `shizuka options = 4, got ${shizuka.length}`);
assert(shizuka[0].label === 'Masako Ebisu' && shizuka[0].ja === '星野 真沙子', 'first option shape');
assert(shizuka.every((o) => o.label), 'every option has a label');

const doraemon = characterVoiceActorOptions('char-doraemon');
assert(doraemon.length === 0, 'doraemon (no voiceActors) → no suggestions, got ' + doraemon.length);

const unknown = characterVoiceActorOptions('char-nobody');
assert(unknown.length === 0, 'unknown character → no suggestions');

const nullChar = characterVoiceActorOptions(null);
assert(nullChar.length === 0, 'no character picked → no suggestions');

console.log('VOICE ACTOR SUGGESTION CHECKS PASS');
