// Orbital Courier — entry program (Node 22, standard library only).
// Copies game/ and screenshots/ from this repository to the output directory
// and writes dossier.json with buildDossier from vendor/makefun-game.ts.
// The program runs twice in the grader and both runs must write the same
// bytes; copying files and buildDossier are both deterministic.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  const dest = join(outDir, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');
rmSync(join(outDir, 'dossier.json'), { force: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`orbital-courier: dossier written (${dossier.length} bytes) to ${join(outDir, 'dossier.json')}`);
