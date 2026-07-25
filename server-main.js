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

// URL oficial de tu microservicio de clientes en Render
const USER_SERVICE_URL = process.env.USER_URL || 'https://librex-7j4i.onrender.com';
const DRIVER_SERVICE_URL = process.env.DRIVER_URL || 'http://localhost:3002';
const ADMIN_SERVICE_URL = process.env.ADMIN_URL || 'http://localhost:3003';

// 1. Pantalla principal del Gateway
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Acceso Multiplataforma</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #090d16; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #111827; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; box-shadow: 0 0 25px rgba(0,0,0,0.5); }
                @media(min-width: 430px) { .app-container { min-height: 850px; border-radius: 36px; border: 8px solid #1f2937; } }
                .header { text-align: center; margin-top: 30px; }
                .header h1 { font-size: 28px; color: #38bdf8; font-weight: 800; letter-spacing: 1px; }
                .header p { font-size: 13px; color: #9ca3af; margin-top: 6px; }
                .menu-zones { display: flex; flex-direction: column; gap: 16px; margin: auto 0; }
                .zone-card { background: #1f2937; border: 1px solid #374151; border-radius: 20px; padding: 20px; display: flex; align-items: center; gap: 16px; text-decoration: none; color: white; transition: 0.2s ease; cursor: pointer; }
                .zone-card:active { transform: scale(0.97); }
                .zone-icon { font-size: 32px; background: #374151; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 16px; }
                .zone-info h3 { font-size: 17px; font-weight: 700; color: #f3f4f6; }
                .zone-info p { font-size: 12px; color: #9ca3af; margin-top: 3px; }
                .footer-note { text-align: center; font-size: 11px; color: #4b5563; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <h1>LIBREX 🚖</h1>
                    <p>Sincronización Inteligente en Tiempo Real</p>
                </div>
                
                <div class="menu-zones">
                    <div class="zone-card" onclick="openLogin('client')">
                        <div class="zone-icon">👤</div>
                        <div class="zone-info">
                            <h3>Ingresar como Cliente</h3>
                            <p>Acceso seguro con cuenta Google</p>
                        </div>
                    </div>

                    <div class="zone-card" onclick="openLogin('driver')" style="border-color: #166534;">
                        <div class="zone-icon" style="background: #14532d;">🚗</div>
                        <div class="zone-info">
                            <h3>Ingresar como Conductor</h3>
                            <p>Flota de vehículos y asignación</p>
                        </div>
                    </div>

                    <div class="zone-card" onclick="openLogin('admin')" style="border-color: #1e3a8a;">
                        <div class="zone-icon" style="background: #1e40af;">🔐</div>
                        <div class="zone-info">
                            <h3>Ingresar como Administrador</h3>
                            <p>Exclusivo: vitorinoarenas1000@gmail.com</p>
                        </div>
                    </div>
                </div>

                <div class="footer-note">Librex Gateway v3.1</div>
            </div>

            <script>
                function openLogin(role) {
                    const email = prompt("Ingrese su correo electrónico de Google para continuar:");
                    if (!email) return;
                    
                    fetch('/auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email.trim(), role: role })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            window.location.href = data.redirectUrl;
                        } else {
                            alert(data.message);
                        }
                    })
                    .catch(err => alert("Error de conexión con el servidor principal."));
                }
            </script>
        </body>
        </html>
    `);
});

// 2. Autenticación, registro y empaquetado de datos de perfil hacia el microservicio
app.post('/auth', (req, res) => {
    const { email, role } = req.body;
    if (!email || !email.includes('@')) {
        return res.json({ success: false, message: "Correo electrónico inválido." });
    }

    const db = getDB();

    if (role === 'admin') {
        if (email !== 'vitorinoarenas1000@gmail.com') {
            return res.json({ success: false, message: "Acceso Denegado: No autorizado como Administrador." });
        }
        if (!db.admins.includes(email)) db.admins.push(email);
    } else if (role === 'driver') {
        if (!db.drivers.includes(email)) db.drivers.push(email);
    } else if (role === 'client') {
        if (!db.clients.includes(email)) db.clients.push(email);
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    const name = email.split('@')[0];
    const picture = `https://www.gravatar.com/avatar/${Buffer.from(email.toLowerCase()).toString('hex')}?d=mp&f=y`;

    let redirectUrl = USER_SERVICE_URL;
    if (role === 'driver') {
        redirectUrl = `${DRIVER_SERVICE_URL}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}`;
    } else if (role === 'client') {
        redirectUrl = `${USER_SERVICE_URL}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}`;
    } else if (role === 'admin') {
        redirectUrl = `${ADMIN_SERVICE_URL}/admin?key=librex2026&email=${encodeURIComponent(email)}`;
    }

    res.json({ success: true, redirectUrl: redirectUrl });
});

// 3. API de verificación cruzada para validar sesiones activas
app.get('/api/verify-session', (req, res) => {
    const { email } = req.query;
    const db = getDB();
    const isActive = db.clients.includes(email) || db.drivers.includes(email) || db.admins.includes(email);
    res.json({ active: isActive });
});

app.listen(PORT, () => {
    console.log(`[SERVER-MAIN] Servidor principal activo en puerto ${PORT}`);
});
