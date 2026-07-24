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

// Portal de Registro de Pasajero
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Librex - Pasajeros</title></head>
        <body style="font-family:sans-serif; background:#0f172a; color:white; padding:20px;">
            <div style="max-width:400px; margin:0 auto; background:#1e293b; padding:20px; border-radius:12px; border:1px solid #334155;">
                <h2 style="color:#38bdf8; text-align:center;">Portal de Pasajeros 👤</h2>
                <form action="/register-user" method="POST" enctype="multipart/form-data">
                    <label style="font-size:13px; color:#38bdf8;">Nombre Completo:</label>
                    <input type="text" name="name" required style="width:100%; padding:10px; margin:5px 0 12px 0; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                    <label style="font-size:13px; color:#38bdf8;">Cédula:</label>
                    <input type="text" name="cedula" required style="width:100%; padding:10px; margin:5px 0 12px 0; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                    <label style="font-size:13px; color:#38bdf8;">Celular (WhatsApp):</label>
                    <input type="text" name="phone" required style="width:100%; padding:10px; margin:5px 0 12px 0; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                    <label style="font-size:13px; color:#38bdf8;">📸 Foto Cédula (Frente):</label>
                    <input type="file" name="cedulaFront" accept="image/*" capture="environment" required style="width:100%; padding:8px; margin:5px 0 15px 0; background:#0f172a; color:#38bdf8; border:1px dashed #38bdf8; border-radius:6px;">
                    <button type="submit" style="width:100%; background:#2563eb; color:white; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Registrarse como Pasajero</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/register-user', upload.fields([{ name: 'cedulaFront', maxCount: 1 }]), (req, res) => {
    const data = req.body;
    const files = req.files;
    let frontBase64 = files && files['cedulaFront'] ? `data:${files['cedulaFront'][0].mimetype};base64,${files['cedulaFront'][0].buffer.toString('base64')}` : "";

    const db = getDB();
    db.usersPending[data.phone] = { ...data, cedulaFront: frontBase64, time: new Date().toLocaleString() };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    res.send(`<body style="background:#0f172a; color:white; text-align:center; padding:50px; font-family:sans-serif;"><h2>¡Registro de Pasajero Exitoso!</h2><p>Tus datos fueron enviados al administrador.</p></body>`);
});

app.listen(3001, () => console.log('[MICRO-SERVER] Pasajeros corriendo en puerto 3001'));
