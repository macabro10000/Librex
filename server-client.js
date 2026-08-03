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
