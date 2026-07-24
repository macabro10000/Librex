const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Memoria en tiempo real para la flota y los pedidos
const activeDrivers = new Map();
const recentRides = [];

// Panel web principal de Librex Fleet Gateway
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Fleet Gateway Pro</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
                .container { max-width: 700px; margin: 0 auto; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin-bottom: 20px; border: 1px solid #334155; }
                h1 { color: #38bdf8; font-size: 22px; margin-top: 0; }
                p { color: #94a3b8; font-size: 15px; }
                .badge { background: #22c55e; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; }
                .btn-whatsapp { display: block; background: #25d366; color: white; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 15px; }
                .stat-box { display: flex; justify-content: space-between; background: #0f172a; padding: 12px; border-radius: 8px; margin-top: 10px; border: 1px solid #334155; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>Librex Fleet Gateway <span class="badge">SISTEMA ESTABLE</span></h1>
                    <p>Servidor central operando al 100% sin interrupciones ni bloqueos de red.</p>
                    <a href="https://wa.me/?text=Hola%20Librex,%20necesito%20un%20carro%20a%20mi%20ubicación" target="_blank" class="btn-whatsapp">📲 Pedir Carro Directo por WhatsApp</a>
                </div>
                <div class="card">
                    <h1>Centro de Operaciones en Vivo</h1>
                    <div class="stat-box">
                        <span>Conductores Conectados:</span>
                        <b id="driver-count" style="color:#38bdf8;">0</b>
                    </div>
                    <div class="stat-box">
                        <span>Solicitudes Activas:</span>
                        <b id="ride-count" style="color:#facc15;">0</b>
                    </div>
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

// Gestión de conexiones de la flota por WebSockets
io.on('connection', (socket) => {
    console.log(`[SOCKET] Conectado: ${socket.id}`);

    socket.on('driver:update_location', (data) => {
        activeDrivers.set(data.driverId, { socketId: socket.id, ...data, time: Date.now() });
        io.emit('map:broadcast_drivers', Array.from(activeDrivers.entries()));
    });

    socket.on('disconnect', () => {
        for (let [driverId, info] of activeDrivers.entries()) {
            if (info.socketId === socket.id) {
                activeDrivers.delete(driverId);
                break;
            }
        }
        io.emit('map:broadcast_drivers', Array.from(activeDrivers.entries()));
        console.log(`[SOCKET] Desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Operando con éxito en el puerto ${PORT}`);
});
