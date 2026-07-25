const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'librex-transport-db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ clients: {}, drivers: {}, admins: [] }, null, 2));
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (Array.isArray(data.clients)) data.clients = {};
    if (Array.isArray(data.drivers)) data.drivers = {};
    if (!Array.isArray(data.admins)) data.admins = [];
    return data;
}

function saveDB(dbData) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

function parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach(cookie => {
        let [name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        let value = rest.join(`=`).trim();
        if (/^"/.test(value)) value = value.slice(1, -1);
        try {
            list[name] = decodeURIComponent(value);
        } catch (e) {
            list[name] = value;
        }
    });
    return list;
}

const USER_SERVICE_URL = process.env.USER_URL || 'https://librex-7j4i.onrender.com';
const DRIVER_SERVICE_URL = process.env.DRIVER_URL || 'https://librex-ppna.onrender.com';
const ADMIN_SERVICE_URL = process.env.ADMIN_URL || 'https://librex-ppna.onrender.com';

function renderAdminFloatToolbar(currentContext) {
    return `
        <style>
            #librex-admin-bar {
                position: fixed;
                bottom: 15px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 23, 42, 0.95);
                border: 2px solid #38bdf8;
                padding: 8px 14px;
                border-radius: 30px;
                display: flex;
                gap: 10px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.8);
                z-index: 999999;
                backdrop-filter: blur(6px);
            }
            #librex-admin-bar a {
                color: #fff;
                text-decoration: none;
                font-size: 11px;
                font-weight: bold;
                padding: 6px 12px;
                border-radius: 20px;
                background: #1e293b;
                border: 1px solid #475569;
                transition: 0.2s;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            #librex-admin-bar a:hover {
                background: #0284c7;
                border-color: #38bdf8;
            }
            #librex-admin-bar a.active {
                background: #0369a1;
                border-color: #38bdf8;
            }
        </style>
        <div id="librex-admin-bar">
            <a href="/" class="${currentContext === 'home' ? 'active' : ''}">🏠 Inicio</a>
            <a href="${ADMIN_SERVICE_URL}/admin?key=librex2026&email=vitorinoarenas1000@gmail.com" class="${currentContext === 'admin' ? 'active' : ''}">⚙️ Panel</a>
            <a href="${DRIVER_SERVICE_URL}" class="${currentContext === 'driver' ? 'active' : ''}">🚕 Conductor</a>
            <a href="${USER_SERVICE_URL}" class="${currentContext === 'client' ? 'active' : ''}">👤 Pasajero</a>
            <a href="/admin-logout" style="background: #991b1b; border-color: #dc2626;">🚪 Salir</a>
        </div>
    `;
}

// 1. Interfaz Principal / Inicio
app.get('/', (req, res) => {
    const cookies = parseCookies(req);
    const savedRole = cookies.librex_session_role;
    const savedEmail = cookies.librex_session_email;
    const isAdmin = savedRole === 'admin' && savedEmail;

    let adminBarHtml = isAdmin ? renderAdminFloatToolbar('home') : '';

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex Transport - Acceso Maestro</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #07090e; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #0f172a; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 20px; box-shadow: 0 0 30px rgba(0,0,0,0.8); }
                @media(min-width: 430px) { .app-container { min-height: 880px; border-radius: 36px; border: 8px solid #1e293b; } }
                .header { text-align: center; margin-top: 10px; }
                .header h1 { font-size: 26px; color: #10b981; font-weight: 900; letter-spacing: 1px; }
                .header p { font-size: 11px; color: #94a3b8; margin-top: 4px; }
                .menu-zones { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
                .zone-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s; }
                .zone-icon { font-size: 20px; background: #334155; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
                .zone-info h3 { font-size: 12px; font-weight: 700; color: #f8fafc; }
                .zone-info p { font-size: 9px; color: #94a3b8; }
                .footer-note { text-align: center; font-size: 9px; color: #64748b; margin-bottom: 4px; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <h1>LIBREX RIDE 🚗</h1>
                    <p>Movilidad Profesional Verificada</p>
                </div>
                <div class="menu-zones">
                    <div class="zone-card" onclick="window.location.href='${USER_SERVICE_URL}'" style="border-color: #059669;">
                        <div class="zone-icon">👤</div>
                        <div class="zone-info">
                            <h3>Pasajero / Cliente</h3>
                            <p>Solicita viajes de forma segura</p>
                        </div>
                    </div>
                    <div class="zone-card" onclick="window.location.href='${DRIVER_SERVICE_URL}'" style="border-color: #334155;">
                        <div class="zone-icon" style="background: #065f46;">🚕</div>
                        <div class="zone-info">
                            <h3>Conductor Partner</h3>
                            <p>Conduce y genera ingresos</p>
                        </div>
                    </div>
                </div>
                <div class="footer-note">Librex System Gateway © 2026</div>
            </div>
            ${adminBarHtml}
        </body>
        </html>
    `);
});

// 2. Endpoint para recibir registros de clientes y guardarlos en el JSON general
app.post('/api/register/client', (req, res) => {
    try {
        const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
        const db = getDB();

        const safePhoneKey = phone.replace(/[^a-zA-Z0-9]/g, '_');
        const userDir = path.join(UPLOADS_DIR, safePhoneKey);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        let selfieUrl = '';
        let docFrontUrl = '';
        let docBackUrl = '';

        if (selfieBase64) {
            const matches = selfieBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/;
            const buffer = Buffer.from(matches ? matches[2] : selfieBase64, 'base64');
            fs.writeFileSync(path.join(userDir, 'selfie.jpg'), buffer);
            selfieUrl = `/uploads/${safePhoneKey}/selfie.jpg`;
        }

        db.clients[phone] = {
            phone,
            fullName,
            email,
            selfieUrl,
            docFrontUrl,
            docBackUrl,
            status: 'pending_review',
            registeredAt: new Date().toISOString()
        };

        saveDB(db);
        res.json({ success: true, message: 'Cliente registrado con éxito en el servidor central.' });
    } catch (e) {
        console.error('Error al registrar cliente:', e);
        res.status(500).json({ success: false, message: 'Error interno guardando los datos del cliente.' });
    }
});

app.get('/admin-logout', (req, res) => {
    res.setHeader('Set-Cookie', 'librex_session_role=; Max-Age=0; path=/;');
    res.redirect('/');
});

app.use('/uploads', express.static(UPLOADS_DIR));

app.listen(PORT, () => {
    console.log(`[LIBREX MAIN SERVER] Servidor Principal Gateway en puerto ${PORT}`);
});
