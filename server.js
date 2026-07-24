const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

const conductoresActivos = new Map();

async function iniciarWhatsAppRealTime() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_wa_rt');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) iniciarWhatsAppRealTime();
        } else if (connection === 'open') {
            console.log('--- SERVIDOR WHATSAPP EN TIEMPO REAL CONECTADO ---');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const remitente = m.key.remoteJid;
        const ubicacion = m.message.locationMessage;

        if (ubicacion) {
            const lat = ubicacion.degreesLatitude;
            const lng = ubicacion.degreesLongitude;

            console.log(`[GPS EN TIEMPO REAL] Ubicación recibida: ${lat}, ${lng}`);
            io.emit('nuevo_pasajero', { remitente, lat, lng });

            await sock.sendMessage(remitente, { 
                text: '📍 Ubicación procesada en tiempo real. Conectando con el mapa...' 
            });
        }
    });
}

io.on('connection', (socket) => {
    console.log(`[CLIENTE CONECTADO AL MAPA]: ${socket.id}`);

    socket.on('actualizar_posicion_conductor', (data) => {
        const { idConductor, lat, lng } = data;
        conductoresActivos.set(idConductor, { lat, lng, ultimoPulso: Date.now() });
        io.emit('mover_conductor', { idConductor, lat, lng });
    });

    socket.on('disconnect', () => {
        console.log(`[CLIENTE DESCONECTADO]: ${socket.id}`);
    });
});

app.get('/', (req, res) => {
    res.send('Servidor Alfa Omega de Mapas Propios y WhatsApp Operativo.');
});

server.listen(PORT, () => {
    console.log(`Servidor maestro corriendo en el puerto ${PORT}`);
    iniciarWhatsAppRealTime();
});
