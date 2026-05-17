const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { GoogleGenAI } = require('@google/genai');
const qrcode = require('qrcode-terminal');
const express = require('express');

// Configuração do Express para o Render manter o app online
const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa a API do Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Instruções de comportamento do Bot (Personalidade)
const SYSTEM_INSTRUCTION = `Você é o assistente virtual oficial do Kriptum. 
Seu tom de voz deve ser direto, profissional, moderno e focado em ajudar criadores de conteúdo e profissionais de mídia social. 
Responda de forma objetiva e use emojis com moderação.`;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            // Desenha o QR Code no log do Render para você escanear
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ? 
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            console.log('Conexão fechada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Bot conectado com sucesso ao WhatsApp!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const userMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!userMessage) return;

        console.log(`Mensagem recebida: ${userMessage}`);

        try {
            // Envia a mensagem para o Gemini 1.5 Flash
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: userMessage,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION
                }
            });

            const botResponse = response.text;

            // Envia a resposta de volta no WhatsApp
            await sock.sendMessage(remoteJid, { text: botResponse });
            
        } catch (error) {
            console.error('Erro ao processar com o Gemini:', error);
        }
    });
}

// Rota padrão exigida pelo Render
app.get('/', (req, res) => {
    res.send('Bot do Kriptum rodando ativamente!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    connectToWhatsApp();
});
