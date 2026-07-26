const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Hacer pública la carpeta de imágenes
app.use('/uploads', express.static(UPLOADS_DIR));

// ==========================================
// CONEXIÓN A MONGODB ATLAS
// ==========================================
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://vitorinoarenas1000_db_user:nATMmayO0SGQEpuD@librex.lglongl.mongodb.net/librex_db?retryWrites=true&w=majority&appName=Librex";

mongoose.connect(MONGO_URI)
    .then(() => console.log('[DATABASE] Conectado exitosamente a MongoDB Atlas'))
    .catch(err => console.error('[DATABASE] Error de conexión a MongoDB:', err));

// ==========================================
// ESQUEMAS Y MODELOS DE MONGOOSE
// ==========================================
const clientSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String },
    docFrontUrl: { type: String, default: '' },
    docBackUrl: { type: String, default: '' },
    status: { type: String, default: 'Activo' },
    balance: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
});

const driverSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String },
    selfieUrl: { type: String, default: '' },
    docFrontUrl: { type: String, default: '' },
    status: { type: String, default: 'Activo' },
    balance: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
});

const settingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    commissionRate: { type: Number, default: 10 },
    adminPasswordHash: { type: String }
});

const Client = mongoose.model('Client', clientSchema);
const Driver = mongoose.model('Driver', driverSchema);
const Settings = mongoose.model('Settings', settingsSchema);

async function inicializarConfiguracion() {
    try {
        let settings = await Settings.findOne({ key: 'main_settings' });
        if (!settings) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('94550Mic@', salt);
            await Settings.create({
                key: 'main_settings',
                commissionRate: 10,
                adminPasswordHash: hashedPassword
            });
            console.log('[SETUP] Configuración inicial y credenciales de admin creadas.');
        } else {
            // Si ya existe pero quieres asegurar la nueva contraseña por defecto o actualizarla si es necesario
            const match = await bcrypt.compare('94550Mic@', settings.adminPasswordHash || '');
            if (!match && !settings.adminPasswordHash) {
                const salt = await bcrypt.genSalt(10);
                settings.adminPasswordHash = await bcrypt.hash('94550Mic@', salt);
                await settings.save();
            }
        }
    } catch (e) {
        console.error('[SETUP] Error al inicializar configuración:', e);
    }
}
inicializarConfiguracion();

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function guardarImagenBase64(base64String, prefix, phone) {
    if (!base64String || !base64String.includes('base64,')) return '';
    try {
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return '';
        
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : 'user';
        const fileName = `${prefix}_${cleanPhone}_${Date.now()}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        
        fs.writeFileSync(filePath, buffer);
        return `/uploads/${fileName}`;
    } catch (e) {
        return '';
    }
}

// ==========================================
// ENDPOINT DE SINCRONIZACIÓN DE CLIENTES
// ==========================================
app.post('/api/admin/sync-client', async (req, res) => {
    try {
        const nuevoCliente = req.body;
        if (!nuevoCliente.id || !nuevoCliente.phone) {
            return res.status(400).json({ success: false, message: 'Datos incompletos.' });
        }

        let clienteExistente = await Client.findOne({ phone: nuevoCliente.phone });
        if (!clienteExistente && nuevoCliente.email) {
            clienteExistente = await Client.findOne({ email: nuevoCliente.email });
        }

        let docFrontUrl = nuevoCliente.docFrontUrl || '';
        let docBackUrl = nuevoCliente.docBackUrl || '';

        if (nuevoCliente.docFrontBase64 && nuevoCliente.docFrontBase64.startsWith('data:')) {
            docFrontUrl = guardarImagenBase64(nuevoCliente.docFrontBase64, 'client_front', nuevoCliente.phone);
        }
        if (nuevoCliente.docBackBase64 && nuevoCliente.docBackBase64.startsWith('data:')) {
            docBackUrl = guardarImagenBase64(nuevoCliente.docBackBase64, 'client_back', nuevoCliente.phone);
        }

        const dataToSave = {
            ...nuevoCliente,
            docFrontUrl: docFrontUrl || (clienteExistente ? clienteExistente.docFrontUrl : ''),
            docBackUrl: docBackUrl || (clienteExistente ? clienteExistente.docBackUrl : ''),
            status: clienteExistente ? clienteExistente.status : 'Activo',
            lastActivity: new Date()
        };

        delete dataToSave.docFrontBase64;
        delete dataToSave.docBackBase64;

        if (clienteExistente) {
            await Client.findOneAndUpdate({ phone: nuevoCliente.phone }, dataToSave, { upsert: true });
        } else {
            await Client.create({ ...dataToSave, balance: 0 });
        }

        return res.json({ success: true, message: 'Cliente sincronizado correctamente.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
    }
});

// ==========================================
// ENDPOINT DE SINCRONIZACIÓN DE CONDUCTORES
// ==========================================
app.post('/api/admin/sync-driver', async (req, res) => {
    try {
        const nuevoConductor = req.body;
        if (!nuevoConductor.id || !nuevoConductor.phone) {
            return res.status(400).json({ success: false, message: 'Datos de conductor incompletos.' });
        }

        let conductorExistente = await Driver.findOne({ phone: nuevoConductor.phone });
        if (!conductorExistente && nuevoConductor.email) {
            conductorExistente = await Driver.findOne({ email: nuevoConductor.email });
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
            selfieUrl: selfieUrl || (conductorExistente ? conductorExistente.selfieUrl : ''),
            docFrontUrl: docUrl || (conductorExistente ? conductorExistente.docFrontUrl : ''),
            status: conductorExistente ? conductorExistente.status : 'Activo',
            lastActivity: new Date()
        };

        delete driverData.selfieBase64;
        delete driverData.docFrontBase64;

        if (conductorExistente) {
            await Driver.findOneAndUpdate({ phone: nuevoConductor.phone }, driverData, { upsert: true });
        } else {
            await Driver.create({ ...driverData, balance: 0 });
        }

        return res.json({ success: true, message: '¡Conductor registrado y verificado con éxito!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
    }
});

// ==========================================
// MIDDLEWARE Y RUTAS ADMIN
// ==========================================
function verificarAdmin(req, res, next) {
    if (req.cookies.admin_auth === 'librex_master_secure_2026') next();
    else res.redirect('/login');
}

app.get('/login', (req, res) => {
    const errorMsg = req.query.error ? '<p style="color: #f87171; font-size: 13px; margin-bottom: 15px;">Contraseña incorrecta. Intente de nuevo.</p>' : '';
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Admin Login</title>
            <style>
                body { background: radial-gradient(circle at center, #1e1b4b 0%, #09090b 100%); color: #cbd5e1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); padding: 40px; border-radius: 24px; border: 1px solid rgba(139, 92, 246, 0.3); width: 100%; max-width: 380px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
                h2 { color: #c084fc; margin-bottom: 25px; font-weight: 700; letter-spacing: 0.5px; }
                .input-group { position: relative; width: 100%; margin: 12px 0; }
                input { width: 100%; padding: 14px 45px 14px 14px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); color: #f1f5f9; border-radius: 12px; box-sizing: border-box; outline: none; transition: border-color 0.3s; }
                input:focus { border-color: #a855f7; box-shadow: 0 0 10px rgba(168, 85, 247, 0.2); }
                .toggle-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; padding: 0; }
                button[type="submit"] { width: 100%; padding: 14px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #fff; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; margin-top: 10px; transition: opacity 0.3s, transform 0.2s; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4); }
                button[type="submit"]:hover { opacity: 0.9; transform: translateY(-1px); }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Panel Maestro Admin</h2>
                ${errorMsg}
                <form method="POST" action="/auth">
                    <div class="input-group">
                        <input type="password" id="password" name="password" placeholder="Contraseña Admin" required>
                        <button type="button" class="toggle-btn" onclick="togglePassword()">👁️</button>
                    </div>
                    <button type="submit">Ingresar</button>
                </form>
            </div>
            <script>
                function togglePassword() {
                    const pwd = document.getElementById('password');
                    pwd.type = pwd.type === 'password' ? 'text' : 'password';
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/auth', async (req, res) => {
    try {
        const settings = await Settings.findOne({ key: 'main_settings' });
        let match = false;

        if (settings && settings.adminPasswordHash) {
            match = await bcrypt.compare(req.body.password, settings.adminPasswordHash);
        } else {
            match = (req.body.password === '94550Mic@');
        }
        
        if (match) {
            res.cookie('admin_auth', 'librex_master_secure_2026', { httpOnly: true });
            return res.redirect('/');
        } else {
            return res.redirect('/login?error=1');
        }
    } catch (e) {
        console.error('[AUTH ERROR]', e);
        return res.redirect('/login?error=1');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('admin_auth');
    res.redirect('/login');
});

// Panel de Control Principal con diseño Violeta, Azul y Plateado
app.get('/', verificarAdmin, async (req, res) => {
    try {
        const clients = await Client.find({});
        const drivers = await Driver.find({});

        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Librex - Panel Maestro Admin</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                    body { background: #090a0f; color: #e2e8f0; padding: 20px; background-image: radial-gradient(at 0% 0%, rgba(88, 28, 135, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(30, 58, 138, 0.15) 0px, transparent 50%); min-height: 100vh; }
                    .container { max-width: 1350px; margin: 0 auto; }
                    header { display: flex; justify-content: space-between; align-items: center; background: rgba(18, 18, 28, 0.85); backdrop-filter: blur(10px); padding: 22px 28px; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.15); margin-bottom: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                    h1 { color: #f8fafc; font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
                    h1::before { content: ''; display: inline-block; width: 10px; height: 10px; background: #a855f7; border-radius: 50%; box-shadow: 0 0 10px #a855f7; }
                    .btn-logout { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold; transition: all 0.2s; }
                    .btn-logout:hover { background: #ef4444; color: #fff; }
                    .section { background: rgba(18, 18, 28, 0.8); backdrop-filter: blur(10px); padding: 24px; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.12); margin-bottom: 25px; box-shadow: 0 8px 25px rgba(0,0,0,0.4); }
                    .section h2 { color: #c084fc; font-size: 18px; margin-bottom: 18px; font-weight: 600; border-bottom: 1px solid rgba(148, 163, 184, 0.1); padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 14px 12px; text-align: left; border-bottom: 1px solid rgba(148, 163, 184, 0.1); font-size: 13px; vertical-align: middle; }
                    th { color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
                    .badge { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; display: inline-block; }
                    .badge-active { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
                    .badge-suspended { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
                    .btn { padding: 7px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; border: none; cursor: pointer; margin-right: 4px; margin-top: 4px; transition: all 0.2s; }
                    .btn-edit { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
                    .btn-edit:hover { background: #38bdf8; color: #090a0f; }
                    .btn-gift { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
                    .btn-gift:hover { background: #a855f7; color: #fff; }
                    .btn-suspend { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
                    .btn-suspend:hover { background: #f59e0b; color: #090a0f; }
                    .btn-activate { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
                    .btn-activate:hover { background: #10b981; color: #fff; }
                    .btn-del { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
                    .btn-del:hover { background: #ef4444; color: #fff; }
                    .photo-link { color: #38bdf8; text-decoration: none; font-weight: 600; cursor: pointer; margin-right: 8px; display: inline-block; padding: 3px 8px; background: rgba(56, 189, 248, 0.1); border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.2); transition: background 0.2s; }
                    .photo-link:hover { background: rgba(56, 189, 248, 0.25); }
                    .sub-text { color: #94a3b8; font-size: 11px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h1>Librex &bull; Panel Maestro (MongoDB Atlas)</h1>
                        <a href="/logout" class="btn-logout">Cerrar Sesión</a>
                    </header>

                    <!-- CONDUCTORES -->
                    <div class="section">
                        <h2>Conductores Registrados (${drivers.length})</h2>
                        <table>
                            <tr>
                                <th>Conductor</th>
                                <th>Teléfono / Correo</th>
                                <th>Documentos / Fotos</th>
                                <th>Saldo</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            ${drivers.map(d => {
                                const isSuspended = d.status === 'Suspendido';
                                return `
                                    <tr>
                                        <td><strong>${d.fullName}</strong></td>
                                        <td>${d.phone}<br><span class="sub-text">${d.email || 'N/A'}</span></td>
                                        <td>
                                            ${d.selfieUrl ? `<a href="${d.selfieUrl}" target="_blank" class="photo-link">📷 Rostro</a>` : '<span class="sub-text">Sin foto</span>'}
                                            ${d.docFrontUrl ? `<a href="${d.docFrontUrl}" target="_blank" class="photo-link" style="color:#c084fc; background:rgba(168,85,247,0.1); border-color:rgba(168,85,247,0.2);">🪪 Documento</a>` : ''}
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
                                            <button class="btn btn-edit" onclick="editarUsuario('${d.id}', 'driver', '${d.fullName}', '${d.phone}')">✏️ Editar</button>
                                            <button class="btn btn-del" onclick="eliminarUsuario('${d.id}', 'driver')">🗑️ Eliminar</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('') || '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No hay conductores registrados.</td></tr>'}
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
                                        <td>${c.phone}<br><span class="sub-text">${c.email || 'N/A'}</span></td>
                                        <td>
                                            ${c.docFrontUrl ? `<a href="${c.docFrontUrl}" target="_blank" class="photo-link">🪪 Frente</a>` : ''}
                                            ${c.docBackUrl ? `<a href="${c.docBackUrl}" target="_blank" class="photo-link" style="color:#c084fc; background:rgba(168,85,247,0.1); border-color:rgba(168,85,247,0.2);">🪪 Dorso</a>` : '<span class="sub-text">Sin docs</span>'}
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
                                            <button class="btn btn-edit" onclick="editarUsuario('${c.id}', 'client', '${c.fullName}', '${c.phone}')">✏️ Editar</button>
                                            <button class="btn btn-del" onclick="eliminarUsuario('${c.id}', 'client')">🗑️ Eliminar</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('') || '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No hay pasajeros registrados.</td></tr>'}
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
    } catch (e) {
        res.status(500).send("Error al cargar el panel de administración.");
    }
});

// ==========================================
// ENDPOINTS DE ADMINISTRACIÓN DE USUARIOS
// ==========================================
app.post('/api/admin/add-balance', verificarAdmin, async (req, res) => {
    const { id, tipo, amount } = req.body;
    const Model = tipo === 'driver' ? Driver : Client;
    const user = await Model.findOne({ id });
    if (user) {
        user.balance = (user.balance || 0) + amount;
        await user.save();
        return res.json({ success: true, message: 'Saldo acreditado correctamente.' });
    }
    res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
});

app.post('/api/admin/set-status', verificarAdmin, async (req, res) => {
    const { id, tipo, status } = req.body;
    const Model = tipo === 'driver' ? Driver : Client;
    const user = await Model.findOne({ id });
    if (user) {
        user.status = status;
        await user.save();
        return res.json({ success: true, message: `Estado actualizado a: ${status}` });
    }
    res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
});

app.post('/api/admin/delete-user', verificarAdmin, async (req, res) => {
    const { id, tipo } = req.body;
    const Model = tipo === 'driver' ? Driver : Client;
    await Model.findOneAndDelete({ id });
    res.json({ success: true, message: 'Usuario eliminado del sistema.' });
});

app.post('/api/admin/edit-user', verificarAdmin, async (req, res) => {
    const { id, tipo, fullName, phone } = req.body;
    const Model = tipo === 'driver' ? Driver : Client;
    const user = await Model.findOne({ id });
    if (user) {
        user.fullName = fullName;
        user.phone = phone;
        await user.save();
        return res.json({ success: true, message: 'Datos actualizados con éxito.' });
    }
    res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
});

app.listen(PORT, () => console.log(`[ADMIN-SERVER] Activo y conectado a MongoDB en puerto ${PORT}`));
