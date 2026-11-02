# CIVIZO Cocina

Plataforma de **CIVIZO · Servicios Alimentarios** para costear servicios de
alimentos y eventos, armar el catálogo de servicios gastronómicos y
estandarizar recetas que se pueden producir para 1 o para 1,000 porciones.

Es una página estática, sin servidor, en el mismo estilo que Forguard y
Profectus: se abre `index.html` y funciona. Todo está en español y con la
marca CIVIZO (Montserrat / Poppins, carbón y naranja).

## Módulos

| Módulo | Para qué sirve |
| --- | --- |
| **Tablero** | Cotizado en curso, eventos aprobados, próximos eventos, pendientes (insumos sin precio, recetas con food cost alto o con errores) y escalado rápido de cualquier receta. |
| **Insumos** | Catálogo de compras: presentación (1 kg, 20 L, paquete de 50 pza), precio, **rendimiento / merma** y proveedor. Calcula el costo neto aprovechable. Importa y exporta CSV para actualizar precios en bloque. |
| **Recetas** | Recetas estandarizadas con código `REC-001`, porciones base, tamaño de porción, ingredientes en cantidades netas, procedimiento paso a paso, alérgenos y puntos críticos. Una receta con rendimiento (ej. *1 L de salsa verde*) se puede usar como **sub-receta** dentro de otras. Muestra costo por porción, precio sugerido por food cost y food cost real. |
| **Escalador** | En cada receta: ¿cuánto necesitas producir? En porciones (1, 10, 100, 1,000…) o en volumen/peso (ej. 20 L). Da cantidades netas, lo que hay que surtir con merma, costo de producción, **orden de producción** imprimible y **lista de compras**. |
| **Servicios** | El catálogo de lo que vendes, organizado por las 5 líneas de servicio de la marca (Alimentación Empresarial, Catering y Eventos, Producción de Alimentos, Operación de Cocinas, Proyectos y Consultoría). Cada servicio se arma con recetas (porciones por persona) e insumos directos (desechables, pan) y se costea por persona con su margen. Simulador para N personas. |
| **Eventos** | Cotización completa con folio `CVZ-DDMMAA-NN`: menú (servicios o recetas), personal por horas, logística, indirectos, margen, descuento e IVA. Muestra **costo interno vs. cotización cliente**, utilidad, food cost y precio por persona. Genera cotización para el cliente, hoja de costo interno y **producción y compras** del evento completo (explosión de todas las recetas y sub-recetas). |
| **Ajustes** | Datos de la empresa para los documentos, IVA / margen / food cost / indirectos por omisión, modo claro u oscuro, respaldo y restauración JSON. |

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

En el navegador del equipo donde se captura (`localStorage`). En **Ajustes →
Descargar respaldo** se baja todo en un JSON, y **Restaurar respaldo** lo
carga en otra computadora. Al abrirla por primera vez trae datos de
ejemplo (31 insumos, 8 recetas, 3 servicios y un evento) marcados como
ejemplo; se borran con un botón y lo tuyo se queda.

## Estructura

```
index.html          Página
css/civizo.css      Estilos con la paleta de marca (claro / oscuro / impresión)
js/costeo.js        Motor de costeo, escalado y explosión de insumos
js/datos.js         Almacenamiento, folios y datos de ejemplo
js/app.js           Interfaz, documentos imprimibles y CSV
assets/marca/       Logotipos, isotipos y guía de marca CIVIZO
tests/              Pruebas del motor (Node, sin dependencias)
```

## Publicar

Igual que las otras plataformas: GitHub Pages (Settings → Pages → rama) o
Firebase Hosting (`firebase deploy --only hosting`). No requiere compilación.

## Siguientes pasos sugeridos

- Modo servidor con Firebase (cuentas, varios usuarios viendo lo mismo), como
  en Forguard / Profectus.
- Historial de precios por insumo y comparativo entre proveedores.
- Fotos de montaje en la ficha técnica.
- Tabla nutrimental por receta.
