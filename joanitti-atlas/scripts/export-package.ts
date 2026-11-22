// Exporta o pacote de extração real como JSON (para reimportar pela interface de Administração).
import { writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const real = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'data', 'real');
const { pacote } = await import(join(real, 'extracao', 'index.ts'));
writeFileSync(join(real, 'pacote-extracao.json'), JSON.stringify(pacote, null, 2));
console.log('data/real/pacote-extracao.json gravado');
