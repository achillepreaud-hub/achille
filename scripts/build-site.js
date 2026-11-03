import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), '..');

/** Copy only the browser application; leave unrelated existing files untouched. */
export async function buildSite(destination = join(root, 'dist')) {
  await mkdir(join(destination, 'src'), { recursive: true });
  const browserModules = (await readdir(join(root, 'src'), { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => join('src', entry.name));
  const files = ['index.html', 'styles.css', 'LICENSE', ...browserModules];
  await Promise.all(files.map(file => copyFile(join(root, file), join(destination, file))));
  await writeFile(join(destination, '.nojekyll'), '');
  return [...files, '.nojekyll'];
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const destination = process.argv[2] ? resolve(process.argv[2]) : join(root, 'dist');
  const files = await buildSite(destination);
  console.log(`Site statique prêt : ${files.length} fichiers dans ${destination}`);
}
