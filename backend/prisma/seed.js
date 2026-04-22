const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // ─── 1. Criar Usuário Admin ──────────────────────
  const senhaHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@botmanager.com' },
    update: { password: senhaHash },
    create: {
      name: 'Administrador',
      email: 'admin@botmanager.com',
      password: senhaHash,
      role: 'ADMIN'
    }
  });
  console.log(`✅ Admin criado: ${admin.email}`);

  // ─── 2. Criar Cliente de Exemplo ─────────────────
  const cliente = await prisma.client.upsert({
    where: { id: 'seed-client-01' },
    update: {},
    create: {
      id: 'seed-client-01',
      name: 'Clínica Sorriso',
      email: 'contato@clinicasorriso.com',
      phone: '11999887766',
      segment: 'Saúde / Odontologia',
      plan: 'PRO',
      status: 'ACTIVE',
      monthlyFee: 197.00,
      notes: 'Cliente desde o lançamento da plataforma.'
    }
  });
  console.log(`✅ Cliente criado: ${cliente.name}`);

  // Criar o Usuário do Cliente para Login
  const clientUser = await prisma.user.upsert({
    where: { email: 'contato@clinicasorriso.com' },
    update: { password: senhaHash },
    create: {
      name: 'Clínica Sorriso (Dono)',
      email: 'contato@clinicasorriso.com',
      password: senhaHash,
      role: 'CLIENT',
      clientId: cliente.id
    }
  });
  console.log(`✅ Acesso de Cliente criado: ${clientUser.email}`);

  // ─── 3. Criar Bot para o Cliente ─────────────────
  const bot = await prisma.bot.upsert({
    where: { id: 'seed-bot-01' },
    update: {},
    create: {
      id: 'seed-bot-01',
      clientId: cliente.id,
      name: 'Bot Agendamento WhatsApp',
      channel: 'WHATSAPP',
      status: 'ONLINE',
      phoneNumber: '5511999887766',
      messagesTotal: 1250,
      messagesToday: 34,
      lastActivityAt: new Date()
    }
  });
  console.log(`✅ Bot criado: ${bot.name}`);

  // ─── 4. Criar Variáveis do Bot ───────────────────
  const variaveis = [
    { key: 'GREETING_MESSAGE', value: 'Olá! 👋 Bem-vindo à Clínica Sorriso. Como posso ajudar?', description: 'Mensagem de Boas Vindas', type: 'TEXT' },
    { key: 'BUSINESS_HOURS', value: '08:00 - 18:00', description: 'Horário de Funcionamento', type: 'TEXT' },
    { key: 'AUTO_REPLY_ENABLED', value: 'true', description: 'Resposta automática fora do horário', type: 'BOOLEAN' },
    { key: 'MAX_WAIT_SECONDS', value: '30', description: 'Tempo máximo de espera (segundos)', type: 'NUMBER' },
  ];

  for (const v of variaveis) {
    await prisma.botVariable.upsert({
      where: { botId_key: { botId: bot.id, key: v.key } },
      update: {},
      create: { botId: bot.id, ...v }
    });
  }
  console.log(`✅ ${variaveis.length} variáveis do bot criadas`);

  // ─── 5. Criar Fases do Kanban (CRM) ─────────────
  const fases = [
    { id: 'stage-novo', name: 'Novo', order: 1, color: '#3b82f6' },
    { id: 'stage-atendimento', name: 'Em Atendimento', order: 2, color: '#a855f7' },
    { id: 'stage-agendado', name: 'Agendado', order: 3, color: '#f59e0b' },
    { id: 'stage-fechado', name: 'Fechado / Ganho', order: 4, color: '#10b981' },
    { id: 'stage-perdido', name: 'Perdido', order: 5, color: '#ef4444' },
  ];

  for (const fase of fases) {
    await prisma.leadStage.upsert({
      where: { id: fase.id },
      update: {},
      create: { ...fase, clientId: cliente.id }
    });
  }
  console.log(`✅ ${fases.length} fases do CRM criadas`);

  // ─── 6. Criar Leads de Exemplo ───────────────────
  const leads = [
    { name: 'Maria Silva', phone: '11988776655', email: 'maria@email.com', stageId: 'stage-novo', value: 350 },
    { name: 'João Santos', phone: '11977665544', email: 'joao@email.com', stageId: 'stage-atendimento', value: 500 },
    { name: 'Ana Costa', phone: '11966554433', stageId: 'stage-agendado', value: 750 },
    { name: 'Carlos Lima', phone: '11955443322', stageId: 'stage-novo', value: 200 },
    { name: 'Fernanda Oliveira', phone: '11944332211', email: 'fer@email.com', stageId: 'stage-fechado', value: 1200 },
    { name: 'Pedro Rocha', phone: '11933221100', stageId: 'stage-perdido', value: 400 },
  ];

  for (const lead of leads) {
    await prisma.lead.create({
      data: { clientId: cliente.id, ...lead }
    });
  }
  console.log(`✅ ${leads.length} leads de exemplo criados`);

  // ─── 7. Criar Fluxo de Exemplo ───────────────────
  const fluxo = await prisma.flow.upsert({
    where: { id: 'seed-flow-01' },
    update: {},
    create: {
      id: 'seed-flow-01',
      botId: bot.id,
      name: 'Fluxo de Agendamento',
      isActive: true,
      triggerType: 'DEFAULT'
    }
  });

  // Nós do fluxo
  await prisma.node.createMany({
    data: [
      { id: 'node-start', flowId: fluxo.id, type: 'MESSAGE', positionX: 250, positionY: 50, data: { text: 'Olá! Gostaria de agendar uma consulta?' } },
      { id: 'node-pergunta', flowId: fluxo.id, type: 'QUESTION', positionX: 250, positionY: 200, data: { text: 'Qual o melhor dia para você?' } },
      { id: 'node-confirma', flowId: fluxo.id, type: 'MESSAGE', positionX: 250, positionY: 350, data: { text: 'Perfeito! Agendamento confirmado. ✅' } },
    ],
    skipDuplicates: true
  });

  await prisma.edge.createMany({
    data: [
      { id: 'edge-1', flowId: fluxo.id, sourceNodeId: 'node-start', targetNodeId: 'node-pergunta' },
      { id: 'edge-2', flowId: fluxo.id, sourceNodeId: 'node-pergunta', targetNodeId: 'node-confirma' },
    ],
    skipDuplicates: true
  });
  console.log(`✅ Fluxo "${fluxo.name}" criado com 3 nós e 2 conexões`);
  
  // ─── 8. Criar Agendamentos de Exemplo ─────────────
  const hoje = new Date();
  hoje.setHours(10, 0, 0, 0); // Hoje às 10h

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(14, 30, 0, 0); // Amanhã às 14:30

  // Pega um lead qualquer para associar
  const umLead = await prisma.lead.findFirst();

  await prisma.appointment.createMany({
    data: [
      {
        clientId: cliente.id,
        leadId: umLead?.id,
        customerName: 'Maria Silva',
        customerPhone: '11988776655',
        service: 'Consulta Odontológica',
        date: hoje,
        duration: 60,
        price: 250,
        status: 'CONFIRMED'
      },
      {
        clientId: cliente.id,
        customerName: 'Cliente Avulso',
        customerPhone: '11900000000',
        service: 'Limpeza',
        date: amanha,
        duration: 30,
        price: 150,
        status: 'PENDING'
      }
    ]
  });
  console.log('✅ Agendamentos de exemplo criados');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('────────────────────────────────────');
  console.log('Login: admin@botmanager.com');
  console.log('Senha: admin123');
  console.log('────────────────────────────────────\n');
}

main()
  .catch(e => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
