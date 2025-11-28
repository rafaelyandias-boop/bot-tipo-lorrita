// bot.js
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// Configurações dos servidores (em produção use database)
const serverConfigs = new Map();

// Função para criar imagem de boas-vindas
async function createWelcomeImage(member) {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    // Gradiente de fundo
    const gradient = ctx.createLinearGradient(0, 0, 800, 300);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 300);

    // Texto de boas-vindas
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BEM-VINDO(A)!', 400, 80);

    // Nome do usuário
    ctx.font = 'bold 35px Arial';
    ctx.fillText(member.user.username, 400, 140);

    // Texto adicional
    ctx.font = '25px Arial';
    ctx.fillText(`Você é o membro #${member.guild.memberCount}!`, 400, 190);

    // Avatar do usuário
    try {
        const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(400, 240, 40, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 360, 200, 80, 80);
        ctx.restore();
    } catch (error) {
        console.error('Erro ao carregar avatar:', error);
    }

    return canvas.toBuffer('image/png');
}

// Evento: Bot pronto
client.once('ready', () => {
    console.log(`✅ Bot online como ${client.user.tag}!`);
    client.user.setActivity('Moderando o servidor', { type: 3 });
});

// Evento: Membro entra no servidor
client.on('guildMemberAdd', async (member) => {
    const config = serverConfigs.get(member.guild.id) || {};
    const welcomeChannelId = config.welcomeChannel;

    if (!welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (!channel) return;

    try {
        // Cria a imagem de boas-vindas
        const image = await createWelcomeImage(member);
        const attachment = new AttachmentBuilder(image, { name: 'welcome.png' });

        const embed = new EmbedBuilder()
            .setColor('#667eea')
            .setTitle('🎉 Novo Membro!')
            .setDescription(`Bem-vindo(a) ao servidor, ${member}!\n\nDivirta-se e respeite as regras!`)
            .setImage('attachment://welcome.png')
            .setTimestamp()
            .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() });

        await channel.send({ embeds: [embed], files: [attachment] });
    } catch (error) {
        console.error('Erro ao enviar boas-vindas:', error);
    }
});

// Evento: Membro sai do servidor
client.on('guildMemberRemove', async (member) => {
    const config = serverConfigs.get(member.guild.id) || {};
    const leaveChannelId = config.leaveChannel;

    if (!leaveChannelId) return;

    const channel = member.guild.channels.cache.get(leaveChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor('#ff4757')
        .setTitle('👋 Membro Saiu')
        .setDescription(`**${member.user.tag}** saiu do servidor.\n\nAgora temos ${member.guild.memberCount} membros.`)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() });

    await channel.send({ embeds: [embed] });
});

// Evento: Interação de comandos
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, member, guild } = interaction;

    // Comando: /configurar
    if (commandName === 'configurar') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Você precisa ser administrador para usar este comando!', ephemeral: true });
        }

        const type = options.getString('tipo');
        const channel = options.getChannel('canal');

        const config = serverConfigs.get(guild.id) || {};

        if (type === 'entrada') {
            config.welcomeChannel = channel.id;
            serverConfigs.set(guild.id, config);
            return interaction.reply({ content: `✅ Canal de boas-vindas configurado para ${channel}!`, ephemeral: true });
        } else if (type === 'saida') {
            config.leaveChannel = channel.id;
            serverConfigs.set(guild.id, config);
            return interaction.reply({ content: `✅ Canal de despedida configurado para ${channel}!`, ephemeral: true });
        } else if (type === 'logs') {
            config.logsChannel = channel.id;
            serverConfigs.set(guild.id, config);
            return interaction.reply({ content: `✅ Canal de logs configurado para ${channel}!`, ephemeral: true });
        }
    }

    // Comando: /ban
    if (commandName === 'ban') {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: '❌ Você não tem permissão para banir membros!', ephemeral: true });
        }

        const target = options.getUser('usuario');
        const reason = options.getString('motivo') || 'Sem motivo especificado';

        try {
            await guild.members.ban(target, { reason });

            const embed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('🔨 Membro Banido')
                .setDescription(`**${target.tag}** foi banido do servidor!`)
                .addFields(
                    { name: '📋 Motivo', value: reason },
                    { name: '👮 Moderador', value: member.user.tag }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await sendLog(guild, embed);
        } catch (error) {
            await interaction.reply({ content: '❌ Erro ao banir o usuário!', ephemeral: true });
        }
    }

    // Comando: /kick
    if (commandName === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({ content: '❌ Você não tem permissão para expulsar membros!', ephemeral: true });
        }

        const target = options.getMember('usuario');
        const reason = options.getString('motivo') || 'Sem motivo especificado';

        try {
            await target.kick(reason);

            const embed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle('👢 Membro Expulso')
                .setDescription(`**${target.user.tag}** foi expulso do servidor!`)
                .addFields(
                    { name: '📋 Motivo', value: reason },
                    { name: '👮 Moderador', value: member.user.tag }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await sendLog(guild, embed);
        } catch (error) {
            await interaction.reply({ content: '❌ Erro ao expulsar o usuário!', ephemeral: true });
        }
    }

    // Comando: /timeout
    if (commandName === 'timeout') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: '❌ Você não tem permissão para silenciar membros!', ephemeral: true });
        }

        const target = options.getMember('usuario');
        const duration = options.getInteger('duracao');
        const reason = options.getString('motivo') || 'Sem motivo especificado';

        try {
            await target.timeout(duration * 60 * 1000, reason);

            const embed = new EmbedBuilder()
                .setColor('#ff6348')
                .setTitle('🔇 Membro Silenciado')
                .setDescription(`**${target.user.tag}** foi silenciado!`)
                .addFields(
                    { name: '⏱️ Duração', value: `${duration} minutos` },
                    { name: '📋 Motivo', value: reason },
                    { name: '👮 Moderador', value: member.user.tag }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await sendLog(guild, embed);
        } catch (error) {
            await interaction.reply({ content: '❌ Erro ao silenciar o usuário!', ephemeral: true });
        }
    }

    // Comando: /clear
    if (commandName === 'clear') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ Você não tem permissão para deletar mensagens!', ephemeral: true });
        }

        const amount = options.getInteger('quantidade');

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);

            const embed = new EmbedBuilder()
                .setColor('#5f27cd')
                .setTitle('🗑️ Mensagens Deletadas')
                .setDescription(`**${deleted.size}** mensagens foram deletadas!`)
                .addFields({ name: '👮 Moderador', value: member.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            await sendLog(guild, embed);
        } catch (error) {
            await interaction.reply({ content: '❌ Erro ao deletar mensagens!', ephemeral: true });
        }
    }

    // Comando: /avisar
    if (commandName === 'avisar') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: '❌ Você não tem permissão para avisar membros!', ephemeral: true });
        }

        const target = options.getMember('usuario');
        const reason = options.getString('motivo');

        const embed = new EmbedBuilder()
            .setColor('#feca57')
            .setTitle('⚠️ Aviso')
            .setDescription(`**${target.user.tag}** recebeu um aviso!`)
            .addFields(
                { name: '📋 Motivo', value: reason },
                { name: '👮 Moderador', value: member.user.tag }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        await sendLog(guild, embed);

        try {
            await target.send({ content: `⚠️ Você recebeu um aviso em **${guild.name}**\n**Motivo:** ${reason}` });
        } catch (error) {
            console.log('Não foi possível enviar DM ao usuário');
        }
    }
});

// Função para enviar logs
async function sendLog(guild, embed) {
    const config = serverConfigs.get(guild.id) || {};
    const logsChannelId = config.logsChannel;

    if (!logsChannelId) return;

    const channel = guild.channels.cache.get(logsChannelId);
    if (channel) {
        await channel.send({ embeds: [embed] });
    }
}

// Login com TOKEN_BOT
client.login(process.env.TOKEN_BOT);
