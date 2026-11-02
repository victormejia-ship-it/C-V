/* =========================================================================
   CIVIZO · Motor de costeo y escalado

   Funciones puras (sin DOM) para que se puedan probar en Node:
   - Unidades y conversiones (masa, volumen, piezas).
   - Costo unitario de un insumo considerando su rendimiento (merma).
   - Costo de una receta estandarizada, incluyendo sub-recetas.
   - Escalado de una receta a N porciones (de 1 a miles).
   - Explosión de insumos: cuánto comprar para una receta, servicio o evento.
   - Costo de un servicio por persona y cotización de un evento completo.

   Convenciones
   ------------
   · En las recetas la cantidad capturada es NETA (lo que entra a la olla ya
     limpio). Para comprar se usa la cantidad BRUTA = neta / rendimiento.
   · Las cantidades se normalizan a una unidad base: g (masa), ml (volumen),
     pza (piezas).
   · Precio de venta = costo / (1 − margen). El margen es sobre la venta,
     igual que el "food cost": food cost 30 % ⇔ margen 70 %.
   ========================================================================= */
(function (raiz) {
  'use strict';

  const UNIDADES = {
    g:      { dim: 'masa',   f: 1,        n: 'g' },
    kg:     { dim: 'masa',   f: 1000,     n: 'kg' },
    lb:     { dim: 'masa',   f: 453.592,  n: 'lb' },
    oz:     { dim: 'masa',   f: 28.3495,  n: 'oz' },
    ml:     { dim: 'volumen', f: 1,       n: 'ml' },
    l:      { dim: 'volumen', f: 1000,    n: 'L' },
    galon:  { dim: 'volumen', f: 3785.41, n: 'galón' },
    taza:   { dim: 'volumen', f: 240,     n: 'taza' },
    cda:    { dim: 'volumen', f: 15,      n: 'cda' },
    cdta:   { dim: 'volumen', f: 5,       n: 'cdta' },
    pza:    { dim: 'pieza',  f: 1,        n: 'pza' },
    docena: { dim: 'pieza',  f: 12,       n: 'docena' }
  };
  const BASE = { masa: 'g', volumen: 'ml', pieza: 'pza' };
  const DIM_NOMBRE = { masa: 'peso', volumen: 'volumen', pieza: 'piezas' };

  const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; };
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

  function dimension(u) { return UNIDADES[u] ? UNIDADES[u].dim : null; }
  function unidadesDe(dim) { return Object.keys(UNIDADES).filter(k => UNIDADES[k].dim === dim); }
  function nombreUnidad(u) { return UNIDADES[u] ? UNIDADES[u].n : (u === 'porc' ? 'porción' : u || ''); }

  /** Cantidad en unidad base de su dimensión. NaN si la unidad no existe. */
  function aBase(cant, u) { return UNIDADES[u] ? num(cant) * UNIDADES[u].f : NaN; }

  /** Convierte entre unidades de la misma dimensión. NaN si no son compatibles. */
  function convertir(cant, de, a) {
    if (!UNIDADES[de] || !UNIDADES[a] || UNIDADES[de].dim !== UNIDADES[a].dim) return NaN;
    return num(cant) * UNIDADES[de].f / UNIDADES[a].f;
  }

  /** Expresa una cantidad base en la unidad más legible (g→kg, ml→L, pza). */
  function legible(cantBase, dim) {
    const c = Number(cantBase) || 0;
    if (dim === 'masa')    return c >= 1000 ? { cant: c / 1000, u: 'kg' } : { cant: c, u: 'g' };
    if (dim === 'volumen') return c >= 1000 ? { cant: c / 1000, u: 'l' }  : { cant: c, u: 'ml' };
    return { cant: c, u: 'pza' };
  }

  /** Formato numérico corto para cantidades de cocina. */
  function fmtCant(n) {
    const v = Number(n) || 0;
    const a = Math.abs(v);
    const dec = a === 0 ? 0 : a < 1 ? 3 : a < 10 ? 2 : a < 100 ? 1 : 0;
    return v.toLocaleString('es-MX', { maximumFractionDigits: dec, minimumFractionDigits: 0 });
  }
  function fmtLegible(cantBase, dim) { const l = legible(cantBase, dim); return fmtCant(l.cant) + ' ' + nombreUnidad(l.u); }

  /* ------------------------------------------------------------- Insumos */

  /** Rendimiento como fracción 0–1 (100 % si no se captura o es inválido). */
  function rendimiento(ins) {
    const r = num(ins && ins.rendimiento);
    return r > 0 && r <= 100 ? r / 100 : 1;
  }

  /** Costo por unidad base (g, ml o pza) de lo que se compra, sin merma. */
  function costoBaseCompra(ins) {
    if (!ins) return 0;
    const cont = aBase(ins.presentacion, ins.unidadCompra);
    return cont > 0 ? num(ins.precio) / cont : 0;
  }

  /** Costo por unidad base NETA (ya considerando la merma). */
  function costoBaseNeto(ins) { return costoBaseCompra(ins) / rendimiento(ins); }

  /* ------------------------------------------------------------- Recetas */

  function crearIndice(db) {
    const ix = { insumos: new Map(), recetas: new Map(), servicios: new Map() };
    (db.insumos || []).forEach(x => ix.insumos.set(x.id, x));
    (db.recetas || []).forEach(x => ix.recetas.set(x.id, x));
    (db.servicios || []).forEach(x => ix.servicios.set(x.id, x));
    return ix;
  }
  const idx = db => (db && db.insumos instanceof Map) ? db : crearIndice(db || {});

  function porcionesReceta(rec) { const p = num(rec && rec.porciones); return p > 0 ? p : 1; }

  /** Rendimiento total de la receta en unidad base, si está capturado. */
  function rendimientoBase(rec) {
    if (!rec || !rec.rendimientoUnidad || !UNIDADES[rec.rendimientoUnidad]) return null;
    const v = aBase(rec.rendimientoCantidad, rec.rendimientoUnidad);
    return v > 0 ? { dim: UNIDADES[rec.rendimientoUnidad].dim, base: v } : null;
  }

  /**
   * Fracción de la receta `rec` que representa una línea de sub-receta.
   * Ej.: receta rinde 2 L; la línea pide 500 ml ⇒ 0.25.
   * Devuelve NaN si la unidad no es compatible.
   */
  function fraccionSubreceta(rec, cant, unidad) {
    if (unidad === 'porc') return num(cant) / porcionesReceta(rec);
    const rb = rendimientoBase(rec);
    if (!rb || dimension(unidad) !== rb.dim) return NaN;
    return aBase(cant, unidad) / rb.base;
  }

  /** Unidades válidas para usar una receta como ingrediente de otra. */
  function unidadesSubreceta(rec) {
    const rb = rendimientoBase(rec);
    return ['porc'].concat(rb ? unidadesDe(rb.dim) : []);
  }

  /**
   * Costo de una línea de ingrediente.
   * @returns {{costo:number, error:string|null}}
   */
  function costoLinea(linea, db, pila) {
    const ix = idx(db);
    if (!linea) return { costo: 0, error: 'Línea vacía' };
    if (linea.tipo === 'receta') {
      const sub = ix.recetas.get(linea.refId);
      if (!sub) return { costo: 0, error: 'La sub-receta ya no existe' };
      const fr = fraccionSubreceta(sub, linea.cantidad, linea.unidad);
      if (!isFinite(fr)) return { costo: 0, error: 'Unidad no compatible con el rendimiento de la sub-receta' };
      const c = costoReceta(sub, ix, pila);
      return { costo: c.total * fr, error: c.error };
    }
    const ins = ix.insumos.get(linea.refId);
    if (!ins) return { costo: 0, error: 'El insumo ya no existe' };
    const dimIns = dimension(ins.unidadCompra);
    if (dimension(linea.unidad) !== dimIns) return { costo: 0, error: 'Se compra por ' + DIM_NOMBRE[dimIns] + '; usa una unidad de ' + DIM_NOMBRE[dimIns] };
    return { costo: aBase(linea.cantidad, linea.unidad) * costoBaseNeto(ins), error: null };
  }

  /**
   * Costo total de una receta (para sus porciones base).
   * Detecta ciclos (A usa B y B usa A).
   */
  function costoReceta(rec, db, pila) {
    const ix = idx(db);
    pila = pila || [];
    if (!rec) return { total: 0, porPorcion: 0, lineas: [], error: 'Receta no encontrada' };
    if (pila.includes(rec.id)) return { total: 0, porPorcion: 0, lineas: [], error: 'Referencia circular entre recetas' };
    const sig = pila.concat(rec.id);
    let total = 0, error = null;
    const lineas = (rec.ingredientes || []).map(l => {
      const c = costoLinea(l, ix, sig);
      total += c.costo;
      if (c.error && !error) error = c.error;
      return c;
    });
    return { total, porPorcion: total / porcionesReceta(rec), lineas, error };
  }

  /** Precio sugerido a partir de costo y margen (%) sobre venta. */
  function precioConMargen(costo, margenPct) {
    const m = Math.min(Math.max(num(margenPct), 0), 95) / 100;
    return num(costo) / (1 - m);
  }
  /** Precio sugerido por food cost objetivo (%). */
  function precioPorFoodCost(costo, foodCostPct) {
    const f = num(foodCostPct);
    return f > 0 ? num(costo) / (f / 100) : 0;
  }

  /**
   * Escala una receta a `porciones`. Devuelve cada ingrediente con su
   * cantidad neta escalada, la bruta (para compra) y su costo.
   */
  function escalarReceta(rec, porciones, db) {
    const ix = idx(db);
    const factor = num(porciones) / porcionesReceta(rec);
    const c = costoReceta(rec, ix);
    const filas = (rec.ingredientes || []).map((l, i) => {
      const cant = num(l.cantidad) * factor;
      let nombre = '—', dim = dimension(l.unidad), bruta = null;
      if (l.tipo === 'receta') {
        const sub = ix.recetas.get(l.refId);
        nombre = sub ? sub.nombre : '(sub-receta eliminada)';
      } else {
        const ins = ix.insumos.get(l.refId);
        nombre = ins ? ins.nombre : '(insumo eliminado)';
        if (ins && dim) bruta = aBase(cant, l.unidad) / rendimiento(ins);
      }
      const netaBase = dim ? aBase(cant, l.unidad) : null;
      return {
        tipo: l.tipo, refId: l.refId, nombre, nota: l.nota || '',
        cantidad: cant, unidad: l.unidad, dim,
        netaBase, brutaBase: bruta,
        costo: (c.lineas[i] ? c.lineas[i].costo : 0) * factor
      };
    });
    return { factor, porciones: num(porciones), filas, costoTotal: c.total * factor, costoPorcion: c.porPorcion, error: c.error };
  }

  /* ------------------------------------------------- Explosión de insumos */

  /**
   * Suma a `acc` los insumos (cantidad NETA en base) que requiere `fraccion`
   * de la receta. Las sub-recetas se registran en `acc.subrecetas`.
   */
  function explotarReceta(rec, fraccion, db, acc, pila) {
    const ix = idx(db);
    acc = acc || nuevoAcumulado();
    pila = pila || [];
    if (!rec || pila.includes(rec.id)) return acc;
    const sig = pila.concat(rec.id);
    (rec.ingredientes || []).forEach(l => {
      if (l.tipo === 'receta') {
        const sub = ix.recetas.get(l.refId);
        if (!sub) return;
        const fr = fraccionSubreceta(sub, l.cantidad, l.unidad);
        if (!isFinite(fr)) return;
        const porc = fr * fraccion * porcionesReceta(sub);
        acc.subrecetas.set(sub.id, (acc.subrecetas.get(sub.id) || 0) + porc);
        explotarReceta(sub, fr * fraccion, ix, acc, sig);
      } else {
        const ins = ix.insumos.get(l.refId);
        if (!ins || dimension(l.unidad) !== dimension(ins.unidadCompra)) return;
        const base = aBase(l.cantidad, l.unidad) * fraccion;
        acc.insumos.set(ins.id, (acc.insumos.get(ins.id) || 0) + base);
      }
    });
    return acc;
  }
  function nuevoAcumulado() { return { insumos: new Map(), subrecetas: new Map(), recetas: new Map() }; }

  /** Explosión de N porciones de una receta. */
  function explotarPorciones(rec, porciones, db, acc) {
    acc = acc || nuevoAcumulado();
    if (!rec) return acc;
    acc.recetas.set(rec.id, (acc.recetas.get(rec.id) || 0) + num(porciones));
    return explotarReceta(rec, num(porciones) / porcionesReceta(rec), db, acc);
  }

  /** Explosión de un servicio para `personas` comensales. */
  function explotarServicio(srv, personas, db, acc) {
    const ix = idx(db);
    acc = acc || nuevoAcumulado();
    if (!srv) return acc;
    (srv.componentes || []).forEach(c => {
      if (c.tipo === 'receta') {
        explotarPorciones(ix.recetas.get(c.refId), num(c.porcionesPorPersona) * num(personas), ix, acc);
      } else {
        const ins = ix.insumos.get(c.refId);
        if (!ins || dimension(c.unidad) !== dimension(ins.unidadCompra)) return;
        const base = aBase(c.cantidad, c.unidad) * num(personas);
        acc.insumos.set(ins.id, (acc.insumos.get(ins.id) || 0) + base);
      }
    });
    return acc;
  }

  /**
   * Convierte el acumulado en una lista de compras: neto, bruto (con merma),
   * cuántas presentaciones comprar y su costo.
   */
  function listaCompras(acc, db) {
    const ix = idx(db);
    const filas = [];
    acc.insumos.forEach((netaBase, id) => {
      const ins = ix.insumos.get(id);
      if (!ins) return;
      const dim = dimension(ins.unidadCompra);
      const brutaBase = netaBase / rendimiento(ins);
      const cont = aBase(ins.presentacion, ins.unidadCompra);
      const empaques = cont > 0 ? brutaBase / cont : 0;
      const empaquesCompra = Math.ceil(empaques - 1e-9);
      filas.push({
        id, nombre: ins.nombre, categoria: ins.categoria || 'Sin categoría', proveedor: ins.proveedor || '',
        dim, netaBase, brutaBase,
        empaques, empaquesCompra,
        presentacion: num(ins.presentacion), unidadCompra: ins.unidadCompra, precio: num(ins.precio),
        costoUso: brutaBase * costoBaseCompra(ins),
        costoCompra: empaquesCompra * num(ins.precio)
      });
    });
    filas.sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
    return filas;
  }

  /* ------------------------------------------------------------ Servicios */

  /** Costo por persona de un servicio (alimentos + insumos directos). */
  function costoServicio(srv, db) {
    const ix = idx(db);
    let total = 0, error = null;
    const lineas = (srv && srv.componentes || []).map(c => {
      let costo = 0, err = null;
      if (c.tipo === 'receta') {
        const rec = ix.recetas.get(c.refId);
        if (!rec) err = 'La receta ya no existe';
        else { const cr = costoReceta(rec, ix); costo = cr.porPorcion * num(c.porcionesPorPersona); err = cr.error; }
      } else {
        const r = costoLinea({ tipo: 'insumo', refId: c.refId, cantidad: c.cantidad, unidad: c.unidad }, ix);
        costo = r.costo; err = r.error;
      }
      total += costo;
      if (err && !error) error = err;
      return { costo, error: err };
    });
    total += num(srv && srv.extraPorPersona);
    return { porPersona: total, lineas, error, precioSugerido: precioConMargen(total, srv && srv.margen) };
  }

  /* -------------------------------------------------------------- Eventos */

  /**
   * Cotización completa de un evento.
   * evento: { personas, lineas:[{tipo:'servicio'|'receta', refId, cantidad}],
   *           personal:[{puesto, cantidad, horas, tarifa}],
   *           gastos:[{concepto, monto}], indirectos, margen, iva, descuento }
   * En líneas de servicio `cantidad` = personas; en recetas = porciones.
   */
  function cotizarEvento(ev, db) {
    const ix = idx(db);
    const pax = Math.max(num(ev && ev.personas), 0);
    let alimentos = 0, error = null;
    const lineas = (ev && ev.lineas || []).map(l => {
      const cant = l.cantidad === '' || l.cantidad == null ? pax : num(l.cantidad);
      let unit = 0, nombre = '—', err = null;
      if (l.tipo === 'servicio') {
        const s = ix.servicios.get(l.refId);
        if (!s) err = 'El servicio ya no existe';
        else { const cs = costoServicio(s, ix); unit = cs.porPersona; nombre = s.nombre; err = cs.error; }
      } else {
        const r = ix.recetas.get(l.refId);
        if (!r) err = 'La receta ya no existe';
        else { const cr = costoReceta(r, ix); unit = cr.porPorcion; nombre = r.nombre; err = cr.error; }
      }
      const total = unit * cant;
      alimentos += total;
      if (err && !error) error = err;
      return { nombre, cantidad: cant, unitario: unit, total, error: err };
    });
    const personal = (ev && ev.personal || []).reduce((s, p) => s + num(p.cantidad) * num(p.horas) * num(p.tarifa), 0);
    const gastos = (ev && ev.gastos || []).reduce((s, g) => s + num(g.monto), 0);
    const directo = alimentos + personal + gastos;
    const indirectos = directo * num(ev && ev.indirectos) / 100;
    const costoTotal = directo + indirectos;
    const precioBruto = precioConMargen(costoTotal, ev && ev.margen);
    const descuento = precioBruto * Math.min(Math.max(num(ev && ev.descuento), 0), 100) / 100;
    const subtotal = precioBruto - descuento;
    const iva = subtotal * num(ev && ev.iva) / 100;
    const total = subtotal + iva;
    const utilidad = subtotal - costoTotal;
    return {
      personas: pax, lineas, alimentos, personal, gastos, directo, indirectos, costoTotal,
      precioBruto, descuento, subtotal, iva, total, utilidad,
      margenReal: subtotal > 0 ? utilidad / subtotal * 100 : 0,
      foodCost: subtotal > 0 ? alimentos / subtotal * 100 : 0,
      costoPorPersona: pax > 0 ? costoTotal / pax : 0,
      precioPorPersona: pax > 0 ? subtotal / pax : 0,
      error
    };
  }

  /** Explosión completa de un evento (todas sus líneas). */
  function explotarEvento(ev, db, acc) {
    const ix = idx(db);
    const pax = num(ev && ev.personas);
    acc = acc || nuevoAcumulado();
    (ev && ev.lineas || []).forEach(l => {
      const cant = l.cantidad === '' || l.cantidad == null ? pax : num(l.cantidad);
      if (l.tipo === 'servicio') explotarServicio(ix.servicios.get(l.refId), cant, ix, acc);
      else explotarPorciones(ix.recetas.get(l.refId), cant, ix, acc);
    });
    return acc;
  }

  /** ¿Agregar `subId` como ingrediente de `recId` crearía un ciclo? */
  function creaCiclo(recId, subId, db) {
    const ix = idx(db);
    if (recId === subId) return true;
    const visitados = new Set();
    const pend = [subId];
    while (pend.length) {
      const id = pend.pop();
      if (id === recId) return true;
      if (visitados.has(id)) continue;
      visitados.add(id);
      const r = ix.recetas.get(id);
      (r && r.ingredientes || []).forEach(l => { if (l.tipo === 'receta') pend.push(l.refId); });
    }
    return false;
  }



  /* ------------------------------------------------------------ Inventario */

  /** Existencia por insumo (unidad base) sumando movimientos con signo. */
  function existencias(movs) {
    const m = new Map();
    (movs || []).forEach(x => { if (x && x.insumoId) m.set(x.insumoId, (m.get(x.insumoId) || 0) + num(x.cantidad)); });
    return m;
  }
  /** Signo de un movimiento según su tipo (el ajuste ya trae su diferencia). */
  function cantidadConSigno(tipo, cantidadBase) {
    const c = Math.abs(num(cantidadBase));
    return tipo === 'entrada' ? c : tipo === 'salida' || tipo === 'merma' ? -c : num(cantidadBase);
  }
  /**
   * Resta la existencia a una lista de compras: compra solo lo que falta,
   * redondeado a empaques completos.
   */
  function comprasMenosExistencia(lista, stock) {
    return lista.map(f => {
      const ex = Math.max((stock && stock.get(f.id)) || 0, 0);
      const falta = Math.max(f.brutaBase - ex, 0);
      const cont = aBase(f.presentacion, f.unidadCompra);
      const empaques = cont > 0 ? falta / cont : 0;
      const empaquesCompra = falta > 1e-9 ? Math.ceil(empaques - 1e-9) : 0;
      return Object.assign({}, f, {
        requeridoBase: f.brutaBase, existenciaBase: ex, brutaBase: falta, cubierto: falta <= 1e-9,
        empaques, empaquesCompra, costoCompra: empaquesCompra * num(f.precio), costoUso: cont > 0 ? falta * num(f.precio) / cont : 0
      });
    });
  }

  /* ------------------------------------------------------------ Cobranza */

  const sumaDias = (iso, d) => { if (!iso) return ''; const f = new Date(iso + 'T12:00:00'); f.setDate(f.getDate() + d); return f.toISOString().slice(0, 10); };

  /**
   * Estado de cobranza de un evento.
   * total: importe del evento con IVA. hoy: 'AAAA-MM-DD'.
   * par: { anticipoPct, diasAnticipo, diasSaldo } por omisión.
   * Plan: anticipo (pct del total) y saldo, cada uno con fecha de vencimiento
   * (por omisión N días antes del evento; se puede fijar en ev.cobro).
   */
  function estadoCobranza(ev, total, hoy, par) {
    par = par || {};
    const cob = (ev && ev.cobro) || {};
    const pct = cob.anticipoPct === '' || cob.anticipoPct == null ? num(par.anticipoPct != null ? par.anticipoPct : 50) : num(cob.anticipoPct);
    total = r2(total);
    const pagos = ((ev && ev.pagos) || []).filter(p => num(p.monto) !== 0).slice().sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
    const pagado = r2(pagos.reduce((s, p) => s + num(p.monto), 0));
    const saldo = r2(total - pagado);
    const anticipoMonto = r2(total * Math.min(Math.max(pct, 0), 100) / 100);
    const venceAnticipo = cob.venceAnticipo || sumaDias(ev && ev.fecha, -num(par.diasAnticipo != null ? par.diasAnticipo : 15));
    const venceSaldo = cob.venceSaldo || sumaDias(ev && ev.fecha, -num(par.diasSaldo != null ? par.diasSaldo : 3));
    const estadoDe = (cubierto, vence) => cubierto ? 'pagado' : !vence ? 'sin-fecha' : vence < hoy ? 'vencido' : (new Date(vence + 'T12:00:00') - new Date(hoy + 'T12:00:00')) / 864e5 <= 3 ? 'por-vencer' : 'pendiente';
    const anticipo = { monto: anticipoMonto, vence: venceAnticipo, falta: r2(Math.max(anticipoMonto - pagado, 0)) };
    anticipo.estado = estadoDe(anticipo.falta <= 0.005, anticipo.vence);
    const final = { monto: r2(total - anticipoMonto), vence: venceSaldo, falta: r2(Math.max(saldo - anticipo.falta, 0)) };
    final.estado = estadoDe(saldo <= 0.005, final.vence);
    let proximo = null;
    if (anticipo.falta > 0.005) proximo = { concepto: 'Anticipo', monto: anticipo.falta, vence: anticipo.vence, estado: anticipo.estado };
    else if (saldo > 0.005) proximo = { concepto: 'Saldo', monto: saldo, vence: final.vence, estado: final.estado };
    const vencido = r2((anticipo.estado === 'vencido' ? anticipo.falta : 0) + (final.estado === 'vencido' ? final.falta : 0));
    const estado = total <= 0 ? 'sin-importe' : saldo <= 0.005 ? (saldo < -0.005 ? 'sobrepago' : 'pagado') : vencido > 0 ? 'vencido' : proximo && proximo.estado === 'por-vencer' ? 'por-vencer' : 'al-corriente';
    return { total, pagado, saldo, avance: total > 0 ? Math.min(pagado / total, 1) : 0, anticipoPct: pct, anticipo, final, proximo, vencido, estado, pagos };
  }

  /** Importe con letra para recibos: 1250.5 → "Mil doscientos cincuenta pesos 50/100 M.N." */
  function numeroALetras(n) {
    const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
    const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    const menorMil = x => {
      if (x === 0) return '';
      if (x === 100) return 'cien';
      const c = Math.floor(x / 100), r = x % 100;
      const dec = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : '');
      return [C[c], dec].filter(Boolean).join(' ');
    };
    const apocope = t => t.replace(/uno$/, 'un').replace(/veintiún$/, 'veintiún');
    const entero = x => {
      if (x === 0) return 'cero';
      const mill = Math.floor(x / 1e6), miles = Math.floor((x % 1e6) / 1000), resto = x % 1000;
      const partes = [];
      if (mill) partes.push(mill === 1 ? 'un millón' : apocope(menorMil(mill)).replace(/veintiun$/, 'veintiún') + ' millones');
      if (miles) partes.push(miles === 1 ? 'mil' : apocope(menorMil(miles)).replace(/veintiun$/, 'veintiún') + ' mil');
      if (resto) partes.push(menorMil(resto));
      return partes.join(' ');
    };
    const v = Math.round(Math.abs(num(n)) * 100);
    const ent = Math.floor(v / 100), cent = v % 100;
    let t = entero(ent);
    t = t.replace(/uno$/, 'un').replace(/veintiun$/, 'veintiún');
    const de = /(millón|millones)$/.test(t) ? ' de' : '';
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t + de + ' ' + (ent === 1 ? 'peso' : 'pesos') + ' ' + String(cent).padStart(2, '0') + '/100 M.N.';
  }

  const API = {
    UNIDADES, BASE, DIM_NOMBRE, num, r2,
    dimension, unidadesDe, nombreUnidad, aBase, convertir, legible, fmtCant, fmtLegible,
    rendimiento, costoBaseCompra, costoBaseNeto,
    crearIndice, porcionesReceta, rendimientoBase, fraccionSubreceta, unidadesSubreceta,
    costoLinea, costoReceta, precioConMargen, precioPorFoodCost, escalarReceta,
    nuevoAcumulado, explotarReceta, explotarPorciones, explotarServicio, explotarEvento, listaCompras,
    costoServicio, cotizarEvento, creaCiclo, estadoCobranza, numeroALetras, existencias, cantidadConSigno, comprasMenosExistencia
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.Costeo = API;
})(typeof window !== 'undefined' ? window : globalThis);
