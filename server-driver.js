const express = require('express');
const compression = require('compression');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(compression());

// URL de tu servidor administrador central en Render
const ADMIN_URL = 'https://librex-980i.onrender.com';

// Cadena de conexión a MongoDB Atlas
const MONGO_URI = 'mongodb+srv://vitorinoarenas1000_db_user:nATMmayO0SGQEpuD@librex.lglongl.mongodb.net/librex_conductores?retryWrites=true&w=majority&appName=Librex';

// Conexión a Base de Datos
mongoose.connect(MONGO_URI)
    .then(() => console.log('[DB-DRIVER] Conectado exitosamente a MongoDB Atlas'))
    .catch(err => console.error('[DB-DRIVER] Error de conexión a MongoDB:', err));

// Esquema y Modelo del Conductor actualizado
const driverSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, default: 'Sin correo', trim: true },
    vehicleType: { type: String, default: 'Particular' }, // Particular o Público
    selfieBase64: { type: String, default: '' },        // Foto de rostro directa
    docFrontBase64: { type: String, default: '' },      // Cédula / Licencia Frente
    docBackBase64: { type: String, default: '' },       // Cédula / Licencia Reverso
    carPlatePhotoBase64: { type: String, default: '' }, // Foto del carro con placa visible
    status: { type: String, default: 'Disponible' },
    createdAt: { type: String, default: () => new Date().toISOString() },
    lastActivity: { type: String, default: () => new Date().toISOString() }
});

const Driver = mongoose.model('Driver', driverSchema);

// Función fetch con AbortController para llamadas a Render
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

// Ruta de registro en el backend
app.post('/api/register', async (req, res) => {
    const { phone, fullName, email, vehicleType, selfieBase64, docFrontBase64, docBackBase64, carPlatePhotoBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    const phoneTrim = phone.trim();

    try {
        const conductorExistente = await Driver.findOne({ phone: phoneTrim });
        if (conductorExistente) {
            return res.status(400).json({ success: false, message: 'Este número de teléfono ya está registrado como conductor.' });
        }

        const nuevoConductorData = {
            id: Date.now().toString(),
            phone: phoneTrim,
            fullName: fullName.trim(),
            email: email ? email.trim() : 'Sin correo',
            vehicleType: vehicleType || 'Particular',
            selfieBase64: selfieBase64 || '',
            docFrontBase64: docFrontBase64 || '',
            docBackBase64: docBackBase64 || '',
            carPlatePhotoBase64: carPlatePhotoBase64 || '',
            status: 'Disponible',
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };

        const nuevoConductorDB = new Driver(nuevoConductorData);
        await nuevoConductorDB.save();

        res.json({ 
            success: true, 
            message: '¡Registro exitoso! Ingresando a la plataforma...' 
        });

        // Sincronización en segundo plano con el Admin
        setImmediate(async () => {
            try {
                await fetchWithTimeout(`${ADMIN_URL}/api/admin/sync-driver`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nuevoConductorData)
                }, 30000);
            } catch (syncError) {
                console.error('[SYNC-WARNING] No se pudo sincronizar con el admin en este instante.');
            }
        });

    } catch (dbError) {
        console.error('[DB-ERROR]', dbError);
        return res.status(500).json({ success: false, message: 'Error interno al procesar el registro en la base de datos.' });
    }
});

// Interfaz Web: Registro + Panel de Trabajo Integrado (Estilo InDrive / Uber)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex - Conductores</title>
            <!-- Leaflet CSS para el Mapa -->
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
                body { background: #090d16; color: #fff; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
                .container { width: 100%; max-width: 420px; padding: 15px; }
                .app-card { background: #111827; padding: 22px; border-radius: 20px; border: 1px solid #1f2937; text-align: center; }
                h1 { color: #34d399; font-size: 22px; margin-bottom: 5px; }
                p { color: #9ca3af; font-size: 13px; margin-bottom: 15px; }
                input, select { width: 100%; padding: 12px; margin: 8px 0; background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; font-size: 14px; }
                label { display: block; text-align: left; font-size: 12px; color: #34d399; margin-top: 12px; font-weight: bold; }
                input[type="file"] { background: #111827; padding: 8px; border: 1px dashed #059669; font-size: 12px; color: #9ca3af; }
                button { width: 100%; padding: 14px; background: #059669; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 18px; font-size: 15px; }
                button:disabled { background: #374151; cursor: not-allowed; }
                
                /* Estilos del Panel de Conductor / Mapa */
                #driverDashboard { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100vh; background: #090d16; z-index: 999; flex-direction: column; }
                #map { width: 100%; flex: 1; z-index: 1; }
                .driver-hud { position: absolute; bottom: 0; left: 0; width: 100%; background: #111827; border-top-left-radius: 20px; border-top-right-radius: 20px; padding: 20px; border-top: 1px solid #1f2937; z-index: 1000; box-shadow: 0 -5px 20px rgba(0,0,0,0.5); }
                .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 10px; background: #059669; color: #fff; }
                .hud-btn { background: #dc2626; margin-top: 10px; }
            </style>
        </head>
        <body>
            <!-- FORMULARIO DE REGISTRO -->
            <div class="container" id="registerContainer">
                <div class="app-card">
                    <h1>Librex Conductores</h1>
                    <p>Registro y Verificación de Identidad (Cámara Directa)</p>
                    <form id="regForm">
                        <input type="text" id="fullName" placeholder="Nombre Completo" required>
                        <input type="tel" id="phone" placeholder="Número de Teléfono" required>
                        <input type="email" id="email" placeholder="Correo Electrónico" required>
                        
                        <label>Tipo de Vehículo</label>
                        <select id="vehicleType">
                            <option value="Particular">Particular</option>
                            <option value="Público">Público / Taxis</option>
                        </select>

                        <label>📸 Foto de Rostro (Selfie Directa)</label>
                        <input type="file" id="selfieFile" accept="image/*" capture="user" required>
                        
                        <label>🆔 Cédula / Licencia (Frente)</label>
                        <input type="file" id="docFrontFile" accept="image/*" capture="environment" required>

                        <label>🆔 Cédula / Licencia (Reverso)</label>
                        <input type="file" id="docBackFile" accept="image/*" capture="environment" required>

                        <label>🚗 Foto del Carro (Frente con Placa Visible)</label>
                        <input type="file" id="carPlateFile" accept="image/*" capture="environment" required>

                        <button type="submit" id="btnSubmit">Registrarse y Comenzar</button>
                    </form>
                    <div id="msg" style="margin-top: 15px; font-size: 13px;"></div>
                </div>
            </div>

            <!-- PANEL DE TRABAJO TIPO UBER / MAPA -->
            <div id="driverDashboard">
                <div id="map"></div>
                <div class="driver-hud">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 id="driverNameDisplay" style="color: #34d399; font-size: 18px;">Conductor Librex</h3>
                            <p id="driverPhoneDisplay" style="margin: 0; color: #9ca3af; font-size: 12px;"></p>
                        </div>
                        <div class="status-badge" id="statusBadge">🟢 Disponible</div>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #1f2937; margin: 12px 0;">
                    <p style="text-align: center; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Buscando solicitudes de viajes cercanos...</p>
                    <button class="hud-btn" onclick="cerrarSesionConductor()">Cerrar Sesión / Desconectarse</button>
                </div>
            </div>

            <!-- Leaflet JS -->
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <script>
                let mapInstance = null;
                let markerInstance = null;

                function comprimirYConvertirBase64(file) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = event => {
                            const img = new Image();
                            img.src = event.target.result;
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const MAX_WIDTH = 800;
                                const MAX_HEIGHT = 800;
                                let width = img.width;
                                let height = img.height;

                                if (width > height) {
                                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                                } else {
                                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                                }

                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                resolve(canvas.toDataURL('image/jpeg', 0.7));
                            };
                            img.onerror = error => reject(error);
                        };
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
                    const carPlateInput = document.getElementById('carPlateFile').files[0];

                    if (!selfieInput || !docFrontInput || !docBackInput || !carPlateInput) {
                        alert('Debes tomar todas las fotos requeridas (Selfie, Frente, Reverso y Placa del carro).');
                        return;
                    }

                    btn.disabled = true;
                    btn.innerText = 'Capturando y procesando...';
                    msg.innerText = 'Validando y guardando credenciales...';
                    msg.style.color = '#34d399';

                    try {
                        const selfieBase64 = await comprimirYConvertirBase64(selfieInput);
                        const docFrontBase64 = await comprimirYConvertirBase64(docFrontInput);
                        const docBackBase64 = await comprimirYConvertirBase64(docBackInput);
                        const carPlatePhotoBase64 = await comprimirYConvertirBase64(carPlateInput);

                        const fullNameVal = document.getElementById('fullName').value;
                        const phoneVal = document.getElementById('phone').value;

                        const data = {
                            fullName: fullNameVal,
                            phone: phoneVal,
                            email: document.getElementById('email').value,
                            vehicleType: document.getElementById('vehicleType').value,
                            selfieBase64,
                            docFrontBase64,
                            docBackBase64,
                            carPlatePhotoBase64
                        };

                        const res = await fetch('/api/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await res.json();

                        if (result.success) {
                            // Guardar sesión local en el navegador
                            localStorage.setItem('librex_driver_name', fullNameVal);
                            localStorage.setItem('librex_driver_phone', phoneVal);
                            
                            // Mostrar panel de trabajo (Mapa estilo Uber)
                            activarDashboardConductor(fullNameVal, phoneVal);
                        } else {
                            msg.innerText = result.message;
                            msg.style.color = '#f87171';
                            btn.disabled = false;
                            btn.innerText = 'Registrarse y Comenzar';
                        }
                    } catch (err) {
                        msg.innerText = 'Error de red o imágenes demasiado pesadas.';
                        msg.style.color = '#f87171';
                        btn.disabled = false;
                        btn.innerText = 'Registrarse y Comenzar';
                    }
                });

                function activarDashboardConductor(name, phone) {
                    document.getElementById('registerContainer').style.display = 'none';
                    document.getElementById('driverDashboard').style.display = 'flex';
                    document.getElementById('driverNameDisplay').innerText = name;
                    document.getElementById('driverPhoneDisplay').innerText = 'Tel: ' + phone;

                    // Inicializar Mapa Leaflet con GPS en tiempo real
                    if (!mapInstance) {
                        mapInstance = L.map('map').setView([4.60971, -74.08175], 15); // Ubicación inicial por defecto
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            maxZoom: 19,
                            attribution: 'Librex Map'
                        }).addTo(mapInstance);

                        // Seguir ubicación del conductor por GPS si el navegador lo permite
                        if (navigator.geolocation) {
                            navigator.geolocation.watchPosition(position => {
                                const lat = position.coords.latitude;
                                const lng = position.coords.longitude;
                                mapInstance.setView([lat, lng], 17);

                                if (markerInstance) {
                                    markerInstance.setLatLng([lat, lng]);
                                } else {
                                    markerInstance = L.marker([lat, lng]).addTo(mapInstance)
                                        .bindPopup('Tu ubicación actual').openPopup();
                                }
                            }, error => {
                                console.log('GPS no disponible:', error);
                            }, { enableHighAccuracy: true });
                        }
                    }
                }

                function cerrarSesionConductor() {
                    localStorage.removeItem('librex_driver_name');
                    localStorage.removeItem('librex_driver_phone');
                    location.reload();
                }

                // Autologin si ya se había registrado en este navegador
                window.onload = () => {
                    const savedName = localStorage.getItem('librex_driver_name');
                    const savedPhone = localStorage.getItem('librex_driver_phone');
                    if (savedName && savedPhone) {
                        activarDashboardConductor(savedName, savedPhone);
                    }
                };
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log(`[DRIVER-SERVER] Servidor de Conductores activo en puerto ${PORT}`));
