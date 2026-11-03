// GitHub integration via the REST API using a fine-grained personal access
// token (Contents: Read and write, restricted to this repository).
//
// Multi-file commits are ATOMIC: the Git Data API builds one tree + one
// commit and moves the branch ref once. index.json and the entry file can
// therefore never drift apart mid-accept. Concurrent pushes are detected via
// the expected-SHA check on the ref update and retried with a fresh base.

const API = 'https://api.github.com';

function headers(env) {
  return {
    // Reads on a public repository work unauthenticated; only ever send a
    // token when one is configured — "Bearer undefined" reads as bad
    // credentials and turns every read into a misleading 401.
    ...(env.token ? { Authorization: `Bearer ${env.token}` } : {}),
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function api(env, path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: headers(env) });
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()).slice(0, 300); } catch { /* ignore */ }
    const err = new Error(`GitHub ${res.status} on ${path}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/** Reads and parses a JSON file at the branch head. Returns { content, sha, missing }. */
export async function getJsonFile(env, path) {
  try {
    const res = await fetch(`${API}/repos/${env.repo}/contents/${path}?ref=${env.ref}`, {
      headers: { ...headers(env), Accept: 'application/vnd.github.raw+json' },
    });
    if (res.status === 404) return { content: null, sha: null, missing: true };
    if (!res.ok) throw new Error(`GitHub ${res.status} reading ${path}`);
    const text = await res.text();
    return { content: JSON.parse(text), sha: null, missing: false };
  } catch (err) {
    if (err.status === 404) return { content: null, sha: null, missing: true };
    throw err;
  }
}

/**
 * Commits several files in one atomic commit (Git Data API).
 * files: [{ path, content }] — content is the full new file text.
 * Returns the new commit sha.
 */
export async function commitFiles(env, files, message, { retries = 3 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const head = await api(env, `/repos/${env.repo}/git/ref/heads/${env.ref}`);
      const baseSha = head.object.sha;

      const tree = [];
      for (const file of files) {
        // A deletion is expressed as a tree entry with a null sha.
        if (file.delete) {
          tree.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
          continue;
        }
        const blob = await api(env, `/repos/${env.repo}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
        });
        tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
      }

      const newTree = await api(env, `/repos/${env.repo}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({ base_tree: baseSha, tree }),
      });

      const commit = await api(env, `/repos/${env.repo}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] }),
      });

      // Moving the ref with an expected SHA fails the whole commit if someone
      // else pushed first — never silently overwrites a newer edit.
      await api(env, `/repos/${env.repo}/git/refs/heads/${env.ref}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      return commit.sha;
    } catch (err) {
      const retryable = err.status === 422 || err.status === 409 || err.status >= 500 || err.status === undefined;
      if (attempt === retries || !retryable) throw err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}
