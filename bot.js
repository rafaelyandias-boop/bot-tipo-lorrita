require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client({ 
  intents: ['Guilds', 'GuildMessages', 'MessageContent'] 
});

// BANCOS DE DADOS
const tokens = new Map();
const codigos = new Map();

const TOKEN_BOT = process.env.TOKEN_BOT;

client.on('ready', () => {
  console.log('✅ Bot online como ' + client.user.tag);
});

client.on('messageCreate', message => {
  if (message.author.bot) return;
  
  if (message.content.startsWith('/verificar ')) {
    const token = message.content.split(' ')[1];
    
    if (!token) {
      return message.reply('❌ Use: `/verificar SEU_TOKEN`');
    }
    
    let encontrado = false;
    for (let [userId, data] of tokens) {
      if (data.token === token && !data.verified) {
        data.verified = true;
        data.discordId = message.author.id;
        tokens.set(userId, data);
        encontrado = true;
        
        message.reply('✅ **VERIFICADO!** Volte pro jogo!');
        console.log(`✅ Player ${userId} verificado`);
        break;
      }
    }
    
    if (!encontrado) {
      message.reply('❌ Token inválido ou já usado!');
    }
  }
  
  if (message.content.startsWith('/gerar ')) {
    const args = message.content.split(' ');
    const tipo = args[1]?.toLowerCase();
    
    if (!tipo) {
      return message.reply('❌ Use: `/gerar [diamantes/dinheiro/xp]`');
    }
    
    const recompensas = {
      'diamantes': { valor: 100, nome: 'Diamantes' },
      'dinheiro': { valor: 5000, nome: 'Dinheiro' },
      'xp': { valor: 1000, nome: 'XP' },
      'daily': { valor: 500, nome: 'Daily Reward' }
    };
    
    if (!recompensas[tipo]) {
      return message.reply('❌ Tipo inválido! Use: `diamantes`, `dinheiro`, `xp` ou `daily`');
    }
    
    const codigo = Math.random().toString(36).substring(2, 10).toUpperCase();
    const recompensa = recompensas[tipo];
    
    codigos.set(codigo, {
      tipo: tipo,
      valor: recompensa.valor,
      nome: recompensa.nome,
      usado: false,
      criadoPor: message.author.id,
      criadoEm: Date.now()
    });
    
    const embed = new Discord.EmbedBuilder()
      .setTitle('🎁 Código Gerado!')
      .setColor('#57F287')
      .addFields(
        { name: '📋 Código', value: `\`${codigo}\``, inline: true },
        { name: '🎁 Recompensa', value: `${recompensa.valor} ${recompensa.nome}`, inline: true }
      )
      .setFooter({ text: 'Resgate no jogo!' });
    
    message.reply({ embeds: [embed] });
    console.log(`🎁 Código gerado: ${codigo} (${recompensa.nome})`);
  }
  
  if (message.content === '/codes') {
    let lista = '📋 **CÓDIGOS DISPONÍVEIS:**\n\n';
    let count = 0;
    
    for (let [codigo, data] of codigos) {
      if (!data.usado) {
        lista += `🎁 \`${codigo}\` - ${data.valor} ${data.nome}\n`;
        count++;
      }
    }
    
    if (count === 0) {
      lista = '❌ Nenhum código disponível no momento!';
    }
    
    message.reply(lista);
  }
});

const express = require('express');
const app = express();
app.use(express.json());

app.post('/gerarToken', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.json({ success: false, error: 'userId necessário' });
  }
  
  const token = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  tokens.set(userId, {
    token: token,
    verified: false,
    createdAt: Date.now()
  });
  
  console.log(`🔑 Token gerado: ${token}`);
  res.json({ success: true, token: token });
});

app.post('/verificarStatus', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.json({ success: false, verified: false });
  }
  
  const data = tokens.get(userId);
  res.json({ success: true, verified: data?.verified || false });
});

app.post('/resgatarCodigo', (req, res) => {
  const { codigo, userId } = req.body;
  
  if (!codigo || !userId) {
    return res.json({ success: false, error: 'Parâmetros inválidos' });
  }
  
  const codigoData = codigos.get(codigo.toUpperCase());
  
  if (!codigoData) {
    return res.json({ success: false, error: 'Código inválido!' });
  }
  
  if (codigoData.usado) {
    return res.json({ success: false, error: 'Código já usado!' });
  }
  
  codigoData.usado = true;
  codigoData.usadoPor = userId;
  codigoData.usadoEm = Date.now();
  codigos.set(codigo.toUpperCase(), codigoData);
  
  console.log(`✅ Código ${codigo} resgatado por ${userId}`);
  
  res.json({ 
    success: true, 
    tipo: codigoData.tipo,
    valor: codigoData.valor,
    nome: codigoData.nome
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});

client.login(TOKEN_BOT);
