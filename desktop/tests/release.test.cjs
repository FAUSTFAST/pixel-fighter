'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../release-guard.cjs'), 'utf8');
function guard({ target = 'FAUSTFAST/pixel-fighter-releases', isPrivate = true, conclusion = 'success', workflow = '.github/workflows/desktop-build.yml', repository = 'FAUSTFAST/pixel-fighter', runId = '1234' } = {}) {
  const calls = [];
  vm.runInNewContext(source, {
    process: { env: { GITHUB_REPOSITORY: 'FAUSTFAST/pixel-fighter', RELEASE_REPO: target, RUN_ID: runId } },
    console: { log() {} },
    require: name => {
      assert.equal(name, 'node:child_process');
      return { execFileSync(binary, args) {
        assert.equal(binary, 'gh'); assert.equal(args[0], 'api'); calls.push(args[1]);
        return JSON.stringify(args[1].includes('/actions/runs/') ? { conclusion, path: workflow, repository: { full_name: repository } } : { private: isPrivate });
      } };
    }
  });
  return calls;
}
test('public source, same destination and failed/foreign builds cannot publish', () => {
  assert.throws(() => guard({ isPrivate: false }), /still public/);
  assert.throws(() => guard({ target: 'faustfast/PIXEL-FIGHTER' }), /separate/);
  assert.throws(() => guard({ target: 'owner/repo;command' }), /separate/);
  assert.throws(() => guard({ conclusion: 'failure' }), /successful/);
  assert.throws(() => guard({ workflow: '.github/workflows/other.yml' }), /successful/);
  assert.throws(() => guard({ repository: 'other/repo' }), /successful/);
  assert.throws(() => guard({ runId: '../123' }), /Invalid/);
  assert.equal(guard().length, 2);
});
