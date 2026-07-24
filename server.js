const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// --- ARCHIVO DE BASE DE DATOS LOCAL (Persistencia segura) ---
const DB_FILE = path.join(__dirname, 'data.json');

function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { pending: {}, active: {} };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { pending: {}, active: {} };
    }
}

function saveDatabase(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const ADMIN_PASSWORD = "librex2026"; 

// 1. PORTAL DEL CONDUCTOR (Cámara real para fotos de cédula)
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
                input[type="file"] { background: #0f172a; padding: 8px; font-size: 13px; color: #38bdf8; border: 1px dashed #38bdf8; cursor: pointer; }
                button { background: #22c55e; color: white; font-weight: bold; cursor: pointer; border: none; margin-top: 20px; }
                .admin-link { display: block; text-align: center; margin-top: 25px; color: #64748b; font-size: 13px; text-decoration: none; padding: 8px; border: 1px dashed #334155; border-radius: 6px; }
                .admin-link:hover { color: #38bdf8; border-color: #38bdf8; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>Registro de Flota LIBREX</h1>
                    <form action="/register-driver" method="POST" enctype="multipart/form-data">
                        <label>Nombre y Apellido:</label>
                        <input type="text" name="name" required>
                        
                        <label>Número de Cédula:</label>
                        <input type="text" name="cedula" required>
                        
                        <label>Número Celular (WhatsApp):</label>
                        <input type="text" name="phone" required placeholder="Ej: 573001234567">
                        
                        <label>Tipo de Vehículo:</label>
                        <select name="vehicleType">
                            <option value="Particular">Particular</option>
                            <option value="Taxi">Taxi</option>
                        </select>
                        
                        <label>Marca y Modelo (Ej: Spark Gris):</label>
                        <input type="text" name="vehicleModel" required>
                        
                        <label>Placa:</label>
                        <input type="text" name="plate" required>

                        <label>📸 Foto Cédula (Frente):</label>
                        <input type="file" name="cedulaFront" accept="image/*" capture="environment" required>

                        <label>📸 Foto Cédula (Reverso):</label>
                        <input type="file" name="cedulaBack" accept="image/*" capture="environment" required>

                        <button type="submit">Enviar Registro y Documentos</button>
                    </form>
                    
                    <a href="/admin?key=librex2026" class="admin-link">🔐 Entrar a la Cuenta de Administrador</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

const multer = require('multer');
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/register-driver', upload.fields([{ name: 'cedulaFront', maxCount: 1 }, { name: 'cedulaBack', maxCount: 1 }]), (req, res) => {
    const data = req.body;
    const files = req.files;

    let frontBase64 = "";
    let backBase64 = "";

    if (files && files['cedulaFront'] && files['cedulaFront'][0]) {
        frontBase64 = `data:${files['cedulaFront'][0].mimetype};base64,${files['cedulaFront'][0].buffer.toString('base64')}`;
    }
    if (files && files['cedulaBack'] && files['cedulaBack'][0]) {
        backBase64 = `data:${files['cedulaBack'][0].mimetype};base64,${files['cedulaBack'][0].buffer.toString('base64')}`;
    }

    const db = loadDatabase();
    db.pending[data.phone] = {
        name: data.name,
        cedula: data.cedula,
        phone: data.phone,
        vehicleType: data.vehicleType,
        vehicleModel: data.vehicleModel,
        plate: data.plate,
        cedulaFront: frontBase64,
        cedulaBack: backBase64,
        time: new Date().toLocaleString()
    };
    saveDatabase(db);

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><title>Registro Exitoso</title></head>
        <body style="font-family:sans-serif; background:#0f172a; color:white; padding:50px; text-align:center;">
            <div style="background:#1e293b; padding:30px; border-radius:12px; max-width:400px; margin:0 auto; border:1px solid #334155;">
                <h2 style="color:#22c55e;">¡Registro y Fotos Recibidas!</h2>
                <p>Tus documentos han sido guardados y enviados al administrador.</p>
                <a href="/" style="color:#38bdf8; text-decoration:none; display:block; margin-top:20px;">Volver al inicio</a>
            </div>
        </body>
        </html>
    `);
});

// 2. PANEL DE ADMINISTRACIÓN (Con control total: Modificar, Congelar, Borrar y WhatsApp)
app.get('/admin', (req, res) => {
    if (req.query.key !== ADMIN_PASSWORD) {
        return res.send('<h2 style="font-family:sans-serif; background:#0f172a; color:#ef4444; padding:50px; text-align:center;">Acceso Denegado</h2>');
    }

    const db = loadDatabase();
    let pendingHTML = '';
    
    for (const [phone, d] of Object.entries(db.pending)) {
        pendingHTML += `
            <div style="background:#0f172a; padding:15px; margin-bottom:15px; border-radius:8px; border:1px solid #334155;">
                <div>
                    <b>${d.name}</b> (${d.vehicleType})<br>
                    <span style="font-size:12px; color:#94a3b8;">Cédula Nº: ${d.cedula} | Tel: ${d.phone}</span><br>
                    <span style="font-size:12px; color:#facc15;">Carro: ${d.vehicleModel} [Placa: ${d.plate}]</span><br><br>
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <div>
                            <span style="font-size:11px; color:#38bdf8; display:block;">Cédula Frente:</span>
                            <img src="${d.cedulaFront}" style="width:120px; height:80px; object-fit:cover; border-radius:4px; border:1px solid #334155;" />
                        </div>
                        <div>
                            <span style="font-size:11px; color:#38bdf8; display:block;">Cédula Reverso:</span>
                            <img src="${d.cedulaBack}" style="width:120px; height:80px; object-fit:cover; border-radius:4px; border:1px solid #334155;" />
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-top:12px;">
                    <form action="/admin/approve" method="POST" style="flex:1;">
                        <input type="hidden" name="phone" value="${phone}">
                        <button type="submit" style="width:100%; background:#22c55e; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer;">Aprobar</button>
                    </form>
                    <form action="/admin/delete" method="POST">
                        <input type="hidden" name="phone" value="${phone}">
                        <input type="hidden" name="type" value="pending">
                        <button type="submit" style="background:#ef4444; color:white; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer;" onclick="return confirm('¿Seguro que deseas borrar este registro?')">🗑️ Borrar</button>
                    </form>
                </div>
            </div>`;
    }

    let activeHTML = '';
    for (const [phone, d] of Object.entries(db.active)) {
        const isFrozen = d.status === 'frozen';
        const statusColor = isFrozen ? '#f97316' : '#22c55e';
        const statusText = isFrozen ? '❄️ CONGELADO / SUSPENDIDO' : '🟢 ACTIVO';
        const balanceColor = d.balance > 0 ? '#22c55e' : '#ef4444';
        
        const whatsappMsg = encodeURIComponent(`¡Hola ${d.name}! Te escribimos desde Librex 🚖. Estado de tu cuenta: ${isFrozen ? 'Suspendida temporalmente.' : 'Activa.'}`);
        const whatsappUrl = `https://wa.me/${phone}?text=${whatsappMsg}`;

        activeHTML += `
            <div style="background:#0f172a; padding:15px; margin-bottom:15px; border-radius:8px; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <b>${d.name}</b> - ${d.plate} (${d.vehicleType})<br>
                        <span style="font-size:12px; color:${statusColor}; font-weight:bold;">${statusText}</span><br>
                        <span style="font-size:12px; color:#94a3b8;">Cédula: ${d.cedula} | Tel: ${phone}</span><br>
                        <a href="${whatsappUrl}" target="_blank" style="display:inline-block; margin-top:6px; background:#16a34a; color:white; padding:5px 10px; border-radius:4px; font-size:12px; text-decoration:none; font-weight:bold;">💬 Enviar WhatsApp</a>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:16px; font-weight:bold; color:${balanceColor};">$ ${d.balance.toLocaleString()}</span><br>
                        <span style="font-size:11px; color:#94a3b8;">Saldo Disponible</span>
                    </div>
                </div>

                <!-- CONTROLES FINANCIEROS Y DE ESTADO -->
                <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
                    <form action="/admin/finance/adjust" method="POST" style="display:flex; gap:5px;">
                        <input type="hidden" name="phone" value="${phone}">
                        <input type="number" name="amount" placeholder="Ajustar saldo (+50000 o -10000)" style="padding:6px; background:#1e293b; border:1px solid #334155; color:white; border-radius:4px; flex:1;" required>
                        <button type="submit" style="background:#38bdf8; color:#0f172a; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Saldo</button>
                    </form>

                    <div style="display:flex; gap:5px;">
                        <form action="/admin/toggle-freeze" method="POST" style="flex:1;">
                            <input type="hidden" name="phone" value="${phone}">
                            <button type="submit" style="width:100%; background:${isFrozen ? '#22c55e' : '#f97316'}; color:white; border:none; padding:6px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer;">
                                ${isFrozen ? '✅ Activar Cuenta' : '❄️ Congelar Cuenta'}
                            </button>
                        </form>
                        <form action="/admin/delete" method="POST">
                            <input type="hidden" name="phone" value="${phone}">
                            <input type="hidden" name="type" value="active">
                            <button type="submit" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer;" onclick="return confirm('¿Seguro que deseas eliminar este conductor?')">🗑️ Borrar</button>
                        </form>
                    </div>

                    <!-- FORMULARIO PARA MODIFICAR DATOS -->
                    <details style="background:#1e293b; padding:8px; border-radius:6px; border:1px solid #334155; margin-top:5px;">
                        <summary style="font-size:12px; color:#38bdf8; cursor:pointer; font-weight:bold;">✏️ Modificar Datos del Conductor</summary>
                        <form action="/admin/update" method="POST" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                            <input type="hidden" name="phone" value="${phone}">
                            <input type="text" name="name" value="${d.name}" placeholder="Nombre" style="padding:6px; background:#0f172a; border:1px solid #334155; color:white; border-radius:4px; font-size:12px;" required>
                            <input type="text" name="cedula" value="${d.cedula}" placeholder="Cédula" style="padding:6px; background:#0f172a; border:1px solid #334155; color:white; border-radius:4px; font-size:12px;" required>
                            <input type="text" name="vehicleModel" value="${d.vehicleModel}" placeholder="Vehículo" style="padding:6px; background:#0f172a; border:1px solid #334155; color:white; border-radius:4px; font-size:12px;" required>
                            <input type="text" name="plate" value="${d.plate}" placeholder="Placa" style="padding:6px; background:#0f172a; border:1px solid #334155; color:white; border-radius:4px; font-size:12px;" required>
                            <button type="submit" style="background:#eab308; color:#0f172a; border:none; padding:6px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer;">Guardar Cambios</button>
                        </form>
                    </details>
                </div>
            </div>`;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><title>Admin Librex</title></head>
        <body style="font-family:sans-serif; background:#0f172a; color:white; padding:20px;">
            <div style="max-width:700px; margin:0 auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155; margin-bottom:20px;">
                    <div>
                        <h1 style="color:#38bdf8; margin:0; font-size:20px;">Panel de Administración Total</h1>
                        <p style="color:#94a3b8; margin:5px 0 0 0; font-size:13px;">Control de conductores, congelamiento, edición y saldos.</p>
                    </div>
                    <a href="/" style="background:#334155; color:white; padding:8px 12px; border-radius:6px; text-decoration:none; font-size:13px;">Volver al Registro</a>
                </div>

                <div style="background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155; margin-bottom:20px;">
                    <h2 style="color:#facc15; margin-top:0; font-size:16px;">Solicitudes Pendientes</h2>
                    ${pendingHTML || '<p style="color:#64748b; font-size:14px;">No hay solicitudes pendientes.</p>'}
                </div>

                <div style="background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155;">
                    <h2 style="color:#22c55e; margin-top:0; font-size:16px;">Flota Aprobada y Controles</h2>
                    ${activeHTML || '<p style="color:#64748b; font-size:14px;">No hay conductores aprobados todavía.</p>'}
                </div>
            </div>
        </body>
        </html>
    `);
});

// --- ACCIONES DE ADMINISTRACIÓN TOTAL ---

app.post('/admin/approve', (req, res) => {
    const { phone } = req.body;
    const db = loadDatabase();
    if (db.pending[phone]) {
        db.active[phone] = { ...db.pending[phone], balance: 0, status: 'active' };
        delete db.pending[phone];
        saveDatabase(db);
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

app.post('/admin/delete', (req, res) => {
    const { phone, type } = req.body;
    const db = loadDatabase();
    if (type === 'pending' && db.pending[phone]) {
        delete db.pending[phone];
        saveDatabase(db);
    } else if (type === 'active' && db.active[phone]) {
        delete db.active[phone];
        saveDatabase(db);
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

app.post('/admin/toggle-freeze', (req, res) => {
    const { phone } = req.body;
    const db = loadDatabase();
    if (db.active[phone]) {
        db.active[phone].status = db.active[phone].status === 'frozen' ? 'active' : 'frozen';
        saveDatabase(db);
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

app.post('/admin/update', (req, res) => {
    const { phone, name, cedula, vehicleModel, plate } = req.body;
    const db = loadDatabase();
    if (db.active[phone]) {
        db.active[phone].name = name;
        db.active[phone].cedula = cedula;
        db.active[phone].vehicleModel = vehicleModel;
        db.active[phone].plate = plate;
        saveDatabase(db);
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

app.post('/admin/finance/adjust', (req, res) => {
    const { phone, amount } = req.body;
    const adjustValue = parseFloat(amount);
    const db = loadDatabase();

    if (db.active[phone] && !isNaN(adjustValue)) {
        db.active[phone].balance += adjustValue;
        saveDatabase(db);
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Operando en puerto ${PORT}`);
});
