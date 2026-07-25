const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const CLIENTS_FILE = path.join(DB_DIR, 'clients.json');

function leerJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) { return []; }
}

function escribirJSON(filePath, data) {
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
}

// Registro directo en el servidor de clientes
app.post('/api/register', (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    let clients = leerJSON(CLIENTS_FILE);
    const nuevoCliente = {
        id: Date.now().toString(),
        phone,
        fullName,
        email: email || 'Sin correo',
        selfieBase64: selfieBase64 || '',
        docFrontBase64: docFrontBase64 || '',
        docBackBase64: docBackBase64 || '',
        createdAt: new Date().toISOString()
    };

    clients.push(nuevoCliente);
    escribirJSON(CLIENTS_FILE, clients);

    return res.json({ success: true, message: '¡Registro de pasajero exitoso!' });
});

// Interfaz Principal / App de Clientes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Pasajeros</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
                body { background: #090d16; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-card { width: 100%; max-width: 400px; background: #111827; padding: 30px; border-radius: 20px; border: 1px solid #1f2937; text-align: center; }
                h1 { color: #38bdf8; font-size: 24px; margin-bottom: 10px; }
                p { color: #9ca3af; font-size: 14px; margin-bottom: 20px; }
                input { width: 100%; padding: 12px; margin: 10px 0; background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; }
                button { width: 100%; padding: 12px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="app-card">
                <h1>Librex Pasajeros</h1>
                <p>Tu app de transporte independiente</p>
                <form id="regForm">
                    <input type="text" id="fullName" placeholder="Nombre Completo" required>
                    <input type="tel" id="phone" placeholder="Número de Teléfono" required>
                    <input type="email" id="email" placeholder="Correo Electrónico">
                    <button type="submit">Registrarse y Pedir Viaje</button>
                </form>
                <div id="msg" style="margin-top: 15px; font-size: 13px;"></div>
            </div>
            <script>
                document.getElementById('regForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        fullName: document.getElementById('fullName').value,
                        phone: document.getElementById('phone').value,
                        email: document.getElementById('email').value
                    };
                    const res = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    const result = await res.json();
                    document.getElementById('msg').innerText = result.message;
                    document.getElementById('msg').style.color = result.success ? '#34d399' : '#f87171';
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log(`[CLIENT-SERVER] Servidor de Clientes activo en puerto ${PORT}`));
