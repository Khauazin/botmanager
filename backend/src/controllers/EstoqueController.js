const prisma = require('../prisma');

/**
 * Controller responsável pela gestão de estoque (Módulo de Inventário).
 * Segue o modelo de Ledger (Livro-Razão) onde o saldo é reflexo das movimentações.
 */
class EstoqueController {
  
  /**
   * Registra uma nova movimentação de estoque (Entrada, Saída, Ajuste, etc).
   * Utiliza transações do Prisma para garantir a integridade entre o registro
   * da movimentação e a atualização do saldo atual na variação do produto.
   */
  async registrarMovimentacao(req, res) {
    const { variacaoId, tipo, quantidade, motivo, vendaId } = req.body;

    // Validações básicas
    if (!variacaoId || !tipo || quantidade === undefined) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: variacaoId, tipo (VENDA, AJUSTE, etc) e quantidade.' 
      });
    }

    try {
      // Verifica se a variação existe antes de iniciar a transação
      const variacaoExiste = await prisma.variacaoProduto.findUnique({
        where: { id: variacaoId }
      });

      if (!variacaoExiste) {
        return res.status(404).json({ 
          error: `Variação com ID ${variacaoId} não encontrada no banco de dados.` 
        });
      }

      const resultado = await prisma.$transaction(async (tx) => {
        
        // 1. Registra a movimentação no "Livro-Razão" (MovimentacaoEstoque)
        const movimentacao = await tx.movimentacaoEstoque.create({
          data: {
            variacaoId,
            tipo,
            quantidade, // Ex: -5 para saída/venda, +10 para compra/entrada
            motivo,
            vendaId
          }
        });

        // 2. Atualiza o saldo matemático na Variação (estoqueAtual)
        // Isso atua como um cache de alta performance do somatório das movimentações
        const variacaoAtualizada = await tx.variacaoProduto.update({
          where: { id: variacaoId },
          data: {
            estoqueAtual: {
              increment: quantidade
            }
          },
          include: {
            produto: true
          }
        });

        // 3. Verificação de Alerta de Estoque Mínimo
        const { produto, estoqueAtual, nome: nomeVariacao } = variacaoAtualizada;
        
        if (produto.tipo === 'FISICO' && produto.estoqueMinimo !== null) {
          if (estoqueAtual <= produto.estoqueMinimo) {
            console.log(`[ALERTA] Estoque baixo para ${produto.nome} (${nomeVariacao}): ${estoqueAtual}`);
            
            // Busca o primeiro bot do cliente para associar o alerta (regra de negócio do sistema)
            const bot = await tx.bot.findFirst({
              where: { clientId: produto.clientId }
            });

            if (bot) {
              await tx.alert.create({
                data: {
                  clientId: produto.clientId,
                  botId: bot.id,
                  severity: 'WARNING',
                  title: 'Estoque Mínimo Atingido',
                  message: `O item "${produto.nome} - ${nomeVariacao}" está com saldo de ${estoqueAtual}, atingindo o limite mínimo de ${produto.estoqueMinimo}.`
                }
              });
            }
          }
        }

        return {
          movimentacao,
          novoEstoque: estoqueAtual
        };
      });

      return res.status(201).json({
        success: true,
        data: resultado
      });

    } catch (error) {
      console.error('[EstoqueController] Erro na transação de movimentação:', error);
      return res.status(500).json({ 
        error: 'Falha interna ao processar movimentação de estoque.',
        details: error.message 
      });
    }
  }

  /**
   * Conceito de Reserva (Soft Allocation): 
   * Bloqueia temporariamente um item enquanto o pedido está em andamento.
   */
  async reservarEstoque(req, res) {
    const { variacaoId, quantidade, vendaId } = req.body;
    
    // Na reserva, subtraímos do estoque com o tipo 'RESERVA'
    req.body.tipo = 'RESERVA';
    req.body.quantidade = -Math.abs(quantidade);
    req.body.motivo = 'Reserva temporária para venda em andamento';
    
    return this.registrarMovimentacao(req, res);
  }
  /**
   * Lista todas as movimentações de estoque do cliente.
   */
  async listarMovimentacoes(req, res) {
    try {
      const { clientId } = req.usuario;

      const movimentacoes = await prisma.movimentacaoEstoque.findMany({
        where: {
          variacao: {
            produto: {
              clientId
            }
          }
        },
        include: {
          variacao: {
            include: {
              produto: true
            }
          },
          venda: true
        },
        orderBy: { data: 'desc' }
      });

      res.json(movimentacoes);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar movimentações de estoque.' });
    }
  }

  /**
   * Consulta o saldo atual e o histórico de uma variação específica.
   */
  async buscarSaldoPorVariacao(req, res) {
    try {
      const { variacaoId } = req.params;
      const { clientId } = req.usuario;

      const variacao = await prisma.variacaoProduto.findFirst({
        where: { 
          id: variacaoId,
          produto: { clientId }
        },
        include: {
          produto: true,
          movimentacoes: {
            orderBy: { data: 'desc' },
            take: 50
          }
        }
      });

      if (!variacao) {
        return res.status(404).json({ error: 'Variação não encontrada.' });
      }

      res.json(variacao);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar saldo da variação.' });
    }
  }
}

module.exports = new EstoqueController();
