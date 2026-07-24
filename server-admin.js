const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = "librex2026";

function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ usersPending: {}, driversPending: {}, usersActive: {}, driversActive: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Panel de Administración
app.get('/admin', (req, res) => {
    if (req.query.key !== ADMIN_PASSWORD) {
        return res.send('<h2 style="font-family:sans-serif; background:#0f172a; color:#ef4444; padding:50px; text-align:center;">Acceso Denegado</h2>');
    }

    const db = getDB();
    let usersHTML = '';
    for (const [phone, u] of Object.entries(db.usersPending)) {
        usersHTML += `<div style="background:#0f172a; padding:10px; margin-bottom:8px; border-radius:6px; border:1px solid #334155;">
            <b>${u.name}</b> (Tel: ${u.phone})<br>
            <img src="${u.cedulaFront}" style="width:80px; height:50px; object-fit:cover; margin-top:5px;"/><br>
            <form action="/admin/approve-user" method="POST" style="margin-top:5px;"><input type="hidden" name="phone" value="${phone}"><button type="submit" style="background:#22c55e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Aprobar Pasajero</button></form>
        </div>`;
    }

    let driversHTML = '';
    for (const [phone, d] of Object.entries(db.driversPending)) {
        driversHTML += `<div style="background:#0f172a; padding:10px; margin-bottom:8px; border-radius:6px; border:1px solid #334155;">
            <b>${d.name}</b> - Placa: ${d.plate} (Tel: ${d.phone})<br>
            <div style="display:flex; gap:4px; margin-top:5px;">
                <img src="${d.profilePic}" style="width:50px; height:50px; object-fit:cover;" title="Perfil"/>
                <img src="${d.cedulaFront}" style="width:70px; height:50px; object-fit:cover;" title="Cédula"/>
                <img src="${d.vehicleCard}" style="width:70px; height:50px; object-fit:cover;" title="Propiedad"/>
            </div>
            <form action="/admin/approve-driver" method="POST" style="margin-top:5px;"><input type="hidden" name="phone" value="${phone}"><button type="submit" style="background:#22c55e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Aprobar Conductor</button></form>
        </div>`;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><title>Admin Librex</title></head>
        <body style="font-family:sans-serif; background:#0f172a; color:white; padding:20px;">
            <div style="max-width:600px; margin:0 auto;">
                <h1 style="color:#38bdf8;">Panel de Control Total (Admin) 🔐</h1>
                <div style="background:#1e293b; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #334155;">
                    <h3 style="color:#facc15; margin-top:0;">Pasajeros Pendientes</h3>
                    ${usersHTML || '<p style="color:#64748b;">No hay pasajeros pendientes.</p>'}
                </div>
                <div style="background:#1e293b; padding:15px; border-radius:8px; border:1px solid #334155;">
                    <h3 style="color:#22c55e; margin-top:0;">Conductores Pendientes</h3>
                    ${driversHTML || '<p style="color:#64748b;">No hay conductores pendientes.</p>'}
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/admin/approve-user', (req, res) => {
    const { phone } = req.body;
    const db = getDB();
    if (db.usersPending[phone]) {
        db.usersActive[phone] = { ...db.usersPending[phone], status: 'active' };
        delete db.usersPending[phone];
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

app.post('/admin/approve-driver', (req, res) => {
    const { phone } = req.body;
    const db = getDB();
    if (db.driversPending[phone]) {
        db.driversActive[phone] = { ...db.driversPending[phone], balance: 0, status: 'active' };
        delete db.driversPending[phone];
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
    res.redirect('/admin?key=' + ADMIN_PASSWORD);
});

app.listen(3000, () => console.log('[MICRO-SERVER] Administrador corriendo en puerto 3000'));
