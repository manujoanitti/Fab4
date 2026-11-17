import { readFileSync, writeFileSync } from 'node:fs';
import { renderCatalogDoc, type Catalog } from './lib/catalog-doc';

const catalog = JSON.parse(readFileSync('src/art/catalog.json', 'utf8')) as Catalog;
writeFileSync('docs/arte/catalogo-recursos.md', renderCatalogDoc(catalog));
console.log(`docs/arte/catalogo-recursos.md gerado (${catalog.catalog.length} recursos)`);
