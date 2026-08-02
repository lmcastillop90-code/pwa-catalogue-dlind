// Inicialización compartida del Admin SDK (usa la variable de entorno FIREBASE_SERVICE_ACCOUNT)
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
}

async function requireUser(req, perms = []) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw { code: 401, msg: 'Sin token' };
  const decoded = await admin.auth().verifyIdToken(token);
  const snap = await admin.firestore().doc(`usuarios/${decoded.uid}`).get();
  if (!snap.exists) throw { code: 403, msg: 'Usuario sin perfil' };
  const u = snap.data();
  if (u.activo !== true) throw { code: 403, msg: 'Usuario desactivado' };
  for (const p of perms) {
    if (u.rol !== 'admin' && !(u.permisos && u.permisos[p] === true))
      throw { code: 403, msg: 'Sin permiso: ' + p };
  }
  return { uid: decoded.uid, ...u };
}

module.exports = { admin, requireUser };
