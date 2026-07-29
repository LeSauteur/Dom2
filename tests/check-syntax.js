'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');

function listJavaScript(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJavaScript(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = listJavaScript(appRoot).sort();
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    failures.push({
      file: path.relative(appRoot, file),
      output: `${result.stdout || ''}${result.stderr || ''}`.trim()
    });
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure.file}`);
    console.error(failure.output);
  }
  process.exitCode = 1;
} else {
  console.log(`PASS syntax-check: ${files.length} production JavaScript files`);
}
