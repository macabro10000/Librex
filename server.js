const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let latestQR = '';
let connectionStatus = 'Desconectado';

// Ruta web para ver el QR directamente en la página
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Librex - Vinculación WhatsApp</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; background: #f4f4f9; padding: 20px; }
                    .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); display: inline-block; margin-top: 20px; }
                    h2 { color: #333; }
                    p { font-size: 18px; color: #666; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Vinculación de WhatsApp - Librex</h2>
                    <p>Estado: <b>${connectionStatus}</b></p>
                    ${latestQR ? `<img src="${latestQR}" alt="Código QR de WhatsApp" style="max-width:300px;"/>` : `<p>Cargando QR o ya estás conectado. Actualiza la página si tardas.</p>`}
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
            connectionStatus = 'Esperando escaneo de QR';
            // Convierte el código QR en una imagen bonita para la web
            latestQR = await qrcode.toDataURL(qr);
            console.log('Nuevo QR generado. Visita la web para escanearlo.');
        }

        if (connection === 'close') {
            connectionStatus = 'Conexión cerrada';
            latestQR = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            connectionStatus = '¡Conectado con éxito a WhatsApp!';
            latestQR = '';
            console.log('¡WhatsApp conectado con éxito!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        console.log('Nuevo mensaje recibido:', JSON.stringify(m, undefined, 2));
    });
}

connectToWhatsApp();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
