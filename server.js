const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let latestQR = '';
let connectionStatus = 'Iniciando servidor...';

// Página web con autorrecarga para que el QR aparezca solo
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - WhatsApp Gateway</title>
            <meta http-equiv="refresh" content="5">
            <style>
                body { font-family: sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 30px; margin: 0; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: inline-block; max-width: 380px; width: 100%; border: 1px solid #334155; }
                h2 { color: #38bdf8; margin-top: 0; }
                p { font-size: 15px; color: #94a3b8; }
                .status { font-weight: bold; color: #facc15; }
                .qr-box { background: white; padding: 12px; border-radius: 8px; display: inline-block; margin-top: 15px; }
                img { width: 240px; height: 240px; display: block; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Librex Fleet Gateway</h2>
                <p>Estado: <span class="status">${connectionStatus}</span></p>
                ${latestQR ? `
                    <div class="qr-box">
                        <img src="${latestQR}" alt="QR WhatsApp"/>
                    </div>
                    <p style="font-size:12px; margin-top:12px;">Escanea este código con WhatsApp en tu celular.</p>
                ` : `<p>Generando código QR, la página se recargará en unos segundos...</p>`}
            </div>
        </body>
        </html>
    `);
});

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            connectionStatus = '¡QR Listo para escanear!';
            latestQR = await qrcode.toDataURL(qr);
            console.log('[WHATSAPP] Código QR generado y listo en la web.');
        }

        if (connection === 'close') {
            connectionStatus = 'Conexión cerrada, reiniciando...';
            latestQR = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000); // Reconecta automáticamente en 3 segundos
            }
        } else if (connection === 'open') {
            connectionStatus = '¡Conectado y Operativo!';
            latestQR = '';
            console.log('[WHATSAPP] ¡Conectado con éxito!');
        }
    });
}

connectToWhatsApp();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Servidor corriendo en puerto ${PORT}`);
});
