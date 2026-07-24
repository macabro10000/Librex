const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Memoria de la flota en tiempo real
const activeDrivers = new Map();
const activeRides = [];

// Panel de control web profesional para la plataforma Librex
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Fleet Control Center</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; margin: 0; }
                .container { max-width: 800px; margin: 0 auto; }
                .card { background: #1e293b; padding: 20px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin-bottom: 20px; border: 1px solid #334155; }
                h1 { color: #38bdf8; font-size: 24px; margin-top: 0; }
                h2 { color: #facc15; font-size: 18px; }
                .status-badge { background: #22c55e; color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
                ul { padding-left: 20px; color: #94a3b8; }
                li { margin-bottom: 8px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>Librex Fleet Gateway <span class="status-badge">ONLINE</span></h1>
                    <p>Servidor central de transporte en tiempo real operando correctamente.</p>
                    <p><b>Estado del Sistema:</b> WebSockets activos y listos para recibir conductores y pasajeros.</p>
                </div>
                <div class="card">
                    <h2>Panel de Operaciones en Vivo</h2>
                    <p>Conductores conectados en este momento: <b id="driver-count">0</b></p>
                    <p>Solicitudes de viajes activas: <b id="ride-count">0</b></p>
                </div>
            </div>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                socket.on('map:broadcast_drivers', (drivers) => {
                    document.getElementById('driver-count').innerText = drivers.length;
                });
            </script>
        </body>
        </html>
    `);
});

// GESTIÓN DE WEBSOCKETS PARA LA RED DE CARROS Y CLIENTES
io.on('connection', (socket) => {
    console.log(`[SOCKET] Conexión establecida con la app: ${socket.id}`);

    // El conductor actualiza su posición GPS
    socket.on('driver:update_location', (data) => {
        const { driverId, lat, lng, status } = data;
        activeDrivers.set(driverId, { socketId: socket.id, lat, lng, status, time: Date.now() });
        io.emit('map:broadcast_drivers', Array.from(activeDrivers.entries()));
    });

    // El cliente solicita un servicio de transporte
    socket.on('client:request_ride', (rideData) => {
        activeRides.push(rideData);
        console.log('[RIDE] Nueva solicitud de viaje:', rideData);
        io.emit('driver:new_ride_available', rideData);
    });

    socket.on('disconnect', () => {
        for (let [driverId, info] of activeDrivers.entries()) {
            if (info.socketId === socket.id) {
                activeDrivers.delete(driverId);
                break;
            }
        }
        io.emit('map:broadcast_drivers', Array.from(activeDrivers.entries()));
        console.log(`[SOCKET] Dispositivo desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Servidor Librex corriendo en puerto ${PORT}`);
});
