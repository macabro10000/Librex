const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

// URL de tu servidor administrador central en Render
const ADMIN_URL = 'https://librex-980i.onrender.com';

// Función fetch con AbortController para alargar el tiempo de espera si Render está despertando
async function fetchWithTimeout(url, options = {}, timeout = 60000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// Registro de conductor que sincroniza automáticamente con el Administrador
app.post('/api/register', async (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    const nuevoConductor = {
        id: Date.now().toString(),
        phone,
        fullName,
        email: email || 'Sin correo',
        selfieBase64: selfieBase64 || '',
        docFrontBase64: docFrontBase64 || '',
        docBackBase64: docBackBase64 || '',
        status: 'Disponible',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };

    let intentos = 3; // Intentará conectar hasta 3 veces si el servidor central está despertando
    let exito = false;
    let resultadoAdmin = null;

    while (intentos > 0 && !exito) {
        try {
            console.log(`[DRIVER-SYNC] Intentando conectar con el Admin... (Intentos restantes: ${intentos})`);
            const response = await fetchWithTimeout(`${ADMIN_URL}/api/admin/sync-driver`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoConductor)
            }, 60000); // 60 segundos de espera para Render Free Tier

            resultadoAdmin = await response.json();
            if (resultadoAdmin && resultadoAdmin.success) {
                exito = true;
            }
        } catch (error) {
            console.warn(`[DRIVER-SYNC] Falló la conexión con el Admin. Es probable que esté despertando. Reintentando...`);
            intentos--;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    if (exito) {
        return res.json({ success: true, message: '¡Registro de conductor exitoso y sincronizado!' });
    } else {
        return res.status(500).json({ 
            success: false, 
            message: 'El servidor central está despertando. Por favor, espera 30 segundos y vuelve a intentar.' 
        });
    }
});

// Interfaz Principal / App de Conductores
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Conductores</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
                body { background: #090d16; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .app-card { width: 100%; max-width: 400px; background: #111827; padding: 30px; border-radius: 20px; border: 1px solid #1f2937; text-align: center; }
                h1 { color: #34d399; font-size: 24px; margin-bottom: 10px; }
                p { color: #9ca3af; font-size: 14px; margin-bottom: 20px; }
                input { width: 100%; padding: 12px; margin: 10px 0; background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; }
                button { width: 100%; padding: 12px; background: #059669; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
                button:disabled { background: #374151; cursor: not-allowed; }
            </style>
        </head>
        <body>
            <div class="app-card">
                <h1>Librex Conductores</h1>
                <p>Modo Conductor Independiente</p>
                <form id="regForm">
                    <input type="text" id="fullName" placeholder="Nombre Completo" required>
                    <input type="tel" id="phone" placeholder="Número de Teléfono" required>
                    <input type="email" id="email" placeholder="Correo Electrónico">
                    <button type="submit" id="btnSubmit">Registrarse como Conductor</button>
                </form>
                <div id="msg" style="margin-top: 15px; font-size: 13px;"></div>
            </div>
            <script>
                document.getElementById('regForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = document.getElementById('btnSubmit');
                    const msg = document.getElementById('msg');

                    btn.disabled = true;
                    btn.innerText = 'Conectando con el servidor...';
                    msg.innerText = 'Despertando servidor central, por favor espera...';
                    msg.style.color = '#34d399';

                    try {
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
                        msg.innerText = result.message;
                        msg.style.color = result.success ? '#34d399' : '#f87171';
                    } catch (err) {
                        msg.innerText = 'Error de red. Intenta nuevamente.';
                        msg.style.color = '#f87171';
                    } finally {
                        btn.disabled = false;
                        btn.innerText = 'Registrarse como Conductor';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log(`[DRIVER-SERVER] Servidor de Conductores activo en puerto ${PORT}`));
