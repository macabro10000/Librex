const express = require('express');
const compression = require('compression');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

app.use(express.static(__dirname));

const ADMIN_URL = process.env.ADMIN_URL || 'https://librex-980i.onrender.com';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://vitorinoarenas1000_db_user:nATMmayO0SGQEpuD@librex.lglongl.mongodb.net/librex_conductores?retryWrites=true&w=majority&appName=Librex';

// Conexión a MongoDB Atlas
mongoose.connect(MONGO_URI)
    .then(() => console.log('[DB-DRIVER] Conectado exitosamente a MongoDB Atlas'))
    .catch(err => console.error('[DB-DRIVER] Error de conexión a MongoDB:', err));

// Esquema actualizado con todos los campos y la tarjeta de propiedad
const driverSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    cedula: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: 'Sin correo', trim: true },
    carBrandModel: { type: String, default: '', trim: true },
    carPlate: { type: String, default: '', trim: true },
    selfieBase64: { type: String, default: '' },
    licenseFrontBase64: { type: String, default: '' },
    licenseBackBase64: { type: String, default: '' },
    propertyCardBase64: { type: String, default: '' },
    carPhotoBase64: { type: String, default: '' },
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

// Ruta de Registro de Conductor
app.post('/api/register', async (req, res) => {
    const { 
        fullName, 
        cedula, 
        phone, 
        email, 
        carBrandModel, 
        carPlate, 
        selfieBase64, 
        licenseFrontBase64, 
        licenseBackBase64, 
        propertyCardBase64,
        carPhotoBase64 
    } = req.body;

    if (!phone || !fullName || !cedula) {
        return res.status(400).json({ success: false, message: 'Datos obligatorios incompletos (Nombre, Cédula o Teléfono).' });
    }

    const phoneTrim = phone.trim();

    try {
        await Driver.deleteMany({ phone: phoneTrim });

        const nuevoConductorData = {
            id: 'drv_' + Date.now(),
            fullName: fullName.trim(),
            cedula: cedula.trim(),
            phone: phoneTrim,
            email: email ? email.trim() : 'Sin correo',
            carBrandModel: carBrandModel ? carBrandModel.trim() : '',
            carPlate: carPlate ? carPlate.trim() : '',
            selfieBase64: selfieBase64 || '',
            licenseFrontBase64: licenseFrontBase64 || '',
            licenseBackBase64: licenseBackBase64 || '',
            propertyCardBase64: propertyCardBase64 || '',
            carPhotoBase64: carPhotoBase64 || '',
            status: 'Disponible',
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };

        const nuevoConductorDB = new Driver(nuevoConductorData);
        await nuevoConductorDB.save();

        try {
            await fetchWithTimeout(`${ADMIN_URL}/api/admin/sync-driver`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoConductorData)
            }, 30000);
        } catch (syncError) {
            console.error('[SYNC-WARNING] No se pudo sincronizar inmediatamente con el admin:', syncError.message);
        }

        return res.json({ 
            success: true, 
            message: '¡Registro de conductor exitoso y guardado en MongoDB!',
            driver: nuevoConductorData
        });

    } catch (dbError) {
        console.error('[DB-ERROR]', dbError);
        return res.status(500).json({ success: false, message: 'Error interno al procesar el registro en la base de datos.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(() => {
    fetch(`${SELF_URL}/`).catch(() => {});
}, 4 * 60 * 1000);

app.listen(PORT, () => console.log(`[DRIVER-SERVER] Servidor de Conductores activo en puerto ${PORT}`));
