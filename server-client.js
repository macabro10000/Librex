const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// URL del servidor administrador central
const ADMIN_URL = process.env.ADMIN_URL || 'https://librex-980i.onrender.com';

// Seguridad
app.use(helmet());

// Permitir conexiones
app.use(cors());

// Compresión y lectura de datos
app.use(compression());
app.use(express.urlencoded({
    extended: true,
    limit: '50mb'
}));
app.use(express.json({
    limit: '50mb'
}));

// Generar ID único
function generarId() {
    return crypto.randomUUID();
}

// Estado del servidor
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        server: 'Librex Cliente',
        status: 'online',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Función Fetch con Timeout
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

        console.error('[CLIENT-SERVER]', error.message);

        throw error;

    }

}

// Registro de pasajeros
app.post('/api/register', async (req, res) => {

    const {
        phone,
        fullName,
        email,
        selfieBase64,
        docFrontBase64,
        docBackBase64
    } = req.body;

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

            console.error('[CLIENT-SYNC]', error.message);

            intentos--;

            if (intentos > 0) {

                console.log(`[CLIENT-SYNC] Reintentando en 3 segundos... (${intentos} intentos restantes)`);

                await new Promise(resolve => setTimeout(resolve, 3000));

            }

        }

    }

    if (exito) {

        return res.json({
            success: true,
            message: '¡Registro de pasajero exitoso y sincronizado!',
            cliente: {
                id: nuevoCliente.id,
                nombre: nuevoCliente.fullName,
                telefono: nuevoCliente.phone
            }
        });

    }

    return res.status(503).json({
        success: false,
        message: 'El servidor principal no está disponible. Intenta nuevamente en unos segundos.'
    });

});

// Servir archivos públicos
app.use(express.static(path.join(__dirname, 'public')));

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Página no encontrada
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada.'
    });
});

// Capturar errores del servidor
app.use((err, req, res, next) => {

    console.error('[SERVER ERROR]', err);

    res.status(500).json({
        success: false,
        message: 'Error interno del servidor.'
    });

});

// Iniciar servidor
app.listen(PORT, () => {

    console.log('===================================');
    console.log('   LIBREX CLIENT SERVER INICIADO');
    console.log('===================================');
    console.log(`Puerto: ${PORT}`);
    console.log(`Admin: ${ADMIN_URL}`);
    console.log(`Estado: Activo`);
    console.log('===================================');

});
         
