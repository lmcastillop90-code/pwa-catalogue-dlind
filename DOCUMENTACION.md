# DLIND — Catálogo Digital + Gestión de Inventario

Documentación técnica completa del proyecto. Última actualización: agosto 2026.

---

## 1. ¿Qué es este proyecto?

Aplicación web progresiva (PWA) para **DLIND, C.A.** (Barquisimeto, Venezuela — venta de cauchos, lubricantes y repuestos para transporte pesado) compuesta por dos módulos en una sola app:

- **Catálogo digital** (`index.html`) — herramienta de venta presencial del vendedor: productos con fotos, visor 360°, zoom, video de rendimiento, búsqueda y filtros. Funciona 100 % sin internet una vez instalada.
- **Módulo de Gestión** (`gestion.html`) — inventario protegido con PIN: stock en tiempo real, usuarios con roles y permisos, historial de movimientos y notificaciones push.

Se instala como app en Android y iPhone **sin pasar por las tiendas** (Play Store/App Store), directamente desde el navegador.

---

## 2. Stack y servicios

| Pieza | Servicio | Costo |
|---|---|---|
| Hosting + funciones serverless | **Vercel** (plan Hobby) | $0 |
| Base de datos en tiempo real | **Firebase Firestore** (plan Spark) | $0 |
| Autenticación (login PIN) | **Firebase Authentication** | $0 |
| Notificaciones push | **Firebase Cloud Messaging (FCM)** | $0 (sin límite) |
| Código fuente | **GitHub** | $0 |

- Proyecto Firebase: `dlind-catalogo` · Región Firestore: `southamerica-east1` (São Paulo)
- Catálogo real: 20 productos (12 cauchos Double Coin/Powertrac, 5 lubricantes Drydene, 3 bandas de freno). Los datos y specs provienen de las fichas técnicas oficiales del cliente. El código de producto (ej. DC-RR99-12225) enlaza catálogo ↔ stock en Firestore.
- URL producción: `https://pwa-catalogue-dlind-nine.vercel.app`
- Cuentas creadas con el correo del proyecto (Gmail dedicado con 2FA). Vercel conectado al repo de GitHub: cada `git push` a `main` publica automáticamente.
- Único costo futuro opcional: dominio propio (~$12/año).

---

## 3. Estructura del repositorio

```
├── index.html            Catálogo completo (HTML+CSS+JS en un archivo).
│                         Productos con fotos en /img/ (WebP optimizadas).
│                         Lee stock vivo de Firestore por código de producto.
├── img/                  47 imágenes WebP de productos (900px, recortadas al borde,
│                         ~45KB c/u) + poster del video. Precacheadas por el SW.
├── gestion.html          Módulo de gestión (login PIN, stock, usuarios, historial).
├── sw.js                 Service worker: precache offline + notificaciones push.
│                         ⚠ Al cambiar archivos precacheados, subir la versión CACHE (v3→v4…)
├── manifest.webmanifest  Identidad de la PWA (nombre, íconos, colores).
├── icons/                Íconos de la app (192, 512, maskable).
├── videos/               Videos de producto (precacheados para offline).
├── api/
│   ├── _admin.js         Init del Firebase Admin SDK + verificación de permisos.
│   ├── users.js          Crear / activar-desactivar / eliminar / cambiar PIN de usuarios.
│   └── notify.js         Envío de notificaciones push vía FCM.
├── firestore.rules       Reglas de seguridad (copia de referencia; las activas
│                         se pegan en la consola de Firebase → Firestore → Reglas).
├── package.json          Dependencia firebase-admin para las funciones de Vercel.
├── SETUP.md              Pasos de activación inicial (reglas, primer admin).
└── DOCUMENTACION.md      Este archivo.
```

**Nota de flujo de trabajo:** `index.html` y `gestion.html` se generan a partir de plantillas en la sesión de desarrollo (Claude/Cowork) donde se mantienen los fuentes con marcadores de imágenes. Para cambios, editar allí y regenerar — o editar el HTML directo si es un cambio menor.

---

## 4. Modelo de datos (Firestore)

```
usuarios/{uid}            Perfil de cada usuario del módulo de gestión
  nombre, rol             rol: "admin" | "gerente" | "vendedor"
  slug                    identificador de login (interno: <slug>@dlind.local)
  activo (bool)
  permisos {              el rol da los valores por defecto; se pueden
    ver_stock             sobreescribir por usuario individual
    editar_stock
    gestionar_usuarios
    ver_historial }
  fcmTokens []            tokens de notificaciones de sus equipos

directorio/{uid}          Lista PÚBLICA de nombres para la pantalla de login
  nombre, rol, slug, activo

stock/{codigo}            Una entrada por producto (código = enlace con el catálogo)
  cat, brand, name, sub, img
  cantidad                se modifica con INCREMENTOS atómicos (nunca sobrescritura,
                          salvo conteo exacto) → dos personas offline no se pisan
  stockMinimo             umbral de "¡Últimas X!" (editable por producto)
  actualizadoEl, actualizadoPor, sedeId ("principal")

movimientos/{id}          Historial INMUTABLE (solo se crea; nadie edita ni borra)
  codigo, producto, tipo  tipo: "ajuste" | "conteo" | (futuro: "entrada", "venta")
  delta, cantidadResultante
  usuario, uid, sedeId, fecha, nota?
```

**El estado del producto no se guarda — se calcula:** cantidad 0 → *Agotado* · cantidad ≤ stockMinimo → *¡Últimas X!* · resto → *Disponible*. Así el badge nunca se desincroniza del número.

**Las fichas del catálogo** (fotos, precios, specs, videos) viven en el código de `index.html`, no en la base — eso mantiene el catálogo 100 % offline. El campo `code` de cada producto del catálogo lo enlaza con su documento en `stock/`.

---

## 5. Seguridad

- **La autorización real vive en el servidor**, no en la interfaz: las `firestore.rules` verifican en cada operación que el usuario esté autenticado, activo y con el permiso necesario. Los botones deshabilitados en la UI son solo cortesía visual.
- **Login por PIN:** internamente cada usuario es una cuenta de Firebase Auth con correo `<slug>@dlind.local` y contraseña `dlind-<PIN>`. Nadie usa ese correo; es el mecanismo.
- **Historial inmutable:** las reglas prohíben editar/borrar movimientos, a cualquiera.
- **Validación en servidor:** el stock no puede ser negativo; tipos verificados.
- **Dispositivo perdido/robado:** desactivar al usuario (🚫 en Usuarios) revoca sus tokens de sesión → al siguiente contacto con internet queda fuera, y sus escrituras offline pendientes son rechazadas por las reglas.
- **Auto-bloqueo:** la sesión de Gestión se cierra tras 20 min de inactividad.
- **Secretos:** la única credencial sensible es la clave privada del Admin SDK, guardada como variable de entorno `FIREBASE_SERVICE_ACCOUNT` en Vercel (nunca en el repo). El bloque `firebaseConfig` del cliente es público por diseño.
- Eliminación de usuarios: **física** (borra Auth + documentos) vía `api/users.js`; los movimientos históricos conservan el nombre.

---

## 6. Funcionalidades

### Catálogo (`index.html`)
- Inicio = menú de categorías (Cauchos / Lubricantes / Repuestos) con contadores
- Búsqueda en tiempo real, filtros por marca, orden de productos
- Ficha de producto: specs técnicas, variantes de medida, galería
- **Visor 360°**: arrastrar para rotar (producto DOUBLE COIN RR99)
- **Zoom pantalla completa**: pellizco, doble toque, botones +/−
- **Video de rendimiento** con botón "▶ Ver rendimiento real" (offline incluido)
- **Stock en vivo**: badges Disponible / ¡Últimas X! / Agotado leídos de Firestore
  (lectura pública REST + caché en localStorage para offline)
- Botón "Instalar app" (prompt nativo en Android/Chrome; instrucciones en iOS)
- Botón "Gestión" 🔒 en la barra inferior → `gestion.html`

### Gestión (`gestion.html`)
- **Login**: selector de usuario (colección `directorio`) + teclado PIN numérico;
  sesión persistente por equipo; botón "← Volver al catálogo"
- **Stock**: menú por categorías con alertas automáticas (⚠ por agotarse / agotados
  / ✓ stock sano) y fotos; lista con barra visual de nivel (marca del mínimo),
  stepper +/− con debounce (agrupa toques en un solo incremento), modal de conteo
  exacto + stock mínimo, **Deshacer** post-ajuste, búsqueda, ordenamiento (orden
  congelado mientras se trabaja — sin saltos), tarjetas de resumen que filtran
  con toggle, botón "📣 Avisar al equipo" (push manual a todos)
- **Usuarios** (solo admin/gerente con permiso): crear (validado, sin duplicados),
  cambiar PIN 🔑, desactivar/reactivar 🚫/✅, eliminar definitivo 🗑, permisos
  individuales con interruptores (rol = plantilla, ajustable por persona)
- **Historial**: movimientos en tiempo real agrupados por día, filtros por
  fecha (Hoy/Ayer/7 días) y por usuario
- **Offline**: persistencia local de Firestore — se consulta y ajusta sin internet;
  la cola se sincroniza sola al reconectar (indicador de estado en pantalla)

### Notificaciones push (FCM)
| Evento | Quién la recibe |
|---|---|
| Producto cruza a "por agotarse" o "agotado" | Admin + gerentes (menos quien hizo el cambio) |
| Producto vuelve a stock sano (llegó mercancía) | Todo el equipo |
| Aviso manual "📣 Avisar al equipo" | Todo el equipo |

- Solo se notifica al **cruzar** de estado (anti-spam).
- Activación: aviso "🔔 Activar" tras el login (iOS exige que sea con un toque).
- iPhone: requiere iOS 16.4+ y la app instalada en pantalla de inicio.
- Flujo técnico: la app llama a `/api/notify` (Vercel) con el token de sesión →
  la función verifica permisos → envía vía FCM a los tokens según rol → limpia
  tokens muertos.

---

## 7. Operación diaria

**Actualizar productos del catálogo** (fotos, precios, specs): se editan en
`index.html` (o en las plantillas fuente) → commit → push → Vercel publica.
Las apps instaladas se actualizan solas al abrirse con internet (a veces
necesitan cerrarse/abrirse dos veces por el service worker).

**Agregar un producto al stock:** crear su documento en `stock/{codigo}` (mismo
código que el catálogo). Hoy: manual o vía botón semilla; con la carga del
catálogo real se crean todos de una vez.

**Alta/baja de usuarios:** todo desde la pestaña Usuarios de la app (no hace
falta tocar Firebase, salvo el primer admin — ver SETUP.md).

**Cambiar reglas de seguridad:** editar `firestore.rules` en el repo (referencia)
y pegar en Firebase → Firestore → Reglas → Publicar.

**Ver uso/límites gratis:** consola de Firebase → engranaje → Uso y facturación.
A la escala de DLIND se usa <10 % del plan gratuito.

---

## 8. Solución de problemas frecuentes

| Síntoma | Causa probable / solución |
|---|---|
| "No hay usuarios" en el login | La colección `directorio` está vacía o las reglas no están publicadas |
| PIN correcto no entra | El usuario está desactivado, o el doc `usuarios/{uid}` no existe o su UID no coincide con Authentication |
| No llegan notificaciones | El receptor no tocó "🔔 Activar"; o es el mismo usuario que hizo el cambio (por diseño no se auto-notifica); o falta `FIREBASE_SERVICE_ACCOUNT` en Vercel |
| Cambios de código no se ven en la app instalada | Caché del service worker: cerrar y abrir la app 2 veces; si persiste, subir versión de CACHE en `sw.js` |
| "Instalar app" no aparece | Ya está instalada (revisar chrome://apps), o primera visita (recargar), o usar menú ⋮ → "Guardar y compartir" → "Instalar página como app" |
| Error al crear usuario | Slug repetido (correo interno ya existe) o falta la variable de entorno en Vercel |

---


## 8b. Notificaciones: condiciones para que lleguen (troubleshooting)

Para que una notificación llegue a un equipo deben cumplirse TODAS estas condiciones:

**Del usuario (quién):**
1. Ser destinatario según su rol: ⚠ Por agotarse → solo admin y gerentes · 🔴 Agotado, 📦 Llegó mercancía y 📣 Avisos manuales → todos los roles.
2. NO ser el autor del cambio (el sistema nunca notifica al que hizo la acción, en ninguno de sus equipos).
3. Estar activo (no desactivado por el admin).

**Del equipo (dónde):**
4. Haber entrado a Gestión al menos una vez EN ESE equipo con ESE usuario y aceptado el permiso ("🔔 Activar"). La suscripción es por usuario+equipo: activar en el teléfono no cubre la laptop.
5. Permiso de Chrome vigente (candado junto a la URL → Notificaciones → Permitir).
6. Windows sin "Asistente de concentración"/No molestar activo (silencia Chrome sin avisar — sospechoso #1 en desktop).
7. Internet en el momento (o llegan al reconectar).

**Cómo se muestran:**
- App de Gestión abierta y visible → banner interno (estilo WhatsApp Web).
- Pestaña en segundo plano/minimizada/navegador cerrado → notificación del sistema. Con el navegador cerrado del todo, Chrome debe tener permitido ejecutarse en segundo plano (viene activado por defecto).

**Detalle técnico importante (bug resuelto):** el service worker usa `tag` por tipo de evento con `renotify:true` (sw v5). Sin renotify, la segunda notificación del mismo tipo REEMPLAZA a la anterior en silencio (sin sonar) — parecía que "solo llegaba una". No quitar el renotify.

**Prueba canónica de un equipo:** login → confirmar "🔔 activadas" → pestaña visible → otro usuario manda 📣 → debe bajar el banner. Minimizar → otro 📣 → debe sonar la notificación del sistema. Si pasa ambas, el equipo está operativo.

## 9. Evolutivos previstos (no implementados)

- Carga masiva desde Excel/macro del cliente (actualización de precios y stock en un paso)
- Módulo de ventas (vendedor registra "vendí X" con descuento automático + reportes)
- Módulo vendedor: cotizador con envío por WhatsApp, compartir ficha, conversor Bs/USD
- Multi-sede (el modelo de datos ya lo contempla vía `sedeId`)
- Geolocalización de visitas/prospectos
- Panel admin de productos (fichas del catálogo editables sin tocar código)
