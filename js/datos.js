/* =========================================================================
   CIVIZO · Datos

   Guarda todo en el navegador (localStorage) — mismo "modo local" que
   Forguard y Profectus. Respaldo JSON para mover la información a otra
   computadora. Incluye un juego de datos de ejemplo para arrancar.

   Modelo
   ------
   empresa:    { nombre, lema, responsable, telefono, correo, ciudad }
   parametros: { iva, margen, foodCost, indirectos }
   insumos:    { id, nombre, categoria, unidadCompra, presentacion, precio,
                 rendimiento, proveedor, actualizado }
   recetas:    { id, codigo, nombre, categoria, porciones, porcionTexto,
                 rendimientoCantidad, rendimientoUnidad, tiempoPrep,
                 tiempoCoccion, precioVenta, foodCost, alergenos:[],
                 ingredientes:[{tipo:'insumo'|'receta', refId, cantidad,
                 unidad, nota}], procedimiento, notas, ejemplo, creado,
                 actualizado }
   servicios:  { id, nombre, linea, descripcion, minimoPersonas, margen,
                 extraPorPersona, extraConcepto,
                 componentes:[{tipo:'receta', refId, porcionesPorPersona} |
                              {tipo:'insumo', refId, cantidad, unidad}] }
   eventos:    { id, folio, nombre, cliente, contacto, telefono, fecha, hora,
                 lugar, personas, estatus, lineas:[{tipo, refId, cantidad}],
                 personal:[{puesto, cantidad, horas, tarifa}],
                 gastos:[{concepto, monto}], indirectos, margen, descuento,
                 iva, notas, condiciones }
   ========================================================================= */
(function (raiz) {
  'use strict';

  const CLAVE = 'civizo.datos.v1';

  const LINEAS = [
    { id: 'empresarial', nombre: 'Alimentación Empresarial' },
    { id: 'catering',    nombre: 'Catering y Eventos' },
    { id: 'produccion',  nombre: 'Producción de Alimentos' },
    { id: 'operacion',   nombre: 'Operación de Cocinas' },
    { id: 'consultoria', nombre: 'Proyectos y Consultoría' }
  ];
  const CATEGORIAS_INSUMO = ['Abarrotes', 'Frutas y verduras', 'Proteínas', 'Lácteos', 'Panadería', 'Bebidas', 'Especias', 'Desechables', 'Limpieza', 'Otros'];
  const CATEGORIAS_RECETA = ['Entrada', 'Sopa', 'Plato fuerte', 'Guarnición', 'Postre', 'Bebida', 'Salsa / base', 'Panadería', 'Desayuno', 'Snack'];
  const ALERGENOS = ['Gluten', 'Lácteos', 'Huevo', 'Soya', 'Cacahuate', 'Nueces', 'Pescado', 'Mariscos', 'Ajonjolí', 'Mostaza', 'Apio', 'Sulfitos'];
  const ESTATUS = [
    { id: 'borrador',  nombre: 'Borrador' },
    { id: 'enviada',   nombre: 'Enviada' },
    { id: 'aprobada',  nombre: 'Aprobada' },
    { id: 'realizado', nombre: 'Realizado' },
    { id: 'cancelada', nombre: 'Cancelada' }
  ];

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const ahora = () => new Date().toISOString();

  function vacio() {
    return {
      version: 1,
      empresa: { nombre: 'CIVIZO', lema: 'Servicios Alimentarios', responsable: '', telefono: '', correo: '', ciudad: 'Monterrey, N.L.' },
      parametros: { iva: 16, margen: 35, foodCost: 30, indirectos: 8, diasVigencia: 30, anticipoPct: 50, diasAnticipo: 15, diasSaldo: 3 },
      insumos: [], recetas: [], servicios: [], eventos: [], solicitudes: []
    };
  }

  /** Completa campos que falten (datos de versiones anteriores o importados). */
  function normalizar(d) {
    const b = vacio();
    d = d && typeof d === 'object' ? d : {};
    const out = Object.assign(b, d);
    out.empresa = Object.assign(vacio().empresa, d.empresa || {});
    out.parametros = Object.assign(vacio().parametros, d.parametros || {});
    ['insumos', 'recetas', 'servicios', 'eventos', 'solicitudes'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
    out.insumos.forEach(i => { if (!Array.isArray(i.cotizaciones)) i.cotizaciones = []; if (!Array.isArray(i.historial)) i.historial = []; });
    out.recetas.forEach(r => { r.ingredientes = r.ingredientes || []; r.alergenos = r.alergenos || []; });
    out.servicios.forEach(s => { s.componentes = s.componentes || []; });
    out.eventos.forEach(e => { e.lineas = e.lineas || []; e.personal = e.personal || []; e.gastos = e.gastos || []; e.pagos = Array.isArray(e.pagos) ? e.pagos : []; e.cobro = e.cobro && typeof e.cobro === 'object' ? e.cobro : {}; });
    return out;
  }

  function cargar() {
    try {
      const txt = raiz.localStorage && raiz.localStorage.getItem(CLAVE);
      if (txt) return { datos: normalizar(JSON.parse(txt)), nuevo: false };
    } catch (e) { /* almacenamiento bloqueado o dañado */ }
    return { datos: ejemplo(), nuevo: true };
  }

  function guardar(d) {
    try { raiz.localStorage.setItem(CLAVE, JSON.stringify(d)); return true; }
    catch (e) { return false; }
  }

  /* --------------------------------------------------------- Folios */
  function siguienteCodigoReceta(d) {
    const n = d.recetas.reduce((m, r) => { const x = parseInt(String(r.codigo || '').replace(/\D/g, ''), 10); return isFinite(x) && x > m ? x : m; }, 0);
    return 'REC-' + String(n + 1).padStart(3, '0');
  }
  /** Folio de evento CVZ-DDMMAA-NN (consecutivo por día). */
  function siguienteFolio(d, fecha) {
    const f = fecha ? new Date(fecha + 'T12:00:00') : new Date();
    const dd = String(f.getDate()).padStart(2, '0'), mm = String(f.getMonth() + 1).padStart(2, '0'), aa = String(f.getFullYear()).slice(2);
    const pref = 'CVZ-' + dd + mm + aa + '-';
    const n = d.eventos.filter(e => String(e.folio || '').startsWith(pref)).length;
    return pref + String(n + 1).padStart(2, '0');
  }

  /* --------------------------------------------------------- Ejemplo */
  function ejemplo() {
    const d = vacio();
    const t = ahora();
    const I = {};
    const ins = (clave, nombre, categoria, precio, presentacion, unidadCompra, rendimiento, proveedor) => {
      const x = { id: 'ins-' + clave, nombre, categoria, precio, presentacion, unidadCompra, rendimiento, proveedor: proveedor || '', actualizado: t, ejemplo: true,
        cotizaciones: proveedor ? [{ id: 'q-' + clave, fuente: proveedor, precio, presentacion, unidad: unidadCompra, fecha: t, nota: 'Precio de referencia de ejemplo' }] : [],
        historial: [{ fecha: t, precio, presentacion, unidadCompra, fuente: proveedor || '' }] };
      I[clave] = x.id; d.insumos.push(x);
    };
    ins('arroz', 'Arroz grano largo', 'Abarrotes', 32, 1, 'kg', 100, 'Central de Abastos');
    ins('jitomate', 'Jitomate saladet', 'Frutas y verduras', 28, 1, 'kg', 90, 'Central de Abastos');
    ins('cebolla', 'Cebolla blanca', 'Frutas y verduras', 24, 1, 'kg', 85, 'Central de Abastos');
    ins('ajo', 'Ajo', 'Frutas y verduras', 120, 1, 'kg', 80, 'Central de Abastos');
    ins('serrano', 'Chile serrano', 'Frutas y verduras', 40, 1, 'kg', 95, 'Central de Abastos');
    ins('tomatillo', 'Tomate verde', 'Frutas y verduras', 30, 1, 'kg', 92, 'Central de Abastos');
    ins('cilantro', 'Cilantro (manojo)', 'Frutas y verduras', 10, 1, 'pza', 70, 'Central de Abastos');
    ins('lechuga', 'Lechuga romana', 'Frutas y verduras', 18, 1, 'pza', 75, 'Central de Abastos');
    ins('melon', 'Melón', 'Frutas y verduras', 25, 1, 'kg', 55, 'Central de Abastos');
    ins('papaya', 'Papaya maradol', 'Frutas y verduras', 22, 1, 'kg', 65, 'Central de Abastos');
    ins('pollo', 'Pechuga de pollo sin hueso', 'Proteínas', 135, 1, 'kg', 95, 'Carnes del Norte');
    ins('tocino', 'Tocino', 'Proteínas', 160, 1, 'kg', 100, 'Carnes del Norte');
    ins('chorizo', 'Chorizo', 'Proteínas', 110, 1, 'kg', 100, 'Carnes del Norte');
    ins('frijol', 'Frijol pinto', 'Abarrotes', 38, 1, 'kg', 100, 'Central de Abastos');
    ins('aceite', 'Aceite vegetal', 'Abarrotes', 48, 1, 'l', 100, 'Costco');
    ins('sal', 'Sal refinada', 'Especias', 12, 1, 'kg', 100, 'Costco');
    ins('consome', 'Consomé de pollo en polvo', 'Especias', 95, 1, 'kg', 100, 'Costco');
    ins('jamaica', 'Flor de jamaica', 'Abarrotes', 180, 1, 'kg', 100, 'Central de Abastos');
    ins('azucar', 'Azúcar estándar', 'Abarrotes', 30, 1, 'kg', 100, 'Costco');
    ins('agua', 'Agua purificada (garrafón)', 'Bebidas', 40, 20, 'l', 100, 'Agua Purificada');
    ins('tortilla', 'Tortilla de maíz', 'Panadería', 24, 1, 'kg', 100, 'Tortillería');
    ins('cafe', 'Café molido', 'Bebidas', 260, 1, 'kg', 100, 'Costco');
    ins('leche', 'Leche entera', 'Lácteos', 28, 1, 'l', 100, 'Costco');
    ins('parmesano', 'Queso parmesano', 'Lácteos', 420, 1, 'kg', 100, 'Costco');
    ins('crutones', 'Crutones', 'Panadería', 90, 1, 'kg', 100, 'Costco');
    ins('pan', 'Pan dulce surtido', 'Panadería', 12, 1, 'pza', 100, 'Panadería local');
    ins('postre', 'Postre individual (pay)', 'Panadería', 28, 1, 'pza', 100, 'Repostería');
    ins('plato', 'Plato compostable', 'Desechables', 180, 50, 'pza', 100, 'Desechables MTY');
    ins('vaso', 'Vaso 16 oz', 'Desechables', 95, 50, 'pza', 100, 'Desechables MTY');
    ins('servilleta', 'Servilleta', 'Desechables', 45, 500, 'pza', 100, 'Desechables MTY');
    ins('cubiertos', 'Juego de cubiertos', 'Desechables', 150, 50, 'pza', 100, 'Desechables MTY');

    const masCot = (clave, lista) => { const x = d.insumos.find(i => i.id === 'ins-' + clave); lista.forEach(([fuente, precio, presentacion, unidad], k) => x.cotizaciones.push({ id: 'q-' + clave + k, fuente, precio, presentacion, unidad, fecha: t, nota: 'Precio de referencia de ejemplo' })); };
    masCot('arroz', [['Walmart', 36.5, 1, 'kg'], ['Soriana', 34.9, 1, 'kg'], ['Costco', 189, 7, 'kg']]);
    masCot('pollo', [['Walmart', 149, 1, 'kg'], ['Costco', 699, 5, 'kg']]);
    masCot('aceite', [['Walmart', 52, 1, 'l'], ['Soriana', 129, 3, 'l']]);
    const R = {};
    let n = 0;
    const rec = (clave, o) => {
      n++;
      const x = Object.assign({
        id: 'rec-' + clave, codigo: 'REC-' + String(n).padStart(3, '0'), categoria: 'Plato fuerte', porciones: 10, porcionTexto: '',
        rendimientoCantidad: '', rendimientoUnidad: '', tiempoPrep: '', tiempoCoccion: '', precioVenta: '', foodCost: 30,
        alergenos: [], procedimiento: '', notas: '', creado: t, actualizado: t, ejemplo: true
      }, o);
      x.ingredientes = o.ingredientes.map(([tipo, k, cantidad, unidad, nota]) => ({ tipo, refId: tipo === 'receta' ? R[k] : I[k], cantidad, unidad, nota: nota || '' }));
      R[clave] = x.id; d.recetas.push(x);
    };
    rec('salsaverde', {
      nombre: 'Salsa verde cocida', categoria: 'Salsa / base', porciones: 10, porcionTexto: '100 ml', rendimientoCantidad: 1, rendimientoUnidad: 'l',
      tiempoPrep: 15, tiempoCoccion: 20,
      ingredientes: [['insumo', 'tomatillo', 800, 'g', 'sin cáscara'], ['insumo', 'serrano', 40, 'g'], ['insumo', 'cebolla', 80, 'g'], ['insumo', 'ajo', 10, 'g'], ['insumo', 'cilantro', 1, 'pza'], ['insumo', 'aceite', 30, 'ml'], ['insumo', 'sal', 10, 'g']],
      procedimiento: 'Hervir el tomate verde, el chile y el ajo 10 minutos.\nLicuar con la cebolla, el cilantro y un poco del agua de cocción.\nSofreír en el aceite caliente y cocinar 10 minutos.\nAjustar de sal. Enfriar a 4 °C si no se usa de inmediato.'
    });
    rec('pollosv', {
      nombre: 'Pollo en salsa verde', porciones: 10, porcionTexto: '180 g de pollo + 100 ml de salsa', tiempoPrep: 20, tiempoCoccion: 30, precioVenta: 95,
      ingredientes: [['insumo', 'pollo', 1.8, 'kg', 'en cubos de 3 cm'], ['receta', 'salsaverde', 1, 'l'], ['insumo', 'aceite', 30, 'ml'], ['insumo', 'consome', 15, 'g'], ['insumo', 'sal', 8, 'g']],
      procedimiento: 'Sellar el pollo en el aceite caliente por tandas.\nAgregar la salsa verde y el consomé.\nCocinar a fuego bajo 20 minutos, hasta 74 °C internos.\nRectificar sazón y mantener a más de 60 °C para servicio.'
    });
    rec('arroz', {
      nombre: 'Arroz rojo', categoria: 'Guarnición', porciones: 10, porcionTexto: '120 g', tiempoPrep: 10, tiempoCoccion: 25,
      ingredientes: [['insumo', 'arroz', 500, 'g'], ['insumo', 'jitomate', 250, 'g'], ['insumo', 'cebolla', 60, 'g'], ['insumo', 'ajo', 8, 'g'], ['insumo', 'aceite', 50, 'ml'], ['insumo', 'consome', 15, 'g'], ['insumo', 'sal', 5, 'g']],
      procedimiento: 'Lavar y escurrir el arroz.\nFreír el arroz en el aceite hasta que suene a arena.\nLicuar jitomate, cebolla y ajo con 1 L de agua y el consomé; colar sobre el arroz.\nTapar y cocinar a fuego bajo 20 minutos.'
    });
    rec('charros', {
      nombre: 'Frijoles charros', categoria: 'Guarnición', porciones: 10, porcionTexto: '200 ml', tiempoPrep: 20, tiempoCoccion: 90,
      alergenos: [],
      ingredientes: [['insumo', 'frijol', 500, 'g', 'remojado 8 h'], ['insumo', 'tocino', 150, 'g'], ['insumo', 'chorizo', 150, 'g'], ['insumo', 'jitomate', 200, 'g'], ['insumo', 'cebolla', 80, 'g'], ['insumo', 'serrano', 20, 'g'], ['insumo', 'cilantro', 0.5, 'pza'], ['insumo', 'sal', 10, 'g']],
      procedimiento: 'Cocer el frijol hasta suavizar (aprox. 1 h en olla de presión).\nDorar tocino y chorizo; agregar cebolla, jitomate y chile picados.\nIncorporar al frijol con su caldo y hervir 15 minutos.\nTerminar con cilantro picado.'
    });
    rec('jamaica', {
      nombre: 'Agua de jamaica', categoria: 'Bebida', porciones: 15, porcionTexto: 'vaso de 330 ml', rendimientoCantidad: 5, rendimientoUnidad: 'l', tiempoPrep: 10, tiempoCoccion: 10,
      ingredientes: [['insumo', 'jamaica', 80, 'g'], ['insumo', 'azucar', 400, 'g'], ['insumo', 'agua', 5, 'l']],
      procedimiento: 'Hervir la jamaica en 1 L de agua por 10 minutos.\nColar, completar con el agua restante y endulzar.\nServir a menos de 4 °C.'
    });
    rec('cafe', {
      nombre: 'Café americano', categoria: 'Bebida', porciones: 12, porcionTexto: 'taza de 250 ml', rendimientoCantidad: 3, rendimientoUnidad: 'l', tiempoPrep: 5, tiempoCoccion: 10,
      alergenos: ['Lácteos'],
      ingredientes: [['insumo', 'cafe', 120, 'g'], ['insumo', 'agua', 3, 'l'], ['insumo', 'azucar', 100, 'g', 'servido aparte'], ['insumo', 'leche', 500, 'ml', 'servida aparte']],
      procedimiento: 'Preparar en cafetera de goteo: 40 g de café por litro de agua.\nMantener en termo a 75–85 °C. Renovar cada 90 minutos.'
    });
    rec('fruta', {
      nombre: 'Fruta picada', categoria: 'Snack', porciones: 10, porcionTexto: '150 g', tiempoPrep: 20,
      ingredientes: [['insumo', 'melon', 750, 'g', 'neto, sin cáscara'], ['insumo', 'papaya', 750, 'g', 'neto, sin cáscara']],
      procedimiento: 'Lavar y desinfectar la fruta.\nPelar, quitar semillas y cortar en cubos de 2 cm.\nMantener refrigerada y tapada hasta el servicio.'
    });
    rec('cesar', {
      nombre: 'Ensalada César', categoria: 'Entrada', porciones: 10, porcionTexto: '90 g', tiempoPrep: 20, precioVenta: 65,
      alergenos: ['Gluten', 'Lácteos'],
      ingredientes: [['insumo', 'lechuga', 4, 'pza'], ['insumo', 'parmesano', 100, 'g', 'rallado'], ['insumo', 'crutones', 150, 'g'], ['insumo', 'aceite', 60, 'ml'], ['insumo', 'ajo', 5, 'g']],
      procedimiento: 'Lavar, desinfectar y secar la lechuga; cortar en trozos.\nEmulsionar el aceite con el ajo machacado.\nMezclar la lechuga con el aderezo; terminar con parmesano y crutones al momento.'
    });

    const S = {};
    const srv = (clave, o) => {
      const x = Object.assign({ id: 'srv-' + clave, descripcion: '', minimoPersonas: '', margen: 35, extraPorPersona: '', extraConcepto: '', ejemplo: true }, o);
      x.componentes = o.componentes.map(c => c[0] === 'receta'
        ? { tipo: 'receta', refId: R[c[1]], porcionesPorPersona: c[2] }
        : { tipo: 'insumo', refId: I[c[1]], cantidad: c[2], unidad: c[3] });
      S[clave] = x.id; d.servicios.push(x);
    };
    srv('comida', {
      nombre: 'Comida empresarial diaria', linea: 'empresarial', margen: 30, minimoPersonas: 50,
      descripcion: 'Plato fuerte, arroz, frijoles, tortillas y agua del día, servido en comedor.',
      componentes: [['receta', 'pollosv', 1], ['receta', 'arroz', 1], ['receta', 'charros', 1], ['receta', 'jamaica', 1], ['insumo', 'tortilla', 120, 'g'], ['insumo', 'plato', 1, 'pza'], ['insumo', 'vaso', 1, 'pza'], ['insumo', 'servilleta', 2, 'pza'], ['insumo', 'cubiertos', 1, 'pza']]
    });
    srv('coffee', {
      nombre: 'Coffee break', linea: 'catering', margen: 45, minimoPersonas: 20,
      descripcion: 'Café, pan dulce y fruta picada para juntas y capacitaciones.',
      componentes: [['receta', 'cafe', 1.5], ['insumo', 'pan', 1.5, 'pza'], ['receta', 'fruta', 1], ['insumo', 'vaso', 2, 'pza'], ['insumo', 'servilleta', 3, 'pza']]
    });
    srv('ejecutivo', {
      nombre: 'Menú ejecutivo 3 tiempos', linea: 'catering', margen: 40, minimoPersonas: 30,
      descripcion: 'Entrada, plato fuerte con guarnición, postre y agua fresca.',
      componentes: [['receta', 'cesar', 1], ['receta', 'pollosv', 1], ['receta', 'arroz', 1], ['receta', 'jamaica', 1.5], ['insumo', 'postre', 1, 'pza'], ['insumo', 'servilleta', 2, 'pza']]
    });

    const hoy = new Date();
    const en = dias => { const f = new Date(hoy.getTime() + dias * 864e5); f.setMinutes(f.getMinutes() - f.getTimezoneOffset()); return f.toISOString().slice(0, 10); };
    d.eventos.push({
      id: 'evt-ejemplo', folio: 'CVZ-EJEMPLO-01', nombre: 'Comida anual de fin de año (ejemplo)', cliente: 'Cliente de ejemplo S.A. de C.V.', contacto: '', telefono: '',
      fecha: en(21), hora: '14:00', lugar: 'Monterrey, N.L.', personas: 120, estatus: 'enviada',
      lineas: [{ tipo: 'servicio', refId: S.ejecutivo, cantidad: '' }, { tipo: 'servicio', refId: S.coffee, cantidad: '' }],
      personal: [{ puesto: 'Mesero', cantidad: 6, horas: 6, tarifa: 90 }, { puesto: 'Cocinero', cantidad: 3, horas: 8, tarifa: 110 }, { puesto: 'Capitán de meseros', cantidad: 1, horas: 7, tarifa: 150 }],
      gastos: [{ concepto: 'Transporte de alimentos y equipo', monto: 1800 }, { concepto: 'Renta de mobiliario y mantelería', monto: 6500 }, { concepto: 'Gas', monto: 900 }],
      indirectos: 8, margen: 35, descuento: 0, iva: 16,
      notas: 'Evento de ejemplo para conocer la plataforma.',
      condiciones: 'Anticipo del 50 % para confirmar la fecha. Precios en MXN. Vigencia de 15 días.',
      ejemplo: true, creado: t, actualizado: t
    });
    return d;
  }

  /** Quita todo lo marcado como ejemplo (y lo que dependa de ello queda con aviso). */
  function quitarEjemplos(d) {
    ['insumos', 'recetas', 'servicios', 'eventos'].forEach(k => { d[k] = d[k].filter(x => !x.ejemplo); });
    return d;
  }
  function hayEjemplos(d) { return ['insumos', 'recetas', 'servicios', 'eventos'].some(k => d[k].some(x => x.ejemplo)); }

  const API = { CLAVE, LINEAS, CATEGORIAS_INSUMO, CATEGORIAS_RECETA, ALERGENOS, ESTATUS, uid, ahora, vacio, normalizar, cargar, guardar, siguienteCodigoReceta, siguienteFolio, ejemplo, quitarEjemplos, hayEjemplos };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.Datos = API;
})(typeof window !== 'undefined' ? window : globalThis);
