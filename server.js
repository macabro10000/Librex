const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir archivos estáticos (por si montas una interfaz web básica)
app.use(express.static('public'));

let latestQR = '';
let connectionStatus = 'Desconectado';

// Estructura de memoria en tiempo real para la plataforma de transporte
const activeDrivers = new Map(); // Conductores conectados y sus coordenadas
const activeClients = new Map(); // Clientes activos buscando servicio

// Ruta web profesional para la vinculación inicial del administrador vía QR
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Panel de Control & WhatsApp Gateway</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 40px; margin: 0; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: inline-block; max-width: 400px; width: 100%; border: 1px solid #334155; }
                h2 { color: #38bdf8; margin-top: 0; }
                p { font-size: 16px; color: #94a3b8; }
                .status { font-weight: bold; color: #facc15; }
                .qr-container { background: white; padding: 15px; border-radius: 8px; display: inline-block; margin-top: 15px; }
                img { width: 250px; height: 250px; display: block; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Librex Fleet Gateway</h2>
                <p>Estado de WhatsApp: <span class="status">${connectionStatus}</span></p>
                ${latestQR ? `
                    <div class="qr-container">
                        <img src="${latestQR}" alt="Escanea este QR con WhatsApp"/>
                    </div>
                    <p style="font-size:13px; margin-top:15px;">Abre WhatsApp en tu teléfono > Dispositivos vinculados > Vincular dispositivo.</p>
                ` : `<p>Sistema operativo o esperando recarga de sesión. Si ya conectaste, todo marcha en orden.</p>`}
            </div>
        </body>
        </html>
    `);
});

// Inicialización robusta del cliente de WhatsApp (Baileys)
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
            latestQR = await qrcode.toDataURL(qr);
            console.log('[WHATSAPP] Nuevo código QR generado. Disponible en la raíz web del servidor.');
        }

        if (connection === 'close') {
            connectionStatus = 'Conexión cerrada';
            latestQR = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[WHATSAPP] Conexión cerrada. ¿Reconectando?:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            connectionStatus = '¡Conectado y Operativo!';
            latestQR = '';
            console.log('[WHATSAPP] ¡Conexión establecida con éxito!');
        }
    });

    // Receptor de mensajes de WhatsApp (Atención a comandos de clientes/conductores)
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderID = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        console.log(`[WHATSAPP MESSAGE] De: ${senderID} | Texto: ${messageText}`);
        
        // Aquí puedes inyectar lógica de respuestas automáticas para pedidos de transporte si el usuario escribe por chat
    });
}

// Inicializar motor de WhatsApp en segundo plano
connectToWhatsApp();

// ---------------------------------------------------------
// GESTIÓN DE WEBSOCKETS (TIEMPO REAL PARA APP MÓVIL / MAPA)
// ---------------------------------------------------------
io.on('connection', (socket) => {
    console.log(`[SOCKET] Nuevo cliente conectado a la red: ${socket.id}`);

    // Evento: Conductor reporta su posición GPS en tiempo real
    socket.on('driver:update_location', (data) => {
        const { driverId, lat, lng, status } = data;
        activeDrivers.set(driverId, { socketId: socket.id, lat, lng, status, updatedAt: Date.now() });
        
        // Reenviar la ubicación de inmediato a todos los clientes y administradores conectados al mapa
        io.emit('map:broadcast_drivers', Array.from(activeDrivers.entries()));
    });

    // Evento: Cliente solicita un carro / servicio de transporte
    socket.on('client:request_ride', (rideData) => {
        console.log('[RIDE] Nueva solicitud de transporte recibida:', rideData);
        // Notificar a los conductores cercanos mediante WebSockets
        io.emit('driver:new_ride_available', rideData);
    });

    // Manejo de desconexión de usuarios en la red
    socket.on('disconnect', () => {
        console.log(`[SOCKET] Usuario desconectado: ${socket.id}`);
        // Limpiar de la lista de activos si era conductor
        for (let [driverId, info] of activeDrivers.entries()) {
            if (info.socketId === socket.id) {
                activeDrivers.delete(driverId);
                console.log(`[DRIVER] Conductor ${driverId} desconectado de la red.`);
                break;
            }
        }
        io.emit('map:broadcast_drivers', Array.from(activeDrivers.entries()));
    });
});

// Puerto de escucha asignado por el entorno de Render o por defecto 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Servidor profesional de transporte ejecutándose en el puerto ${PORT}`);
});
