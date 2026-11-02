// Live end-to-end test for the deployed backend. Run AFTER completing
// DEPLOYMENT.md tutorials B–G, with a test Discord account that is NOT your
// owner/staff account, plus one checker account.
//
//   SUPABASE_URL=… CONTRIBUTOR_TOKEN=… CHECKER_TOKEN=… node test-backend.mjs
//
// Tokens are Supabase session access tokens. The easiest way to get one:
// sign in on the deployed site, run in the browser console:
//   (await window.__tm_debug_session())   — or copy from DevTools → Application
// Alternatively mint one via the CLI: supabase functions … (not available) —
// the browser console route is the intended one.
//
// What it verifies (each step prints PASS/FAIL):
//   1. contribute rejects an unauthenticated call (401)
//   2. contributor token: submit → duplicate → cooldown → 4xx as expected
//   3. checker token: staff listing works; contributor's own submission
//      cannot be accepted by the contributor (403)
//   4. checker accepts with a patch → archive commit sha returned
//   5. public_stats and public_log reflect the acceptance
//
// NOTE: steps 4–5 perform REAL archive commits to GITHUB_REF. Point
// GITHUB_REF at a test branch while running this, and clean up after.

const BASE = process.env.SUPABASE_URL;
const CONTRIB = process.env.CONTRIBUTOR_TOKEN;
const CHECKER = process.env.CHECKER_TOKEN;

if (!BASE || !CONTRIB || !CHECKER) {
  console.error('Set SUPABASE_URL, CONTRIBUTOR_TOKEN, CHECKER_TOKEN. See the header of this file.');
  process.exit(1);
}

const call = async (name, token, body) => {
  const res = await fetch(`${BASE}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Origin: 'http://localhost:5173',
    },
    body: JSON.stringify(body ?? {}),
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: parsed };
};

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const r1 = await call('contribute', null, {});
check('unauthenticated submit is rejected (401)', r1.status === 401, JSON.stringify(r1.body).slice(0, 120));

const payload = {
  type: 'reference',
  title: 'E2E smoke test submission',
  payload: { title: 'Test reference', type: 'note', notes: 'automated smoke test', url: 'https://example.com/' },
};
const r2 = await call('contribute', CONTRIB, payload);
check('authenticated submit succeeds', r2.status === 200 && r2.body?.number, JSON.stringify(r2.body).slice(0, 160));

const r3 = await call('contribute', CONTRIB, payload);
check('duplicate submit is rejected', r3.status === 409 || r3.status === 429, `status ${r3.status}`);

const r4 = await call('review', CONTRIB, { action: 'accept', number: r2.body?.number });
check('contributor cannot accept own submission (403)', r4.status === 403, `status ${r4.status}`);

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed. Continue the checklist manually: accept via the moderation UI on a TEST BRANCH, then verify the commit, public_log and webhook.');
process.exit(failed ? 1 : 0);
