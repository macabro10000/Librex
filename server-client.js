const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// URL de tu servidor administrador central en Render
const ADMIN_URL = process.env.ADMIN_URL || 'https://librex-980i.onrender.com';

// Seguridad básica
app.use(helmet());

// Permitir conexiones entre cliente, conductor y administrador
app.use(cors());

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

// Función para generar IDs únicos
function generarId() {
    return crypto.randomUUID();
}

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
        console.error('[CLIENT-SERVER] Error de conexión:', error.message);
        throw error;
    }
}

// Registro directo que sincroniza con el Admin con reintentos y validación de duplicados
app.post('/api/register', async (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64, docBackBase64 } = req.body;

    if (!phone || !fullName) {
        return res.status(400).json({
            success: false,
            message: 'Datos incompletos.'
        });
    }

    const nuevoCliente = {
        id: generarId(),
        phone: phone.trim(),
        fullName: fullName.trim(),
        email: email ? email.trim() : 'Sin correo',
        selfieBase64: selfieBase64 || '',
        docFrontBase64: docFrontBase64 || '',
        docBackBase64: docBackBase64 || '',
        status: 'Activo',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };
    let intentos = 3;
    let exito = false;
    let resultadoAdmin = null;

    while (intentos > 0 && !exito) {

        try {

            console.log(`[CLIENT-SYNC] Conectando con el servidor principal... Intentos restantes: ${intentos}`);

            const response = await fetchWithTimeout(
                `${ADMIN_URL}/api/admin/sync-client`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(nuevoCliente)
                },
                60000
            );

            resultadoAdmin = await response.json();

            if (response.ok && resultadoAdmin.success) {

                exito = true;

            } else {

                return res.status(response.status || 400).json({
                    success: false,
                    message: resultadoAdmin.message || 'No fue posible registrar el pasajero.'
                });

            }

        } catch (error) {

            console.warn(`[CLIENT-SYNC] Error de conexión. Reintentando... (${intentos - 1} intentos restantes)`);

            intentos--;

            if (intentos > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

        }

    }

    if (exito) {

        return res.json({
            success: true,
            message: '¡Registro de pasajero exitoso y sincronizado!'
        });

    }

    return res.status(503).json({
        success: false,
        message: 'El servidor principal no está disponible. Intenta nuevamente en unos segundos.'
    });

});

const path = require('path');

// Servir la carpeta pública
app.use(express.static(path.join(__dirname, 'public')));

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`[CLIENT-SERVER] Servidor de Clientes activo en puerto ${PORT}`);
});
