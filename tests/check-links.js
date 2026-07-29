'use strict';

const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function exactCaseExists(absolutePath) {
  const relativePath = path.relative(appRoot, absolutePath);
  if (relativePath === '') return true;
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return false;

  let current = appRoot;
  for (const part of relativePath.split(path.sep)) {
    const exactEntry = fs.readdirSync(current, { withFileTypes: true })
      .find((entry) => entry.name === part);
    if (!exactEntry) return false;
    current = path.join(current, exactEntry.name);
  }
  return true;
}

function localTarget(rawValue) {
  const value = rawValue.trim();
  if (
    value === ''
    || value.startsWith('#')
    || value.startsWith('//')
    || /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return null;
  }

  if (value.startsWith('/')) {
    return { error: 'root-absolute URL is unsafe for a project Pages site' };
  }

  const pathOnly = value.split('#', 1)[0].split('?', 1)[0];
  if (pathOnly === '') return null;

  try {
    return { path: decodeURIComponent(pathOnly) };
  } catch {
    return { error: 'invalid percent encoding' };
  }
}

const htmlFiles = listFiles(appRoot)
  .filter((file) => file.endsWith('.html'))
  .sort();
const errors = [];
let checkedReferences = 0;

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const references = Array.from(
    html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi),
    (match) => match[1]
  );
  const refreshTargets = Array.from(
    html.matchAll(/<meta\b[^>]*http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*url=([^"']+)["'][^>]*>/gi),
    (match) => match[1]
  );

  for (const rawValue of [...references, ...refreshTargets]) {
    const target = localTarget(rawValue);
    if (!target) continue;

    const source = path.relative(appRoot, htmlFile).replaceAll('\\', '/');
    if (target.error) {
      errors.push(`${source}: ${rawValue} (${target.error})`);
      continue;
    }

    checkedReferences += 1;
    let resolved = path.resolve(path.dirname(htmlFile), target.path);
    if (target.path.endsWith('/')) {
      resolved = path.join(resolved, 'index.html');
    }

    if (!exactCaseExists(resolved)) {
      errors.push(`${source}: missing or case-mismatched ${rawValue}`);
    }
  }
}

const motivationEntry = fs.readFileSync(
  path.join(appRoot, 'motivation-calculator.html'),
  'utf8'
);
if (!/index\.html\?mode=motivation2026/.test(motivationEntry)) {
  errors.push('motivation-calculator.html: expected index.html?mode=motivation2026 target');
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`FAIL ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `PASS link-check: ${htmlFiles.length} HTML files, ${checkedReferences} local references`
  );
}
