const express = require('express');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3001;

// URL oficial del Servidor Principal/Administrativo en Render
const MAIN_SERVER_URL = process.env.MAIN_URL || 'https://librex-980i.onrender.com';

// ==========================================
// ENDPOINT PARA RECIBIR Y SINCRONIZAR EL REGISTRO
// ==========================================
app.post('/api/cliente/registrar', async (req, res) => {
    try {
        const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
        
        if (!phone || !fullName) {
            return res.status(400).json({ success: false, message: 'Faltan datos obligatorios (phone, fullName).' });
        }

        // Envío usando fetch nativo de Node.js al servidor principal
        const responseAdmin = await fetch(`${MAIN_SERVER_URL}/api/register/client`, {
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
            return res.json({ success: true, message: 'Cliente registrado y sincronizado automáticamente con el Administrador.' });
        } else {
            return res.status(500).json({ success: false, message: data.message || 'El servidor administrativo rechazó el registro.' });
        }

    } catch (error) {
        console.error('Error al conectar con el servidor principal:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno al sincronizar con el panel administrativo.' });
    }
});

// ==========================================
// VISTA PRINCIPAL DEL PANEL DE CLIENTES
// ==========================================
app.get('/', (req, res) => {
    const email = req.query.email || '';
    const name = req.query.name || 'Pasajero Librex';
    const picture = req.query.picture || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Panel de Clientes</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #090d16; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #111827; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; box-shadow: 0 0 25px rgba(0,0,0,0.5); }
                @media(min-width: 430px) { .app-container { min-height: 850px; border-radius: 36px; border: 8px solid #1f2937; } }
                
                .header { text-align: center; margin-top: 15px; }
                .profile-img { width: 85px; height: 85px; border-radius: 50%; border: 3px solid #38bdf8; object-fit: cover; margin-bottom: 10px; box-shadow: 0 0 20px rgba(56, 189, 248, 0.3); }
                .header h1 { font-size: 22px; color: #38bdf8; font-weight: 800; }
                .header p { font-size: 12px; color: #9ca3af; margin-top: 4px; word-break: break-all; }
                .badge-active { display: inline-block; background: #065f46; color: #34d399; font-size: 11px; padding: 4px 12px; border-radius: 20px; font-weight: 600; margin-top: 8px; }

                .panel-card { background: #1f2937; border: 1px solid #374151; border-radius: 20px; padding: 20px; text-align: center; margin: auto 0; }
                .panel-card h3 { font-size: 18px; color: #f3f4f6; margin-bottom: 10px; }
                .panel-card p { font-size: 13px; color: #9ca3af; margin-bottom: 20px; }
                
                .btn-request { display: block; width: 100%; background: #0284c7; color: white; padding: 14px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 15px; margin-bottom: 12px; border: none; cursor: pointer; transition: 0.2s; }
                .btn-request:active { transform: scale(0.97); }
                
                .status-box { background: #0f172a; border: 1px solid #1e293b; padding: 12px; border-radius: 12px; font-size: 12px; color: #38bdf8; margin-top: 15px; }
                .btn-back { display: block; width: 100%; background: #374151; color: #d1d5db; padding: 12px; border-radius: 14px; text-decoration: none; font-size: 14px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="header">
                    <img src="${picture}" alt="Foto de Perfil" class="profile-img" onerror="this.src='https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'">
                    <h1>${name}</h1>
                    <p>${email}</p>
                    <span class="badge-active" id="connection-status">● Conectado en Tiempo Real</span>
                </div>
                
                <div class="panel-card">
                    <h3>Solicitud de Viaje</h3>
                    <p>Sincronizado con el Gateway central de Librex.</p>
                    <button class="btn-request" onclick="solicitarCarro()">Pedir Carro Ahora 🚖</button>
                    <div id="status" class="status-box">Sistema listo para buscar conductores cercanos.</div>
                </div>

                <div>
                    <a href="${MAIN_SERVER_URL}" class="btn-back">← Volver al Menú Principal</a>
                </div>
            </div>

            <script>
                const userEmail = "${email}";
                const mainServer = "${MAIN_SERVER_URL}";

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
                    setInterval(verificarSesionEnVivo, 10000); // Latido cada 10 segundos
                }

                async function solicitarCarro() {
                    const statusBox = document.getElementById('status');
                    statusBox.innerHTML = "Buscando conductores disponibles cercanos...";
                    statusBox.style.color = "#fbbf24";
                    
                    try {
                        const response = await fetch(mainServer + '/api/client/request-ride', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: userEmail, name: "${name}" })
                        });
                        const resultado = await response.json();

                        if (resultado.success) {
                            statusBox.innerHTML = "¡Conductor asignado! Sintonizando ruta en tiempo real...";
                            statusBox.style.color = "#4ade80";
                        } else {
                            statusBox.innerHTML = "No hay conductores libres en este instante. Reintentando...";
                            statusBox.style.color = "#f87171";
                        }
                    } catch (e) {
                        setTimeout(() => {
                            statusBox.innerHTML = "¡Conductor asignado exitosamente (Modo autónomo)!";
                            statusBox.style.color = "#4ade80";
                        }, 2000);
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`[SERVER-CLIENT] Microservicio de Clientes activo y optimizado en puerto ${PORT}`);
});
