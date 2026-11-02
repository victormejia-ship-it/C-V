/* Pruebas del motor de costeo y escalado — correr con: node tests/prueba_costeo.js */
'use strict';
const assert = require('assert');
const C = require('../js/costeo.js');
const D = require('../js/datos.js');
let ok = 0;
const prueba = (nombre, fn) => { fn(); ok++; console.log('✓ ' + nombre); };
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= (tol ?? 1e-6), (msg || '') + ' esperado ' + b + ', obtenido ' + a);

prueba('conversiones de unidades', () => {
  cerca(C.convertir(1.5, 'kg', 'g'), 1500);
  cerca(C.convertir(250, 'ml', 'l'), 0.25);
  cerca(C.convertir(2, 'docena', 'pza'), 24);
  assert.ok(isNaN(C.convertir(1, 'kg', 'l')), 'masa y volumen no se mezclan');
  assert.deepStrictEqual(C.legible(2500, 'masa'), { cant: 2.5, u: 'kg' });
  assert.deepStrictEqual(C.legible(800, 'volumen'), { cant: 800, u: 'ml' });
});

prueba('costo neto de insumo considera merma', () => {
  const cebolla = { precio: 24, presentacion: 1, unidadCompra: 'kg', rendimiento: 80 };
  cerca(C.costoBaseCompra(cebolla) * 1000, 24);
  cerca(C.costoBaseNeto(cebolla) * 1000, 30); // 24 / 0.8
  const vasos = { precio: 95, presentacion: 50, unidadCompra: 'pza' };
  cerca(C.costoBaseNeto(vasos), 1.9);
});

const db = {
  insumos: [
    { id: 'a', nombre: 'Arroz', precio: 30, presentacion: 1, unidadCompra: 'kg', rendimiento: 100 },
    { id: 't', nombre: 'Tomate', precio: 20, presentacion: 1, unidadCompra: 'kg', rendimiento: 80 },
    { id: 'o', nombre: 'Aceite', precio: 50, presentacion: 1, unidadCompra: 'l', rendimiento: 100 },
    { id: 'p', nombre: 'Plato', precio: 100, presentacion: 50, unidadCompra: 'pza', rendimiento: 100 }
  ],
  recetas: [
    { id: 'salsa', nombre: 'Salsa', porciones: 10, rendimientoCantidad: 1, rendimientoUnidad: 'l',
      ingredientes: [{ tipo: 'insumo', refId: 't', cantidad: 800, unidad: 'g' }, { tipo: 'insumo', refId: 'o', cantidad: 100, unidad: 'ml' }] },
    { id: 'plato', nombre: 'Arroz con salsa', porciones: 4,
      ingredientes: [{ tipo: 'insumo', refId: 'a', cantidad: 400, unidad: 'g' }, { tipo: 'receta', refId: 'salsa', cantidad: 500, unidad: 'ml' }] }
  ],
  servicios: [
    { id: 's1', nombre: 'Comida', margen: 40, extraPorPersona: 2,
      componentes: [{ tipo: 'receta', refId: 'plato', porcionesPorPersona: 1 }, { tipo: 'insumo', refId: 'p', cantidad: 1, unidad: 'pza' }] }
  ]
};
const ix = C.crearIndice(db);

prueba('costo de receta con sub-receta', () => {
  // Salsa: tomate 0.8 kg / 0.8 rend × 20 = 20 ; aceite 0.1 L × 50 = 5 → 25
  const s = C.costoReceta(ix.recetas.get('salsa'), ix);
  cerca(s.total, 25); cerca(s.porPorcion, 2.5);
  // Plato: arroz 0.4 × 30 = 12 ; salsa 0.5 L = mitad de 25 = 12.5 → 24.5
  const p = C.costoReceta(ix.recetas.get('plato'), ix);
  cerca(p.total, 24.5); cerca(p.porPorcion, 6.125);
  assert.strictEqual(p.error, null);
});

prueba('sub-receta medida en porciones', () => {
  const l = { tipo: 'receta', refId: 'salsa', cantidad: 2, unidad: 'porc' };
  cerca(C.costoLinea(l, ix).costo, 5);
});

prueba('unidad incompatible marca error sin romper el costo', () => {
  const r = { id: 'x', porciones: 1, ingredientes: [{ tipo: 'insumo', refId: 'a', cantidad: 1, unidad: 'l' }] };
  const c = C.costoReceta(r, ix);
  cerca(c.total, 0); assert.ok(c.error);
});

prueba('escalar de 4 a 1,000 porciones', () => {
  const e = C.escalarReceta(ix.recetas.get('plato'), 1000, ix);
  cerca(e.factor, 250);
  cerca(e.filas[0].netaBase, 100000);          // 100 kg de arroz
  cerca(e.filas[1].netaBase, 125000);          // 125 L de salsa
  cerca(e.costoTotal, 24.5 * 250);
  cerca(e.costoPorcion, 6.125);
});

prueba('escalar a 1 porción', () => {
  const e = C.escalarReceta(ix.recetas.get('plato'), 1, ix);
  cerca(e.filas[0].netaBase, 100);
  cerca(e.costoTotal, 6.125);
});

prueba('explosión de insumos atraviesa sub-recetas y suma merma', () => {
  const acc = C.explotarPorciones(ix.recetas.get('plato'), 8, ix); // ×2
  cerca(acc.insumos.get('a'), 800);
  cerca(acc.insumos.get('t'), 800);   // 1 L de salsa → 800 g tomate neto
  cerca(acc.subrecetas.get('salsa'), 10);
  const lista = C.listaCompras(acc, ix);
  const tom = lista.find(f => f.id === 't');
  cerca(tom.brutaBase, 1000);         // 800 / 0.8
  assert.strictEqual(tom.empaquesCompra, 1);
  cerca(tom.costoCompra, 20);
});

prueba('detección de ciclos entre recetas', () => {
  assert.ok(C.creaCiclo('salsa', 'plato', ix), 'plato ya usa salsa');
  assert.ok(!C.creaCiclo('plato', 'salsa', ix));
  assert.ok(C.creaCiclo('salsa', 'salsa', ix));
  const ciclo = { recetas: [{ id: 'A', porciones: 1, ingredientes: [{ tipo: 'receta', refId: 'B', cantidad: 1, unidad: 'porc' }] }, { id: 'B', porciones: 1, ingredientes: [{ tipo: 'receta', refId: 'A', cantidad: 1, unidad: 'porc' }] }], insumos: [] };
  const c = C.costoReceta(ciclo.recetas[0], ciclo);
  assert.ok(/circular/.test(c.error));
});

prueba('servicio por persona y precio con margen sobre venta', () => {
  const c = C.costoServicio(ix.servicios.get('s1'), ix);
  cerca(c.porPersona, 6.125 + 2 + 2);  // plato + plato desechable + extra
  cerca(c.precioSugerido, 10.125 / 0.6);
  cerca(C.precioPorFoodCost(30, 30), 100);
});

prueba('cotización de evento', () => {
  const ev = { personas: 100, lineas: [{ tipo: 'servicio', refId: 's1', cantidad: '' }, { tipo: 'receta', refId: 'salsa', cantidad: 20 }],
    personal: [{ puesto: 'Mesero', cantidad: 2, horas: 5, tarifa: 100 }], gastos: [{ concepto: 'Gas', monto: 500 }],
    indirectos: 10, margen: 50, descuento: 10, iva: 16 };
  const q = C.cotizarEvento(ev, ix);
  cerca(q.alimentos, 1012.5 + 50);
  cerca(q.personal, 1000); cerca(q.gastos, 500);
  cerca(q.costoTotal, (1062.5 + 1500) * 1.1);
  cerca(q.precioBruto, q.costoTotal * 2);
  cerca(q.subtotal, q.precioBruto * 0.9);
  cerca(q.total, q.subtotal * 1.16);
  cerca(q.precioPorPersona, q.subtotal / 100);
  cerca(q.utilidad, q.subtotal - q.costoTotal);
  const acc = C.explotarEvento(ev, ix);
  cerca(acc.insumos.get('p'), 100);
  cerca(acc.recetas.get('plato'), 100);
});

prueba('datos de ejemplo costean sin errores', () => {
  const d = D.ejemplo(); const x = C.crearIndice(d);
  d.recetas.forEach(r => assert.strictEqual(C.costoReceta(r, x).error, null, r.nombre));
  d.servicios.forEach(s => { const c = C.costoServicio(s, x); assert.strictEqual(c.error, null, s.nombre); assert.ok(c.porPersona > 0); });
  const q = C.cotizarEvento(d.eventos[0], x);
  assert.ok(q.total > 0 && q.error === null);
  assert.ok([...d.insumos, ...d.recetas, ...d.servicios, ...d.eventos].every(o => /^[a-z0-9-]+$/i.test(o.id)), 'ids aptos para el #hash');
});

prueba('folios y códigos consecutivos', () => {
  const d = D.ejemplo();
  assert.strictEqual(D.siguienteCodigoReceta(d), 'REC-009');
  assert.strictEqual(D.siguienteFolio({ eventos: [{ folio: 'CVZ-021126-01' }] }, '2026-11-02'), 'CVZ-021126-02');
});

prueba('cobranza: plan de anticipo y saldo con vencimientos', () => {
  const par = { anticipoPct: 50, diasAnticipo: 15, diasSaldo: 3 };
  const ev = { fecha: '2026-11-30', pagos: [] };
  let c = C.estadoCobranza(ev, 10000, '2026-11-02', par);
  assert.strictEqual(c.anticipo.vence, '2026-11-15'); assert.strictEqual(c.final.vence, '2026-11-27');
  cerca(c.anticipo.monto, 5000); cerca(c.saldo, 10000); assert.strictEqual(c.estado, 'al-corriente');
  assert.strictEqual(C.estadoCobranza(ev, 10000, '2026-11-13', par).estado, 'por-vencer');
  c = C.estadoCobranza(ev, 10000, '2026-11-16', par);
  assert.strictEqual(c.estado, 'vencido'); cerca(c.vencido, 5000);
  ev.pagos.push({ fecha: '2026-11-10', monto: 5000 });
  c = C.estadoCobranza(ev, 10000, '2026-11-16', par);
  assert.strictEqual(c.anticipo.estado, 'pagado'); assert.strictEqual(c.estado, 'al-corriente');
  assert.strictEqual(c.proximo.concepto, 'Saldo'); cerca(c.proximo.monto, 5000);
  ev.pagos.push({ fecha: '2026-11-26', monto: 5000 });
  assert.strictEqual(C.estadoCobranza(ev, 10000, '2026-12-01', par).estado, 'pagado');
  ev.pagos.push({ fecha: '2026-11-27', monto: 100 });
  assert.strictEqual(C.estadoCobranza(ev, 10000, '2026-12-01', par).estado, 'sobrepago');
  const fijo = C.estadoCobranza({ fecha: '2026-11-30', cobro: { anticipoPct: 30, venceAnticipo: '2026-11-05' }, pagos: [] }, 1000, '2026-11-06', par);
  cerca(fijo.anticipo.monto, 300); assert.strictEqual(fijo.estado, 'vencido');
});

prueba('importe con letra para recibos', () => {
  assert.strictEqual(C.numeroALetras(1), 'Un peso 00/100 M.N.');
  assert.strictEqual(C.numeroALetras(21), 'Veintiún pesos 00/100 M.N.');
  assert.strictEqual(C.numeroALetras(100), 'Cien pesos 00/100 M.N.');
  assert.strictEqual(C.numeroALetras(1250.5), 'Mil doscientos cincuenta pesos 50/100 M.N.');
  assert.strictEqual(C.numeroALetras(31500), 'Treinta y un mil quinientos pesos 00/100 M.N.');
  assert.strictEqual(C.numeroALetras(57870.23), 'Cincuenta y siete mil ochocientos setenta pesos 23/100 M.N.');
  assert.strictEqual(C.numeroALetras(1000000), 'Un millón de pesos 00/100 M.N.');
  assert.strictEqual(C.numeroALetras(2500000), 'Dos millones quinientos mil pesos 00/100 M.N.');
});

prueba('inventario: existencia por movimientos y compras que restan existencia', () => {
  const movs = [{ insumoId: 'a', cantidad: C.cantidadConSigno('entrada', 5000) }, { insumoId: 'a', cantidad: C.cantidadConSigno('salida', 1200) }, { insumoId: 'a', cantidad: C.cantidadConSigno('ajuste', -300) }, { insumoId: 'b', cantidad: C.cantidadConSigno('merma', 40) }];
  const st = C.existencias(movs);
  cerca(st.get('a'), 3500); cerca(st.get('b'), -40);
  const lista = [{ id: 'a', brutaBase: 6000, presentacion: 1, unidadCompra: 'kg', precio: 30 }, { id: 'c', brutaBase: 100, presentacion: 50, unidadCompra: 'pza', precio: 90 }, { id: 'd', brutaBase: 800, presentacion: 1, unidadCompra: 'kg', precio: 20 }];
  const st2 = new Map([['a', 3500], ['d', 1000]]);
  const r = C.comprasMenosExistencia(lista, st2);
  cerca(r[0].brutaBase, 2500); assert.strictEqual(r[0].empaquesCompra, 3); cerca(r[0].costoCompra, 90);
  assert.strictEqual(r[1].empaquesCompra, 2); cerca(r[1].costoCompra, 180);
  assert.strictEqual(r[2].cubierto, true); assert.strictEqual(r[2].empaquesCompra, 0);
});

console.log('\n' + ok + ' pruebas correctas');
