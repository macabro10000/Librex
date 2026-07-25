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

// 1. Pantalla principal rápida y sin bloqueos de tarjetas
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Acceso Directo</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #090d16; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #111827; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; box-shadow: 0 0 25px rgba(0,0,0,0.5); }
                @media(min-width: 430px) { .app-container { min-height: 850px; border-radius: 36px; border: 8px solid #1f2937; } }
                .header { text-align: center; margin-top: 30px; }
                .header h1 { font-size: 28px; color: #38bdf8; font-weight: 800; letter-spacing: 1px; }
                .header p { font-size: 13px; color: #9ca3af; margin-top: 6px; }
                
                .menu-zones { display: flex; flex-direction: column; gap: 14px; margin: auto 0; }
                .zone-card { background: #1f2937; border: 1px solid #374151; border-radius: 18px; padding: 16px; display: flex; align-items: center; gap: 14px; color: white; cursor: pointer; transition: 0.2s ease; }
                .zone-card:active { transform: scale(0.97); }
                .zone-icon { font-size: 26px; background: #374151; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
                .zone-info h3 { font-size: 15px; font-weight: 700; color: #f3f4f6; }
                .zone-info p { font-size: 11px; color: #9ca3af; margin-top: 2px; }

                .form-box { background: #1f2937; padding: 18px; border-radius: 18px; border: 1px solid #374151; margin-top: 10px; }
                .form-box input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #4b5563; background: #0b0f19; color: white; font-size: 14px; margin-bottom: 10px; }
                .form-box button { width: 100%; padding: 12px; border-radius: 10px; background: #0284c7; color: white; border: none; font-weight: 700; font-size: 14px; cursor: pointer; }
                
                .footer-note { text-align: center; font-size: 11px; color: #4b5563; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <h1>LIBREX 🚖</h1>
                    <p>Acceso Rápido y Sin Tarjetas</p>
                </div>
                
                <div class="menu-zones">
                    <div class="zone-card" id="card-client" onclick="setRole('client')" style="border-color: #38bdf8;">
                        <div class="zone-icon">👤</div>
                        <div class="zone-info">
                            <h3>Modo Cliente</h3>
                            <p>Solicita tus viajes al instante</p>
                        </div>
                    </div>

                    <div class="zone-card" id="card-driver" onclick="setRole('driver')" style="border-color: #374151;">
                        <div class="zone-icon" style="background: #14532d;">🚗</div>
                        <div class="zone-info">
                            <h3>Modo Conductor</h3>
                            <p>Zona de operadores y rutas</p>
                        </div>
                    </div>

                    <div class="form-box">
                        <p id="rol-activo-label" style="font-size: 12px; color: #38bdf8; margin-bottom: 8px;">Entrar como: <b>Cliente</b></p>
                        <input type="email" id="user-email" placeholder="Escribe tu correo (ej. usuario@gmail.com)">
                        <button onclick="entrarPlataforma()">Ingresar Ahora 🚀</button>
                    </div>
                </div>

                <div class="footer-note">Librex Direct Access v4.0 (Zero Cost)</div>
            </div>

            <script>
                let activeRole = 'client';

                function setRole(role) {
                    activeRole = role;
                    document.getElementById('card-client').style.borderColor = role === 'client' ? '#38bdf8' : '#374151';
                    document.getElementById('card-driver').style.borderColor = role === 'driver' ? '#166534' : '#374151';
                    document.getElementById('rol-activo-label').innerHTML = 'Entrar como: <b>' + (role === 'client' ? 'Cliente' : 'Conductor') + '</b>';
                }

                function entrarPlataforma() {
                    const emailInput = document.getElementById('user-email').value.trim();
                    if (!emailInput || !emailInput.includes('@')) {
                        alert("Por favor ingresa un correo electrónico válido.");
                        return;
                    }

                    fetch('/auth-direct', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailInput, role: activeRole })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            window.location.href = data.redirectUrl;
                        } else {
                            alert(data.message);
                        }
                    })
                    .catch(err => alert("Error de conexión con el servidor."));
                }
            </script>
        </body>
        </html>
    `);
});

// 2. Procesador de acceso directo y seguro
app.post('/auth-direct', (req, res) => {
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
    // Genera automáticamente un avatar basado en el correo sin usar servicios de pago
    const picture = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;

    let redirectUrl = USER_SERVICE_URL;
    if (role === 'driver') {
        redirectUrl = `${DRIVER_SERVICE_URL}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}`;
    } else {
        redirectUrl = `${USER_SERVICE_URL}/?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}`;
    }

    res.json({ success: true, redirectUrl: redirectUrl });
});

// 3. Verificación cruzada
app.get('/api/verify-session', (req, res) => {
    const { email } = req.query;
    const db = getDB();
    const isActive = db.clients.includes(email) || db.drivers.includes(email) || db.admins.includes(email);
    res.json({ active: isActive });
});

app.listen(PORT, () => {
    console.log(`[SERVER-MAIN] Servidor principal directo activo en puerto ${PORT}`);
});
