const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const DB_FILE = path.join(__dirname, 'data.json');

function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ usersPending: {}, driversPending: {}, usersActive: {}, driversActive: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

// Portal de Registro de Conductor
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Librex - Conductores</title></head>
        <body style="font-family:sans-serif; background:#0f172a; color:white; padding:20px;">
            <div style="max-width:400px; margin:0 auto; background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155;">
                <h2 style="color:#22c55e; text-align:center;">Portal de Conductores 🚗</h2>
                <form action="/register-driver" method="POST" enctype="multipart/form-data">
                    <label style="font-size:13px; color:#22c55e;">Nombre y Apellido:</label>
                    <input type="text" name="name" required style="width:100%; padding:10px; margin:5px 0 10px 0; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                    <label style="font-size:13px; color:#22c55e;">Cédula:</label>
                    <input type="text" name="cedula" required style="width:100%; padding:10px; margin:5px 0 10px 0; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                    <label style="font-size:13px; color:#22c55e;">Celular (WhatsApp):</label>
                    <input type="text" name="phone" required style="width:100%; padding:10px; margin:5px 0 10px 0; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                    <label style="font-size:13px; color:#22c55e;">Placa del Vehículo:</label>
                    <input type="text" name="plate" required style="width:100%; padding:10px; margin:5px 0 10px 0; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                    
                    <label style="font-size:12px; color:#22c55e;">📸 Foto de Perfil:</label>
                    <input type="file" name="profilePic" accept="image/*" capture="user" required style="width:100%; padding:6px; margin:5px 0 8px 0; background:#0f172a; color:#22c55e; border:1px dashed #22c55e; border-radius:6px;">
                    
                    <label style="font-size:12px; color:#22c55e;">📸 Cédula (Frente):</label>
                    <input type="file" name="cedulaFront" accept="image/*" capture="environment" required style="width:100%; padding:6px; margin:5px 0 8px 0; background:#0f172a; color:#22c55e; border:1px dashed #22c55e; border-radius:6px;">
                    
                    <label style="font-size:12px; color:#22c55e;">📸 Cédula (Reverso):</label>
                    <input type="file" name="cedulaBack" accept="image/*" capture="environment" required style="width:100%; padding:6px; margin:5px 0 8px 0; background:#0f172a; color:#22c55e; border:1px dashed #22c55e; border-radius:6px;">
                    
                    <label style="font-size:12px; color:#22c55e;">📸 Tarjeta de Propiedad del Carro:</label>
                    <input type="file" name="vehicleCard" accept="image/*" capture="environment" required style="width:100%; padding:6px; margin:5px 0 15px 0; background:#0f172a; color:#22c55e; border:1px dashed #22c55e; border-radius:6px;">

                    <button type="submit" style="width:100%; background:#16a34a; color:white; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Enviar Registro de Conductor</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/register-driver', upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'cedulaFront', maxCount: 1 },
    { name: 'cedulaBack', maxCount: 1 },
    { name: 'vehicleCard', maxCount: 1 }
]), (req, res) => {
    const data = req.body;
    const files = req.files;
    const getB64 = (field) => files && files[field] ? `data:${files[field][0].mimetype};base64,${files[field][0].buffer.toString('base64')}` : "";

    const db = getDB();
    db.driversPending[data.phone] = {
        ...data,
        profilePic: getB64('profilePic'),
        cedulaFront: getB64('cedulaFront'),
        cedulaBack: getB64('cedulaBack'),
        vehicleCard: getB64('vehicleCard'),
        time: new Date().toLocaleString()
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    res.send(`<body style="background:#0f172a; color:white; text-align:center; padding:50px; font-family:sans-serif;"><h2>¡Registro de Conductor Exitoso!</h2><p>Documentos enviados al administrador.</p></body>`);
});

app.listen(3002, () => console.log('[MICRO-SERVER] Conductores corriendo en puerto 3002'));
