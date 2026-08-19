# Mi bóveda

Mi bóveda es un gestor personal de contraseñas instalable como PWA. Funciona sin backend: la interfaz, las claves criptográficas y las entradas permanecen en el navegador del dispositivo. El nombre de cada servicio se muestra en Home; el usuario y la contraseña sólo se descifran después de una verificación WebAuthn válida.

## Stack

- Vue 3, TypeScript, Vite, Vue Router y Pinia.
- Dexie sobre IndexedDB para persistencia local.
- Web Crypto API para cifrado híbrido y backups.
- WebAuthn con verificación de usuario requerida como control de acceso.
- `vite-plugin-pwa` y Workbox para instalación, precache y uso offline.
- Vitest y `fake-indexeddb` para probar criptografía, migraciones, backups y repositorio.
- Wrangler para publicar los archivos estáticos en Cloudflare Workers.

## Arquitectura

La aplicación mantiene una estructura deliberadamente pequeña:

```text
View → Store/servicio → Dexie → IndexedDB
                     ↘ Web Crypto

Detalle/backup → WebAuthn → acceso de la aplicación → descifrado
```

Las vistas resuelven navegación y presentación. El store conserva únicamente el estado compartido necesario. Los servicios de base de datos, criptografía, WebAuthn y backup concentran la lógica crítica, sin backend ni capa de repositorios genérica.

## Persistencia y cifrado local

Dexie administra una base IndexedDB con las entradas y el par de claves de la bóveda. El nombre del servicio queda visible para poder construir Home sin desbloquear datos sensibles. Usuario y contraseña nunca se guardan directamente en los registros actuales.

Cada entrada usa una clave AES-256-GCM aleatoria y un IV nuevo. El contenido `{ username, password }` se cifra con AES-GCM y esa clave AES se envuelve con RSA-OAEP SHA-256. IndexedDB almacena el nombre, versión criptográfica, texto cifrado, IV y clave envuelta.

La clave privada RSA local se guarda como `CryptoKey` no extraíble. La clave pública permite crear entradas sin autenticación. Las entradas heredadas en texto plano se migran al formato cifrado conservando su identificador y contenido; también se mantiene una ruta de migración para bóvedas antiguas protegidas con WebAuthn PRF.

## WebAuthn

Al abrir una entrada o entrar directamente a editar, la aplicación solicita WebAuthn con `userVerification: "required"`. Sólo después de una verificación correcta utiliza la clave privada para descifrar. Cancelar o fallar la verificación no revela usuario ni contraseña. Exportar también exige este control.

WebAuthn se usa como barrera de acceso de la aplicación, no como origen criptográfico de la clave. La implementación actual no depende de PRF. Esto mejora compatibilidad, pero significa que una ejecución de código malicioso en el mismo origen podría intentar usar la clave no extraíble mediante Web Crypto sin pasar por la UI de WebAuthn. Por eso siguen siendo importantes HTTPS, evitar scripts de terceros y proteger la cadena de despliegue.

## Backups cifrados

Settings permite exportar un JSON versionado después de verificar WebAuthn. El payload contiene las entradas necesarias para restaurar, pero se cifra completo con AES-256-GCM. La clave del backup se deriva de una contraseña independiente mediante PBKDF2 SHA-256, un salt aleatorio y 600.000 iteraciones. No se exporta la clave privada local ni aparecen credenciales en texto plano en el archivo.

Al importar, el archivo se valida y descifra antes de modificar IndexedDB. Las entradas nuevas se vuelven a cifrar con la clave pública del dispositivo de destino. Se conservan los registros existentes y se omiten coincidencias exactas de nombre, usuario y contraseña. Una contraseña o archivo inválidos no modifican la bóveda.

La contraseña del backup no se recupera ni se almacena. Perderla vuelve inutilizable ese archivo.

## PWA y funcionamiento offline

El manifest configura una aplicación standalone, orientación vertical e iconos normales, maskable y Apple Touch Icon. Workbox precarga la interfaz y los assets generados; IndexedDB continúa disponible offline. Vue Router usa fallback a `index.html` tanto en el service worker como en Cloudflare para soportar recargas de rutas internas.

Las actualizaciones no se aplican de forma automática mientras se usa la bóveda: la UI avisa cuando hay una nueva versión y permite aplicarla explícitamente. El indicador offline es informativo y no bloquea los datos locales.

## Desarrollo local

Requisitos: Node.js moderno con npm y un navegador compatible con Web Crypto, IndexedDB y WebAuthn de plataforma. WebAuthn requiere un contexto seguro; `localhost` se admite para desarrollo y producción debe servirse mediante HTTPS.

```bash
npm install
npm run dev
```

Comandos disponibles:

```bash
npm run typecheck     # comprueba TypeScript y componentes Vue
npm run format:check  # verifica formato con Prettier
npm test              # ejecuta todos los tests
npm run build         # typecheck y build de producción en dist/
npm run preview       # sirve localmente el build generado
```

## Instalación

1. Abrir la URL HTTPS publicada.
2. En Android/Chrome, usar **Instalar aplicación** o **Agregar a pantalla principal**.
3. En iOS/Safari, usar **Compartir → Agregar a inicio**.
4. Registrar la credencial WebAuthn la primera vez que se desbloquea la bóveda.

La disponibilidad y presentación del diálogo biométrico dependen del navegador, sistema operativo y configuración de bloqueo del dispositivo.

## Build y deploy en Cloudflare Workers

Wrangler publica `dist/` como assets estáticos y aplica fallback SPA. No hay Worker de aplicación, bindings, base remota ni secretos necesarios.

```bash
npm run build
npx wrangler deploy
```

Para validar la configuración sin publicar:

```bash
npx wrangler deploy --dry-run
```

En Cloudflare pueden usarse directamente:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

## Limitaciones y decisiones de seguridad

- No hay backend, sincronización, cuenta de usuario ni recuperación remota.
- IndexedDB pertenece al origen. Cambiar de dominio o navegador requiere exportar e importar un backup.
- Borrar los datos del sitio, desinstalar con eliminación de datos o la expulsión de almacenamiento del navegador puede eliminar la bóveda. Mantener backups externos actualizados es responsabilidad del usuario.
- Perder la credencial WebAuthn puede impedir abrir o exportar la bóveda existente. Un backup cifrado probado es el mecanismo de recuperación entre dispositivos.
- La clave privada es no extraíble, pero WebAuthn no está ligado criptográficamente a cada operación de descifrado. La app no pretende resistir una vulnerabilidad XSS o una distribución comprometida del mismo origen.
- Las credenciales se descifran temporalmente en memoria para mostrarlas, copiarlas o construir un backup; no se registran en consola ni se envían a servidores.
- El portapapeles queda bajo control del sistema operativo después de copiar una contraseña.
- El modo privado y algunas políticas de iOS/Android pueden reducir la persistencia. Instalación, WebAuthn, almacenamiento y actualización deben validarse en dispositivos reales.

## Estado del proyecto

Versión estable actual: **1.0.0**. La lógica crítica cuenta con tests de cifrado, alteración de ciphertext, migración desde texto plano, CRUD cifrado, deduplicación concurrente y exportación/importación de backups.
