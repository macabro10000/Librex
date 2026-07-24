const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;

const USER_SERVICE_URL = process.env.USER_URL || 'http://localhost:3001';
const DRIVER_SERVICE_URL = process.env.DRIVER_URL || 'http://localhost:3002';
const ADMIN_SERVICE_URL = process.env.ADMIN_URL || 'http://localhost:3003';

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Red de Movilidad</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #090d16; color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-container { width: 100%; max-width: 420px; background: #111827; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; box-shadow: 0 0 25px rgba(0,0,0,0.5); }
                @media(min-width: 430px) { .app-container { min-height: 850px; border-radius: 36px; border: 8px solid #1f2937; } }
                .header { text-align: center; margin-top: 30px; }
                .header h1 { font-size: 28px; color: #38bdf8; font-weight: 800; letter-spacing: 1px; }
                .header p { font-size: 13px; color: #9ca3af; margin-top: 6px; }
                .menu-zones { display: flex; flex-direction: column; gap: 16px; margin: auto 0; }
                .zone-card { background: #1f2937; border: 1px solid #374151; border-radius: 20px; padding: 20px; display: flex; align-items: center; gap: 16px; text-decoration: none; color: white; transition: 0.2s ease; }
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
                    <p>Seleccione su zona de acceso operativo</p>
                </div>
                
                <div class="menu-zones">
                    <a href="${USER_SERVICE_URL}" class="zone-card">
                        <div class="zone-icon">👤</div>
                        <div class="zone-info">
                            <h3>Ingresar como Cliente</h3>
                            <p>Solicita viajes y gestiona tu perfil</p>
                        </div>
                    </a>

                    <a href="${DRIVER_SERVICE_URL}" class="zone-card" style="border-color: #166534;">
                        <div class="zone-icon" style="background: #14532d;">🚗</div>
                        <div class="zone-info">
                            <h3>Ingresar como Conductor</h3>
                            <p>Conéctate para aceptar carreras</p>
                        </div>
                    </a>

                    <a href="${ADMIN_SERVICE_URL}/admin?key=librex2026" class="zone-card" style="border-color: #1e3a8a;">
                        <div class="zone-icon" style="background: #1e40af;">🔐</div>
                        <div class="zone-info">
                            <h3>Ingresar como Administrador</h3>
                            <p>Control central y supervision</p>
                        </div>
                    </a>
                </div>

                <div class="footer-note">Librex Main Gateway v2.0</div>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`[SERVER-MAIN] Servidor principal activo en puerto ${PORT}`);
});
