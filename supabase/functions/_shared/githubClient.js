// Builds the GitHub helper injected into handlers. Reads the GITHUB_TOKEN /
// GITHUB_REPO / GITHUB_REF function secrets — these never leave the server.

import { getJsonFile, commitFiles } from './github.js';

export function makeGithub(env) {
  const conf = {
    token: env.get?.('GITHUB_TOKEN') ?? env.GITHUB_TOKEN,
    repo: env.get?.('GITHUB_REPO') ?? env.GITHUB_REPO,
    ref: (env.get?.('GITHUB_REF') ?? env.GITHUB_REF) || 'main',
  };
  return {
    get token() { return conf.token; },
    get repo() { return conf.repo; },
    get ref() { return conf.ref; },
    getJsonFile: (path) => getJsonFile(conf, path),
    commit: (files, message) => commitFiles(conf, files, message),
  };
}
