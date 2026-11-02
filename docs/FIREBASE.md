# Conectar CIVIZO Cocina a Firebase (varios usuarios)

Mientras `js/config.js` esté vacío, la plataforma trabaja en **modo local**.
Al llenarlo, pide correo y contraseña, guarda todo en Firestore y todas las
cuentas ven la misma información.

## 1. Crear el proyecto (5 minutos, gratis)

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. **Agregar proyecto** → nombre `civizo-cocina` → puedes desactivar Google
   Analytics → **Crear proyecto**.

## 2. Activar el acceso con correo

1. Menú izquierdo → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Método de acceso** → **Correo electrónico/contraseña** →
   activar el primer interruptor → **Guardar**.

## 3. Crear la base de datos

1. **Compilación → Firestore Database** → **Crear base de datos**.
2. Ubicación: `nam5 (United States)` o la más cercana → **Siguiente**.
3. Elige **Iniciar en modo de producción** → **Crear**.
4. Pestaña **Reglas** → borra lo que hay, pega el contenido completo de
   [`config/firestore.rules`](../config/firestore.rules) → **Publicar**.

## 4. Copiar los datos de conexión

1. Engrane ⚙ junto a *Descripción general* → **Configuración del proyecto**.
2. En **Tus apps** toca el ícono **`</>`** (Web) → apodo `civizo` → **Registrar app**
   (no hace falta Firebase Hosting).
3. Copia `apiKey` y `projectId` y pégalos en `js/config.js`:

```js
window.CONFIG_NUBE = {
  apiKey: 'AIza…',
  projectId: 'civizo-cocina'
};
```

Estos datos no son secretos: sin una cuenta aprobada nadie entra. La
seguridad está en las reglas del paso 3.

## 5. Primer acceso

1. Abre la plataforma → **Crear cuenta**. **La primera cuenta del proyecto
   queda como Dueño** con todos los permisos.
2. Si ese navegador ya tenía información en modo local, te ofrece subirla.
   También está en **Ajustes → Subir lo capturado en este equipo**.
3. Comparte la dirección con tu equipo. Quien cree su cuenta queda **por
   aprobar** en **Usuarios**, o agrégalas tú con **Agregar cuenta**.

## Roles

| Rol | Puede |
| --- | --- |
| Dueño | Todo. Solo hay uno: la primera cuenta. |
| Administrador | Todo, incluidas cuentas y ajustes (no toca al dueño). |
| Editor | Captura y modifica insumos, recetas, servicios y eventos. |
| Consulta | Solo ve, escala recetas e imprime. |

## Cómo se sincroniza

- Cada cambio se sube solo en menos de un segundo (abajo del menú dice
  *Guardado en la nube*). Sin internet, reintenta solo.
- Lo que otros cambian llega cada minuto y al volver a la pestaña. Lo que
  estás escribiendo en ese momento no se pisa.
- Consumo aproximado: unas 5 lecturas por minuto por pantalla abierta, muy
  por debajo del plan gratuito (50,000 lecturas diarias).

## Sitio web y solicitudes

Las reglas incluyen lo que necesita el sitio público:

- `sitio/publico` y `sitio_fotos/*`: cualquiera los lee; solo administradores publican.
- `solicitudes/*`: un visitante sin cuenta **solo puede crear** una solicitud nueva con
  campos y tamaños limitados. Leerlas y darles seguimiento es del equipo.

Cada vez que cambie `config/firestore.rules` hay que volver a publicarlas en la consola
(Firestore Database → Reglas → pegar → Publicar).

## Publicación automática de reglas

`.github/workflows/reglas-firestore.yml` publica `config/firestore.rules` en el proyecto
`civizo` cada vez que cambian en `main`. Configuración de una sola vez:

1. Consola de Firebase → ⚙ **Configuración del proyecto** → pestaña **Cuentas de servicio**
   → **Generar nueva clave privada** → **Generar clave**. Se descarga un archivo `.json`.
2. GitHub → repositorio **C-V** → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: pega **todo** el contenido del archivo `.json`.
   - **Add secret**.
3. Borra el archivo `.json` de tu equipo. GitHub lo guarda cifrado y no lo vuelve a mostrar.

Para probarlo sin cambiar las reglas: pestaña **Actions** → **Publicar reglas de Firestore**
→ **Run workflow**.

Esa clave tiene permisos amplios sobre el proyecto. Para limitarla, en Google Cloud →
IAM se puede crear otra cuenta de servicio solo con el rol **Firebase Rules Admin** y usar
su clave en el mismo secreto.
