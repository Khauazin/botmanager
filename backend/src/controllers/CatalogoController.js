const prisma = require('../prisma');

class CatalogoController {
  async listar(req, res) {
    try {
      const { clientId } = req.usuario;
      const produtos = await prisma.produto.findMany({
        where: { clientId },
        include: { variacoes: true },
        orderBy: { nome: 'asc' }
      });
      res.json(produtos);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar catálogo' });
    }
  }

  async criar(req, res) {
    try {
      const { clientId } = req.usuario;
      const { nome, descricao, tipo, visibilidade, estoqueMinimo, variacoes } = req.body;

      const produto = await prisma.produto.create({
        data: {
          clientId,
          nome,
          descricao,
          tipo,
          visibilidade,
          estoqueMinimo,
          variacoes: {
            create: variacoes // Array de variações [{ nome, preco, estoqueAtual, sku }]
          }
        },
        include: { variacoes: true }
      });

      res.status(201).json(produto);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar produto' });
    }
  }

  async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const { clientId } = req.usuario;

      const produto = await prisma.produto.findFirst({
        where: { id, clientId },
        include: { variacoes: true }
      });

      if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
      res.json(produto);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar produto' });
    }
  }

  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { clientId } = req.usuario;
      const { nome, descricao, tipo, visibilidade, estoqueMinimo } = req.body;

      const produto = await prisma.produto.update({
        where: { id, clientId },
        data: { nome, descricao, tipo, visibilidade, estoqueMinimo }
      });

      res.json(produto);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
  }

  async excluir(req, res) {
    try {
      const { id } = req.params;
      const { clientId } = req.usuario;

      await prisma.produto.delete({
        where: { id, clientId }
      });

      res.json({ message: 'Produto excluído com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir produto' });
    }
  }
}

module.exports = new CatalogoController();
