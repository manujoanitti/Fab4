// Gera um exemplo FICTÍCIO (família Rossi) para experimentar a tela Administração → Importar relatório.
import { writeFileSync } from 'node:fs';
import { REPORT, pkg } from '../tests/fixtures/rossi';
writeFileSync('data/fixtures/exemplo-rossi-pacote.json', JSON.stringify(pkg(), null, 2));
writeFileSync('data/fixtures/exemplo-rossi-relatorio.md', REPORT + '\n');
console.log('data/fixtures/exemplo-rossi-{pacote.json,relatorio.md} gravados');
