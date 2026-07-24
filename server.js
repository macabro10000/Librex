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
const activeDrivers = new Map();  // Conductores aprobados y conectados (incluye su info financiera)
// Formato de conductor en activeDrivers: { phone, name, vehicle, plate, balance: 0, status: 'online' }

// --- Configuración del Sistema ---
const ADMIN_PASSWORD = "librex2026";
const COMMISSION_PERCENTAGE = 0.10; // 10%
const MIN_BALANCE_TO_WORK = 0; // Saldo mínimo para poder conectarse

// 1. PORTAL DEL CONDUCTOR (Registro)
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
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/register-driver', (req, res) => {
    const data = req.body;
    pendingDrivers.set(data.phone, { ...data, status: 'Pendiente', time: new Date().toLocaleString() });
    res.send('<h2 style="font-family:sans-serif; background:#0f172a; color:white; padding:50px; text-align:center;">Registro recibido. Espera activación.</h2>');
});


// 2. PANEL DE ADMINISTRACIÓN (Con módulo financiero)
app.get('/admin', (req, res) => {
    if (req.query.key !== ADMIN_PASSWORD) {
        return res.send('<h2 style="font-family:sans-serif; padding:50px; text-align:center;">Acceso Denegado</h2>');
    }

    let pendingHTML = '';
    pendingDrivers.forEach((d, phone) => {
        pendingHTML += `
            <div style="background:#0f172a; padding:10px; margin-bottom:5px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <span><b>${d.name}</b> - ${d.cedula} - ${d.plate}</span>
                <form action="/admin/approve" method="POST" style="margin:0;"><input type="hidden" name="phone" value="${phone}"><button type="submit" style="background:#22c55e; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Aprobar</button></form>
            </div>`;
    });

    let activeHTML = '';
    activeDrivers.forEach((d, phone) => {
        const balanceColor = d.balance > 0 ? '#22c55e' : '#ef4444';
        activeHTML += `
            <div style="background:#0f172a; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between;">
                    <div>
                        <b>${d.name}</b> - ${d.plate}<br>
                        <span style="font-size:13px; color:#94a3b8;">Tel: ${phone} - Estado: ${d.status}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:16px; font-weight:bold; color:${balanceColor};">$ ${d.balance.toLocaleString()}</span><br>
                        <span style="font-size:11px; color:#94a3b8;">Saldo Disponible</span>
                    </div>
                </div>
                <div style="margin-top:10px; display:flex; gap:5px;">
                    <form action="/admin/finance/adjust" method="POST" style="margin:0; display:flex; gap:5px;"><input type="hidden" name="phone" value="${phone}"><input type="number" name="amount" placeholder="Valor (ej: 5000 or -5000)" style="padding:5px; background:#1e293b; border:1px solid #334155; color:white; border-radius:4px;"><button type="submit" style="background:#38bdf8; color:#0f172a; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">Recargar/Ajustar</button></form>
                </div>
            </div>`;
    });

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><title>Admin Librex Finanzas</title></head>
        <body style="font-family:sans-serif; background:#0f172a; color:white; padding:20px;">
            <div style="max-width:800px; margin:0 auto;">
                <h1 style="color:#38bdf8;">Panel de Control y Finanzas</h1>
                <div style="background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155; margin-bottom:20px;">
                    <h2>Solicitudes Pendientes</h2>${pendingHTML || '<p style="color:#94a3b8;">Nada.</p>'}
                </div>
                <div style="background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155;">
                    <h2>Conductores Aprobados (Flota Activa)</h2>${activeHTML}
                </div>
            </div>
        </body>
        </html>
    `);
});

// --- Rutas de Administración ---

// 1. Aprobar Conductor (Lo mueve de pendientes a activos con saldo 0)
app.post('/admin/approve', (req, res) => {
    const { phone } = req.body;
    if (pendingDrivers.has(phone)) {
        const driver = pendingDrivers.get(phone);
        activeDrivers.set(phone, { ...driver, balance: 0, status: 'offline' }); // Inicia con saldo 0 y desconectado
        pendingDrivers.delete(phone);
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

// 2. Recargar o Ajustar Saldo (Función clave para manejar el dinero manualmente)
app.post('/admin/finance/adjust', (req, res) => {
    const { phone, amount } = req.body;
    const adjustValue = parseFloat(amount);

    if (activeDrivers.has(phone) && !isNaN(adjustValue)) {
        const driver = activeDrivers.get(phone);
        driver.balance += adjustValue; // Suma o resta el valor
        console.log(`[FINANZAS] Ajuste de $${adjustValue} a ${driver.name}. Nuevo saldo: $${driver.balance}`);
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});


// --- SIMULACIÓN DE WEBSOCKETS PARA LA APP DEL CONDUCTOR ---

io.on('connection', (socket) => {

    // Conexión del conductor (Verifica saldo)
    socket.on('driver:connect', (phone) => {
        if (activeDrivers.has(phone)) {
            const driver = activeDrivers.get(phone);
            if (driver.balance >= MIN_BALANCE_TO_WORK) {
                driver.status = 'online';
                socket.emit('connection:status', { success: true, message: 'Conectado' });
                io.emit('map:broadcast_drivers', Array.from(activeDrivers.values())); // Actualiza el mapa
                console.log(`[CONDUCTOR ONLINE] ${driver.name} (Saldo: $${driver.balance})`);
            } else {
                socket.emit('connection:status', { success: false, message: 'Saldo insuficiente. Recargue para trabajar.' });
            }
        }
    });

    // Desconexión manual
    socket.on('driver:disconnect', (phone) => {
        if (activeDrivers.has(phone)) {
            activeDrivers.get(phone).status = 'offline';
            io.emit('map:broadcast_drivers', Array.from(activeDrivers.values()));
        }
    });

    socket.on('disconnect', () => {
        // Al cerrar la app, el socket se desconecta pero no cambia el estado a 'offline' en BD
        // para no penalizarlo si pierde conexión a internet brevemente.
        // Solo cambia si él presiona el botón de desconectar.
    });
});


// --- MÓDULO SIMULADO DE COBRO DE COMISIÓN POR VIAJE (Paso 3 para después) ---
// Esta función la llamaremos cuando un viaje se complete.
function simulateCompleteRide(driverPhone, rideValue) {
    if (activeDrivers.has(driverPhone)) {
        const driver = activeDrivers.get(driverPhone);
        const commissionAmount = rideValue * COMMISSION_PERCENTAGE; // 10%
        driver.balance -= commissionAmount; // Descuenta la comisión del saldo

        console.log(`[VIAJE COMPLETADO] Conductor ${driver.name}. Valor Carrera: $${rideValue}. Comisión cobrada: $${commissionAmount}. Nuevo Saldo: $${driver.balance}`);

        // Si el saldo queda en negativo, lo desconecta automáticamente
        if (driver.balance < MIN_BALANCE_TO_WORK) {
            driver.status = 'offline';
            io.emit('map:broadcast_drivers', Array.from(activeDrivers.values())); // Lo quita del mapa
            console.log(`[CONDUCTOR BLOQUEADO] ${driver.name} por saldo insuficiente.`);
            // Aquí podrías enviarle un WhatsApp automático avisando si tuvieras la API
        }
        return true;
    }
    return false;
}

// Ruta para probar la simulación de cobro de viaje (EJEMPLO)
app.get('/test-ride-payment', (req, res) => {
    // Pones el teléfono del conductor y el valor de la carrera
    const phone = req.query.phone || '+573001234567';
    const rideValue = parseFloat(req.query.value) || 10000;
    
    if (simulateCompleteRide(phone, rideValue)) {
        res.send(`Cobro de comisión simulado para ${phone} por carrera de $${rideValue}. Revisa los logs del servidor.`);
    } else {
        res.send('Conductor no encontrado.');
    }
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Sistema de gestión y finanzas operativo en puerto ${PORT}`);
});
