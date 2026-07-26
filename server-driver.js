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

// Esquema y Modelo del Conductor
const driverSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    phone: { type: String, required: true, trim: true }, // Removido unique restrictivo directo para permitir re-registros limpios si se elimina
    fullName: { type: String, required: true, trim: true },
    email: { type: String, default: 'Sin correo', trim: true },
    selfieBase64: { type: String, default: '' },
    docFrontBase64: { type: String, default: '' }, // Licencia / Pase
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

// Registro de conductor con persistencia local en Atlas y sincronización con el Admin en segundo plano
app.post('/api/register', async (req, res) => {
    const { phone, fullName, email, selfieBase64, docFrontBase64 } = req.body;
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    const phoneTrim = phone.trim();

    try {
        // Limpiamos registros previos con el mismo teléfono para evitar bloqueos molestos si se eliminó antes
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

        // Guardar localmente en la base de datos
        const nuevoConductorDB = new Driver(nuevoConductorData);
        await nuevoConductorDB.save();

        // Responderle al cliente de inmediato para que la app fluya sin bloqueos
        res.json({ 
            success: true, 
            message: '¡Registro de conductor exitoso, guardado y sincronizado!',
            driver: nuevoConductorData
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
                console.error('[SYNC-WARNING] No se pudo sincronizar con el admin en este instante, se intentará luego.');
            }
        });

    } catch (dbError) {
        console.error('[DB-ERROR]', dbError);
        return res.status(500).json({ success: false, message: 'Error interno al procesar el registro en la base de datos.' });
    }
});

// Interfaz principal estilo App Profesional (Yango Style) con Pestañas e Integración del Mapa Real
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Librex Conductores</title>
            <!-- Leaflet CSS para el mapa -->
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
                body { background: #090d16; color: #fff; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
                
                /* Contenedor de Vistas */
                .view-container { flex: 1; position: relative; overflow-y: auto; display: none; padding-bottom: 80px; }
                .view-container.active { display: block; }

                /* MAPA VIEW (Pedidos) */
                #map { width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 1; }
                
                /* Top Banner de Alerta / Selfie */
                .top-alert { position: absolute; top: 10px; left: 15px; right: 15px; background: #ef4444; color: white; padding: 10px 15px; border-radius: 8px; z-index: 1000; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                .top-alert span { cursor: pointer; background: white; color: #ef4444; padding: 3px 8px; border-radius: 4px; font-size: 11px; }

                /* Overlay Inferior en Mapa */
                .map-overlay { position: absolute; bottom: 65px; left: 0; right: 0; z-index: 1000; padding: 15px; display: flex; flex-direction: column; gap: 10px; pointer-events: none; }
                .card-widget { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 15px; pointer-events: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
                
                .guaranteed-price { display: flex; justify-content: space-between; align-items: center; background: #1f2937; padding: 12px 15px; border-radius: 12px; font-weight: bold; }
                .guaranteed-price span:first-child { background: #3b82f6; padding: 4px 10px; border-radius: 20px; font-size: 12px; }

                .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .stat-box { background: #1f2937; padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 10px; }
                .stat-box img, .stat-box div.icon { font-size: 20px; }

                .action-banner { background: #1f2937; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; color: #9ca3af; font-size: 13px; }
                .action-banner b { color: #fff; display: block; font-size: 14px; margin-bottom: 2px; }

                /* VISTAS INTERNAS (Dinero, Perfil, Lista, Chats) */
                .content-padded { padding: 20px; }
                h1.section-title { font-size: 24px; margin-bottom: 15px; font-weight: bold; }
                
                .money-card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 20px; margin-bottom: 12px; }
                .money-big { font-size: 36px; font-weight: bold; color: #fff; margin: 10px 0; }
                
                /* Perfil Estilo Yango */
                .profile-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; background: #111827; padding: 15px; border-radius: 16px; border: 1px solid #1f2937; }
                .profile-avatar { width: 65px; height: 65px; border-radius: 50%; object-fit: cover; border: 2px solid #34d399; }
                .profile-info h3 { font-size: 18px; margin-bottom: 4px; }
                .profile-info p { color: #9ca3af; font-size: 13px; }

                .menu-list { display: flex; flex-direction: column; gap: 8px; }
                .menu-item { background: #111827; border: 1px solid #1f2937; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #fff; cursor: pointer; text-decoration: none; }
                
                /* BARRA DE NAVEGACIÓN INFERIOR */
                .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 60px; background: #0b0f19; border-top: 1px solid #1f2937; display: flex; justify-content: space-around; align-items: center; z-index: 2000; }
                .nav-item { background: none; border: none; color: #9ca3af; display: flex; flex-direction: column; align-items: center; font-size: 11px; cursor: pointer; gap: 4px; position: relative; width: 20%; }
                .nav-item.active { color: #34d399; }
                .nav-item svg { width: 22px; height: 22px; fill: currentColor; }
                .badge-dot { position: absolute; top: 2px; right: 28%; width: 8px; height: 8px; background: #ef4444; border-radius: 50%; }
                .badge-num { position: absolute; top: 0; right: 15%; background: #ef4444; color: white; font-size: 9px; padding: 1px 5px; border-radius: 10px; font-weight: bold; }

                /* MODAL DE REGISTRO / LOGIN */
                #regModal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(5,7,12,0.95); z-index: 3000; display: flex; justify-content: center; align-items: center; padding: 20px; overflow-y: auto; }
                .modal-card { width: 100%; max-width: 400px; background: #111827; padding: 25px; border-radius: 20px; border: 1px solid #1f2937; text-align: center; }
                .modal-card h2 { color: #34d399; font-size: 22px; margin-bottom: 5px; }
                .modal-card p { color: #9ca3af; font-size: 13px; margin-bottom: 15px; }
                .modal-card input { width: 100%; padding: 12px; margin: 8px 0; background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; font-size: 14px; }
                .modal-card label { display: block; text-align: left; font-size: 12px; color: #9ca3af; margin-top: 10px; }
                .modal-card input[type="file"] { background: #111827; padding: 8px; border: 1px dashed #374151; }
                .modal-card button { width: 100%; padding: 14px; background: #059669; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 15px; font-size: 15px; }
            </style>
        </head>
        <body>

            <!-- MODAL DE REGISTRO (Si no hay sesión guardada) -->
            <div id="regModal" style="display:none;">
                <div class="modal-card">
                    <h2>Librex Conductores</h2>
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
            </div>

            <!-- VISTA 1: PEDIDOS (MAPA) -->
            <div id="view-pedidos" class="view-container active">
                <div class="top-alert" id="topAlert" style="display:none;">
                    <span>Verificación</span> Realiza una verificación por selfie
                </div>
                <div id="map"></div>
                <div class="map-overlay">
                    <div class="card-widget guaranteed-price">
                        <span>desde 5100 $</span>
                        <div style="display:flex; align-items:center; gap:5px; font-size: 14px;">Precio mínimo garantizado <span>›</span></div>
                    </div>
                    <div class="stats-row">
                        <div class="stat-box">
                            <div style="font-size:22px;">⭐</div>
                            <div>
                                <div style="font-size: 11px; color: #9ca3af;">Prioridad</div>
                                <div style="font-size: 15px; font-weight: bold;" id="driverPriority">+41</div>
                            </div>
                        </div>
                        <div class="stat-box">
                            <div style="font-size:22px;">💳</div>
                            <div>
                                <div style="font-size: 11px; color: #9ca3af;">0 pedidos</div>
                                <div style="font-size: 15px; font-weight: bold;">0 $</div>
                            </div>
                        </div>
                    </div>
                    <div class="action-banner">
                        <div>
                            <b>Pedidos de viaje no disponibles</b>
                            Resuelve los conflictos con la solución de problemas
                        </div>
                        <span style="font-size: 18px;">➔</span>
                    </div>
                </div>
            </div>

            <!-- VISTA 2: LISTA DE SOLICITUDES -->
            <div id="view-lista" class="view-container content-padded">
                <h1 class="section-title">Lista de solicitudes</h1>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="background: #111827; border: 1px solid #1f2937; height: 90px; border-radius: 12px; display:flex; align-items:center; justify-content:center; color: #4b5563;">Buscando solicitudes cercanas...</div>
                    <div style="background: #111827; border: 1px solid #1f2937; height: 90px; border-radius: 12px; display:flex; align-items:center; justify-content:center; color: #4b5563;">Sin solicitudes en espera</div>
                </div>
            </div>

            <!-- VISTA 3: DINERO -->
            <div id="view-dinero" class="view-container content-padded">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h1 class="section-title" style="margin-bottom:0;">Dinero</h1>
                    <div style="background: #10b981; color: #fff; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 5px;">🤝 Servicio de Asistencia</div>
                </div>
                <div class="money-card">
                    <div style="color: #9ca3af; font-size: 13px;">Hoy</div>
                    <div class="money-big">0 $</div>
                </div>
                <div class="money-card" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 14px; font-weight: bold;">Límitar del saldo</div>
                        <div style="color: #9ca3af; font-size: 12px;">Todo parece en orden</div>
                    </div>
                    <div style="font-size: 16px; font-weight: bold;">-50.000 $</div>
                </div>
                <div class="money-card">
                    <div style="color: #9ca3af; font-size: 12px;">Saldo</div>
                    <div style="font-size: 22px; font-weight: bold; margin: 5px 0;">-20.102 $</div>
                    <div style="color: #9ca3af; font-size: 12px; margin-top: 10px;">Empresa asociada</div>
                    <div style="font-weight: bold; font-size: 14px;">Pro Drivers Colombia SAS</div>
                </div>
            </div>

            <!-- VISTA 4: CHATS -->
            <div id="view-chats" class="view-container content-padded">
                <h1 class="section-title">Chats</h1>
                <div style="background: #111827; border: 1px solid #1f2937; padding: 20px; border-radius: 12px; text-align: center; color: #9ca3af;">
                    No tienes conversaciones activas con soporte o pasajeros.
                </div>
            </div>

            <!-- VISTA 5: PERFIL -->
            <div id="view-perfil" class="view-container content-padded">
                <div class="profile-header">
                    <img id="profileAvatarImg" src="" class="profile-avatar" alt="Avatar">
                    <div class="profile-info">
                        <h3 id="profileName">Conductor Librex</h3>
                        <p id="profilePhone">+57 000 0000000</p>
                    </div>
                </div>
                <div class="menu-list">
                    <div class="menu-item"><span>Socio</span> <span>Pro Drivers Colombia SAS ›</span></div>
                    <div class="menu-item"><span>Tipos de servicios y opciones</span> <span>2 de 7 ›</span></div>
                    <div class="menu-item"><span>Pago</span> <span>Pago en efectivo y con tarjeta ›</span></div>
                </div>
                <h3 style="font-size: 16px; margin: 20px 0 10px 0;">Mis vehículos</h3>
                <div class="menu-item" style="display: block;">
                    <div style="font-weight: bold; font-size: 15px;">Hyundai Atos · 1 vehículo en total</div>
                    <div style="background: #fff; color: #000; display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-top: 8px;" id="profileVehiclePlate">VCW348</div>
                </div>
            </div>

            <!-- BARRA DE NAVEGACIÓN INFERIOR -->
            <nav class="bottom-nav">
                <button class="nav-item active" onclick="switchView('pedidos', this)">
                    <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    Pedidos
                </button>
                <button class="nav-item" onclick="switchView('lista', this)">
                    <div class="badge-dot"></div>
                    <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
                    Lista
                </button>
                <button class="nav-item" onclick="switchView('dinero', this)">
                    <svg viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                    Dinero
                </button>
                <button class="nav-item" onclick="switchView('chats', this)">
                    <span class="badge-num">165</span>
                    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
                    Chats
                </button>
                <button class="nav-item" onclick="switchView('perfil', this)">
                    <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    Perfil
                </button>
            </nav>

            <!-- Leaflet JS -->
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <script>
                // Inicializar Mapa
                let map = L.map('map', { zoomControl: false }).setView([3.4516, -76.5320], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap'
                }).addTo(map);

                let marker = L.marker([3.4516, -76.5320]).addTo(map)
                    .bindPopup('Tu ubicación actual')
                    .openPopup();

                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(position => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        map.setView([lat, lng], 16);
                        marker.setLatLng([lat, lng]);
                    });
                }

                // Cambiar de Pestañas
                function switchView(viewName, btnElement) {
                    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
                    document.getElementById('view-' + viewName).classList.add('active');

                    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                    btnElement.classList.add('active');

                    if(viewName === 'pedidos') {
                        setTimeout(() => { map.invalidateSize(); }, 200);
                    }
                }

                // Compresión de imágenes
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

                // Gestión de sesión de Conductor LocalStorage
                function checkDriverSession() {
                    const savedDriver = localStorage.getItem('librex_driver');
                    if (!savedDriver) {
                        document.getElementById('regModal').style.display = 'flex';
                    } else {
                        const driver = JSON.parse(savedDriver);
                        updateDriverUI(driver);
                    }
                }

                function updateDriverUI(driver) {
                    document.getElementById('profileName').innerText = driver.fullName;
                    document.getElementById('profilePhone').innerText = driver.phone;
                    if (driver.selfieBase64) {
                        document.getElementById('profileAvatarImg').src = driver.selfieBase64;
                    }
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
                        const selfieBase64 = await comprimirYConvertirBase64(selfieInput);
                        const docFrontBase64 = await comprimirYConvertirBase64(docInput);

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
                        
                        if (result.success) {
                            localStorage.setItem('librex_driver', JSON.stringify(result.driver));
                            updateDriverUI(result.driver);
                            document.getElementById('regModal').style.display = 'none';
                        } else {
                            msg.innerText = result.message;
                            msg.style.color = '#f87171';
                        }
                    } catch (err) {
                        msg.innerText = 'Error de red o imágenes demasiado pesadas.';
                        msg.style.color = '#f87171';
                    } finally {
                        btn.disabled = false;
                        btn.innerText = 'Registrarse como Conductor';
                    }
                });

                // Inicializar al cargar
                window.onload = () => {
                    checkDriverSession();
                };
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log(`[DRIVER-SERVER] Servidor de Conductores activo en puerto ${PORT}`));
