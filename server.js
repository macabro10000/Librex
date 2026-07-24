const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let whatsappStatus = 'Iniciando conexión de WhatsApp...';
const activeDrivers = new Map();
const clientRides = [];

// Panel de control web de Librex
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - WhatsApp Fleet Gateway</title>
            <meta http-equiv="refresh" content="7">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; margin: 0; text-align: center; }
                .container { max-width: 600px; margin: 0 auto; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin-bottom: 20px; border: 1px solid #334155; text-align: left; }
                h1 { color: #38bdf8; font-size: 22px; margin-top: 0; }
                p { color: #94a3b8; font-size: 15px; }
                .status { font-weight: bold; color: #facc15; }
                .badge { background: #22c55e; color: white; padding: 3px 8px; border-radius: 10px; font-size: 11px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>Librex Gateway <span class="badge">ACTIVO</span></h1>
                    <p>Estado de WhatsApp: <span class="status">${whatsappStatus}</span></p>
                    <p style="font-size: 13px;">Si pide vincular, revisa los registros (logs) en Render para ver el código o estado de sesión.</p>
                </div>
                <div class="card">
                    <h1>Panel de Viajes por WhatsApp</h1>
                    <p>Viajes solicitados por chat: <b>${clientRides.length}</b></p>
                    ${clientRides.slice(-5).map(r => `<p style="background:#0f172a; padding:10px; border-radius:6px; font-size:13px;">📱 <b>${r.sender}:</b> ${r.message}</p>`).join('')}
                </div>
            </div>
        </body>
        </html>
    `);
});

// Inicialización del bot de WhatsApp para recibir pedidos
async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true // Imprime el QR en los logs de Render para que lo veas si es necesario
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            whatsappStatus = 'Conexión cerrada, reconectando...';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(startWhatsAppBot, 5000);
            }
        } else if (connection === 'open') {
            whatsappStatus = '¡Conectado y recibiendo pedidos de clientes!';
            console.log('[WHATSAPP] ¡Conectado con éxito a WhatsApp!');
        }
    });

    // ESCUCHA DE MENSAJES DE LOS CLIENTES (Aquí entra el pedido del carro)
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderID = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (messageText) {
            console.log(`[WHATSAPP PEDIDO] De ${senderID}: ${messageText}`);
            
            // Guardamos el viaje en la memoria del servidor
            clientRides.push({ sender: senderID, message: messageText, time: new Date().toLocaleTimeString() });

            // Respuesta automática opcional al cliente
            await sock.sendMessage(senderID, { 
                text: '🚗 ¡Hola! Bienvenido a Librex. Hemos recibido tu solicitud de transporte. Buscando conductor cercano...' 
            });
        }
    });
}

startWhatsAppBot();

// WebSockets para la app y conductores
io.on('connection', (socket) => {
    socket.on('driver:update_location', (data) => {
        activeDrivers.set(data.driverId, data);
        io.emit('map:broadcast_drivers', Array.from(activeDrivers.entries()));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Servidor Librex operativo en puerto ${PORT}`);
});
