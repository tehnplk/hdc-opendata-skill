import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const repo = resolve(import.meta.dirname || 'tests', '..');
const artifacts = join(repo, 'artifacts');
mkdirSync(artifacts, { recursive: true });
const sandbox = mkdtempSync(join(artifacts, 'install-test-'));
const run = (home, cwd, args) => spawnSync(process.execPath, [join(repo, 'install.mjs'), ...args], {
  cwd, env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8',
});
const destination = (base, agent) => join(base, agent, 'skills', 'hdc-opendata');

test('global installs and updates all three destinations; preflight prevents partial installs', () => {
  const home = join(sandbox, 'home');
  mkdirSync(home);
  let result = run(home, sandbox, ['-g']);
  assert.equal(result.status, 0, result.stderr);
  for (const agent of ['.claude', '.agents', '.codex']) {
    const dest = destination(home, agent);
    assert.ok(existsSync(join(dest, 'SKILL.md')));
    assert.ok(existsSync(join(dest, 'scripts/output-path.mjs')));
    assert.ok(existsSync(join(dest, 'data/reports.csv')));
    assert.ok(!existsSync(join(dest, 'artifacts')));
    writeFileSync(join(dest, 'SKILL.md'), 'old version');
  }
  result = run(home, sandbox, ['--global']);
  assert.notEqual(result.status, 0);
  for (const agent of ['.claude', '.agents', '.codex']) {
    assert.equal(readFileSync(join(destination(home, agent), 'SKILL.md'), 'utf8'), 'old version');
  }
  result = run(home, sandbox, ['add', '--global', '--force']);
  assert.equal(result.status, 0, result.stderr);
  for (const agent of ['.claude', '.agents', '.codex']) {
    assert.match(readFileSync(join(destination(home, agent), 'SKILL.md'), 'utf8'), /name: hdc-opendata/);
  }
  const occupiedHome = join(sandbox, 'occupied-home');
  mkdirSync(destination(occupiedHome, '.codex'), { recursive: true });
  result = run(occupiedHome, sandbox, ['-g']);
  assert.notEqual(result.status, 0);
  assert.ok(!existsSync(destination(occupiedHome, '.claude')));
  assert.ok(!existsSync(destination(occupiedHome, '.agents')));
});

test('project install retains the existing Claude-only scope', () => {
  const project = join(sandbox, 'project');
  mkdirSync(project);
  const result = run(join(sandbox, 'home'), project, []);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(destination(project, '.claude'), 'SKILL.md')));
  assert.ok(!existsSync(join(project, '.agents')));
  assert.ok(!existsSync(join(project, '.codex')));
});

test('force cannot overwrite the source skill itself', () => {
  const result = run(join(sandbox, 'home'), repo, ['--force']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ต้นฉบับ/);
});
