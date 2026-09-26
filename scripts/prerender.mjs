// prerender.mjs : ship the page content inside #root so crawlers, AI agents and
// anyone with JavaScript off still read the site.
//
// WHY
// Babel-in-the-browser means the live HTML was an empty <div id="root">. Google
// rendered it, so ranking was fine, but every other consumer of the page saw a
// shell. This runs the real components through react-dom/server at build time
// and writes the resulting HTML back into the page, next to the same scripts.
// With JS on, React hydrates over the markup. With JS off, the markup is the
// page. Nothing about the visual result changes.
//
// HOW
//   1. esbuild bundles the JSX modules into one CommonJS file, with React and
//      react-dom/server loaded from CDN CJS builds so there is no React in
//      node_modules. esbuild itself is the only local dependency.
//   2. The bundle is evaluated in a VM with a window/document shim, which runs
//      the components and calls renderToString on the page root.
//   3. The HTML is injected into the <div id="root"> of each target page, and
//      the pre-render bundle is NOT shipped (it is only a build tool).
//
// No em dashes. Node 18+.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const CACHE = join(here, '.prerender-cache');
mkdirSync(CACHE, { recursive: true });

const REACT_VER = '18.3.1';
const CDN = `https://cdnjs.cloudflare.com/ajax/libs`;

// React and react-dom as CommonJS, fetched once and cached on disk. The cdnjs
// UMD paths the site loads in the browser are not requireable, so the CJS twins
// are used instead: same version, same behaviour, build-time only.
// The cache files keep a .cjs extension on purpose. package.json declares
// "type": "module", so a cached CommonJS file named .js is loaded as ESM and
// throws "exports is not defined". Node resolves the extension, not the content.
async function fetchOnce(name, url, dest) {
  if (existsSync(dest)) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const body = await res.text();
  writeFileSync(dest, body, 'utf8');
  return dest;
}

async function downloadDeps() {
  const react = await fetchOnce(
    'react',
    `${CDN}/react/${REACT_VER}/cjs/react.production.min.js`,
    join(CACHE, 'react.cjs')
  );
  const reactDom = await fetchOnce(
    'react-dom',
    `${CDN}/react-dom/${REACT_VER}/cjs/react-dom.production.min.js`,
    join(CACHE, 'react-dom.cjs')
  );
  // The server renderer is not on cdnjs as a UMD build for 18. The browser
  // build only ships renderToReadableStream, so the LEGACY server build is the
  // one that still has the synchronous renderToString this script needs. It is
  // a build-time dependency only and never ships.
  const server = await fetchOnce(
    'react-dom-server',
    `https://unpkg.com/react-dom@${REACT_VER}/cjs/react-dom-server-legacy.node.production.min.js`,
    join(CACHE, 'react-dom-server.cjs')
  );
  return { react, reactDom, server };
}

// The page shells. page.jsx references every page component in one if/else
// chain, so the shared module list has to carry all of them even when only one
// renders. Loading the ones a page does not use costs nothing at runtime
// because the prerender bundle is never shipped.
const SHARED = ['Sys.jsx', 'Nav.jsx', 'Footer.jsx', 'Palette.jsx', 'Rail.jsx'];
const ALL_PAGES = [
  'JourneyPage.jsx', 'ToolkitPage.jsx', 'FieldNotesPage.jsx', 'NowPage.jsx',
  'PillarsPage.jsx', 'WritingPage.jsx', 'PostPage.jsx', 'CompanyPage.jsx',
];

const PAGES = [
  { html: 'index.html', kind: 'app', modules: ['Sys.jsx', 'Nav.jsx', 'Home.jsx', 'Footer.jsx', 'Palette.jsx', 'app.jsx'] },
  { html: 'pillars.html', kind: 'page', id: 'pillars', modules: [...SHARED, ...ALL_PAGES, 'page.jsx'] },
  { html: 'now.html', kind: 'page', id: 'now', modules: [...SHARED, ...ALL_PAGES, 'page.jsx'] },
  { html: 'journey.html', kind: 'page', id: 'journey', modules: [...SHARED, ...ALL_PAGES, 'page.jsx'] },
  { html: 'toolkit.html', kind: 'page', id: 'toolkit', modules: [...SHARED, ...ALL_PAGES, 'page.jsx'] },
  { html: 'writing.html', kind: 'page', id: 'writing', modules: [...SHARED, ...ALL_PAGES, 'page.jsx'] },
  { html: 'post.html', kind: 'page', id: 'post', modules: [...SHARED, ...ALL_PAGES, 'page.jsx'] },
  { html: 'company.html', kind: 'page', id: 'company', modules: [...SHARED, ...ALL_PAGES, 'page.jsx'] },
  { html: 'field-notes.html', kind: 'page', id: 'field-notes', modules: [...SHARED, ...ALL_PAGES, 'page.jsx'] },
];

const ESBUILD = process.env.ESBUILD_BIN || 'esbuild';

function bundle(modules, outfile) {
  // esbuild needs a stdin entry point to treat several files as one bundle.
  // The entry file just re-exports each module in load order, so the last one
  // (app.jsx or page.jsx) is the one that mounts, exactly as in the browser.
  const entry = join(CACHE, 'entry.jsx');
  writeFileSync(entry, modules.map((m) => `import ${JSON.stringify(join(root, m))};`).join('\n') + '\n', 'utf8');
  execFileSync(ESBUILD, [
    entry,
    '--bundle',
    '--format=cjs',
    '--platform=neutral',
    '--jsx=transform',
    '--jsx-factory=React.createElement',
    '--jsx-fragment=React.Fragment',
    '--define:process.env.NODE_ENV="production"',
    '--loader:.jsx=jsx',
    `--outfile=${outfile}`,
  ], { stdio: 'pipe' });
}

async function main() {
  const deps = await downloadDeps();
  const require_ = createRequire(import.meta.url);
  const React = require_(deps.react);
  // react-dom-server does `require("react")` internally. There is no react in
  // node_modules by design, so a one-file node_modules shim is written next to
  // the cache and points at the same CDN build. Build-time only, gitignored via
  // the cache directory, never uploaded as an asset.
  const nm = join(CACHE, 'node_modules', 'react');
  mkdirSync(nm, { recursive: true });
  writeFileSync(join(nm, 'package.json'), JSON.stringify({ name: 'react', version: REACT_VER, main: 'index.cjs' }), 'utf8');
  writeFileSync(join(nm, 'index.cjs'), `module.exports = require(${JSON.stringify(deps.react)});\n`, 'utf8');
  const ReactDOMServer = require_(deps.server);

  let ok = 0;
  const failed = [];

  for (const page of PAGES) {
    const htmlPath = join(root, page.html);
    if (!existsSync(htmlPath)) { failed.push([page.html, 'missing']); continue; }
    const bundlePath = join(CACHE, `${page.html.replace(/\W+/g, '_')}.cjs`);
    try {
      bundle(page.modules, bundlePath);
    } catch (err) {
      failed.push([page.html, `bundle: ${String(err.stderr || err.message).split('\n').slice(0, 3).join(' ')}`]);
      continue;
    }

    let html;
    try {
      html = readFileSync(htmlPath, 'utf8');
      const dataSrc = readFileSync(join(root, 'data.js'), 'utf8');

      // A sandbox with the same globals the browser provides. The components
      // only touch window, document.getElementById, location and history.
      const listeners = {};
      const sandbox = {
        React,
        // app.jsx and page.jsx reference ReactDOM.createRoot. The mount call is
        // stripped below, but the identifier still has to resolve or the module
        // body throws before the strip is reached.
        ReactDOM: { createRoot: () => ({ render() {} }) },
        console,
        setTimeout, clearTimeout, setInterval, clearInterval,
        Intl, Date, Math, JSON, URL, URLSearchParams,
        navigator: { userAgent: 'prerender' },
        location: {
          href: `https://deependhq.com/${page.html}`,
          pathname: `/${page.id || ''}`,
          search: '', hash: '', origin: 'https://deependhq.com',
        },
        history: { replaceState() {}, pushState() {} },
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
        removeEventListener() {},
        document: {
          getElementById: (id) => (id === 'root' ? { getAttribute: () => page.id, dataset: { page: page.id }, setAttribute() {} } : null),
          querySelector: () => null,
          querySelectorAll: () => [],
          addEventListener() {},
          documentElement: { getAttribute: () => null, setAttribute() {} },
          body: { appendChild() {}, classList: { add() {}, remove() {} } },
          createElement: () => ({ setAttribute() {}, style: {}, appendChild() {}, classList: { add() {} }, addEventListener() {} }),
        },
        fetch: async () => { throw new Error('prerender: no network'); },
      };
      sandbox.window = sandbox;
      sandbox.globalThis = sandbox;
      sandbox.self = sandbox;
      vm.createContext(sandbox);

      // data.js assigns window.DH_DATA
      vm.runInContext(dataSrc, sandbox, { filename: 'data.js' });
      // The bundle attaches components to window and, for app.jsx, mounts.
      // We do not want the mount: renderToString does the work.
      const patched = readFileSync(bundlePath, 'utf8').replace(
        /ReactDOM\.createRoot\([^)]*\)\.render\([^;]*\);?/g,
        '/* mount suppressed for prerender */'
      );
      vm.runInContext(patched, sandbox, { filename: `${page.html}.bundle` });

      const markup = renderPage(sandbox, page, ReactDOMServer, React);
      if (!markup || markup.length < 200) {
        failed.push([page.html, `render produced ${markup ? markup.length : 0} bytes`]);
        continue;
      }
      const injected = inject(html, markup);
      writeFileSync(htmlPath, injected, 'utf8');
      ok++;
      console.log(`prerender ${page.html}: ${markup.length} bytes into #root`);
    } catch (err) {
      failed.push([page.html, `render: ${err.message}`]);
    }
  }

  console.log(`\nprerender: ${ok}/${PAGES.length} pages carry content without JavaScript.`);
  for (const [page, why] of failed) console.log(`  FAILED ${page}: ${why}`);
  if (failed.length) process.exitCode = 1;
}

// The shells mount differently: index.html uses App via app.jsx, every other
// page uses PageShell via page.jsx. Both were suppressed above, so we call the
// right component directly.
function renderPage(sandbox, page, ReactDOMServer, React) {
  if (page.kind === 'app') {
    if (typeof sandbox.App !== 'function') throw new Error('App not exported');
    return ReactDOMServer.renderToStaticMarkup(React.createElement(sandbox.App));
  }
  if (typeof sandbox.PageShell !== 'function') throw new Error('PageShell not exported');
  return ReactDOMServer.renderToStaticMarkup(React.createElement(sandbox.PageShell, { pageId: page.id }));
}

function inject(html, markup) {
  // Replace the empty <div id="root" ...></div> with the rendered markup inside
  // it. Idempotent: a second run replaces the previous markup rather than
  // nesting it, which is detected by the marker comment.
  const cleaned = html
    .replace(/<!--prerender:start-->[\s\S]*?<!--prerender:end-->/g, '')
    .replace(/(<div id="root"[^>]*>)([\s\S]*?)(<\/div>)/, (m, open, inner, close) => {
      // Only overwrite an empty or previously prerendered root.
      const isEmpty = inner.trim() === '';
      if (!isEmpty && !/<!--prerender:start-->/.test(inner)) return m;
      return `${open}<!--prerender:start-->${markup}<!--prerender:end-->${close}`;
    });
  return cleaned;
}

main().catch((err) => {
  console.error('prerender failed:', err.message);
  process.exitCode = 1;
});
