const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

// URL de tu servidor administrador central en Render
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

// Registro directo que sincroniza con el Admin con reintentos y validación de duplicados
app.post('/api/register', async (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    const nuevoCliente = {
        id: Date.now().toString(),
        phone: phone.trim(),
        fullName: fullName.trim(),
        email: email ? email.trim() : 'Sin correo',
        selfieBase64: selfieBase64 || '',
        docFrontBase64: docFrontBase64 || '', // Cédula Frente
        docBackBase64: docBackBase64 || '',   // Cédula Dorso
        status: 'Activo',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };

    let intentos = 3; 
    let exito = false;
    let resultadoAdmin = null;

    while (intentos > 0 && !exito) {
        try {
            console.log(`[CLIENT-SYNC] Intentando conectar con el Admin... (Intentos restantes: ${intentos})`);
            const response = await fetchWithTimeout(`${ADMIN_URL}/api/admin/sync-client`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoCliente)
            }, 60000);

            resultadoAdmin = await response.json();
            if (resultadoAdmin && resultadoAdmin.success) {
                exito = true;
            } else {
                // Si el servidor admin rechaza por duplicado o datos inválidos, salimos del ciclo de inmediato
                return res.status(400).json(resultadoAdmin);
            }
        } catch (error) {
            console.warn(`[CLIENT-SYNC] Falló el intento. Reintentando...`);
            intentos--;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    if (exito) {
        return res.json({ success: true, message: '¡Registro de pasajero exitoso y sincronizado!' });
    } else {
        return res.status(500).json({ 
            success: false, 
            message: 'El servidor central está iniciando. Por favor, espera unos segundos e intenta nuevamente.' 
        });
    }
});

// Interfaz Principal / App de Clientes con captura de Cédula y Selfie
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
                body { background: #090d16; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
                .app-card { width: 100%; max-width: 400px; background: #111827; padding: 25px; border-radius: 20px; border: 1px solid #1f2937; text-align: center; }
                h1 { color: #38bdf8; font-size: 22px; margin-bottom: 5px; }
                p { color: #9ca3af; font-size: 13px; margin-bottom: 15px; }
                input { width: 100%; padding: 12px; margin: 8px 0; background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; font-size: 14px; }
                label { display: block; text-align: left; font-size: 12px; color: #9ca3af; margin-top: 10px; }
                input[type="file"] { background: #111827; padding: 8px; border: 1px dashed #374151; }
                button { width: 100%; padding: 14px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 15px; font-size: 15px; }
                button:disabled { background: #374151; cursor: not-allowed; }
            </style>
        </head>
        <body>
            <div class="app-card">
                <h1>Librex Pasajeros</h1>
                <p>Registro y Verificación de Identidad</p>
                <form id="regForm">
                    <input type="text" id="fullName" placeholder="Nombre Completo" required>
                    <input type="tel" id="phone" placeholder="Número de Teléfono" required>
                    <input type="email" id="email" placeholder="Correo Electrónico" required>
                    
                    <label>Foto de Rostro (Selfie)</label>
                    <input type="file" id="selfieFile" accept="image/*" required>
                    
                    <label>Cédula de Identidad (Frente)</label>
                    <input type="file" id="docFrontFile" accept="image/*" required>

                    <label>Cédula de Identidad (Dorso / Espalda)</label>
                    <input type="file" id="docBackFile" accept="image/*" required>

                    <button type="submit" id="btnSubmit">Registrarse y Pedir Viaje</button>
                </form>
                <div id="msg" style="margin-top: 15px; font-size: 13px;"></div>
            </div>
            <script>
                function convertirBase64(file) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = error => reject(error);
                    });
                }

                document.getElementById('regForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = document.getElementById('btnSubmit');
                    const msg = document.getElementById('msg');
                    
                    const selfieInput = document.getElementById('selfieFile').files[0];
                    const docFrontInput = document.getElementById('docFrontFile').files[0];
                    const docBackInput = document.getElementById('docBackFile').files[0];

                    if (!selfieInput || !docFrontInput || !docBackInput) {
                        alert('Debes adjuntar tu foto de rostro y ambos lados de tu cédula.');
                        return;
                    }

                    btn.disabled = true;
                    btn.innerText = 'Procesando imágenes...';
                    msg.innerText = 'Subiendo datos y validando unicidad...';
                    msg.style.color = '#38bdf8';

                    try {
                        const selfieBase64 = await convertirBase64(selfieInput);
                        const docFrontBase64 = await convertirBase64(docFrontInput);
                        const docBackBase64 = await convertirBase64(docBackInput);

                        const data = {
                            fullName: document.getElementById('fullName').value,
                            phone: document.getElementById('phone').value,
                            email: document.getElementById('email').value,
                            selfieBase64,
                            docFrontBase64,
                            docBackBase64
                        };

                        const res = await fetch('/api/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await res.json();
                        msg.innerText = result.message;
                        msg.style.color = result.success ? '#34d399' : '#f87171';
                        if (result.success) document.getElementById('regForm').reset();
                    } catch (err) {
                        msg.innerText = 'Error de red o archivos muy pesados.';
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
