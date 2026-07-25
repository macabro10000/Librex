const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

// URL de tu servidor administrador central en Render
const ADMIN_URL = 'https://librex-980i.onrender.com';

async function fetchWithTimeout(url, options = {}, timeout = 60000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// Registro de conductor con fotos y validación de duplicados
app.post('/api/register', async (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    const nuevoConductor = {
        id: Date.now().toString(),
        phone: phone.trim(),
        fullName: fullName.trim(),
        email: email ? email.trim() : 'Sin correo',
        selfieBase64: selfieBase64 || '',
        docFrontBase64: docFrontBase64 || '', // Pase / Licencia de conducir
        status: 'Disponible',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };

    let intentos = 3;
    let exito = false;
    let resultadoAdmin = null;

    while (intentos > 0 && !exito) {
        try {
            const response = await fetchWithTimeout(`${ADMIN_URL}/api/admin/sync-driver`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoConductor)
            }, 60000);

            resultadoAdmin = await response.json();
            if (resultadoAdmin && resultadoAdmin.success) {
                exito = true;
            } else {
                // Si el admin rechaza por duplicado, salimos del ciclo de inmediato
                return res.status(400).json(resultadoAdmin);
            }
        } catch (error) {
            intentos--;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    if (exito) {
        return res.json({ success: true, message: '¡Registro de conductor exitoso y sincronizado!' });
    } else {
        return res.status(500).json({ 
            success: false, 
            message: 'El servidor central está despertando. Por favor, espera unos segundos e intenta nuevamente.' 
        });
    }
});

// Interfaz de Registro del Conductor con captura de Foto de Rostro y Licencia
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Registro de Conductores</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
                body { background: #090d16; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
                .app-card { width: 100%; max-width: 400px; background: #111827; padding: 25px; border-radius: 20px; border: 1px solid #1f2937; text-align: center; }
                h1 { color: #34d399; font-size: 22px; margin-bottom: 5px; }
                p { color: #9ca3af; font-size: 13px; margin-bottom: 15px; }
                input { width: 100%; padding: 12px; margin: 8px 0; background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; font-size: 14px; }
                label { display: block; text-align: left; font-size: 12px; color: #9ca3af; margin-top: 10px; }
                input[type="file"] { background: #111827; padding: 8px; border: 1px dashed #374151; }
                button { width: 100%; padding: 14px; background: #059669; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 15px; font-size: 15px; }
                button:disabled { background: #374151; cursor: not-allowed; }
            </style>
        </head>
        <body>
            <div class="app-card">
                <h1>Librex Conductores</h1>
                <p>Registro y Verificación de Identidad</p>
                <form id="regForm">
                    <input type="text" id="fullName" placeholder="Nombre Completo" required>
                    <input type="tel" id="phone" placeholder="Número de Teléfono" required>
                    <input type="email" id="email" placeholder="Correo Electrónico" required>
                    
                    <label>Foto de Rostro (Selfie)</label>
                    <input type="file" id="selfieFile" accept="image/*" required>
                    
                    <label>Pase / Licencia de Conducir</label>
                    <input type="file" id="docFile" accept="image/*" required>

                    <button type="submit" id="btnSubmit">Registrarse como Conductor</button>
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
                    const docInput = document.getElementById('docFile').files[0];

                    if (!selfieInput || !docInput) {
                        alert('Debes adjuntar tu foto de rostro y tu pase de conducir.');
                        return;
                    }

                    btn.disabled = true;
                    btn.innerText = 'Procesando imágenes...';
                    msg.innerText = 'Subiendo datos y validando unicidad...';
                    msg.style.color = '#34d399';

                    try {
                        const selfieBase64 = await convertirBase64(selfieInput);
                        const docFrontBase64 = await convertirBase64(docInput);

                        const data = {
                            fullName: document.getElementById('fullName').value,
                            phone: document.getElementById('phone').value,
                            email: document.getElementById('email').value,
                            selfieBase64,
                            docFrontBase64
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
                        msg.innerText = 'Error de red o imágenes demasiado pesadas.';
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
