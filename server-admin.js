const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.ADMIN_PORT || 3003;
const DB_FILE = path.join(__dirname, 'librex-transport-db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Función segura para leer la base de datos permanente en disco
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
        return data;
    } catch (e) {
        return { clients: {}, drivers: {}, admins: [] };
    }
}

// Ruta Principal del Administrador con Menú de Pestañas (Clientes / Conductores)
app.get('/admin', (req, res) => {
    const { key, email } = req.query;
    if (key !== 'librex2026') {
        return res.status(403).send("<h1>Acceso Denegado</h1><p>Llave de seguridad inválida.</p>");
    }

    const db = getDB();
    const drivers = Object.values(db.drivers || {});
    const clients = Object.values(db.clients || {});

    // Renderizar tarjetas de Clientes de forma persistente
    let clientsHtml = clients.map(c => `
        <div class="card">
            <div class="user-info">
                <h3>👤 ${c.fullName || 'Sin Nombre'}</h3>
                <p><b>Teléfono:</b> ${c.phone}</p>
                <p><b>Registrado:</b> ${new Date(c.registeredAt).toLocaleString()}</p>
                <p><b>Estado:</b> <span class="badge ${c.status}">${c.status}</span></p>
                <div class="docs">
                    <a href="${c.selfieUrl}" target="_blank"><img src="${c.selfieUrl}" alt="Selfie"><span>Selfie</span></a>
                    <a href="${c.docFrontUrl}" target="_blank"><img src="${c.docFrontUrl}" alt="Cédula Frente"><span>Frente</span></a>
                    <a href="${c.docBackUrl}" target="_blank"><img src="${c.docBackUrl}" alt="Cédula Dorso"><span>Dorso</span></a>
                </div>
            </div>
            <div class="actions">
                <button class="btn-approve" onclick="updateStatus('${c.phone}', 'client', 'active')">Aprobar ✅</button>
                <button class="btn-reject" onclick="updateStatus('${c.phone}', 'client', 'rejected')">Rechazar ❌</button>
            </div>
        </div>
    `).join('') || '<p class="empty">No hay clientes registrados en la base de datos.</p>';

    // Renderizar tarjetas de Conductores de forma persistente
    let driversHtml = drivers.map(d => `
        <div class="card">
            <div class="user-info">
                <h3>🚕 ${d.fullName || 'Sin Nombre'}</h3>
                <p><b>Teléfono:</b> ${d.phone}</p>
                <p><b>Registrado:</b> ${new Date(d.registeredAt).toLocaleString()}</p>
                <p><b>Estado:</b> <span class="badge ${d.status}">${d.status}</span></p>
                <div class="docs">
                    <a href="${d.selfieUrl}" target="_blank"><img src="${d.selfieUrl}" alt="Selfie"><span>Selfie</span></a>
                    <a href="${d.docFrontUrl}" target="_blank"><img src="${d.docFrontUrl}" alt="Licencia"><span>Licencia</span></a>
                    <a href="${d.docBackUrl}" target="_blank"><img src="${d.docBackUrl}" alt="Vehículo"><span>Vehículo</span></a>
                </div>
            </div>
            <div class="actions">
                <button class="btn-approve" onclick="updateStatus('${d.phone}', 'driver', 'active')">Aprobar ✅</button>
                <button class="btn-reject" onclick="updateStatus('${d.phone}', 'driver', 'rejected')">Rechazar ❌</button>
            </div>
        </div>
    `).join('') || '<p class="empty">No hay conductores registrados en la base de datos.</p>';

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Panel Maestro - Base de Datos Persistente</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
                body { background: #07090e; color: #fff; padding: 20px; }
                h1 { color: #38bdf8; margin-bottom: 5px; font-size: 20px; }
                p.sub { color: #94a3b8; font-size: 11px; margin-bottom: 15px; }
                
                /* Menú de pestañas profesional */
                .menu-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 10px; }
                .tab-btn { background: #1e293b; color: #94a3b8; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer; transition: 0.2s; }
                .tab-btn.active { background: #059669; color: white; box-shadow: 0 4px 12px rgba(5,150,105,0.3); }

                .section-content { display: none; }
                .section-content.active { display: block; }

                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; }
                .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; justify-content: space-between; }
                .user-info h3 { font-size: 14px; margin-bottom: 6px; color: #f8fafc; }
                .user-info p { font-size: 11px; color: #cbd5e1; margin-bottom: 3px; }
                .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-top: 4px; }
                .badge.pending_review { background: #eab308; color: #000; }
                .badge.active { background: #10b981; color: #fff; }
                .badge.rejected { background: #ef4444; color: #fff; }
                
                .docs { display: flex; gap: 8px; margin: 10px 0; }
                .docs a { text-align: center; text-decoration: none; color: #94a3b8; font-size: 9px; }
                .docs img { width: 55px; height: 55px; object-fit: cover; border-radius: 6px; border: 1px solid #334155; display: block; margin-bottom: 2px; }
                
                .actions { display: flex; gap: 8px; margin-top: 10px; }
                button.tab-action { cursor: pointer; }
                .actions button { flex: 1; padding: 8px; border: none; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer; }
                .btn-approve { background: #059669; color: white; }
                .btn-reject { background: #dc2626; color: white; }
                .empty { font-size: 12px; color: #64748b; font-style: italic; margin-top: 10px; }
            </style>
        </head>
        <body>
            <h1>⚙️ PANEL MAESTRO LIBREX</h1>
            <p class="sub">Administrador: ${email} (Base de datos permanente sincronizada)</p>

            <!-- Menú Selector -->
            <div class="menu-tabs">
                <button class="tab-btn active" id="btn-tab-clients" onclick="switchTab('clients')">👤 Ver Clientes (${clients.length})</button>
                <button class="tab-btn" id="btn-tab-drivers" onclick="switchTab('drivers')">🚕 Ver Conductores (${drivers.length})</button>
            </div>

            <!-- Sección Clientes -->
            <div id="tab-clients" class="section-content active">
                <h2 style="color: #34d399; font-size: 14px; margin-bottom: 10px;">Listado de Clientes Registrados</h2>
                <div class="grid">${clientsHtml}</div>
            </div>

            <!-- Sección Conductores -->
            <div id="tab-drivers" class="section-content">
                <h2 style="color: #38bdf8; font-size: 14px; margin-bottom: 10px;">Listado de Conductores Partners</h2>
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
            </script>
        </body>
        </html>
    `);
});

// Endpoint persistente para actualizar estado y guardar de inmediato en disco
app.post('/admin/update-status', (req, res) => {
    const { phone, role, status } = req.body;
    const db = getDB();

    if (role === 'driver' && db.drivers[phone]) {
        db.drivers[phone].status = status;
    } else if (role === 'client' && db.clients[phone]) {
        db.clients[phone].status = status;
    } else {
        return.json({ success: false, message: "Usuario no encontrado en los registros." });
    }

    // Escritura síncrona en el archivo JSON físico para garantizar persistencia absoluta
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    // Actualizar también el archivo info.json interno del usuario en su carpeta de archivos
    const safePhoneKey = phone.replace(/[^a-zA-Z0-9]/g, '_');
    const infoPath = path.join(UPLOADS_DIR, safePhoneKey, 'info.json');
    if (fs.existsSync(infoPath)) {
        try {
            const infoData = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
            infoData.status = status;
            fs.writeFileSync(infoPath, JSON.stringify(infoData, null, 2));
        } catch (e) {
            console.error("No se pudo actualizar el archivo info.json local:", e);
        }
    }

    res.json({ success: true });
});

// Exponer la carpeta de archivos multimedia para ver las fotos guardadas permanentemente
app.use('/uploads', express.static(UPLOADS_DIR));

app.listen(PORT, () => {
    console.log(`[LIBREX ADMIN] Servidor maestro operando en puerto ${PORT} con persistencia total en disco.`);
});
