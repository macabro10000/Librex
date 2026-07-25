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
    try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (Array.isArray(data.clients)) data.clients = {};
        if (Array.isArray(data.drivers)) data.drivers = {};
        if (!Array.isArray(data.admins)) data.admins = [];
        return data;
    } catch (e) {
        return { clients: {}, drivers: {}, admins: [] };
    }
}

function saveDB(dbData) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

function parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.split('=');
        name = name?.trim();
        if (!name) return;
        let value = rest.join('=').trim();
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

// Barra Flotante Avanzada para Administradores
function renderAdminFloatToolbar(currentContext) {
    return `
        <style>
            #librex-admin-bar {
                position: fixed;
                bottom: 15px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 23, 42, 0.92);
                border: 1px solid rgba(56, 189, 248, 0.4);
                padding: 8px 16px;
                border-radius: 35px;
                display: flex;
                gap: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.8);
                z-index: 999999;
                backdrop-filter: blur(10px);
            }
            #librex-admin-bar a {
                color: #f8fafc;
                text-decoration: none;
                font-size: 11px;
                font-weight: 700;
                padding: 6px 12px;
                border-radius: 20px;
                background: #1e293b;
                border: 1px solid #334155;
                transition: all 0.25s ease;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            #librex-admin-bar a:hover {
                background: #0284c7;
                border-color: #38bdf8;
                box-shadow: 0 0 12px rgba(56,189,248,0.4);
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
            <a href="/admin-logout" style="background: #7f1d1d; border-color: #991b1b;">🚪 Salir</a>
        </div>
    `;
}

// 1. Interfaz Principal / Home
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
                body { background: #030712; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #0f172a; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 20px; box-shadow: 0 0 40px rgba(0,0,0,0.9); position: relative; overflow: hidden; }
                @media(min-width: 430px) { .app-container { min-height: 880px; border-radius: 36px; border: 8px solid #1e293b; } }
                
                .header { text-align: center; margin-top: 10px; }
                .header h1 { font-size: 26px; color: #10b981; font-weight: 900; letter-spacing: 0.5px; text-shadow: 0 0 20px rgba(16,185,129,0.3); }
                .header p { font-size: 11px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }

                .menu-zones { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
                .zone-card { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155; border-radius: 14px; padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.3s ease; }
                .zone-card:hover { transform: translateY(-2px); border-color: #10b981; box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
                .zone-icon { font-size: 20px; background: #334155; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 10px; box-shadow: inset 0 2px 4px rgba(255,255,255,0.1); }
                .zone-info h3 { font-size: 13px; font-weight: 700; color: #f8fafc; }
                .zone-info p { font-size: 10px; color: #94a3b8; margin-top: 2px; }

                .form-box { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); padding: 14px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
                .form-box label { font-size: 10px; color: #cbd5e1; display: block; margin-bottom: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                .form-box input, .form-box select { width: 100%; padding: 9px 12px; border-radius: 10px; border: 1px solid #475569; background: #020617; color: white; font-size: 12px; margin-bottom: 8px; outline: none; transition: border-color 0.2s; }
                .form-box input:focus, .form-box select:focus { border-color: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.3); }

                .phone-group { display: flex; gap: 6px; }
                .phone-group select { width: 120px; }

                .file-upload-group { margin-bottom: 8px; background: #020617; padding: 8px; border-radius: 10px; border: 1px dashed #475569; transition: border-color 0.2s; }
                .file-upload-group:hover { border-color: #34d399; }
                .file-upload-group label { color: #34d399; font-size: 9px; margin-bottom: 4px; }
                .file-upload-group input[type="file"] { font-size: 10px; color: #94a3b8; background: transparent; border: none; padding: 0; margin: 0; }

                .form-box button { width: 100%; padding: 12px; border-radius: 12px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; border: none; font-weight: 800; font-size: 12px; cursor: pointer; margin-top: 6px; box-shadow: 0 4px 15px rgba(5, 150, 105, 0.4); transition: transform 0.1s, opacity 0.2s; text-transform: uppercase; letter-spacing: 0.5px; }
                .form-box button:active { transform: scale(0.98); }

                .footer-note { text-align: center; font-size: 9px; color: #64748b; margin-top: 4px; letter-spacing: 0.5px; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <h1>LIBREX RIDE 🚗</h1>
                    <p>Movilidad Profesional Verificada</p>
                </div>
                <div class="menu-zones">
                    <div class="zone-card" id="card-client" onclick="switchRole('client')" style="border-color: #059669;">
                        <div class="zone-icon">👤</div>
                        <div class="zone-info">
                            <h3>Pasajero / Cliente</h3>
                            <p>Solicita viajes de forma segura</p>
                        </div>
                    </div>
                    <div class="zone-card" id="card-driver" onclick="switchRole('driver')" style="border-color: #334155;">
                        <div class="zone-icon" style="background: #065f46;">🚕</div>
                        <div class="zone-info">
                            <h3>Conductor Partner</h3>
                            <p>Maneja y genera ganancias diarias</p>
                        </div>
                    </div>
                    <div class="zone-card" id="card-admin" onclick="switchRole('admin')" style="border-color: #334155;">
                        <div class="zone-icon" style="background: #1e3a8a;">⚙️</div>
                        <div class="zone-info">
                            <h3>Panel Maestro</h3>
                            <p>Revisión y activación de flota</p>
                        </div>
                    </div>
                    <div class="form-box" id="dynamic-form"></div>
                </div>
                <div class="footer-note">Librex Secure Platform v9.2 • Mobile Edition</div>
            </div>
            ${adminBarHtml}
            <script>
                let currentRole = 'client';
                renderForm('client');

                function switchRole(role) {
                    currentRole = role;
                    document.getElementById('card-client').style.borderColor = role === 'client' ? '#059669' : '#334155';
                    document.getElementById('card-driver').style.borderColor = role === 'driver' ? '#047857' : '#334155';
                    document.getElementById('card-admin').style.borderColor = role === 'admin' ? '#1d4ed8' : '#334155';
                    renderForm(role);
                }

                function renderForm(role) {
                    const container = document.getElementById('dynamic-form');
                    if (role === 'admin') {
                        container.innerHTML = \`
                            <p style="font-size: 11px; color: #38bdf8; margin-bottom: 8px; font-weight: bold; text-transform: uppercase;">Acceso Panel Administrador</p>
                            <label>Correo Electrónico:</label>
                            <input type="email" id="adm-email" placeholder="vitorinoarenas1000@gmail.com">
                            <label>Contraseña:</label>
                            <input type="password" id="adm-pass" placeholder="••••••••••••">
                            <button onclick="loginAdmin()" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); box-shadow: 0 4px 15px rgba(2,132,199,0.4);">Ingresar al Panel 🔐</button>
                        \`;
                    } else {
                        const title = role === 'client' ? 'Registro de Pasajero' : 'Registro de Conductor';
                        const doc1 = role === 'client' ? 'Cédula o Documento (Frente)' : 'Licencia de Conducción (Frente)';
                        const doc2 = role === 'client' ? 'Cédula o Documento (Dorso)' : 'Tarjeta de Propiedad del Vehículo';

                        container.innerHTML = \`
                            <p style="font-size: 11px; color: #34d399; margin-bottom: 8px; font-weight: bold; text-transform: uppercase;">\${title}</p>
                            <label>Nombre y Apellido:</label>
                            <input type="text" id="user-name" placeholder="Ej. Carlos Alberto Pérez">
                            <label>Selecciona tu País y Teléfono:</label>
                            <div class="phone-group">
                                <select id="country-code">
                                    <option value="+57">🇨🇴 +57 (Col)</option>
                                    <option value="+58">🇻🇪 +58 (Ven)</option>
                                    <option value="+51">🇵🇪 +51 (Per)</option>
                                    <option value="+52">🇲🇽 +52 (Mex)</option>
                                    <option value="+54">🇦🇷 +54 (Arg)</option>
                                    <option value="+1">🇺🇸 +1 (USA)</option>
                                    <option value="+34">🇪🇸 +34 (Esp)</option>
                                </select>
                                <input type="tel" id="user-phone" placeholder="3001234567">
                            </div>
                            <div class="file-upload-group">
                                <label>1. Fotografía de tu Rostro (Selfie):</label>
                                <input type="file" id="file-selfie" accept="image/*" capture="user">
                            </div>
                            <div class="file-upload-group">
                                <label>2. \${doc1}:</label>
                                <input type="file" id="file-doc-front" accept="image/*">
                            </div>
                            <div class="file-upload-group">
                                <label>3. \${doc2}:</label>
                                <input type="file" id="file-doc-back" accept="image/*">
                            </div>
                            <button onclick="registrarUsuario('\${role}')">Enviar Solicitud de Registro 🚀</button>
                        \`;
                    }
                }

                function loginAdmin() {
                    const email = document.getElementById('adm-email').value.trim();
                    const password = document.getElementById('adm-pass').value.trim();
                    fetch('/auth-admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) window.location.href = data.redirectUrl;
                        else alert(data.message);
                    });
                }

                function registrarUsuario(role) {
                    const fullName = document.getElementById('user-name').value.trim();
                    const country = document.getElementById('country-code').value;
                    const rawPhone = document.getElementById('user-phone').value.trim();
                    const phone = country + rawPhone;

                    const selfieInput = document.getElementById('file-selfie');
                    const frontInput = document.getElementById('file-doc-front');
                    const backInput = document.getElementById('file-doc-back');

                    if (!fullName || !rawPhone) {
                        alert("Por favor completa tu nombre y número de celular.");
                        return;
                    }
                    if (selfieInput.files.length === 0 || frontInput.files.length === 0 || backInput.files.length === 0) {
                        alert("Es obligatorio adjuntar tu selfie y ambos documentos requeridos.");
                        return;
                    }

                    const reader = new FileReader();
                    reader.readAsDataURL(selfieInput.files[0]);
                    reader.onload = function(e1) {
                        const selfie = e1.target.result;
                        const r2 = new FileReader();
                        r2.readAsDataURL(frontInput.files[0]);
                        r2.onload = function(e2) {
                            const frontDoc = e2.target.result;
                            const r3 = new FileReader();
                            r3.readAsDataURL(backInput.files[0]);
                            r3.onload = function(e3) {
                                const backDoc = e3.target.result;
                                fetch('/auth-user-direct', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ fullName, phone, role, selfie, frontDoc, backDoc })
                                })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success) {
                                        alert(data.message);
                                        location.reload();
                                    } else {
                                        alert(data.message);
                                    }
                                });
                            };
                        };
                    };
                }
            </script>
        </body>
        </html>
    `);
});

// 2. Autenticación de Administrador Maestro
app.post('/auth-admin', (req, res) => {
    const { email, password } = req.body;
    if (email === 'vitorinoarenas1000@gmail.com' && password === '94550Mic@') {
        const db = getDB();
        if (!db.admins.includes(email)) db.admins.push(email);
        saveDB(db);

        res.setHeader('Set-Cookie', [
            `librex_session_email=${encodeURIComponent(email)}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`,
            `librex_session_role=admin; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`
        ]);

        const redirectUrl = `${ADMIN_SERVICE_URL}/admin?key=librex2026&email=${encodeURIComponent(email)}`;
        return res.json({ success: true, redirectUrl });
    } else {
        return res.json({ success: false, message: "Credenciales de administrador incorrectas." });
    }
});

// 3. Ruta de Logout
app.get('/admin-logout', (req, res) => {
    res.setHeader('Set-Cookie', [
        `librex_session_email=; Path=/; Max-Age=0; HttpOnly`,
        `librex_session_role=; Path=/; Max-Age=0; HttpOnly`
    ]);
    res.redirect('/');
});

// 4. Endpoint de Registro Directo
app.post('/auth-user-direct', (req, res) => {
    const { fullName, phone, role, selfie, frontDoc, backDoc } = req.body;
    const safePhoneKey = phone.replace(/[^a-zA-Z0-9]/g, '_');
    const userFolder = path.join(UPLOADS_DIR, safePhoneKey);
    if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
    }

    try {
        const selfieBuffer = Buffer.from(selfie.split(',')[1], 'base64');
        const frontBuffer = Buffer.from(frontDoc.split(',')[1], 'base64');
        const backBuffer = Buffer.from(backDoc.split(',')[1], 'base64');

        fs.writeFileSync(path.join(userFolder, 'selfie.jpg'), selfieBuffer);
        fs.writeFileSync(path.join(userFolder, 'front.jpg'), frontBuffer);
        fs.writeFileSync(path.join(userFolder, 'back.jpg'), backBuffer);
    } catch (e) {
        console.error("Error guardando archivos en disco:", e);
    }

    const userData = {
        fullName,
        phone,
        role,
        selfieUrl: `/uploads/${safePhoneKey}/selfie.jpg`,
        docFrontUrl: `/uploads/${safePhoneKey}/front.jpg`,
        docBackUrl: `/uploads/${safePhoneKey}/back.jpg`,
        status: 'pending_review',
        registeredAt: new Date().toISOString()
    };

    fs.writeFileSync(path.join(userFolder, 'info.json'), JSON.stringify(userData, null, 2));

    const db = getDB();
    if (role === 'driver') {
        db.drivers[phone] = userData;
    } else {
        db.clients[phone] = userData;
    }
    saveDB(db);

    res.json({ 
        success: true, 
        message: "¡Registro enviado con éxito! Tus documentos están en revisión por el equipo central. Pronto serás activado." 
    });
});

app.use('/uploads', express.static(UPLOADS_DIR));

app.listen(PORT, () => {
    console.log(`[LIBREX TRANSPORT] Servidor operando profesionalmente en puerto ${PORT}`);
});
