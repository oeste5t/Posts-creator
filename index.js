const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { GoogleGenAI } = require('@google/genai');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Você é o assistente virtual oficial do Kriptum. 
Seu tom de voz deve ser direto, profissional, moderno e focado em ajudar criadores de conteúdo e profissionais de mídia social.`;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // Desliga o gerador padrão que quebra as linhas
        defaultQueryTimeoutMs: undefined,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n=============================================');
            console.log('--- NOVO QR CODE GERADO! ---');
            console.log('Para visualizar o QR Code perfeitamente no celular,');
            console.log('acesse o link abaixo no seu navegador:');
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            console.log('=============================================\n');
        }
        
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => connectToWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log('=============================================');
            console.log('BOT DO KRIPTUM CONECTADO COM SUCESSO NO WHATSAPP!');
            console.log('=============================================');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        if (remoteJid.endsWith('@g.us')) return;

        const userMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!userMessage) return;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: userMessage,
                config: { systemInstruction: SYSTEM_INSTRUCTION }
            });
            await sock.sendMessage(remoteJid, { text: response.text });
        } catch (error) {
            console.error('Erro na API do Gemini:', error);
        }
    });
}

app.get('/', (req, res) => { res.send('Bot Kriptum ativo!'); });
app.listen(PORT, () => { connectToWhatsApp(); });
