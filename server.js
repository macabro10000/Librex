const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Bases de datos en memoria del servidor ---
const pendingDrivers = new Map(); // Conductores esperando aprobación
const activeDrivers = new Map();  // Conductores aprobados y conectados

// --- Configuración del Sistema ---
const ADMIN_PASSWORD = "librex2026"; 
const COMMISSION_PERCENTAGE = 0.10; // 10%
const MIN_BALANCE_TO_WORK = 0;

// 1. PORTAL DEL CONDUCTOR (Registro + Botón de Acceso Admin)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Registro de Conductor</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
                .container { max-width: 500px; margin: 0 auto; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
                h1 { color: #38bdf8; font-size: 22px; margin-top: 0; text-align: center; }
                label { font-size: 13px; color: #38bdf8; display: block; margin-top: 12px; }
                input, select, button { width: 100%; padding: 12px; margin-top: 5px; border-radius: 8px; border: 1px solid #334155; box-sizing: border-box; font-size: 15px; }
                input, select { background: #0f172a; color: white; }
                button { background: #22c55e; color: white; font-weight: bold; cursor: pointer; border: none; margin-top: 20px; }
                .admin-link { display: block; text-align: center; margin-top: 25px; color: #64748b; font-size: 13px; text-decoration: none; padding: 8px; border: 1px dashed #334155; border-radius: 6px; }
                .admin-link:hover { color: #38bdf8; border-color: #38bdf8; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>Registro de Flota LIBREX</h1>
                    <form action="/register-driver" method="POST">
                        <label>Nombre y Apellido:</label><input type="text" name="name" required>
                        <label>Cédula:</label><input type="text" name="cedula" required>
                        <label>Número Celular (WhatsApp):</label><input type="text" name="phone" required placeholder="+57300...">
                        <label>Tipo de Vehículo:</label><select name="vehicleType"><option value="Particular">Particular</option><option value="Taxi">Taxi</option></select>
                        <label>Marca y Modelo (Ej: Spark Gris):</label><input type="text" name="vehicleModel" required>
                        <label>Placa:</label><input type="text" name="plate" required>
                        <button type="submit">Enviar Registro</button>
                    </form>
                    
                    <!-- Botón de acceso directo para el Administrador -->
                    <a href="/admin?key=librex2026" class="admin-link">🔐 Entrar a la Cuenta de Administrador</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/register-driver', (req, res) => {
    const data = req.body;
    pendingDrivers.set(data.phone, { ...data, status: 'Pendiente', time: new Date().toLocaleString() });
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><title>Registro Exitoso</title></head>
        <body style="font-family:sans-serif; background:#0f172a; color:white; padding:50px; text-align:center;">
            <div style="background:#1e293b; padding:30px; border-radius:12px; max-width:400px; margin:0 auto; border:1px solid #334155;">
                <h2 style="color:#22c55e;">¡Registro Recibido!</h2>
                <p>Tus datos han sido enviados al administrador para su revisión.</p>
                <a href="/" style="color:#38bdf8; text-decoration:none; display:block; margin-top:20px;">Volver</a>
            </div>
        </body>
        </html>
    `);
});

// 2. PANEL DE ADMINISTRACIÓN (Con módulo financiero)
app.get('/admin', (req, res) => {
    if (req.query.key !== ADMIN_PASSWORD) {
        return res.send('<h2 style="font-family:sans-serif; background:#0f172a; color:#ef4444; padding:50px; text-align:center;">Acceso Denegado (Clave incorrecta)</h2>');
    }

    let pendingHTML = '';
    pendingDrivers.forEach((d, phone) => {
        pendingHTML += `
            <div style="background:#0f172a; padding:12px; margin-bottom:8px; border-radius:6px; border:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <b>${d.name}</b> (${d.vehicleType})<br>
                    <span style="font-size:12px; color:#94a3b8;">Cédula: ${d.cedula} | Tel: ${d.phone} | Carro: ${d.vehicleModel} [Placa: ${d.plate}]</span>
                </div>
                <form action="/admin/approve" method="POST" style="margin:0;">
                    <input type="hidden" name="phone" value="${phone}">
                    <button type="submit" style="background:#22c55e; color:white; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Aprobar</button>
                </form>
            </div>`;
    });

    let activeHTML = '';
    activeDrivers.forEach((d, phone) => {
        const balanceColor = d.balance > 0 ? '#22c55e' : '#ef4444';
        activeHTML += `
            <div style="background:#0f172a; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between;">
                    <div>
                        <b>${d.name}</b> - ${d.plate} (${d.vehicleType})<br>
                        <span style="font-size:12px; color:#94a3b8;">Tel: ${phone} - Modelo: ${d.vehicleModel}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:16px; font-weight:bold; color:${balanceColor};">$ ${d.balance.toLocaleString()}</span><br>
                        <span style="font-size:11px; color:#94a3b8;">Saldo Disponible</span>
                    </div>
                </div>
                <div style="margin-top:10px;">
                    <form action="/admin/finance/adjust" method="POST" style="display:flex; gap:5px;">
                        <input type="hidden" name="phone" value="${phone}">
                        <input type="number" name="amount" placeholder="Monto (Ej: 50000 o -10000)" style="padding:6px; background:#1e293b; border:1px solid #334155; color:white; border-radius:4px; flex:1;" required>
                        <button type="submit" style="background:#38bdf8; color:#0f172a; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Recargar / Ajustar</button>
                    </form>
                </div>
            </div>`;
    });

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><title>Admin Librex</title></head>
        <body style="font-family:sans-serif; background:#0f172a; color:white; padding:20px;">
            <div style="max-width:700px; margin:0 auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155; margin-bottom:20px;">
                    <div>
                        <h1 style="color:#38bdf8; margin:0; font-size:20px;">Panel de Administración</h1>
                        <p style="color:#94a3b8; margin:5px 0 0 0; font-size:13px;">Control de flota y saldos de Librex.</p>
                    </div>
                    <a href="/" style="background:#334155; color:white; padding:8px 12px; border-radius:6px; text-decoration:none; font-size:13px;">Volver al Registro</a>
                </div>

                <div style="background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155; margin-bottom:20px;">
                    <h2 style="color:#facc15; margin-top:0; font-size:16px;">Solicitudes Pendientes de Aprobación</h2>
                    ${pendingHTML || '<p style="color:#64748b; font-size:14px;">No hay solicitudes pendientes en este momento.</p>'}
                </div>

                <div style="background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155;">
                    <h2 style="color:#22c55e; margin-top:0; font-size:16px;">Flota Aprobada y Saldos</h2>
                    ${activeHTML || '<p style="color:#64748b; font-size:14px;">No hay conductores aprobados todavía.</p>'}
                </div>
            </div>
        </body>
        </html>
    `);
});

// --- Rutas de Administración ---
app.post('/admin/approve', (req, res) => {
    const { phone } = req.body;
    if (pendingDrivers.has(phone)) {
        const driver = pendingDrivers.get(phone);
        activeDrivers.set(phone, { ...driver, balance: 0, status: 'offline' });
        pendingDrivers.delete(phone);
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

app.post('/admin/finance/adjust', (req, res) => {
    const { phone, amount } = req.body;
    const adjustValue = parseFloat(amount);

    if (activeDrivers.has(phone) && !isNaN(adjustValue)) {
        const driver = activeDrivers.get(phone);
        driver.balance += adjustValue;
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Operando en puerto ${PORT}`);
});
