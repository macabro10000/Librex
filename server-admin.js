const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || process.env.ADMIN_PORT || 3003;
const ADMIN_SECRET_KEY = process.env.ADMIN_KEY || 'librex2026';

const DB_FILE = path.join(__dirname, 'librex-transport-db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Control de concurrencia simple para evitar corrupción del JSON
let isWritingDB = false;

function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { clients: {}, drivers: {}, admins: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!data.clients || Array.isArray(data.clients)) data.clients = {};
        if (!data.drivers || Array.isArray(data.drivers)) data.drivers = {};
        if (!data.admins) data.admins = [];
        return data;
    } catch (e) {
        console.error("Error al leer la base de datos, restaurando estructura vacía.", e);
        return { clients: {}, drivers: {}, admins: [] };
    }
}

function saveDB(dbData) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
    } catch (e) {
        console.error("Error crítico al guardar la base de datos:", e);
    }
}

function deleteFolderRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file) => {
            const curPath = path.join(directoryPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(directoryPath);
    }
}

// Servir archivos estáticos de forma segura
app.use('/uploads', express.static(UPLOADS_DIR));

// ==========================================
// RUTA DE LOGIN AL PANEL MAESTRO
// ==========================================
app.get('/admin/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Maestro - Librex</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
                body { background: #07090e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .login-card { background: #0f172a; border: 1px solid #1e293b; padding: 30px; border-radius: 16px; width: 100%; max-width: 360px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; }
                h1 { color: #38bdf8; font-size: 20px; margin-bottom: 8px; }
                p { color: #94a3b8; font-size: 12px; margin-bottom: 20px; }
                input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #020617; color: white; font-size: 14px; margin-bottom: 15px; outline: none; text-align: center; }
                input:focus { border-color: #38bdf8; }
                button { width: 100%; background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
                button:hover { background: #047857; }
            </style>
        </head>
        <body>
            <div class="login-card">
                <h1>⚙️ Librex Master</h1>
                <p>Ingrese la llave de seguridad del sistema</p>
                <form action="/admin" method="GET">
                    <input type="password" name="key" placeholder="Llave maestra..." required autofocus>
                    <button type="submit">Ingresar al Panel</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// INTERFAZ GRÁFICA DEL PANEL MAESTRO
// ==========================================
app.get('/admin', (req, res) => {
    const { key, email } = req.query;
    if (key !== ADMIN_SECRET_KEY) {
        return res.redirect('/admin/login');
    }

    const db = getDB();
    const drivers = Object.values(db.drivers || {}).sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));
    const clients = Object.values(db.clients || {}).sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));

    // Estadísticas / KPIs
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === 'active').length;
    const pendingClients = clients.filter(c => !c.status || c.status === 'pending_review').length;

    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.status === 'active').length;
    const pendingDrivers = drivers.filter(d => !d.status || d.status === 'pending_review').length;

    let clientsHtml = clients.map(c => `
        <div class="card" data-search="${(c.fullName + ' ' + c.phone).toLowerCase()}">
            <div class="user-info">
                <h3>👤 ${c.fullName || 'Sin Nombre'}</h3>
                <p><b>📱 Celular:</b> ${c.phone}</p>
                <p><b>🕒 Registro:</b> ${c.registeredAt ? new Date(c.registeredAt).toLocaleString() : 'Fecha no registrada'}</p>
                <p><b>⚙️ Estado:</b> <span class="badge ${c.status || 'pending_review'}">${c.status || 'pending_review'}</span></p>
                <div class="docs">
                    <a href="${c.selfieUrl || '#'}" target="_blank"><img src="${c.selfieUrl || ''}" alt="Selfie" loading="lazy"><span>Selfie</span></a>
                    <a href="${c.docFrontUrl || '#'}" target="_blank"><img src="${c.docFrontUrl || ''}" alt="Cédula Frente" loading="lazy"><span>Frente</span></a>
                    <a href="${c.docBackUrl || '#'}" target="_blank"><img src="${c.docBackUrl || ''}" alt="Cédula Dorso" loading="lazy"><span>Dorso</span></a>
                </div>
            </div>
            <div class="actions-group">
                <div class="actions">
                    <button class="btn-approve" onclick="updateStatus('${c.phone}', 'client', 'active')">Aprobar ✅</button>
                    <button class="btn-reject" onclick="updateStatus('${c.phone}', 'client', 'rejected')">Rechazar ❌</button>
                </div>
                <button class="btn-delete" onclick="deleteUser('${c.phone}', 'client', '${c.fullName || c.phone}')">🗑️ Eliminar Perfil Completo</button>
            </div>
        </div>
    `).join('') || '<p class="empty">No hay clientes registrados.</p>';

    let driversHtml = drivers.map(d => `
        <div class="card" data-search="${(d.fullName + ' ' + d.phone).toLowerCase()}">
            <div class="user-info">
                <h3>🚕 ${d.fullName || 'Sin Nombre'}</h3>
                <p><b>📱 Celular:</b> ${d.phone}</p>
                <p><b>🕒 Registro:</b> ${d.registeredAt ? new Date(d.registeredAt).toLocaleString() : 'Fecha no registrada'}</p>
                <p><b>⚙️ Estado:</b> <span class="badge ${d.status || 'pending_review'}">${d.status || 'pending_review'}</span></p>
                <div class="docs">
                    <a href="${d.selfieUrl || '#'}" target="_blank"><img src="${d.selfieUrl || ''}" alt="Selfie" loading="lazy"><span>Selfie</span></a>
                    <a href="${d.docFrontUrl || '#'}" target="_blank"><img src="${d.docFrontUrl || ''}" alt="Licencia" loading="lazy"><span>Licencia</span></a>
                    <a href="${d.docBackUrl || '#'}" target="_blank"><img src="${d.docBackUrl || ''}" alt="Vehículo" loading="lazy"><span>Vehículo</span></a>
                </div>
            </div>
            <div class="actions-group">
                <div class="actions">
                    <button class="btn-approve" onclick="updateStatus('${d.phone}', 'driver', 'active')">Aprobar ✅</button>
                    <button class="btn-reject" onclick="updateStatus('${d.phone}', 'driver', 'rejected')">Rechazar ❌</button>
                </div>
                <button class="btn-delete" onclick="deleteUser('${d.phone}', 'driver', '${d.fullName || d.phone}')">🗑️ Eliminar Perfil Completo</button>
            </div>
        </div>
    `).join('') || '<p class="empty">No hay conductores registrados.</p>';

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Panel Maestro - Librex Transport</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
                body { background: #07090e; color: #fff; padding: 20px; max-width: 1400px; margin: 0 auto; }
                .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 15px; }
                h1 { color: #38bdf8; font-size: 20px; }
                p.sub { color: #94a3b8; font-size: 12px; }
                
                .kpi-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 20px; }
                .kpi-box { background: #0f172a; border: 1px solid #1e293b; padding: 12px; border-radius: 10px; text-align: center; }
                .kpi-box h4 { font-size: 18px; color: #38bdf8; }
                .kpi-box span { font-size: 10px; color: #94a3b8; text-transform: uppercase; }

                .search-box { width: 100%; margin-bottom: 20px; }
                .search-box input { width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 13px; outline: none; }
                .search-box input:focus { border-color: #38bdf8; }

                .menu-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
                .tab-btn { flex: 1; background: #1e293b; color: #94a3b8; border: none; padding: 12px; border-radius: 10px; font-weight: bold; font-size: 12px; cursor: pointer; transition: 0.2s; text-align: center; }
                .tab-btn.active { background: #059669; color: white; box-shadow: 0 4px 12px rgba(5,150,105,0.3); }

                .section-content { display: none; }
                .section-content.active { display: block; }

                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }
                .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; justify-content: space-between; }
                .user-info h3 { font-size: 14px; margin-bottom: 6px; color: #f8fafc; }
                .user-info p { font-size: 11px; color: #cbd5e1; margin-bottom: 3px; }
                .badge { padding: 3px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-top: 4px; }
                .badge.pending_review { background: #eab308; color: #000; }
                .badge.active { background: #10b981; color: #fff; }
                .badge.rejected { background: #ef4444; color: #fff; }
                
                .docs { display: flex; gap: 8px; margin: 10px 0; }
                .docs a { text-align: center; text-decoration: none; color: #94a3b8; font-size: 9px; }
                .docs img { width: 55px; height: 55px; object-fit: cover; border-radius: 6px; border: 1px solid #334155; display: block; margin-bottom: 3px; transition: 0.2s; }
                .docs img:hover { transform: scale(1.05); border-color: #38bdf8; }
                
                .actions-group { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
                .actions { display: flex; gap: 8px; }
                .actions button { flex: 1; padding: 8px; border: none; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer; transition: 0.2s; }
                .btn-approve { background: #059669; color: white; }
                .btn-approve:hover { background: #047857; }
                .btn-reject { background: #dc2626; color: white; }
                .btn-reject:hover { background: #b91c1c; }
                .btn-delete { width: 100%; background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; padding: 8px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer; text-align: center; }
                .btn-delete:hover { background: #991b1b; color: #fff; }
                .empty { font-size: 12px; color: #64748b; font-style: italic; margin-top: 15px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="top-header">
                <div>
                    <h1>⚙️ PANEL MAESTRO LIBREX</h1>
                    <p class="sub">Sesión segura activa | Llave validada</p>
                </div>
                <a href="/admin/login" style="color: #ef4444; font-size: 12px; text-decoration: none; font-weight: bold;">Cerrar Sesión 🚪</a>
            </div>

            <div class="kpi-container">
                <div class="kpi-box"><h4>${totalClients}</h4><span>Total Clientes</span></div>
                <div class="kpi-box"><h4>${activeClients}</h4><span>Cl. Activos</span></div>
                <div class="kpi-box" style="border-color:#eab308"><h4>${pendingClients}</h4><span>Cl. Pendientes</span></div>
                <div class="kpi-box"><h4>${totalDrivers}</h4><span>Total Conductores</span></div>
                <div class="kpi-box"><h4>${activeDrivers}</h4><span>Dr. Activos</span></div>
                <div class="kpi-box" style="border-color:#eab308"><h4>${pendingDrivers}</h4><span>Dr. Pendientes</span></div>
            </div>

            <div class="search-box">
                <input type="text" id="searchInput" placeholder="🔍 Buscar por nombre o número de celular..." onkeyup="filterCards()">
            </div>

            <div class="menu-tabs">
                <button class="tab-btn active" id="btn-tab-clients" onclick="switchTab('clients')">👤 Clientes (${totalClients})</button>
                <button class="tab-btn" id="btn-tab-drivers" onclick="switchTab('drivers')">🚕 Conductores (${totalDrivers})</button>
            </div>

            <div id="tab-clients" class="section-content active">
                <div class="grid">${clientsHtml}</div>
            </div>

            <div id="tab-drivers" class="section-content">
                <div class="grid">${driversHtml}</div>
            </div>

            <script>
                const masterKey = "${ADMIN_SECRET_KEY}";

                function switchTab(tabName) {
                    document.getElementById('tab-clients').classList.remove('active');
                    document.getElementById('tab-drivers').classList.remove('active');
                    document.getElementById('btn-tab-clients').classList.remove('active');
                    document.getElementById('btn-tab-drivers').classList.remove('active');

                    if (tabName === 'clients') {
                        document.getElementById('tab-clients').classList.add('active');
                        document.getElementById('btn-tab-clients').classList.add('active');
                    } else {
                        document.getElementById('tab-drivers').classList.add('active');
                        document.getElementById('btn-tab-drivers').classList.add('active');
                    }
                    filterCards();
                }

                function filterCards() {
                    let query = document.getElementById('searchInput').value.toLowerCase();
                    let activeTab = document.querySelector('.section-content.active');
                    let cards = activeTab.getElementsByClassName('card');

                    for (let card of cards) {
                        let text = card.getAttribute('data-search');
                        if (text.includes(query)) {
                            card.style.display = "flex";
                        } else {
                            card.style.display = "none";
                        }
                    }
                }

                function updateStatus(phone, role, status) {
                    fetch('/admin/update-status?key=' + masterKey, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone, role, status })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            location.reload();
                        } else {
                            alert(data.message);
                        }
                    });
                }

                function deleteUser(phone, role, name) {
                    if (confirm('⚠️ ¿Estás completamente seguro de eliminar el perfil de "' + name + '"?\\nEsta acción borrará sus datos y todas sus fotos del servidor permanentemente.')) {
                        fetch('/admin/delete-user?key=' + masterKey, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone, role })
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                location.reload();
                            } else {
                                alert(data.message);
                            }
                        });
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// ==========================================
// ENDPOINT PARA ACTUALIZAR ESTADO (PROTEGIDO)
// ==========================================
app.post('/admin/update-status', (req, res) => {
    const { key } = req.query;
    if (key !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ success: false, message: "No autorizado." });
    }

    const { phone, role, status } = req.body;
    const db = getDB();

    if (role === 'driver' && db.drivers[phone]) {
        db.drivers[phone].status = status;
    } else if (role === 'client' && db.clients[phone]) {
        db.clients[phone].status = status;
    } else {
        return res.json({ success: false, message: "Usuario no encontrado en la base de datos." });
    }

    saveDB(db);
    res.json({ success: true });
});

// ==========================================
// ENDPOINT PARA BORRADO DEFINITIVO (PROTEGIDO)
// ==========================================
app.post('/admin/delete-user', (req, res) => {
    const { key } = req.query;
    if (key !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ success: false, message: "No autorizado." });
    }

    const { phone, role } = req.body;
    const db = getDB();

    let found = false;
    if (role === 'driver' && db.drivers[phone]) {
        delete db.drivers[phone];
        found = true;
    } else if (role === 'client' && db.clients[phone]) {
        delete db.clients[phone];
        found = true;
    }

    if (!found) {
        return res.json({ success: false, message: "El usuario ya no existe en la base de datos." });
    }

    saveDB(db);

    const safePhoneKey = phone.replace(/[^a-zA-Z0-9]/g, '_');
    const userFolderPath = path.join(UPLOADS_DIR, safePhoneKey);
    try {
        deleteFolderRecursive(userFolderPath);
    } catch (e) {
        console.error("No se pudo eliminar la carpeta física del usuario:", e);
    }

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`[LIBREX MASTER ADMIN] Servidor seguro operando en puerto ${PORT}`);
});
