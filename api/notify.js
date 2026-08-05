// Envío de notificaciones push (FCM).
// - stock_alert: avisa a admin+gerentes que un producto llegó al mínimo o se agotó
// - broadcast:   aviso general a todo el equipo (ej. "catálogo actualizado")
const { admin, requireUser } = require('./_admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const caller = await requireUser(req, ['editar_stock']);
    const { type, title, body } = req.body || {};
    if (!type || !title) return res.status(400).json({ error: 'Faltan type/title' });

    const db = admin.firestore();
    // stock_alert (por agotarse) → solo admin y gerentes
    // stock_out (agotado), restock y broadcast → todo el equipo (los vendedores
    // deben enterarse al instante de qué no pueden ofrecer y qué volvió a llegar)
    const roles = type === 'stock_alert' ? ['admin', 'gerente'] : ['admin', 'gerente', 'vendedor'];
    const snap = await db.collection('usuarios')
      .where('activo', '==', true).where('rol', 'in', roles).get();

    const tokens = [];
    snap.forEach(d => {
      const u = d.data();
      if (d.id !== caller.uid && Array.isArray(u.fcmTokens)) tokens.push(...u.fcmTokens);
    });
    if (!tokens.length) return res.json({ ok: true, sent: 0 });

    const resp = await admin.messaging().sendEachForMulticast({
      tokens: [...new Set(tokens)].slice(0, 500),
      webpush: {
        notification: {
          title, body: body || '',
          icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
          tag: type, renotify: true,
        },
        fcmOptions: { link: (type === 'stock_alert') ? '/gestion.html' : '/' },
      },
    });

    // limpieza de tokens muertos
    const dead = [];
    resp.responses.forEach((r, i) => { if (!r.success) dead.push(tokens[i]); });
    if (dead.length) {
      const batch = db.batch();
      snap.forEach(d => batch.update(d.ref, {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead)
      }));
      await batch.commit().catch(() => {});
    }
    return res.json({ ok: true, sent: resp.successCount });
  } catch (e) {
    const code = e.code === 401 || e.code === 403 ? e.code : 500;
    return res.status(code).json({ error: e.msg || e.message || 'Error' });
  }
};
