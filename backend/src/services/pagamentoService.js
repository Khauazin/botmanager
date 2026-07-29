// Nucleo de criacao de cobranca — extraido de pagamentos.routes.js pra ser
// reusado pela ferramenta GERAR_COBRANCA_PIX do bot (mesma logica, sem
// duplicar a parte que fala com o PSP).

const prisma = require('../prisma');
const { carregarCredencialDecifrada } = require('../credenciais');
const { criarProvedor } = require('../adapters/pagamento');

/**
 * Monta o provedor do tenant a partir da config + credencial cifrada do cofre.
 * Lanca (com .status) se o tenant nao tem pagamento configurado/ativo — quem
 * chama decide como comunicar isso (HTTP 400 na rota; mensagem de erro pra
 * ferramenta devolver a IA, no caso do bot).
 */
async function provedorDoTenant(clienteId) {
  const config = await prisma.configuracaoPagamento.findUnique({ where: { clienteId } });
  if (!config || !config.ativo) {
    throw Object.assign(new Error('Pagamento nao configurado ou inativo para este tenant.'), { status: 400 });
  }
  const credencial = await carregarCredencialDecifrada({ credencialId: config.credencialId, clienteId });
  const psp = criarProvedor(config.provedor, { credencial, modo: 'fixture' });
  return { config, psp };
}

/**
 * Cria uma Cobranca (Pix ou link) via o adapter do PSP do tenant e persiste.
 * Mesma sequencia da rota POST /pagamentos/cobrancas: cria PENDENTE primeiro
 * (o id dela vira a refExterna que liga de volta), chama o PSP, atualiza com
 * o resultado; se o PSP falhar, cancela a Cobranca em vez de deixar lixo
 * PENDENTE sem QR/link nenhum.
 *
 * @param {{clienteId:string, origem:string, refId?:string|null, valor:number,
 *   metodo?:'PIX'|'LINK', descricao?:string, vencimento?:string,
 *   pagador?:Object, itensPendentes?:Array}} p
 * `itensPendentes` (opcional): carrinho que a ferramenta do bot quer
 * confirmar como Venda quando o Pix for pago — ver services/cobrancaPagamento.js.
 */
async function criarCobranca({ clienteId, origem = 'AVULSA', refId = null, valor, metodo = 'PIX', descricao, vencimento, pagador, itensPendentes }) {
  const { config, psp } = await provedorDoTenant(clienteId);

  const cobranca = await prisma.cobranca.create({
    data: {
      clienteId, origem, refId, valor, metodo, status: 'PENDENTE', provedor: config.provedor,
      vencimento: vencimento ? new Date(vencimento) : null,
      itensPendentes: itensPendentes || undefined,
    },
  });

  let dto;
  try {
    const params = {
      valor, descricao: descricao || `Cobranca ${cobranca.id}`, refExterna: cobranca.id, vencimento, pagador,
    };
    dto = metodo === 'PIX' ? await psp.criarCobrancaPix(params) : await psp.criarLink(params);
  } catch (errPsp) {
    await prisma.cobranca.update({ where: { id: cobranca.id }, data: { status: 'CANCELADO' } });
    throw errPsp;
  }

  const atualizada = await prisma.cobranca.update({
    where: { id: cobranca.id },
    data: {
      provedorCobrancaId: dto.provedorCobrancaId,
      status: dto.status || 'PENDENTE',
      qrCode: dto.qrCode || null,
      linkUrl: dto.linkUrl || null,
      vencimento: dto.vencimento ? new Date(dto.vencimento) : (vencimento ? new Date(vencimento) : null),
    },
  });

  // qrCodeBase64 (imagem do QR) nao e persistido — so devolvido neste retorno.
  return { ...atualizada, qrCodeBase64: dto.qrCodeBase64 || null };
}

module.exports = { provedorDoTenant, criarCobranca };
