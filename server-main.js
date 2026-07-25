const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'registered-emails-db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CODES_FILE = path.join(__dirname, 'verification-codes-db.json');

// Asegurar directorios y bases de datos locales
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
    return data;
}

function getCodesDB() {
    if (!fs.existsSync(CODES_FILE)) {
        fs.writeFileSync(CODES_FILE, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
}

// Configuración del transporter de Nodemailer para envío real
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'vitorinoarenas1000@gmail.com', // Coloca tu correo o variable de entorno
        pass: process.env.EMAIL_PASS || 'TU_CONTRASENA_DE_APLICACION'   // Coloca tu contraseña de aplicación de Gmail
    }
});

// Lector nativo de cookies
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
const DRIVER_SERVICE_URL = process.env.DRIVER_URL || 'http://localhost:3002';
const ADMIN_SERVICE_URL = process.env.ADMIN_URL || 'http://localhost:3003';

// 1. Pantalla principal con Auto-Login nativo, Doble Cédula y Validación de Correo
app.get('/', (req, res) => {
    const cookies = parseCookies(req);
    const savedEmail = cookies.librex_session_email;
    const savedRole = cookies.librex_session_role;

    if (savedEmail && savedRole) {
        const db = getDB();
        const user = savedRole === 'driver' ? db.drivers[savedEmail] : db.clients[savedEmail];
        if (user) {
            const targetUrl = savedRole === 'driver' ? DRIVER_SERVICE_URL : USER_SERVICE_URL;
            return res.redirect(`${targetUrl}/?email=${encodeURIComponent(savedEmail)}&name=${encodeURIComponent(user.fullName)}&picture=${encodeURIComponent(user.selfieUrl)}`);
        }
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Registro Inteligente y Seguro</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #090d16; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #111827; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 20px; box-shadow: 0 0 25px rgba(0,0,0,0.5); }
                @media(min-width: 430px) { .app-container { min-height: 880px; border-radius: 36px; border: 8px solid #1f2937; } }
                .header { text-align: center; margin-top: 10px; }
                .header h1 { font-size: 24px; color: #38bdf8; font-weight: 800; letter-spacing: 1px; }
                .header p { font-size: 11px; color: #9ca3af; margin-top: 2px; }
                
                .menu-zones { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
                .zone-card { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 10px; display: flex; align-items: center; gap: 10px; color: white; cursor: pointer; transition: 0.2s ease; }
                .zone-icon { font-size: 20px; background: #374151; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
                .zone-info h3 { font-size: 12px; font-weight: 700; color: #f3f4f6; }
                .zone-info p { font-size: 9px; color: #9ca3af; }

                .form-box { background: #1f2937; padding: 12px; border-radius: 12px; border: 1px solid #374151; }
                .form-box label { font-size: 10px; color: #9ca3af; display: block; margin-bottom: 2px; }
                .form-box input { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #4b5563; background: #0b0f19; color: white; font-size: 12px; margin-bottom: 6px; }
                .file-upload-group { margin-bottom: 6px; background: #0b0f19; padding: 6px; border-radius: 6px; border: 1px dashed #4b5563; }
                .file-upload-group label { color: #38bdf8; font-weight: 600; font-size: 10px; }
                .form-box button { width: 100%; padding: 10px; border-radius: 8px; background: #0284c7; color: white; border: none; font-weight: 700; font-size: 12px; cursor: pointer; margin-top: 4px; }
                .secondary-btn { background: #374151 !important; margin-top: 4px; }
                .footer-note { text-align: center; font-size: 9px; color: #4b5563; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <h1>LIBREX 🚖</h1>
                    <p>Verificación Biométrica y Documental Dual</p>
                </div>
                
                <div class="menu-zones">
                    <div class="zone-card" id="card-client" onclick="switchRole('client')" style="border-color: #38bdf8;">
                        <div class="zone-icon">👤</div>
                        <div class="zone-info">
                            <h3>Modo Cliente</h3>
                            <p>Selfie + Cédula (Frente y Dorso)</p>
                        </div>
                    </div>

                    <div class="zone-card" id="card-driver" onclick="switchRole('driver')" style="border-color: #374151;">
                        <div class="zone-icon" style="background: #14532d;">🚗</div>
                        <div class="zone-info">
                            <h3>Modo Conductor</h3>
                            <p>Selfie + Licencia (Frente y Dorso)</p>
                        </div>
                    </div>

                    <div class="zone-card" id="card-admin" onclick="switchRole('admin')" style="border-color: #374151;">
                        <div class="zone-icon" style="background: #1e40af;">🔐</div>
                        <div class="zone-info">
                            <h3>Modo Administrador</h3>
                            <p>Acceso exclusivo maestro</p>
                        </div>
                    </div>

                    <div class="form-box" id="dynamic-form"></div>
                </div>

                <div class="footer-note">Librex Secure Persistent v6.1</div>
            </div>

            <script>
                let currentRole = 'client';
                renderForm('client');

                function switchRole(role) {
                    currentRole = role;
                    document.getElementById('card-client').style.borderColor = role === 'client' ? '#38bdf8' : '#374151';
                    document.getElementById('card-driver').style.borderColor = role === 'driver' ? '#166534' : '#374151';
                    document.getElementById('card-admin').style.borderColor = role === 'admin' ? '#1e3a8a' : '#374151';
                    renderForm(role);
                }

                function renderForm(role) {
                    const container = document.getElementById('dynamic-form');
                    if (role === 'admin') {
                        container.innerHTML = \`
                            <p style="font-size: 11px; color: #38bdf8; margin-bottom: 6px;">Panel de Administrador</p>
                            <label>Correo Electrónico:</label>
                            <input type="email" id="adm-email" placeholder="vitorinoarenas1000@gmail.com">
                            <label>Contraseña:</label>
                            <input type="password" id="adm-pass" placeholder="••••••••••••">
                            <button onclick="loginAdmin()">Ingresar como Admin 🔐</button>
                        \`;
                    } else {
                        const title = role === 'client' ? 'Registro de Cliente' : 'Registro de Conductor';
                        const color = role === 'client' ? '#38bdf8' : '#16a34a';
                        const btnColor = role === 'client' ? '#0284c7' : '#166534';
                        const docName = role === 'client' ? 'Cédula de Identidad' : 'Licencia de Conducción';

                        container.innerHTML = \`
                            <p style="font-size: 11px; color: \${color}; margin-bottom: 4px;">\${title}</p>
                            <label>Nombre Completo:</label>
                            <input type="text" id="user-name" placeholder="Ej. Carlos Mario Pérez">
                            
                            <label>Correo Electrónico (Validación obligatoria):</label>
                            <input type="email" id="user-email" placeholder="tucorreo@gmail.com">
                            <button type="button" class="secondary-btn" onclick="solicitarCodigo()">Enviar Código de Verificación ✉️</button>

                            <div id="verification-box" style="display:none; margin-top: 6px;">
                                <label>Código recibido en tu correo:</label>
                                <input type="text" id="ver-code" placeholder="Ej. 482910">
                            </div>
                            
                            <div class="file-upload-group" style="margin-top:6px;">
                                <label>1. Tomar Selfie (Rostro):</label>
                                <input type="file" id="file-selfie" accept="image/*" capture="user">
                            </div>

                            <div class="file-upload-group">
                                <label>2. \${docName} (Lado FRONTAL):</label>
                                <input type="file" id="file-doc-front" accept="image/*">
                            </div>

                            <div class="file-upload-group">
                                <label>3. \${docName} (Lado DORSO / Trasero):</label>
                                <input type="file" id="file-doc-back" accept="image/*">
                            </div>

                            <button onclick="registrarUsuario('\${role}')" style="background: \${btnColor};">Verificar y Registrarse 🚀</button>
                        \`;
                    }
                }

                function solicitarCodigo() {
                    const email = document.getElementById('user-email').value.trim();
                    if (!email || !email.includes('@')) {
                        alert("Ingresa un correo electrónico válido antes de pedir el código.");
                        return;
                    }
                    fetch('/api/send-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    })
                    .then(res => res.json())
                    .then(data => {
                        alert(data.message);
                        if (data.success) {
                            document.getElementById('verification-box').style.display = 'block';
                        }
                    })
                    .catch(() => alert("Error de conexión al enviar el código."));
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
                    const email = document.getElementById('user-email').value.trim();
                    const code = document.getElementById('ver-code') ? document.getElementById('ver-code').value.trim() : '';
                    const selfieInput = document.getElementById('file-selfie');
                    const frontInput = document.getElementById('file-doc-front');
                    const backInput = document.getElementById('file-doc-back');

                    if (!fullName || !email || !code) {
                        alert("Por favor completa nombre, correo y el código de verificación.");
                        return;
                    }
                    if (selfieInput.files.length === 0 || frontInput.files.length === 0 || backInput.files.length === 0) {
                        alert("Debes adjuntar tu selfie, la parte frontal y la parte posterior del documento.");
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

                                fetch('/auth-user-media-dual', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ fullName, email, code, role, selfie, frontDoc, backDoc })
                                })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success) {
                                        window.location.href = data.redirectUrl;
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

// 2. Generar y Enviar Código Real al Correo mediante Nodemailer
app.post('/api/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
        return res.json({ success: false, message: "Correo inválido." });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codesDB = getCodesDB();
    codesDB[email] = verificationCode;
    fs.writeFileSync(CODES_FILE, JSON.stringify(codesDB, null, 2));

    const mailOptions = {
        from: '"Librex Support" <no-reply@librex.com>',
        to: email,
        subject: 'Código de Verificación - Librex 🚖',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f3f4f6; border-radius: 10px;">
                <h2 style="color: #0284c7;">Bienvenido a Librex 🚖</h2>
                <p>Tu código de verificación para continuar con el registro es:</p>
                <div style="background: #ffffff; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; color: #111827; border-radius: 6px; letter-spacing: 4px; margin: 15px 0;">
                    ${verificationCode}
                </div>
                <p style="font-size: 12px; color: #6b7280;">Si no solicitaste este código, puedes ignorar este mensaje.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[CORREO ENVIADO] Código ${verificationCode} enviado exitosamente a ${email}`);
        res.json({ success: true, message: `Código de verificación enviado correctamente a ${email}. Revisa tu bandeja de entrada o spam.` });
    } catch (error) {
        console.error("Error al enviar el correo:", error);
        // Fallback para desarrollo local si falla el servicio SMTP de correo
        res.json({ 
            success: true, 
            message: `Código generado (Modo local de respaldo): ${verificationCode}. (Revisa tu consola si el correo demoró)` 
        });
    }
});

// 3. Autenticación de Administrador
app.post('/auth-admin', (req, res) => {
    const { email, password } = req.body;
    if (email === 'vitorinoarenas1000@gmail.com' && password === '94550Mic@') {
        const db = getDB();
        if (!db.admins.includes(email)) db.admins.push(email);
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

        res.setHeader('Set-Cookie', [
            `librex_session_email=${encodeURIComponent(email)}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`,
            `librex_session_role=admin; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`
        ]);

        const redirectUrl = `${ADMIN_SERVICE_URL}/admin?key=librex2026&email=${encodeURIComponent(email)}`;
        return res.json({ success: true, redirectUrl });
    } else {
        return res.json({ success: false, message: "Credenciales incorrectas." });
    }
});

// 4. Procesador de Registro con Validación de Código y Doble Cara de Documento
app.post('/auth-user-media-dual', (req, res) => {
    const { fullName, email, code, role, selfie, frontDoc, backDoc } = req.body;
    
    const codesDB = getCodesDB();
    if (!codesDB[email] || codesDB[email] !== code) {
        return res.json({ success: false, message: "El código de verificación del correo es incorrecto o expiró." });
    }

    const safeEmailKey = email.replace(/[^a-zA-Z0-9]/g, '_');

    try {
        const selfieBuffer = Buffer.from(selfie.split(',')[1], 'base64');
        const frontBuffer = Buffer.from(frontDoc.split(',')[1], 'base64');
        const backBuffer = Buffer.from(backDoc.split(',')[1], 'base64');

        fs.writeFileSync(path.join(UPLOADS_DIR, `${safeEmailKey}_selfie.jpg`), selfieBuffer);
        fs.writeFileSync(path.join(UPLOADS_DIR, `${safeEmailKey}_front.jpg`), frontBuffer);
        fs.writeFileSync(path.join(UPLOADS_DIR, `${safeEmailKey}_back.jpg`), backBuffer);
    } catch (e) {
        console.error("Error guardando archivos:", e);
    }

    const db = getDB();
    const userData = {
        fullName,
        email,
        selfieUrl: `/uploads/${safeEmailKey}_selfie.jpg`,
        docFrontUrl: `/uploads/${safeEmailKey}_front.jpg`,
        docBackUrl: `/uploads/${safeEmailKey}_back.jpg`,
        verified: true,
        updatedAt: new Date().toISOString()
    };

    if (role === 'driver') {
        db.drivers[email] = userData;
    } else {
        db.clients[email] = userData;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    res.setHeader('Set-Cookie', [
        `librex_session_email=${encodeURIComponent(email)}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`,
        `librex_session_role=${role}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`
    ]);

    const protocol = req.protocol;
    const host = req.get('host');
    const absolutePictureUrl = `${protocol}://${host}/uploads/${safeEmailKey}_selfie.jpg`;

    let redirectUrl = role === 'driver' ? DRIVER_SERVICE_URL : USER_SERVICE_URL;
    const finalRedirect = `${redirectUrl}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(fullName)}&picture=${encodeURIComponent(absolutePictureUrl)}&verified=true`;

    res.json({ success: true, redirectUrl: finalRedirect });
});

// 5. Consulta y Archivos Públicos
app.get('/api/user-profile', (req, res) => {
    const { email } = req.query;
    const db = getDB();
    const user = db.clients[email] || db.drivers[email];
    if (user) res.json({ success: true, user });
    else res.json({ success: false, message: "No encontrado." });
});

app.use('/uploads', express.static(UPLOADS_DIR));

app.listen(PORT, () => {
    console.log(`[SERVER-MAIN] Servidor principal con envío de correos real activo en puerto ${PORT}`);
});
