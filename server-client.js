const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const CLIENTS_FILE = path.join(DB_DIR, 'clients.json');
const DRIVERS_FILE = path.join(DB_DIR, 'drivers.json');
const SETTINGS_FILE = path.join(DB_DIR, 'settings.json');

function leerJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) { return []; }
}

function escribirJSON(filePath, data) {
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
}

function obtenerConfig() {
    let settings = leerJSON(SETTINGS_FILE);
    if (!settings.commissionRate) {
        settings = { commissionRate: 10 };
        escribirJSON(SETTINGS_FILE, settings);
    }
    return settings;
}

// ==========================================
// ENDPOINT DE SINCRONIZACIÓN (Recibe datos de Clientes)
// ==========================================
app.post('/api/admin/sync-client', (req, res) => {
    const nuevoCliente = req.body;
    if (!nuevoCliente.id || !nuevoCliente.phone) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    let clients = leerJSON(CLIENTS_FILE);
    // Verificar si ya existe para actualizar o agregar
    const index = clients.findIndex(c => c.phone === nuevoCliente.phone);
    if (index !== -1) {
        clients[index] = { ...clients[index], ...nuevoCliente, lastActivity: new Date().toISOString() };
    } else {
        clients.push({ ...nuevoCliente, balance: 0, lastActivity: new Date().toISOString() });
    }

    escribirJSON(CLIENTS_FILE, clients);
    return res.json({ success: true, message: 'Cliente sincronizado correctamente en el Admin.' });
});

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN
// ==========================================
function verificarAdmin(req, res, next) {
    const token = req.cookies.admin_auth;
    if (token === 'librex_master_secure_2026') {
        next();
    } else {
        res.redirect('/login');
    }
}

// ==========================================
// RUTAS DE LOGIN Y AUTENTICACIÓN
// ==========================================
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Login Administrador Maestro</title>
            <style>
                body { background: #030712; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #0f172a; padding: 35px; border-radius: 20px; border: 1px solid #1e293b; width: 100%; max-width: 380px; box-shadow: 0 0 30px rgba(0,0,0,0.8); text-align: center; }
                h2 { color: #38bdf8; margin-bottom: 20px; }
                input { width: 100%; padding: 14px; margin: 12px 0; background: #1e293b; border: 1px solid #334155; color: #fff; border-radius: 10px; box-sizing: border-box; }
                button { width: 100%; padding: 14px; background: #0284c7; color: #fff; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; }
                button:hover { background: #0ea5e9; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Panel Maestro Admin</h2>
                <form method="POST" action="/auth">
                    <input type="password" name="password" placeholder="Contraseña de Administrador" required>
                    <button type="submit">Ingresar al Sistema</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/auth', express.urlencoded({ extended: true }), (req, res) => {
    const { password } = req.body;
    if (password === 'admin1234') {
        res.cookie('admin_auth', 'librex_master_secure_2026', { httpOnly: true });
        res.redirect('/');
    } else {
        res.redirect('/login?error=1');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('admin_auth');
    res.redirect('/login');
});

// ==========================================
// PANEL DE ADMINISTRACIÓN EN TIEMPO REAL
// ==========================================
app.get('/', verificarAdmin, (req, res) => {
    const clients = leerJSON(CLIENTS_FILE);
    const drivers = leerJSON(DRIVERS_FILE);
    const config = obtenerConfig();

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Panel de Control Total</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #030712; color: #f8fafc; padding: 20px; }
                .container { max-width: 1200px; margin: 0 auto; }
                header { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 20px; border-radius: 16px; border: 1px solid #1e293b; margin-bottom: 25px; }
                h1 { color: #38bdf8; font-size: 22px; }
                .btn-logout { background: #ef4444; color: #fff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold; }
                
                .grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 25px; }
                .card { background: #0f172a; padding: 20px; border-radius: 16px; border: 1px solid #1e293b; }
                .card h3 { color: #94a3b8; font-size: 14px; margin-bottom: 10px; }

                .section { background: #0f172a; padding: 25px; border-radius: 16px; border: 1px solid #1e293b; margin-bottom: 25px; }
                .section h2 { color: #38bdf8; font-size: 18px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #1e293b; font-size: 13px; }
                th { color: #64748b; font-weight: 600; }
                
                .badge { padding: 5px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px; }
                .badge-active { background: #065f46; color: #34d399; }
                .badge-inactive { background: #7f1d1d; color: #f87171; }
                
                .btn { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; border: none; cursor: pointer; transition: 0.2s; margin-right: 4px; }
                .btn-edit { background: #0284c7; color: #fff; }
                .btn-gift { background: #10b981; color: #fff; }
                .btn-del { background: #ef4444; color: #fff; }
                
                input, select { background: #1e293b; border: 1px solid #334155; color: #fff; padding: 8px; border-radius: 6px; font-size: 13px; }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>Librex - Panel Maestro en Tiempo Real</h1>
                    <a href="/logout" class="btn-logout">Cerrar Sesión</a>
                </header>

                <div class="grid-stats">
                    <div class="card">
                        <h3>Configuración de Comisión Global</h3>
                        <form action="/api/admin/settings" method="POST" style="margin-top: 10px; display: flex; gap: 10px;">
                            <input type="number" name="commissionRate" value="${config.commissionRate}" min="1" max="50" style="width: 80px;">
                            <span style="align-self: center; font-size: 13px;">% por carrera</span>
                            <button type="submit" class="btn btn-edit">Guardar</button>
                        </form>
                    </div>
                </div>

                <!-- SECCIÓN DE CONDUCTORES -->
                <div class="section">
                    <h2>Conductores Registrados (${drivers.length})</h2>
                    <table>
                        <tr>
                            <th>Conductor</th>
                            <th>Teléfono / Correo</th>
                            <th>Saldo Actual</th>
                            <th>Estado</th>
                            <th>Acciones y Control de Saldo</th>
                        </tr>
                        ${drivers.map(d => {
                            const ultimoAcceso = d.lastActivity ? new Date(d.lastActivity) : new Date(d.createdAt || Date.now());
                            const minutosInactivo = Math.floor((Date.now() - ultimoAcceso.getTime()) / 60000);
                            const activo = minutosInactivo < 5;
                            return `
                                <tr>
                                    <td><strong>${d.fullName}</strong></td>
                                    <td>${d.phone}<br><span style="color:#64748b;">${d.email}</span></td>
                                    <td><strong>$${d.balance || 0}</strong></td>
                                    <td>
                                        ${activo ? '<span class="badge badge-active">● Activo (Hace ' + minutosInactivo + 'm)</span>' : '<span class="badge badge-inactive">● Inactivo (' + minutosInactivo + 'm)</span>'}
                                    </td>
                                    <td>
                                        <button class="btn btn-gift" onclick="darSaldo('${d.id}', 'driver')">🎁 Dar Saldo</button>
                                        <button class="btn btn-edit" onclick="editarUsuario('${d.id}', 'driver', '${d.fullName}', '${d.phone}')">✏️ Editar</button>
                                        <button class="btn btn-del" onclick="eliminarUsuario('${d.id}', 'driver')">🗑️ Borrar</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') || '<tr><td colspan="5" style="text-align:center; color:#64748b;">No hay conductores registrados.</td></tr>'}
                    </table>
                </div>

                <!-- SECCIÓN DE CLIENTES -->
                <div class="section">
                    <h2>Pasajeros Registrados (${clients.length})</h2>
                    <table>
                        <tr>
                            <th>Pasajero</th>
                            <th>Teléfono / Correo</th>
                            <th>Saldo / Billetera</th>
                            <th>Estado en Vivo</th>
                            <th>Acciones y Regalos</th>
                        </tr>
                        ${clients.map(c => {
                            const ultimoAcceso = c.lastActivity ? new Date(c.lastActivity) : new Date(c.createdAt || Date.now());
                            const minutosInactivo = Math.floor((Date.now() - ultimoAcceso.getTime()) / 60000);
                            const activo = minutosInactivo < 5;
                            return `
                                <tr>
                                    <td><strong>${c.fullName}</strong></td>
                                    <td>${c.phone}<br><span style="color:#64748b;">${c.email}</span></td>
                                    <td><strong>$${c.balance || 0}</strong></td>
                                    <td>
                                        ${activo ? '<span class="badge badge-active">● Activo (Hace ' + minutosInactivo + 'm)</span>' : '<span class="badge badge-inactive">● Inactivo (' + minutosInactivo + 'm)</span>'}
                                    </td>
                                    <td>
                                        <button class="btn btn-gift" onclick="darSaldo('${c.id}', 'client')">🎁 Regalo Saldo</button>
                                        <button class="btn btn-edit" onclick="editarUsuario('${c.id}', 'client', '${c.fullName}', '${c.phone}')">✏️ Editar</button>
                                        <button class="btn btn-del" onclick="eliminarUsuario('${c.id}', 'client')">🗑️ Borrar</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') || '<tr><td colspan="5" style="text-align:center; color:#64748b;">No hay pasajeros registrados.</td></tr>'}
                    </table>
                </div>
            </div>

            <script>
                setTimeout(() => { window.location.reload(); }, 10000);

                async function darSaldo(id, tipo) {
                    const monto = prompt("Ingrese la cantidad de saldo de regalo a acreditar:");
                    if (!monto || isNaN(monto)) return;

                    const res = await fetch('/api/admin/add-balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, tipo, amount: parseFloat(monto) })
                    });
                    const data = await res.json();
                    alert(data.message);
                    window.location.reload();
                }

                async function eliminarUsuario(id, tipo) {
                    if (!confirm("¿Estás seguro de eliminar este usuario del sistema?")) return;
                    const res = await fetch('/api/admin/delete-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, tipo })
                    });
                    const data = await res.json();
                    alert(data.message);
                    window.location.reload();
                }

                async function editarUsuario(id, tipo, nombreActual, telActual) {
                    const nuevoNombre = prompt("Modificar Nombre:", nombreActual);
                    const nuevoTel = prompt("Modificar Teléfono:", telActual);
                    if (!nuevoNombre || !nuevoTel) return;

                    const res = await fetch('/api/admin/edit-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, tipo, fullName: nuevoNombre, phone: nuevoTel })
                    });
                    const data = await res.json();
                    alert(data.message);
                    window.location.reload();
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/api/admin/settings', verificarAdmin, (req, res) => {
    const { commissionRate } = req.body;
    escribirJSON(SETTINGS_FILE, { commissionRate: parseFloat(commissionRate) || 10 });
    res.redirect('/');
});

app.post('/api/admin/add-balance', verificarAdmin, (req, res) => {
    const { id, tipo, amount } = req.body;
    const file = tipo === 'driver' ? DRIVERS_FILE : CLIENTS_FILE;
    let data = leerJSON(file);

    let index = data.findIndex(u => u.id === id);
    if (index !== -1) {
        data[index].balance = (data[index].balance || 0) + amount;
        escribirJSON(file, data);
        return res.json({ success: true, message: '¡Saldo acreditado con éxito!' });
    }
    res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
});

app.post('/api/admin/delete-user', verificarAdmin, (req, res) => {
    const { id, tipo } = req.body;
    const file = tipo === 'driver' ? DRIVERS_FILE : CLIENTS_FILE;
    let data = leerJSON(file);

    data = data.filter(u => u.id !== id);
    escribirJSON(file, data);
    res.json({ success: true, message: 'Usuario eliminado correctamente.' });
});

app.post('/api/admin/edit-user', verificarAdmin, (req, res) => {
    const { id, tipo, fullName, phone } = req.body;
    const file = tipo === 'driver' ? DRIVERS_FILE : CLIENTS_FILE;
    let data = leerJSON(file);

    let index = data.findIndex(u => u.id === id);
    if (index !== -1) {
        data[index].fullName = fullName;
        data[index].phone = phone;
        escribirJSON(file, data);
        return res.json({ success: true, message: 'Datos actualizados correctamente.' });
    }
    res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
});

app.listen(PORT, () => {
    console.log(`[ADMIN-SERVER] Consola de Administración activa en puerto ${PORT}`);
});
