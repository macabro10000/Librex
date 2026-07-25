const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

// URL de tu servidor administrador en Render
const ADMIN_URL = 'https://librex-980i.onrender.com';

// Función fetch con AbortController para manejar tiempos de espera largos (ideal para Render Free Tier)
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

// Registro directo que sincroniza con el Admin con reintentos
app.post('/api/register', async (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    const nuevoCliente = {
        id: Date.now().toString(),
        phone,
        fullName,
        email: email || 'Sin correo',
        selfieBase64: selfieBase64 || '',
        docFrontBase64: docFrontBase64 || '',
        docBackBase64: docBackBase64 || '',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };

    let intentos = 2; // Intentará hasta 2 veces si el servidor está despertando
    let exito = false;
    let resultadoAdmin = null;

    while (intentos > 0 && !exito) {
        try {
            console.log(`[CLIENT-SYNC] Intentando conectar con el Admin... (Intentos restantes: ${intentos})`);
            const response = await fetchWithTimeout(`${ADMIN_URL}/api/admin/sync-client`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoCliente)
            }, 60000); // 60 segundos de espera para darle tiempo a Render a despertar

            resultadoAdmin = await response.json();
            if (resultadoAdmin.success) {
                exito = true;
            }
        } catch (error) {
            console.warn(`[CLIENT-SYNC] Falló el intento. Es muy probable que Render esté despertando. Reintentando...`);
            intentos--;
            // Esperar 3 segundos antes del siguiente intento
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    if (exito) {
        return res.json({ success: true, message: '¡Registro de pasajero exitoso y sincronizado!' });
    } else {
        return res.status(500).json({ 
            success: false, 
            message: 'El servidor central está iniciando (modo reposo). Por favor, espera 30 segundos y vuelve a intentar.' 
        });
    }
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
                button:disabled { background: #4b5563; cursor: not-allowed; }
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
                    <button type="submit" id="btnSubmit">Registrarse y Pedir Viaje</button>
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
                    msg.style.color = '#38bdf8';

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
                        btn.innerText = 'Registrarse y Pedir Viaje';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log(`[CLIENT-SERVER] Servidor de Clientes activo en puerto ${PORT}`));
