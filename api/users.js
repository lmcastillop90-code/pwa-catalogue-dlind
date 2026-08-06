// Gestión de usuarios: crear, activar/desactivar, cambiar PIN.
// Requiere permiso 'gestionar_usuarios' (o rol admin)....
const { admin, requireUser } = require('./_admin');

const DEFAULT_PERMS = {
  admin:    { ver_stock: true, editar_stock: true,  gestionar_usuarios: true,  ver_historial: true },
  gerente:  { ver_stock: true, editar_stock: true,  gestionar_usuarios: true,  ver_historial: true },
  vendedor: { ver_stock: true, editar_stock: false, gestionar_usuarios: false, ver_historial: false },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const caller = await requireUser(req, ['gestionar_usuarios']);
    const { action } = req.body || {};
    const db = admin.firestore();

    if (action === 'create') {
      const { nombre, slug, pin, rol } = req.body;
      if (!nombre || !slug || !/^\d{4,6}$/.test(String(pin)) || !DEFAULT_PERMS[rol])
        return res.status(400).json({ error: 'Datos inválidos (nombre, slug, pin 4-6 dígitos, rol)' });
      if (rol === 'admin' && caller.rol !== 'admin')
        return res.status(403).json({ error: 'Solo un admin crea admins' });
      const email = `${slug.toLowerCase().replace(/[^a-z0-9]/g, '')}@dlind.local`;
      let user;
      try {
        user = await admin.auth().createUser({ email, password: `dlind-${pin}`, displayName: nombre });
      } catch (err) {
        if (err.code === 'auth/email-already-exists') {
          // ¿Es un acceso huérfano de un usuario ya eliminado? → auto-reparar
          const orphan = await admin.auth().getUserByEmail(email);
          const doc = await db.doc(`usuarios/${orphan.uid}`).get();
          if (!doc.exists) {
            await admin.auth().deleteUser(orphan.uid);
            user = await admin.auth().createUser({ email, password: `dlind-${pin}`, displayName: nombre });
          } else {
            return res.status(400).json({ error: `El usuario "${slug}" ya existe` });
          }
        } else { throw err; }
      }
      const perfil = {
        nombre, rol, activo: true, slug: slug.toLowerCase(),
        permisos: DEFAULT_PERMS[rol], fcmTokens: [],
        creadoPor: caller.uid, creadoEl: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.doc(`usuarios/${user.uid}`).set(perfil);
      await db.doc(`directorio/${user.uid}`).set({ nombre, rol, slug: perfil.slug, activo: true });
      return res.json({ ok: true, uid: user.uid });
    }

    if (action === 'toggle') {
      const { uid, activo } = req.body;
      if (!uid) return res.status(400).json({ error: 'Falta uid' });
      const target = await db.doc(`usuarios/${uid}`).get();
      if (!target.exists) return res.status(404).json({ error: 'No existe' });
      if (target.data().rol === 'admin' && caller.rol !== 'admin')
        return res.status(403).json({ error: 'Solo un admin toca a un admin' });
      await admin.auth().updateUser(uid, { disabled: !activo });
      await db.doc(`usuarios/${uid}`).update({ activo: !!activo });
      await db.doc(`directorio/${uid}`).update({ activo: !!activo });
      if (!activo) await admin.auth().revokeRefreshTokens(uid); // mata la sesión del equipo perdido/robado
      return res.json({ ok: true });
    }

    if (action === 'delete') {
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ error: 'Falta uid' });
      if (uid === caller.uid) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
      const target = await db.doc(`usuarios/${uid}`).get();
      if (!target.exists) return res.status(404).json({ error: 'No existe' });
      if (target.data().rol === 'admin' && caller.rol !== 'admin')
        return res.status(403).json({ error: 'Solo un admin elimina a un admin' });
      // borrar el acceso PRIMERO; si falla, no dejamos huérfanos
      try { await admin.auth().deleteUser(uid); }
      catch (err) { if (err.code !== 'auth/user-not-found') throw err; }
      await db.doc(`usuarios/${uid}`).delete();
      await db.doc(`directorio/${uid}`).delete();
      return res.json({ ok: true });
    }

    if (action === 'setpin') {
      const { uid, pin } = req.body;
      if (!uid || !/^\d{4,6}$/.test(String(pin))) return res.status(400).json({ error: 'PIN inválido' });
      await admin.auth().updateUser(uid, { password: `dlind-${pin}` });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Acción desconocida' });
  } catch (e) {
    const code = e.code === 401 || e.code === 403 ? e.code : 500;
    return res.status(code).json({ error: e.msg || e.message || 'Error' });
  }
};
