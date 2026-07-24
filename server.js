const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let connectionStatus = 'Iniciando sistema...';
let pairingCodeDisplay = '';

// Interfaz web profesional para ver el estado y el código de vinculación
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Fleet Gateway</title>
            <meta http-equiv="refresh" content="6">
            <style>
                body { font-family: sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 30px; margin: 0; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: inline-block; max-width: 400px; width: 100%; border: 1px solid #334155; }
                h2 { color: #38bdf8; margin-top: 0; }
                p { font-size: 15px; color: #94a3b8; }
                .status { font-weight: bold; color: #facc15; }
                .code-box { background: #0f172a; color: #38bdf8; font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px dashed #38bdf8; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Librex Fleet Gateway</h2>
                <p>Estado: <span class="status">${connectionStatus}</span></p>
                ${pairingCodeDisplay ? `
                    <p>Tu código de vinculación:</p>
                    <div class="code-box">${pairingCodeDisplay}</div>
                    <p style="font-size:12px; margin-top:12px;">Ingresa este código en tu WhatsApp > Dispositivos vinculados > Vincular con número de teléfono.</p>
                ` : `<p>Configurando enlace seguro, actualizando...</p>`}
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

    // Si no está registrado, pedimos el código por consola (puedes poner tu número aquí o ver los logs en Render)
    if (!sock.authState.creds.registered) {
        // AQUÍ PUEDES PONER TU NÚMERO CON CÓDIGO DE PAÍS (Ej: 573001234567) si prefieres hardcodearlo temporalmente, 
        // o usar el método automático por logs de Render.
        const phoneNumber = "573000000000"; // Reemplázalo con tu número real si deseas, o déjalo para generarlo en logs.
        
        setTimeout(async () => {
            try {
                // Forzar código de emparejamiento si deseas
                console.log("[PAIRING] Solicitando código de emparejamiento...");
            } catch (err) {
                console.log("[PAIRING ERROR]", err);
            }
        }, 5000);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'close') {
            connectionStatus = 'Conexión cerrada, reconectando...';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            }
        } else if (connection === 'open') {
            connectionStatus = '¡Conectado y Operativo con WhatsApp!';
            pairingCodeDisplay = 'CONECTADO';
            console.log('[WHATSAPP] ¡Conexión establecida con éxito!');
        }
    });
}

connectToWhatsApp();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Servidor corriendo en puerto ${PORT}`);
});
