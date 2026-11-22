// ELK em Web Worker: o posicionamento automático não trava a interface em árvores grandes.
import ELKApi from 'elkjs/lib/elk-api.js';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';
export const elk = new (ELKApi as any)({ workerUrl });
