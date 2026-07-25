const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

// ==========================================
// GESTIÓN DE BASES DE DATOS LOCALES (JSON)
// ==========================================
const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)){
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const CLIENTS_FILE = path.join(DB_DIR, 'clients.json');
const DRIVERS_FILE = path.join(DB_DIR, 'drivers.json');
const SESSIONS_FILE = path.join(DB_DIR, 'sessions.json');

function leerJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function escribirJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Error al escribir base de datos:", e);
    }
}

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN DE ADMINISTRADOR
// ==========================================
function verificarAdmin(req, res, next) {
    const tokenAdmin = req.cookies.admin_auth;
    // Contraseña o clave simple de sesión de administrador configurable
    if (tokenAdmin === 'librex_secure_admin_2026') {
        next();
    } else {
        res.redirect('/admin-login');
    }
}

// ==========================================
// ENDPOINTS DE REGISTRO Y SINCRONIZACIÓN
// ==========================================
app.post('/api/register/client', (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    let clients = leerJSON(CLIENTS_FILE);
    const nuevoCliente = {
        id: Date.now().toString(),
        phone,
        fullName,
        email: email || 'Sin correo',
        selfieBase64: selfieBase64 || '',
        docFrontBase64: docFrontBase64 || '',
        docBackBase64: docBackBase64 || '',
        createdAt: new Date().toISOString()
    };

    clients.push(nuevoCliente);
    escribirJSON(CLIENTS_FILE, clients);

    return res.json({ success: true, message: 'Cliente registrado correctamente en el servidor principal.' });
});

app.post('/api/register/driver', (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    let drivers = leerJSON(DRIVERS_FILE);
    const nuevoConductor = {
        id: Date.now().toString(),
        phone,
        fullName,
        email: email || 'Sin correo',
        selfieBase64: selfieBase64 || '',
        docFrontBase64: docFrontBase64 || '',
        docBackBase64: docBackBase64 || '',
        status: 'Activo',
        createdAt: new Date().toISOString()
    };

    drivers.push(nuevoConductor);
    escribirJSON(DRIVERS_FILE, drivers);

    return res.json({ success: true, message: 'Conductor registrado correctamente en el servidor principal.' });
});

// ==========================================
// VERIFICACIÓN DE SESIÓN EN TIEMPO REAL
// ==========================================
app.get('/api/verify-session', (req, res) => {
    const email = req.query.email;
    if (!email) return res.json({ active: false });

    // Validamos si el usuario existe en clientes o conductores
    const clients = leerJSON(CLIENTS_FILE);
    const drivers = leerJSON(DRIVERS_FILE);

    const existe = clients.some(c => c.email === email) || drivers.some(d => d.email === email);
    res.json({ active: existe });
});

// ==========================================
// SOLICITUD DE VIAJE DESDE EL CLIENTE
// ==========================================
app.post('/api/client/request-ride', (req, res) => {
    const { email, name } = req.body;
    // Lógica para asignar viaje o buscar conductores libres
    let drivers = leerJSON(DRIVERS_FILE);
    if (drivers.length > 0) {
        return res.json({ success: true, message: 'Conductor asignado con éxito.' });
    } else {
        return res.json({ success: false, message: 'No hay conductores disponibles.' });
    }
});

// ==========================================
// LOGIN DE ADMINISTRADOR
// ==========================================
app.get('/admin-login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Login Administrador</title>
            <style>
                body { background: #090d16; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .login-card { background: #111827; padding: 30px; border-radius: 16px; border: 1px solid #1f2937; width: 100%; max-width: 350px; text-align: center; }
                input { width: 100%; padding: 12px; margin: 15px 0; background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="login-card">
                <h2>Panel Admin Librex</h2>
                <form method="POST" action="/admin-auth">
                    <input type="password" name="password" placeholder="Contraseña de Administrador" required>
                    <button type="submit">Ingresar</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/admin-auth', express.urlencoded({ extended: true }), (req, res) => {
    const { password } = req.body;
    if (password === 'admin1234') { // Contraseña maestra modificable
        res.cookie('admin_auth', 'librex_secure_admin_2026', { httpOnly: true });
        res.redirect('/admin');
    } else {
        res.redirect('/admin-login?error=1');
    }
});

// ==========================================
// PANEL DE ADMINISTRACIÓN MAESTRO
// ==========================================
app.get('/admin', verificarAdmin, (req, res) => {
    const clients = leerJSON(CLIENTS_FILE);
    const drivers = leerJSON(DRIVERS_FILE);

    let htmlClients = clients.map(c => `<tr><td>${c.fullName}</td><td>${c.phone}</td><td>${c.email}</td></tr>`).join('');
    let htmlDrivers = drivers.map(d => `<tr><td>${d.fullName}</td><td>${d.phone}</td><td>${d.email}</td></tr>`).join('');

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Panel Maestro - Librex Ride</title>
            <style>
                body { background: #090d16; color: #f3f4f6; font-family: sans-serif; padding: 20px; }
                h1 { color: #38bdf8; margin-bottom: 20px; }
                .section { background: #111827; padding: 20px; border-radius: 12px; border: 1px solid #1f2937; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { padding: 10px; text-align: left; border-bottom: 1px solid #1f2937; font-size: 14px; }
                th { color: #9ca3af; }
                .btn-logout { background: #ef4444; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; float: right; }
            </style>
        </head>
        <body>
            <a href="/admin-logout" class="btn-logout">Cerrar Sesión</a>
            <h1>Panel Maestro / Administrador - Librex</h1>
            
            <div class="section">
                <h3>Pasajeros Registrados (${clients.length})</h3>
                <table>
                    <tr><th>Nombre</th><th>Teléfono</th><th>Correo</th></tr>
                    ${htmlClients || '<tr><td colspan="3">No hay pasajeros registrados.</td></tr>'}
                </table>
            </div>

            <div class="section">
                <h3>Conductores Registrados (${drivers.length})</h3>
                <table>
                    <tr><th>Nombre</th><th>Teléfono</th><th>Correo</th></tr>
                    ${htmlDrivers || '<tr><td colspan="3">No hay conductores registrados.</td></tr>'}
                </table>
            </div>
        </body>
        </html>
    `);
});

app.get('/admin-logout', (req, res) => {
    res.clearCookie('admin_auth');
    res.redirect('/admin-login');
});

// ==========================================
// VISTA PRINCIPAL (HOME / GATEWAY)
// ==========================================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex Ride - Sistema Central</title>
            <style>
                body { background: #090d16; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                .card { background: #111827; padding: 40px; border-radius: 24px; border: 1px solid #1f2937; max-width: 400px; width: 100%; box-shadow: 0 0 30px rgba(0,0,0,0.6); }
                h1 { color: #38bdf8; font-size: 26px; margin-bottom: 10px; }
                p { color: #9ca3af; font-size: 14px; margin-bottom: 30px; }
                a { display: block; background: #0284c7; color: #fff; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-bottom: 12px; }
                a.admin { background: #374151; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Librex Ride</h1>
                <p>Plataforma de Movilidad y Transporte Multiplataforma</p>
                <a href="/admin">Panel de Administración</a>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`[SERVER-MAIN] Servidor principal y administrativo activo en puerto ${PORT}`);
});
