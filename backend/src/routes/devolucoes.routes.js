// Devolucoes de itens alugados (produtos com temDevolucao=true). Cada linha
// nasce junto com a Venda (ver vendaService.criarVenda) e some da lista
// "pendente" quando o item volta fisicamente (concluir estorna estoque, mesma
// logica do cancelamento de venda).
const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('VENDAS'));

// ==========================================
// CONFIGURACAO — quantos dias antes da data o cron avisa (ver
// jobs/cronDevolucoes.js e Cliente.diasAvisoDevolucao). Registrado ANTES de
// '/:id/concluir' nao ser um problema aqui (paths distintos), mas mantido no
// topo por clareza.
// ==========================================
roteador.get('/config', requerPermissao('VENDAS', 'visualizar'), async (req, res) => {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ erro: 'Tenant indefinido.' });
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { diasAvisoDevolucao: true } });
    res.json({ diasAvisoDevolucao: cliente?.diasAvisoDevolucao ?? 1 });
  } catch (erro) {
    console.error('[devolucoes/config/get]', erro);
    res.status(500).json({ erro: 'Erro ao buscar configuração.' });
  }
});

roteador.put('/config', requerPermissao('VENDAS', 'editar'), async (req, res) => {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ erro: 'Tenant indefinido.' });
    const { diasAvisoDevolucao } = req.body || {};
    const n = parseInt(diasAvisoDevolucao, 10);
    if (!Number.isInteger(n) || n < 0 || n > 30) {
      return res.status(422).json({ erro: 'diasAvisoDevolucao deve ser um inteiro entre 0 e 30.' });
    }
    const cliente = await prisma.cliente.update({
      where: { id: clienteId },
      data: { diasAvisoDevolucao: n },
      select: { diasAvisoDevolucao: true },
    });
    res.json(cliente);
  } catch (erro) {
    console.error('[devolucoes/config/put]', erro);
    res.status(500).json({ erro: 'Erro ao salvar configuração.' });
  }
});

const INCLUDE_PADRAO = {
  lead: { select: { id: true, nome: true, telefone: true, cpf: true } },
  variacao: { select: { id: true, nome: true, produto: { select: { nome: true, tipo: true } } } },
  venda: { select: { id: true, numero: true } },
};

// GET /devolucoes?status=pendente|atrasada|concluida (default: pendente)
// 'pendente' = tudo ainda nao devolvido; 'atrasada' e o mesmo filtro + data
// de devolucao ja passou — recorte feito no servidor pra nao trazer tudo e
// filtrar no cliente a toa.
roteador.get('/', requerPermissao('VENDAS', 'visualizar'), async (req, res) => {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ erro: 'Tenant indefinido.' });

    const { status } = req.query;
    const onde = { clienteId };
    if (status === 'concluida') {
      onde.devolvidoEm = { not: null };
    } else {
      onde.devolvidoEm = null;
      if (status === 'atrasada') onde.dataDevolucao = { lt: new Date() };
    }

    const devolucoes = await prisma.devolucao.findMany({
      where: onde,
      include: INCLUDE_PADRAO,
      orderBy: { dataDevolucao: 'asc' },
    });
    res.json(devolucoes);
  } catch (erro) {
    console.error('[devolucoes/listar]', erro);
    res.status(500).json({ erro: 'Erro ao listar devoluções.' });
  }
});

// PATCH /devolucoes/:id/concluir — marca como devolvida. Se o produto for
// FISICO, estorna o estoque (MovimentacaoEstoque tipo DEVOLUCAO), mesma
// mecânica do cancelamento de venda (VendaController.cancelarVenda).
// Idempotente: se ja estava concluida, devolve 200 sem efeito colateral.
roteador.patch('/:id/concluir', requerPermissao('VENDAS', 'editar'), async (req, res) => {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ erro: 'Tenant indefinido.' });
    const { id } = req.params;

    const devolucao = await prisma.devolucao.findFirst({
      where: { id, clienteId },
      include: { variacao: { include: { produto: true } }, venda: { select: { numero: true } } },
    });
    if (!devolucao) return res.status(404).json({ erro: 'Devolução não encontrada.' });
    if (devolucao.devolvidoEm) {
      return res.status(200).json({ ok: true, jaConcluida: true, devolucao });
    }

    const agora = new Date();
    const atualizada = await prisma.$transaction(async (tx) => {
      const d = await tx.devolucao.update({ where: { id }, data: { devolvidoEm: agora } });
      if (devolucao.variacao.produto.tipo === 'FISICO') {
        await tx.movimentacaoEstoque.create({
          data: {
            variacaoId: devolucao.variacaoId,
            tipo: 'DEVOLUCAO',
            quantidade: devolucao.quantidade,
            motivo: `Devolução do aluguel — Venda #${devolucao.venda.numero}`,
            vendaId: devolucao.vendaId,
          },
        });
        await tx.variacaoProduto.update({
          where: { id: devolucao.variacaoId },
          data: { estoqueAtual: { increment: devolucao.quantidade } },
        });
      }
      return d;
    });

    res.json({ ok: true, devolucao: atualizada });
  } catch (erro) {
    console.error('[devolucoes/concluir]', erro);
    res.status(500).json({ erro: 'Erro ao concluir devolução.' });
  }
});

module.exports = roteador;
