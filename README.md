# CIVIZO Cocina

Plataforma de **CIVIZO · Servicios Alimentarios** para costear servicios de
alimentos y eventos, armar el catálogo de servicios gastronómicos y
estandarizar recetas que se pueden producir para 1 o para 1,000 porciones.

Es una página estática, sin servidor, en el mismo estilo que Forguard y
Profectus: se abre `index.html` y funciona. Todo está en español y con la
marca CIVIZO (Montserrat / Poppins, carbón y naranja).

## Una sola plataforma: sitio público + administración

| Dirección | Qué es |
| --- | --- |
| `/` (`index.html`) | **Sitio web público** de CIVIZO: portada, servicios, cómo trabajamos, nosotros, identidad, galería y formulario de cotización. |
| `/app.html` | **Plataforma** de administración (con acceso por cuenta). El sitio tiene un enlace "Acceso". |

- **Plataforma → Sitio web** (solo administradores): textos de la portada, "Nosotros",
  contacto (WhatsApp, teléfono, correo, horario), servicios visibles y **fotos** de cada
  espacio (portada, cinco líneas de servicio y galería). Las fotos se ajustan y comprimen
  solas. Sin foto, el espacio muestra una pieza de la marca en carbón y naranja.
- **Plataforma → Solicitudes**: lo que la gente envía desde el formulario del sitio llega
  aquí con aviso en el inicio. Se marca en seguimiento, se descarta o se convierte en
  **evento** con un toque (cliente, contacto, fecha y personas ya capturados).
- Los enlaces viejos (`/#receta-…`, `/#eventos`) llevan solos a `app.html`.
- Las fotos de identidad (`assets/sitio/`) son recortes del manual de marca.

## Cómo se navega

- **Inicio**: íconos de cada función, un saludo y el resumen del día. La lupa
  busca en toda la plataforma, el círculo con tu inicial abre tu cuenta y el
  botón **+** crea un evento, receta, servicio o insumo.
- Cada función se abre como **pantalla completa** encima del inicio, y dentro
  de ella cada elemento se abre como otra pantalla encima.
- **Regresar** (flecha de la barra, botón atrás del navegador o del celular, o
  Esc) quita solo la pantalla de arriba: la de abajo sigue donde se quedó,
  con su desplazamiento y lo que tenías escrito. El ícono de cuadritos lleva
  directo al inicio.
- Los formularios, listas de compras y confirmaciones también son pantallas
  completas (o una hoja corta en las confirmaciones) y se cierran igual.

## Módulos

| Módulo | Para qué sirve |
| --- | --- |
| **Inicio** | Página general tipo ERP: buscador de toda la plataforma, acciones rápidas y cada módulo con su dato clave (eventos abiertos, recetas, insumos sin precio, eventos por surtir). |
| **Tablero** | Cotizado en curso, eventos aprobados, próximos eventos, pendientes (insumos sin precio, recetas con food cost alto o con errores) y escalado rápido de cualquier receta. |
| **Insumos** | Catálogo de compras: presentación (1 kg, 20 L, paquete de 50 pza), precio, **rendimiento / merma** y proveedor. Calcula el costo neto aprovechable. Importa y exporta CSV para actualizar precios en bloque. |
| **Recetas** | Recetas estandarizadas con código `REC-001`, porciones base, tamaño de porción, ingredientes en cantidades netas, procedimiento paso a paso, alérgenos y puntos críticos. Una receta con rendimiento (ej. *1 L de salsa verde*) se puede usar como **sub-receta** dentro de otras. Muestra costo por porción, precio sugerido por food cost y food cost real. |
| **Escalador** | En cada receta: ¿cuánto necesitas producir? En porciones (1, 10, 100, 1,000…) o en volumen/peso (ej. 20 L). Da cantidades netas, lo que hay que surtir con merma, costo de producción, **orden de producción** imprimible y **lista de compras**. |
| **Servicios** | El catálogo de lo que vendes, organizado por las 5 líneas de servicio de la marca (Alimentación Empresarial, Catering y Eventos, Producción de Alimentos, Operación de Cocinas, Proyectos y Consultoría). Cada servicio se arma con recetas (porciones por persona) e insumos directos (desechables, pan) y se costea por persona con su margen. Simulador para N personas. |
| **Eventos** | Cotización completa con folio `CVZ-DDMMAA-NN`: menú (servicios o recetas), personal por horas, logística, indirectos, margen, descuento e IVA. Muestra **costo interno vs. cotización cliente**, utilidad, food cost y precio por persona. Genera cotización para el cliente, hoja de costo interno y **producción y compras** del evento completo (explosión de todas las recetas y sub-recetas). |
| **Producción y compras** | Lista de compras y preparaciones consolidadas de todos los eventos de un periodo, filtrando por estatus y eligiendo eventos. |
| **Usuarios** | Solo con Firebase: cuentas, roles (Dueño, Administrador, Editor, Consulta) y solicitudes de acceso. |
| **Ajustes** | Datos de la empresa para los documentos, IVA / margen / food cost / indirectos por omisión, modo claro u oscuro, respaldo y restauración JSON. |

## Proveedores

- **Catálogo** con tipo, contacto, teléfono, WhatsApp, correo, RFC, dirección, sitio,
  forma de pago (contado o crédito con días), pedido mínimo y días de entrega.
- **Detectados**: las tiendas que ya aparecen en tus cotizaciones se agregan con un toque.
  El vínculo con insumos y cotizaciones es por nombre; cambiar el nombre del proveedor
  actualiza esas referencias.
- En cada proveedor: lo que le cotizamos, su precio por kg / L / pza y si es el mejor
  o cuánto está por encima del más barato.
- **Comparar precios**: tabla de insumos contra proveedores con el mejor precio en verde.
  Avisa qué insumos se costean sin el mejor precio y los cambia con "Usar …".
- **Pedidos por proveedor** (en Producción y compras y en la lista de compras de cada
  evento): la lista se divide por proveedor; cada pedido sale como **orden de compra**
  imprimible, texto para copiar o mensaje de **WhatsApp** listo para enviar, con aviso
  si no llega al pedido mínimo.

## Cobranza

- Todo evento **aprobado** o **realizado** entra a Cobranza con un **plan de pagos**:
  anticipo (50 % por omisión) y saldo, que vencen 15 y 3 días antes del evento. Los
  valores por omisión se cambian en Ajustes y se pueden ajustar en cada evento.
- **Registrar pago**: monto sugerido (lo que falta del siguiente pago), fecha, método,
  referencia y nota. El saldo y el estado se recalculan solos: al corriente, por
  vencer (3 días o menos), vencido, pagado o pago de más.
- **Recibo de pago** imprimible con folio, concepto (anticipo, abono o liquidación),
  importe con letra y saldo restante; **estado de cuenta** con plan, pagos y saldo.
- Datos de la **factura** del evento (folio, fecha y UUID).
- Aviso en el inicio y en el tablero cuando hay cobros vencidos. Los pagos se guardan
  dentro del evento, así que se sincronizan con Firebase como el resto.

## Precios referenciados

- Cada insumo tiene su **pantalla propia**: precio de costeo, cotizaciones de
  varias tiendas (Walmart, Soriana, Costco, Central de Abastos…) comparadas
  por kg / L / pieza, enlace al producto e **historial** con gráfica.
- **Usar** pasa una cotización al costeo. Ningún precio externo cambia el
  costo sin que alguien lo confirme.
- **Actualizar precios** (desde Insumos) lista primero lo que no se ha revisado
  en los días de vigencia (30 por omisión, en Ajustes): escribes el precio,
  Enter guarda y pasa al siguiente; Enter vacío confirma el precio actual.
- **Importar factura**: lee el XML (CFDI 3.3 / 4.0) de cualquier proveedor,
  sugiere el insumo de cada concepto, calcula el precio con descuentos e
  impuestos y recuerda la relación para la siguiente factura.

## Cómo se calcula

- Las cantidades de las recetas son **netas** (lo que entra a la olla).
  Para comprar se usa la cantidad **bruta = neta ÷ rendimiento**.
- Costo de un insumo por g / ml / pza = precio ÷ contenido de la presentación
  ÷ rendimiento.
- Precio sugerido de receta = costo por porción ÷ food cost objetivo.
- Precio de venta de servicios y eventos = costo ÷ (1 − margen). El margen es
  **sobre la venta** (margen 70 % ⇔ food cost 30 %).
- Evento: costo interno = alimentos + personal + logística + indirectos;
  subtotal = precio con margen − descuento; total = subtotal + IVA.
- La lista de compras redondea a empaques completos y agrupa por categoría.

El motor está en `js/costeo.js` (funciones puras, sin pantalla) y tiene
pruebas: `node tests/prueba_costeo.js`.

## Dónde se guarda la información

**Con Firebase (varios usuarios):** al llenar `js/config.js` pide correo y
contraseña y guarda todo en Firestore. Pasos en [docs/FIREBASE.md](docs/FIREBASE.md).
Seguridad en [config/firestore.rules](config/firestore.rules).

**Modo local (sin configurar):**

En el navegador del equipo donde se captura (`localStorage`). En **Ajustes →
Descargar respaldo** se baja todo en un JSON, y **Restaurar respaldo** lo
carga en otra computadora. Al abrirla por primera vez trae datos de
ejemplo (31 insumos, 8 recetas, 3 servicios y un evento) marcados como
ejemplo; se borran con un botón y lo tuyo se queda.

## Estructura

```
index.html          Sitio web público
app.html            Plataforma de administración
css/sitio.css       Estilos del sitio público
js/sitio.js         Contenido publicado y formulario del sitio
assets/sitio/       Piezas de la marca para el sitio
css/civizo.css      Estilos con la paleta de marca (claro / oscuro / impresión)
js/config.js        Datos del proyecto de Firebase (vacío = modo local)
js/nube.js          Acceso, cuentas y sincronización con Firestore (REST)
js/costeo.js        Motor de costeo, escalado y explosión de insumos
js/datos.js         Almacenamiento, folios y datos de ejemplo
js/app.js           Interfaz, documentos imprimibles y CSV
assets/marca/       Logotipos, isotipos y guía de marca CIVIZO
config/             Reglas de seguridad de Firestore
docs/FIREBASE.md    Cómo crear y conectar el proyecto de Firebase
tests/              Pruebas del motor (Node, sin dependencias)
```

## Publicar

Igual que las otras plataformas: GitHub Pages (Settings → Pages → rama) o
Firebase Hosting (`firebase deploy --only hosting`). No requiere compilación.

## Siguientes pasos sugeridos

- Historial de precios por insumo y comparativo entre proveedores.
- Fotos de montaje en la ficha técnica.
- Tabla nutrimental por receta.

### GitHub Pages (paso a paso)

1. En el repositorio: **Settings → Pages**.
2. En *Build and deployment → Source* elige **Deploy from a branch**.
3. Rama **`claude/civizo-cocina`**, carpeta **`/ (root)`** → **Save**.
4. En 1–2 minutos queda en `https://victormejia-ship-it.github.io/C-V/`.

El archivo `.nojekyll` hace que GitHub sirva los archivos tal cual, sin procesarlos.
Si después se fusiona a `main`, cambia la rama en ese mismo menú.
