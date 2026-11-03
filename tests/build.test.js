import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { buildSite } from '../scripts/build-site.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('static publication contains the complete browser app, relative entrypoints and license', async () => {
  const destination = await mkdtemp(join(tmpdir(), 'rtu-build-'));
  try {
    await writeFile(join(destination, 'existing.txt'), 'preserve this file');
    const files = await buildSite(destination);
    assert.ok(files.includes('.nojekyll'));
    assert.equal(await readFile(join(destination, '.nojekyll'), 'utf8'), '');
    assert.equal(await readFile(join(destination, 'existing.txt'), 'utf8'), 'preserve this file');
    for (const file of files.filter(file => file !== '.nojekyll')) {
      assert.deepEqual(await readFile(join(destination, file)), await readFile(join(root, file)));
    }
    const html = await readFile(join(destination, 'index.html'), 'utf8');
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (url.startsWith('data:')) continue;
      assert.ok(url.startsWith('./'), `Asset URL must work under /achille/: ${url}`);
      await access(resolve(destination, url));
    }
    const modules = (await readdir(join(root, 'src'))).filter(file => file.endsWith('.js'));
    assert.equal(files.filter(file => file.startsWith('src/')).length, modules.length);
    for (const module of modules) {
      const code = await readFile(join(destination, 'src', module), 'utf8');
      for (const [, imported] of code.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) {
        await access(resolve(destination, 'src', imported));
      }
    }
    await assert.rejects(access(join(destination, 'server.js')));
    await assert.rejects(access(join(destination, 'package.json')));
    await assert.rejects(access(join(destination, '.git')));
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
});

test('build command resolves sources independently of the working directory', async () => {
  const destination = await mkdtemp(join(tmpdir(), 'rtu-build-cli-'));
  try {
    await promisify(execFile)(process.execPath,
      [join(root, 'scripts', 'build-site.js'), destination], { cwd: tmpdir() });
    assert.equal(await readFile(join(destination, 'LICENSE'), 'utf8'), await readFile(join(root, 'LICENSE'), 'utf8'));
    await access(join(destination, 'src', 'app.js'));
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
});
