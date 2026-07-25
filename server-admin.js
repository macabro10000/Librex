const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.ADMIN_PORT || 3003;
const DB_FILE = path.join(__dirname, 'librex-transport-db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { clients: {}, drivers: {}, admins: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!data.clients) data.clients = {};
        if (!data.drivers) data.drivers = {};
        if (!data.admins) data.admins = [];
        return data;
    } catch (e) {
        return { clients: {}, drivers: {}, admins: [] };
    }
}

function saveDB(dbData) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
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

// Interfaz Gráfica del Panel Maestro
app.get('/admin', (req, res) => {
    const { key, email } = req.query;
    if (key !== 'librex2026') {
        return res.status(403).send(`
            <body style="background:#07090e;color:#ff5555;font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
                <div style="text-align:center;">
                    <h1>🚨 ACCESO DENEGADO</h1>
                    <p>Llave de seguridad del panel maestro inválida.</p>
                </div>
            </body>
        `);
    }

    const db = getDB();
    const drivers = Object.values(db.drivers || {});
    const clients = Object.values(db.clients || {});

    let clientsHtml = clients.map(c => `
        <div class="card" data-search="${(c.fullName + ' ' + c.phone).toLowerCase()}">
            <div class="user-info">
                <h3>👤 ${c.fullName || 'Sin Nombre'}</h3>
                <p><b>📱 Celular:</b> ${c.phone}</p>
                <p><b>🕒 Registro:</b> ${c.registeredAt ? new Date(c.registeredAt).toLocaleString() : 'Fecha no registrada'}</p>
                <p><b>⚙️ Estado:</b> <span class="badge ${c.status || 'pending_review'}">${c.status || 'pending_review'}</span></p>
                <div class="docs">
                    <a href="${c.selfieUrl || '#'}" target="_blank"><img src="${c.selfieUrl || ''}" alt="Selfie"><span>Selfie</span></a>
                    <a href="${c.docFrontUrl || '#'}" target="_blank"><img src="${c.docFrontUrl || ''}" alt="Cédula Frente"><span>Frente</span></a>
                    <a href="${c.docBackUrl || '#'}" target="_blank"><img src="${c.docBackUrl || ''}" alt="Cédula Dorso"><span>Dorso</span></a>
                </div>
            </div>
            <div class="actions-group">
                <div class="actions">
                    <button class="btn-approve" onclick="updateStatus('${c.phone}', 'client', 'active')">Aprobar ✅</button>
                    <button class="btn-reject" onclick="updateStatus('${c.phone}', 'client', 'rejected')">Rechazar ❌</button>
                </div>
                <button class="btn-delete" onclick="deleteUser('${c.phone}', 'client', '${c.fullName || c.phone}')">🗑️ Eliminar Perfil por Completo</button>
            </div>
        </div>
    `).join('') || '<p class="empty">No hay clientes registrados en la base de datos maestra.</p>';

    let driversHtml = drivers.map(d => `
        <div class="card" data-search="${(d.fullName + ' ' + d.phone).toLowerCase()}">
            <div class="user-info">
                <h3>🚕 ${d.fullName || 'Sin Nombre'}</h3>
                <p><b>📱 Celular:</b> ${d.phone}</p>
                <p><b>🕒 Registro:</b> ${d.registeredAt ? new Date(d.registeredAt).toLocaleString() : 'Fecha no registrada'}</p>
                <p><b>⚙️ Estado:</b> <span class="badge ${d.status || 'pending_review'}">${d.status || 'pending_review'}</span></p>
                <div class="docs">
                    <a href="${d.selfieUrl || '#'}" target="_blank"><img src="${d.selfieUrl || ''}" alt="Selfie"><span>Selfie</span></a>
                    <a href="${d.docFrontUrl || '#'}" target="_blank"><img src="${d.docFrontUrl || ''}" alt="Licencia"><span>Licencia</span></a>
                    <a href="${d.docBackUrl || '#'}" target="_blank"><img src="${d.docBackUrl || ''}" alt="Vehículo"><span>Vehículo</span></a>
                </div>
            </div>
            <div class="actions-group">
                <div class="actions">
                    <button class="btn-approve" onclick="updateStatus('${d.phone}', 'driver', 'active')">Aprobar ✅</button>
                    <button class="btn-reject" onclick="updateStatus('${d.phone}', 'driver', 'rejected')">Rechazar ❌</button>
                </div>
                <button class="btn-delete" onclick="deleteUser('${d.phone}', 'driver', '${d.fullName || d.phone}')">🗑️ Eliminar Perfil por Completo</button>
            </div>
        </div>
    `).join('') || '<p class="empty">No hay conductores registrados en la base de datos maestra.</p>';

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Panel Maestro - Librex Transport</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
                body { background: #07090e; color: #fff; padding: 15px; }
                .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #1e293b; padding-bottom: 10px; }
                h1 { color: #38bdf8; font-size: 18px; }
                p.sub { color: #94a3b8; font-size: 11px; }
                
                .search-box { width: 100%; margin-bottom: 15px; }
                .search-box input { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 12px; outline: none; }
                .search-box input:focus { border-color: #38bdf8; }

                .menu-tabs { display: flex; gap: 8px; margin-bottom: 15px; }
                .tab-btn { flex: 1; background: #1e293b; color: #94a3b8; border: none; padding: 10px; border-radius: 8px; font-weight: bold; font-size: 11px; cursor: pointer; transition: 0.2s; text-align: center; }
                .tab-btn.active { background: #059669; color: white; box-shadow: 0 4px 12px rgba(5,150,105,0.3); }

                .section-content { display: none; }
                .section-content.active { display: block; }

                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
                .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; }
                .user-info h3 { font-size: 13px; margin-bottom: 4px; color: #f8fafc; }
                .user-info p { font-size: 10px; color: #cbd5e1; margin-bottom: 2px; }
                .badge { padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-top: 3px; }
                .badge.pending_review { background: #eab308; color: #000; }
                .badge.active { background: #10b981; color: #fff; }
                .badge.rejected { background: #ef4444; color: #fff; }
                
                .docs { display: flex; gap: 6px; margin: 8px 0; }
                .docs a { text-align: center; text-decoration: none; color: #94a3b8; font-size: 8px; }
                .docs img { width: 50px; height: 50px; object-fit: cover; border-radius: 5px; border: 1px solid #334155; display: block; margin-bottom: 2px; }
                
                .actions-group { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
                .actions { display: flex; gap: 6px; }
                .actions button { flex: 1; padding: 7px; border: none; border-radius: 6px; font-weight: bold; font-size: 10px; cursor: pointer; }
                .btn-approve { background: #059669; color: white; }
                .btn-reject { background: #dc2626; color: white; }
                .btn-delete { width: 100%; background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; padding: 7px; border-radius: 6px; font-weight: bold; font-size: 10px; cursor: pointer; text-align: center; }
                .btn-delete:hover { background: #991b1b; color: #fff; }
                .empty { font-size: 11px; color: #64748b; font-style: italic; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="top-header">
                <div>
                    <h1>⚙️ PANEL MAESTRO</h1>
                    <p class="sub">Administrador: ${email}</p>
                </div>
            </div>

            <div class="search-box">
                <input type="text" id="searchInput" placeholder="🔍 Buscar por nombre o número de celular..." onkeyup="filterCards()">
            </div>

            <div class="menu-tabs">
                <button class="tab-btn active" id="btn-tab-clients" onclick="switchTab('clients')">👤 Clientes (${clients.length})</button>
                <button class="tab-btn" id="btn-tab-drivers" onclick="switchTab('drivers')">🚕 Conductores (${drivers.length})</button>
            </div>

            <div id="tab-clients" class="section-content active">
                <div class="grid">${clientsHtml}</div>
            </div>

            <div id="tab-drivers" class="section-content">
                <div class="grid">${driversHtml}</div>
            </div>

            <script>
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
                    fetch('/admin/update-status', {
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
                    if (confirm('⚠️ ¿Estás completamente seguro de eliminar el perfil de "' + name + '"?\\nEsta acción borrará sus datos de la base de datos y eliminará todas sus fotos y documentos del servidor de forma permanente.')) {
                        fetch('/admin/delete-user', {
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

// Endpoint para actualizar estado
app.post('/admin/update-status', (req, res) => {
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

// Endpoint para borrado definitivo
app.post('/admin/delete-user', (req, res) => {
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

app.use('/uploads', express.static(UPLOADS_DIR));

app.listen(PORT, () => {
    console.log(`[LIBREX MASTER ADMIN] Servidor operando en puerto ${PORT}`);
});
