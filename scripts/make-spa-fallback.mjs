// Builds the SPA routing fallback for GitHub Pages:
//   * dist/404.html — bounces /any/deep/path to /?/any/deep/path
//   * (index.html already carries the matching restore snippet)
// Also writes dist/200.html (the Surge equivalent) so one build serves both
// hosts. Run after `npm run build`.

import { readFile, writeFile } from 'node:fs/promises';

const INDEX = new URL('../dist/index.html', import.meta.url);

const html = await readFile(INDEX, 'utf8');

// 404.html: runs before anything renders; GitHub Pages serves it with a 404
// status for unknown paths, so we redirect to the app root carrying the path.
const redirect = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script>
      (function () {
        var base = document.baseURI.replace(/[^/]*$/, '');
        var root = new URL('/', base).pathname;
        var path = location.pathname.slice(root.length) + location.search + location.hash;
        location.replace(root + '?/' + path);
      })();
    </script>
  </head>
  <body></body>
</html>
`;

await writeFile(new URL('../dist/404.html', import.meta.url), redirect);
await writeFile(new URL('../dist/200.html', import.meta.url), html);
console.log('SPA fallbacks written: dist/404.html, dist/200.html');
