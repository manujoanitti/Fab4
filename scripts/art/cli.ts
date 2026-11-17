// Interface de operação do pipeline gráfico. Uso: npm run art:<comando> [-- argumentos]
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { ambientePadrao, cmdApprove, cmdIntegrate, cmdPlan, cmdProcess, cmdPrompt, cmdReopen, cmdReview, cmdStatus } from './lib/executar';
import { ROTULO_ESTADO } from './lib/types';

const AJUDA = `Pipeline de produção gráfica — comandos (npm run art:<comando> -- <argumentos>)

  art:plan                         lista os lotes, estados e o próximo a produzir      [--json] [--adiados]
  art:prompt  [lote]               gera o prompt do Gemini, a lista de anexos e o guia da prancha (padrão: próximo lote)
  art:process [lote] <arquivo>     recebe a imagem do Gemini e processa (recorta, remove fundo, converte, valida)  [--forcar] [--tolerancia baixa|media|alta]
  art:review  [lote]               gera o relatório HTML + prancha de conferência (validação TÉCNICA)
  art:approve <lote>               aprovação ARTÍSTICA (manual): --todos | --ids a,b | --rejeitar a,b
  art:integrate <lote>             copia o lote aprovado para public/art e atualiza o manifesto: --confirmar [--ativar]
  art:status  <lote>               estado, histórico e aprovações de um lote
  art:reopen  <lote>               volta o lote para "aguardando geração" (refazer a imagem)
  art:cenarios pacote|processar     monta o pacote de produção dos 5 cenários / processa as 5 imagens entregues em art-work/entrada-cenarios
  art:producao pacote|processar     monta o pacote dos 19 lotes restantes / processa as imagens entregues em art-work/entrada-producao
  art:validate                     valida o pacote final (manifesto × catálogo × arquivos)
`;

async function main() {
  const [cmd, ...resto] = process.argv.slice(2);
  const { values, positionals } = parseArgs({ args: resto, allowPositionals: true, options: {
    json: { type: 'boolean' }, adiados: { type: 'boolean' }, forcar: { type: 'boolean' }, tolerancia: { type: 'string' }, todos: { type: 'boolean' },
    ids: { type: 'string' }, rejeitar: { type: 'string' }, confirmar: { type: 'boolean' }, ativar: { type: 'boolean' }, 'incluir-falhas': { type: 'boolean' },
  } });
  const amb = ambientePadrao();
  const lista = (s?: string) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined);
  switch (cmd) {
    case 'plan': {
      const r = cmdPlan(amb);
      if (values.json) return console.log(JSON.stringify(r, null, 2));
      console.log('LOTES DE PRODUÇÃO\n');
      for (const l of r.linhas) console.log(`${String(l.ordem).padStart(2)}. ${l.id.padEnd(34)} ${ROTULO_ESTADO[l.estado].padEnd(19)} ${l.prioridade}  ${l.tipo.padEnd(10)} ${String(l.recursos).padStart(2)} recurso(s)${l.bloqueadoPor.length ? `   ⏳ aguarda: ${l.bloqueadoPor.join(', ')}` : ''}`);
      console.log(`\nPróximo lote: ${r.proximo ?? '(nenhum disponível)'}${r.proximo ? `   →  npm run art:prompt -- ${r.proximo}` : ''}`);
      console.log(`Resumo: ${r.resumo.lotes} lotes (${r.resumo.pranchas} pranchas, ${r.resumo.cenarios} cenários, ${r.resumo.individuais} imagens individuais) cobrindo ${r.resumo.recursosEmLotes} recursos; ${r.resumo.adiados} adiados.`);
      if (values.adiados) { console.log('\nADIADOS'); for (const d of r.adiados) console.log(`- ${d.id}: ${d.motivo}`); }
      return;
    }
    case 'prompt': {
      const r = await cmdPrompt(amb, positionals[0]);
      console.log(`Lote: ${r.lote.id} — ${r.lote.titulo}`);
      if (r.bloqueio.length) console.log(`⚠️  Atenção: depende de lote(s) ainda não aprovado(s): ${r.bloqueio.join(', ')} (o prompt foi gerado mesmo assim).`);
      console.log('\nArquivos gerados:'); r.arquivos.forEach((f) => console.log(`  ${f}`));
      console.log(`\nAnexe ao Gemini:\n${r.lote.referencias.map((x) => `  - ${x.arquivo}${x.gerada ? ` (em ${join(r.pasta, 'guia-prancha.png')})` : ''}`).join('\n')}`);
      console.log('\n===== PROMPT (copie tudo abaixo) =====\n'); console.log(r.texto); console.log('\n===== FIM DO PROMPT =====');
      console.log(`\nDepois de gerar a imagem:  npm run art:process -- ${r.lote.id} caminho/da/imagem.png`);
      return;
    }
    case 'cenarios': {
      const { cmdCenariosPacote, cmdCenariosProcessar } = await import('./lib/cenarios');
      if (positionals[0] === 'pacote') {
        const r = await cmdCenariosPacote(amb);
        console.log(`Pacote pronto em ${r.raiz}/ (leia ${r.raiz}/LEIA-ME.md)`);
        for (const p of r.passos) console.log(`  ${p.ordem}. ${p.regiao}: ${p.prompt}`);
        return;
      }
      if (positionals[0] === 'processar') {
        const r = await cmdCenariosProcessar(amb, undefined, { forcar: values.forcar });
        for (const x of r) console.log(x.presente ? `  ${x.lote}: ${x.resumo!.ok} ok · ${x.resumo!.revisar} revisar · ${x.resumo!.falha} falha — ${x.relatorio}` : `  ${x.lote}: imagem NÃO entregue`);
        console.log('\nNada foi aprovado nem integrado. Aprovação artística: npm run art:approve -- <lote> --todos');
        return;
      }
      throw new Error('uso: npm run art:cenarios -- pacote | processar');
    }
    case 'producao': {
      const { cmdProducaoPacote, cmdProducaoProcessar } = await import('./lib/producao');
      if (positionals[0] === 'pacote') {
        const r = await cmdProducaoPacote(amb);
        console.log(`Pacote pronto em ${r.raiz}/ (leia ${r.raiz}/LEIA-ME.md): ${r.passos.length} imagens`);
        if (r.dependencias.length) console.log(`Dependências: ${r.dependencias.join(', ')}`);
        return;
      }
      if (positionals[0] === 'processar') {
        for (const x of await cmdProducaoProcessar(amb, undefined, { forcar: values.forcar })) console.log(x.presente ? `  ${x.lote}: ${x.resumo!.ok} ok · ${x.resumo!.revisar} revisar · ${x.resumo!.falha} falha — ${x.relatorio}` : `  ${x.lote}: imagem NÃO entregue`);
        console.log('\nNada foi aprovado nem integrado.');
        return;
      }
      throw new Error('uso: npm run art:producao -- pacote | processar');
    }
    case 'process': {
      const [a, b] = positionals;
      const r = await cmdProcess(amb, b ? a : undefined, b ?? a, { forcar: values.forcar, tolerancia: values.tolerancia as 'baixa' | 'media' | 'alta' | undefined });
      const q = r.resultado.recursos;
      console.log(`\nLote ${r.lote.id}: ${q.filter((x) => x.status === 'ok').length} ok · ${q.filter((x) => x.status === 'revisar').length} para revisar · ${q.filter((x) => x.status === 'falha').length} com falha${r.pulou ? ' (reaproveitado)' : ''}`);
      for (const x of q) console.log(`  ${x.status === 'ok' ? '✅' : x.status === 'revisar' ? '⚠️ ' : '⛔'} ${x.id}${x.problemas.length ? ' — ' + x.problemas.map((p) => p.msg).join('; ') : ''}`);
      r.resultado.avisosGerais.forEach((w) => console.log(`  ℹ️  ${w}`));
      console.log(`\nPróximo passo: npm run art:review -- ${r.lote.id}`);
      return;
    }
    case 'review': {
      const r = await cmdReview(amb, positionals[0]);
      console.log(`Relatório do lote ${r.lote.id}: ${r.resumo.ok} ok · ${r.resumo.revisar} revisar · ${r.resumo.falha} falha`);
      console.log(`  HTML: ${r.rev.relatorioHtml}\n  Conferência: ${r.rev.conferencia}${r.rev.deteccao ? `\n  Detecção: ${r.rev.deteccao}` : ''}`);
      console.log('\nA validação técnica NÃO é aprovação artística. Depois de olhar os recursos:');
      console.log(`  npm run art:approve -- ${r.lote.id} --todos        (ou --ids a,b  /  --rejeitar c)`);
      return;
    }
    case 'approve': {
      if (!positionals[0]) throw new Error('informe o lote: npm run art:approve -- <lote> --todos');
      const r = cmdApprove(amb, positionals[0], { todos: values.todos, ids: lista(values.ids), rejeitar: lista(values.rejeitar), incluirFalhas: values['incluir-falhas'] });
      console.log(`Estado: ${ROTULO_ESTADO[r.estado]}`);
      if (r.pendentes.length) console.log(`Pendentes: ${r.pendentes.join(', ')}`);
      if (r.rejeitados.length) console.log(`Rejeitados (gere novamente): ${r.rejeitados.join(', ')}`);
      return;
    }
    case 'integrate': {
      if (!positionals[0]) throw new Error('informe o lote: npm run art:integrate -- <lote> --confirmar');
      const r = cmdIntegrate(amb, positionals[0], { confirmar: values.confirmar, ativar: values.ativar });
      if (r.simulacao) { console.log('SIMULAÇÃO (nada foi alterado). Entraria no manifesto:'); console.log(JSON.stringify(r.proposta, null, 2)); console.log('\nPara aplicar: --confirmar'); return; }
      if (!r.ok) { console.error('Integração RECUSADA (nada foi alterado):'); r.erros.forEach((e) => console.error(`  - ${e}`)); process.exitCode = 1; return; }
      console.log(`Integrado: ${r.copiados.length} arquivo(s) em public/art. Avisos: ${r.avisos.length}. Nada foi publicado: revise, rode os testes e abra o pull request.`);
      return;
    }
    case 'status': {
      const r = cmdStatus(amb, positionals[0]);
      console.log(JSON.stringify({ id: r.lote.id, titulo: r.lote.titulo, estado: r.registro.estado, bloqueadoPor: r.bloqueadoPor, qa: r.registro.qa, aprovacao: r.registro.aprovacao, historico: r.registro.historico }, null, 2));
      return;
    }
    case 'reopen': { const r = cmdReopen(amb, positionals[0], positionals[1]); console.log(`Lote ${r.id}: ${ROTULO_ESTADO[r.estado]}`); return; }
    default: console.log(AJUDA);
  }
}
main().catch((e) => { console.error(`\n✖ ${(e as Error).message}\n`); process.exit(1); });
