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
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Hacer pública la carpeta de imágenes para que los links funcionen
app.use('/uploads', express.static(UPLOADS_DIR));

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

// Función auxiliar para guardar imágenes Base64 como archivos locales y retornar una URL accesible
function guardarImagenBase64(base64String, prefix, phone) {
    if (!base64String || !base64String.includes('base64,')) return '';
    try {
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return '';
        
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${prefix}_${phone.replace(/[^0-9]/g, '')}_${Date.now()}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        
        fs.writeFileSync(filePath, buffer);
        return `/uploads/${fileName}`;
    } catch (e) {
        return '';
    }
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
// ENDPOINT DE SINCRONIZACIÓN DE CLIENTES (Con soporte para Cédula Frente/Dorso y validación)
// ==========================================
app.post('/api/admin/sync-client', (req, res) => {
    const nuevoCliente = req.body;
    if (!nuevoCliente.id || !nuevoCliente.phone) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    let clients = leerJSON(CLIENTS_FILE);
    
    const existe = clients.find(c => c.phone === nuevoCliente.phone || (nuevoCliente.email && c.email === nuevoCliente.email));
    const index = clients.findIndex(c => c.phone === nuevoCliente.phone);

    if (index === -1 && existe) {
        return res.status(400).json({ success: false, message: 'El correo o número telefónico ya está registrado por otro pasajero.' });
    }

    // Procesar imágenes de cédula si se envían en Base64 desde el cliente
    let docFrontUrl = nuevoCliente.docFrontUrl || '';
    let docBackUrl = nuevoCliente.docBackUrl || '';

    if (nuevoCliente.docFrontBase64 && nuevoCliente.docFrontBase64.startsWith('data:')) {
        docFrontUrl = guardarImagenBase64(nuevoCliente.docFrontBase64, 'client_front', nuevoCliente.phone);
    }
    if (nuevoCliente.docBackBase64 && nuevoCliente.docBackBase64.startsWith('data:')) {
        docBackUrl = guardarImagenBase64(nuevoCliente.docBackBase64, 'client_back', nuevoCliente.phone);
    }

    const clientData = {
        ...nuevoCliente,
        docFrontUrl: docFrontUrl || (clients[index] ? clients[index].docFrontUrl : ''),
        docBackUrl: docBackUrl || (clients[index] ? clients[index].docBackUrl : ''),
        status: clients[index] ? clients[index].status : 'Activo', // Mantener estado actual si ya existe
        lastActivity: new Date().toISOString()
    };

    delete clientData.docFrontBase64;
    delete clientData.docBackBase64;

    if (index !== -1) {
        clients[index] = { ...clients[index], ...clientData };
    } else {
        clients.push({ ...clientData, balance: 0 });
    }

    escribirJSON(CLIENTS_FILE, clients);
    return res.json({ success: true, message: 'Cliente sincronizado correctamente.' });
});

// ==========================================
// ENDPOINT DE SINCRONIZACIÓN DE CONDUCTORES
// ==========================================
app.post('/api/admin/sync-driver', (req, res) => {
    const nuevoConductor = req.body;
    if (!nuevoConductor.id || !nuevoConductor.phone) {
        return res.status(400).json({ success: false, message: 'Datos de conductor incompletos.' });
    }

    let drivers = leerJSON(DRIVERS_FILE);

    const existe = drivers.find(d => d.phone === nuevoConductor.phone || (nuevoConductor.email && d.email === nuevoConductor.email));
    const index = drivers.findIndex(d => d.phone === nuevoConductor.phone);

    if (index === -1 && existe) {
        return res.status(400).json({ success: false, message: '⚠️ Este número de teléfono o correo ya está registrado en el sistema por otro conductor.' });
    }

    let selfieUrl = nuevoConductor.selfieUrl || '';
    let docUrl = nuevoConductor.docFrontUrl || '';

    if (nuevoConductor.selfieBase64 && nuevoConductor.selfieBase64.startsWith('data:')) {
        selfieUrl = guardarImagenBase64(nuevoConductor.selfieBase64, 'driver_selfie', nuevoConductor.phone);
    }
    if (nuevoConductor.docFrontBase64 && nuevoConductor.docFrontBase64.startsWith('data:')) {
        docUrl = guardarImagenBase64(nuevoConductor.docFrontBase64, 'driver_doc', nuevoConductor.phone);
    }

    const driverData = {
        ...nuevoConductor,
        selfieUrl: selfieUrl || (drivers[index] ? drivers[index].selfieUrl : ''),
        docFrontUrl: docUrl || (drivers[index] ? drivers[index].docFrontUrl : ''),
        status: drivers[index] ? drivers[index].status : 'Activo',
        lastActivity: new Date().toISOString()
    };

    delete driverData.selfieBase64;
    delete driverData.docFrontBase64;

    if (index !== -1) {
        drivers[index] = { ...drivers[index], ...driverData };
    } else {
        drivers.push({ ...driverData, balance: 0 });
    }

    escribirJSON(DRIVERS_FILE, drivers);
    return res.json({ success: true, message: '¡Conductor registrado y verificado con éxito!' });
});

// ==========================================
// MIDDLEWARE Y RUTAS ADMIN
// ==========================================
function verificarAdmin(req, res, next) {
    if (req.cookies.admin_auth === 'librex_master_secure_2026') next();
    else res.redirect('/login');
}

app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Admin Login</title>
            <style>
                body { background: #030712; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #0f172a; padding: 35px; border-radius: 20px; border: 1px solid #1e293b; width: 100%; max-width: 380px; text-align: center; }
                h2 { color: #38bdf8; margin-bottom: 20px; }
                input { width: 100%; padding: 14px; margin: 12px 0; background: #1e293b; border: 1px solid #334155; color: #fff; border-radius: 10px; box-sizing: border-box; }
                button { width: 100%; padding: 14px; background: #0284c7; color: #fff; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Panel Maestro Admin</h2>
                <form method="POST" action="/auth">
                    <input type="password" name="password" placeholder="Contraseña Admin" required>
                    <button type="submit">Ingresar</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/auth', express.urlencoded({ extended: true }), (req, res) => {
    if (req.body.password === 'admin1234') {
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

// Panel de Control con control de suspensión y enlaces a documentos
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
            <title>Librex - Panel Maestro Admin</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
                body { background: #030712; color: #f8fafc; padding: 20px; }
                .container { max-width: 1300px; margin: 0 auto; }
                header { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 20px; border-radius: 16px; border: 1px solid #1e293b; margin-bottom: 20px; }
                h1 { color: #38bdf8; font-size: 20px; }
                .btn-logout { background: #ef4444; color: #fff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold; }
                .section { background: #0f172a; padding: 20px; border-radius: 16px; border: 1px solid #1e293b; margin-bottom: 25px; }
                .section h2 { color: #38bdf8; font-size: 17px; margin-bottom: 15px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #1e293b; font-size: 13px; vertical-align: middle; }
                th { color: #64748b; font-weight: 600; }
                .badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; display: inline-block; }
                .badge-active { background: #065f46; color: #34d399; }
                .badge-suspended { background: #7f1d1d; color: #f87171; }
                .btn { padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; border: none; cursor: pointer; margin-right: 3px; margin-top: 3px; }
                .btn-edit { background: #0284c7; color: #fff; }
                .btn-gift { background: #10b981; color: #fff; }
                .btn-suspend { background: #d97706; color: #fff; }
                .btn-activate { background: #059669; color: #fff; }
                .btn-del { background: #ef4444; color: #fff; }
                .photo-link { color: #38bdf8; text-decoration: underline; font-weight: bold; cursor: pointer; margin-right: 6px; display: inline-block; }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>Librex - Panel Maestro en Tiempo Real</h1>
                    <a href="/logout" class="btn-logout">Cerrar Sesión</a>
                </header>

                <!-- CONDUCTORES -->
                <div class="section">
                    <h2>Conductores Registrados (${drivers.length})</h2>
                    <table>
                        <tr>
                            <th>Conductor</th>
                            <th>Teléfono / Correo</th>
                            <th>Documentos (Fotos)</th>
                            <th>Saldo</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                        ${drivers.map(d => {
                            const isSuspended = d.status === 'Suspendido';
                            return `
                                <tr>
                                    <td><strong>${d.fullName}</strong></td>
                                    <td>${d.phone}<br><span style="color:#64748b;">${d.email}</span></td>
                                    <td>
                                        ${d.selfieUrl ? `<a href="${d.selfieUrl}" target="_blank" class="photo-link">📷 Rostro</a>` : '<span style="color:#64748b;">Sin foto</span>'}
                                        ${d.docFrontUrl ? `<a href="${d.docFrontUrl}" target="_blank" class="photo-link" style="color:#34d399;">🪪 Documento</a>` : ''}
                                    </td>
                                    <td><strong>$${d.balance || 0}</strong></td>
                                    <td>
                                        ${isSuspended ? '<span class="badge badge-suspended">Suspendido</span>' : '<span class="badge badge-active">Activo</span>'}
                                    </td>
                                    <td>
                                        <button class="btn btn-gift" onclick="darSaldo('${d.id}', 'driver')">🎁 Saldo</button>
                                        ${isSuspended ? 
                                            `<button class="btn btn-activate" onclick="cambiarEstado('${d.id}', 'driver', 'Activo')">✅ Activar</button>` : 
                                            `<button class="btn btn-suspend" onclick="cambiarEstado('${d.id}', 'driver', 'Suspendido')">🚫 Suspender</button>`
                                        }
                                        <button class="btn btn-edit" onclick="editarUsuario('${d.id}', 'driver', '${d.fullName}', '${d.phone}')">✏️</button>
                                        <button class="btn btn-del" onclick="eliminarUsuario('${d.id}', 'driver')">🗑️</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') || '<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay conductores registrados.</td></tr>'}
                    </table>
                </div>

                <!-- PASAJEROS -->
                <div class="section">
                    <h2>Pasajeros Registrados (${clients.length})</h2>
                    <table>
                        <tr>
                            <th>Pasajero</th>
                            <th>Teléfono / Correo</th>
                            <th>Documentos (Cédula)</th>
                            <th>Saldo / Billetera</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                        ${clients.map(c => {
                            const isSuspended = c.status === 'Suspendido';
                            return `
                                <tr>
                                    <td><strong>${c.fullName}</strong></td>
                                    <td>${c.phone}<br><span style="color:#64748b;">${c.email}</span></td>
                                    <td>
                                        ${c.docFrontUrl ? `<a href="${c.docFrontUrl}" target="_blank" class="photo-link" style="color:#38bdf8;">🪪 Frente</a>` : ''}
                                        ${c.docBackUrl ? `<a href="${c.docBackUrl}" target="_blank" class="photo-link" style="color:#34d399;">🪪 Dorso</a>` : '<span style="color:#64748b;">Sin docs</span>'}
                                    </td>
                                    <td><strong>$${c.balance || 0}</strong></td>
                                    <td>
                                        ${isSuspended ? '<span class="badge badge-suspended">Suspendido</span>' : '<span class="badge badge-active">Activo</span>'}
                                    </td>
                                    <td>
                                        <button class="btn btn-gift" onclick="darSaldo('${c.id}', 'client')">🎁 Saldo</button>
                                        ${isSuspended ? 
                                            `<button class="btn btn-activate" onclick="cambiarEstado('${c.id}', 'client', 'Activo')">✅ Activar</button>` : 
                                            `<button class="btn btn-suspend" onclick="cambiarEstado('${c.id}', 'client', 'Suspendido')">🚫 Suspender</button>`
                                        }
                                        <button class="btn btn-edit" onclick="editarUsuario('${c.id}', 'client', '${c.fullName}', '${c.phone}')">✏️</button>
                                        <button class="btn btn-del" onclick="eliminarUsuario('${c.id}', 'client')">🗑️</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') || '<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay pasajeros registrados.</td></tr>'}
                    </table>
                </div>
            </div>

            <script>
                setTimeout(() => window.location.reload(), 15000);

                async function darSaldo(id, tipo) {
                    const monto = prompt("Monto a acreditar:");
                    if (!monto || isNaN(monto)) return;
                    const res = await fetch('/api/admin/add-balance', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, tipo, amount: parseFloat(monto) })
                    });
                    alert((await res.json()).message);
                    window.location.reload();
                }

                async function cambiarEstado(id, tipo, nuevoEstado) {
                    if (!confirm(\`¿Establecer estado a \${nuevoEstado}?\`)) return;
                    const res = await fetch('/api/admin/set-status', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, tipo, status: nuevoEstado })
                    });
                    alert((await res.json()).message);
                    window.location.reload();
                }

                async function eliminarUsuario(id, tipo) {
                    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
                    const res = await fetch('/api/admin/delete-user', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, tipo })
                    });
                    alert((await res.json()).message);
                    window.location.reload();
                }

                async function editarUsuario(id, tipo, nombre, tel) {
                    const nuevoNombre = prompt("Nombre:", nombre);
                    const nuevoTel = prompt("Teléfono:", tel);
                    if (!nuevoNombre || !nuevoTel) return;
                    const res = await fetch('/api/admin/edit-user', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, tipo, fullName: nuevoNombre, phone: nuevoTel })
                    });
                    alert((await res.json()).message);
                    window.location.reload();
                }
            </script>
        </body>
        </html>
    `);
});

// ==========================================
// ENDPOINTS DE ADMINISTRACIÓN DE USUARIOS
// ==========================================
app.post('/api/admin/add-balance', verificarAdmin, (req, res) => {
    const { id, tipo, amount } = req.body;
    const file = tipo === 'driver' ? DRIVERS_FILE : CLIENTS_FILE;
    let data = leerJSON(file);
    let index = data.findIndex(u => u.id === id);
    if (index !== -1) {
        data[index].balance = (data[index].balance || 0) + amount;
        escribirJSON(file, data);
        return res.json({ success: true, message: 'Saldo acreditado correctamente.' });
    }
    res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
});

app.post('/api/admin/set-status', verificarAdmin, (req, res) => {
    const { id, tipo, status } = req.body;
    const file = tipo === 'driver' ? DRIVERS_FILE : CLIENTS_FILE;
    let data = leerJSON(file);
    let index = data.findIndex(u => u.id === id);
    if (index !== -1) {
        data[index].status = status;
        escribirJSON(file, data);
        return res.json({ success: true, message: `Estado actualizado a: ${status}` });
    }
    res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
});

app.post('/api/admin/delete-user', verificarAdmin, (req, res) => {
    const { id, tipo } = req.body;
    const file = tipo === 'driver' ? DRIVERS_FILE : CLIENTS_FILE;
    escribirJSON(file, leerJSON(file).filter(u => u.id !== id));
    res.json({ success: true, message: 'Usuario eliminado del sistema.' });
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
        return res.json({ success: true, message: 'Datos actualizados con éxito.' });
    }
    res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
});

app.listen(PORT, () => console.log(`[ADMIN-SERVER] Activo en puerto ${PORT}`));
