/* =========================================================================
   CIVIZO · Cocina — interfaz

   Vistas (ruta en el #hash):
     #inicio        Tablero
     #insumos       Catálogo de insumos (compras, merma, costo neto)
     #recetas       Recetas estandarizadas
     #receta-ID     Ficha de receta + escalador (1 a miles de porciones)
     #servicios     Catálogo de servicios por línea de negocio
     #servicio-ID   Servicio costeado por persona + simulador
     #eventos       Eventos y cotizaciones
     #evento-ID     Costeo del evento (costo interno vs. cotización cliente)
     #ajustes       Empresa, parámetros, respaldo

   La edición es en línea y se guarda sola: cada campo con data-campo
   escribe en el objeto de la vista (ctx.obj) y se recalcula lo que cambia.
   ========================================================================= */
(function () {
  'use strict';

  const C = window.Costeo, D = window.Datos;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  const dinero = n => fmtMXN.format(Math.round((Number(n) || 0) * 100) / 100);
  const pct = n => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' %';
  const n0 = n => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fechaCorta(iso) {
    if (!iso) return '—';
    const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
    return isNaN(d) ? '—' : d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
  }
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const diasHasta = iso => iso ? Math.round((new Date(iso + 'T12:00:00') - new Date(hoyISO() + 'T12:00:00')) / 864e5) : null;
  const copia = o => JSON.parse(JSON.stringify(o));

  /* ------------------------------------------------------------ Estado */
  const N = window.Nube;
  const NUBE = !!(N && N.HAY_NUBE);
  let db, perfil = null;
  if (NUBE) db = D.vacio();
  else { const carga = D.cargar(); db = carga.datos; if (carga.nuevo) D.guardar(db); }
  let IX = C.crearIndice(db);
  let ctx = {};
  /* Permisos: en modo local todo se puede; en la nube depende del rol. */
  const rol = () => NUBE ? (perfil && perfil.rol) || 'consulta' : 'owner';
  const esAdmin = () => ['owner', 'admin'].includes(rol());
  const puedeEditar = () => ['owner', 'admin', 'editor'].includes(rol());
  const escalas = {};          // por receta: { valor, modo }
  const filtros = { insumos: { q: '', cat: '' }, recetas: { q: '', cat: '', tipo: '' }, servicios: { linea: '' }, eventos: { q: '', est: '' } };

  function reindexar() { IX = C.crearIndice(db); }
  let tGuardar = null;
  function guardar(inmediato) {
    if (NUBE) { if (perfil && puedeEditar()) N.programar(db); return; }
    clearTimeout(tGuardar);
    const hacer = () => {
      const ok = D.guardar(db);
      mostrarEstado(ok ? 'ok' : 'error', ok ? 'Guardado' : 'No se pudo guardar en este navegador. Descarga un respaldo.');
    };
    if (inmediato) hacer(); else tGuardar = setTimeout(hacer, 250);
  }
  function cambioEstructura() { reindexar(); guardar(true); }
  let tEstado;
  function mostrarEstado(tipo, texto) {
    const el = $('estado');
    el.querySelector('span').textContent = texto;
    el.className = 'estado visible ' + tipo;
    clearTimeout(tEstado);
    if (tipo === 'ok') tEstado = setTimeout(() => el.classList.remove('visible'), 1800);
  }

  /* ------------------------------------------------------------ Íconos */
  const ICO = {
    inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    insumos: '<path d="M4 9h16l-1.5 10a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7L4 9z"/><path d="M8 9l4-5 4 5"/><path d="M9 13v4M15 13v4M12 13v4"/>',
    recetas: '<path d="M7 18h10v3H7z"/><path d="M7 18v-4.3A4 4 0 0 1 6 6a5 5 0 0 1 6-3 5 5 0 0 1 6 3 4 4 0 0 1-1 7.7V18"/>',
    servicios: '<path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 11V8.5"/><path d="M10.5 8.5h3"/>',
    eventos: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h3v3H8z"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/><circle cx="12" cy="12" r="6.5"/>',
    empresarial: '<path d="M2.5 19h19"/><path d="M4.5 19a7.5 7.5 0 0 1 15 0"/><path d="M12 11.5V9"/><path d="M10.3 9h3.4"/>',
    catering: '<path d="M7 18h10v3H7z"/><path d="M7 18v-4.3A4 4 0 0 1 6 6a5 5 0 0 1 6-3 5 5 0 0 1 6 3 4 4 0 0 1-1 7.7V18"/>',
    produccion: '<path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5L12 21l9-4.5"/>',
    operacion: '<path d="M12 2.5l2 2.2 3-.4.7 2.9 2.7 1.4-1.1 2.8 1.1 2.8-2.7 1.4-.7 2.9-3-.4-2 2.2-2-2.2-3 .4-.7-2.9-2.7-1.4 1.1-2.8-1.1-2.8 2.7-1.4.7-2.9 3 .4z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
    consultoria: '<path d="M4 20h16"/><rect x="5" y="13" width="3" height="5"/><rect x="10.5" y="9" width="3" height="9"/><rect x="16" y="5" width="3" height="13"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    imprimir: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    copiar: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    borrar: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    lista: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    bajar: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    subir: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
    escalar: '<path d="M4 20L20 4M14 4h6v6M4 14v6h6"/>',
    externo: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chat: '<path d="M4 20l1.3-4A8 8 0 1 1 8 19l-4 1z"/>',
    telefono: '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    cobranza: '<path d="M6 6V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18"/><path d="M15.5 15h2.5"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    bandeja: '<path d="M3 13l2.5-8h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
    galeria: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>',
    portada: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>',
    etiqueta: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
    tablero: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    compras: '<path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
    usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    salir: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    inventario: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    proveedores: '<path d="M3 16V6h11v10M14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    facturacion: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6M9 16h3"/>'
  };
  const ico = (k, cls) => '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true">' + (ICO[k] || '') + '</svg>';
  const ISOTIPO = $('tplIsotipo').innerHTML;

  /* ------------------------------------------------------------ Avisos */
  let tAviso;
  function aviso(txt, error) {
    const el = $('aviso');
    el.textContent = txt; el.className = 'aviso' + (error ? ' error' : ''); el.hidden = false;
    clearTimeout(tAviso); tAviso = setTimeout(() => { el.hidden = true; }, 3200);
  }

  /* ------------------------------------------------------------ Modal (hoja de pantalla completa) */
  let modalAcciones = {};
  let modalEntrada = false;      // el modal ocupa una entrada del historial (para cerrarlo con "atrás")
  let volviendo = false;         // hay un history.back() en curso
  const trasVolver = [];
  function abrirModal(op) {
    if (volviendo) { trasVolver.push(() => abrirModal(op)); return; }
    const { titulo, cuerpo, botones, ancho, alAbrir, compacto } = op;
    $('modalTitulo').textContent = titulo;
    const viejo = $('modalCuerpo'), limpio = viejo.cloneNode(false);   // sin oyentes de modales anteriores
    viejo.replaceWith(limpio);
    limpio.innerHTML = cuerpo;
    modalAcciones = {};
    $('modalPie').innerHTML = (botones || []).map((b, i) => {
      modalAcciones[i] = b.accion;
      return '<button type="button" class="btn ' + (b.clase || '') + '" data-mbtn="' + i + '">' + b.texto + '</button>';
    }).join('');
    $('modal').querySelector('.modal').classList.toggle('ancho', !!ancho);
    $('modal').classList.toggle('compacto', !!compacto);
    const yaAbierto = !$('modal').hidden;
    $('modal').hidden = false;
    if (!yaAbierto && !modalEntrada) { modalEntrada = true; history.pushState(Object.assign(estadoHist(), { modal: true }), '', location.href); }
    if (alAbrir) alAbrir($('modalCuerpo'));
    const primero = $('modalCuerpo').querySelector('input:not([type=checkbox]), select, textarea');
    (primero || $('modal').querySelector('[data-mbtn]') || $('modal').querySelector('[data-cerrar]')).focus();
  }
  function ocultarModal() { $('modal').hidden = true; $('modalCuerpo').innerHTML = ''; modalAcciones = {}; }
  function cerrarModal() {
    if ($('modal').hidden) return;
    ocultarModal();
    if (modalEntrada) { modalEntrada = false; volviendo = true; history.back(); }
  }
  $('modal').addEventListener('click', e => {
    if ((e.target === $('modal') && $('modal').classList.contains('compacto')) || e.target.closest('[data-cerrar]')) return cerrarModal();
    const b = e.target.closest('[data-mbtn]');
    if (b) { const f = modalAcciones[b.dataset.mbtn]; if (!f || f($('modalCuerpo')) !== false) cerrarModal(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('modal').hidden) return cerrarModal();
    const a = document.activeElement;
    if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return a.blur();
    if (pila.length) atras();
  });

  function confirmar(titulo, mensaje, textoOk, alOk) {
    abrirModal({ titulo, compacto: true, cuerpo: '<p>' + mensaje + '</p>', botones: [{ texto: 'Cancelar', clase: 'fantasma' }, { texto: textoOk, clase: 'peligro lleno', accion: alOk }] });
  }

  /* ------------------------------------------------------------ Navegación por capas
     El inicio siempre está abajo. Cada función se abre como una capa de
     pantalla completa encima. "Atrás" (botón, navegador, gesto o Esc) quita
     solo la capa de arriba y la de abajo aparece donde se quedó. */
  let pila = [];
  let entradas = 0;
  const limpiar = h => decodeURIComponent(String(h || '').replace(/^#/, ''));
  function rutaDe(h) { h = limpiar(h) || 'inicio'; const m = h.match(/^(receta|servicio|evento|insumo|cobro|proveedor)-(.+)$/); return m ? { vista: m[1], id: m[2] } : { vista: h, id: null }; }
  const tope = () => pila.length ? pila[pila.length - 1] : 'inicio';
  const urlDe = () => pila.length ? '#' + tope() : location.pathname + location.search;
  function estadoHist() { return { civizo: true, pila: pila.slice(), entradas }; }
  function capas() { return Array.from($('vista').children).filter(c => c.classList.contains('capa') && !c.classList.contains('saliendo')); }
  function capaActual() { const cs = capas(); return cs[cs.length - 1] || $('vista'); }
  function abrir(h) {
    h = limpiar(h);
    if (!h || h === 'inicio') return irInicio();
    if (modalEntrada) { ocultarModal(); modalEntrada = false; pila.push(h); history.replaceState(estadoHist(), '', urlDe()); return pintar('push'); }
    if (!$('modal').hidden) ocultarModal();
    if (h === tope()) return render();
    pila.push(h); entradas++;
    history.pushState(estadoHist(), '', urlDe());
    pintar('push');
  }
  function reemplazar(h) {
    h = limpiar(h);
    if (pila.length) pila[pila.length - 1] = h; else { pila.push(h); entradas++; }
    history.replaceState(estadoHist(), '', urlDe());
    pintar('reemplazo');
  }
  function atras() {
    if (!$('modal').hidden) return cerrarModal();
    if (!pila.length) return;
    if (entradas > 0) { history.back(); return; }
    pila.pop(); history.replaceState(estadoHist(), '', urlDe()); pintar('pop');
  }
  let volverAlInicio = false;
  function irInicio() {
    const extra = modalEntrada ? 1 : 0;
    if (!$('modal').hidden) { ocultarModal(); modalEntrada = false; }
    if (entradas + extra > 0) { volverAlInicio = true; history.go(-(entradas + extra)); }
    else { pila = []; history.replaceState(estadoHist(), '', urlDe()); pintar('pop'); }
  }
  window.addEventListener('popstate', ev => {
    const st = ev.state;
    if (!$('modal').hidden) { ocultarModal(); }
    modalEntrada = false;
    if (st && st.civizo && st.modal) { volviendo = true; history.back(); return; }   // adelante hacia un modal ya cerrado
    if (st && st.civizo) { pila = st.pila.slice(); entradas = st.entradas; }
    else { const h = limpiar(location.hash); pila = h && h !== 'inicio' ? [h] : []; entradas = 0; history.replaceState(estadoHist(), '', urlDe()); }
    if (volverAlInicio) { volverAlInicio = false; if (pila.length) { pila = []; entradas = 0; history.replaceState(estadoHist(), '', urlDe()); } }   // se entró por enlace directo
    pintar('pop');
    if (volviendo) { volviendo = false; trasVolver.splice(0).forEach(f => f()); }
  });
  const reducido = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function nuevaCapa(ruta) {
    const c = document.createElement('section');
    c.className = 'capa' + (ruta === 'inicio' ? ' capa-inicio' : '');
    c.dataset.ruta = ruta;
    c.tabIndex = -1;
    c.addEventListener('scroll', () => c.classList.toggle('compacta', c.scrollTop > 40), { passive: true });
    return c;
  }
  /** Ajusta las capas del DOM a la pila y pinta la de arriba. */
  function pintar(modo) {
    if (NUBE && !perfil) return;
    const v = $('vista');
    if (!v.querySelector(':scope > .capa-inicio')) { v.innerHTML = ''; v.appendChild(nuevaCapa('inicio')); }
    const rutas = ['inicio'].concat(pila);
    const cs = capas();
    let i = 1;
    while (i < cs.length && i < rutas.length && cs[i].dataset.ruta === rutas[i]) i++;
    cs.slice(i).forEach(c => {
      c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
      if (modo === 'pop' && !reducido()) { c.classList.add('saliendo'); c.setAttribute('inert', ''); setTimeout(() => c.remove(), 220); }
      else c.remove();
    });
    for (let k = i; k < rutas.length; k++) {
      const c = nuevaCapa(rutas[k]);
      if (k === rutas.length - 1 && (modo === 'push' || modo === 'reemplazo') && !reducido()) c.classList.add('entrando');
      v.appendChild(c);
    }
    const vivas = capas();
    vivas.forEach((c, k) => {
      const arriba = k === vivas.length - 1;
      if (arriba) { c.removeAttribute('inert'); c.removeAttribute('aria-hidden'); }
      else { c.setAttribute('inert', ''); c.setAttribute('aria-hidden', 'true'); c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); }
    });
    render();
    const top = capaActual();
    if (modo === 'push' || modo === 'reemplazo') { top.scrollTop = 0; top.focus({ preventScroll: true }); }
  }
  const NAV_ATRAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const NAV_INICIO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>';
  /** Pinta la capa de arriba conservando su posición de desplazamiento. */
  function render() {
    if (NUBE && !perfil) return;
    const c = capaActual();
    if (!c || !c.classList.contains('capa')) return pintar('reemplazo');
    const ruta = c.dataset.ruta, r = rutaDe(ruta);
    const vistas = { proveedores: vProveedores, proveedor: vProveedor, comparar: vComparar, cobranza: vCobranza, cobro: vCobro, sitio: vSitio, solicitudes: vSolicitudes, tablero: vTablero, insumos: vInsumos, insumo: vInsumo, precios: vPrecios, recetas: vRecetas, receta: vReceta, servicios: vServicios, servicio: vServicio, eventos: vEventos, evento: vEvento, compras: vCompras, ajustes: vAjustes, usuarios: vUsuarios, buscar: vBuscar };
    if (!esAdmin()) { delete vistas.ajustes; delete vistas.usuarios; delete vistas.sitio; }
    if (!NUBE) delete vistas.usuarios;
    ctx = { obj: null, recalcular: null, acciones: {} };
    const pos = c.scrollTop;
    if (r.vista === 'inicio') c.innerHTML = vInicio();
    else {
      const f = vistas[r.vista];
      const cuerpo = f ? f(r.id) : noEncontrado('Esta sección', null, 'Ir al inicio');
      c.innerHTML = '<header class="barra"><button type="button" class="barra-btn" data-nav="atras" aria-label="Regresar" title="Regresar">' + NAV_ATRAS + '</button><span class="barra-titulo"></span><div class="barra-acc"></div><button type="button" class="barra-btn" data-nav="inicio" aria-label="Ir al inicio" title="Inicio">' + NAV_INICIO + '</button></header><div class="contenido">' + cuerpo + '</div>';
      const acc = c.querySelector('.contenido > .cabecera > .acciones');
      if (acc) c.querySelector('.barra-acc').appendChild(acc);
      c.querySelectorAll('.barra-acc .btn').forEach(b => {
        Array.from(b.childNodes).forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) { const s = document.createElement('span'); s.className = 'btxt'; s.textContent = n.textContent; n.replaceWith(s); } });
        const t = b.textContent.trim(); if (t && !b.getAttribute('aria-label')) { b.setAttribute('aria-label', t); b.title = t; }
      });
      const h1 = c.querySelector('.contenido h1');
      c.querySelector('.barra-titulo').textContent = h1 ? h1.textContent : '';
    }
    if (ctx.alPintar) ctx.alPintar();
    if (!puedeEditar()) aplicarSoloLectura();
    c.scrollTop = pos;
    c.classList.toggle('compacta', c.scrollTop > 40);
    const t = r.vista === 'inicio' ? null : c.querySelector('.contenido h1');
    document.title = (t ? t.textContent + ' · ' : '') + 'CIVIZO Cocina';
  }
  /** Título de la barra y del documento cuando se edita el nombre en vivo. */
  function actualizarTitulo(txt) {
    const c = capaActual();
    const h1 = c.querySelector('.contenido h1'); if (h1) h1.textContent = txt;
    const bt = c.querySelector('.barra-titulo'); if (bt) bt.textContent = txt;
  }
  window.addEventListener('hashchange', () => {
    const h = limpiar(location.hash);
    if ((h || 'inicio') === tope()) return;
    pila = h && h !== 'inicio' ? [h] : []; entradas = 0;
    history.replaceState(estadoHist(), '', urlDe());
    pintar('reemplazo');
  });

  /* --------------------------------------------- Edición en línea genérica */
  function objetivo(el) {
    let o = ctx.obj;
    if (!o) return null;
    if (el.dataset.grupo) o = o[el.dataset.grupo];
    if (el.dataset.lista != null) o = (o[el.dataset.lista] || [])[+el.dataset.i];
    return o;
  }
  function manejarCampo(e, esChange) {
    const el = e.target;
    if (!el.dataset || el.dataset.campo == null) return;
    const discreto = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date' || el.type === 'time';
    if (discreto !== esChange) return;
    const obj = objetivo(el);
    if (!obj) return;
    const campo = el.dataset.campo;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.tipo === 'num') v = String(v).trim() === '' ? '' : C.num(v);
    if (el.dataset.arreglo) {
      const arr = obj[campo] = Array.isArray(obj[campo]) ? obj[campo] : [];
      const i = arr.indexOf(el.value);
      if (el.checked && i < 0) arr.push(el.value);
      if (!el.checked && i >= 0) arr.splice(i, 1);
    } else if (!(ctx.alCambiar && ctx.alCambiar(obj, campo, v, el) === true)) {
      obj[campo] = v;
    }
    if (ctx.obj && 'actualizado' in ctx.obj) ctx.obj.actualizado = D.ahora();
    guardar();
    if (el.dataset.rerender != null) { cambioEstructura(); render(); }
    else if (ctx.recalcular) ctx.recalcular();
  }
  const vista = $('vista');
  vista.addEventListener('input', e => manejarCampo(e, false));
  vista.addEventListener('change', e => manejarCampo(e, true));
  vista.addEventListener('click', e => {
    const a = e.target.closest('[data-accion]');
    if (a && vista.contains(a)) {
      const f = ctx.acciones[a.dataset.accion] || ACCIONES_GLOBALES[a.dataset.accion];
      if (f) { e.preventDefault(); f(a.dataset, a); }
      return;
    }
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); return nav.dataset.nav === 'inicio' ? irInicio() : atras(); }
    const enlace = e.target.closest('a[href^="#"]');
    if (enlace && vista.contains(enlace)) { e.preventDefault(); return abrir(enlace.getAttribute('href')); }
    const fila = e.target.closest('[data-ir]');
    if (fila && !e.target.closest('a, button, input, select, textarea')) abrir(fila.dataset.ir);
  });
  vista.addEventListener('keydown', e => {
    const fila = e.target.closest && e.target.closest('tr[data-ir], tr[data-accion]');
    if (fila && (e.key === 'Enter' || e.key === ' ') && e.target === fila) { e.preventDefault(); if (fila.dataset.ir) abrir(fila.dataset.ir); else fila.click(); }
  });

  /* ---------------------------------------------- Helpers de formularios */
  const atr = o => Object.keys(o).filter(k => o[k] != null && o[k] !== false).map(k => o[k] === true ? k : k + '="' + esc(o[k]) + '"').join(' ');
  function campoTexto(etq, campo, valor, extra) {
    extra = extra || {};
    const ctl = extra.area
      ? '<textarea ' + atr({ id: 'f-' + campo, 'data-campo': campo, 'data-grupo': extra.grupo, placeholder: extra.ph, rows: extra.filas }) + '>' + esc(valor) + '</textarea>'
      : '<input ' + atr({ type: extra.tipo || 'text', id: 'f-' + (extra.grupo ? extra.grupo + '-' : '') + campo, 'data-campo': campo, 'data-grupo': extra.grupo, value: valor ?? '', placeholder: extra.ph, list: extra.lista, inputmode: extra.num ? 'decimal' : null, 'data-tipo': extra.num ? 'num' : null, autocomplete: 'off' }) + '>';
    const inner = extra.suf ? '<div class="sufijo">' + ctl + '<i>' + extra.suf + '</i></div>' : ctl;
    return '<label class="campo' + (extra.ancho ? ' ancho' : '') + '"><span>' + etq + '</span>' + inner + (extra.ayuda ? '<small>' + extra.ayuda + '</small>' : '') + '</label>';
  }
  function campoSelect(etq, campo, valor, opciones, extra) {
    extra = extra || {};
    const ops = opciones.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(valor ?? '') ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
    return '<label class="campo' + (extra.ancho ? ' ancho' : '') + '"><span>' + etq + '</span><select ' + atr({ id: 'f-' + campo, 'data-campo': campo, 'data-grupo': extra.grupo, 'data-rerender': extra.rerender ? '' : null }) + '>' + ops + '</select>' + (extra.ayuda ? '<small>' + extra.ayuda + '</small>' : '') + '</label>';
  }
  const opcionesUnidad = (lista, sel) => lista.map(u => '<option value="' + u + '"' + (u === sel ? ' selected' : '') + '>' + esc(C.nombreUnidad(u)) + '</option>').join('');
  function celdaNum(lista, i, campo, valor, ph, cls) {
    return '<input ' + atr({ type: 'text', inputmode: 'decimal', class: cls, 'data-lista': lista, 'data-i': i, 'data-campo': campo, 'data-tipo': 'num', value: valor ?? '', placeholder: ph, 'aria-label': campo, autocomplete: 'off' }) + '>';
  }
  function celdaTexto(lista, i, campo, valor, ph, listaDatos) {
    return '<input ' + atr({ type: 'text', 'data-lista': lista, 'data-i': i, 'data-campo': campo, value: valor ?? '', placeholder: ph, list: listaDatos, 'aria-label': campo, autocomplete: 'off' }) + '>';
  }
  const pillEstatus = id => { const e = D.ESTATUS.find(x => x.id === id) || D.ESTATUS[0]; const cls = { borrador: '', enviada: 'info', aprobada: 'acento', realizado: 'ok', cancelada: 'error' }[e.id]; return '<span class="pill ' + cls + '">' + e.nombre + '</span>'; };
  const nombreLinea = id => (D.LINEAS.find(l => l.id === id) || { nombre: 'Sin línea' }).nombre;

  function medidorFoodCost(real, objetivo) {
    const max = Math.max(60, objetivo * 1.6, real * 1.1);
    const cls = real <= objetivo ? '' : real <= objetivo * 1.15 ? 'alerta' : 'error';
    return '<div class="medidor"><div class="medidor-barra"><i class="' + cls + '" style="width:' + Math.min(real / max * 100, 100).toFixed(1) + '%"></i><b style="left:' + (objetivo / max * 100).toFixed(1) + '%" title="Objetivo"></b></div>'
      + '<div class="medidor-txt"><span>Food cost real: <b>' + pct(real) + '</b></span><span>Objetivo ' + pct(objetivo) + '</span></div></div>';
  }

  /* ------------------------------------------------------ Usos y costos */
  function usosInsumo(id) {
    return {
      recetas: db.recetas.filter(r => r.ingredientes.some(l => l.tipo === 'insumo' && l.refId === id)),
      servicios: db.servicios.filter(s => s.componentes.some(c => c.tipo === 'insumo' && c.refId === id))
    };
  }
  function usosReceta(id) {
    return {
      recetas: db.recetas.filter(r => r.ingredientes.some(l => l.tipo === 'receta' && l.refId === id)),
      servicios: db.servicios.filter(s => s.componentes.some(c => c.tipo === 'receta' && c.refId === id)),
      eventos: db.eventos.filter(e => e.lineas.some(l => l.tipo === 'receta' && l.refId === id))
    };
  }
  const costoNetoTexto = ins => {
    const dim = C.dimension(ins.unidadCompra);
    const f = dim === 'pieza' ? 1 : 1000;
    return dinero(C.costoBaseNeto(ins) * f) + ' / ' + (dim === 'masa' ? 'kg' : dim === 'volumen' ? 'L' : 'pza');
  };
  const sortNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es');

  /* ================================================================ INICIO */
  function vTablero() {
    const p = db.parametros;
    const enCurso = db.eventos.filter(e => ['borrador', 'enviada', 'aprobada'].includes(e.estatus));
    const cot = e => C.cotizarEvento(e, IX);
    const montoCurso = enCurso.reduce((s, e) => s + cot(e).total, 0);
    const aprobados = db.eventos.filter(e => e.estatus === 'aprobada');
    const montoAprob = aprobados.reduce((s, e) => s + cot(e).total, 0);
    const bases = db.recetas.filter(r => usosReceta(r.id).recetas.length).length;
    const sinPrecio = db.insumos.filter(i => !(C.num(i.precio) > 0)).length;

    const proximos = db.eventos.filter(e => e.estatus !== 'cancelada' && e.estatus !== 'realizado').sort((a, b) => String(a.fecha || '9').localeCompare(String(b.fecha || '9'))).slice(0, 6);
    const filasProx = proximos.map(e => {
      const q = cot(e); const dd = diasHasta(e.fecha);
      return '<tr class="clic" tabindex="0" data-ir="#evento-' + e.id + '"><td>' + fechaCorta(e.fecha) + (dd != null && dd >= 0 && dd <= 14 ? '<br><span class="tenue">en ' + dd + ' día' + (dd === 1 ? '' : 's') + '</span>' : '') + '</td><td><b>' + esc(e.nombre || 'Sin nombre') + '</b><br><span class="tenue">' + esc(e.cliente || '') + '</span></td><td class="num">' + n0(q.personas) + '</td><td class="num">' + dinero(q.total) + '</td><td>' + pillEstatus(e.estatus) + '</td></tr>';
    }).join('');

    // Alertas
    const alertas = [];
    if (sinPrecio) alertas.push(['alerta', sinPrecio + ' insumo' + (sinPrecio > 1 ? 's' : '') + ' sin precio', '#insumos', 'Capturar']);
    const viejos = db.insumos.filter(i => i.actualizado && (Date.now() - new Date(i.actualizado)) > vigencia() * 864e5).length;
    if (viejos) alertas.push(['info', viejos + ' insumo' + (viejos > 1 ? 's' : '') + ' sin revisar precio en más de ' + vigencia() + ' días', '#precios', 'Actualizar']);
    db.recetas.forEach(r => {
      const c = C.costoReceta(r, IX);
      if (c.error) alertas.push(['error', esc(r.nombre) + ': ' + esc(c.error), '#receta-' + r.id, 'Corregir']);
      else if (C.num(r.precioVenta) > 0) {
        const fc = c.porPorcion / C.num(r.precioVenta) * 100, obj = C.num(r.foodCost) || p.foodCost;
        if (fc > obj) alertas.push(['alerta', esc(r.nombre) + ': food cost de ' + pct(fc) + ' (objetivo ' + pct(obj) + ')', '#receta-' + r.id, 'Ver']);
      }
    });
    db.eventos.filter(e => enCobranza(e) && e.estatus !== 'cancelada').forEach(e => { const k = cobDe(e); if (k.estado === 'vencido') alertas.push(['error', esc(e.nombre || e.folio) + ': ' + dinero(k.vencido) + ' vencido', '#cobro-' + e.id, 'Cobrar']); });
    db.eventos.filter(e => e.estatus === 'aprobada' && diasHasta(e.fecha) < 0).forEach(e => alertas.push(['info', esc(e.nombre) + ' ya pasó; márcalo como realizado', '#evento-' + e.id, 'Abrir']));

    const conteoLinea = id => db.servicios.filter(s => s.linea === id).length;
    const opcRecetas = db.recetas.slice().sort(sortNombre).map(r => '<option value="' + r.id + '">' + esc(r.nombre) + '</option>').join('');

    ctx.acciones = {
      escalaRapida: () => {
        const id = $('rapidaReceta').value, v = C.num($('rapidaPorc').value);
        if (!id) return aviso('Elige una receta', true);
        escalas[id] = { valor: v > 0 ? v : 100, modo: 'porc' };
        abrir('receta-' + id);
      }
    };

    return '<div class="cabecera"><div><span class="ceja">Tablero</span><h1>Tu cocina en números</h1><p class="sub">Costea tus servicios, estandariza recetas y cotiza eventos desde un mismo lugar.</p></div>'
      + '<div class="acciones"><button class="btn" data-accion="nuevaReceta">' + ico('mas') + 'Nueva receta</button><button class="btn primario" data-accion="nuevoEvento">' + ico('mas') + 'Nuevo evento</button></div></div>'
      + bannerEjemplo()
      + '<div class="metricas">'
      + '<div class="metrica destacada"><span class="et">Cotizado en curso</span><span class="val">' + dinero(montoCurso) + '</span><span class="det">' + enCurso.length + ' evento' + (enCurso.length === 1 ? '' : 's') + ' abiertos</span></div>'
      + '<div class="metrica"><span class="et">Aprobado por realizar</span><span class="val">' + dinero(montoAprob) + '</span><span class="det">' + aprobados.length + ' evento' + (aprobados.length === 1 ? '' : 's') + '</span></div>'
      + '<div class="metrica"><span class="et">Recetas estandarizadas</span><span class="val">' + db.recetas.length + '</span><span class="det">' + bases + ' usadas como base de otras</span></div>'
      + '<div class="metrica"><span class="et">Insumos</span><span class="val">' + db.insumos.length + '</span><span class="det">' + (sinPrecio ? sinPrecio + ' sin precio' : 'todos con precio') + '</span></div>'
      + '</div>'
      + '<div class="rejilla r-lateral">'
      + '<section class="panel"><div class="panel-cab"><h2>Próximos eventos</h2><a class="btn chico" href="#eventos">Ver todos</a></div>'
      + (filasProx ? '<div class="tabla-env"><table><thead><tr><th>Fecha</th><th>Evento</th><th class="num">Personas</th><th class="num">Total</th><th>Estatus</th></tr></thead><tbody>' + filasProx + '</tbody></table></div>'
        : '<div class="vacio"><h3>Sin eventos por ahora</h3><p>Cotiza tu primer evento en minutos con los servicios que ya tienes.</p><button class="btn primario" data-accion="nuevoEvento">' + ico('mas') + 'Nuevo evento</button></div>')
      + '</section>'
      + '<div class="rejilla">'
      + '<section class="escalador"><h2>' + ico('escalar', 'ico-escala') + 'Escalar una receta</h2><p class="tenue">Calcula cantidades y costo para 1, 100 o 1,000 porciones.</p>'
      + (db.recetas.length ? '<label class="campo"><span class="etq">Receta</span><select id="rapidaReceta">' + opcRecetas + '</select></label><label class="campo"><span class="etq">Porciones</span><input id="rapidaPorc" type="text" inputmode="decimal" value="100"></label><button class="btn primario" data-accion="escalaRapida">Calcular</button>'
        : '<p>Primero crea una receta.</p>')
      + '</section>'
      + '<section class="panel"><div class="panel-cab"><h2>Pendientes</h2>' + (alertas.length ? '<span class="pill alerta">' + alertas.length + '</span>' : '') + '</div>'
      + (alertas.length ? '<ul class="lista-alertas">' + alertas.slice(0, 8).map(a => '<li><span><span class="pill ' + a[0] + '">●</span> ' + a[1] + '</span><a class="btn chico" href="' + a[2] + '">' + a[3] + '</a></li>').join('') + '</ul>' : '<p><span class="pill ok">Todo en orden</span> Precios capturados y recetas sin errores.</p>')
      + '</section></div></div>'
      + '<section class="panel"><div class="panel-cab"><h2>Líneas de servicio</h2><p>Tu catálogo por línea de negocio</p></div><div class="lineas-resumen">'
      + D.LINEAS.map(l => '<a href="#servicios" data-accion="verLinea" data-linea="' + l.id + '">' + ico(l.id) + '<b>' + l.nombre + '</b><span>' + conteoLinea(l.id) + ' servicio' + (conteoLinea(l.id) === 1 ? '' : 's') + '</span></a>').join('')
      + '</div></section>';
  }
  function bannerEjemplo() {
    if (!D.hayEjemplos(db)) return '';
    return '<div class="nota acento"><div><b>Estás viendo datos de ejemplo.</b> Sirven para conocer la plataforma: insumos con precios de referencia, recetas, servicios y un evento. Puedes editarlos o borrarlos cuando quieras empezar con lo tuyo. <button class="btn chico" data-accion="quitarEjemplos" style="margin-left:6px">Borrar datos de ejemplo</button></div></div>';
  }

  /* ================================================================ INSUMOS */
  function vInsumos() {
    const f = filtros.insumos;
    const cats = Array.from(new Set(D.CATEGORIAS_INSUMO.concat(db.insumos.map(i => i.categoria).filter(Boolean))));
    const q = f.q.toLowerCase();
    const lista = db.insumos.filter(i => (!f.cat || i.categoria === f.cat) && (!q || (i.nombre + ' ' + (i.proveedor || '')).toLowerCase().includes(q))).sort((a, b) => String(a.categoria).localeCompare(String(b.categoria), 'es') || sortNombre(a, b));
    const filas = lista.map(i => {
      const nc = (i.cotizaciones || []).length;
      return '<tr class="clic" tabindex="0" data-ir="#insumo-' + i.id + '"><td><b>' + esc(i.nombre) + '</b><br><span class="tenue">' + esc(i.categoria || 'Sin categoría') + (i.proveedor ? ' · ' + esc(i.proveedor) : '') + '</span></td>'
        + '<td class="num">' + (C.num(i.precio) > 0 ? dinero(i.precio) : '—') + '<br><span class="tenue">' + C.fmtCant(i.presentacion) + ' ' + esc(C.nombreUnidad(i.unidadCompra)) + '</span></td>'
        + '<td class="num"><b>' + costoNetoTexto(i) + '</b>' + (C.num(i.rendimiento) > 0 && C.num(i.rendimiento) < 100 ? '<br><span class="tenue">rinde ' + C.num(i.rendimiento) + ' %</span>' : '') + '</td>'
        + '<td class="num">' + (nc ? nc : '<span class="tenue">—</span>') + '</td><td>' + pillEdad(i) + '</td></tr>';
    }).join('');

    ctx.acciones = {
      importarCSV: () => elegirArchivo('.csv,text/csv', importarInsumosCSV),
      irPrecios: () => abrir('precios'),
      importarFactura: () => importarFactura(),
      exportarCSV: () => descargar('insumos-civizo.csv', csv([['nombre', 'categoria', 'precio', 'presentacion', 'unidad', 'rendimiento', 'proveedor']].concat(db.insumos.slice().sort(sortNombre).map(i => [i.nombre, i.categoria, i.precio, i.presentacion, i.unidadCompra, i.rendimiento, i.proveedor]))), 'text/csv')
    };
    ctx.alPintar = () => {
      $('fq').addEventListener('input', e => { f.q = e.target.value; refrescarLista(); });
      $('fcat').addEventListener('change', e => { f.cat = e.target.value; refrescarLista(); });
    };
    const refrescarLista = () => { const pos = $('fq').selectionStart; render(); $('fq').focus(); try { $('fq').setSelectionRange(pos, pos); } catch (e) { /* */ } };

    return '<div class="cabecera"><div><span class="ceja">Catálogo</span><h1>Insumos</h1><p class="sub">Todo lo que compras, con su presentación, precio y merma. El costo neto ya descuenta lo que se pierde al limpiar y porcionar.</p></div>'
      + '<div class="acciones"><button class="btn primario" data-accion="irPrecios">' + ico('etiqueta') + 'Actualizar precios</button><button class="btn" data-accion="importarFactura">' + ico('facturacion') + 'Importar factura</button><button class="btn" data-accion="importarCSV">' + ico('subir') + 'Importar CSV</button><button class="btn" data-accion="exportarCSV">' + ico('bajar') + 'Exportar</button><button class="btn" data-accion="nuevoInsumo">' + ico('mas') + 'Nuevo insumo</button></div></div>'
      + '<section class="panel"><div class="filtros"><input type="search" id="fq" placeholder="Buscar insumo o proveedor" value="' + esc(f.q) + '" aria-label="Buscar"><select id="fcat" aria-label="Categoría"><option value="">Todas las categorías</option>' + cats.map(c => '<option' + (c === f.cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></div>'
      + (lista.length ? '<div class="tabla-env"><table><thead><tr><th>Insumo</th><th class="num">Precio</th><th class="num">Costo aprovechable</th><th class="num">Cotizaciones</th><th>Revisado</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
        : '<div class="vacio"><h3>' + (db.insumos.length ? 'Ningún insumo coincide' : 'Aún no hay insumos') + '</h3><p>Da de alta lo que compras: arroz por kilo, aceite por litro, tortillas por kilo, desechables por paquete.</p><button class="btn primario" data-accion="nuevoInsumo">' + ico('mas') + 'Nuevo insumo</button></div>')
      + '<p class="tenue">Tip: el rendimiento es la parte aprovechable. Si de 1 kg de cebolla te quedan 850 g limpios, el rendimiento es 85 %.</p></section>';
  }

  function formInsumo(ins) {
    const cats = Array.from(new Set(D.CATEGORIAS_INSUMO.concat(db.insumos.map(i => i.categoria).filter(Boolean))));
    const u = Object.keys(C.UNIDADES);
    return '<div class="campos">'
      + '<label class="campo ancho"><span>Nombre</span><input id="mi-nombre" type="text" value="' + esc(ins.nombre) + '" placeholder="Ej. Pechuga de pollo sin hueso" autocomplete="off"></label>'
      + '<label class="campo"><span>Categoría</span><input id="mi-cat" type="text" list="dl-cats" value="' + esc(ins.categoria) + '" autocomplete="off"><datalist id="dl-cats">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label>'
      + '<label class="campo"><span>Dónde se cotizó</span><input id="mi-prov" type="text" list="dl-fuentes" value="' + esc(ins.proveedor) + '" placeholder="Walmart, Central de Abastos…" autocomplete="off">' + datalistFuentes() + '</label>'
      + '<label class="campo"><span>Presentación de compra</span><div class="compuesto"><input id="mi-pres" type="text" inputmode="decimal" value="' + esc(ins.presentacion) + '" placeholder="1"><select id="mi-uni">' + opcionesUnidad(u, ins.unidadCompra) + '</select></div><small>Ej. 1 kg, 20 L, paquete de 50 pza</small></label>'
      + '<label class="campo"><span>Precio de esa presentación</span><div class="sufijo"><input id="mi-precio" type="text" inputmode="decimal" value="' + esc(ins.precio) + '" placeholder="0.00"><i>MXN</i></div></label>'
      + '<label class="campo"><span>Rendimiento</span><div class="sufijo"><input id="mi-rend" type="text" inputmode="decimal" value="' + esc(ins.rendimiento) + '" placeholder="100"><i>%</i></div><small>Parte aprovechable después de limpiar</small></label>'
      + '</div><div class="nota" id="mi-calc"></div><div id="mi-aviso"></div>';
  }
  function abrirInsumo(id, alGuardar) {
    if (id) return abrir('insumo-' + id);
    const existente = id ? IX.insumos.get(id) : null;
    const ins = existente ? copia(existente) : { nombre: '', categoria: '', proveedor: '', presentacion: 1, unidadCompra: 'kg', precio: '', rendimiento: 100 };
    const usos = existente ? usosInsumo(id) : { recetas: [], servicios: [] };
    const leer = cuerpo => ({
      nombre: cuerpo.querySelector('#mi-nombre').value.trim(), categoria: cuerpo.querySelector('#mi-cat').value.trim(), proveedor: cuerpo.querySelector('#mi-prov').value.trim(),
      presentacion: C.num(cuerpo.querySelector('#mi-pres').value), unidadCompra: cuerpo.querySelector('#mi-uni').value,
      precio: C.num(cuerpo.querySelector('#mi-precio').value), rendimiento: C.num(cuerpo.querySelector('#mi-rend').value) || 100
    });
    const botones = [];
    const soloVer = !puedeEditar();
    if (existente && !soloVer) botones.push({ texto: ico('borrar') + 'Eliminar', clase: 'peligro izq', accion: () => { eliminarInsumo(id); } });
    botones.push({ texto: 'Cancelar', clase: 'fantasma' });
    botones.push({
      texto: existente ? 'Guardar cambios' : 'Agregar insumo', clase: 'primario', accion: cuerpo => {
        const v = leer(cuerpo);
        if (!v.nombre) { aviso('Escribe el nombre del insumo', true); return false; }
        if (!(v.presentacion > 0)) { aviso('La presentación debe ser mayor a cero', true); return false; }
        if (v.rendimiento > 100) { aviso('El rendimiento no puede pasar de 100 %', true); return false; }
        if (existente) {
          const cambioDim = C.dimension(existente.unidadCompra) !== C.dimension(v.unidadCompra);
          Object.assign(existente, v, { actualizado: D.ahora() });
          if (cambioDim) aviso('Cambiaste el tipo de unidad: revisa las recetas que lo usan');
          else aviso('Insumo actualizado');
          cambioEstructura();
          render();
          if (alGuardar) alGuardar(existente);
        } else {
          const nuevo = Object.assign({ id: 'ins-' + D.uid(), actualizado: D.ahora(), cotizaciones: [], historial: v.precio > 0 ? [{ fecha: D.ahora(), precio: v.precio, presentacion: v.presentacion, unidadCompra: v.unidadCompra, fuente: v.proveedor }] : [] }, v);
          if (v.precio > 0 && v.proveedor) nuevo.cotizaciones.push({ id: D.uid(), fuente: v.proveedor, precio: v.precio, presentacion: v.presentacion, unidad: v.unidadCompra, fecha: D.ahora() });
          db.insumos.push(nuevo);
          cambioEstructura();
          aviso('Insumo agregado');
          if (alGuardar) alGuardar(nuevo); else render();
        }
      }
    });
    abrirModal({
      titulo: soloVer ? 'Insumo' : existente ? 'Editar insumo' : 'Nuevo insumo', cuerpo: formInsumo(ins), botones: soloVer ? [{ texto: 'Cerrar', clase: 'primario' }] : botones,
      alAbrir: cuerpo => {
        if (soloVer) cuerpo.querySelectorAll('input, select').forEach(x => { x.disabled = true; });
        const calc = () => {
          const v = leer(cuerpo);
          const dim = C.dimension(v.unidadCompra), f = dim === 'pieza' ? 1 : 1000, un = dim === 'masa' ? 'kg' : dim === 'volumen' ? 'L' : 'pza';
          const bruto = C.costoBaseCompra(v) * f, neto = C.costoBaseNeto(v) * f;
          cuerpo.querySelector('#mi-calc').innerHTML = v.presentacion > 0
            ? 'Costo de compra: <b>' + dinero(bruto) + ' / ' + un + '</b> · Costo neto aprovechable: <b>' + dinero(neto) + ' / ' + un + '</b>'
            : 'Captura la presentación para calcular el costo.';
          const msj = existente && (usos.recetas.length || usos.servicios.length) && C.dimension(existente.unidadCompra) !== dim
            ? '<div class="nota alerta">Este insumo se usa en ' + (usos.recetas.length + usos.servicios.length) + ' receta(s)/servicio(s) medido en ' + C.DIM_NOMBRE[C.dimension(existente.unidadCompra)] + '. Si cambias a ' + C.DIM_NOMBRE[dim] + ' tendrás que corregir esas cantidades.</div>' : '';
          cuerpo.querySelector('#mi-aviso').innerHTML = msj;
        };
        cuerpo.addEventListener('input', calc); cuerpo.addEventListener('change', calc); calc();
      }
    });
  }
  function eliminarInsumo(id) {
    const u = usosInsumo(id);
    if (u.recetas.length || u.servicios.length) {
      setTimeout(() => abrirModal({ titulo: 'No se puede eliminar', compacto: true, cuerpo: '<p>Este insumo se usa en:</p><ul>' + u.recetas.map(r => '<li>Receta: ' + esc(r.nombre) + '</li>').join('') + u.servicios.map(s => '<li>Servicio: ' + esc(s.nombre) + '</li>').join('') + '</ul><p>Quítalo de ahí primero o reemplázalo por otro insumo.</p>', botones: [{ texto: 'Entendido', clase: 'primario' }] }), 0);
      return;
    }
    db.insumos = db.insumos.filter(i => i.id !== id);
    cambioEstructura(); render(); aviso('Insumo eliminado');
  }

  /* ================================================================ PRECIOS REFERENCIADOS
     Cada insumo guarda varias cotizaciones (tienda, precio, presentación,
     fecha, enlace) y un historial de su precio de costeo. Nada externo cambia
     el costo sin que alguien lo confirme. */
  const FUENTES = ['Walmart', 'Bodega Aurrerá', 'Soriana', 'HEB', 'Chedraui', 'La Comer', 'Costco', "Sam's Club", 'City Club', 'Central de Abastos', 'Mercado local', 'Proveedor'];
  const unBase = dim => dim === 'masa' ? 'kg' : dim === 'volumen' ? 'L' : 'pza';
  const factorBase = dim => dim === 'pieza' ? 1 : 1000;
  function costoPorUnidad(precio, presentacion, unidad) { const b = C.aBase(presentacion, unidad); return b > 0 ? C.num(precio) / b * factorBase(C.dimension(unidad)) : 0; }
  const diasDesde = iso => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso)) / 864e5)) : null;
  const vigencia = () => C.num(db.parametros.diasVigencia) || 30;
  const vencido = i => !(C.num(i.precio) > 0) || (diasDesde(i.actualizado) ?? 999) > vigencia();
  function textoEdad(iso) { const d = diasDesde(iso); return d == null ? '—' : d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : 'Hace ' + d + ' días'; }
  function pillEdad(i) {
    if (!(C.num(i.precio) > 0)) return '<span class="pill alerta">Sin precio</span>';
    return '<span class="pill ' + ((diasDesde(i.actualizado) ?? 999) > vigencia() ? 'alerta' : '') + '">' + textoEdad(i.actualizado) + '</span>';
  }
  const datalistFuentes = () => '<datalist id="dl-fuentes">' + Array.from(new Set((db.proveedores || []).map(p => p.nombre).filter(Boolean).concat(FUENTES).concat(db.insumos.map(i => i.proveedor).filter(Boolean)))).map(f => '<option value="' + esc(f) + '">').join('') + '</datalist>';

  /** Cambia el precio de costeo y lo anota en el historial (agrupa capturas seguidas). */
  function registrarPrecio(ins, v, fuente) {
    ins.historial = Array.isArray(ins.historial) ? ins.historial : [];
    const nuevo = { precio: C.num(v.precio), presentacion: C.num(v.presentacion) || C.num(ins.presentacion) || 1, unidadCompra: v.unidadCompra || ins.unidadCompra };
    const igual = C.num(ins.precio) === nuevo.precio && C.num(ins.presentacion) === nuevo.presentacion && ins.unidadCompra === nuevo.unidadCompra;
    if (!ins.historial.length && C.num(ins.precio) > 0 && !igual) ins.historial.push({ fecha: ins.actualizado || D.ahora(), precio: C.num(ins.precio), presentacion: C.num(ins.presentacion), unidadCompra: ins.unidadCompra, fuente: ins.proveedor || '' });
    Object.assign(ins, nuevo, { actualizado: D.ahora() });
    if (fuente != null && fuente !== '') ins.proveedor = fuente;
    const entrada = { fecha: ins.actualizado, precio: ins.precio, presentacion: ins.presentacion, unidadCompra: ins.unidadCompra, fuente: ins.proveedor || '' };
    const ult = ins.historial[ins.historial.length - 1];
    if (ult && (Date.now() - new Date(ult.fecha)) < 3 * 60000 && ult.fuente === entrada.fuente) Object.assign(ult, entrada);   // misma captura
    else if (!igual || !ult) ins.historial.push(entrada);
    else ult.confirmado = ins.actualizado;
    if (ins.historial.length > 80) ins.historial = ins.historial.slice(-80);
  }
  /** Agrega o actualiza la cotización de una tienda. */
  function guardarCotizacion(ins, q) {
    ins.cotizaciones = Array.isArray(ins.cotizaciones) ? ins.cotizaciones : [];
    const ex = ins.cotizaciones.find(c => norm(c.fuente) === norm(q.fuente) && C.num(c.presentacion) === C.num(q.presentacion) && c.unidad === q.unidad);
    const datos = { fuente: q.fuente, precio: C.num(q.precio), presentacion: C.num(q.presentacion), unidad: q.unidad, fecha: q.fecha || D.ahora() };
    if (q.enlace) datos.enlace = q.enlace;
    if (q.nota) datos.nota = q.nota;
    if (ex) Object.assign(ex, datos); else ins.cotizaciones.push(Object.assign({ id: D.uid() }, datos));
  }
  function grafica(hist) {
    const pts = hist.map(h => ({ t: new Date(h.fecha).getTime(), v: costoPorUnidad(h.precio, h.presentacion, h.unidadCompra) })).filter(p => p.v > 0);
    if (pts.length < 2) return '<p class="tenue">La gráfica aparece cuando el precio cambie al menos una vez.</p>';
    const W = 320, H = 96, P = 8;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const vs = pts.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs), rango = mx - mn || mx * .1 || 1;
    const x = t => P + (t1 === t0 ? (W - 2 * P) / 2 : (t - t0) / (t1 - t0) * (W - 2 * P));
    const y = v => H - P - (v - (mn - rango * .15)) / (rango * 1.3) * (H - 2 * P);
    const linea = pts.map(p => x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');
    const ult = pts[pts.length - 1];
    return '<svg class="grafica" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolución del costo"><polygon points="' + x(t0).toFixed(1) + ',' + (H - P) + ' ' + linea + ' ' + x(ult.t).toFixed(1) + ',' + (H - P) + '" class="g-area"/><polyline points="' + linea + '" class="g-linea"/><circle cx="' + x(ult.t).toFixed(1) + '" cy="' + y(ult.v).toFixed(1) + '" r="4" class="g-punto"/></svg>'
      + '<div class="medidor-txt"><span>Mín. ' + dinero(mn) + '</span><span>Máx. ' + dinero(mx) + '</span></div>';
  }

  /* ---------------------------------------------------------------- Insumo (pantalla) */
  function vInsumo(id) {
    const ins = IX.insumos.get(id);
    if (!ins) return noEncontrado('El insumo');
    ctx.obj = ins;
    ins.cotizaciones = ins.cotizaciones || []; ins.historial = ins.historial || [];
    const dim = C.dimension(ins.unidadCompra), un = unBase(dim);
    const cats = Array.from(new Set(D.CATEGORIAS_INSUMO.concat(db.insumos.map(i => i.categoria).filter(Boolean))));
    const usos = usosInsumo(ins.id);
    const usado = usos.recetas.length + usos.servicios.length;
    const cots = ins.cotizaciones.map(c => Object.assign({ porU: costoPorUnidad(c.precio, c.presentacion, c.unidad), compatible: C.dimension(c.unidad) === dim }, c));
    const validas = cots.filter(c => c.compatible && c.porU > 0);
    const minimo = validas.length ? Math.min(...validas.map(c => c.porU)) : 0;
    const filasCot = cots.sort((a, b) => (a.compatible ? a.porU : 1e12) - (b.compatible ? b.porU : 1e12)).map(c => {
      const actual = norm(c.fuente) === norm(ins.proveedor) && C.num(c.precio) === C.num(ins.precio) && C.num(c.presentacion) === C.num(ins.presentacion) && c.unidad === ins.unidadCompra;
      return '<tr><td><b>' + esc(c.fuente) + '</b>' + (c.porU === minimo && validas.length > 1 ? ' <span class="pill ok">Más barato</span>' : '') + (actual ? ' <span class="pill acento">En costeo</span>' : '') + '<br><span class="tenue">' + textoEdad(c.fecha) + (c.nota ? ' · ' + esc(c.nota) : '') + '</span></td>'
        + '<td class="num">' + dinero(c.precio) + '<br><span class="tenue">' + C.fmtCant(c.presentacion) + ' ' + esc(C.nombreUnidad(c.unidad)) + '</span></td>'
        + '<td class="num"><b>' + (c.compatible ? dinero(c.porU) + ' / ' + un : '<span class="pill error">Otra unidad</span>') + '</b></td>'
        + '<td class="acc">' + (c.enlace ? '<a class="icono-btn ir" href="' + esc(c.enlace) + '" target="_blank" rel="noopener" aria-label="Abrir en la tienda" title="Abrir en la tienda">' + ico('externo') + '</a>' : '')
        + (actual || !c.compatible ? '' : '<button class="btn chico" data-accion="usarCot" data-cid="' + c.id + '">Usar</button>')
        + '<button class="icono-btn" data-accion="quitarCot" data-cid="' + c.id + '" aria-label="Quitar cotización">✕</button></td></tr>';
    }).join('');
    const hist = ins.historial.slice().reverse().slice(0, 12).map((h, k, arr) => {
      const v = costoPorUnidad(h.precio, h.presentacion, h.unidadCompra), prev = arr[k + 1] ? costoPorUnidad(arr[k + 1].precio, arr[k + 1].presentacion, arr[k + 1].unidadCompra) : 0;
      const varp = prev > 0 ? (v - prev) / prev * 100 : null;
      return '<div class="fila"><span>' + fechaCorta(h.fecha) + '<br><span class="tenue">' + esc(h.fuente || '—') + '</span></span><span>' + dinero(v) + ' / ' + esc(unBase(C.dimension(h.unidadCompra))) + (varp != null && Math.abs(varp) >= .05 ? '<br><span class="tenue" style="color:var(--' + (varp > 0 ? 'error' : 'ok') + ')">' + (varp > 0 ? '+' : '') + varp.toFixed(1) + ' %</span>' : '') + '</span></div>';
    }).join('');

    ctx.alCambiar = (obj, campo, v) => {
      if (campo === 'precio' || campo === 'presentacion' || campo === 'unidadCompra') {
        registrarPrecio(ins, { precio: campo === 'precio' ? v : ins.precio, presentacion: campo === 'presentacion' ? v : ins.presentacion, unidadCompra: campo === 'unidadCompra' ? v : ins.unidadCompra }, ins.proveedor);
        return true;
      }
      return false;
    };
    ctx.alPintar = () => {
      const c = capaActual(), calc = () => {
        const pr = C.num(c.querySelector('#q-precio').value), pz = C.num(c.querySelector('#q-pres').value), u = c.querySelector('#q-uni').value;
        c.querySelector('#q-calc').textContent = pr > 0 && pz > 0 ? '= ' + dinero(costoPorUnidad(pr, pz, u)) + ' por ' + unBase(C.dimension(u)) + ' (' + dinero(pr) + ' por ' + C.fmtCant(pz) + ' ' + C.nombreUnidad(u) + ')' : '';
      };
      ['#q-precio', '#q-pres', '#q-uni'].forEach(sel => { const el = c.querySelector(sel); if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); } });
      calc();
    };
    ctx.recalcular = () => {
      $('costoCompra').textContent = dinero(C.costoBaseCompra(ins) * factorBase(C.dimension(ins.unidadCompra)));
      $('costoNeto').textContent = dinero(C.costoBaseNeto(ins) * factorBase(C.dimension(ins.unidadCompra)));
      $('edadPrecio').innerHTML = pillEdad(ins);
      actualizarTitulo(ins.nombre || 'Insumo');
    };
    ctx.acciones = {
      agregarCot: () => {
        const c = capaActual();
        const q = { fuente: c.querySelector('#q-fuente').value.trim(), precio: C.num(c.querySelector('#q-precio').value), presentacion: C.num(c.querySelector('#q-pres').value), unidad: c.querySelector('#q-uni').value, enlace: c.querySelector('#q-enlace').value.trim() };
        if (!q.fuente) return aviso('Escribe la tienda o el proveedor', true);
        if (!(q.precio > 0)) return aviso('Escribe el precio', true);
        if (!(q.presentacion > 0)) return aviso('Escribe la presentación', true);
        if (C.dimension(q.unidad) !== C.dimension(ins.unidadCompra) && usado) return aviso('Este insumo se usa en recetas medido en ' + C.DIM_NOMBRE[C.dimension(ins.unidadCompra)] + '; usa una unidad de ' + C.DIM_NOMBRE[C.dimension(ins.unidadCompra)], true);
        guardarCotizacion(ins, q);
        if (c.querySelector('#q-usar').checked) registrarPrecio(ins, { precio: q.precio, presentacion: q.presentacion, unidadCompra: q.unidad }, q.fuente);
        if (q.enlace && !ins.enlace) ins.enlace = q.enlace;
        cambioEstructura(); render(); aviso('Cotización guardada');
      },
      usarCot: d => { const q = ins.cotizaciones.find(c => c.id === d.cid); if (!q) return; registrarPrecio(ins, { precio: q.precio, presentacion: q.presentacion, unidadCompra: q.unidad }, q.fuente); if (q.enlace) ins.enlace = q.enlace; cambioEstructura(); render(); aviso('Precio de costeo: ' + q.fuente); },
      quitarCot: d => { ins.cotizaciones = ins.cotizaciones.filter(c => c.id !== d.cid); guardar(true); render(); },
      confirmarPrecio: () => { registrarPrecio(ins, ins, ins.proveedor); guardar(true); render(); aviso('Precio confirmado hoy'); },
      eliminar: () => {
        if (usado) return abrirModal({ titulo: 'No se puede eliminar', compacto: true, cuerpo: '<p>Este insumo se usa en:</p><ul>' + usos.recetas.map(r => '<li>Receta: ' + esc(r.nombre) + '</li>').join('') + usos.servicios.map(s => '<li>Servicio: ' + esc(s.nombre) + '</li>').join('') + '</ul>', botones: [{ texto: 'Entendido', clase: 'primario' }] });
        confirmar('Eliminar insumo', '¿Eliminar <b>' + esc(ins.nombre) + '</b>?', 'Eliminar', () => { db.insumos = db.insumos.filter(x => x.id !== ins.id); cambioEstructura(); atras(); aviso('Insumo eliminado'); });
      }
    };
    return '<div class="cabecera"><div><span class="ceja">Insumo · ' + esc(ins.categoria || 'Sin categoría') + '</span><h1>' + esc(ins.nombre || 'Insumo') + '</h1></div>'
      + '<div class="acciones">' + (ins.enlace ? '<a class="btn" href="' + esc(ins.enlace) + '" target="_blank" rel="noopener">' + ico('externo') + 'Ver en tienda</a>' : '') + '<button class="btn" data-accion="confirmarPrecio">' + ico('check') + 'Confirmar precio</button><button class="btn peligro" data-accion="eliminar">' + ico('borrar') + 'Eliminar</button></div></div>'
      + '<div class="rejilla r-lateral"><div class="rejilla">'
      + '<section class="panel"><div class="panel-cab"><h2>Precio de costeo</h2><span id="edadPrecio">' + pillEdad(ins) + '</span></div>'
      + '<div class="caja-doble"><div><span class="et">Costo de compra / ' + un + '</span><b id="costoCompra">' + dinero(C.costoBaseCompra(ins) * factorBase(dim)) + '</b></div><div class="acento"><span class="et">Costo aprovechable / ' + un + '</span><b id="costoNeto">' + dinero(C.costoBaseNeto(ins) * factorBase(dim)) + '</b></div></div>'
      + '<div class="campos">'
      + campoTexto('Precio', 'precio', ins.precio, { num: true, suf: 'MXN' })
      + '<label class="campo"><span>Presentación</span><div class="compuesto"><input type="text" inputmode="decimal" id="f-presentacion" data-campo="presentacion" data-tipo="num" value="' + esc(ins.presentacion) + '"><select data-campo="unidadCompra" data-rerender aria-label="Unidad de compra">' + opcionesUnidad(usado ? C.unidadesDe(dim) : Object.keys(C.UNIDADES), ins.unidadCompra) + '</select></div></label>'
      + campoTexto('Rendimiento', 'rendimiento', ins.rendimiento, { num: true, suf: '%', ayuda: 'Parte aprovechable después de limpiar' })
      + campoTexto('Dónde se cotizó', 'proveedor', ins.proveedor, { lista: 'dl-fuentes', ph: 'Walmart, Central de Abastos…' })
      + campoTexto('Enlace al producto', 'enlace', ins.enlace, { ancho: true, ph: 'https://super.walmart.com.mx/…', ayuda: 'Para abrir la tienda y revisar el precio con un toque' })
      + '</div>' + datalistFuentes() + '</section>'
      + '<section class="panel"><div class="panel-cab"><div><h2>Cotizaciones</h2><p>Compara tiendas. "Usar" pasa ese precio al costeo.</p></div></div>'
      + (filasCot ? '<div class="tabla-env"><table><thead><tr><th>Dónde</th><th class="num">Precio</th><th class="num">Por ' + un + '</th><th></th></tr></thead><tbody>' + filasCot + '</tbody></table></div>' : '<p class="tenue">Aún no hay cotizaciones. Agrega el precio de dos o tres tiendas para comparar.</p>')
      + '<div class="campos agregar-cot"><label class="campo"><span>Tienda o proveedor</span><input type="text" id="q-fuente" list="dl-fuentes" autocomplete="off" placeholder="Walmart"></label>'
      + '<label class="campo"><span>Precio</span><div class="sufijo"><input type="text" id="q-precio" inputmode="decimal" placeholder="0.00"><i>MXN</i></div></label>'
      + '<label class="campo"><span>Presentación</span><div class="compuesto"><input type="text" id="q-pres" inputmode="decimal" value="' + esc(ins.presentacion || 1) + '"><select id="q-uni" aria-label="Unidad">' + opcionesUnidad(usado ? C.unidadesDe(dim) : Object.keys(C.UNIDADES), ins.unidadCompra) + '</select></div></label>'
      + '<label class="campo ancho"><span>Enlace (opcional)</span><input type="text" id="q-enlace" placeholder="https://…" autocomplete="off"></label>'
      + '<p class="tenue ancho" id="q-calc" aria-live="polite"></p>'
      + '<label class="check"><input type="checkbox" id="q-usar"' + (C.num(ins.precio) > 0 ? '' : ' checked') + '> Usar como precio de costeo</label>'
      + '<div class="acciones"><button class="btn primario" data-accion="agregarCot">' + ico('mas') + 'Guardar cotización</button></div></div></section>'
      + '<section class="panel"><h2>Datos</h2><div class="campos">' + campoTexto('Nombre', 'nombre', ins.nombre, { ancho: true })
      + '<label class="campo"><span>Categoría</span><input type="text" id="f-categoria" data-campo="categoria" list="dl-cats" value="' + esc(ins.categoria) + '" autocomplete="off"><datalist id="dl-cats">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label></div></section>'
      + '</div><aside class="pegajoso rejilla"><section class="panel"><h2>Historial del costo</h2>' + grafica(ins.historial) + (hist ? '<div class="resumen">' + hist + '</div>' : '<p class="tenue">Cada cambio de precio queda registrado aquí con su fecha y su fuente.</p>') + '</section>'
      + '<section class="panel"><h2>Se usa en</h2>' + (usado ? '<div class="chips-sel">' + usos.recetas.map(r => '<a class="pill" href="#receta-' + r.id + '">' + esc(r.nombre) + '</a>').join('') + usos.servicios.map(s => '<a class="pill info" href="#servicio-' + s.id + '">' + esc(s.nombre) + '</a>').join('') + '</div>' : '<p class="tenue">Todavía no está en ninguna receta ni servicio.</p>') + '</section></aside></div>';
  }

  /* ---------------------------------------------------------------- Actualizar precios */
  const estadoPrecios = { modo: '', q: '' };
  function vPrecios() {
    const e = estadoPrecios;
    const nVenc = db.insumos.filter(vencido).length, nSin = db.insumos.filter(i => !(C.num(i.precio) > 0)).length;
    if (!e.modo) e.modo = nVenc ? 'vencidos' : 'todos';
    const q = norm(e.q);
    const lista = db.insumos.filter(i => (e.modo === 'todos' || (e.modo === 'vencidos' ? vencido(i) : !(C.num(i.precio) > 0))) && (!q || norm(i.nombre + ' ' + (i.proveedor || '')).includes(q)))
      .sort((a, b) => (C.num(a.precio) > 0) - (C.num(b.precio) > 0) || String(a.actualizado || '').localeCompare(String(b.actualizado || '')) || sortNombre(a, b));
    const fila = i => '<div class="precio-fila" data-id="' + i.id + '"><div class="pf-info"><b>' + esc(i.nombre) + '</b><span class="tenue pf-actual">' + resumenPrecio(i) + '</span></div>'
      + '<div class="pf-edad">' + pillEdad(i) + '</div>'
      + '<div class="pf-captura"><input type="text" class="pf-fuente" list="dl-fuentes" value="' + esc(i.proveedor || '') + '" placeholder="Tienda" aria-label="Tienda de ' + esc(i.nombre) + '" autocomplete="off">'
      + '<div class="sufijo"><input type="text" class="pf-precio" inputmode="decimal" placeholder="' + (C.num(i.precio) > 0 ? C.num(i.precio).toFixed(2) : 'Precio') + '" aria-label="Precio de ' + esc(i.nombre) + '" autocomplete="off"><i>/' + C.fmtCant(i.presentacion) + ' ' + esc(C.nombreUnidad(i.unidadCompra)) + '</i></div>'
      + (i.enlace ? '<a class="icono-btn ir" href="' + esc(i.enlace) + '" target="_blank" rel="noopener" aria-label="Abrir en la tienda" title="Abrir en la tienda">' + ico('externo') + '</a>' : '<span class="pf-hueco"></span>')
      + '<button type="button" class="btn chico primario" data-accion="guardarPrecio" data-id="' + i.id + '" aria-label="Guardar precio de ' + esc(i.nombre) + '" title="Guardar (Enter). Vacío = confirmar el actual">' + ico('check') + '</button></div></div>';
    const guardarFila = el => {
      const id = el.dataset.id, ins = IX.insumos.get(id); if (!ins) return;
      const precio = C.num(el.querySelector('.pf-precio').value), fuente = el.querySelector('.pf-fuente').value.trim();
      if (!(precio > 0) && !(C.num(ins.precio) > 0)) { aviso('Escribe el precio de ' + ins.nombre, true); el.querySelector('.pf-precio').focus(); return; }
      const v = { precio: precio > 0 ? precio : ins.precio, presentacion: ins.presentacion, unidadCompra: ins.unidadCompra };
      registrarPrecio(ins, v, fuente || ins.proveedor);
      if (fuente) guardarCotizacion(ins, { fuente, precio: v.precio, presentacion: v.presentacion, unidad: v.unidadCompra });
      guardar(true);
      el.querySelector('.pf-actual').innerHTML = resumenPrecio(ins);
      el.querySelector('.pf-edad').innerHTML = pillEdad(ins);
      el.querySelector('.pf-precio').value = ''; el.querySelector('.pf-precio').placeholder = C.num(ins.precio).toFixed(2);
      el.classList.add('hecho');
      const sig = el.nextElementSibling && el.nextElementSibling.querySelector('.pf-precio');
      if (sig) sig.focus(); else el.querySelector('.pf-precio').blur();
      const pend = db.insumos.filter(vencido).length;
      const m = capaActual().querySelector('#nVencidos'); if (m) m.textContent = pend;
    };
    ctx.acciones = {
      guardarPrecio: (d, b) => guardarFila(b.closest('.precio-fila')),
      modoPrecios: d => { e.modo = d.modo; render(); },
      importarFactura: () => importarFactura()
    };
    ctx.alPintar = () => {
      const c = capaActual();
      c.querySelectorAll('.pf-precio, .pf-fuente').forEach(inp => inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); guardarFila(inp.closest('.precio-fila')); } }));
      const b = $('fqp'); b.addEventListener('input', () => { e.q = b.value; const p = b.selectionStart; render(); const nb = $('fqp'); nb.focus(); try { nb.setSelectionRange(p, p); } catch (er) { /* */ } });
    };
    return '<div class="cabecera"><div><span class="ceja">Insumos</span><h1>Actualizar precios</h1></div><div class="acciones"><button class="btn" data-accion="importarFactura">' + ico('facturacion') + 'Importar factura</button></div></div>'
      + '<div class="metricas"><div class="metrica destacada"><span class="et">Por actualizar</span><span class="val" id="nVencidos">' + nVenc + '</span><span class="det">más de ' + vigencia() + ' días o sin precio</span></div><div class="metrica"><span class="et">Sin precio</span><span class="val">' + nSin + '</span><span class="det">no se pueden costear</span></div><div class="metrica"><span class="et">Insumos</span><span class="val">' + db.insumos.length + '</span><span class="det">en el catálogo</span></div><div class="metrica"><span class="et">Vigencia</span><span class="val">' + vigencia() + ' días</span><span class="det">se cambia en Ajustes</span></div></div>'
      + '<div class="nota">Abre la tienda en otra pestaña, escribe el precio y presiona <b>Enter</b>: se guarda y pasa al siguiente. Con el precio vacío, Enter confirma que el actual sigue vigente.</div>'
      + '<div class="pestanas">' + [['vencidos', 'Por actualizar'], ['sin', 'Sin precio'], ['todos', 'Todos']].map(m => '<button class="' + (e.modo === m[0] ? 'activa' : '') + '" data-accion="modoPrecios" data-modo="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>'
      + '<div class="filtros"><input type="search" id="fqp" placeholder="Buscar insumo o tienda" value="' + esc(e.q) + '" aria-label="Buscar insumo"></div>'
      + (lista.length ? '<section class="panel lista-precios">' + lista.map(fila).join('') + '</section>' : '<div class="vacio"><h3>' + (e.modo === 'vencidos' ? 'Todo al día' : 'Nada que mostrar') + '</h3><p>' + (e.modo === 'vencidos' ? 'Todos los precios se revisaron en los últimos ' + vigencia() + ' días.' : 'Ningún insumo coincide.') + '</p></div>')
      + datalistFuentes();
  }
  function resumenPrecio(i) { return C.num(i.precio) > 0 ? dinero(i.precio) + ' · ' + C.fmtCant(i.presentacion) + ' ' + esc(C.nombreUnidad(i.unidadCompra)) + (i.proveedor ? ' · ' + esc(i.proveedor) : '') : 'Sin precio'; }

  /* ---------------------------------------------------------------- Facturas (CFDI) */
  const UNIDAD_SAT = { KGM: [1, 'kg'], GRM: [1, 'g'], LTR: [1, 'l'], MLT: [1, 'ml'], H87: [1, 'pza'], EA: [1, 'pza'], XUN: [1, 'pza'], C62: [1, 'pza'], XPK: [1, 'pza'], XBX: [1, 'pza'], LBR: [1, 'lb'], ONZ: [1, 'oz'], DZN: [1, 'docena'] };
  function leerCFDI(txt) {
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo no es un XML válido');
    const uno = n => doc.getElementsByTagNameNS('*', n)[0];
    const comp = uno('Comprobante');
    if (!comp) throw new Error('El archivo no parece una factura electrónica (CFDI)');
    const em = uno('Emisor');
    const conceptos = Array.from(doc.getElementsByTagNameNS('*', 'Concepto')).map(c => {
      const a = n => c.getAttribute(n) || '';
      const imp = Array.from(c.getElementsByTagNameNS('*', 'Traslado')).reduce((s, t) => s + C.num(t.getAttribute('Importe')), 0);
      return { clave: a('NoIdentificacion'), desc: a('Descripcion'), cantidad: C.num(a('Cantidad')) || 1, claveUnidad: a('ClaveUnidad'), unidadTxt: a('Unidad') || a('ClaveUnidad'), valorUnitario: C.num(a('ValorUnitario')), importe: C.num(a('Importe')), descuento: C.num(a('Descuento')), impuestos: imp };
    });
    return { emisor: { nombre: em ? em.getAttribute('Nombre') || '' : '', rfc: em ? em.getAttribute('Rfc') || '' : '' }, fecha: (comp.getAttribute('Fecha') || '').slice(0, 10), folio: (comp.getAttribute('Serie') || '') + (comp.getAttribute('Folio') || ''), conceptos };
  }
  function sugerirInsumo(desc) {
    const tok = s => norm(s).split(/[^a-z0-9ñ]+/).filter(w => w.length > 3);
    const td = new Set(tok(desc));
    let mejor = null, puntos = 0;
    db.insumos.forEach(i => { const ti = tok(i.nombre); if (!ti.length) return; const p = ti.filter(w => td.has(w)).length / ti.length; if (p > puntos) { puntos = p; mejor = i; } });
    return puntos >= .5 ? mejor : null;
  }
  function importarFactura() { elegirArchivo('.xml,text/xml,application/xml', txt => { try { abrirFactura(leerCFDI(txt)); } catch (er) { aviso(er.message, true); } }); }
  function abrirFactura(f) {
    if (!f.conceptos.length) return aviso('La factura no tiene conceptos', true);
    const fuente = f.emisor.nombre || f.emisor.rfc || 'Proveedor';
    const filas = f.conceptos.map((c, k) => {
      const llave = norm(f.emisor.rfc + '|' + (c.clave || c.desc));
      let ins = null, pres = null;
      db.insumos.some(i => (i.aliasFactura || []).some(a => { if (a.llave === llave) { ins = i; pres = a; return true; } return false; }));
      if (!ins) ins = sugerirInsumo(c.desc);
      const sat = ['XPK', 'XBX'].includes(c.claveUnidad) && ins ? null : UNIDAD_SAT[c.claveUnidad];   // paquete o caja: usa la presentación del insumo
      const cant = pres ? pres.presentacion : sat && (!ins || C.dimension(sat[1]) === C.dimension(ins.unidadCompra)) ? sat[0] : ins ? ins.presentacion : 1;
      const uni = pres ? pres.unidad : sat && (!ins || C.dimension(sat[1]) === C.dimension(ins.unidadCompra)) ? sat[1] : ins ? ins.unidadCompra : 'pza';
      return { k, c, llave, ins: ins ? ins.id : '', cant, uni, recordado: !!pres };
    });
    const opciones = sel => '<option value="">No importar</option><option value="nuevo"' + (sel === 'nuevo' ? ' selected' : '') + '>+ Crear insumo nuevo</option>' + db.insumos.slice().sort(sortNombre).map(i => '<option value="' + i.id + '"' + (i.id === sel ? ' selected' : '') + '>' + esc(i.nombre) + '</option>').join('');
    const precioDe = (c, conImp) => (c.importe - c.descuento + (conImp ? c.impuestos : 0)) / (c.cantidad || 1);
    const cuerpo = '<div class="caja-doble"><div><span class="et">Proveedor</span><b style="font-size:1rem">' + esc(fuente) + '</b><span class="tenue">' + esc(f.emisor.rfc) + '</span></div><div><span class="et">Factura</span><b style="font-size:1rem">' + esc(f.folio || '—') + '</b><span class="tenue">' + fechaCorta(f.fecha) + ' · ' + f.conceptos.length + ' conceptos</span></div></div>'
      + '<label class="check"><input type="checkbox" id="fx-imp" checked> Sumar impuestos de la factura (IVA, IEPS) al costo</label>'
      + '<div class="tabla-env"><table class="editable"><thead><tr><th>Concepto de la factura</th><th>Insumo</th><th>1 unidad equivale a</th><th class="num">Precio</th><th>Costeo</th></tr></thead><tbody>'
      + filas.map(r => '<tr data-k="' + r.k + '"><td><b>' + esc(r.c.desc) + '</b><br><span class="tenue">' + C.fmtCant(r.c.cantidad) + ' ' + esc(r.c.unidadTxt) + ' × ' + dinero(r.c.valorUnitario) + (r.recordado ? ' · <span class="pill ok">Recordado</span>' : '') + '</span></td>'
        + '<td><select class="fx-ins" aria-label="Insumo">' + opciones(r.ins) + '</select></td>'
        + '<td style="width:190px"><div class="compuesto"><input type="text" class="fx-cant" inputmode="decimal" value="' + esc(r.cant) + '" aria-label="Cantidad"><select class="fx-uni" aria-label="Unidad">' + opcionesUnidad(Object.keys(C.UNIDADES), r.uni) + '</select></div></td>'
        + '<td class="num fx-precio">' + dinero(precioDe(r.c, true)) + '</td>'
        + '<td><label class="check"><input type="checkbox" class="fx-usar" checked> Usar</label></td></tr>').join('')
      + '</tbody></table></div><p class="tenue">La primera vez liga cada concepto con tu insumo. La plataforma lo recuerda para las siguientes facturas de este proveedor. Cada precio queda como cotización y, si marcas "Usar", pasa al costeo.</p>';
    abrirModal({
      titulo: 'Importar factura', ancho: true, cuerpo,
      alAbrir: c => {
        const pintarPrecios = () => { const ci = c.querySelector('#fx-imp').checked; c.querySelectorAll('tr[data-k]').forEach(tr => { tr.querySelector('.fx-precio').textContent = dinero(precioDe(filas[+tr.dataset.k].c, ci)); }); };
        c.querySelector('#fx-imp').addEventListener('change', pintarPrecios);
        c.querySelectorAll('.fx-ins').forEach(s => s.addEventListener('change', () => { const ins = IX.insumos.get(s.value); const tr = s.closest('tr'); if (ins && C.dimension(tr.querySelector('.fx-uni').value) !== C.dimension(ins.unidadCompra)) { tr.querySelector('.fx-uni').value = ins.unidadCompra; tr.querySelector('.fx-cant').value = ins.presentacion; } }));
      },
      botones: [{ texto: 'Cancelar', clase: 'fantasma' }, {
        texto: 'Aplicar precios', clase: 'primario', accion: c => {
          const conImp = c.querySelector('#fx-imp').checked;
          let n = 0, nuevos = 0; const errores = [];
          c.querySelectorAll('tr[data-k]').forEach(tr => {
            const r = filas[+tr.dataset.k], sel = tr.querySelector('.fx-ins').value;
            if (!sel) return;
            const cant = C.num(tr.querySelector('.fx-cant').value), uni = tr.querySelector('.fx-uni').value, precio = precioDe(r.c, conImp);
            if (!(cant > 0) || !(precio > 0)) { errores.push(r.c.desc); return; }
            let ins = IX.insumos.get(sel);
            if (sel === 'nuevo') {
              const nombre = r.c.desc.charAt(0).toUpperCase() + r.c.desc.slice(1).toLowerCase();
              ins = { id: 'ins-' + D.uid(), nombre, categoria: 'Otros', presentacion: cant, unidadCompra: uni, precio: 0, rendimiento: 100, proveedor: fuente, actualizado: D.ahora(), cotizaciones: [], historial: [] };
              db.insumos.push(ins); nuevos++;
            }
            if (!ins) return;
            if (C.dimension(uni) !== C.dimension(ins.unidadCompra) && usosInsumo(ins.id).recetas.length) { errores.push(r.c.desc + ' (otra unidad)'); return; }
            guardarCotizacion(ins, { fuente, precio, presentacion: cant, unidad: uni, fecha: f.fecha ? f.fecha + 'T12:00:00' : D.ahora(), nota: 'Factura ' + (f.folio || '') });
            if (tr.querySelector('.fx-usar').checked || sel === 'nuevo') registrarPrecio(ins, { precio, presentacion: cant, unidadCompra: uni }, fuente);
            ins.aliasFactura = (ins.aliasFactura || []).filter(a => a.llave !== r.llave).concat({ llave: r.llave, presentacion: cant, unidad: uni });
            n++;
          });
          cambioEstructura(); render();
          aviso(n + ' precio' + (n === 1 ? '' : 's') + ' importado' + (n === 1 ? '' : 's') + (nuevos ? ', ' + nuevos + ' insumo' + (nuevos === 1 ? '' : 's') + ' nuevo' + (nuevos === 1 ? '' : 's') : '') + (errores.length ? '. Revisa: ' + errores.join(', ') : ''), !!errores.length);
        }
      }]
    });
  }

  /* ================================================================ RECETAS */
  function vRecetas() {
    const f = filtros.recetas;
    const q = f.q.toLowerCase();
    const cats = Array.from(new Set(D.CATEGORIAS_RECETA.concat(db.recetas.map(r => r.categoria).filter(Boolean))));
    const lista = db.recetas.filter(r => (!f.cat || r.categoria === f.cat) && (!q || (r.nombre + ' ' + r.codigo).toLowerCase().includes(q)) && (!f.tipo || (f.tipo === 'base' ? C.rendimientoBase(r) : !C.rendimientoBase(r)))).sort(sortNombre);
    const tarjetas = lista.map(r => {
      const c = C.costoReceta(r, IX);
      const pv = C.num(r.precioVenta), obj = C.num(r.foodCost) || db.parametros.foodCost;
      const fc = pv > 0 ? c.porPorcion / pv * 100 : null;
      const rb = C.rendimientoBase(r);
      return '<a class="tarjeta" href="#receta-' + r.id + '"><div class="tarjeta-cab"><span class="codigo">' + esc(r.codigo) + '</span><span class="pill">' + esc(r.categoria || 'Sin categoría') + '</span></div>'
        + '<h3>' + esc(r.nombre || 'Receta sin nombre') + '</h3><span class="meta">' + C.porcionesReceta(r) + ' porciones' + (r.porcionTexto ? ' · ' + esc(r.porcionTexto) : '') + (rb ? ' · rinde ' + C.fmtLegible(rb.base, rb.dim) : '') + '</span>'
        + (c.error ? '<span class="pill error">' + esc(c.error) + '</span>' : '')
        + '<div class="cifras"><div><b>' + dinero(c.porPorcion) + '</b><span>por porción</span></div><div><b>' + dinero(c.total) + '</b><span>receta base</span></div>'
        + (fc != null ? '<div><b><span class="pill ' + (fc <= obj ? 'ok' : 'alerta') + '">' + pct(fc) + '</span></b><span>food cost</span></div>' : '') + '</div></a>';
    }).join('');
    ctx.alPintar = () => {
      $('fq').addEventListener('input', e => { f.q = e.target.value; const p = e.target.selectionStart; render(); $('fq').focus(); try { $('fq').setSelectionRange(p, p); } catch (er) { /* */ } });
      $('fcat').addEventListener('change', e => { f.cat = e.target.value; render(); });
      $('ftipo').addEventListener('change', e => { f.tipo = e.target.value; render(); });
    };
    return '<div class="cabecera"><div><span class="ceja">Recetario</span><h1>Recetas estandarizadas</h1><p class="sub">Cada receta queda documentada con cantidades netas, costo y procedimiento, lista para producirse para 1 o para 1,000.</p></div>'
      + '<div class="acciones"><button class="btn primario" data-accion="nuevaReceta">' + ico('mas') + 'Nueva receta</button></div></div>'
      + '<div class="filtros"><input type="search" id="fq" placeholder="Buscar por nombre o código" value="' + esc(f.q) + '" aria-label="Buscar receta"><select id="fcat" aria-label="Categoría"><option value="">Todas las categorías</option>' + cats.map(c => '<option' + (c === f.cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>'
      + '<select id="ftipo" aria-label="Tipo"><option value="">Todas</option><option value="base"' + (f.tipo === 'base' ? ' selected' : '') + '>Bases (con rendimiento)</option><option value="plato"' + (f.tipo === 'plato' ? ' selected' : '') + '>Platillos</option></select></div>'
      + (lista.length ? '<div class="tarjetas">' + tarjetas + '</div>' : '<div class="vacio"><h3>' + (db.recetas.length ? 'Ninguna receta coincide' : 'Tu recetario está vacío') + '</h3><p>Captura los ingredientes una vez y la plataforma calcula costo, precio sugerido y cantidades para cualquier volumen.</p><button class="btn primario" data-accion="nuevaReceta">' + ico('mas') + 'Nueva receta</button></div>');
  }

  function nuevaReceta() {
    const r = {
      id: 'rec-' + D.uid(), codigo: D.siguienteCodigoReceta(db), nombre: '', categoria: 'Plato fuerte', porciones: 10, porcionTexto: '',
      rendimientoCantidad: '', rendimientoUnidad: '', tiempoPrep: '', tiempoCoccion: '', precioVenta: '', foodCost: db.parametros.foodCost,
      alergenos: [], ingredientes: [], procedimiento: '', notas: '', creado: D.ahora(), actualizado: D.ahora()
    };
    db.recetas.push(r); cambioEstructura(); abrir('receta-' + r.id);
    setTimeout(() => { const n = $('f-nombre'); if (n) n.focus(); }, 50);
  }

  function opcionesIngrediente(linea, recId) {
    const sel = linea.refId ? linea.tipo + ':' + linea.refId : '';
    let h = '<option value="">Elige insumo o receta base…</option>';
    const porCat = {};
    db.insumos.slice().sort(sortNombre).forEach(i => { (porCat[i.categoria || 'Otros'] = porCat[i.categoria || 'Otros'] || []).push(i); });
    Object.keys(porCat).sort((a, b) => a.localeCompare(b, 'es')).forEach(cat => {
      h += '<optgroup label="' + esc(cat) + '">' + porCat[cat].map(i => '<option value="insumo:' + i.id + '"' + (sel === 'insumo:' + i.id ? ' selected' : '') + '>' + esc(i.nombre) + '</option>').join('') + '</optgroup>';
    });
    const subs = db.recetas.filter(r => r.id !== recId && !C.creaCiclo(recId, r.id, IX)).sort(sortNombre);
    if (subs.length) h += '<optgroup label="Recetas base (sub-recetas)">' + subs.map(r => '<option value="receta:' + r.id + '"' + (sel === 'receta:' + r.id ? ' selected' : '') + '>' + esc(r.nombre) + '</option>').join('') + '</optgroup>';
    return h;
  }
  function unidadesLinea(l) {
    if (l.tipo === 'receta') { const r = IX.recetas.get(l.refId); return r ? C.unidadesSubreceta(r) : ['porc']; }
    const ins = IX.insumos.get(l.refId);
    return ins ? C.unidadesDe(C.dimension(ins.unidadCompra)) : Object.keys(C.UNIDADES);
  }
  function unidadDefault(l) {
    if (l.tipo === 'receta') { const r = IX.recetas.get(l.refId); const rb = r && C.rendimientoBase(r); return rb ? C.BASE[rb.dim] : 'porc'; }
    const ins = IX.insumos.get(l.refId); const dim = ins && C.dimension(ins.unidadCompra);
    return dim ? C.BASE[dim] : 'g';
  }
  /** Cambio de ingrediente en un select "tipo:id". Devuelve true si ya se aplicó. */
  function aplicarRef(l, v) {
    const [tipo, refId] = String(v).split(':');
    l.tipo = tipo || 'insumo'; l.refId = refId || '';
    if (!unidadesLinea(l).includes(l.unidad)) l.unidad = unidadDefault(l);
    return true;
  }

  function vReceta(id) {
    const r = IX.recetas.get(id);
    if (!r) return noEncontrado('La receta', '#recetas', 'Ver recetas');
    ctx.obj = r;
    const p = db.parametros;
    const cats = Array.from(new Set(D.CATEGORIAS_RECETA.concat(db.recetas.map(x => x.categoria).filter(Boolean))));
    const c = C.costoReceta(r, IX);
    const filas = r.ingredientes.map((l, i) => {
      const cl = c.lineas[i] || {};
      const uds = unidadesLinea(l);
      return '<tr class="' + (cl.error && l.refId ? 'fila-error' : '') + '"><td><select data-lista="ingredientes" data-i="' + i + '" data-campo="ref" data-rerender aria-label="Ingrediente">' + opcionesIngrediente(l, r.id) + '</select>' + (cl.error && l.refId ? '<span class="err-txt">' + esc(cl.error) + '</span>' : '') + '</td>'
        + '<td class="w-cant">' + celdaNum('ingredientes', i, 'cantidad', l.cantidad, '0') + '</td>'
        + '<td class="w-uni"><select data-lista="ingredientes" data-i="' + i + '" data-campo="unidad" data-rerender aria-label="Unidad">' + opcionesUnidad(uds, l.unidad) + '</select></td>'
        + '<td>' + celdaTexto('ingredientes', i, 'nota', l.nota, 'picado, sin hueso…') + '</td>'
        + '<td class="num" id="c-ing-' + i + '">' + dinero(cl.costo) + '</td>'
        + '<td class="acc"><button class="icono-btn" data-accion="quitarFila" data-lista="ingredientes" data-i="' + i + '" aria-label="Quitar ingrediente">✕</button></td></tr>';
    }).join('');
    const usos = usosReceta(r.id);
    const usadoEn = usos.recetas.map(x => '<a class="pill" href="#receta-' + x.id + '">' + esc(x.nombre) + '</a>').concat(usos.servicios.map(x => '<a class="pill info" href="#servicio-' + x.id + '">' + esc(x.nombre) + '</a>')).join(' ');
    const pasos = String(r.procedimiento || '').split('\n').map(s => s.trim()).filter(Boolean);

    ctx.alCambiar = (obj, campo, v) => { if (campo === 'ref') return aplicarRef(obj, v); if (campo === 'rendimientoUnidad' && !v) { obj.rendimientoCantidad = ''; } return false; };
    ctx.recalcular = () => recalcularReceta(r);
    ctx.alPintar = () => pintarEscalador(r);
    ctx.acciones = {
      agregarIngrediente: () => { r.ingredientes.push({ tipo: 'insumo', refId: '', cantidad: '', unidad: 'g', nota: '' }); guardar(); render(); const s = capaActual().querySelectorAll('[data-campo="ref"]'); if (s.length) s[s.length - 1].focus(); },
      nuevoInsumoAqui: () => abrirInsumo(null, ins => { r.ingredientes.push({ tipo: 'insumo', refId: ins.id, cantidad: '', unidad: C.BASE[C.dimension(ins.unidadCompra)], nota: '' }); cambioEstructura(); render(); }),
      quitarFila: d => { r.ingredientes.splice(+d.i, 1); r.actualizado = D.ahora(); cambioEstructura(); render(); },
      duplicar: () => { const n = copia(r); n.id = 'rec-' + D.uid(); n.codigo = D.siguienteCodigoReceta(db); n.nombre = (r.nombre || 'Receta') + ' (copia)'; n.creado = n.actualizado = D.ahora(); delete n.ejemplo; db.recetas.push(n); cambioEstructura(); aviso('Receta duplicada'); reemplazar('receta-' + n.id); },
      eliminar: () => {
        const u = usosReceta(r.id);
        if (u.recetas.length || u.servicios.length || u.eventos.length) return abrirModal({ titulo: 'No se puede eliminar', compacto: true, cuerpo: '<p>Esta receta se usa en:</p><ul>' + u.recetas.map(x => '<li>Receta: ' + esc(x.nombre) + '</li>').join('') + u.servicios.map(x => '<li>Servicio: ' + esc(x.nombre) + '</li>').join('') + u.eventos.map(x => '<li>Evento: ' + esc(x.nombre) + '</li>').join('') + '</ul>', botones: [{ texto: 'Entendido', clase: 'primario' }] });
        confirmar('Eliminar receta', '¿Eliminar <b>' + esc(r.nombre || 'esta receta') + '</b>? No se puede deshacer.', 'Eliminar', () => { db.recetas = db.recetas.filter(x => x.id !== r.id); cambioEstructura(); aviso('Receta eliminada'); atras(); });
      },
      ficha: () => imprimir(docFichaTecnica(r)),
      escalaAtajo: d => { estadoEscala(r).valor = +d.v; estadoEscala(r).modo = 'porc'; pintarEscalador(r); },
      ordenProduccion: () => imprimir(docOrdenProduccion(r, porcionesEscala(r))),
      compras: () => { const acc = C.explotarPorciones(r, porcionesEscala(r), IX); modalCompras('Lista de compras · ' + (r.nombre || 'Receta') + ' · ' + n0(porcionesEscala(r)) + ' porciones', acc, r.nombre); }
    };

    return '<div class="cabecera"><div><span class="ceja">Receta · ' + esc(r.codigo) + '</span><h1>' + esc(r.nombre || 'Nueva receta') + '</h1></div>'
      + '<div class="acciones"><button class="btn" data-accion="ficha">' + ico('imprimir') + 'Ficha técnica</button><button class="btn" data-accion="duplicar">' + ico('copiar') + 'Duplicar</button><button class="btn peligro" data-accion="eliminar">' + ico('borrar') + 'Eliminar</button></div></div>'
      + '<div class="rejilla r-lateral"><div class="rejilla">'
      + '<section class="panel"><div class="panel-cab"><h2>Datos de la receta</h2></div><div class="campos">'
      + campoTexto('Nombre', 'nombre', r.nombre, { ancho: true, ph: 'Ej. Pollo en salsa verde' })
      + campoSelect('Categoría', 'categoria', r.categoria, cats)
      + campoTexto('Porciones base', 'porciones', r.porciones, { num: true, ayuda: 'Para cuántas porciones están las cantidades' })
      + campoTexto('Tamaño de porción', 'porcionTexto', r.porcionTexto, { ph: 'Ej. 180 g' })
      + '<label class="campo"><span>Rendimiento total</span><div class="compuesto"><input type="text" inputmode="decimal" id="f-rendimientoCantidad" data-campo="rendimientoCantidad" data-tipo="num" value="' + esc(r.rendimientoCantidad) + '" placeholder="Opcional"><select data-campo="rendimientoUnidad" data-rerender aria-label="Unidad de rendimiento"><option value="">—</option>' + opcionesUnidad(['g', 'kg', 'ml', 'l', 'pza'], r.rendimientoUnidad) + '</select></div><small>Captúralo para usarla como base en otras recetas (ej. 1 L de salsa)</small></label>'
      + campoTexto('Preparación', 'tiempoPrep', r.tiempoPrep, { num: true, suf: 'min' })
      + campoTexto('Cocción', 'tiempoCoccion', r.tiempoCoccion, { num: true, suf: 'min' })
      + campoTexto('Precio de venta por porción', 'precioVenta', r.precioVenta, { num: true, suf: 'MXN', ayuda: 'Opcional, para medir el food cost' })
      + campoTexto('Food cost objetivo', 'foodCost', r.foodCost, { num: true, suf: '%' })
      + '</div></section>'
      + '<section class="panel"><div class="panel-cab"><div><h2>Ingredientes</h2><p>Cantidades netas (ya limpias) para ' + C.porcionesReceta(r) + ' porciones. La merma de cada insumo se suma al costo y a la lista de compras.</p></div></div>'
      + (r.ingredientes.length ? '<div class="tabla-env"><table class="editable"><thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Unidad</th><th>Nota</th><th class="num">Costo</th><th></th></tr></thead><tbody>' + filas + '</tbody>'
        + '<tfoot><tr><td colspan="4">Costo de la receta</td><td class="num" id="c-total">' + dinero(c.total) + '</td><td></td></tr></tfoot></table></div>' : '<div class="vacio"><p>Agrega el primer ingrediente. Puedes usar insumos o recetas base como una salsa o un fondo.</p></div>')
      + '<div class="acciones"><button class="btn" data-accion="agregarIngrediente">' + ico('mas') + 'Agregar ingrediente</button><button class="btn fantasma" data-accion="nuevoInsumoAqui">' + ico('mas') + 'Crear insumo nuevo</button></div></section>'
      + '<section class="panel"><div class="panel-cab"><h2>Costo y precio</h2></div><div id="resumenReceta">' + resumenReceta(r, c) + '</div></section>'
      + '<section class="panel"><div class="panel-cab"><h2>Procedimiento estandarizado</h2><p>Un paso por renglón</p></div>'
      + '<textarea id="f-procedimiento" data-campo="procedimiento" rows="7" placeholder="1. Lavar y desinfectar…">' + esc(r.procedimiento) + '</textarea>'
      + (pasos.length ? '<details><summary class="tenue">Vista previa de pasos</summary><ol class="pasos" id="pasos">' + pasos.map(s => '<li><span>' + esc(s) + '</span></li>').join('') + '</ol></details>' : '')
      + '<div class="campo"><span class="etq">Alérgenos</span><div class="chips-sel">' + D.ALERGENOS.map(a => '<label><input type="checkbox" data-campo="alergenos" data-arreglo="1" value="' + esc(a) + '"' + (r.alergenos.includes(a) ? ' checked' : '') + '>' + esc(a) + '</label>').join('') + '</div></div>'
      + campoTexto('Notas y puntos críticos', 'notas', r.notas, { area: true, filas: 3, ph: 'Temperaturas, montaje, vida de anaquel, equipo necesario…' })
      + (usadoEn ? '<div class="campo"><span class="etq">Se usa en</span><div class="chips-sel">' + usadoEn + '</div></div>' : '')
      + '</section></div>'
      + '<aside class="pegajoso"><section class="escalador" id="escalador"></section></aside></div>';
  }
  function resumenReceta(r, c) {
    const p = db.parametros;
    const obj = C.num(r.foodCost) || p.foodCost;
    const pv = C.num(r.precioVenta);
    const sug = C.precioPorFoodCost(c.porPorcion, obj);
    let h = '<div class="caja-doble"><div><span class="et">Costo por porción</span><b>' + dinero(c.porPorcion) + '</b></div><div class="acento"><span class="et">Precio sugerido</span><b>' + dinero(sug) + '</b></div></div>'
      + '<div class="resumen"><div class="fila"><span>Costo total de la receta (' + C.porcionesReceta(r) + ' porciones)</span><span>' + dinero(c.total) + '</span></div>'
      + '<div class="fila sub"><span>Precio sugerido con food cost de ' + pct(obj) + '</span><span>' + dinero(sug) + ' + IVA</span></div>';
    if (pv > 0) {
      const fc = c.porPorcion / pv * 100;
      h += '<div class="fila"><span>Precio de venta capturado</span><span>' + dinero(pv) + '</span></div><div class="fila"><span>Utilidad bruta por porción</span><span>' + dinero(pv - c.porPorcion) + '</span></div></div>' + medidorFoodCost(fc, obj);
    } else h += '</div>';
    if (c.error) h += '<div class="nota alerta"><b>Revisa:</b> ' + esc(c.error) + '</div>';
    return h;
  }
  function recalcularReceta(r) {
    const c = C.costoReceta(r, IX);
    c.lineas.forEach((l, i) => { const el = $('c-ing-' + i); if (el) el.textContent = dinero(l.costo); });
    if ($('c-total')) $('c-total').textContent = dinero(c.total);
    $('resumenReceta').innerHTML = resumenReceta(r, c);
    actualizarTitulo(r.nombre || 'Nueva receta');
    pintarEscalador(r);
  }

  function estadoEscala(r) { return escalas[r.id] || (escalas[r.id] = { valor: 100, modo: 'porc' }); }
  function porcionesEscala(r) {
    const e = estadoEscala(r);
    if (e.modo === 'porc') return C.num(e.valor);
    const rb = C.rendimientoBase(r);
    if (!rb || C.dimension(e.modo) !== rb.dim) return C.num(e.valor);
    return C.aBase(e.valor, e.modo) / rb.base * C.porcionesReceta(r);
  }
  function pintarEscalador(r) {
    const cont = $('escalador'); if (!cont) return;
    const e = estadoEscala(r);
    const rb = C.rendimientoBase(r);
    const modos = [['porc', 'porciones']].concat(rb ? C.unidadesDe(rb.dim).filter(u => ['g', 'kg', 'ml', 'l', 'pza'].includes(u)).map(u => [u, C.nombreUnidad(u)]) : []);
    if (!modos.some(m => m[0] === e.modo)) e.modo = 'porc';
    const porc = porcionesEscala(r);
    const esc2 = C.escalarReceta(r, porc, IX);
    const activo = document.activeElement && document.activeElement.id === 'escValor';
    const filas = esc2.filas.filter(f => f.refId).map(f => {
      const neta = f.dim ? C.fmtLegible(f.netaBase, f.dim) : C.fmtCant(f.cantidad) + ' porc.';
      const compra = f.tipo === 'receta' ? '<span class="tenue">preparar</span>' : (f.brutaBase != null ? C.fmtLegible(f.brutaBase, f.dim) : '—');
      return '<tr><td>' + esc(f.nombre) + '</td><td class="num"><b>' + neta + '</b></td><td class="num">' + compra + '</td></tr>';
    }).join('');
    const html = '<h2>' + ico('escalar') + 'Escalar receta</h2>'
      + '<div class="campo"><span class="etq">¿Cuánto necesitas producir?</span><div class="escala-grande"><input id="escValor" type="text" inputmode="decimal" value="' + esc(e.valor) + '" aria-label="Cantidad a producir"><select id="escModo" aria-label="Unidad">' + modos.map(m => '<option value="' + m[0] + '"' + (m[0] === e.modo ? ' selected' : '') + '>' + m[1] + '</option>').join('') + '</select></div></div>'
      + '<div class="atajos">' + [1, 10, 25, 50, 100, 250, 500, 1000].map(v => '<button type="button" data-accion="escalaAtajo" data-v="' + v + '" class="' + (e.modo === 'porc' && C.num(e.valor) === v ? 'activo' : '') + '">' + n0(v) + '</button>').join('') + '</div>'
      + '<div id="escCuerpo">' + cuerpoEscalador(r, porc, esc2, filas) + '</div>';
    if (activo) { $('escCuerpo').innerHTML = cuerpoEscalador(r, porc, esc2, filas); cont.querySelectorAll('.atajos button').forEach(b => b.classList.toggle('activo', e.modo === 'porc' && C.num(e.valor) === +b.dataset.v)); return; }
    cont.innerHTML = html;
    $('escValor').addEventListener('input', ev => { e.valor = ev.target.value; pintarEscalador(r); });
    $('escModo').addEventListener('change', ev => { e.modo = ev.target.value; pintarEscalador(r); });
  }
  function cuerpoEscalador(r, porc, esc2, filas) {
    return '<p class="factor">' + C.fmtCant(porc) + ' porciones · factor <b>×' + C.fmtCant(esc2.factor) + '</b> sobre la receta base de ' + C.porcionesReceta(r) + '</p>'
      + (filas ? '<div class="tabla-env"><table><thead><tr><th>Ingrediente</th><th class="num">Neto</th><th class="num">Comprar</th></tr></thead><tbody>' + filas + '</tbody></table></div>' : '<p class="tenue">Agrega ingredientes para ver las cantidades escaladas.</p>')
      + '<div class="caja-doble"><div><span class="et">Costo de producción</span><b>' + dinero(esc2.costoTotal) + '</b></div><div class="acento"><span class="et">Por porción</span><b>' + dinero(esc2.costoPorcion) + '</b></div></div>'
      + '<div class="acciones"><button class="btn primario" data-accion="ordenProduccion">' + ico('imprimir') + 'Orden de producción</button><button class="btn" data-accion="compras">' + ico('lista') + 'Lista de compras</button></div>';
  }

  /* ============================================================== SERVICIOS */
  function vServicios() {
    const f = filtros.servicios;
    const lineas = f.linea ? D.LINEAS.filter(l => l.id === f.linea) : D.LINEAS;
    const seccion = l => {
      const ss = db.servicios.filter(s => s.linea === l.id).sort(sortNombre);
      if (!ss.length && !f.linea) return '';
      return '<section class="rejilla"><div class="linea-serv">' + ico(l.id) + '<h2>' + l.nombre + '</h2><span class="tenue">' + ss.length + '</span></div>'
        + (ss.length ? '<div class="tarjetas">' + ss.map(tarjetaServicio).join('') + '</div>' : '<div class="vacio"><p>No hay servicios en esta línea.</p><button class="btn primario" data-accion="nuevoServicio" data-linea="' + l.id + '">' + ico('mas') + 'Agregar servicio</button></div>')
        + '</section>';
    };
    const sinLinea = db.servicios.filter(s => !D.LINEAS.some(l => l.id === s.linea));
    ctx.acciones = { filtrarLinea: d => { f.linea = d.linea || ''; render(); } };
    const contenido = lineas.map(seccion).join('') + (!f.linea && sinLinea.length ? '<section class="rejilla"><h2>Sin línea</h2><div class="tarjetas">' + sinLinea.map(tarjetaServicio).join('') + '</div></section>' : '');
    return '<div class="cabecera"><div><span class="ceja">Catálogo</span><h1>Servicios gastronómicos</h1><p class="sub">Todo lo que puedes ofrecer, costeado por persona a partir de tus recetas. Úsalos como bloques para cotizar eventos.</p></div>'
      + '<div class="acciones"><button class="btn primario" data-accion="nuevoServicio" data-linea="' + esc(f.linea) + '">' + ico('mas') + 'Nuevo servicio</button></div></div>'
      + '<div class="pestanas" role="tablist"><button class="' + (!f.linea ? 'activa' : '') + '" data-accion="filtrarLinea" data-linea="">Todas</button>' + D.LINEAS.map(l => '<button class="' + (f.linea === l.id ? 'activa' : '') + '" data-accion="filtrarLinea" data-linea="' + l.id + '">' + l.nombre + '</button>').join('') + '</div>'
      + (contenido || '<div class="vacio"><h3>Aún no hay servicios</h3><p>Un servicio es lo que vendes: un coffee break, una comida empresarial, un banquete. Se arma con recetas y se costea por persona.</p><button class="btn primario" data-accion="nuevoServicio">' + ico('mas') + 'Nuevo servicio</button></div>');
  }
  function tarjetaServicio(s) {
    const c = C.costoServicio(s, IX);
    return '<a class="tarjeta" href="#servicio-' + s.id + '"><h3>' + esc(s.nombre || 'Servicio sin nombre') + '</h3><span class="meta">' + esc(s.descripcion || (s.componentes.length + ' componentes')) + '</span>'
      + (c.error ? '<span class="pill error">' + esc(c.error) + '</span>' : '')
      + '<div class="cifras"><div><b>' + dinero(c.porPersona) + '</b><span>costo / persona</span></div><div><b>' + dinero(c.precioSugerido) + '</b><span>precio / persona</span></div><div><b>' + pct(s.margen) + '</b><span>margen</span></div></div></a>';
  }
  function nuevoServicio(linea) {
    const s = { id: 'srv-' + D.uid(), nombre: '', linea: linea || 'catering', descripcion: '', minimoPersonas: '', margen: db.parametros.margen, extraPorPersona: '', extraConcepto: '', componentes: [], creado: D.ahora(), actualizado: D.ahora() };
    db.servicios.push(s); cambioEstructura(); abrir('servicio-' + s.id);
    setTimeout(() => { const n = $('f-nombre'); if (n) n.focus(); }, 50);
  }
  const simuladores = {};
  function vServicio(id) {
    const s = IX.servicios.get(id);
    if (!s) return noEncontrado('El servicio', '#servicios', 'Ver servicios');
    ctx.obj = s;
    const c = C.costoServicio(s, IX);
    const filas = s.componentes.map((k, i) => {
      const cl = c.lineas[i] || {};
      let opciones, cantidad;
      if (k.tipo === 'receta') {
        opciones = '<option value="">Elige una receta…</option>' + db.recetas.slice().sort(sortNombre).map(r => '<option value="' + r.id + '"' + (r.id === k.refId ? ' selected' : '') + '>' + esc(r.nombre) + '</option>').join('');
        cantidad = '<div class="compuesto">' + celdaNum('componentes', i, 'porcionesPorPersona', k.porcionesPorPersona, '1') + '<span class="tenue" style="align-self:center">porc.</span></div>';
      } else {
        opciones = '<option value="">Elige un insumo…</option>' + db.insumos.slice().sort(sortNombre).map(x => '<option value="' + x.id + '"' + (x.id === k.refId ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('');
        const uds = unidadesLinea(k);
        cantidad = '<div class="compuesto">' + celdaNum('componentes', i, 'cantidad', k.cantidad, '0') + '<select data-lista="componentes" data-i="' + i + '" data-campo="unidad" data-rerender aria-label="Unidad">' + opcionesUnidad(uds, k.unidad) + '</select></div>';
      }
      return '<tr class="' + (cl.error && k.refId ? 'fila-error' : '') + '"><td><span class="pill ' + (k.tipo === 'receta' ? 'acento' : '') + '">' + (k.tipo === 'receta' ? 'Receta' : 'Insumo') + '</span></td>'
        + '<td><select data-lista="componentes" data-i="' + i + '" data-campo="refId" data-rerender aria-label="Elemento">' + opciones + '</select>' + (cl.error && k.refId ? '<span class="err-txt">' + esc(cl.error) + '</span>' : '') + '</td>'
        + '<td style="width:200px">' + cantidad + '</td><td class="num" id="c-comp-' + i + '">' + dinero(cl.costo) + '</td>'
        + '<td class="acc"><button class="icono-btn" data-accion="quitarFila" data-i="' + i + '" aria-label="Quitar">✕</button></td></tr>';
    }).join('');
    const sim = simuladores[s.id] || (simuladores[s.id] = { personas: C.num(s.minimoPersonas) || 100 });

    ctx.alCambiar = (obj, campo, v) => {
      if (campo === 'refId' && obj.tipo === 'insumo') { obj.refId = v; if (!unidadesLinea(obj).includes(obj.unidad)) obj.unidad = unidadDefault(obj); return true; }
      return false;
    };
    ctx.recalcular = () => {
      const c2 = C.costoServicio(s, IX);
      c2.lineas.forEach((l, i) => { const el = $('c-comp-' + i); if (el) el.textContent = dinero(l.costo); });
      if ($('c-srv')) $('c-srv').textContent = dinero(c2.porPersona);
      $('simServicio').innerHTML = cuerpoSimulador(s, sim);
      actualizarTitulo(s.nombre || 'Nuevo servicio');
    };
    ctx.alPintar = () => {
      $('simPersonas').addEventListener('input', e => { sim.personas = C.num(e.target.value); $('simServicio').innerHTML = cuerpoSimulador(s, sim); marcarAtajos(); });
      const marcarAtajos = () => capaActual().querySelectorAll('#simAtajos button').forEach(b => b.classList.toggle('activo', +b.dataset.v === sim.personas));
    };
    ctx.acciones = {
      agregarReceta: () => { s.componentes.push({ tipo: 'receta', refId: '', porcionesPorPersona: 1 }); guardar(); render(); },
      agregarInsumo: () => { s.componentes.push({ tipo: 'insumo', refId: '', cantidad: 1, unidad: 'pza' }); guardar(); render(); },
      quitarFila: d => { s.componentes.splice(+d.i, 1); cambioEstructura(); render(); },
      simAtajo: d => { sim.personas = +d.v; $('simPersonas').value = d.v; $('simServicio').innerHTML = cuerpoSimulador(s, sim); capaActual().querySelectorAll('#simAtajos button').forEach(b => b.classList.toggle('activo', +b.dataset.v === sim.personas)); },
      compras: () => modalCompras('Lista de compras · ' + (s.nombre || 'Servicio') + ' · ' + n0(sim.personas) + ' personas', C.explotarServicio(s, sim.personas, IX), s.nombre),
      crearEvento: () => nuevoEvento({ personas: sim.personas, lineas: [{ tipo: 'servicio', refId: s.id, cantidad: '' }], nombre: s.nombre }),
      duplicar: () => { const n = copia(s); n.id = 'srv-' + D.uid(); n.nombre = (s.nombre || 'Servicio') + ' (copia)'; delete n.ejemplo; db.servicios.push(n); cambioEstructura(); aviso('Servicio duplicado'); reemplazar('servicio-' + n.id); },
      eliminar: () => {
        const ev = db.eventos.filter(e => e.lineas.some(l => l.tipo === 'servicio' && l.refId === s.id));
        if (ev.length) return abrirModal({ titulo: 'No se puede eliminar', compacto: true, cuerpo: '<p>Este servicio está en ' + ev.length + ' evento(s):</p><ul>' + ev.map(e => '<li>' + esc(e.nombre) + '</li>').join('') + '</ul>', botones: [{ texto: 'Entendido', clase: 'primario' }] });
        confirmar('Eliminar servicio', '¿Eliminar <b>' + esc(s.nombre || 'este servicio') + '</b>?', 'Eliminar', () => { db.servicios = db.servicios.filter(x => x.id !== s.id); cambioEstructura(); atras(); aviso('Servicio eliminado'); });
      }
    };
    return '<div class="cabecera"><div><span class="ceja">' + esc(nombreLinea(s.linea)) + '</span><h1>' + esc(s.nombre || 'Nuevo servicio') + '</h1></div>'
      + '<div class="acciones"><button class="btn" data-accion="duplicar">' + ico('copiar') + 'Duplicar</button><button class="btn peligro" data-accion="eliminar">' + ico('borrar') + 'Eliminar</button></div></div>'
      + '<div class="rejilla r-lateral"><div class="rejilla">'
      + '<section class="panel"><h2>Datos del servicio</h2><div class="campos">'
      + campoTexto('Nombre', 'nombre', s.nombre, { ancho: true, ph: 'Ej. Coffee break, Banquete 3 tiempos, Taquiza' })
      + campoSelect('Línea de servicio', 'linea', s.linea, D.LINEAS.map(l => [l.id, l.nombre]))
      + campoTexto('Margen de utilidad', 'margen', s.margen, { num: true, suf: '%', ayuda: 'Sobre el precio de venta' })
      + campoTexto('Mínimo de personas', 'minimoPersonas', s.minimoPersonas, { num: true })
      + campoTexto('Descripción para el cliente', 'descripcion', s.descripcion, { area: true, ancho: true, filas: 2, ph: 'Qué incluye el servicio' })
      + campoTexto('Costo extra por persona', 'extraPorPersona', s.extraPorPersona, { num: true, suf: 'MXN', ayuda: 'Lo que no sale de recetas: hielo, decoración…' })
      + campoTexto('Concepto del extra', 'extraConcepto', s.extraConcepto, { ph: 'Ej. hielo y decoración' })
      + '</div></section>'
      + '<section class="panel"><div class="panel-cab"><div><h2>¿Qué incluye por persona?</h2><p>Recetas (en porciones por persona) e insumos directos como desechables o pan.</p></div></div>'
      + (s.componentes.length ? '<div class="tabla-env"><table class="editable"><thead><tr><th>Tipo</th><th>Elemento</th><th>Por persona</th><th class="num">Costo</th><th></th></tr></thead><tbody>' + filas + '</tbody><tfoot><tr><td colspan="3">Costo por persona' + (C.num(s.extraPorPersona) ? ' (incluye extra de ' + dinero(s.extraPorPersona) + ')' : '') + '</td><td class="num" id="c-srv">' + dinero(c.porPersona) + '</td><td></td></tr></tfoot></table></div>' : '<div class="vacio"><p>Agrega las recetas que componen el servicio.</p></div>')
      + '<div class="acciones"><button class="btn" data-accion="agregarReceta">' + ico('mas') + 'Agregar receta</button><button class="btn" data-accion="agregarInsumo">' + ico('mas') + 'Agregar insumo directo</button></div></section>'
      + '</div><aside class="pegajoso"><section class="escalador"><h2>' + ico('escalar') + 'Simular para un grupo</h2>'
      + '<div class="campo"><span class="etq">Personas</span><div class="escala-grande"><input id="simPersonas" type="text" inputmode="numeric" value="' + esc(sim.personas) + '" aria-label="Personas"></div></div>'
      + '<div class="atajos" id="simAtajos">' + [10, 25, 50, 100, 200, 500, 1000].map(v => '<button type="button" data-accion="simAtajo" data-v="' + v + '" class="' + (sim.personas === v ? 'activo' : '') + '">' + n0(v) + '</button>').join('') + '</div>'
      + '<div id="simServicio">' + cuerpoSimulador(s, sim) + '</div>'
      + '<div class="acciones"><button class="btn primario" data-accion="crearEvento">' + ico('mas') + 'Cotizar como evento</button><button class="btn" data-accion="compras">' + ico('lista') + 'Lista de compras</button></div>'
      + '</section></aside></div>';
  }
  function cuerpoSimulador(s, sim) {
    const c = C.costoServicio(s, IX);
    const pax = C.num(sim.personas);
    const min = C.num(s.minimoPersonas);
    return '<div class="caja-doble"><div><span class="et">Costo total</span><b>' + dinero(c.porPersona * pax) + '</b></div><div class="acento"><span class="et">Precio sugerido</span><b>' + dinero(c.precioSugerido * pax) + '</b></div></div>'
      + '<div class="resumen" style="margin-top:10px"><div class="fila"><span>Costo por persona</span><span>' + dinero(c.porPersona) + '</span></div><div class="fila"><span>Precio por persona (sin IVA)</span><span>' + dinero(c.precioSugerido) + '</span></div><div class="fila"><span>Utilidad estimada</span><span>' + dinero((c.precioSugerido - c.porPersona) * pax) + '</span></div></div>'
      + (min && pax < min ? '<p class="tenue" style="color:#FFB38A">Por debajo del mínimo de ' + n0(min) + ' personas.</p>' : '')
      + '<p class="tenue">Solo alimentos e insumos. El personal y la logística se agregan al cotizar el evento.</p>';
  }

  /* ================================================================ EVENTOS */
  function vEventos() {
    const f = filtros.eventos;
    const q = f.q.toLowerCase();
    const lista = db.eventos.filter(e => (!f.est || e.estatus === f.est) && (!q || [e.nombre, e.cliente, e.folio, e.lugar].join(' ').toLowerCase().includes(q))).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    const cots = new Map(db.eventos.map(e => [e.id, C.cotizarEvento(e, IX)]));
    const suma = est => db.eventos.filter(e => est.includes(e.estatus)).reduce((s, e) => s + cots.get(e.id).total, 0);
    const conVenta = db.eventos.filter(e => e.estatus !== 'cancelada' && cots.get(e.id).subtotal > 0);
    const margenProm = conVenta.length ? conVenta.reduce((s, e) => s + cots.get(e.id).margenReal, 0) / conVenta.length : 0;
    const filas = lista.map(e => {
      const q2 = cots.get(e.id);
      return '<tr class="clic" tabindex="0" data-ir="#evento-' + e.id + '"><td><span class="codigo">' + esc(e.folio) + '</span></td><td><b>' + esc(e.nombre || 'Sin nombre') + '</b><br><span class="tenue">' + esc(e.cliente || '—') + '</span></td><td>' + fechaCorta(e.fecha) + '</td><td class="num">' + n0(q2.personas) + '</td><td class="num">' + dinero(q2.precioPorPersona) + '</td><td class="num"><b>' + dinero(q2.total) + '</b></td><td class="num">' + pct(q2.margenReal) + '</td><td>' + pillEstatus(e.estatus) + '</td></tr>';
    }).join('');
    ctx.alPintar = () => {
      $('fq').addEventListener('input', e => { f.q = e.target.value; const p = e.target.selectionStart; render(); $('fq').focus(); try { $('fq').setSelectionRange(p, p); } catch (er) { /* */ } });
      $('fest').addEventListener('change', e => { f.est = e.target.value; render(); });
    };
    return '<div class="cabecera"><div><span class="ceja">Ventas</span><h1>Eventos y cotizaciones</h1><p class="sub">Cotiza con tus servicios y recetas, suma personal y logística, y obtén el precio por persona, la utilidad y la lista de compras.</p></div>'
      + '<div class="acciones"><button class="btn primario" data-accion="nuevoEvento">' + ico('mas') + 'Nuevo evento</button></div></div>'
      + '<div class="metricas"><div class="metrica destacada"><span class="et">En negociación</span><span class="val">' + dinero(suma(['borrador', 'enviada'])) + '</span><span class="det">borradores y enviadas</span></div>'
      + '<div class="metrica"><span class="et">Aprobado</span><span class="val">' + dinero(suma(['aprobada'])) + '</span><span class="det">por realizar</span></div>'
      + '<div class="metrica"><span class="et">Realizado</span><span class="val">' + dinero(suma(['realizado'])) + '</span><span class="det">total con IVA</span></div>'
      + '<div class="metrica"><span class="et">Margen promedio</span><span class="val">' + pct(margenProm) + '</span><span class="det">sobre venta</span></div></div>'
      + '<section class="panel"><div class="filtros"><input type="search" id="fq" placeholder="Buscar por evento, cliente o folio" value="' + esc(f.q) + '" aria-label="Buscar evento"><select id="fest" aria-label="Estatus"><option value="">Todos los estatus</option>' + D.ESTATUS.map(s => '<option value="' + s.id + '"' + (f.est === s.id ? ' selected' : '') + '>' + s.nombre + '</option>').join('') + '</select></div>'
      + (lista.length ? '<div class="tabla-env"><table><thead><tr><th>Folio</th><th>Evento</th><th>Fecha</th><th class="num">Personas</th><th class="num">Por persona</th><th class="num">Total</th><th class="num">Margen</th><th>Estatus</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
        : '<div class="vacio"><h3>' + (db.eventos.length ? 'Ningún evento coincide' : 'Aún no hay eventos') + '</h3><p>Crea un evento, elige los servicios y la plataforma arma la cotización.</p><button class="btn primario" data-accion="nuevoEvento">' + ico('mas') + 'Nuevo evento</button></div>')
      + '</section>';
  }
  function nuevoEvento(base) {
    const p = db.parametros;
    const fecha = '';
    const e = Object.assign({
      id: 'evt-' + D.uid(), folio: D.siguienteFolio(db), nombre: '', cliente: '', contacto: '', telefono: '', fecha, hora: '', lugar: '', personas: 50, estatus: 'borrador',
      lineas: [], personal: [], gastos: [], indirectos: p.indirectos, margen: p.margen, descuento: 0, iva: p.iva, notas: '',
      condiciones: 'Anticipo del 50 % para confirmar la fecha y liquidación 3 días antes del evento. Precios en MXN. Vigencia de 15 días.', creado: D.ahora(), actualizado: D.ahora()
    }, base || {});
    db.eventos.push(e); cambioEstructura(); abrir('evento-' + e.id);
    return e;
    setTimeout(() => { const n = $('f-nombre'); if (n) { n.focus(); n.select(); } }, 50);
  }
  function vEvento(id) {
    const e = db.eventos.find(x => x.id === id);
    if (!e) return noEncontrado('El evento', '#eventos', 'Ver eventos');
    ctx.obj = e;
    const q = C.cotizarEvento(e, IX);
    const opcMenu = l => {
      const sel = l.refId ? l.tipo + ':' + l.refId : '';
      return '<option value="">Elige servicio o receta…</option><optgroup label="Servicios">' + db.servicios.slice().sort(sortNombre).map(s => '<option value="servicio:' + s.id + '"' + (sel === 'servicio:' + s.id ? ' selected' : '') + '>' + esc(s.nombre) + '</option>').join('') + '</optgroup>'
        + '<optgroup label="Recetas sueltas">' + db.recetas.slice().sort(sortNombre).map(r => '<option value="receta:' + r.id + '"' + (sel === 'receta:' + r.id ? ' selected' : '') + '>' + esc(r.nombre) + '</option>').join('') + '</optgroup>';
    };
    const filasMenu = e.lineas.map((l, i) => {
      const ql = q.lineas[i] || {};
      return '<tr class="' + (ql.error && l.refId ? 'fila-error' : '') + '"><td><select data-lista="lineas" data-i="' + i + '" data-campo="ref" data-rerender aria-label="Servicio o receta">' + opcMenu(l) + '</select>' + (ql.error && l.refId ? '<span class="err-txt">' + esc(ql.error) + '</span>' : '') + '</td>'
        + '<td class="w-cant">' + celdaNum('lineas', i, 'cantidad', l.cantidad, String(C.num(e.personas))) + '<span class="tenue">' + (l.tipo === 'receta' ? 'porciones' : 'personas') + '</span></td>'
        + '<td class="num" id="m-u-' + i + '">' + dinero(ql.unitario) + '</td><td class="num" id="m-t-' + i + '">' + dinero(ql.total) + '</td>'
        + '<td class="acc"><button class="icono-btn" data-accion="quitar" data-lista="lineas" data-i="' + i + '" aria-label="Quitar">✕</button></td></tr>';
    }).join('');
    const filasPersonal = e.personal.map((p, i) => '<tr><td>' + celdaTexto('personal', i, 'puesto', p.puesto, 'Puesto', 'dl-puestos') + '</td><td class="w-cant">' + celdaNum('personal', i, 'cantidad', p.cantidad, '1') + '</td><td class="w-cant">' + celdaNum('personal', i, 'horas', p.horas, '8') + '</td><td class="w-dinero">' + celdaNum('personal', i, 'tarifa', p.tarifa, '0.00') + '</td><td class="num" id="p-t-' + i + '">' + dinero(C.num(p.cantidad) * C.num(p.horas) * C.num(p.tarifa)) + '</td><td class="acc"><button class="icono-btn" data-accion="quitar" data-lista="personal" data-i="' + i + '" aria-label="Quitar">✕</button></td></tr>').join('');
    const filasGastos = e.gastos.map((g, i) => '<tr><td>' + celdaTexto('gastos', i, 'concepto', g.concepto, 'Concepto', 'dl-gastos') + '</td><td class="w-dinero">' + celdaNum('gastos', i, 'monto', g.monto, '0.00') + '</td><td class="acc"><button class="icono-btn" data-accion="quitar" data-lista="gastos" data-i="' + i + '" aria-label="Quitar">✕</button></td></tr>').join('');

    ctx.alCambiar = (obj, campo, v) => { if (campo === 'ref') { const [t, r] = String(v).split(':'); obj.tipo = t || 'servicio'; obj.refId = r || ''; return true; } return false; };
    ctx.recalcular = () => {
      const q2 = C.cotizarEvento(e, IX);
      q2.lineas.forEach((l, i) => { if ($('m-u-' + i)) { $('m-u-' + i).textContent = dinero(l.unitario); $('m-t-' + i).textContent = dinero(l.total); } });
      capaActual().querySelectorAll('[data-lista="lineas"][data-campo="cantidad"]').forEach(inp => { inp.placeholder = String(C.num(e.personas)); });
      e.personal.forEach((p, i) => { if ($('p-t-' + i)) $('p-t-' + i).textContent = dinero(C.num(p.cantidad) * C.num(p.horas) * C.num(p.tarifa)); });
      if ($('t-menu')) $('t-menu').textContent = dinero(q2.alimentos);
      if ($('t-pers')) $('t-pers').textContent = dinero(q2.personal);
      if ($('t-gast')) $('t-gast').textContent = dinero(q2.gastos);
      $('resumenEvento').innerHTML = resumenEvento(e, q2);
      actualizarTitulo(e.nombre || 'Nuevo evento');
    };
    ctx.acciones = {
      agregarLinea: () => { e.lineas.push({ tipo: 'servicio', refId: '', cantidad: '' }); guardar(); render(); },
      agregarPersonal: () => { e.personal.push({ puesto: '', cantidad: 1, horas: 8, tarifa: '' }); guardar(); render(); },
      agregarGasto: () => { e.gastos.push({ concepto: '', monto: '' }); guardar(); render(); },
      quitar: d => { e[d.lista].splice(+d.i, 1); guardar(); render(); },
      cotizacion: () => imprimir(docCotizacionCliente(e)),
      irCobro: () => abrir('cobro-' + e.id),
      costoInterno: () => imprimir(docCostoInterno(e)),
      produccion: () => modalCompras('Producción y compras · ' + (e.nombre || e.folio) + ' · ' + n0(e.personas) + ' personas', C.explotarEvento(e, IX), e.nombre || e.folio, e),
      duplicar: () => { const n = copia(e); n.id = 'evt-' + D.uid(); n.folio = D.siguienteFolio(db); n.nombre = (e.nombre || 'Evento') + ' (copia)'; n.estatus = 'borrador'; delete n.ejemplo; n.creado = n.actualizado = D.ahora(); db.eventos.push(n); cambioEstructura(); aviso('Evento duplicado como borrador'); reemplazar('evento-' + n.id); },
      eliminar: () => confirmar('Eliminar evento', '¿Eliminar <b>' + esc(e.nombre || e.folio) + '</b>?', 'Eliminar', () => { db.eventos = db.eventos.filter(x => x.id !== e.id); cambioEstructura(); atras(); aviso('Evento eliminado'); })
    };

    return '<div class="cabecera"><div><span class="ceja">Evento · ' + esc(e.folio) + '</span><h1>' + esc(e.nombre || 'Nuevo evento') + '</h1></div>'
      + '<div class="acciones"><button class="btn primario" data-accion="cotizacion">' + ico('facturacion') + 'Cotización cliente</button><button class="btn" data-accion="costoInterno">' + ico('imprimir') + 'Costo interno</button><button class="btn" data-accion="produccion">' + ico('lista') + 'Producción y compras</button><button class="btn" data-accion="irCobro">' + ico('cobranza') + 'Cobranza</button><button class="btn" data-accion="duplicar">' + ico('copiar') + 'Duplicar</button><button class="btn peligro fantasma" data-accion="eliminar" aria-label="Eliminar evento">' + ico('borrar') + '</button></div></div>'
      + '<div class="rejilla r-lateral"><div class="rejilla">'
      + '<section class="panel"><h2>Datos del evento</h2><div class="campos">'
      + campoTexto('Nombre del evento', 'nombre', e.nombre, { ancho: true, ph: 'Ej. Boda García–López, Capacitación anual' })
      + campoTexto('Cliente', 'cliente', e.cliente) + campoTexto('Contacto', 'contacto', e.contacto) + campoTexto('Teléfono', 'telefono', e.telefono, { tipo: 'tel' })
      + campoTexto('Fecha', 'fecha', e.fecha, { tipo: 'date' }) + campoTexto('Hora', 'hora', e.hora, { tipo: 'time' })
      + campoTexto('Lugar', 'lugar', e.lugar) + campoTexto('Personas', 'personas', e.personas, { num: true })
      + campoSelect('Estatus', 'estatus', e.estatus, D.ESTATUS.map(s => [s.id, s.nombre]))
      + '</div></section>'
      + '<section class="panel"><div class="panel-cab"><div><h2>Menú</h2><p>Deja la cantidad vacía para usar el número de personas del evento.</p></div></div>'
      + (e.lineas.length ? '<div class="tabla-env"><table class="editable"><thead><tr><th>Servicio o receta</th><th>Cantidad</th><th class="num">Costo unitario</th><th class="num">Costo</th><th></th></tr></thead><tbody>' + filasMenu + '</tbody><tfoot><tr><td colspan="3">Alimentos y bebidas</td><td class="num" id="t-menu">' + dinero(q.alimentos) + '</td><td></td></tr></tfoot></table></div>' : '<div class="vacio"><p>Agrega los servicios del catálogo (coffee break, comida, banquete) o recetas sueltas.</p></div>')
      + '<div class="acciones"><button class="btn" data-accion="agregarLinea">' + ico('mas') + 'Agregar servicio o receta</button></div></section>'
      + '<section class="panel"><div class="panel-cab"><div><h2>Personal</h2><p>Meseros, cocineros, capitanes… por horas.</p></div></div>'
      + (e.personal.length ? '<div class="tabla-env"><table class="editable"><thead><tr><th>Puesto</th><th>Personas</th><th>Horas</th><th>Tarifa / hora</th><th class="num">Costo</th><th></th></tr></thead><tbody>' + filasPersonal + '</tbody><tfoot><tr><td colspan="4">Personal</td><td class="num" id="t-pers">' + dinero(q.personal) + '</td><td></td></tr></tfoot></table></div>' : '')
      + '<div class="acciones"><button class="btn" data-accion="agregarPersonal">' + ico('mas') + 'Agregar personal</button></div>'
      + '<datalist id="dl-puestos">' + ['Chef', 'Cocinero', 'Ayudante de cocina', 'Mesero', 'Capitán de meseros', 'Bartender', 'Steward / lavaloza', 'Chofer'].map(x => '<option value="' + x + '">').join('') + '</datalist></section>'
      + '<section class="panel"><div class="panel-cab"><div><h2>Logística y otros gastos</h2><p>Transporte, renta de mobiliario, loza, gas, hielo, permisos.</p></div></div>'
      + (e.gastos.length ? '<div class="tabla-env"><table class="editable"><thead><tr><th>Concepto</th><th>Monto</th><th></th></tr></thead><tbody>' + filasGastos + '</tbody><tfoot><tr><td>Logística</td><td class="num" id="t-gast">' + dinero(q.gastos) + '</td><td></td></tr></tfoot></table></div>' : '')
      + '<div class="acciones"><button class="btn" data-accion="agregarGasto">' + ico('mas') + 'Agregar gasto</button></div>'
      + '<datalist id="dl-gastos">' + ['Transporte', 'Renta de mobiliario', 'Mantelería', 'Loza y cristalería', 'Equipo de cocina (renta)', 'Gas', 'Hielo', 'Montaje y decoración', 'Permisos', 'Desechables adicionales'].map(x => '<option value="' + x + '">').join('') + '</datalist></section>'
      + '<section class="panel"><h2>Notas</h2><div class="campos">'
      + campoTexto('Notas internas', 'notas', e.notas, { area: true, ancho: true, filas: 3, ph: 'Solo para tu equipo' })
      + campoTexto('Condiciones comerciales (salen en la cotización)', 'condiciones', e.condiciones, { area: true, ancho: true, filas: 3 })
      + '</div></section></div>'
      + '<aside class="pegajoso"><section class="panel"><h2>Cotización</h2><div class="campos" style="grid-template-columns:repeat(2,minmax(0,1fr))">'
      + campoTexto('Indirectos', 'indirectos', e.indirectos, { num: true, suf: '%' }) + campoTexto('Margen', 'margen', e.margen, { num: true, suf: '%' })
      + campoTexto('Descuento', 'descuento', e.descuento, { num: true, suf: '%' }) + campoTexto('IVA', 'iva', e.iva, { num: true, suf: '%' })
      + '</div><div id="resumenEvento">' + resumenEvento(e, q) + '</div></section></aside></div>';
  }
  function resumenEvento(e, q) {
    return '<div class="caja-doble"><div><span class="et">Costo / persona</span><b>' + dinero(q.costoPorPersona) + '</b></div><div class="acento"><span class="et">Precio / persona</span><b>' + dinero(q.precioPorPersona) + '</b></div></div>'
      + '<div class="resumen"><div class="fila sub"><span>Alimentos y bebidas</span><span>' + dinero(q.alimentos) + '</span></div><div class="fila sub"><span>Personal</span><span>' + dinero(q.personal) + '</span></div><div class="fila sub"><span>Logística</span><span>' + dinero(q.gastos) + '</span></div><div class="fila sub"><span>Indirectos (' + pct(e.indirectos) + ')</span><span>' + dinero(q.indirectos) + '</span></div>'
      + '<div class="fila"><span><b>Costo interno</b></span><span><b>' + dinero(q.costoTotal) + '</b></span></div>'
      + (q.descuento > 0 ? '<div class="fila sub"><span>Precio antes de descuento</span><span>' + dinero(q.precioBruto) + '</span></div><div class="fila sub"><span>Descuento (' + pct(e.descuento) + ')</span><span>−' + dinero(q.descuento) + '</span></div>' : '')
      + '<div class="fila"><span>Subtotal</span><span>' + dinero(q.subtotal) + '</span></div><div class="fila sub"><span>IVA (' + pct(e.iva) + ')</span><span>' + dinero(q.iva) + '</span></div>'
      + '<div class="fila total"><span>Total</span><span>' + dinero(q.total) + '</span></div></div>'
      + ((e.pagos || []).length ? (() => { const k = C.estadoCobranza(e, q.total, hoyISO(), db.parametros); return '<div class="resumen"><div class="fila"><span>Cobrado</span><span>' + dinero(k.pagado) + ' · saldo ' + dinero(Math.max(k.saldo, 0)) + '</span></div></div>'; })() : '')
      + '<div class="resumen"><div class="fila"><span>Utilidad</span><span class="' + (q.utilidad < 0 ? 'pill error' : '') + '">' + dinero(q.utilidad) + ' · ' + pct(q.margenReal) + '</span></div></div>'
      + medidorFoodCost(q.foodCost, db.parametros.foodCost)
      + (q.error ? '<div class="nota alerta"><b>Revisa:</b> ' + esc(q.error) + '</div>' : '');
  }

  /* ============================================== Producción y compras (modal) */
  function modalCompras(titulo, acc, nombre, evento) {
    const lista = C.listaCompras(acc, IX);
    const total = lista.reduce((s, f) => s + f.costoCompra, 0), uso = lista.reduce((s, f) => s + f.costoUso, 0);
    const preps = [];
    acc.subrecetas.forEach((porc, id) => { const r = IX.recetas.get(id); if (r) preps.push({ r, porc, base: true }); });
    acc.recetas.forEach((porc, id) => { const r = IX.recetas.get(id); if (r) preps.push({ r, porc, base: false }); });
    const filasCompra = lista.map(f => '<tr><td>' + esc(f.nombre) + '<br><span class="tenue">' + esc(f.categoria) + (f.proveedor ? ' · ' + esc(f.proveedor) : '') + '</span></td><td class="num">' + C.fmtLegible(f.netaBase, f.dim) + '</td><td class="num"><b>' + C.fmtLegible(f.brutaBase, f.dim) + '</b></td><td class="num">' + f.empaquesCompra + ' × ' + C.fmtCant(f.presentacion) + ' ' + esc(C.nombreUnidad(f.unidadCompra)) + '</td><td class="num">' + dinero(f.costoCompra) + '</td></tr>').join('');
    const filasPrep = preps.map(p => { const rb = C.rendimientoBase(p.r); return '<tr><td>' + esc(p.r.nombre) + (p.base ? ' <span class="pill">base</span>' : '') + '</td><td class="num"><b>' + C.fmtCant(p.porc) + '</b> porc.</td><td class="num">' + (rb ? C.fmtLegible(rb.base * p.porc / C.porcionesReceta(p.r), rb.dim) : '—') + '</td><td class="num">×' + C.fmtCant(p.porc / C.porcionesReceta(p.r)) + '</td></tr>'; }).join('');
    const cuerpo = '<div class="caja-doble"><div><span class="et">Compra (empaques completos)</span><b>' + dinero(total) + '</b></div><div class="acento"><span class="et">Costo de lo que se usa</span><b>' + dinero(uso) + '</b></div></div>'
      + '<div class="pestanas"><button class="activa" data-tab="compras">Lista de compras (' + lista.length + ')</button><button data-tab="prep">Preparaciones (' + preps.length + ')</button></div>'
      + '<div data-panel="compras">' + (lista.length ? '<div class="tabla-env"><table><thead><tr><th>Insumo</th><th class="num">Neto</th><th class="num">Bruto a surtir</th><th class="num">Comprar</th><th class="num">Costo</th></tr></thead><tbody>' + filasCompra + '</tbody></table></div>' : '<p class="tenue">No hay insumos que comprar.</p>') + '</div>'
      + '<div data-panel="prep" hidden>' + (preps.length ? '<div class="tabla-env"><table><thead><tr><th>Receta</th><th class="num">Porciones</th><th class="num">Volumen</th><th class="num">Factor</th></tr></thead><tbody>' + filasPrep + '</tbody></table></div>' : '<p class="tenue">Sin preparaciones.</p>') + '</div>'
      + '<p class="tenue">"Bruto a surtir" ya incluye la merma de cada insumo. "Comprar" redondea a empaques completos.</p>';
    abrirModal({
      titulo, cuerpo, ancho: true,
      botones: [
        { texto: ico('proveedores') + 'Pedidos por proveedor', clase: '', accion: () => { modalPedidos(lista, titulo); return false; } },
        { texto: ico('bajar') + 'Descargar CSV', clase: '', accion: () => { descargar('compras-' + slug(nombre) + '.csv', csv([['insumo', 'categoria', 'proveedor', 'neto', 'bruto', 'unidad', 'empaques', 'presentacion', 'costo']].concat(lista.map(f => { const l = C.legible(f.brutaBase, f.dim); const ln = C.legible(f.netaBase, f.dim); return [f.nombre, f.categoria, f.proveedor, C.r2(C.convertir(ln.cant, ln.u, l.u)), C.r2(l.cant), C.nombreUnidad(l.u), f.empaquesCompra, f.presentacion + ' ' + C.nombreUnidad(f.unidadCompra), C.r2(f.costoCompra)]; }))), 'text/csv'); return false; } },
        { texto: ico('imprimir') + 'Imprimir', clase: 'primario', accion: () => { imprimir(docProduccion(titulo, lista, preps, evento)); return false; } }
      ],
      alAbrir: c => c.querySelector('.pestanas').addEventListener('click', ev => {
        const b = ev.target.closest('[data-tab]'); if (!b) return;
        c.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('activa', x === b));
        c.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
      })
    });
  }

  /* ================================================================ INICIO
     Lienzo de íconos: cada uno abre su función como pantalla completa. */
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function saludoHora() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }
  function nombreCuenta() { return (perfil && perfil.nombre) || db.empresa.responsable || ''; }
  function inicial() { const n = nombreCuenta() || (perfil && perfil.correo) || db.empresa.nombre || 'C'; return n.trim().charAt(0).toUpperCase(); }
  function vInicio() {
    const hoy = new Date();
    const nombre = nombreCuenta();
    const abiertos = db.eventos.filter(e => ['borrador', 'enviada', 'aprobada'].includes(e.estatus));
    const monto = abiertos.reduce((s, e) => s + C.cotizarEvento(e, IX).total, 0);
    const semana = db.eventos.filter(e => e.estatus !== 'cancelada' && e.estatus !== 'realizado' && diasHasta(e.fecha) != null && diasHasta(e.fecha) >= 0 && diasHasta(e.fecha) <= 7).length;
    const porSurtir = eventosPorSurtir().length;
    const sinPrecio = db.insumos.filter(i => !(C.num(i.precio) > 0)).length;
    const conError = db.recetas.filter(r => C.costoReceta(r, IX).error).length;
    const ico2 = (ruta, k, nombreI, insignia, extra) => '<a class="app-ico' + (extra || '') + '" href="#' + ruta + '"><span class="cuadro">' + ico(k) + (insignia ? '<span class="insignia">' + insignia + '</span>' : '') + '</span><span class="nombre">' + nombreI + '</span></a>';
    const btnIco = (accion, k, nombreI) => '<button type="button" class="app-ico" data-accion="' + accion + '"><span class="cuadro">' + ico(k) + '</span><span class="nombre">' + nombreI + '</span></button>';
    const prox = (k, nombreI) => '<div class="app-ico proximo" title="Próximamente"><span class="cuadro">' + ico(k) + '</span><span class="nombre">' + nombreI + '</span></div>';
    const iconos = [
      ico2('eventos', 'eventos', 'Eventos', abiertos.length || '', ' destacado'),
      ico2('solicitudes', 'bandeja', 'Solicitudes', (db.solicitudes || []).filter(x => x.estatus === 'nueva').length || ''),
      ico2('cobranza', 'cobranza', 'Cobranza', db.eventos.filter(e => enCobranza(e) && e.estatus !== 'cancelada' && cobDe(e).estado === 'vencido').length || ''),
      ico2('servicios', 'servicios', 'Servicios'),
      ico2('recetas', 'recetas', 'Recetas', conError || ''),
      btnIco('abrirEscalador', 'escalar', 'Escalar'),
      ico2('compras', 'compras', 'Compras', porSurtir || ''),
      ico2('proveedores', 'proveedores', 'Proveedores', fuentesUsadas().filter(f => !provPorNombre(f)).length ? '+' : ''),
      ico2('insumos', 'insumos', 'Insumos', db.insumos.filter(vencido).length || ''),
      ico2('tablero', 'tablero', 'Tablero')
    ];
    if (esAdmin()) iconos.push(ico2('sitio', 'web', 'Sitio web'));
    if (NUBE && esAdmin()) iconos.push(ico2('usuarios', 'usuarios', 'Usuarios'));
    if (esAdmin()) iconos.push(ico2('ajustes', 'ajustes', 'Ajustes'));
    const resumen = [];
    if (semana) resumen.push(semana + ' evento' + (semana === 1 ? '' : 's') + ' esta semana');
    if (abiertos.length) resumen.push(dinero(monto) + ' en cotizaciones');
    if (!resumen.length) resumen.push(db.recetas.length + ' recetas · ' + db.servicios.length + ' servicios');

    ctx.acciones = {
      abrirEscalador: () => abrirEscaladorRapido(),
      buscar: () => abrir('buscar'),
      crear: () => hojaCrear(),
      cuenta: () => hojaCuenta()
    };
    return '<div class="inicio"><div class="inicio-barra"><span class="marca">' + ISOTIPO + '<b>CIVIZO</b></span>'
      + '<button type="button" class="barra-btn" data-accion="buscar" aria-label="Buscar" title="Buscar">' + ico('buscar') + '</button>'
      + '<button type="button" class="avatar" data-accion="cuenta" aria-label="Tu cuenta" title="Tu cuenta">' + esc(inicial()) + '</button></div>'
      + '<div class="saludo"><span class="ceja">' + DIAS[hoy.getDay()] + ' ' + hoy.getDate() + ' de ' + MESES_L[hoy.getMonth()] + '</span>'
      + '<h1>' + saludoHora() + (nombre ? ', <b>' + esc(nombre.split(' ')[0]) + '</b>' : '') + '</h1>'
      + '<div class="resumen-dia">' + resumen.map(t => '<span><i></i>' + t + '</span>').join('') + '</div></div>'
      + '<nav class="iconos" aria-label="Funciones">' + iconos.join('') + '</nav>'
      + '<div class="separador">Próximamente</div><div class="iconos">' + prox('inventario', 'Inventario') + '</div>'
      + (D.hayEjemplos(db) && puedeEditar() ? '<div class="aviso-ejemplo"><span>Estás usando datos de ejemplo.</span><button class="btn chico" data-accion="quitarEjemplos">Borrarlos</button></div>' : '')
      + '</div>'
      + (puedeEditar() ? '<button type="button" class="fab" data-accion="crear" aria-label="Crear" title="Crear">' + ico('mas') + '</button>' : '');
  }
  function hojaCrear() {
    const op = [['nuevoEvento', 'eventos', 'Evento'], ['nuevaReceta', 'recetas', 'Receta'], ['nuevoServicio', 'servicios', 'Servicio'], ['nuevoInsumo', 'insumos', 'Insumo']];
    abrirModal({
      titulo: 'Crear', compacto: true,
      cuerpo: '<div class="hoja-iconos">' + op.map(o => '<button type="button" data-crear="' + o[0] + '">' + ico(o[1]) + o[2] + '</button>').join('') + '</div>',
      alAbrir: c => c.addEventListener('click', ev => { const b = ev.target.closest('[data-crear]'); if (b) ACCIONES_GLOBALES[b.dataset.crear]({}); })
    });
  }
  function hojaCuenta() {
    const rolN = NUBE ? ((N.ROLES.find(r => r.id === rol()) || {}).nombre || '') : 'Modo local · este equipo';
    const op = [];
    if (NUBE && esAdmin()) op.push(['usuarios', 'usuarios', 'Usuarios']);
    if (esAdmin()) op.push(['ajustes', 'ajustes', 'Ajustes']);
    op.push(['tema', 'tablero', 'Cambiar apariencia']);
    if (NUBE) op.push(['salir', 'salir', 'Cerrar sesión', 'peligro']);
    abrirModal({
      titulo: 'Tu cuenta', compacto: true,
      cuerpo: '<div class="cuenta-cab"><span class="avatar">' + esc(inicial()) + '</span><div><b>' + esc(nombreCuenta() || (perfil && perfil.correo) || db.empresa.nombre) + '</b><span class="tenue">' + esc(rolN) + (perfil && perfil.correo ? ' · ' + esc(perfil.correo) : '') + '</span></div></div>'
        + '<div class="lista-opc">' + op.map(o => '<button type="button" data-op="' + o[0] + '" class="' + (o[3] || '') + '">' + ico(o[1]) + o[2] + '</button>').join('') + '</div>',
      alAbrir: c => c.addEventListener('click', ev => {
        const b = ev.target.closest('[data-op]'); if (!b) return;
        const o = b.dataset.op;
        if (o === 'usuarios' || o === 'ajustes') abrir(o);
        else if (o === 'tema') { const actual = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); aplicarTema(actual === 'dark' ? 'light' : 'dark', true); }
        else if (o === 'salir') { cerrarModal(); if (N.hayPendientes(db)) confirmar('Hay cambios sin subir', 'Algunos cambios todavía no llegan a la nube. Si sales ahora se pierden.', 'Salir de todos modos', salir); else salir(); }
      })
    });
  }
  let textoBusqueda = '';
  function vBuscar() {
    ctx.alPintar = () => {
      const inp = $('buscaGlobal');
      inp.value = textoBusqueda;
      $('resBusca').innerHTML = resultadosBusqueda(textoBusqueda);
      inp.addEventListener('input', () => { textoBusqueda = inp.value; $('resBusca').innerHTML = resultadosBusqueda(inp.value); });
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const p = $('resBusca').querySelector('[data-accion]'); if (p) p.click(); } });
      setTimeout(() => { if (capaActual().contains(inp) && !textoBusqueda) inp.focus(); }, 280);
    };
    ctx.acciones = { irBusca: d => { if (d.tipo === 'insumo') abrirInsumo(d.id); else abrir(d.h); } };
    return '<div class="cabecera"><div><h1>Buscar</h1></div></div>'
      + '<div class="busqueda-campo">' + ico('buscar') + '<input type="search" id="buscaGlobal" placeholder="Receta, insumo, servicio, evento o cliente" autocomplete="off" aria-label="Buscar en toda la plataforma"></div>'
      + '<div class="resultados" id="resBusca"></div>';
  }
  function resultadosBusqueda(q) {
    q = norm(q);
    if (q.length < 2) return '';
    const res = [];
    db.eventos.forEach(e => { if (norm([e.nombre, e.cliente, e.folio, e.lugar].join(' ')).includes(q)) res.push(['Evento', esc(e.nombre || e.folio) + ' <span class="tenue">' + esc(e.cliente || '') + ' · ' + fechaCorta(e.fecha) + '</span>', 'data-h="#evento-' + e.id + '"']); });
    db.recetas.forEach(r => { if (norm(r.nombre + ' ' + r.codigo).includes(q)) res.push(['Receta', esc(r.nombre) + ' <span class="tenue">' + esc(r.codigo) + '</span>', 'data-h="#receta-' + r.id + '"']); });
    db.servicios.forEach(s => { if (norm(s.nombre).includes(q)) res.push(['Servicio', esc(s.nombre) + ' <span class="tenue">' + esc(nombreLinea(s.linea)) + '</span>', 'data-h="#servicio-' + s.id + '"']); });
    db.insumos.forEach(i => { if (norm(i.nombre + ' ' + (i.proveedor || '')).includes(q)) res.push(['Insumo', esc(i.nombre) + ' <span class="tenue">' + costoNetoTexto(i) + '</span>', 'data-h="#insumo-' + i.id + '"']); });
    if (!res.length) return '<div class="res-vacio">Sin resultados para esa búsqueda.</div>';
    return res.slice(0, 10).map(r => '<button type="button" class="res" data-accion="irBusca" ' + r[2] + '><span class="pill">' + r[0] + '</span><span>' + r[1] + '</span></button>').join('');
  }
  function abrirEscaladorRapido() {
    if (!db.recetas.length) return aviso('Primero crea una receta', true);
    abrirModal({
      titulo: 'Escalar una receta', compacto: true,
      cuerpo: '<div class="campos"><label class="campo ancho"><span>Receta</span><select id="erReceta">' + db.recetas.slice().sort(sortNombre).map(r => '<option value="' + r.id + '">' + esc(r.nombre) + '</option>').join('') + '</select></label><label class="campo"><span>Porciones</span><input id="erPorc" type="text" inputmode="decimal" value="100"></label></div><p class="tenue">Te llevamos a la receta con las cantidades, el costo, la orden de producción y la lista de compras.</p>',
      botones: [{ texto: 'Cancelar', clase: 'fantasma' }, { texto: 'Calcular', clase: 'primario', accion: c => { const id = c.querySelector('#erReceta').value, v = C.num(c.querySelector('#erPorc').value); escalas[id] = { valor: v > 0 ? v : 100, modo: 'porc' }; abrir('receta-' + id); } }]
    });
  }

  /* ================================================================ COMPRAS */
  const estadoCompras = { desde: '', hasta: '', est: ['aprobada', 'enviada'], fuera: [] };
  function eventosPorSurtir() {
    const e = estadoCompras;
    const desde = e.desde || hoyISO();
    const hasta = e.hasta || (() => { const d = new Date(Date.now() + 30 * 864e5); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); })();
    return db.eventos.filter(x => e.est.includes(x.estatus) && x.fecha && x.fecha >= desde && x.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  function prepsDe(acc) {
    const preps = [];
    acc.subrecetas.forEach((porc, id) => { const r = IX.recetas.get(id); if (r) preps.push({ r, porc, base: true }); });
    acc.recetas.forEach((porc, id) => { const r = IX.recetas.get(id); if (r) preps.push({ r, porc, base: false }); });
    return preps.sort((a, b) => (b.base - a.base) || sortNombre(a.r, b.r));
  }
  function csvCompras(lista) {
    return csv([['insumo', 'categoria', 'proveedor', 'neto', 'bruto', 'unidad', 'empaques', 'presentacion', 'costo']].concat(lista.map(f => {
      const l = C.legible(f.brutaBase, f.dim), ln = C.legible(f.netaBase, f.dim);
      return [f.nombre, f.categoria, f.proveedor, C.r2(C.convertir(ln.cant, ln.u, l.u)), C.r2(l.cant), C.nombreUnidad(l.u), f.empaquesCompra, f.presentacion + ' ' + C.nombreUnidad(f.unidadCompra), C.r2(f.costoCompra)];
    })));
  }
  function vCompras() {
    const e = estadoCompras;
    if (!e.desde) e.desde = hoyISO();
    if (!e.hasta) { const d = new Date(Date.now() + 30 * 864e5); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); e.hasta = d.toISOString().slice(0, 10); }
    const eventos = eventosPorSurtir();
    const elegidos = eventos.filter(x => !e.fuera.includes(x.id));
    const acc = C.nuevoAcumulado();
    elegidos.forEach(x => C.explotarEvento(x, IX, acc));
    const lista = C.listaCompras(acc, IX);
    const preps = prepsDe(acc);
    const total = lista.reduce((s, f) => s + f.costoCompra, 0);
    const pax = elegidos.reduce((s, x) => s + C.num(x.personas), 0);
    const porCat = {};
    lista.forEach(f => { (porCat[f.categoria] = porCat[f.categoria] || []).push(f); });
    const titulo = 'Compras del ' + fechaCorta(e.desde) + ' al ' + fechaCorta(e.hasta) + ' · ' + elegidos.length + ' evento' + (elegidos.length === 1 ? '' : 's');

    ctx.acciones = {
      alternarEvento: d => { const i = e.fuera.indexOf(d.id); if (i >= 0) e.fuera.splice(i, 1); else e.fuera.push(d.id); render(); },
      imprimirCompras: () => imprimir(docProduccion(titulo, lista, preps, null)),
      csvCompras: () => descargar('compras-' + e.desde + '-a-' + e.hasta + '.csv', csvCompras(lista), 'text/csv'),
      pedidosProveedor: () => modalPedidos(lista, titulo)
    };
    ctx.alPintar = () => {
      $('cDesde').addEventListener('change', ev => { e.desde = ev.target.value; render(); });
      $('cHasta').addEventListener('change', ev => { e.hasta = ev.target.value; render(); });
      capaActual().querySelectorAll('[data-est]').forEach(ch => ch.addEventListener('change', () => { e.est = Array.from(capaActual().querySelectorAll('[data-est]:checked')).map(x => x.value); render(); }));
    };
    return '<div class="cabecera"><div><span class="ceja">Cocina y producción</span><h1>Producción y compras</h1><p class="sub">Junta todo lo que hay que preparar y comprar para los eventos de un periodo. Cada receta y sub-receta se escala y se suma con su merma.</p></div>'
      + '<div class="acciones"><button class="btn" data-accion="pedidosProveedor">' + ico('proveedores') + 'Pedidos por proveedor</button><button class="btn" data-accion="csvCompras">' + ico('bajar') + 'Descargar CSV</button><button class="btn primario" data-accion="imprimirCompras">' + ico('imprimir') + 'Imprimir</button></div></div>'
      + '<div class="rejilla r-lateral"><div class="rejilla">'
      + '<div class="metricas"><div class="metrica destacada"><span class="et">Compra estimada</span><span class="val">' + dinero(total) + '</span><span class="det">empaques completos</span></div><div class="metrica"><span class="et">Eventos</span><span class="val">' + elegidos.length + '</span><span class="det">de ' + eventos.length + ' en el periodo</span></div><div class="metrica"><span class="et">Personas</span><span class="val">' + n0(pax) + '</span><span class="det">a atender</span></div><div class="metrica"><span class="et">Insumos</span><span class="val">' + lista.length + '</span><span class="det">' + preps.length + ' preparaciones</span></div></div>'
      + '<section class="panel"><h2>Preparaciones</h2>' + (preps.length ? '<div class="tabla-env"><table><thead><tr><th>Receta</th><th class="num">Porciones</th><th class="num">Volumen</th><th class="num">Factor</th></tr></thead><tbody>' + preps.map(p => { const rb = C.rendimientoBase(p.r); return '<tr class="clic" tabindex="0" data-ir="#receta-' + p.r.id + '"><td>' + esc(p.r.nombre) + (p.base ? ' <span class="pill">base</span>' : '') + '</td><td class="num"><b>' + C.fmtCant(p.porc) + '</b></td><td class="num">' + (rb ? C.fmtLegible(rb.base * p.porc / C.porcionesReceta(p.r), rb.dim) : '—') + '</td><td class="num">×' + C.fmtCant(p.porc / C.porcionesReceta(p.r)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="tenue">Nada que preparar con los eventos elegidos.</p>') + '</section>'
      + '<section class="panel"><h2>Lista de compras</h2>' + (lista.length ? Object.keys(porCat).map(cat => '<h3 class="ceja" style="margin-top:6px">' + esc(cat) + '</h3><div class="tabla-env"><table><thead><tr><th>Insumo</th><th class="num">Bruto a surtir</th><th class="num">Comprar</th><th>Proveedor</th><th class="num">Costo</th></tr></thead><tbody>' + porCat[cat].map(f => '<tr><td>' + esc(f.nombre) + '</td><td class="num"><b>' + C.fmtLegible(f.brutaBase, f.dim) + '</b></td><td class="num">' + f.empaquesCompra + ' × ' + C.fmtCant(f.presentacion) + ' ' + esc(C.nombreUnidad(f.unidadCompra)) + '</td><td>' + esc(f.proveedor || '—') + '</td><td class="num">' + dinero(f.costoCompra) + '</td></tr>').join('') + '</tbody></table></div>').join('') : '<div class="vacio"><p>No hay insumos por comprar. Ajusta las fechas o los estatus para incluir eventos.</p></div>') + '</section></div>'
      + '<aside class="pegajoso"><section class="panel" data-libre><h2>Periodo y eventos</h2><div class="campos" style="grid-template-columns:repeat(2,minmax(0,1fr))"><label class="campo"><span>Desde</span><input type="date" id="cDesde" value="' + esc(e.desde) + '" data-libre></label><label class="campo"><span>Hasta</span><input type="date" id="cHasta" value="' + esc(e.hasta) + '" data-libre></label></div>'
      + '<div class="campo"><span class="etq">Estatus que se incluyen</span><div class="chips-sel">' + D.ESTATUS.filter(s => s.id !== 'cancelada').map(s => '<label><input type="checkbox" data-est value="' + s.id + '"' + (e.est.includes(s.id) ? ' checked' : '') + ' data-libre>' + s.nombre + '</label>').join('') + '</div></div>'
      + (eventos.length ? '<ul class="lista-alertas">' + eventos.map(x => '<li><label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-accion="alternarEvento" data-id="' + x.id + '"' + (e.fuera.includes(x.id) ? '' : ' checked') + ' data-libre><span><b>' + esc(x.nombre || x.folio) + '</b><br><span class="tenue">' + fechaCorta(x.fecha) + ' · ' + n0(x.personas) + ' personas</span></span></label>' + pillEstatus(x.estatus) + '</li>').join('') + '</ul>' : '<p class="tenue">No hay eventos con fecha en este periodo y con esos estatus.</p>')
      + '</section></aside></div>';
  }

  /* ================================================================ USUARIOS */
  let cuentas = null;
  function vUsuarios() {
    const nombreRol = id => (N.ROLES.find(r => r.id === id) || { nombre: id }).nombre;
    const pintarLista = () => {
      const cont = $('listaUsuarios'); if (!cont) return;
      if (!cuentas) { cont.innerHTML = '<p class="tenue">Cargando cuentas…</p>'; return; }
      const orden = { false: 0, true: 1 };
      const filas = cuentas.slice().sort((a, b) => orden[!!a.activo] - orden[!!b.activo] || String(a.correo).localeCompare(String(b.correo))).map(u => {
        const yo = u.id === N.sesion().uid;
        const intocable = yo || (u.rol === 'owner' && rol() !== 'owner');
        const estado = u.activo ? '<span class="pill ok">Activa</span>' : u.bloqueada ? '<span class="pill error">Bloqueada</span>' : '<span class="pill alerta">Por aprobar</span>';
        const rolSel = intocable || u.rol === 'owner' ? nombreRol(u.rol) + (yo ? ' <span class="tenue">(tú)</span>' : '')
          : '<select data-uid="' + u.id + '" class="selRol" aria-label="Rol">' + N.ROLES.filter(r => r.id !== 'owner').map(r => '<option value="' + r.id + '"' + (r.id === u.rol ? ' selected' : '') + '>' + r.nombre + '</option>').join('') + '</select>';
        const acc = intocable ? '' : (u.activo ? '<button class="btn chico" data-accion="bloquear" data-uid="' + u.id + '">Bloquear</button>' : '<button class="btn chico primario" data-accion="aprobar" data-uid="' + u.id + '">Aprobar</button>') + '<button class="icono-btn" data-accion="quitarCuenta" data-uid="' + u.id + '" aria-label="Eliminar cuenta">✕</button>';
        return '<tr><td><b>' + esc(u.nombre || u.correo) + '</b><br><span class="tenue">' + esc(u.correo) + '</span></td><td>' + rolSel + '</td><td>' + estado + '</td><td class="tenue">' + (u.ultimoAcceso ? fechaCorta(u.ultimoAcceso) : '—') + '</td><td class="acc">' + acc + '</td></tr>';
      }).join('');
      cont.innerHTML = '<div class="tabla-env"><table><thead><tr><th>Cuenta</th><th>Rol</th><th>Acceso</th><th>Último acceso</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>';
      cont.querySelectorAll('.selRol').forEach(s => s.addEventListener('change', () => actualizarCuenta(s.dataset.uid, { rol: s.value })));
    };
    const cargar = () => { N.usuarios().then(l => { cuentas = l; pintarLista(); }).catch(err => { $('listaUsuarios').innerHTML = '<div class="nota alerta">No se pudieron leer las cuentas: ' + esc(err.message) + '</div>'; }); };
    const actualizarCuenta = (uid, cambios) => {
      const u = cuentas.find(x => x.id === uid); if (!u) return;
      const nuevo = Object.assign({}, u, cambios);
      N.guardarUsuario(nuevo).then(() => { Object.assign(u, cambios); pintarLista(); aviso('Cuenta actualizada'); }).catch(err => { aviso(err.message === 'SIN_PERMISO' ? 'No tienes permiso para cambiar esta cuenta' : 'No se pudo guardar', true); pintarLista(); });
    };
    ctx.alPintar = () => { pintarLista(); cargar(); };
    ctx.acciones = {
      aprobar: d => actualizarCuenta(d.uid, { activo: true, bloqueada: false }),
      bloquear: d => actualizarCuenta(d.uid, { activo: false, bloqueada: true }),
      quitarCuenta: d => { const u = cuentas.find(x => x.id === d.uid); confirmar('Eliminar cuenta', 'Se quitará el acceso de <b>' + esc(u.correo) + '</b>. Si vuelve a entrar, quedará como solicitud por aprobar.', 'Eliminar', () => N.borrarUsuario(d.uid).then(() => { cuentas = cuentas.filter(x => x.id !== d.uid); pintarLista(); aviso('Cuenta eliminada'); }).catch(() => aviso('No se pudo eliminar', true))); },
      nuevaCuenta: () => {
        const temp = 'Civizo-' + Math.random().toString(36).slice(2, 8);
        abrirModal({
          titulo: 'Agregar cuenta',
          cuerpo: '<div class="campos"><label class="campo ancho"><span>Correo</span><input id="nc-correo" type="email" autocomplete="off"></label><label class="campo"><span>Nombre</span><input id="nc-nombre" type="text" autocomplete="off"></label><label class="campo"><span>Rol</span><select id="nc-rol">' + N.ROLES.filter(r => r.id !== 'owner').map(r => '<option value="' + r.id + '"' + (r.id === 'editor' ? ' selected' : '') + '>' + r.nombre + '</option>').join('') + '</select></label><label class="campo ancho"><span>Contraseña temporal</span><input id="nc-clave" type="text" value="' + temp + '" autocomplete="off"><small>Compártela con la persona. También le llegará un correo para que elija la suya.</small></label></div>',
          botones: [{ texto: 'Cancelar', clase: 'fantasma' }, {
            texto: 'Crear cuenta', clase: 'primario', accion: c => {
              const correo = c.querySelector('#nc-correo').value.trim(), nombre = c.querySelector('#nc-nombre').value.trim(), r = c.querySelector('#nc-rol').value, clave = c.querySelector('#nc-clave').value;
              if (!correo) { aviso('Escribe el correo', true); return false; }
              N.crearCuentaAjena(correo, clave).then(uid => {
                const ahora = new Date().toISOString();
                const u = { id: uid, correo, nombre, rol: r, activo: true, creado: ahora, creadoPor: N.sesion().correo };
                return N.guardarUsuario(u).then(() => { cuentas = (cuentas || []).concat(u); pintarLista(); N.enviarRestablecer(correo).catch(() => { }); aviso('Cuenta creada para ' + correo); });
              }).catch(err => aviso(err.message, true));
            }
          }]
        });
      }
    };
    return '<div class="cabecera"><div><span class="ceja">Administración</span><h1>Usuarios</h1><p class="sub">Quién puede entrar y qué puede hacer. Las personas que se registran solas quedan por aprobar.</p></div><div class="acciones"><button class="btn primario" data-accion="nuevaCuenta">' + ico('mas') + 'Agregar cuenta</button></div></div>'
      + '<div class="rejilla r-lateral"><section class="panel" id="listaUsuarios"></section>'
      + '<aside><section class="panel"><h2>Roles</h2><div class="resumen">' + N.ROLES.map(r => '<div class="fila"><span><b>' + r.nombre + '</b><br><span class="tenue">' + r.desc + '</span></span></div>').join('') + '</div><p class="tenue">Comparte la dirección de la plataforma. Quien cree su cuenta aparecerá aquí para que la apruebes.</p></section></aside></div>';
  }

  /* ---------------------------------------------------------- Solo lectura */
  const ACC_LECTURA = new Set(['irComparar', 'soloComp', 'pedidosProveedor', 'filtroCobranza', 'recibo', 'estadoCuenta', 'verEvento', 'filtroSol', 'modoPrecios', 'buscar', 'cuenta', 'ficha', 'ordenProduccion', 'compras', 'escalaAtajo', 'simAtajo', 'cotizacion', 'costoInterno', 'produccion', 'filtrarLinea', 'verLinea', 'escalaRapida', 'abrirEscalador', 'irBusca', 'imprimirCompras', 'csvCompras', 'alternarEvento', 'exportarCSV', 'editarInsumo']);
  const ENTRADAS_LIBRES = /^(fq|fcat|ftipo|fest|escValor|escModo|simPersonas|rapidaReceta|rapidaPorc|buscaGlobal|cDesde|cHasta)$/;
  function aplicarSoloLectura() {
    capaActual().querySelectorAll('input, select, textarea').forEach(el => { if (!ENTRADAS_LIBRES.test(el.id) && !el.hasAttribute('data-libre')) el.disabled = true; });
    capaActual().querySelectorAll('[data-accion]').forEach(el => { if (!ACC_LECTURA.has(el.dataset.accion)) el.hidden = true; });
  }

  /* ============================================================ Nube: acceso */
  function pantallaAcceso(modo, error) {
    modo = modo || 'entrar';
    const registro = modo === 'registro';
    $('vista').innerHTML = '<div class="acceso"><form class="acceso-tarjeta" id="fAcceso" novalidate>'
      + '<div class="acceso-marca">' + ISOTIPO + '<div><b>CIVIZO</b><small>Servicios alimentarios</small></div></div>'
      + '<h1>' + (registro ? 'Crear cuenta' : 'Entrar') + '</h1><p class="sub">' + (registro ? 'Un administrador aprobará tu acceso.' : 'Costeo, recetas y eventos de tu cocina.') + '</p>'
      + (registro ? '<label class="campo"><span>Nombre</span><input id="aNombre" type="text" autocomplete="name"></label>' : '')
      + '<label class="campo"><span>Correo</span><input id="aCorreo" type="email" autocomplete="email" required></label>'
      + '<label class="campo"><span>Contraseña</span><input id="aClave" type="password" autocomplete="' + (registro ? 'new-password' : 'current-password') + '" required></label>'
      + '<p class="acceso-error" id="aError" role="alert">' + esc(error || '') + '</p>'
      + '<button class="btn primario" type="submit" id="aBtn">' + (registro ? 'Crear cuenta' : 'Entrar') + '</button>'
      + '<div class="acceso-pie">' + (registro ? '<button type="button" class="btn fantasma" id="aCambio">Ya tengo cuenta</button>' : '<button type="button" class="btn fantasma" id="aCambio">Crear cuenta</button><button type="button" class="btn fantasma" id="aOlvido">Olvidé mi contraseña</button>') + '</div>'
      + '</form></div>';
    $('aCambio').addEventListener('click', () => pantallaAcceso(registro ? 'entrar' : 'registro'));
    if ($('aOlvido')) $('aOlvido').addEventListener('click', () => {
      const correo = $('aCorreo').value.trim();
      if (!correo) { $('aError').textContent = 'Escribe tu correo y vuelve a tocar "Olvidé mi contraseña".'; return; }
      N.enviarRestablecer(correo).then(() => { $('aError').textContent = ''; aviso('Te enviamos un correo para cambiar tu contraseña'); }).catch(e => { $('aError').textContent = e.message; });
    });
    $('fAcceso').addEventListener('submit', async ev => {
      ev.preventDefault();
      const correo = $('aCorreo').value.trim(), clave = $('aClave').value;
      if (!correo || !clave) { $('aError').textContent = 'Escribe tu correo y tu contraseña.'; return; }
      $('aBtn').disabled = true; $('aError').textContent = '';
      try {
        if (registro) await N.registrarme(correo, clave); else await N.entrar(correo, clave);
        entrarConSesion(registro ? $('aNombre').value.trim() : '');
      } catch (e) { $('aError').textContent = e.message; $('aBtn').disabled = false; }
    });
    setTimeout(() => $('aCorreo').focus(), 30);
  }
  function pantallaMensaje(titulo, texto, botones) {
    $('vista').innerHTML = '<div class="acceso"><div class="acceso-tarjeta"><div class="acceso-marca">' + ISOTIPO + '<div><b>CIVIZO</b><small>Servicios alimentarios</small></div></div><h1>' + titulo + '</h1><p class="sub">' + texto + '</p><div class="acceso-pie" id="msjBotones"></div></div></div>';
    (botones || []).forEach(b => { const el = document.createElement('button'); el.type = 'button'; el.className = 'btn ' + (b.clase || ''); el.textContent = b.texto; el.onclick = b.accion; $('msjBotones').appendChild(el); });
  }
  function salir() { N.salir(); perfil = null; db = D.vacio(); reindexar(); pila = []; entradas = 0; history.replaceState(estadoHist(), '', urlDe()); pantallaAcceso(); }
  async function entrarConSesion(nombre) {
    pantallaMensaje('Conectando…', 'Descargando la información de tu cocina.');
    try {
      perfil = await N.perfil(nombre);
      if (!perfil.activo) {
        const p = perfil; perfil = null;
        return pantallaMensaje(p.bloqueada ? 'Cuenta bloqueada' : 'Tu cuenta está por aprobar', esc(p.correo) + (p.bloqueada ? ' no tiene acceso. Habla con un administrador.' : ' ya quedó registrada. Pide a un administrador que la apruebe en <b>Usuarios</b> y vuelve a intentar.'), [{ texto: 'Volver a intentar', clase: 'primario', accion: () => entrarConSesion() }, { texto: 'Salir', accion: salir }]);
      }
      db = D.normalizar(await N.cargarTodo(D.vacio));
      N.fijarBase(db); reindexar();
      $('vista').innerHTML = '';
      iniciarPila();
      iniciarSondeo();
      if (perfil.primero) bienvenidaDueno();
    } catch (e) {
      if (e.message === 'SIN_SESION') return pantallaAcceso('entrar', 'Tu sesión terminó. Vuelve a entrar.');
      perfil = null;
      pantallaMensaje('No se pudo conectar', e.message === 'SIN_PERMISO' ? 'Firebase rechazó la lectura. Revisa que las reglas de config/firestore.rules estén publicadas.' : e.red || e.message === 'SIN_CONEXION' ? 'Sin conexión con el servidor. Revisa tu internet.' : esc(e.message), [{ texto: 'Reintentar', clase: 'primario', accion: () => entrarConSesion() }, { texto: 'Salir', accion: salir }]);
    }
  }
  function datosLocalesGuardados() {
    try { const t = localStorage.getItem(D.CLAVE); return t ? D.normalizar(JSON.parse(t)) : null; } catch (e) { return null; }
  }
  function subirDatosLocales() {
    const loc = datosLocalesGuardados();
    if (!loc) return aviso('No hay información guardada en este equipo', true);
    let n = 0;
    ['insumos', 'recetas', 'servicios', 'eventos', 'proveedores'].forEach(k => { const ids = new Set(db[k].map(x => x.id)); loc[k].forEach(x => { if (!ids.has(x.id)) { db[k].push(x); n++; } }); });
    if (!db.insumos.length && !n) return aviso('No hay nada nuevo que subir');
    if (loc.empresa && !db.empresa.telefono && !db.empresa.correo) Object.assign(db.empresa, loc.empresa);
    cambioEstructura(); render();
    aviso(n + ' elementos subidos a la nube');
  }
  function bienvenidaDueno() {
    const loc = datosLocalesGuardados();
    const cuantos = loc ? loc.insumos.length + loc.recetas.length + loc.servicios.length + loc.eventos.length : 0;
    abrirModal({
      titulo: 'Eres el dueño de esta cocina', compacto: true,
      cuerpo: '<p>Tu cuenta es la primera del proyecto, así que tiene todos los permisos. Las demás personas que se registren quedarán por aprobar en <b>Usuarios</b>.</p>'
        + (cuantos ? '<div class="nota acento">Este navegador tiene <b>' + cuantos + ' elementos</b> capturados en modo local. Puedes subirlos a la nube ahora.</div>' : '<p>La nube está vacía. Puedes empezar a capturar o cargar los datos de ejemplo.</p>'),
      botones: cuantos
        ? [{ texto: 'Después', clase: 'fantasma' }, { texto: 'Subir lo de este equipo', clase: 'primario', accion: () => subirDatosLocales() }]
        : [{ texto: 'Empezar vacío', clase: 'fantasma' }, { texto: 'Cargar datos de ejemplo', clase: 'primario', accion: () => { const ej = D.ejemplo(); ['insumos', 'recetas', 'servicios', 'eventos', 'proveedores'].forEach(k => { db[k] = db[k].concat(ej[k]); }); cambioEstructura(); render(); } }]
    });
  }
  let pendienteRemoto = false, sondeando = false, tSondeo = null;
  function iniciarSondeo() {
    clearInterval(tSondeo);
    tSondeo = setInterval(sondear, 60000);
  }
  async function sondear() {
    if (!NUBE || !perfil || sondeando || document.hidden) return;
    sondeando = true;
    try {
      if (await N.sondear(db)) { reindexar(); refrescarPorRemoto(); }
    } catch (e) { if (e.message === 'SIN_SESION') salir(); }
    sondeando = false;
  }
  function editandoAhora() {
    const a = document.activeElement;
    return !$('modal').hidden || (a && $('vista').contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && !ENTRADAS_LIBRES.test(a.id));
  }
  function refrescarPorRemoto() { if (editandoAhora()) pendienteRemoto = true; else { pendienteRemoto = false; render(); } }
  document.addEventListener('focusout', () => setTimeout(() => { if (pendienteRemoto && !editandoAhora()) { pendienteRemoto = false; render(); } }, 50));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sondear(); });
  window.addEventListener('beforeunload', ev => { if (NUBE && perfil && N.hayPendientes(db)) { ev.preventDefault(); ev.returnValue = ''; } });

  function iniciarPila() {
    const h = limpiar(location.hash);
    pila = h && h !== 'inicio' ? [h] : [];
    entradas = 0;
    history.replaceState(estadoHist(), '', urlDe());
    pintar('reemplazo');
  }
  function arrancar() {
    if (!NUBE) { iniciarPila(); return; }
    N.alEstado(estado => {
      const txt = { pendiente: 'Guardando…', ok: 'Guardado en la nube', error: 'Sin conexión · se reintentará', 'sin-permiso': 'Tu cuenta no tiene permiso para guardar' }[estado];
      mostrarEstado(estado === 'ok' ? 'ok' : estado === 'pendiente' ? 'pendiente' : 'error', txt);
      if (estado === 'sin-permiso') aviso('Tu cuenta no tiene permiso para guardar cambios', true);
    });
    if (!N.sesion()) return pantallaAcceso();
    entrarConSesion();
  }

  /* ================================================================ PROVEEDORES
     El vínculo con insumos y cotizaciones es por nombre (insumo.proveedor y
     cotizacion.fuente). Cambiar el nombre del proveedor actualiza esas
     referencias. */
  const TIPOS_PROV = ['Supermercado', 'Mayorista / Central de abastos', 'Distribuidor', 'Productor', 'Club de precios', 'Otro'];
  const PAGO_PROV = ['Contado', 'Crédito', 'Transferencia anticipada'];
  const provPorNombre = nombre => db.proveedores.find(p => norm(p.nombre) === norm(nombre));
  /** Todas las fuentes usadas en cotizaciones o como "dónde se cotizó". */
  function fuentesUsadas() {
    const m = new Map();
    db.insumos.forEach(i => {
      if (i.proveedor) m.set(norm(i.proveedor), m.get(norm(i.proveedor)) || i.proveedor);
      (i.cotizaciones || []).forEach(c => { if (c.fuente) m.set(norm(c.fuente), m.get(norm(c.fuente)) || c.fuente); });
    });
    return Array.from(m.values());
  }
  /** Mejor precio por unidad de cada insumo y quién lo da. */
  function mejoresPrecios() {
    const r = new Map();
    db.insumos.forEach(i => {
      const dim = C.dimension(i.unidadCompra);
      let mejor = null;
      (i.cotizaciones || []).forEach(c => {
        if (C.dimension(c.unidad) !== dim) return;
        const u = costoPorUnidad(c.precio, c.presentacion, c.unidad);
        if (u > 0 && (!mejor || u < mejor.porU)) mejor = { porU: u, fuente: c.fuente, cot: c };
      });
      r.set(i.id, mejor);
    });
    return r;
  }
  function statsProveedor(nombre, mejores) {
    mejores = mejores || mejoresPrecios();
    const filas = [];
    db.insumos.forEach(i => {
      const dim = C.dimension(i.unidadCompra);
      const cots = (i.cotizaciones || []).filter(c => norm(c.fuente) === norm(nombre) && C.dimension(c.unidad) === dim);
      if (!cots.length) return;
      const c = cots.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))[0];
      const porU = costoPorUnidad(c.precio, c.presentacion, c.unidad), m = mejores.get(i.id);
      filas.push({ ins: i, cot: c, porU, mejor: m, esMejor: m && porU <= m.porU + 1e-9, sobre: m && m.porU > 0 ? (porU - m.porU) / m.porU * 100 : 0, enCosteo: norm(i.proveedor) === norm(nombre) });
    });
    const ultima = filas.reduce((u, f) => String(f.cot.fecha || '') > u ? String(f.cot.fecha) : u, '');
    return { filas, n: filas.length, mejor: filas.filter(f => f.esMejor).length, enCosteo: filas.filter(f => f.enCosteo).length, ultima };
  }
  function nuevoProveedor(nombre, abrirDespues) {
    const p = { id: 'prv-' + D.uid(), nombre: nombre || '', tipo: '', contacto: '', telefono: '', whatsapp: '', correo: '', direccion: '', web: '', rfc: '', pago: 'Contado', diasCredito: '', pedidoMinimo: '', entrega: '', notas: '', creado: D.ahora(), actualizado: D.ahora() };
    db.proveedores.push(p); cambioEstructura();
    if (abrirDespues !== false) { abrir('proveedor-' + p.id); setTimeout(() => { const n = $('f-nombre'); if (n && !nombre) n.focus(); }, 60); }
    return p;
  }
  const filtroProv = { q: '' };
  function vProveedores() {
    const mejores = mejoresPrecios();
    const q = norm(filtroProv.q);
    const lista = db.proveedores.filter(p => !q || norm([p.nombre, p.tipo, p.contacto].join(' ')).includes(q)).map(p => ({ p, s: statsProveedor(p.nombre, mejores) }))
      .sort((a, b) => b.s.n - a.s.n || sortNombre(a.p, b.p));
    const detectados = fuentesUsadas().filter(f => !provPorNombre(f)).sort((a, b) => a.localeCompare(b, 'es'));
    const tarjeta = ({ p, s }) => '<a class="tarjeta" href="#proveedor-' + p.id + '"><div class="tarjeta-cab"><h3>' + esc(p.nombre || 'Proveedor sin nombre') + '</h3>' + (p.tipo ? '<span class="pill">' + esc(p.tipo) + '</span>' : '') + '</div>'
      + '<span class="meta">' + esc([p.contacto, p.telefono || p.whatsapp, p.pago === 'Crédito' && C.num(p.diasCredito) ? 'crédito ' + C.num(p.diasCredito) + ' días' : p.pago].filter(Boolean).join(' · ') || 'Sin datos de contacto') + '</span>'
      + '<div class="cifras"><div><b>' + s.n + '</b><span>insumos cotizados</span></div><div><b>' + s.mejor + '</b><span>con el mejor precio</span></div><div><b>' + (s.ultima ? textoEdad(s.ultima) : '—') + '</b><span>última cotización</span></div></div></a>';
    ctx.acciones = {
      agregarDetectado: d => { nuevoProveedor(d.nombre, false); render(); aviso('Proveedor agregado: ' + d.nombre); },
      agregarTodos: () => { detectados.forEach(n => nuevoProveedor(n, false)); render(); aviso(detectados.length + ' proveedores agregados'); },
      nuevoProveedor: () => nuevoProveedor(''),
      irComparar: () => abrir('comparar')
    };
    ctx.alPintar = () => { const b = $('fqv'); b.addEventListener('input', () => { filtroProv.q = b.value; const pos = b.selectionStart; render(); const nb = $('fqv'); nb.focus(); try { nb.setSelectionRange(pos, pos); } catch (er) { /* */ } }); };
    return '<div class="cabecera"><div><span class="ceja">Compras</span><h1>Proveedores</h1></div><div class="acciones"><button class="btn" data-accion="irComparar">' + ico('tablero') + 'Comparar precios</button><button class="btn primario" data-accion="nuevoProveedor">' + ico('mas') + 'Nuevo proveedor</button></div></div>'
      + (detectados.length ? '<section class="panel"><div class="panel-cab"><div><h2>Detectados en tus cotizaciones</h2><p>Tiendas que ya usas y aún no están en tu catálogo.</p></div>' + (detectados.length > 1 ? '<button class="btn chico" data-accion="agregarTodos">Agregar todos</button>' : '') + '</div><div class="chips-sel">' + detectados.map(n => '<button type="button" class="btn chico" data-accion="agregarDetectado" data-nombre="' + esc(n) + '">' + ico('mas') + esc(n) + '</button>').join('') + '</div></section>' : '')
      + '<div class="filtros"><input type="search" id="fqv" placeholder="Buscar proveedor" value="' + esc(filtroProv.q) + '" aria-label="Buscar proveedor"></div>'
      + (lista.length ? '<div class="tarjetas">' + lista.map(tarjeta).join('') + '</div>' : '<div class="vacio"><h3>' + (db.proveedores.length ? 'Ningún proveedor coincide' : 'Aún no hay proveedores') + '</h3><p>Agrega a quién le compras: contacto, condiciones de pago y días de entrega. Sus cotizaciones se ligan solas por el nombre.</p><button class="btn primario" data-accion="nuevoProveedor">' + ico('mas') + 'Nuevo proveedor</button></div>');
  }
  function telLimpio(t) { return String(t || '').replace(/[^\d+]/g, ''); }
  function waDe(t) { const n = String(t || '').replace(/\D/g, ''); return n.length >= 10 ? (n.length === 10 ? '52' + n : n) : ''; }
  function vProveedor(id) {
    const p = db.proveedores.find(x => x.id === id);
    if (!p) return noEncontrado('El proveedor');
    ctx.obj = p;
    const s = statsProveedor(p.nombre);
    const filas = s.filas.sort((a, b) => a.ins.nombre.localeCompare(b.ins.nombre, 'es')).map(f => '<tr class="clic" tabindex="0" data-ir="#insumo-' + f.ins.id + '"><td><b>' + esc(f.ins.nombre) + '</b>' + (f.enCosteo ? ' <span class="pill acento">En costeo</span>' : '') + '<br><span class="tenue">' + textoEdad(f.cot.fecha) + '</span></td>'
      + '<td class="num">' + dinero(f.cot.precio) + '<br><span class="tenue">' + C.fmtCant(f.cot.presentacion) + ' ' + esc(C.nombreUnidad(f.cot.unidad)) + '</span></td>'
      + '<td class="num"><b>' + dinero(f.porU) + ' / ' + unBase(C.dimension(f.cot.unidad)) + '</b></td>'
      + '<td>' + (f.esMejor ? '<span class="pill ok">Mejor precio</span>' : '<span class="pill alerta">+' + f.sobre.toFixed(1) + ' %</span><br><span class="tenue">' + esc(f.mejor.fuente) + ' ' + dinero(f.mejor.porU) + '</span>') + '</td></tr>').join('');
    const nombreViejo = { v: p.nombre };
    ctx.alCambiar = (obj, campo, v) => {
      if (campo !== 'nombre') return false;
      const viejo = nombreViejo.v;
      if (viejo && norm(viejo) !== norm(v) && v.trim()) {
        db.insumos.forEach(i => { if (norm(i.proveedor) === norm(viejo)) i.proveedor = v; (i.cotizaciones || []).forEach(c => { if (norm(c.fuente) === norm(viejo)) c.fuente = v; }); });
        nombreViejo.v = v;
      }
      obj.nombre = v; return true;
    };
    ctx.recalcular = () => actualizarTitulo(p.nombre || 'Proveedor');
    ctx.acciones = {
      eliminar: () => confirmar('Eliminar proveedor', 'Se quitará <b>' + esc(p.nombre || 'este proveedor') + '</b> del catálogo. Sus cotizaciones en los insumos se conservan.', 'Eliminar', () => { db.proveedores = db.proveedores.filter(x => x.id !== p.id); cambioEstructura(); atras(); aviso('Proveedor eliminado'); })
    };
    const wa = waDe(p.whatsapp || p.telefono);
    return '<div class="cabecera"><div><span class="ceja">Proveedor' + (p.tipo ? ' · ' + esc(p.tipo) : '') + '</span><h1>' + esc(p.nombre || 'Nuevo proveedor') + '</h1></div>'
      + '<div class="acciones">' + (wa ? '<a class="btn" href="https://wa.me/' + wa + '" target="_blank" rel="noopener">' + ico('chat') + 'WhatsApp</a>' : '') + (p.telefono ? '<a class="btn" href="tel:' + esc(telLimpio(p.telefono)) + '">' + ico('telefono') + 'Llamar</a>' : '') + (p.web ? '<a class="btn" href="' + esc(/^https?:/.test(p.web) ? p.web : 'https://' + p.web) + '" target="_blank" rel="noopener">' + ico('externo') + 'Sitio</a>' : '') + '<button class="btn peligro" data-accion="eliminar">' + ico('borrar') + 'Eliminar</button></div></div>'
      + '<div class="rejilla r-lateral"><div class="rejilla">'
      + '<section class="panel"><h2>Datos</h2><div class="campos">'
      + campoTexto('Nombre', 'nombre', p.nombre, { ancho: true, ph: 'Ej. Central de Abastos, Carnes del Norte', ayuda: 'Debe coincidir con el nombre que usas en las cotizaciones' })
      + campoSelect('Tipo', 'tipo', p.tipo, [['', 'Sin tipo']].concat(TIPOS_PROV))
      + campoTexto('Contacto', 'contacto', p.contacto, { ph: 'Nombre de quien atiende' })
      + campoTexto('Teléfono', 'telefono', p.telefono, { tipo: 'tel' }) + campoTexto('WhatsApp', 'whatsapp', p.whatsapp, { tipo: 'tel', ph: '81 1234 5678' })
      + campoTexto('Correo', 'correo', p.correo, { tipo: 'email' }) + campoTexto('RFC', 'rfc', p.rfc)
      + campoTexto('Dirección', 'direccion', p.direccion, { ancho: true }) + campoTexto('Sitio web', 'web', p.web, { ancho: true, ph: 'https://…' })
      + '</div></section>'
      + '<section class="panel"><div class="panel-cab"><div><h2>Lo que le cotizamos</h2><p>Su precio más reciente por insumo, comparado con el mejor que tienes.</p></div></div>'
      + (filas ? '<div class="tabla-env"><table><thead><tr><th>Insumo</th><th class="num">Precio</th><th class="num">Por unidad</th><th>Comparado</th></tr></thead><tbody>' + filas + '</tbody></table></div>' : '<p class="tenue">Aún no hay cotizaciones con el nombre «' + esc(p.nombre) + '». Agrégalas desde cada insumo o en Actualizar precios.</p>')
      + '</section></div><aside class="pegajoso rejilla">'
      + '<section class="panel"><h2>Resumen</h2><div class="caja-doble"><div><span class="et">Cotizados</span><b>' + s.n + '</b></div><div class="acento"><span class="et">Mejor precio</span><b>' + s.mejor + '</b></div></div><div class="resumen"><div class="fila"><span>Insumos que costeas con él</span><span>' + s.enCosteo + '</span></div><div class="fila"><span>Última cotización</span><span>' + (s.ultima ? fechaCorta(s.ultima) : '—') + '</span></div></div></section>'
      + '<section class="panel"><h2>Condiciones</h2><div class="campos" style="grid-template-columns:minmax(0,1fr)">'
      + campoSelect('Forma de pago', 'pago', p.pago, PAGO_PROV)
      + campoTexto('Días de crédito', 'diasCredito', p.diasCredito, { num: true, suf: 'días' })
      + campoTexto('Pedido mínimo', 'pedidoMinimo', p.pedidoMinimo, { num: true, suf: 'MXN' })
      + campoTexto('Días y horario de entrega', 'entrega', p.entrega, { ph: 'Lun a vie, 7:00 a 10:00' })
      + campoTexto('Notas', 'notas', p.notas, { area: true, filas: 3 })
      + '</div></section></aside></div>';
  }

  /* ---------------------------------------------------------------- Comparar precios */
  const filtroComp = { cat: '', solo: 'varios' };
  function vComparar() {
    const mejores = mejoresPrecios();
    const cats = Array.from(new Set(db.insumos.map(i => i.categoria || 'Otros'))).sort((a, b) => a.localeCompare(b, 'es'));
    const base = db.insumos.filter(i => (!filtroComp.cat || (i.categoria || 'Otros') === filtroComp.cat));
    const conCot = base.filter(i => (i.cotizaciones || []).filter(c => C.dimension(c.unidad) === C.dimension(i.unidadCompra)).length >= (filtroComp.solo === 'varios' ? 2 : 1)).sort(sortNombre);
    const cuenta = new Map();
    conCot.forEach(i => new Set((i.cotizaciones || []).map(c => norm(c.fuente))).forEach(f => cuenta.set(f, (cuenta.get(f) || 0) + 1)));
    const nombreDe = f => { for (const i of db.insumos) for (const c of i.cotizaciones || []) if (norm(c.fuente) === f) return c.fuente; return f; };
    const cols = Array.from(cuenta.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f]) => ({ f, nombre: nombreDe(f) }));
    let caros = 0;
    const filas = conCot.map(i => {
      const dim = C.dimension(i.unidadCompra), un = unBase(dim), m = mejores.get(i.id);
      const actual = C.costoBaseCompra(i) * factorBase(dim);
      const sobre = m && m.porU > 0 && actual > m.porU + 1e-6 ? (actual - m.porU) / m.porU * 100 : 0;
      if (sobre > .5) caros++;
      const celdas = cols.map(col => {
        const cs = (i.cotizaciones || []).filter(c => norm(c.fuente) === col.f && C.dimension(c.unidad) === dim);
        if (!cs.length) return '<td class="num tenue">—</td>';
        const u = Math.min(...cs.map(c => costoPorUnidad(c.precio, c.presentacion, c.unidad)));
        return '<td class="num' + (m && u <= m.porU + 1e-9 ? ' mejor' : '') + '">' + dinero(u) + '</td>';
      }).join('');
      return '<tr><td><a href="#insumo-' + i.id + '"><b>' + esc(i.nombre) + '</b></a><br><span class="tenue">por ' + un + ' · costeo ' + dinero(actual) + (i.proveedor ? ' (' + esc(i.proveedor) + ')' : '') + '</span></td>' + celdas
        + '<td class="acc">' + (sobre > .5 ? '<span class="pill alerta">+' + sobre.toFixed(1) + ' %</span> <button class="btn chico" data-accion="usarMejor" data-id="' + i.id + '">Usar ' + esc(m.fuente) + '</button>' : '<span class="pill ok">Mejor</span>') + '</td></tr>';
    }).join('');
    ctx.acciones = {
      usarMejor: d => { const i = IX.insumos.get(d.id), m = mejores.get(d.id); if (!i || !m) return; registrarPrecio(i, { precio: m.cot.precio, presentacion: m.cot.presentacion, unidadCompra: m.cot.unidad }, m.fuente); if (m.cot.enlace) i.enlace = m.cot.enlace; cambioEstructura(); render(); aviso(i.nombre + ': ahora se costea con ' + m.fuente); },
      soloComp: d => { filtroComp.solo = d.solo; render(); }
    };
    ctx.alPintar = () => { $('fcc').addEventListener('change', ev => { filtroComp.cat = ev.target.value; render(); }); };
    return '<div class="cabecera"><div><span class="ceja">Proveedores</span><h1>Comparar precios</h1></div></div>'
      + '<div class="metricas"><div class="metrica destacada"><span class="et">Se pueden abaratar</span><span class="val">' + caros + '</span><span class="det">insumos costeados sin el mejor precio</span></div><div class="metrica"><span class="et">Comparados</span><span class="val">' + conCot.length + '</span><span class="det">insumos en la tabla</span></div><div class="metrica"><span class="et">Proveedores</span><span class="val">' + cuenta.size + '</span><span class="det">con cotizaciones</span></div><div class="metrica"><span class="et">Precio</span><span class="val" style="font-size:1rem">por kg, L o pza</span><span class="det">para comparar parejo</span></div></div>'
      + '<div class="filtros"><select id="fcc" aria-label="Categoría"><option value="">Todas las categorías</option>' + cats.map(c => '<option' + (c === filtroComp.cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>'
      + '<div class="pestanas">' + [['varios', 'Con 2 o más cotizaciones'], ['todos', 'Todos los cotizados']].map(o => '<button class="' + (filtroComp.solo === o[0] ? 'activa' : '') + '" data-accion="soloComp" data-solo="' + o[0] + '">' + o[1] + '</button>').join('') + '</div></div>'
      + (filas ? '<section class="panel"><div class="tabla-env"><table class="comparativo"><thead><tr><th>Insumo</th>' + cols.map(c => '<th class="num">' + esc(c.nombre) + '</th>').join('') + '<th></th></tr></thead><tbody>' + filas + '</tbody></table></div><p class="tenue">En verde, el mejor precio por unidad. Se comparan las cotizaciones más baratas de cada proveedor.</p></section>'
        : '<div class="vacio"><h3>Nada que comparar todavía</h3><p>Agrega la cotización de dos o más tiendas en cada insumo, o en Actualizar precios, para verlas lado a lado.</p></div>');
  }

  /* ---------------------------------------------------------------- Pedidos por proveedor */
  function gruposPorProveedor(lista) {
    const g = new Map();
    lista.forEach(f => { const k = f.proveedor || 'Sin proveedor'; if (!g.has(k)) g.set(k, []); g.get(k).push(f); });
    return Array.from(g.entries()).sort((a, b) => (a[0] === 'Sin proveedor') - (b[0] === 'Sin proveedor') || a[0].localeCompare(b[0], 'es'));
  }
  function textoPedido(nombre, filas, nota) {
    const p = provPorNombre(nombre);
    return 'Hola' + (p && p.contacto ? ' ' + p.contacto.split(' ')[0] : '') + ', le comparto el pedido de ' + (db.empresa.nombre || 'CIVIZO') + (nota ? ' (' + nota + ')' : '') + ':\n'
      + filas.map(f => '• ' + f.empaquesCompra + ' × ' + C.fmtCant(f.presentacion) + ' ' + C.nombreUnidad(f.unidadCompra) + ' de ' + f.nombre).join('\n')
      + '\n\nTotal estimado: ' + dinero(filas.reduce((s, f) => s + f.costoCompra, 0)) + '\n¡Gracias!';
  }
  function modalPedidos(lista, nota) {
    const grupos = gruposPorProveedor(lista);
    if (!grupos.length) return aviso('No hay insumos por comprar', true);
    const cuerpo = grupos.map(([nombre, filas], k) => {
      const p = provPorNombre(nombre), total = filas.reduce((s, f) => s + f.costoCompra, 0);
      const wa = p && waDe(p.whatsapp || p.telefono);
      const min = p && C.num(p.pedidoMinimo);
      return '<section class="panel pedido"><div class="panel-cab"><div><h2>' + esc(nombre) + '</h2><p>' + filas.length + ' insumo' + (filas.length === 1 ? '' : 's') + ' · ' + dinero(total) + (p && p.entrega ? ' · entrega ' + esc(p.entrega) : '') + '</p></div>'
        + '<div class="acciones">' + (nombre !== 'Sin proveedor' ? '<button type="button" class="btn chico" data-ped="orden" data-k="' + k + '">' + ico('imprimir') + 'Orden de compra</button><button type="button" class="btn chico" data-ped="copiar" data-k="' + k + '">' + ico('copiar') + 'Copiar</button>' : '') + (wa ? '<a class="btn chico primario" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(textoPedido(nombre, filas, nota)) + '" target="_blank" rel="noopener">' + ico('chat') + 'WhatsApp</a>' : '') + '</div></div>'
        + (min && total < min ? '<div class="nota alerta">El pedido mínimo de este proveedor es ' + dinero(min) + '.</div>' : '')
        + (nombre === 'Sin proveedor' ? '<div class="nota">Estos insumos no tienen proveedor. Asígnalo en "Dónde se cotizó" de cada insumo.</div>' : '')
        + '<div class="tabla-env"><table><thead><tr><th>Insumo</th><th class="num">Comprar</th><th class="num">Costo</th></tr></thead><tbody>' + filas.map(f => '<tr><td>' + esc(f.nombre) + '</td><td class="num">' + f.empaquesCompra + ' × ' + C.fmtCant(f.presentacion) + ' ' + esc(C.nombreUnidad(f.unidadCompra)) + '</td><td class="num">' + dinero(f.costoCompra) + '</td></tr>').join('') + '</tbody></table></div></section>';
    }).join('');
    abrirModal({
      titulo: 'Pedidos por proveedor', ancho: true, cuerpo: (nota ? '<p class="tenue">' + esc(nota) + '</p>' : '') + cuerpo,
      alAbrir: c => c.addEventListener('click', ev => {
        const b = ev.target.closest('[data-ped]'); if (!b) return;
        const [nombre, filas] = grupos[+b.dataset.k];
        if (b.dataset.ped === 'orden') imprimir(docOrdenCompra(nombre, filas, nota));
        else { const t = textoPedido(nombre, filas, nota); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => aviso('Pedido copiado: pégalo en WhatsApp o correo')).catch(() => aviso('No se pudo copiar', true)); }
      })
    });
  }
  function docOrdenCompra(nombre, filas, nota) {
    const p = provPorNombre(nombre) || {};
    const total = filas.reduce((s, f) => s + f.costoCompra, 0);
    const hoy = new Date(), folio = 'OC-' + String(hoy.getDate()).padStart(2, '0') + String(hoy.getMonth() + 1).padStart(2, '0') + String(hoy.getFullYear()).slice(2) + '-' + norm(nombre).replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase();
    return encabezadoDoc('Orden de compra', '<div><b>' + folio + '</b></div><div>Fecha: ' + fechaCorta(hoyISO()) + '</div>')
      + '<div class="datos"><div><b>Proveedor:</b> ' + esc(nombre) + '</div><div><b>Contacto:</b> ' + esc([p.contacto, p.telefono || p.whatsapp].filter(Boolean).join(' · ') || '—') + '</div>'
      + '<div><b>Forma de pago:</b> ' + esc(p.pago === 'Crédito' && C.num(p.diasCredito) ? 'Crédito a ' + C.num(p.diasCredito) + ' días' : p.pago || 'Contado') + '</div><div><b>Entrega:</b> ' + esc(p.entrega || 'Por confirmar') + '</div>'
      + (nota ? '<div><b>Para:</b> ' + esc(nota) + '</div>' : '') + '</div>'
      + '<h2>Productos</h2><table><thead><tr><th></th><th>Producto</th><th class="num">Cantidad</th><th class="num">Precio de referencia</th><th class="num">Importe</th></tr></thead><tbody>'
      + filas.map(f => '<tr><td><span class="check"></span></td><td>' + esc(f.nombre) + '</td><td class="num">' + f.empaquesCompra + ' × ' + C.fmtCant(f.presentacion) + ' ' + esc(C.nombreUnidad(f.unidadCompra)) + '</td><td class="num">' + dinero(f.empaquesCompra ? f.costoCompra / f.empaquesCompra : 0) + '</td><td class="num">' + dinero(f.costoCompra) + '</td></tr>').join('')
      + '</tbody></table><div class="totales"><div class="gran"><span>Total estimado</span><span>' + dinero(total) + '</span></div></div>'
      + '<p class="tenue" style="margin-top:10px;font-size:8.5pt">Precios de referencia según la última cotización registrada; confirmar al surtir.</p>'
      + '<div class="firmas"><div>Solicita · ' + esc(db.empresa.responsable || db.empresa.nombre) + '</div><div>Recibe · ' + esc(p.contacto || nombre) + '</div></div>' + pieDoc();
  }

  /* ================================================================ COBRANZA
     Plan de pagos (anticipo y saldo con vencimiento), pagos registrados,
     recibos con importe con letra y estado de cuenta por evento. Los pagos
     viven dentro de cada evento, así que se sincronizan con él. */
  const METODOS = ['Transferencia', 'Efectivo', 'Tarjeta', 'Depósito', 'Cheque'];
  const ESTADO_COB = { pagado: ['Pagado', 'ok'], sobrepago: ['Pago de más', 'info'], vencido: ['Vencido', 'error'], 'por-vencer': ['Por vencer', 'alerta'], 'al-corriente': ['Al corriente', ''], 'sin-importe': ['Sin importe', ''], pendiente: ['Pendiente', ''], 'sin-fecha': ['Sin fecha', ''] };
  const pillCob = est => { const x = ESTADO_COB[est] || ['—', '']; return '<span class="pill ' + x[1] + '">' + x[0] + '</span>'; };
  const cobDe = e => C.estadoCobranza(e, C.cotizarEvento(e, IX).total, hoyISO(), db.parametros);
  const enCobranza = e => ['aprobada', 'realizado'].includes(e.estatus) || (e.pagos || []).length > 0;
  const barraAvance = c => '<span class="avance" title="' + pct(c.avance * 100) + ' cobrado"><i style="width:' + (c.avance * 100).toFixed(1) + '%"></i></span>';
  const filtroCob = { modo: '' };
  function vCobranza() {
    const evs = db.eventos.filter(enCobranza).map(e => ({ e, c: cobDe(e) }));
    const activos = evs.filter(x => x.e.estatus !== 'cancelada' || x.c.pagado);
    const porCobrar = activos.filter(x => x.c.saldo > 0.005 && x.e.estatus !== 'cancelada');
    const sumar = (l, f) => l.reduce((s, x) => s + f(x), 0);
    const mes = hoyISO().slice(0, 7);
    const cobradoMes = db.eventos.reduce((s, e) => s + (e.pagos || []).filter(p => String(p.fecha || '').startsWith(mes)).reduce((a, p) => a + C.num(p.monto), 0), 0);
    const nVenc = activos.filter(x => x.c.estado === 'vencido').length;
    if (!filtroCob.modo) filtroCob.modo = nVenc ? 'vencidos' : 'pendientes';
    const m = filtroCob.modo;
    const vis = activos.filter(x => m === 'todos' || (m === 'vencidos' ? x.c.estado === 'vencido' : m === 'pagados' ? ['pagado', 'sobrepago'].includes(x.c.estado) : x.c.saldo > 0.005 && x.e.estatus !== 'cancelada'))
      .sort((a, b) => (b.c.estado === 'vencido') - (a.c.estado === 'vencido') || String((a.c.proximo || {}).vence || a.e.fecha || '9').localeCompare(String((b.c.proximo || {}).vence || b.e.fecha || '9')));
    const filas = vis.map(({ e, c }) => '<tr class="clic" tabindex="0" data-ir="#cobro-' + e.id + '"><td><b>' + esc(e.nombre || e.folio) + '</b><br><span class="tenue">' + esc(e.cliente || '—') + ' · ' + fechaCorta(e.fecha) + '</span></td>'
      + '<td class="num">' + dinero(c.total) + '</td><td class="num">' + dinero(c.pagado) + '<br>' + barraAvance(c) + '</td><td class="num"><b>' + dinero(Math.max(c.saldo, 0)) + '</b></td>'
      + '<td>' + (c.proximo ? esc(c.proximo.concepto) + ' ' + dinero(c.proximo.monto) + '<br><span class="tenue">' + (c.proximo.vence ? 'vence ' + fechaCorta(c.proximo.vence) : 'sin fecha') + '</span>' : '<span class="tenue">—</span>') + '</td><td>' + pillCob(c.estado) + '</td></tr>').join('');
    const recientes = [];
    db.eventos.forEach(e => (e.pagos || []).forEach(p => recientes.push({ e, p })));
    recientes.sort((a, b) => String(b.p.fecha || '').localeCompare(String(a.p.fecha || '')) || String(b.p.registrado || '').localeCompare(String(a.p.registrado || '')));
    ctx.acciones = { filtroCobranza: d => { filtroCob.modo = d.modo; render(); } };
    return '<div class="cabecera"><div><span class="ceja">Finanzas</span><h1>Cobranza</h1></div></div>'
      + '<div class="metricas"><div class="metrica destacada"><span class="et">Por cobrar</span><span class="val">' + dinero(sumar(porCobrar, x => x.c.saldo)) + '</span><span class="det">' + porCobrar.length + ' evento' + (porCobrar.length === 1 ? '' : 's') + ' con saldo</span></div>'
      + '<div class="metrica"><span class="et">Vencido</span><span class="val" style="color:var(--' + (nVenc ? 'error' : 'tinta') + ')">' + dinero(sumar(activos, x => x.c.vencido)) + '</span><span class="det">' + nVenc + ' evento' + (nVenc === 1 ? '' : 's') + '</span></div>'
      + '<div class="metrica"><span class="et">Cobrado este mes</span><span class="val">' + dinero(cobradoMes) + '</span><span class="det">' + MESES_L[new Date().getMonth()] + '</span></div>'
      + '<div class="metrica"><span class="et">Por vencer</span><span class="val">' + activos.filter(x => x.c.estado === 'por-vencer').length + '</span><span class="det">en los próximos 3 días</span></div></div>'
      + '<div class="pestanas">' + [['vencidos', 'Vencidos'], ['pendientes', 'Por cobrar'], ['pagados', 'Pagados'], ['todos', 'Todos']].map(f => '<button class="' + (m === f[0] ? 'activa' : '') + '" data-accion="filtroCobranza" data-modo="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>'
      + '<div class="rejilla r-lateral"><section class="panel">' + (vis.length ? '<div class="tabla-env"><table><thead><tr><th>Evento</th><th class="num">Total</th><th class="num">Cobrado</th><th class="num">Saldo</th><th>Próximo pago</th><th>Estado</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
        : '<div class="vacio"><h3>' + (m === 'vencidos' ? 'Nada vencido' : 'Nada en esta lista') + '</h3><p>Los eventos aprobados aparecen aquí con su plan de anticipo y saldo.</p></div>') + '</section>'
      + '<aside class="pegajoso"><section class="panel"><h2>Pagos recientes</h2>' + (recientes.length ? '<div class="resumen">' + recientes.slice(0, 8).map(x => '<div class="fila"><span>' + esc(x.e.nombre || x.e.folio) + '<br><span class="tenue">' + fechaCorta(x.p.fecha) + ' · ' + esc(x.p.metodo || '') + '</span></span><span>' + dinero(x.p.monto) + '</span></div>').join('') + '</div>' : '<p class="tenue">Aún no hay pagos registrados.</p>') + '</section></aside></div>';
  }

  function vCobro(id) {
    const e = db.eventos.find(x => x.id === id);
    if (!e) return noEncontrado('El evento');
    e.pagos = e.pagos || []; e.cobro = e.cobro || {}; e.factura = e.factura || {};
    ctx.obj = e;
    const c = cobDe(e);
    const resumen = () => {
      const k = cobDe(e);
      return '<div class="cobro-cifras"><div><span class="et">Total del evento</span><b>' + dinero(k.total) + '</b><span class="tenue">con IVA</span></div><div><span class="et">Cobrado</span><b>' + dinero(k.pagado) + '</b>' + barraAvance(k) + '</div><div class="acento"><span class="et">Saldo</span><b>' + dinero(Math.max(k.saldo, 0)) + '</b>' + pillCob(k.estado) + '</div></div>'
        + '<div class="plan">' + [['Anticipo · ' + pct(k.anticipoPct), k.anticipo], ['Saldo', k.final]].map(([t, x]) => '<div class="plan-paso ' + x.estado + '"><span class="plan-punto"></span><div><b>' + t + '</b><span class="tenue">' + dinero(x.monto) + (x.vence ? ' · vence ' + fechaCorta(x.vence) : ' · sin fecha') + '</span></div>' + pillCob(x.estado) + '</div>').join('') + '</div>'
        + (k.estado === 'sobrepago' ? '<div class="nota alerta">Se registró ' + dinero(-k.saldo) + ' de más. Revisa los pagos o anota la devolución.</div>' : '');
    };
    const filas = c.pagos.map((p, i) => '<tr><td>' + fechaCorta(p.fecha) + '<br><span class="tenue">' + esc(p.folio || '') + '</span></td><td>' + esc(p.metodo || '—') + (p.referencia ? '<br><span class="tenue">' + esc(p.referencia) + '</span>' : '') + '</td><td>' + esc(p.nota || '') + '</td><td class="num"><b>' + dinero(p.monto) + '</b></td>'
      + '<td class="acc"><button class="icono-btn ir" data-accion="recibo" data-pid="' + p.id + '" aria-label="Imprimir recibo" title="Imprimir recibo">' + ico('imprimir') + '</button><button class="icono-btn" data-accion="quitarPago" data-pid="' + p.id + '" aria-label="Eliminar pago">✕</button></td></tr>').join('');
    ctx.recalcular = () => { const r = capaActual().querySelector('#resumenCobro'); if (r) r.innerHTML = resumen(); };
    ctx.acciones = {
      registrarPago: () => {
        const k = cobDe(e);
        const sugerido = k.proximo ? k.proximo.monto : Math.max(k.saldo, 0);
        abrirModal({
          titulo: 'Registrar pago', compacto: true,
          cuerpo: '<div class="campos" style="grid-template-columns:repeat(2,minmax(0,1fr))"><label class="campo"><span>Monto</span><div class="sufijo"><input id="pg-monto" type="text" inputmode="decimal" value="' + C.r2(sugerido).toFixed(2) + '"><i>MXN</i></div></label>'
            + '<label class="campo"><span>Fecha</span><input id="pg-fecha" type="date" value="' + hoyISO() + '"></label>'
            + '<label class="campo"><span>Método</span><select id="pg-metodo">' + METODOS.map(x => '<option>' + x + '</option>').join('') + '</select></label>'
            + '<label class="campo"><span>Referencia</span><input id="pg-ref" type="text" placeholder="Folio, últimos 4 dígitos…" autocomplete="off"></label>'
            + '<label class="campo ancho"><span>Nota</span><input id="pg-nota" type="text" placeholder="Opcional" autocomplete="off"></label></div>'
            + '<p class="tenue" id="pg-calc"></p>',
          alAbrir: m => {
            const calc = () => { const v = C.num(m.querySelector('#pg-monto').value), r = C.r2(k.saldo - v); m.querySelector('#pg-calc').textContent = v > 0 ? (r > 0.005 ? 'Después de este pago quedan ' + dinero(r) + '.' : r < -0.005 ? 'Es ' + dinero(-r) + ' más que el saldo.' : 'Con este pago queda liquidado.') + ' ' + C.numeroALetras(v) : ''; };
            m.querySelector('#pg-monto').addEventListener('input', calc); calc();
          },
          botones: [{ texto: 'Cancelar', clase: 'fantasma' }, {
            texto: 'Registrar pago', clase: 'primario', accion: m => {
              const monto = C.r2(C.num(m.querySelector('#pg-monto').value)), fecha = m.querySelector('#pg-fecha').value || hoyISO();
              if (!(monto > 0)) { aviso('Escribe el monto', true); return false; }
              const n = e.pagos.length + 1;
              e.pagos.push({ id: 'pag-' + D.uid(), folio: 'R-' + String(e.folio || 'CVZ').replace(/^CVZ-/, '') + '-' + String(n).padStart(2, '0'), fecha, monto, metodo: m.querySelector('#pg-metodo').value, referencia: m.querySelector('#pg-ref').value.trim(), nota: m.querySelector('#pg-nota').value.trim(), registrado: D.ahora(), por: (perfil && perfil.correo) || '' });
              e.actualizado = D.ahora();
              guardar(true); render();
              const k2 = cobDe(e);
              aviso(k2.saldo <= 0.005 ? 'Pago registrado: evento liquidado' : 'Pago registrado · saldo ' + dinero(k2.saldo));
            }
          }]
        });
      },
      quitarPago: d => { const p = e.pagos.find(x => x.id === d.pid); if (!p) return; confirmar('Eliminar pago', '¿Eliminar el pago de <b>' + dinero(p.monto) + '</b> del ' + fechaCorta(p.fecha) + '?', 'Eliminar', () => { e.pagos = e.pagos.filter(x => x.id !== d.pid); e.actualizado = D.ahora(); guardar(true); render(); aviso('Pago eliminado'); }); },
      recibo: d => { const p = e.pagos.find(x => x.id === d.pid); if (p) imprimir(docRecibo(e, p)); },
      estadoCuenta: () => imprimir(docEstadoCuenta(e)),
      verEvento: () => abrir('evento-' + e.id)
    };
    const p = db.parametros;
    return '<div class="cabecera"><div><span class="ceja">Cobranza · ' + esc(e.folio) + '</span><h1>' + esc(e.nombre || 'Evento') + '</h1></div>'
      + '<div class="acciones"><button class="btn primario" data-accion="registrarPago">' + ico('mas') + 'Registrar pago</button><button class="btn" data-accion="estadoCuenta">' + ico('imprimir') + 'Estado de cuenta</button><button class="btn" data-accion="verEvento">' + ico('eventos') + 'Ver evento</button></div></div>'
      + '<div class="rejilla r-lateral"><div class="rejilla">'
      + '<section class="panel"><div class="panel-cab"><div><h2>' + esc(e.cliente || 'Cliente sin nombre') + '</h2><p>' + fechaCorta(e.fecha) + ' · ' + n0(e.personas) + ' personas · ' + pillEstatus(e.estatus) + '</p></div></div><div id="resumenCobro">' + resumen() + '</div></section>'
      + '<section class="panel"><div class="panel-cab"><h2>Pagos</h2></div>' + (filas ? '<div class="tabla-env"><table><thead><tr><th>Fecha</th><th>Método</th><th>Nota</th><th class="num">Monto</th><th></th></tr></thead><tbody>' + filas + '</tbody><tfoot><tr><td colspan="3">Total cobrado</td><td class="num">' + dinero(c.pagado) + '</td><td></td></tr></tfoot></table></div>' : '<div class="vacio"><p>Aún no hay pagos. Registra el anticipo cuando el cliente confirme.</p><button class="btn primario" data-accion="registrarPago">' + ico('mas') + 'Registrar pago</button></div>') + '</section>'
      + '</div><aside class="pegajoso rejilla">'
      + '<section class="panel"><h2>Plan de pagos</h2><div class="campos" style="grid-template-columns:minmax(0,1fr)">'
      + campoTexto('Anticipo', 'anticipoPct', e.cobro.anticipoPct, { grupo: 'cobro', num: true, suf: '%', ph: String(p.anticipoPct ?? 50) })
      + campoTexto('Vence el anticipo', 'venceAnticipo', e.cobro.venceAnticipo || c.anticipo.vence, { grupo: 'cobro', tipo: 'date', ayuda: 'Por omisión, ' + (p.diasAnticipo ?? 15) + ' días antes del evento' })
      + campoTexto('Vence el saldo', 'venceSaldo', e.cobro.venceSaldo || c.final.vence, { grupo: 'cobro', tipo: 'date', ayuda: 'Por omisión, ' + (p.diasSaldo ?? 3) + ' días antes del evento' })
      + '</div></section>'
      + '<section class="panel"><h2>Factura</h2><div class="campos" style="grid-template-columns:minmax(0,1fr)">'
      + campoTexto('Folio', 'folio', e.factura.folio, { grupo: 'factura', ph: 'A-1234' })
      + campoTexto('Fecha', 'fecha', e.factura.fecha, { grupo: 'factura', tipo: 'date' })
      + campoTexto('Folio fiscal (UUID)', 'uuid', e.factura.uuid, { grupo: 'factura', ph: 'Opcional' })
      + '</div></section></aside></div>';
  }
  function conceptoPago(e, p) {
    const orden = (e.pagos || []).slice().sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.registrado || '').localeCompare(String(b.registrado || '')));
    const i = orden.findIndex(x => x.id === p.id);
    const previos = orden.slice(0, i).reduce((s, x) => s + C.num(x.monto), 0);
    const total = C.cotizarEvento(e, IX).total;
    const restante = C.r2(total - previos - C.num(p.monto));
    return { previos, restante, total, concepto: restante <= 0.005 ? (i === 0 ? 'Pago total' : 'Liquidación') : i === 0 ? 'Anticipo' : 'Abono' };
  }
  function docRecibo(e, p) {
    const k = conceptoPago(e, p);
    return encabezadoDoc('Recibo de pago', '<div><b>' + esc(p.folio || '') + '</b></div><div>Fecha: ' + fechaCorta(p.fecha) + '</div>')
      + '<div class="recibo-monto"><span>Recibimos de <b>' + esc(e.cliente || e.contacto || 'Cliente') + '</b> la cantidad de</span><b class="importe">' + dinero(p.monto) + '</b><span>(' + esc(C.numeroALetras(p.monto)) + ')</span></div>'
      + '<div class="datos"><div><b>Concepto:</b> ' + k.concepto + ' del evento «' + esc(e.nombre || e.folio) + '»</div><div><b>Cotización:</b> ' + esc(e.folio) + '</div>'
      + '<div><b>Fecha del evento:</b> ' + fechaCorta(e.fecha) + '</div><div><b>Personas:</b> ' + n0(e.personas) + '</div>'
      + '<div><b>Forma de pago:</b> ' + esc(p.metodo || '—') + '</div><div><b>Referencia:</b> ' + esc(p.referencia || '—') + '</div></div>'
      + '<div class="totales"><div><span>Total del evento</span><span>' + dinero(k.total) + '</span></div><div><span>Pagos anteriores</span><span>' + dinero(k.previos) + '</span></div><div><span>Este pago</span><span>' + dinero(p.monto) + '</span></div><div class="gran"><span>Saldo pendiente</span><span>' + dinero(Math.max(k.restante, 0)) + '</span></div></div>'
      + (p.nota ? '<p style="margin-top:10px"><b>Nota:</b> ' + esc(p.nota) + '</p>' : '')
      + '<div class="firmas"><div>Recibió · ' + esc(db.empresa.responsable || db.empresa.nombre) + '</div><div>Entregó · ' + esc(e.contacto || e.cliente || 'Cliente') + '</div></div>' + pieDoc();
  }
  function docEstadoCuenta(e) {
    const k = cobDe(e);
    let acum = 0;
    return encabezadoDoc('Estado de cuenta', '<div><b>' + esc(e.folio) + '</b></div><div>Al ' + fechaCorta(hoyISO()) + '</div>')
      + datosEventoDoc(e)
      + '<h2>Plan de pagos</h2><table><thead><tr><th>Concepto</th><th>Vence</th><th class="num">Monto</th><th>Estado</th></tr></thead><tbody>'
      + [['Anticipo (' + pct(k.anticipoPct) + ')', k.anticipo], ['Saldo', k.final]].map(([t, x]) => '<tr><td>' + t + '</td><td>' + fechaCorta(x.vence) + '</td><td class="num">' + dinero(x.monto) + '</td><td>' + (ESTADO_COB[x.estado] || ['—'])[0] + '</td></tr>').join('') + '</tbody></table>'
      + '<h2>Pagos recibidos</h2>' + (k.pagos.length ? '<table><thead><tr><th>Fecha</th><th>Recibo</th><th>Forma de pago</th><th class="num">Monto</th><th class="num">Saldo</th></tr></thead><tbody>' + k.pagos.map(p => { acum += C.num(p.monto); return '<tr><td>' + fechaCorta(p.fecha) + '</td><td>' + esc(p.folio || '') + '</td><td>' + esc(p.metodo || '') + (p.referencia ? ' · ' + esc(p.referencia) : '') + '</td><td class="num">' + dinero(p.monto) + '</td><td class="num">' + dinero(Math.max(k.total - acum, 0)) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>Sin pagos registrados.</p>')
      + '<div class="totales"><div><span>Total del evento</span><span>' + dinero(k.total) + '</span></div><div><span>Pagado</span><span>' + dinero(k.pagado) + '</span></div><div class="gran"><span>Saldo</span><span>' + dinero(Math.max(k.saldo, 0)) + '</span></div></div>'
      + (e.factura && e.factura.folio ? '<p style="margin-top:10px"><b>Factura:</b> ' + esc(e.factura.folio) + (e.factura.fecha ? ' del ' + fechaCorta(e.factura.fecha) : '') + (e.factura.uuid ? ' · UUID ' + esc(e.factura.uuid) : '') + '</p>' : '')
      + pieDoc();
  }

  /* ================================================================ SITIO WEB (administración)
     Lo que se publica aquí lo lee la página pública (index.html). */
  const CLAVE_SITIO = 'civizo.sitio.v1';
  const SITIO_DEF = {
    titulo: 'Alimentamos lo que nos une.',
    subtitulo: 'Comedores empresariales, catering y eventos con recetas estandarizadas: el mismo sabor y la misma calidad para 10 o para 1,000 personas.',
    nosotros: 'CIVIZO nace de una familia de cinco: Cindy, Iker, Víctor, Víctor Miguel y Zoe. Cada letra del nombre es uno de nosotros. Así entendemos la comida: como lo que reúne a las personas alrededor de una mesa. Con esa idea cocinamos para empresas y eventos, cuidando que cada plato llegue igual de bien que el primero.',
    ciudad: 'Monterrey, N.L.', telefono: '', whatsapp: '', correo: '', horario: '',
    lineas: ['empresarial', 'catering', 'produccion', 'operacion', 'consultoria']
  };
  const RANURAS = [['portada', 'Portada', 'Foto principal, vertical'], ['empresarial', 'Alimentación empresarial', 'Comedor o charola de menú'], ['catering', 'Catering y eventos', 'Montaje o buffet'], ['produccion', 'Producción de alimentos', 'Cocina en producción'], ['operacion', 'Operación de cocinas', 'Equipo trabajando'], ['consultoria', 'Proyectos y consultoría', 'Planeación o emplatado']]
    .concat([1, 2, 3, 4, 5, 6].map(n => ['galeria' + n, 'Galería ' + n, 'Platillos y servicios']));
  let sitio = null, cargandoSitio = false;
  async function cargarSitio() {
    if (NUBE) { const r = await N.leerSitio(); const c = Object.assign({}, SITIO_DEF, r.contenido || {}); delete c.id; sitio = { contenido: c, fotos: r.fotos || {} }; }
    else { let l = null; try { l = JSON.parse(localStorage.getItem(CLAVE_SITIO) || 'null'); } catch (e) { /* */ } sitio = { contenido: Object.assign({}, SITIO_DEF, l && l.contenido), fotos: (l && l.fotos) || {} }; }
  }
  function guardarSitioLocal() { try { localStorage.setItem(CLAVE_SITIO, JSON.stringify(sitio)); return true; } catch (e) { aviso('El navegador no tiene espacio para más fotos. Conecta Firebase o quita alguna.', true); return false; } }
  function comprimirImagen(file, max) {
    return new Promise((ok, mal) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        let q = .82, data = cv.toDataURL('image/jpeg', q);
        while (data.length > 850000 && q > .4) { q -= .08; data = cv.toDataURL('image/jpeg', q); }
        if (data.length > 950000) return mal(new Error('La imagen es demasiado grande aun comprimida'));
        ok(data);
      };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen')); };
      img.src = url;
    });
  }
  function vSitio() {
    if (!sitio) {
      ctx.alPintar = () => { if (cargandoSitio) return; cargandoSitio = true; cargarSitio().then(() => { cargandoSitio = false; render(); }).catch(() => { cargandoSitio = false; sitio = { contenido: Object.assign({}, SITIO_DEF), fotos: {} }; aviso('No se pudo leer el sitio publicado; se muestran los textos base', true); render(); }); };
      return '<div class="cabecera"><div><span class="ceja">Página pública</span><h1>Sitio web</h1></div></div><div class="vacio"><p>Cargando lo publicado…</p></div>';
    }
    const c = sitio.contenido;
    const leerForm = () => {
      const k = capaActual(), v = id => k.querySelector('#' + id).value.trim();
      return Object.assign({}, c, { titulo: v('sw-titulo'), subtitulo: v('sw-subtitulo'), nosotros: v('sw-nosotros'), ciudad: v('sw-ciudad'), telefono: v('sw-telefono'), whatsapp: v('sw-whatsapp'), correo: v('sw-correo'), horario: v('sw-horario'),
        lineas: Array.from(k.querySelectorAll('[data-sw-linea]:checked')).map(x => x.value) });
    };
    ctx.acciones = {
      publicarSitio: async (d, b) => {
        const nuevo = leerForm();
        if (!nuevo.titulo) return aviso('Escribe el título de la portada', true);
        if (!nuevo.lineas.length) return aviso('Deja visible al menos un servicio', true);
        b.disabled = true;
        try { sitio.contenido = nuevo; if (NUBE) await N.guardarSitio(nuevo); else guardarSitioLocal(); aviso('Cambios publicados en el sitio'); }
        catch (e) { aviso(e.message === 'SIN_PERMISO' ? 'Publica primero las reglas nuevas de Firestore (config/firestore.rules)' : 'No se pudo publicar: ' + e.message, true); }
        b.disabled = false;
      },
      subirFoto: d => elegirImagen(async file => {
        try {
          aviso('Preparando la foto…');
          const data = await comprimirImagen(file, d.slot === 'portada' ? 1600 : 1400);
          if (NUBE) await N.guardarFoto(d.slot, data);
          sitio.fotos[d.slot] = data;
          if (!NUBE && !guardarSitioLocal()) { delete sitio.fotos[d.slot]; return; }
          render(); aviso('Foto publicada');
        } catch (e) { aviso(e.message === 'SIN_PERMISO' ? 'Publica primero las reglas nuevas de Firestore' : e.message, true); }
      }),
      quitarFoto: d => confirmar('Quitar foto', 'La página volverá a mostrar el diseño de la marca en este espacio.', 'Quitar', async () => {
        try { if (NUBE) await N.borrarFoto(d.slot); delete sitio.fotos[d.slot]; if (!NUBE) guardarSitioLocal(); render(); aviso('Foto quitada'); } catch (e) { aviso('No se pudo quitar', true); }
      })
    };
    const campo = (id, etq, valor, extra) => '<label class="campo' + (extra && extra.ancho ? ' ancho' : '') + '"><span>' + etq + '</span>' + (extra && extra.area ? '<textarea id="' + id + '" rows="' + (extra.filas || 3) + '" data-libre>' + esc(valor) + '</textarea>' : '<input type="' + ((extra && extra.tipo) || 'text') + '" id="' + id + '" value="' + esc(valor) + '" autocomplete="off" data-libre' + (extra && extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : '') + '>') + (extra && extra.ayuda ? '<small>' + extra.ayuda + '</small>' : '') + '</label>';
    const fotos = RANURAS.map(([slot, nombre, sug]) => {
      const f = sitio.fotos[slot];
      return '<div class="ranura' + (slot === 'portada' ? ' vertical' : '') + '"><div class="ranura-img">' + (f ? '<img src="' + f + '" alt="' + esc(nombre) + '">' : '<div class="ranura-vacia">' + ico(slot.startsWith('galeria') ? 'galeria' : (ICO[slot] ? slot : 'galeria')) + '</div>') + '</div>'
        + '<div class="ranura-txt"><b>' + nombre + '</b><span class="tenue">' + sug + '</span></div>'
        + '<div class="acciones"><button class="btn chico" data-accion="subirFoto" data-slot="' + slot + '">' + ico('subir') + (f ? 'Cambiar' : 'Subir') + '</button>' + (f ? '<button class="icono-btn" data-accion="quitarFoto" data-slot="' + slot + '" aria-label="Quitar foto">✕</button>' : '') + '</div></div>';
    }).join('');
    return '<div class="cabecera"><div><span class="ceja">Página pública</span><h1>Sitio web</h1></div><div class="acciones"><a class="btn" href="index.html" target="_blank" rel="noopener">' + ico('externo') + 'Ver sitio</a><button class="btn primario" data-accion="publicarSitio">' + ico('check') + 'Publicar cambios</button></div></div>'
      + '<div class="rejilla r-lateral"><div class="rejilla">'
      + '<section class="panel"><div class="panel-cab"><div><h2>Textos de la portada</h2><p>Lo primero que ve un cliente. Corto y claro.</p></div></div><div class="campos">'
      + campo('sw-titulo', 'Título', c.titulo, { ancho: true }) + campo('sw-subtitulo', 'Subtítulo', c.subtitulo, { ancho: true, area: true, filas: 2 }) + campo('sw-nosotros', 'Nosotros', c.nosotros, { ancho: true, area: true, filas: 5 }) + '</div></section>'
      + '<section class="panel"><div class="panel-cab"><div><h2>Fotos</h2><p>Se ajustan y comprimen solas. Sin foto, el espacio muestra el diseño de la marca.</p></div></div><div class="ranuras">' + fotos + '</div></section></div>'
      + '<aside class="pegajoso rejilla"><section class="panel"><h2>Contacto</h2><div class="campos" style="grid-template-columns:minmax(0,1fr)">'
      + campo('sw-whatsapp', 'WhatsApp', c.whatsapp, { tipo: 'tel', ph: '81 1234 5678', ayuda: 'Activa el botón de WhatsApp en la página' }) + campo('sw-telefono', 'Teléfono', c.telefono, { tipo: 'tel' }) + campo('sw-correo', 'Correo', c.correo, { tipo: 'email' }) + campo('sw-ciudad', 'Ciudad', c.ciudad) + campo('sw-horario', 'Horario', c.horario, { ph: 'Lunes a sábado, 8:00 a 18:00' })
      + '</div></section><section class="panel"><h2>Servicios visibles</h2><div class="chips-sel">' + D.LINEAS.map(l => '<label><input type="checkbox" data-sw-linea data-libre value="' + l.id + '"' + (c.lineas.includes(l.id) ? ' checked' : '') + '>' + l.nombre + '</label>').join('') + '</div></section>'
      + '<section class="panel"><h2>Fotos que venden</h2><ul class="consejos"><li>Luz natural, de lado; sin flash.</li><li>Fondos oscuros o madera: combinan con el carbón de la marca.</li><li>Un detalle naranja (servilleta, salsa, cítrico) une la foto con el logo.</li><li>Personas del equipo con uniforme CIVIZO generan confianza.</li><li>Usa solo fotos propias o con licencia para uso comercial.</li></ul></section></aside></div>';
  }
  function elegirImagen(alElegir) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => { if (inp.files[0]) alElegir(inp.files[0]); };
    inp.click();
  }

  /* ================================================================ SOLICITUDES (desde el sitio) */
  const ESTATUS_SOL = [['nueva', 'Nueva', 'acento'], ['contactada', 'En seguimiento', 'info'], ['cotizada', 'Cotizada', 'ok'], ['descartada', 'Descartada', '']];
  const filtroSol = { est: '' };
  function vSolicitudes() {
    const lista = (db.solicitudes || []).slice().sort((a, b) => String(b.creado || '').localeCompare(String(a.creado || '')));
    const nNuevas = lista.filter(s => s.estatus === 'nueva').length;
    if (!filtroSol.est) filtroSol.est = nNuevas ? 'nueva' : 'todas';
    const vis = lista.filter(s => filtroSol.est === 'todas' || s.estatus === filtroSol.est);
    const pillSol = id => { const e = ESTATUS_SOL.find(x => x[0] === id) || ESTATUS_SOL[0]; return '<span class="pill ' + e[2] + '">' + e[1] + '</span>'; };
    const tarjeta = s => {
      const tel = String(s.telefono || '').replace(/[^\d+]/g, ''), wa = tel.replace(/\D/g, '');
      return '<article class="solicitud"><div class="sol-cab"><div><b>' + esc(s.nombre) + '</b>' + (s.empresa ? '<span class="tenue"> · ' + esc(s.empresa) + '</span>' : '') + '<br><span class="tenue">Recibida ' + textoEdad(s.creado).toLowerCase() + ' · ' + esc(s.origen || 'sitio web') + '</span></div>' + pillSol(s.estatus) + '</div>'
        + '<div class="sol-datos"><span>' + ico('servicios') + esc(s.servicio || 'Sin especificar') + '</span><span>' + ico('eventos') + (s.fecha ? fechaCorta(s.fecha) : 'Sin fecha') + '</span><span>' + ico('usuarios') + (C.num(s.personas) ? n0(s.personas) + ' personas' : 'Personas sin definir') + '</span></div>'
        + (s.mensaje ? '<p class="sol-msj">' + esc(s.mensaje) + '</p>' : '')
        + '<div class="sol-contacto">' + (tel ? '<a class="btn chico" href="tel:' + esc(tel) + '">' + esc(s.telefono) + '</a>' : '') + (wa.length >= 10 ? '<a class="btn chico" href="https://wa.me/' + (wa.length === 10 ? '52' + wa : wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + (s.correo ? '<a class="btn chico" href="mailto:' + esc(s.correo) + '">' + esc(s.correo) + '</a>' : '') + '</div>'
        + '<div class="acciones">' + (s.eventoId && db.eventos.some(e => e.id === s.eventoId) ? '<a class="btn chico" href="#evento-' + s.eventoId + '">' + ico('eventos') + 'Ver evento</a>' : '<button class="btn chico primario" data-accion="solEvento" data-id="' + s.id + '">' + ico('mas') + 'Crear evento</button>')
        + (s.estatus === 'nueva' ? '<button class="btn chico" data-accion="solEstatus" data-id="' + s.id + '" data-est="contactada">Marcar en seguimiento</button>' : '')
        + (s.estatus !== 'descartada' ? '<button class="btn chico fantasma" data-accion="solEstatus" data-id="' + s.id + '" data-est="descartada">Descartar</button>' : '<button class="btn chico fantasma" data-accion="solEstatus" data-id="' + s.id + '" data-est="nueva">Reabrir</button>') + '</div></article>';
    };
    ctx.acciones = {
      filtroSol: d => { filtroSol.est = d.est; render(); },
      solEstatus: d => { const s = db.solicitudes.find(x => x.id === d.id); if (!s) return; s.estatus = d.est; s.actualizado = D.ahora(); guardar(true); render(); },
      solEvento: d => {
        const s = db.solicitudes.find(x => x.id === d.id); if (!s) return;
        const e = nuevoEvento({ nombre: (s.servicio || 'Evento') + ' · ' + (s.empresa || s.nombre), cliente: s.empresa || s.nombre, contacto: s.nombre, telefono: s.telefono || '', fecha: s.fecha || '', personas: C.num(s.personas) || 50, notas: 'Solicitud del sitio web' + (s.correo ? ' (' + s.correo + ')' : '') + (s.mensaje ? ': ' + s.mensaje : '') });
        s.estatus = 'cotizada'; s.eventoId = e.id; s.actualizado = D.ahora(); guardar(true);
      }
    };
    return '<div class="cabecera"><div><span class="ceja">Desde el sitio web</span><h1>Solicitudes</h1></div><div class="acciones"><a class="btn" href="index.html#contacto" target="_blank" rel="noopener">' + ico('externo') + 'Ver formulario</a></div></div>'
      + '<div class="pestanas">' + [['nueva', 'Nuevas'], ['contactada', 'En seguimiento'], ['cotizada', 'Cotizadas'], ['descartada', 'Descartadas'], ['todas', 'Todas']].map(f => { const n = f[0] === 'todas' ? lista.length : lista.filter(s => s.estatus === f[0]).length; return '<button class="' + (filtroSol.est === f[0] ? 'activa' : '') + '" data-accion="filtroSol" data-est="' + f[0] + '">' + f[1] + (n ? ' · ' + n : '') + '</button>'; }).join('') + '</div>'
      + (vis.length ? '<div class="solicitudes">' + vis.map(tarjeta).join('') + '</div>'
        : '<div class="vacio"><h3>' + (lista.length ? 'Nada en esta lista' : 'Aún no llegan solicitudes') + '</h3><p>Cuando alguien llene el formulario de tu sitio, aparecerá aquí para que le des seguimiento o lo conviertas en evento.</p><a class="btn primario" href="index.html#contacto" target="_blank" rel="noopener">' + ico('externo') + 'Ver el formulario</a></div>');
  }

  /* ================================================================ AJUSTES */
  function vAjustes() {
    ctx.obj = db;
    ctx.recalcular = null;
    const tema = (() => { try { return localStorage.getItem('civizo.tema') || ''; } catch (e) { return ''; } })();
    ctx.alPintar = () => {
      $('tema').addEventListener('change', ev => aplicarTema(ev.target.value, true));
    };
    ctx.acciones = {
      respaldo: () => descargar('civizo-respaldo-' + hoyISO() + '.json', JSON.stringify(db, null, 2), 'application/json'),
      restaurar: () => elegirArchivo('.json,application/json', txt => {
        let d; try { d = JSON.parse(txt); } catch (er) { return aviso('El archivo no es un respaldo válido', true); }
        if (!d || !Array.isArray(d.recetas) || !Array.isArray(d.insumos)) return aviso('El archivo no parece un respaldo de CIVIZO', true);
        confirmar('Restaurar respaldo', 'Se reemplazará toda la información actual por la del archivo (' + d.recetas.length + ' recetas, ' + d.insumos.length + ' insumos, ' + (d.eventos || []).length + ' eventos). ¿Continuar?', 'Restaurar', () => { db = D.normalizar(d); cambioEstructura(); aviso('Respaldo restaurado'); irInicio(); });
      }),
      cargarEjemplo: () => confirmar('Cargar datos de ejemplo', 'Se agregarán los insumos, recetas, servicios y el evento de ejemplo a tu información actual.', 'Agregar', () => {
        const ej = D.ejemplo();
        ['insumos', 'recetas', 'servicios', 'eventos', 'proveedores'].forEach(k => { const ids = new Set(db[k].map(x => x.id)); ej[k].forEach(x => { if (!ids.has(x.id)) db[k].push(x); }); });
        cambioEstructura(); aviso('Datos de ejemplo agregados'); render();
      }),
      subirLocal: () => confirmar('Subir a la nube', 'Se agregarán a la nube los insumos, recetas, servicios y eventos guardados en este navegador que todavía no estén en ella. No se borra nada.', 'Subir', subirDatosLocales),
      borrarTodo: () => confirmar('Borrar toda la información', NUBE ? 'Se borrarán todos los insumos, recetas, servicios y eventos <b>para todas las cuentas</b>. Descarga un respaldo antes.' : 'Se borrarán todos los insumos, recetas, servicios y eventos de este equipo. Descarga un respaldo antes si lo necesitas.', 'Borrar todo', () => {
        const e = db.empresa, p = db.parametros; db = D.vacio(); db.empresa = e; db.parametros = p; cambioEstructura(); aviso('Información borrada'); irInicio();
      })
    };
    return '<div class="cabecera"><div><span class="ceja">Configuración</span><h1>Ajustes</h1><p class="sub">Datos de tu empresa para los documentos, valores por omisión y respaldos.</p></div></div>'
      + '<div class="rejilla r-2"><section class="panel"><h2>Empresa</h2><div class="campos">'
      + campoTexto('Nombre comercial', 'nombre', db.empresa.nombre, { grupo: 'empresa' }) + campoTexto('Lema', 'lema', db.empresa.lema, { grupo: 'empresa' })
      + campoTexto('Responsable', 'responsable', db.empresa.responsable, { grupo: 'empresa', ph: 'Tu nombre' }) + campoTexto('Teléfono', 'telefono', db.empresa.telefono, { grupo: 'empresa', tipo: 'tel' })
      + campoTexto('Correo', 'correo', db.empresa.correo, { grupo: 'empresa', tipo: 'email' }) + campoTexto('Ciudad', 'ciudad', db.empresa.ciudad, { grupo: 'empresa' })
      + '</div></section>'
      + '<section class="panel"><h2>Valores por omisión</h2><p class="tenue">Se aplican a recetas, servicios y eventos nuevos.</p><div class="campos">'
      + campoTexto('IVA', 'iva', db.parametros.iva, { grupo: 'parametros', num: true, suf: '%' }) + campoTexto('Margen de utilidad', 'margen', db.parametros.margen, { grupo: 'parametros', num: true, suf: '%' })
      + campoTexto('Food cost objetivo', 'foodCost', db.parametros.foodCost, { grupo: 'parametros', num: true, suf: '%' }) + campoTexto('Gastos indirectos', 'indirectos', db.parametros.indirectos, { grupo: 'parametros', num: true, suf: '%', ayuda: 'Renta, luz, administración…' }) + campoTexto('Anticipo', 'anticipoPct', db.parametros.anticipoPct, { grupo: 'parametros', num: true, suf: '%', ayuda: 'Del total, para confirmar el evento' }) + campoTexto('Vence el anticipo', 'diasAnticipo', db.parametros.diasAnticipo, { grupo: 'parametros', num: true, suf: 'días antes' }) + campoTexto('Vence el saldo', 'diasSaldo', db.parametros.diasSaldo, { grupo: 'parametros', num: true, suf: 'días antes' }) + campoTexto('Vigencia de precios', 'diasVigencia', db.parametros.diasVigencia, { grupo: 'parametros', num: true, suf: 'días', ayuda: 'Después de estos días un precio se marca para revisar' })
      + '</div><label class="campo"><span>Apariencia</span><select id="tema"><option value=""' + (!tema ? ' selected' : '') + '>Igual que el sistema</option><option value="light"' + (tema === 'light' ? ' selected' : '') + '>Clara</option><option value="dark"' + (tema === 'dark' ? ' selected' : '') + '>Oscura</option></select></label></section></div>'
      + '<section class="panel"><h2>Tu información</h2><p class="tenue">' + (NUBE ? 'Se guarda en la nube y todas las cuentas ven lo mismo. Descarga un respaldo de vez en cuando como seguridad.' : 'Todo se guarda en este navegador. Descarga un respaldo con frecuencia y úsalo para pasar la información a otra computadora.') + '</p>'
      + '<div class="acciones"><button class="btn primario" data-accion="respaldo">' + ico('bajar') + 'Descargar respaldo</button><button class="btn" data-accion="restaurar">' + ico('subir') + 'Restaurar respaldo</button>'
      + (D.hayEjemplos(db) ? '<button class="btn" data-accion="quitarEjemplos">Borrar datos de ejemplo</button>' : '<button class="btn" data-accion="cargarEjemplo">Cargar datos de ejemplo</button>')
      + (NUBE && datosLocalesGuardados() ? '<button class="btn" data-accion="subirLocal">' + ico('subir') + 'Subir lo capturado en este equipo</button>' : '')
      + '<button class="btn peligro" data-accion="borrarTodo">' + ico('borrar') + 'Borrar todo</button></div>'
      + '<p class="tenue">' + db.insumos.length + ' insumos · ' + db.recetas.length + ' recetas · ' + db.servicios.length + ' servicios · ' + db.eventos.length + ' eventos</p></section>';
  }
  function aplicarTema(t, guardarPref) {
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    if (guardarPref) { try { localStorage.setItem('civizo.tema', t); } catch (e) { /* */ } }
  }
  try { aplicarTema(localStorage.getItem('civizo.tema') || '', false); } catch (e) { /* */ }

  function noEncontrado(que) {
    return '<div class="vacio"><h3>' + que + ' ya no existe</h3><p>Quizá se eliminó o el enlace está incompleto.</p><button type="button" class="btn primario" data-nav="atras">Regresar</button></div>';
  }

  /* --------------------------------------------------- Acciones globales */
  const ACCIONES_GLOBALES = {
    nuevaReceta: () => nuevaReceta(),
    nuevoEvento: () => nuevoEvento(),
    nuevoServicio: d => nuevoServicio(d.linea),
    nuevoInsumo: () => abrirInsumo(null),
    editarInsumo: d => abrirInsumo(d.id),
    verLinea: d => { filtros.servicios.linea = d.linea; abrir('servicios'); },
    quitarEjemplos: () => confirmar('Borrar datos de ejemplo', 'Se borrarán los insumos, recetas, servicios y el evento de ejemplo. Lo que tú hayas creado se queda.', 'Borrar ejemplos', () => {
      D.quitarEjemplos(db); cambioEstructura(); aviso('Datos de ejemplo borrados'); render();
    })
  };

  /* ------------------------------------------------- Archivos (CSV / JSON) */
  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([tipo === 'text/csv' ? '﻿' + contenido : contenido], { type: tipo + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(filas) { return filas.map(f => f.map(v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n'); }
  function parseCSV(txt) {
    txt = String(txt).replace(/^﻿/, '');
    const sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const filas = []; let fila = [], campo = '', comillas = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (comillas) { if (ch === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += ch; }
      else if (ch === '"') comillas = true;
      else if (ch === sep) { fila.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
      else campo += ch;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas.filter(f => f.some(c => String(c).trim()));
  }
  function elegirArchivo(accept, alLeer) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => alLeer(rd.result); rd.readAsText(f); };
    inp.click();
  }
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'civizo';
  function importarInsumosCSV(txt) {
    const filas = parseCSV(txt);
    if (filas.length < 2) return aviso('El archivo no tiene renglones', true);
    const cab = filas[0].map(norm);
    const col = (...n) => cab.findIndex(c => n.includes(c));
    const iN = col('nombre', 'insumo', 'producto'), iC = col('categoria'), iP = col('precio', 'costo'), iPr = col('presentacion', 'cantidad', 'contenido'), iU = col('unidad', 'unidad de compra'), iR = col('rendimiento', 'merma'), iV = col('proveedor');
    if (iN < 0 || iP < 0) return aviso('El CSV necesita al menos las columnas "nombre" y "precio"', true);
    const mapU = { kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kg: 'kg', g: 'g', gr: 'g', gramos: 'g', l: 'l', lt: 'l', litro: 'l', litros: 'l', ml: 'ml', pza: 'pza', pieza: 'pza', piezas: 'pza', pz: 'pza', lb: 'lb', oz: 'oz', galon: 'galon', docena: 'docena' };
    let nuevos = 0, act = 0, omitidos = 0;
    filas.slice(1).forEach(f => {
      const nombre = String(f[iN] || '').trim();
      if (!nombre) { omitidos++; return; }
      const u = mapU[norm(f[iU])] || (iU >= 0 && C.UNIDADES[norm(f[iU])] ? norm(f[iU]) : null);
      let rend = iR >= 0 ? C.num(f[iR]) : 0;
      if (iR >= 0 && cab[iR] === 'merma' && rend > 0) rend = 100 - rend;
      const datos = { precio: C.num(f[iP]) };
      if (iC >= 0 && f[iC]) datos.categoria = String(f[iC]).trim();
      if (iPr >= 0 && C.num(f[iPr]) > 0) datos.presentacion = C.num(f[iPr]);
      if (u) datos.unidadCompra = u;
      if (rend > 0 && rend <= 100) datos.rendimiento = rend;
      if (iV >= 0 && f[iV]) datos.proveedor = String(f[iV]).trim();
      const ex = db.insumos.find(i => norm(i.nombre) === norm(nombre));
      if (ex) { if (datos.unidadCompra && C.dimension(datos.unidadCompra) !== C.dimension(ex.unidadCompra) && usosInsumo(ex.id).recetas.length) delete datos.unidadCompra; Object.assign(ex, datos, { actualizado: D.ahora() }); act++; }
      else { db.insumos.push(Object.assign({ id: 'ins-' + D.uid(), nombre, categoria: 'Otros', presentacion: 1, unidadCompra: 'kg', rendimiento: 100, proveedor: '', actualizado: D.ahora() }, datos)); nuevos++; }
    });
    cambioEstructura(); render();
    aviso(nuevos + ' nuevos, ' + act + ' actualizados' + (omitidos ? ', ' + omitidos + ' omitidos' : ''));
  }

  /* ============================================================ Documentos */
  function imprimir(html) {
    $('impresion').innerHTML = '<div class="doc">' + html + '</div>';
    setTimeout(() => window.print(), 60);
  }
  function encabezadoDoc(titulo, derecha) {
    const em = db.empresa;
    return '<div class="doc-cab"><div class="doc-marca">' + ISOTIPO + '<div><b>' + esc(em.nombre || 'CIVIZO') + '</b><small>' + esc(em.lema || '') + '</small></div></div><div class="doc-folio"><h1>' + titulo + '</h1>' + derecha + '</div></div>';
  }
  function pieDoc() {
    const em = db.empresa;
    return '<div class="pie"><span>' + [em.nombre, em.ciudad, em.telefono, em.correo].filter(Boolean).map(esc).join(' · ') + '</span><span>Generado el ' + fechaCorta(hoyISO()) + '</span></div>';
  }
  function docFichaTecnica(r) {
    const c = C.costoReceta(r, IX);
    const obj = C.num(r.foodCost) || db.parametros.foodCost;
    const rb = C.rendimientoBase(r);
    const pasos = String(r.procedimiento || '').split('\n').map(s => s.trim()).filter(Boolean);
    return encabezadoDoc('Ficha técnica', '<div><b>' + esc(r.codigo) + '</b></div><div>Actualizada: ' + fechaCorta(r.actualizado) + '</div>')
      + '<h2 style="border:0;font-size:15pt;text-transform:none;letter-spacing:0;margin-top:0">' + esc(r.nombre) + '</h2>'
      + '<div class="datos"><div><b>Categoría:</b> ' + esc(r.categoria) + '</div><div><b>Porciones:</b> ' + C.porcionesReceta(r) + (r.porcionTexto ? ' de ' + esc(r.porcionTexto) : '') + '</div>'
      + '<div><b>Rendimiento:</b> ' + (rb ? C.fmtLegible(rb.base, rb.dim) : '—') + '</div><div><b>Tiempo:</b> ' + (C.num(r.tiempoPrep) + C.num(r.tiempoCoccion) ? C.num(r.tiempoPrep) + ' min prep. + ' + C.num(r.tiempoCoccion) + ' min cocción' : '—') + '</div>'
      + '<div><b>Alérgenos:</b> ' + (r.alergenos.length ? r.alergenos.map(esc).join(', ') : 'Ninguno declarado') + '</div><div><b>Food cost objetivo:</b> ' + pct(obj) + '</div></div>'
      + '<h2>Ingredientes</h2><table><thead><tr><th class="num">Cantidad</th><th>Unidad</th><th>Ingrediente</th><th>Nota</th><th class="num">Costo</th></tr></thead><tbody>'
      + r.ingredientes.filter(l => l.refId).map(l => { const nom = l.tipo === 'receta' ? (IX.recetas.get(l.refId) || {}).nombre + ' (receta base)' : (IX.insumos.get(l.refId) || {}).nombre; return '<tr><td class="num">' + C.fmtCant(l.cantidad) + '</td><td>' + esc(C.nombreUnidad(l.unidad)) + '</td><td>' + esc(nom || '—') + '</td><td>' + esc(l.nota) + '</td><td class="num">' + dinero((c.lineas[r.ingredientes.indexOf(l)] || {}).costo) + '</td></tr>'; }).join('')
      + '</tbody></table><div class="totales"><div><span>Costo total</span><span>' + dinero(c.total) + '</span></div><div><span>Costo por porción</span><span>' + dinero(c.porPorcion) + '</span></div><div class="gran"><span>Precio sugerido</span><span>' + dinero(C.precioPorFoodCost(c.porPorcion, obj)) + '</span></div></div>'
      + (pasos.length ? '<h2>Procedimiento</h2><ol>' + pasos.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' : '')
      + (r.notas ? '<h2>Notas y puntos críticos</h2><p>' + esc(r.notas).replace(/\n/g, '<br>') + '</p>' : '')
      + '<div class="firmas"><div>Elaboró</div><div>Autorizó</div></div>' + pieDoc();
  }
  function docOrdenProduccion(r, porciones) {
    const e = C.escalarReceta(r, porciones, IX);
    const acc = C.explotarPorciones(r, porciones, IX);
    const pasos = String(r.procedimiento || '').split('\n').map(s => s.trim()).filter(Boolean);
    const subs = []; acc.subrecetas.forEach((p, id) => { const s = IX.recetas.get(id); if (s) subs.push([s, p]); });
    return encabezadoDoc('Orden de producción', '<div><b>' + esc(r.codigo) + '</b></div><div>Fecha: ________________</div>')
      + '<h2 style="border:0;font-size:15pt;text-transform:none;letter-spacing:0;margin-top:0">' + esc(r.nombre) + '</h2>'
      + '<div class="datos"><div><b>Porciones a producir:</b> ' + C.fmtCant(porciones) + (r.porcionTexto ? ' de ' + esc(r.porcionTexto) : '') + '</div><div><b>Factor:</b> ×' + C.fmtCant(e.factor) + ' (base ' + C.porcionesReceta(r) + ' porc.)</div>'
      + '<div><b>Costo estimado:</b> ' + dinero(e.costoTotal) + '</div><div><b>Responsable:</b> ________________</div></div>'
      + (subs.length ? '<h2>Preparar primero (recetas base)</h2><table><thead><tr><th></th><th>Receta</th><th class="num">Porciones</th><th class="num">Volumen</th></tr></thead><tbody>' + subs.map(([s, p]) => { const rb = C.rendimientoBase(s); return '<tr><td><span class="check"></span></td><td>' + esc(s.nombre) + '</td><td class="num">' + C.fmtCant(p) + '</td><td class="num">' + (rb ? C.fmtLegible(rb.base * p / C.porcionesReceta(s), rb.dim) : '—') + '</td></tr>'; }).join('') + '</tbody></table>' : '')
      + '<h2>Ingredientes</h2><table><thead><tr><th></th><th>Ingrediente</th><th class="num">Cantidad neta</th><th class="num">Surtir (bruto)</th><th>Nota</th></tr></thead><tbody>'
      + e.filas.filter(f => f.refId).map(f => '<tr><td><span class="check"></span></td><td>' + esc(f.nombre) + '</td><td class="num"><b>' + (f.dim ? C.fmtLegible(f.netaBase, f.dim) : C.fmtCant(f.cantidad) + ' porc.') + '</b></td><td class="num">' + (f.brutaBase != null ? C.fmtLegible(f.brutaBase, f.dim) : '—') + '</td><td>' + esc(f.nota) + '</td></tr>').join('')
      + '</tbody></table>'
      + (pasos.length ? '<h2>Procedimiento</h2><ol>' + pasos.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' : '')
      + (r.notas ? '<h2>Puntos críticos</h2><p>' + esc(r.notas).replace(/\n/g, '<br>') + '</p>' : '')
      + '<div class="firmas"><div>Produjo</div><div>Revisó</div></div>' + pieDoc();
  }
  function datosEventoDoc(e) {
    return '<div class="datos"><div><b>Cliente:</b> ' + esc(e.cliente || '—') + '</div><div><b>Contacto:</b> ' + esc([e.contacto, e.telefono].filter(Boolean).join(' · ') || '—') + '</div>'
      + '<div><b>Evento:</b> ' + esc(e.nombre || '—') + '</div><div><b>Fecha:</b> ' + fechaCorta(e.fecha) + (e.hora ? ', ' + esc(e.hora) + ' h' : '') + '</div>'
      + '<div><b>Lugar:</b> ' + esc(e.lugar || '—') + '</div><div><b>Personas:</b> ' + n0(e.personas) + '</div></div>';
  }
  function descripcionLinea(l) {
    if (l.tipo === 'servicio') {
      const s = IX.servicios.get(l.refId); if (!s) return '';
      const recs = s.componentes.filter(c => c.tipo === 'receta').map(c => (IX.recetas.get(c.refId) || {}).nombre).filter(Boolean);
      return s.descripcion || recs.join(', ');
    }
    return '';
  }
  function docCotizacionCliente(e) {
    const q = C.cotizarEvento(e, IX);
    const base = q.alimentos > 0 ? q.alimentos : 0;
    let filas = '';
    if (base > 0) {
      let acum = 0;
      const validas = q.lineas.map((l, i) => ({ l, i })).filter(x => x.l.total > 0);
      validas.forEach((x, k) => {
        let importe = Math.round(x.l.total / base * q.precioBruto * 100) / 100;
        if (k === validas.length - 1) importe = Math.round((q.precioBruto - acum) * 100) / 100;
        acum += importe;
        const desc = descripcionLinea(e.lineas[x.i]);
        filas += '<tr><td><b>' + esc(x.l.nombre) + '</b>' + (desc ? '<br><span style="color:#666;font-size:9pt">' + esc(desc) + '</span>' : '') + '</td><td class="num">' + n0(x.l.cantidad) + '</td><td class="num">' + dinero(x.l.cantidad ? importe / x.l.cantidad : 0) + '</td><td class="num">' + dinero(importe) + '</td></tr>';
      });
    } else filas = '<tr><td><b>Servicio integral de alimentos y bebidas</b></td><td class="num">' + n0(q.personas) + '</td><td class="num">' + dinero(q.personas ? q.precioBruto / q.personas : 0) + '</td><td class="num">' + dinero(q.precioBruto) + '</td></tr>';
    const incluye = e.personal.filter(p => p.puesto && C.num(p.cantidad)).map(p => n0(p.cantidad) + ' ' + esc(p.puesto).toLowerCase()).concat(e.gastos.filter(g => g.concepto).map(g => esc(g.concepto).toLowerCase()));
    return encabezadoDoc('Cotización', '<div><b>' + esc(e.folio) + '</b></div><div>Fecha: ' + fechaCorta(hoyISO()) + '</div>')
      + datosEventoDoc(e)
      + '<h2>Propuesta</h2><table><thead><tr><th>Concepto</th><th class="num">Cantidad</th><th class="num">Precio unitario</th><th class="num">Importe</th></tr></thead><tbody>' + filas + '</tbody></table>'
      + '<div class="totales">' + (q.descuento > 0 ? '<div><span>Importe</span><span>' + dinero(q.precioBruto) + '</span></div><div><span>Descuento (' + pct(e.descuento) + ')</span><span>−' + dinero(q.descuento) + '</span></div>' : '')
      + '<div><span>Subtotal</span><span>' + dinero(q.subtotal) + '</span></div><div><span>IVA (' + pct(e.iva) + ')</span><span>' + dinero(q.iva) + '</span></div><div class="gran"><span>Total</span><span>' + dinero(q.total) + '</span></div>'
      + '<div><span>Precio por persona (sin IVA)</span><span>' + dinero(q.precioPorPersona) + '</span></div></div>'
      + (incluye.length ? '<h2>Incluye</h2><p>' + incluye.join(', ') + '.</p>' : '')
      + (e.condiciones ? '<h2>Condiciones</h2><p>' + esc(e.condiciones).replace(/\n/g, '<br>') + '</p>' : '')
      + '<div class="firmas"><div>' + esc(db.empresa.responsable || db.empresa.nombre) + '</div><div>Acepto · ' + esc(e.cliente || 'Cliente') + '</div></div>' + pieDoc();
  }
  function docCostoInterno(e) {
    const q = C.cotizarEvento(e, IX);
    return encabezadoDoc('Costo interno', '<div><b>' + esc(e.folio) + '</b></div><div>Uso interno · no entregar</div>')
      + datosEventoDoc(e)
      + '<h2>Alimentos y bebidas</h2><table><thead><tr><th>Concepto</th><th class="num">Cantidad</th><th class="num">Costo unitario</th><th class="num">Costo</th></tr></thead><tbody>' + q.lineas.map(l => '<tr><td>' + esc(l.nombre) + '</td><td class="num">' + n0(l.cantidad) + '</td><td class="num">' + dinero(l.unitario) + '</td><td class="num">' + dinero(l.total) + '</td></tr>').join('') + '</tbody></table>'
      + (e.personal.length ? '<h2>Personal</h2><table><thead><tr><th>Puesto</th><th class="num">Personas</th><th class="num">Horas</th><th class="num">Tarifa</th><th class="num">Costo</th></tr></thead><tbody>' + e.personal.map(p => '<tr><td>' + esc(p.puesto) + '</td><td class="num">' + n0(p.cantidad) + '</td><td class="num">' + C.fmtCant(p.horas) + '</td><td class="num">' + dinero(p.tarifa) + '</td><td class="num">' + dinero(C.num(p.cantidad) * C.num(p.horas) * C.num(p.tarifa)) + '</td></tr>').join('') + '</tbody></table>' : '')
      + (e.gastos.length ? '<h2>Logística y otros gastos</h2><table><tbody>' + e.gastos.map(g => '<tr><td>' + esc(g.concepto) + '</td><td class="num">' + dinero(g.monto) + '</td></tr>').join('') + '</tbody></table>' : '')
      + '<div class="totales"><div><span>Alimentos</span><span>' + dinero(q.alimentos) + '</span></div><div><span>Personal</span><span>' + dinero(q.personal) + '</span></div><div><span>Logística</span><span>' + dinero(q.gastos) + '</span></div><div><span>Indirectos (' + pct(e.indirectos) + ')</span><span>' + dinero(q.indirectos) + '</span></div>'
      + '<div class="gran"><span>Costo total</span><span>' + dinero(q.costoTotal) + '</span></div><div><span>Venta sin IVA</span><span>' + dinero(q.subtotal) + '</span></div><div><span>Utilidad</span><span>' + dinero(q.utilidad) + ' (' + pct(q.margenReal) + ')</span></div><div><span>Food cost</span><span>' + pct(q.foodCost) + '</span></div><div><span>Costo / precio por persona</span><span>' + dinero(q.costoPorPersona) + ' / ' + dinero(q.precioPorPersona) + '</span></div></div>'
      + (e.notas ? '<h2>Notas</h2><p>' + esc(e.notas).replace(/\n/g, '<br>') + '</p>' : '') + pieDoc();
  }
  function docProduccion(titulo, lista, preps, evento) {
    const porCat = {};
    lista.forEach(f => { (porCat[f.categoria] = porCat[f.categoria] || []).push(f); });
    return encabezadoDoc('Producción y compras', evento ? '<div><b>' + esc(evento.folio) + '</b></div><div>' + fechaCorta(evento.fecha) + ' · ' + n0(evento.personas) + ' personas</div>' : '<div>' + fechaCorta(hoyISO()) + '</div>')
      + '<p><b>' + esc(titulo) + '</b></p>'
      + (preps.length ? '<h2>Preparaciones</h2><table><thead><tr><th></th><th>Receta</th><th class="num">Porciones</th><th class="num">Volumen</th></tr></thead><tbody>' + preps.map(p => { const rb = C.rendimientoBase(p.r); return '<tr><td><span class="check"></span></td><td>' + esc(p.r.nombre) + (p.base ? ' (base)' : '') + '</td><td class="num">' + C.fmtCant(p.porc) + '</td><td class="num">' + (rb ? C.fmtLegible(rb.base * p.porc / C.porcionesReceta(p.r), rb.dim) : '—') + '</td></tr>'; }).join('') + '</tbody></table>' : '')
      + '<h2>Lista de compras</h2>' + Object.keys(porCat).map(cat => '<p style="margin:10px 0 4px"><b>' + esc(cat) + '</b></p><table><thead><tr><th></th><th>Insumo</th><th class="num">Bruto a surtir</th><th class="num">Comprar</th><th>Proveedor</th><th class="num">Costo</th></tr></thead><tbody>' + porCat[cat].map(f => '<tr><td><span class="check"></span></td><td>' + esc(f.nombre) + '</td><td class="num">' + C.fmtLegible(f.brutaBase, f.dim) + '</td><td class="num">' + f.empaquesCompra + ' × ' + C.fmtCant(f.presentacion) + ' ' + esc(C.nombreUnidad(f.unidadCompra)) + '</td><td>' + esc(f.proveedor) + '</td><td class="num">' + dinero(f.costoCompra) + '</td></tr>').join('') + '</tbody></table>').join('')
      + '<div class="totales"><div class="gran"><span>Total de compra</span><span>' + dinero(lista.reduce((s, f) => s + f.costoCompra, 0)) + '</span></div></div>' + pieDoc();
  }

  arrancar();
})();
