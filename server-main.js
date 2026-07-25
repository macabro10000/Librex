const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'registered-emails-db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Asegurar que existan la base de datos y la carpeta persistente de archivos multimedia
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ clients: {}, drivers: {}, admins: [] }, null, 2));
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // Compatibilidad por si la BD antigua era un array
    if (Array.isArray(data.clients)) data.clients = {};
    if (Array.isArray(data.drivers)) data.drivers = {};
    return data;
}

const USER_SERVICE_URL = process.env.USER_URL || 'https://librex-7j4i.onrender.com';
const DRIVER_SERVICE_URL = process.env.DRIVER_URL || 'http://localhost:3002';
const ADMIN_SERVICE_URL = process.env.ADMIN_URL || 'http://localhost:3003';

// 1. Pantalla principal con campo de Nombre Completo y subida biométrica real
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Registro y Perfil Real</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #090d16; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #111827; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; box-shadow: 0 0 25px rgba(0,0,0,0.5); }
                @media(min-width: 430px) { .app-container { min-height: 850px; border-radius: 36px; border: 8px solid #1f2937; } }
                .header { text-align: center; margin-top: 15px; }
                .header h1 { font-size: 26px; color: #38bdf8; font-weight: 800; letter-spacing: 1px; }
                .header p { font-size: 12px; color: #9ca3af; margin-top: 4px; }
                
                .menu-zones { display: flex; flex-direction: column; gap: 10px; margin: 12px 0; }
                .zone-card { background: #1f2937; border: 1px solid #374151; border-radius: 14px; padding: 12px; display: flex; align-items: center; gap: 10px; color: white; cursor: pointer; transition: 0.2s ease; }
                .zone-card:active { transform: scale(0.97); }
                .zone-icon { font-size: 22px; background: #374151; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
                .zone-info h3 { font-size: 13px; font-weight: 700; color: #f3f4f6; }
                .zone-info p { font-size: 10px; color: #9ca3af; margin-top: 1px; }

                .form-box { background: #1f2937; padding: 14px; border-radius: 14px; border: 1px solid #374151; }
                .form-box label { font-size: 11px; color: #9ca3af; display: block; margin-bottom: 3px; }
                .form-box input { width: 100%; padding: 9px; border-radius: 8px; border: 1px solid #4b5563; background: #0b0f19; color: white; font-size: 13px; margin-bottom: 8px; }
                .file-upload-group { margin-bottom: 8px; background: #0b0f19; padding: 7px; border-radius: 8px; border: 1px dashed #4b5563; }
                .file-upload-group label { color: #38bdf8; font-weight: 600; font-size: 11px; }
                .form-box button { width: 100%; padding: 11px; border-radius: 10px; background: #0284c7; color: white; border: none; font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 4px; }
                
                .footer-note { text-align: center; font-size: 10px; color: #4b5563; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <h1>LIBREX 🚖</h1>
                    <p>Identidad y Biometría Segura</p>
                </div>
                
                <div class="menu-zones">
                    <div class="zone-card" id="card-client" onclick="switchRole('client')" style="border-color: #38bdf8;">
                        <div class="zone-icon">👤</div>
                        <div class="zone-info">
                            <h3>Modo Cliente</h3>
                            <p>Nombre + Selfie + Cédula</p>
                        </div>
                    </div>

                    <div class="zone-card" id="card-driver" onclick="switchRole('driver')" style="border-color: #374151;">
                        <div class="zone-icon" style="background: #14532d;">🚗</div>
                        <div class="zone-info">
                            <h3>Modo Conductor</h3>
                            <p>Nombre + Selfie + Licencia</p>
                        </div>
                    </div>

                    <div class="zone-card" id="card-admin" onclick="switchRole('admin')" style="border-color: #374151;">
                        <div class="zone-icon" style="background: #1e40af;">🔐</div>
                        <div class="zone-info">
                            <h3>Modo Administrador</h3>
                            <p>Acceso exclusivo con clave</p>
                        </div>
                    </div>

                    <div class="form-box" id="dynamic-form"></div>
                </div>

                <div class="footer-note">Librex Secure Persistent v5.2</div>
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
                            <p style="font-size: 12px; color: #38bdf8; margin-bottom: 8px;">Panel de Administrador</p>
                            <label>Correo Electrónico:</label>
                            <input type="email" id="adm-email" placeholder="vitorinoarenas1000@gmail.com">
                            <label>Contraseña de Acceso:</label>
                            <input type="password" id="adm-pass" placeholder="••••••••••••">
                            <button onclick="loginAdmin()">Ingresar como Admin 🔐</button>
                        \`;
                    } else {
                        const title = role === 'client' ? 'Registro de Cliente' : 'Registro de Conductor';
                        const color = role === 'client' ? '#38bdf8' : '#16a34a';
                        const btnColor = role === 'client' ? '#0284c7' : '#166534';
                        const docLabel = role === 'client' ? 'Foto de tu Cédula de Identidad' : 'Foto de tu Licencia de Conducción';

                        container.innerHTML = \`
                            <p style="font-size: 12px; color: \${color}; margin-bottom: 6px;">\${title}</p>
                            <label>Nombre Completo:</label>
                            <input type="text" id="user-name" placeholder="Ej. Carlos Mario Pérez">
                            
                            <label>Correo Electrónico:</label>
                            <input type="email" id="user-email" placeholder="tucorreo@gmail.com">
                            
                            <div class="file-upload-group">
                                <label>1. Tomar o subir tu Selfie (Rostro):</label>
                                <input type="file" id="file-selfie" accept="image/*" capture="user">
                            </div>

                            <div class="file-upload-group">
                                <label>2. \${docLabel}:</label>
                                <input type="file" id="file-doc" accept="image/*">
                            </div>

                            <button onclick="registrarUsuario('\${role}')" style="background: \${btnColor};">Guardar e Ingresar 🚀</button>
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
                        if (data.success) {
                            window.location.href = data.redirectUrl;
                        } else {
                            alert(data.message);
                        }
                    })
                    .catch(err => alert("Error de conexión."));
                }

                function registrarUsuario(role) {
                    const fullName = document.getElementById('user-name').value.trim();
                    const email = document.getElementById('user-email').value.trim();
                    const selfieInput = document.getElementById('file-selfie');
                    const docInput = document.getElementById('file-doc');

                    if (!fullName) {
                        alert("Por favor ingresa tu nombre completo.");
                        return;
                    }
                    if (!email || !email.includes('@')) {
                        alert("Por favor ingresa un correo electrónico válido.");
                        return;
                    }
                    if (selfieInput.files.length === 0 || docInput.files.length === 0) {
                        alert("Debes adjuntar tanto tu selfie como tu documento.");
                        return;
                    }

                    const readerSelfie = new FileReader();
                    readerSelfie.readAsDataURL(selfieInput.files[0]);
                    readerSelfie.onload = function () {
                        const selfieBase64 = readerSelfie.result;

                        const readerDoc = new FileReader();
                        readerDoc.readAsDataURL(docInput.files[0]);
                        readerDoc.onload = function () {
                            const docBase64 = readerDoc.result;

                            fetch('/auth-user-media', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fullName, email, role, selfie: selfieBase64, document: docBase64 })
                            })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    window.location.href = data.redirectUrl;
                                } else {
                                    alert(data.message);
                                }
                            })
                            .catch(err => alert("Error al guardar los archivos."));
                        };
                    };
                }
            </script>
        </body>
        </html>
    `);
});

// 2. Autenticación de Administrador
app.post('/auth-admin', (req, res) => {
    const { email, password } = req.body;
    if (email === 'vitorinoarenas1000@gmail.com' && password === '94550Mic@') {
        const db = getDB();
        if (!db.admins.includes(email)) db.admins.push(email);
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

        const redirectUrl = `${ADMIN_SERVICE_URL}/admin?key=librex2026&email=${encodeURIComponent(email)}`;
        return res.json({ success: true, redirectUrl });
    } else {
        return res.json({ success: false, message: "Credenciales de Administrador incorrectas." });
    }
});

// 3. Procesador y Guardado Persistente en Carpetas Locales de Archivos Multimedia y Nombres
app.post('/auth-user-media', (req, res) => {
    const { fullName, email, role, selfie, document } = req.body;
    if (!email || !email.includes('@') || !fullName) {
        return res.json({ success: false, message: "Datos incompletos o correo inválido." });
    }

    const safeEmailKey = email.replace(/[^a-zA-Z0-9]/g, '_');

    // Guardar las imágenes físicamente en carpetas persistentes locales (uploads/) para que nunca se borren
    try {
        const selfieBuffer = Buffer.from(selfie.split(',')[1], 'base64');
        const docBuffer = Buffer.from(document.split(',')[1], 'base64');

        fs.writeFileSync(path.join(UPLOADS_DIR, `${safeEmailKey}_selfie.jpg`), selfieBuffer);
        fs.writeFileSync(path.join(UPLOADS_DIR, `${safeEmailKey}_doc.jpg`), docBuffer);
    } catch (e) {
        console.error("Error al guardar archivos físicos:", e);
    }

    // Actualizar Base de datos JSON persistente
    const db = getDB();
    const userData = {
        fullName,
        email,
        selfieUrl: `/uploads/${safeEmailKey}_selfie.jpg`,
        docUrl: `/uploads/${safeEmailKey}_doc.jpg`,
        updatedAt: new Date().toISOString()
    };

    if (role === 'driver') {
        db.drivers[email] = userData;
    } else {
        db.clients[email] = userData;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    // Ruta de redirección enviando el nombre real y el enlace directo a su foto selfie real
    let redirectUrl = USER_SERVICE_URL;
    const protocol = req.protocol;
    const host = req.get('host');
    const absolutePictureUrl = `${protocol}://${host}/uploads/${safeEmailKey}_selfie.jpg`;

    if (role === 'driver') {
        redirectUrl = `${DRIVER_SERVICE_URL}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(fullName)}&picture=${encodeURIComponent(absolutePictureUrl)}`;
    } else {
        redirectUrl = `${USER_SERVICE_URL}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(fullName)}&picture=${encodeURIComponent(absolutePictureUrl)}&docVerified=true`;
    }

    res.json({ success: true, redirectUrl: redirectUrl });
});

// 4. Ruta pública para que cualquier microservicio (Cliente/Conductor/Admin) consulte la foto y nombre real en tiempo real
app.get('/api/user-profile', (req, res) => {
    const { email } = req.query;
    const db = getDB();
    const user = db.clients[email] || db.drivers[email];
    if (user) {
        res.json({ success: true, user });
    } else {
        res.json({ success: false, message: "Usuario no encontrado." });
    }
});

// 5. Servir la carpeta uploads de forma pública para que los demás servidores puedan descargar o visualizar las fotos reales
app.use('/uploads', express.static(UPLOADS_DIR));

// 6. Verificación cruzada
app.get('/api/verify-session', (req, res) => {
    const { email } = req.query;
    const db = getDB();
    const isActive = !!db.clients[email] || !!db.drivers[email] || db.admins.includes(email);
    res.json({ active: isActive });
});

app.listen(PORT, () => {
    console.log(`[SERVER-MAIN] Servidor principal con almacenamiento persistente activo en puerto ${PORT}`);
});
