const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenAI } = require('@google/genai');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa a API do Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Você é o assistente virtual oficial do Kriptum. 
Seu tom de voz deve ser direto, profissional, moderno e focado em ajudar criadores de conteúdo e profissionais de mídia social. 
Responda de forma objetiva e use emojis com moderação.`;

// Configura o cliente do WhatsApp com os parâmetros para rodar liso no Render
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Evento que gera o QR Code em texto nos Logs
client.on('qr', (qr) => {
    console.log('--- COPIE OU TIRE PRINT DO QR CODE ABAIXO ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot conectado com sucesso ao WhatsApp!');
});

// Escuta as mensagens recebidas
client.on('message', async (msg) => {
    // Ignora mensagens de grupos ou enviadas por você mesmo
    if (msg.from.includes('@g.us') || msg.fromMe) return;

    console.log(`Mensagem recebida: ${msg.body}`);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: msg.body,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION
            }
        });

        // Responde direto no chat do usuário
        await msg.reply(response.text);
    } catch (error) {
        console.error('Erro ao processar com o Gemini:', error);
    }
});

client.initialize();

app.get('/', (req, res) => {
    res.send('Bot do Kriptum rodando ativamente!');
});

app.listen(PORT, () => {
    console.log(`Servidor web ativo na porta ${PORT}`);
});
