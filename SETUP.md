# DLIND Catálogo + Gestión — Pasos de activación

## 1. Publicar el código
Copia todo el contenido de este paquete al repo (reemplaza lo existente) y:
```
git add .
git commit -m "Módulo de gestión: stock, usuarios, historial y notificaciones"
git push origin main
```
Vercel despliega solo. La primera vez tardará un poco más (instala firebase-admin para las funciones).

## 2. Pegar las reglas de seguridad en Firebase
1. console.firebase.google.com → proyecto dlind-catalogo
2. Firestore Database → pestaña **Reglas**
3. Borra lo que hay, pega el contenido completo del archivo `firestore.rules` → **Publicar**

## 3. Crear el usuario administrador (una sola vez, manual)
1. Authentication → pestaña Users → **Agregar usuario**
   - Correo: `admin@dlind.local`
   - Contraseña: `dlind-2468`  ← (2468 será tu PIN; usa otro si prefieres, formato dlind-XXXX)
2. Copia el **UID** que aparece en la fila del usuario creado.
3. Firestore Database → **Iniciar colección** → ID: `usuarios`
   - ID del documento: (pega el UID)
   - Campos:
     - nombre (string): Luis
     - rol (string): admin
     - slug (string): admin
     - activo (boolean): true
     - permisos (map): ver_stock: true, editar_stock: true, gestionar_usuarios: true, ver_historial: true  (todos boolean)
     - fcmTokens (array): (vacío)
4. **Iniciar colección** → ID: `directorio`
   - ID del documento: (el mismo UID)
   - Campos: nombre (string): Luis · rol (string): admin · slug (string): admin · activo (boolean): true

## 4. Primer arranque
1. Abre https://TU-URL.vercel.app/gestion.html
2. Selecciona "Luis (Admin)" → PIN 2468 → entras
3. En Stock aparecerá "Cargar productos iniciales" → tócalo (carga los 6 de ejemplo;
   cuando esté la data real del cliente se reemplazan)
4. Pestaña Usuarios → "+ Agregar usuario" → crea al gerente y al vendedor de prueba
5. Acepta el permiso de notificaciones cuando el navegador lo pida

## 5. Prueba de fuego del módulo
- Con dos dispositivos logueados, ajusta stock en uno → se actualiza en el otro en segundos
- Baja un producto a su mínimo → al admin/gerente del OTRO equipo le llega la notificación push
- Modo avión → el stock se sigue viendo; ajusta algo → al volver el internet se sincroniza
- Desactiva un usuario (🚫) → en su equipo, al siguiente uso queda afuera

## Notas
- El PIN de cada usuario es su clave: internamente es la contraseña `dlind-<PIN>` del correo `<slug>@dlind.local`. Nadie usa ese correo, es solo el mecanismo interno.
- El archivo firestore.rules del repo es la copia de referencia; las reglas activas son las pegadas en la consola.
- Cambio de PIN: botón 🔑 en la pestaña Usuarios.
