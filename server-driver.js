const express = require('express');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3002;

// URL oficial del Servidor Principal/Administrativo en Render
const MAIN_SERVER_URL = process.env.MAIN_URL || 'https://librex-980i.onrender.com';

// ==========================================
// ENDPOINT PARA RECIBIR Y SINCRONIZAR EL REGISTRO DE CONDUCTORES
// ==========================================
app.post('/api/conductor/registrar', async (req, res) => {
    try {
        const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
        
        if (!phone || !fullName) {
            return res.status(400).json({ success: false, message: 'Faltan datos obligatorios (phone, fullName).' });
        }

        // Envío usando fetch nativo de Node.js al servidor principal (Administrador)
        const responseAdmin = await fetch(`${MAIN_SERVER_URL}/api/register/driver`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone,
                fullName,
                email,
                selfieBase64,
                docFrontBase64,
                docBackBase64
            })
        });

        const data = await responseAdmin.json();

        if (data.success) {
            return res.json({ success: true, message: 'Conductor registrado y sincronizado automáticamente con el Administrador.' });
        } else {
            return res.status(500).json({ success: false, message: data.message || 'El servidor administrativo rechazó el registro del conductor.' });
        }

    } catch (error) {
        console.error('Error al conectar con el servidor principal:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno al sincronizar con el panel administrativo.' });
    }
});

// ==========================================
// VISTA PRINCIPAL DEL PANEL DE CONDUCTORES
// ==========================================
app.get('/', (req, res) => {
    const email = req.query.email || '';
    const name = req.query.name || 'Conductor Librex';
    const picture = req.query.picture || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Panel de Conductores</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #030712; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #0f172a; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; box-shadow: 0 0 25px rgba(0,0,0,0.5); }
                @media(min-width: 430px) { .app-container { min-height: 850px; border-radius: 36px; border: 8px solid #1e293b; } }
                
                .header { text-align: center; margin-top: 15px; }
                .profile-img { width: 85px; height: 85px; border-radius: 50%; border: 3px solid #10b981; object-fit: cover; margin-bottom: 10px; box-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
                .header h1 { font-size: 22px; color: #10b981; font-weight: 800; }
                .header p { font-size: 12px; color: #94a3b8; margin-top: 4px; word-break: break-all; }
                .badge-active { display: inline-block; background: #065f46; color: #34d399; font-size: 11px; padding: 4px 12px; border-radius: 20px; font-weight: 600; margin-top: 8px; }

                .panel-card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 20px; text-align: center; margin: auto 0; }
                .panel-card h3 { font-size: 18px; color: #f8fafc; margin-bottom: 10px; }
                .panel-card p { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
                
                .btn-toggle { display: block; width: 100%; background: #059669; color: white; padding: 14px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 15px; margin-bottom: 12px; border: none; cursor: pointer; transition: 0.2s; }
                .btn-toggle:active { transform: scale(0.97); }
                
                .status-box { background: #030712; border: 1px solid #1e293b; padding: 12px; border-radius: 12px; font-size: 12px; color: #34d399; margin-top: 15px; }
                .btn-back { display: block; width: 100%; background: #334155; color: #cbd5e1; padding: 12px; border-radius: 14px; text-decoration: none; font-size: 14px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <img src="${picture}" alt="Foto de Conductor" class="profile-img" onerror="this.src='https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'">
                    <h1>${name}</h1>
                    <p>${email}</p>
                    <span class="badge-active" id="connection-status">● En Línea - Listo para Carreras</span>
                </div>
                
                <div class="panel-card">
                    <h3>Radar de Viajes</h3>
                    <p>Gestiona tu estado de disponibilidad para recibir pasajeros cercanos.</p>
                    <button class="btn-toggle" id="btn-status" onclick="toggleDisponibilidad()">Cambiar a Ocupado / Descanso</button>
                    <div id="status" class="status-box">Esperando solicitudes de viaje en tu zona...</div>
                </div>

                <div>
                    <a href="${MAIN_SERVER_URL}" class="btn-back">← Volver al Menú Principal</a>
                </div>
            </div>

            <script>
                const userEmail = "${email}";
                const mainServer = "${MAIN_SERVER_URL}";
                let disponible = true;

                // Verificación y mantenimiento de sesión en tiempo real (Heartbeat cada 10s)
                function verificarSesionEnVivo() {
                    if (!userEmail) return;
                    fetch(mainServer + '/api/verify-session?email=' + encodeURIComponent(userEmail))
                        .then(res => res.json())
                        .then(data => {
                            if (!data.active) {
                                alert("La sesión ha expirado o ha sido revocada por el administrador.");
                                window.location.href = mainServer;
                            } else {
                                document.getElementById('connection-status').style.color = '#34d399';
                            }
                        })
                        .catch(err => {
                            console.warn("Aviso: Conexión intermitente con el servidor central.");
                            document.getElementById('connection-status').style.color = '#fbbf24';
                        });
                }

                if (userEmail) {
                    verificarSesionEnVivo();
                    setInterval(verificarSesionEnVivo, 10000);
                }

                function toggleDisponibilidad() {
                    const btn = document.getElementById('btn-status');
                    const statusBox = document.getElementById('status');
                    disponible = !disponible;

                    if (disponible) {
                        btn.style.background = '#059669';
                        btn.innerText = "Cambiar a Ocupado / Descanso";
                        statusBox.innerHTML = "Radar activo. Buscando pasajeros cercanos...";
                        statusBox.style.color = "#34d399";
                    } else {
                        btn.style.background = '#b91c1c';
                        btn.innerText = "Conectarse para Recibir Viajes";
                        statusBox.innerHTML = "Estás en descanso. No recibirás nuevas solicitudes.";
                        statusBox.style.color = "#f87171";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`[SERVER-DRIVER] Microservicio de Conductores activo y optimizado en puerto ${PORT}`);
});
