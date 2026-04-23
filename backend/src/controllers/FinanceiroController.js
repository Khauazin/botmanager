const prisma = require('../prisma');

class FinanceiroController {
  // Lançamentos
  async listarLancamentos(req, res) {
    try {
      const { clientId } = req.usuario;
      const { tipo, status, inicio, fim } = req.query;

      const lancamentos = await prisma.lancamentoFinanceiro.findMany({
        where: {
          clientId,
          tipo: tipo || undefined,
          status: status || undefined,
          dataVencimento: {
            gte: inicio ? new Date(inicio) : undefined,
            lte: fim ? new Date(fim) : undefined
          }
        },
        include: {
          categoria: true,
          lead: { select: { name: true } },
          venda: true
        },
        orderBy: { dataVencimento: 'desc' }
      });

      res.json(lancamentos);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar lançamentos' });
    }
  }

  async criarLancamento(req, res) {
    try {
      const { clientId } = req.usuario;
      const { 
        descricao, valor, tipo, status, dataVencimento, 
        categoriaId, leadId, vendaId 
      } = req.body;

      // Validação de existência de relações (prevenção de erro P2003)
      if (categoriaId) {
        const cat = await prisma.categoriaFinanceira.findUnique({ where: { id: categoriaId } });
        if (!cat) return res.status(404).json({ error: 'Categoria financeira não encontrada.' });
      }
      if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
      }
      if (vendaId) {
        const venda = await prisma.sale.findUnique({ where: { id: vendaId } });
        if (!venda) return res.status(404).json({ error: 'Venda não encontrada.' });
      }

      const lancamento = await prisma.lancamentoFinanceiro.create({
        data: {
          clientId,
          descricao,
          valor,
          tipo,
          status: status || 'PENDENTE',
          dataVencimento: new Date(dataVencimento),
          categoriaId,
          leadId,
          vendaId
        }
      });

      res.status(201).json(lancamento);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar lançamento financeiro' });
    }
  }

  async atualizarStatus(req, res) {
    try {
      const { id } = req.params;
      const { clientId } = req.usuario;
      const { status, dataPagamento } = req.body;

      const lancamento = await prisma.lancamentoFinanceiro.update({
        where: { id, clientId },
        data: { 
          status, 
          dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined 
        }
      });

      res.json(lancamento);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar status do lançamento' });
    }
  }

  // Categorias
  async listarCategorias(req, res) {
    try {
      const { clientId } = req.usuario;
      const categorias = await prisma.categoriaFinanceira.findMany({
        where: { clientId },
        orderBy: { nome: 'asc' }
      });
      res.json(categorias);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar categorias' });
    }
  }

  async criarCategoria(req, res) {
    try {
      const { clientId } = req.usuario;
      const { nome, tipo } = req.body;

      const categoria = await prisma.categoriaFinanceira.create({
        data: { clientId, nome, tipo }
      });

      res.status(201).json(categoria);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar categoria' });
    }
  }
}

module.exports = new FinanceiroController();
