const express = require('express');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3003;

// URL oficial del Servidor Principal en Render
const MAIN_SERVER_URL = process.env.MAIN_URL || 'https://librex-980i.onrender.com';

// ==========================================
// PANEL DE CONTROL ADMINISTRATIVO SECUNDARIO
// ==========================================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Librex - Consola de Administración</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #030712; color: #f8fafc; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .admin-box { width: 100%; max-width: 500px; background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 30px; box-shadow: 0 0 30px rgba(0,0,0,0.7); text-align: center; }
                h1 { color: #38bdf8; font-size: 24px; margin-bottom: 10px; }
                p { color: #94a3b8; font-size: 14px; margin-bottom: 25px; }
                .btn-master { display: block; width: 100%; background: #0284c7; color: white; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px; margin-bottom: 12px; transition: 0.2s; }
                .btn-master:hover { background: #0ea5e9; }
                .info-note { background: #1e293b; border: 1px solid #334155; padding: 15px; border-radius: 12px; font-size: 12px; color: #cbd5e1; margin-top: 20px; text-align: left; }
            </style>
        </head>
        <body>
            <div class="admin-box">
                <h1>Consola de Control Librex</h1>
                <p>Gestión centralizada de bases de datos y supervisión de flota.</p>
                
                <a href="${MAIN_SERVER_URL}/admin" class="btn-master" target="_blank">Abrir Panel Maestro Principal 🚀</a>
                <a href="${MAIN_SERVER_URL}" class="btn-master" style="background: #334155;" target="_blank">Ir al Gateway Central</a>

                <div class="info-note">
                    <strong>Nota de Arquitectura:</strong> Este microservicio de administración actúa como pasarela de respaldo. Toda la base de datos de clientes y conductores se sincroniza de forma autónoma con el servidor principal.
                </div>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`[SERVER-ADMIN] Microservicio de Administración activo en puerto ${PORT}`);
});
