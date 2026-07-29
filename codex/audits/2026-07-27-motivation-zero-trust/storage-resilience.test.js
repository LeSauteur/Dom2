const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../../../pub/domian-calculator-a4');
const source = fs.readFileSync(
  path.join(projectRoot, 'assets/js/career-storage.js'),
  'utf8'
);

function loadStorage(initialValue) {
  let raw = initialValue;
  const writes = [];
  const warnings = [];
  const context = vm.createContext({
    console: {
      warn(...args) {
        warnings.push(args.map(String).join(' '));
      }
    },
    crypto: {
      randomUUID() {
        return '00000000-0000-4000-8000-000000000001';
      }
    },
    localStorage: {
      getItem(key) {
        return key === 'domianCareerDraftV1' ? raw : null;
      },
      setItem(key, value) {
        writes.push({ key, value });
        if (key === 'domianCareerDraftV1') {
          raw = value;
        }
      }
    }
  });

  vm.runInContext(source, context, {
    filename: 'assets/js/career-storage.js'
  });

  return {
    api: context.CareerStorage,
    getRaw: () => raw,
    warnings,
    writes
  };
}

test('неизвестная версия не должна загружаться молча', () => {
  const fixture = loadStorage(JSON.stringify({
    version: 999,
    policyVersion: 'future-policy',
    profiles: [{ id: 'future-1', name: 'Профиль из будущей версии' }],
    decisions: [],
    mappings: []
  }));

  const loaded = fixture.api.read();

  assert.equal(
    fixture.warnings.length > 0,
    true,
    `Версия ${loaded.version} была нормализована без предупреждения`
  );
});

test('повреждённый JSON нельзя перезаписывать автоматически без резервной копии', () => {
  const corrupted = '{"version":1,"profiles":[';
  const fixture = loadStorage(corrupted);

  fixture.api.read();
  fixture.api.saveProfile({
    id: 'career-agent-new',
    name: 'Новый агент',
    status: 'partner'
  });

  assert.equal(
    fixture.getRaw(),
    corrupted,
    'Повреждённое исходное значение было заменено новым хранилищем'
  );
});

test('частично заполненное состояние допустимой версии нормализуется без потери профиля', () => {
  const fixture = loadStorage(JSON.stringify({
    version: 1,
    profiles: [{ id: 'career-agent-17', name: 'Анна' }]
  }));

  const loaded = fixture.api.read();

  assert.equal(loaded.version, 1);
  assert.equal(loaded.profiles.length, 1);
  assert.equal(loaded.profiles[0].id, 'career-agent-17');
  assert.equal(loaded.profiles[0].name, 'Анна');
  assert.deepEqual(Array.from(loaded.decisions), []);
  assert.deepEqual(Array.from(loaded.mappings), []);
});
