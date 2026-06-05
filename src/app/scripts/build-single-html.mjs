import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(appRoot, '..', '..');
const distRoot = path.join(appRoot, 'dist');
const outputDir = path.join(projectRoot, 'output');
const outputFile = path.join(outputDir, 'markdown-review-workbench.html');

function assetPathFromUrl(url) {
  const clean = url.replace(/^\.\//, '').replace(/^\//, '');
  return path.join(distRoot, clean);
}

function inlineStyles(html) {
  return html.replace(
    /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
    (_match, href) => `__INLINE_STYLE__${href}__END_INLINE_STYLE__`,
  );
}

function inlineScripts(html) {
  return html.replace(
    /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
    (_match, src) => `__INLINE_SCRIPT__${src}__END_INLINE_SCRIPT__`,
  );
}

function insertBeforeClosingHead(html, contents) {
  const index = html.lastIndexOf('</head>');
  if (index === -1) return `${contents}\n${html}`;
  return `${html.slice(0, index)}${contents}\n${html.slice(index)}`;
}

async function hydrateInlinePlaceholders(html) {
  let next = html;

  for (const match of html.matchAll(/__INLINE_STYLE__(.*?)__END_INLINE_STYLE__/g)) {
    const css = await readFile(assetPathFromUrl(match[1]), 'utf8');
    next = next.replace(match[0], () => `<style>\n${css}\n</style>`);
  }

  for (const match of html.matchAll(/__INLINE_SCRIPT__(.*?)__END_INLINE_SCRIPT__/g)) {
    const js = await readFile(assetPathFromUrl(match[1]), 'utf8');
    const safeJs = js.replace(/<\/script/gi, '<\\/script');
    next = next.replace(match[0], () => `<script type="module">\n${safeJs}\n</script>`);
  }

  return next;
}

async function main() {
  const indexPath = path.join(distRoot, 'index.html');
  let html = await readFile(indexPath, 'utf8');

  html = inlineStyles(html);
  html = inlineScripts(html);
  html = await hydrateInlinePlaceholders(html);
  html = insertBeforeClosingHead(
    html,
    '  <meta name="application-name" content="Markdown 文档审阅标注工作台" />\n  <meta name="codex-build" content="single-file-html" />',
  );

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, html, 'utf8');
  console.log(`[OK] single HTML written: ${outputFile}`);
}

main().catch((error) => {
  console.error('[ERROR] failed to build single HTML');
  console.error(error);
  process.exit(1);
});
