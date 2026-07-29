const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const appRoot = path.join(root, 'pub', 'domian-calculator-a4');

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = listFiles(appRoot).map((file) => path.relative(appRoot, file).replace(/\\/g, '/')).sort();
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const jsFiles = files.filter((file) => file.endsWith('.js'));
const cssFiles = files.filter((file) => file.endsWith('.css'));
const testFiles = files.filter((file) => (file.startsWith('tests/') || file.includes('/tests/')) && file.endsWith('.js'));

const indexHtml = read('index.html');
const tableHtml = read('table.html');
const tableLedgerHtml = read('table-ledger.html');
const simpleHtml = read('simple.html');
const extendedHtml = read('extended.html');

const inventory = {
  htmlFiles,
  jsFiles,
  cssFiles,
  testFiles,
  activeRuntime: {
    mainA4: {
      html: 'index.html',
      scripts: Array.from(indexHtml.matchAll(/<script src="([^"]+)"/g)).map((match) => match[1]),
      styles: Array.from(indexHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)).map((match) => match[1])
    },
    tableAlias: {
      html: 'table.html',
      redirect: /url=table-ledger\.html/.test(tableHtml),
      canonical: /href="table-ledger\.html"/.test(tableHtml)
    },
    tableLedger: {
      html: 'table-ledger.html',
      scripts: Array.from(tableLedgerHtml.matchAll(/<script src="([^"]+)"/g)).map((match) => match[1]),
      styles: Array.from(tableLedgerHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)).map((match) => match[1])
    },
    simple: {
      html: 'simple.html',
      hasScript: /<script\b/i.test(simpleHtml),
      scaffoldNotice: /поля не выполняют расч[её]т/i.test(simpleHtml)
    },
    extended: {
      html: 'extended.html',
      scripts: Array.from(extendedHtml.matchAll(/<script src="([^"]+)"/g)).map((match) => match[1])
    }
  }
};

assert.ok(inventory.activeRuntime.tableAlias.redirect, 'table.html must redirect to table-ledger.html');
assert.ok(inventory.activeRuntime.tableLedger.scripts.some((script) => script.includes('table-ledger.js')), 'active ledger must load table-ledger.js');
assert.ok(!inventory.activeRuntime.tableLedger.scripts.some((script) => script.includes('table-mode.js')), 'active ledger must not load table-mode.js');
assert.ok(inventory.activeRuntime.simple.hasScript === false, 'simple.html currently has no calculation script');
assert.ok(inventory.activeRuntime.simple.scaffoldNotice === true, 'simple.html declares itself a scaffold');

console.log(JSON.stringify(inventory, null, 2));
