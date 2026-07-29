const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..', '..', '..');
const auditRoot = path.resolve(__dirname, '..');
const browserDir = path.join(auditRoot, 'browser');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.AUDIT_CHROME_PORT || 9223);
const baseUrl = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:8765';

fs.mkdirSync(browserDir, { recursive: true });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url, method) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: method || 'GET' }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function getJson(url) {
  return requestJson(url, 'GET');
}

async function waitForJson(url, timeoutMs) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      return await getJson(url);
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw lastError || new Error(`Timeout waiting for ${url}`);
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
      return;
    }
    const callbacks = listeners.get(message.method) || [];
    callbacks.forEach((callback) => callback(message.params || {}));
  });

  function send(method, params) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  function on(method, callback) {
    if (!listeners.has(method)) {
      listeners.set(method, []);
    }
    listeners.get(method).push(callback);
  }

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({ send, on, socket }));
    socket.addEventListener('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome not found at ${chromePath}`);
  }

  const profileDir = path.join(browserDir, 'chrome-profile');
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--remote-allow-origins=*',
    '--window-size=1365,900',
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const chromeOutput = [];
  chrome.stdout.on('data', (chunk) => chromeOutput.push(String(chunk)));
  chrome.stderr.on('data', (chunk) => chromeOutput.push(String(chunk)));

  const results = {
    startedAt: new Date().toISOString(),
    browser: 'Chrome headless via CDP',
    baseUrl,
    steps: [],
    console: [],
    screenshots: []
  };

  function record(step, data) {
    results.steps.push({ step, data });
  }

  let client;
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`, 10000);
    const target = await requestJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl + '/index.html')}`, 'PUT');
    client = await createCdpClient(target.webSocketDebuggerUrl);

    client.on('Runtime.consoleAPICalled', (params) => {
      results.console.push({
        type: params.type,
        args: (params.args || []).map((arg) => arg.value || arg.description || arg.type).join(' '),
        url: params.stackTrace && params.stackTrace.callFrames && params.stackTrace.callFrames[0] && params.stackTrace.callFrames[0].url
      });
    });
    client.on('Runtime.exceptionThrown', (params) => {
      results.console.push({ type: 'exception', text: params.exceptionDetails && params.exceptionDetails.text });
    });
    client.on('Log.entryAdded', (params) => {
      results.console.push({ type: params.entry.level, args: params.entry.text, url: params.entry.url });
    });

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');

    async function evaluate(expression, awaitPromise = false) {
      const response = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue: true
      });
      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.text || JSON.stringify(response.exceptionDetails));
      }
      return response.result ? response.result.value : undefined;
    }

    async function navigate(relativePath) {
      await client.send('Page.navigate', { url: baseUrl + relativePath });
      await delay(700);
    }

    async function screenshot(name) {
      const image = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        fromSurface: true
      });
      const outPath = path.join(browserDir, name);
      fs.writeFileSync(outPath, Buffer.from(image.data, 'base64'));
      results.screenshots.push(path.relative(root, outPath).replace(/\\/g, '/'));
    }

    await delay(700);
    record('a4-open', await evaluate(`({
      title: document.title,
      url: location.href,
      ready: Boolean(window.domianA4State),
      agentCards: document.querySelectorAll('.agent-card').length,
      dealInputs: document.querySelectorAll('[data-deal-index]').length
    })`));

    await evaluate(`(() => {
      function input(selector, value) {
        const node = document.querySelector(selector);
        if (!node) throw new Error('missing ' + selector);
        node.value = value;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }
      function click(selector) {
        const node = document.querySelector(selector);
        if (!node) throw new Error('missing ' + selector);
        node.click();
      }
      function check(selector, value) {
        const node = document.querySelector(selector);
        if (!node) throw new Error('missing ' + selector);
        node.checked = value;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }
      input('#selectedMonthInput', '2026-07');
      input('[data-deal-index="0"][data-agent-id]', '100000');
      click('[data-action="add-deal"][data-agent-id]');
      input('[data-deal-index="1"][data-agent-id]', '1');
      check('[data-deal-newbuild-solo="1"][data-agent-id]', true);
      click('[data-action="add-deal"][data-agent-id]');
      input('[data-deal-index="2"][data-agent-id]', '50000');
      click('.toolbar button[data-action="save-draft"]');
      return true;
    })()`, true);
    await delay(1000);

    record('a4-after-input-save', await evaluate(`(() => {
      const state = window.domianA4State;
      const appliedRates = Array.from(document.querySelectorAll('[data-agent-deal-rate]')).map((node) => node.textContent.trim());
      if (JSON.stringify(appliedRates) !== JSON.stringify(['45%', '50%', '55%'])) {
        throw new Error('CALC-001 A4 rates mismatch: ' + JSON.stringify(appliedRates));
      }
      return {
        selectedMonth: state.selectedMonth,
        dealsInput: state.agents[0].dealsInput,
        dealManualRates: state.agents[0].dealManualRates,
        dealNewbuildSoloFlags: state.agents[0].dealNewbuildSoloFlags,
        appliedRates,
        rateSources: Array.from(document.querySelectorAll('[data-agent-deal-source]')).map((node) => node.textContent.trim()),
        resultWithoutOwner: document.querySelector('#resultWithoutOwner').textContent.trim(),
        draftExists: Boolean(localStorage.getItem('domianA4DraftV2'))
      };
    })()`));
    await screenshot('a4-after-input-save.png');

    await client.send('Page.reload', { ignoreCache: true });
    await delay(800);
    record('a4-after-reload', await evaluate(`(() => {
      const state = window.domianA4State;
      const appliedRates = Array.from(document.querySelectorAll('[data-agent-deal-rate]')).map((node) => node.textContent.trim());
      if (JSON.stringify(appliedRates) !== JSON.stringify(['45%', '50%', '55%'])) {
        throw new Error('CALC-001 A4 reload rates mismatch: ' + JSON.stringify(appliedRates));
      }
      return {
        selectedMonth: state.selectedMonth,
        dealsInput: state.agents[0].dealsInput,
        dealManualRates: state.agents[0].dealManualRates,
        dealNewbuildSoloFlags: state.agents[0].dealNewbuildSoloFlags,
        appliedRates,
        saveStatus: document.querySelector('#draftSaveStatus').textContent.trim()
      };
    })()`));

    await evaluate(`document.querySelector('.toolbar button[data-action="open-table-mode"]').click(); true;`);
    await delay(500);
    record('a4-snapshot-after-open-table', await evaluate(`(() => {
      const raw = localStorage.getItem('domianA4TableSnapshot');
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        snapshotExists: Boolean(raw),
        snapshotVersion: parsed && parsed.version,
        savedMonth: parsed && parsed.state && parsed.state.selectedMonth,
        savedDeals: parsed && parsed.state && parsed.state.agents[0] && parsed.state.agents[0].dealsInput,
        savedManualRates: parsed && parsed.state && parsed.state.agents[0] && parsed.state.agents[0].dealManualRates,
        savedNewbuildFlags: parsed && parsed.state && parsed.state.agents[0] && parsed.state.agents[0].dealNewbuildSoloFlags
      };
    })()`));

    await navigate('/table.html');
    await delay(700);
    record('table-alias-redirect', await evaluate(`({
      url: location.href,
      title: document.title,
      isLedger: location.href.endsWith('/table-ledger.html')
    })`));
    record('ledger-before-load', await evaluate(`({
      notice: document.querySelector('#ledgerNotice').textContent.trim(),
      selectedMonth: document.querySelector('#ledgerSelectedMonth').textContent.trim(),
      dataSource: document.querySelector('#ledgerDataSource').textContent.trim(),
      rowCount: document.querySelectorAll('#ledgerBody tr').length
    })`));

    await evaluate(`document.querySelector('button[data-action="load-a4"]').click(); true;`);
    await delay(800);
    record('ledger-after-load-a4', await evaluate(`(() => {
      const dealRows = Array.from(document.querySelectorAll('#ledgerBody tr.deal-row')).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent.trim()).slice(0, 8));
      const ledgerRates = dealRows.map((row) => row[3]);
      if (JSON.stringify(ledgerRates) !== JSON.stringify(['45%', '50%', '55%'])) {
        throw new Error('CALC-001 ledger rates mismatch: ' + JSON.stringify(ledgerRates));
      }
      return {
        notice: document.querySelector('#ledgerNotice').textContent.trim(),
        selectedMonth: document.querySelector('#ledgerSelectedMonth').textContent.trim(),
        dataSource: document.querySelector('#ledgerDataSource').textContent.trim(),
        saveStatus: document.querySelector('#ledgerSaveStatus').textContent.trim(),
        dealRows,
        ledgerRates,
        foot: Array.from(document.querySelectorAll('#ledgerFoot td')).map((cell) => cell.textContent.trim()),
        ledgerDraft: JSON.parse(localStorage.getItem('domianA4LedgerDraftV1') || 'null')
      };
    })()`));
    await screenshot('ledger-after-load-a4.png');

    await navigate('/simple.html');
    record('simple-route', await evaluate(`({
      title: document.title,
      hasScript: Boolean(document.querySelector('script')),
      notice: document.querySelector('.notice') && document.querySelector('.notice').textContent.trim(),
      inputCount: document.querySelectorAll('input, select, button').length
    })`));

    await navigate('/extended.html');
    await evaluate(`(() => {
      function input(selector, value) {
        const node = document.querySelector(selector);
        if (!node) throw new Error('missing ' + selector);
        node.value = value;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }
      input('[data-quick-field="commission"]', '400000');
      input('[data-quick-field="expenses"]', '100000');
      input('[data-quick-field="dealCount"]', '4');
      input('[data-quick-field="agentCount"]', '1');
      document.querySelector('[data-action="save-draft"]').click();
      return true;
    })()`, true);
    await delay(500);
    record('extended-quick-save', await evaluate(`({
      ownerResult: document.querySelector('#ownerResult').textContent.trim(),
      summaryText: document.querySelector('#summaryBlock').textContent.trim().slice(0, 300),
      draftExists: Boolean(localStorage.getItem('domianExtendedDraft'))
    })`));
    await screenshot('extended-quick-save.png');

    record('console-summary', results.console.filter((entry) => ['error', 'warning', 'warn', 'exception'].includes(entry.type)));
    fs.writeFileSync(path.join(browserDir, 'browser-cdp-audit-results.json'), JSON.stringify(results, null, 2), 'utf8');
  } finally {
    if (client && client.socket) {
      client.socket.close();
    }
    chrome.kill();
    fs.writeFileSync(path.join(browserDir, 'chrome-output.log'), chromeOutput.join(''), 'utf8');
  }

  console.log(JSON.stringify({
    result: 'ok',
    path: path.relative(root, path.join(browserDir, 'browser-cdp-audit-results.json')).replace(/\\/g, '/'),
    screenshots: results.screenshots,
    consoleIssues: results.console.filter((entry) => ['error', 'warning', 'warn', 'exception'].includes(entry.type)).length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
