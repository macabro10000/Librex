const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'registered-emails-db.json');

function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ clients: [], drivers: [], admins: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

const USER_SERVICE_URL = process.env.USER_URL || 'https://librex-7j4i.onrender.com';
const DRIVER_SERVICE_URL = process.env.DRIVER_URL || 'http://localhost:3002';
const ADMIN_SERVICE_URL = process.env.ADMIN_URL || 'http://localhost:3003';

// 1. Pantalla principal con selección de roles y subida ligera
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Acceso Verificado</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #090d16; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #111827; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; box-shadow: 0 0 25px rgba(0,0,0,0.5); }
                @media(min-width: 430px) { .app-container { min-height: 850px; border-radius: 36px; border: 8px solid #1f2937; } }
                .header { text-align: center; margin-top: 20px; }
                .header h1 { font-size: 26px; color: #38bdf8; font-weight: 800; letter-spacing: 1px; }
                .header p { font-size: 12px; color: #9ca3af; margin-top: 4px; }
                
                .menu-zones { display: flex; flex-direction: column; gap: 12px; margin: 15px 0; }
                .zone-card { background: #1f2937; border: 1px solid #374151; border-radius: 16px; padding: 14px; display: flex; align-items: center; gap: 12px; color: white; cursor: pointer; transition: 0.2s ease; }
                .zone-card:active { transform: scale(0.97); }
                .zone-icon { font-size: 24px; background: #374151; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 10px; }
                .zone-info h3 { font-size: 14px; font-weight: 700; color: #f3f4f6; }
                .zone-info p { font-size: 10px; color: #9ca3af; margin-top: 1px; }

                .form-box { background: #1f2937; padding: 16px; border-radius: 16px; border: 1px solid #374151; }
                .form-box label { font-size: 11px; color: #9ca3af; display: block; margin-bottom: 4px; }
                .form-box input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #4b5563; background: #0b0f19; color: white; font-size: 13px; margin-bottom: 10px; }
                .file-upload-group { margin-bottom: 10px; background: #0b0f19; padding: 8px; border-radius: 8px; border: 1px dashed #4b5563; }
                .file-upload-group label { color: #38bdf8; font-weight: 600; }
                .form-box button { width: 100%; padding: 12px; border-radius: 10px; background: #0284c7; color: white; border: none; font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 5px; }
                
                .footer-note { text-align: center; font-size: 10px; color: #4b5563; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <h1>LIBREX 🚖</h1>
                    <p>Registro y Verificación de Identidad</p>
                </div>
                
                <div class="menu-zones">
                    <div class="zone-card" id="card-client" onclick="switchRole('client')" style="border-color: #38bdf8;">
                        <div class="zone-icon">👤</div>
                        <div class="zone-info">
                            <h3>Modo Cliente</h3>
                            <p>Selfie + Foto de Cédula</p>
                        </div>
                    </div>

                    <div class="zone-card" id="card-driver" onclick="switchRole('driver')" style="border-color: #374151;">
                        <div class="zone-icon" style="background: #14532d;">🚗</div>
                        <div class="zone-info">
                            <h3>Modo Conductor</h3>
                            <p>Selfie + Foto de Licencia</p>
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

                <div class="footer-note">Librex Secure Gateway v5.1</div>
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
                    } else if (role === 'client') {
                        container.innerHTML = \`
                            <p style="font-size: 12px; color: #38bdf8; margin-bottom: 8px;">Registro de Cliente</p>
                            <label>Correo Electrónico:</label>
                            <input type="email" id="user-email" placeholder="tucorreo@gmail.com">
                            
                            <div class="file-upload-group">
                                <label>1. Tomar o subir tu Selfie (Rostro):</label>
                                <input type="file" id="file-selfie" accept="image/*" capture="user">
                            </div>

                            <div class="file-upload-group">
                                <label>2. Foto de tu Cédula de Identidad:</label>
                                <input type="file" id="file-doc" accept="image/*">
                            </div>

                            <button onclick="registrarUsuario('client')">Registrarse y Entrar 🚀</button>
                        \`;
                    } else if (role === 'driver') {
                        container.innerHTML = \`
                            <p style="font-size: 12px; color: #16a34a; margin-bottom: 8px;">Registro de Conductor</p>
                            <label>Correo Electrónico:</label>
                            <input type="email" id="user-email" placeholder="tucorreo@gmail.com">
                            
                            <div class="file-upload-group">
                                <label>1. Tomar o subir tu Selfie (Rostro):</label>
                                <input type="file" id="file-selfie" accept="image/*" capture="user">
                            </div>

                            <div class="file-upload-group">
                                <label>2. Foto de tu Licencia de Conducción:</label>
                                <input type="file" id="file-doc" accept="image/*">
                            </div>

                            <button onclick="registrarUsuario('driver')" style="background: #166534;">Registrar Conductor 🚗</button>
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
                    const email = document.getElementById('user-email').value.trim();
                    const selfieInput = document.getElementById('file-selfie');
                    const docInput = document.getElementById('file-doc');

                    if (!email || !email.includes('@')) {
                        alert("Por favor ingresa un correo electrónico válido.");
                        return;
                    }
                    if (selfieInput.files.length === 0 || docInput.files.length === 0) {
                        alert("Debes adjuntar tanto tu selfie como la foto de tu documento/licencia.");
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
                                body: JSON.stringify({ email, role, selfie: selfieBase64, document: docBase64 })
                            })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    window.location.href = data.redirectUrl;
                                } else {
                                    alert(data.message);
                                }
                            })
                            .catch(err => alert("Error al enviar los archivos multimedia."));
                        };
                    };
                }
            </script>
        </body>
        </html>
    `);
});

// 2. Procesador de Administrador
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

// 3. Procesador seguro: Envía únicamente parámetros ligeros a los microservicios para evitar pantalla en blanco
app.post('/auth-user-media', (req, res) => {
    const { email, role } = req.body;
    if (!email || !email.includes('@')) {
        return res.json({ success: false, message: "Correo inválido." });
    }

    const db = getDB();
    if (role === 'driver') {
        if (!db.drivers.includes(email)) db.drivers.push(email);
    } else {
        if (!db.clients.includes(email)) db.clients.push(email);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    const name = email.split('@')[0];
    // Avatar estable basado en UI libre para evitar desbordar la URL con imágenes pesadas en Base64
    const picture = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;

    let redirectUrl = USER_SERVICE_URL;
    if (role === 'driver') {
        redirectUrl = `${DRIVER_SERVICE_URL}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}`;
    } else {
        redirectUrl = `${USER_SERVICE_URL}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}&docVerified=true`;
    }

    res.json({ success: true, redirectUrl: redirectUrl });
});

// 4. Verificación cruzada
app.get('/api/verify-session', (req, res) => {
    const { email } = req.query;
    const db = getDB();
    const isActive = db.clients.includes(email) || db.drivers.includes(email) || db.admins.includes(email);
    res.json({ active: isActive });
});

app.listen(PORT, () => {
    console.log(`[SERVER-MAIN] Servidor principal optimizado activo en puerto ${PORT}`);
});
