const express = require('express');
const compression = require('compression');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

// Servir archivos estáticos correctamente desde la misma carpeta raíz
app.use(express.static(__dirname));

// URL de tu servidor administrador central en Render
const ADMIN_URL = process.env.ADMIN_URL || 'https://librex-980i.onrender.com';

// Cadena de conexión a MongoDB Atlas (Conductor)
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://vitorinoarenas1000_db_user:nATMmayO0SGQEpuD@librex.lglongl.mongodb.net/librex_conductores?retryWrites=true&w=majority&appName=Librex';

mongoose.connect(MONGO_URI)
    .then(() => console.log('[DB-DRIVER] Conectado exitosamente a MongoDB Atlas'))
    .catch(err => console.error('[DB-DRIVER] Error de conexión a MongoDB:', err));

const driverSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    phone: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, default: 'Sin correo', trim: true },
    selfieBase64: { type: String, default: '' },
    docFrontBase64: { type: String, default: '' },
    status: { type: String, default: 'Disponible' },
    createdAt: { type: String, default: () => new Date().toISOString() },
    lastActivity: { type: String, default: () => new Date().toISOString() }
});

const Driver = mongoose.model('Driver', driverSchema);

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

app.post('/api/register', async (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    const phoneTrim = phone.trim();

    try {
        await Driver.deleteMany({ phone: phoneTrim });

        const nuevoConductorData = {
            id: Date.now().toString(),
            phone: phoneTrim,
            fullName: fullName.trim(),
            email: email ? email.trim() : 'Sin correo',
            selfieBase64: selfieBase64 || '',
            docFrontBase64: docFrontBase64 || '',
            status: 'Disponible',
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };

        const nuevoConductorDB = new Driver(nuevoConductorData);
        await nuevoConductorDB.save();

        res.json({ 
            success: true, 
            message: '¡Registro de conductor exitoso, guardado y sincronizado!',
            driver: nuevoConductorData
        });

        // Sincronización asíncrona hacia el panel de administración central
        setImmediate(async () => {
            try {
                await fetchWithTimeout(`${ADMIN_URL}/api/admin/sync-driver`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nuevoConductorData)
                }, 30000);
            } catch (syncError) {
                console.error('[SYNC-WARNING] No se pudo sincronizar con el admin en este instante, se reintentará luego.');
            }
        });

    } catch (dbError) {
        console.error('[DB-ERROR]', dbError);
        return res.status(500).json({ success: false, message: 'Error interno al procesar el registro en la base de datos.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`[DRIVER-SERVER] Servidor de Conductores activo en puerto ${PORT}`));
