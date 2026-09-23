/*
 * Versionsstempel für die statischen Dateien
 * ==========================================
 *
 *   node build-version.mjs
 *
 * Hängt an jede Verweisstelle einen Fingerabdruck des Inhalts:
 *
 *   index.html   <script src="app.js?v=a1b2c3d4">
 *                <link href="styles.css?v=a1b2c3d4">
 *   app.js       import … from './core.js?v=a1b2c3d4'
 *
 * Warum das sein muss: index.html, app.js und core.js liegen einzeln im
 * Browser-Cache und laufen getrennt ab. Holt sich ein Handy die neue app.js,
 * behält aber die alte core.js, scheitert das Verknüpfen der Module – die
 * neue app.js importiert dann etwas, das die alte core.js nicht exportiert.
 * Ergebnis: die Seite startet überhaupt nicht. Genau das ist auf einem
 * iPhone passiert, und ein Neuladen half nicht, weil derselbe Cache
 * dieselbe alte Datei zurückgab.
 *
 * Mit dem Fingerabdruck zeigt eine frische index.html auf frische Adressen.
 * Alt und neu können sich nicht mehr vermischen.
 *
 * Vor jedem Commit laufen lassen, der eine dieser drei Dateien anfasst.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');

/** Vorhandene Stempel entfernen, damit der Abdruck nur vom Inhalt abhängt. */
const entstempeln = (text) => text.replace(/\?v=[a-f0-9]{8}/g, '');

const dateien = ['app.js', 'core.js', 'styles.css'];
const inhalte = {};
for (const name of dateien) {
  inhalte[name] = await readFile(join(DIR, name), 'utf8');
}

const hash = createHash('sha256');
for (const name of dateien) hash.update(entstempeln(inhalte[name]));
const version = hash.digest('hex').slice(0, 8);

/* --- app.js: der Import von core.js ------------------------------- */

const appNeu = entstempeln(inhalte['app.js'])
  .replace("from './core.js'", "from './core.js?v=" + version + "'");

if (!appNeu.includes('core.js?v=')) {
  console.error('FEHLER: In app.js wurde der Import von core.js nicht gefunden.');
  process.exit(1);
}
await writeFile(join(DIR, 'app.js'), appNeu);

/* --- index.html: app.js und styles.css ---------------------------- */

const htmlPfad = join(DIR, 'index.html');
let html = entstempeln(await readFile(htmlPfad, 'utf8'));
html = html
  .replace('src="app.js"', 'src="app.js?v=' + version + '"')
  .replace('href="styles.css"', 'href="styles.css?v=' + version + '"');

for (const erwartet of ['app.js?v=', 'styles.css?v=']) {
  if (!html.includes(erwartet)) {
    console.error('FEHLER: In index.html fehlt der Verweis auf ' + erwartet);
    process.exit(1);
  }
}
await writeFile(htmlPfad, html);

console.log('Version ' + version + ' gestempelt: index.html (app.js, styles.css), app.js (core.js)');
