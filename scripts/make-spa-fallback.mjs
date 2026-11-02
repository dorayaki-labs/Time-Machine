// Builds the SPA routing fallback for GitHub Pages:
//   * dist/404.html — bounces /<base>/any/deep/path to /<base>/?/any/deep/path
//     (index.html carries the matching restore snippet)
//   * dist/200.html — the Surge equivalent, so one build serves both hosts
// Run after `npm run build`.

import { readFile, writeFile } from 'node:fs/promises';

const INDEX = new URL('../dist/index.html', import.meta.url);

const html = await readFile(INDEX, 'utf8');

// The site base path: env override if present, otherwise read it off the
// built asset URLs (vite bakes the base into "/<base>/assets/…"). Deriving
// it from the build keeps this script correct even when it runs as a
// separate CI step that does not inherit VITE_BASE_PATH.
const env = process.env.VITE_BASE_PATH;
const fromBuild = html.match(/(?:src|href)="\/([^"]+?)\/assets\//);
let base = env || (fromBuild ? `/${fromBuild[1]}/` : '/');
if (!base.endsWith('/')) base += '/';
console.log(`SPA fallback base path: ${base}`);

// 404.html: runs before anything renders; GitHub Pages serves it with a 404
// status for unknown paths, so we redirect to the site root carrying the path.
const redirect = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script>
      (function () {
        var base = ${JSON.stringify(base)};
        var path = location.pathname.slice(base.length) + location.search + location.hash;
        location.replace(base + '?/' + path);
      })();
    </script>
  </head>
  <body></body>
</html>
`;

await writeFile(new URL('../dist/404.html', import.meta.url), redirect);
await writeFile(new URL('../dist/200.html', import.meta.url), html);
console.log('SPA fallbacks written: dist/404.html, dist/200.html');
