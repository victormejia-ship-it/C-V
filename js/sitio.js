/* =========================================================================
   CIVIZO · Sitio público
   Lee el contenido y las fotos que se publican desde la plataforma
   (Plataforma → Sitio web) y envía las solicitudes de cotización, que
   llegan a Plataforma → Solicitudes. Sin Firebase configurado usa lo
   guardado en este navegador (modo local).
   ========================================================================= */
(function () {
  'use strict';
  const N = window.Nube, D = window.Datos;
  const NUBE = !!(N && N.HAY_NUBE);
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const CLAVE_LOCAL = 'civizo.sitio.v1';

  /* Enlaces viejos a la plataforma (#receta-…, #eventos…) siguen funcionando. */
  if (/^#(receta|servicio|evento|insumo)-|^#(tablero|insumos|recetas|eventos|servicios|compras|ajustes|usuarios|precios|buscar|sitio|solicitudes)$/.test(location.hash)) {
    location.replace('app.html' + location.hash); return;
  }
  document.documentElement.classList.add('js');
  $('anio').textContent = new Date().getFullYear();

  /* ------------------------------------------------ Cabecera y menú */
  const cab = $('cab');
  const alDesplazar = () => cab.classList.toggle('solida', window.scrollY > 24);
  window.addEventListener('scroll', alDesplazar, { passive: true }); alDesplazar();
  const menuBtn = $('menuBtn'), nav = $('nav');
  const cerrarMenu = () => { nav.classList.remove('abierta'); menuBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
  menuBtn.addEventListener('click', () => { const ab = !nav.classList.contains('abierta'); nav.classList.toggle('abierta', ab); menuBtn.setAttribute('aria-expanded', String(ab)); document.body.style.overflow = ab ? 'hidden' : ''; });
  nav.addEventListener('click', e => { if (e.target.closest('a')) cerrarMenu(); });

  /* "Cotizar" en cada servicio preselecciona el servicio del formulario */
  document.querySelectorAll('[data-servicio]').forEach(a => a.addEventListener('click', () => {
    const sel = document.querySelector('#formSolicitud [name="servicio"]');
    if (sel) sel.value = a.dataset.servicio;
  }));

  /* ------------------------------------------------ Aparición suave */
  const revelables = document.querySelectorAll('.titular, .servicio, .proceso li, .pilares > div, .nombre, .carrusel figure, .formulario, .contacto-info');
  if ('IntersectionObserver' in window) {
    revelables.forEach(el => el.classList.add('revelar'));
    const io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add('visto'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    revelables.forEach(el => io.observe(el));
    setTimeout(() => revelables.forEach(el => el.classList.add('visto')), 2500);   // por si el observador no dispara
  }

  /* ------------------------------------------------ Contenido publicado */
  function aplicar(c, fotos) {
    c = c || {}; fotos = fotos || {};
    ['titulo', 'subtitulo', 'nosotros', 'ciudad'].forEach(k => { if (c[k]) document.querySelectorAll('[data-txt="' + k + '"]').forEach(el => { el.textContent = c[k]; }); });
    if (Array.isArray(c.lineas) && c.lineas.length) document.querySelectorAll('[data-linea]').forEach(el => { el.hidden = !c.lineas.includes(el.dataset.linea); });
    Object.keys(fotos).forEach(slot => {
      const fig = document.querySelector('[data-foto="' + slot + '"]');
      if (!fig || !fotos[slot]) return;
      const alt = slot === 'portada' ? 'Servicio de CIVIZO' : 'Servicio de ' + (fig.closest('.servicio') ? fig.closest('.servicio').querySelector('h3').textContent : 'CIVIZO');
      fig.innerHTML = '<img src="' + fotos[slot] + '" alt="' + esc(alt) + '"' + (slot === 'portada' ? '' : ' loading="lazy"') + '>';
    });
    const gal = Object.keys(fotos).filter(k => /^galeria/.test(k)).sort();
    if (gal.length) { $('galeriaFotos').innerHTML = gal.map(k => '<img src="' + fotos[k] + '" alt="Platillo o servicio de CIVIZO" loading="lazy">').join(''); $('galeria').hidden = false; }
    // Contacto
    const filas = [];
    if (c.telefono) filas.push(['Teléfono', '<a href="tel:' + esc(c.telefono.replace(/[^\d+]/g, '')) + '">' + esc(c.telefono) + '</a>']);
    if (c.correo) filas.push(['Correo', '<a href="mailto:' + esc(c.correo) + '">' + esc(c.correo) + '</a>']);
    filas.push(['Ciudad', esc(c.ciudad || 'Monterrey, N.L.')]);
    if (c.horario) filas.push(['Horario', esc(c.horario)]);
    $('datosContacto').innerHTML = filas.map(f => '<li><b>' + f[0] + '</b><span>' + f[1] + '</span></li>').join('');
    const wa = String(c.whatsapp || '').replace(/\D/g, '');
    if (wa) {
      const num = wa.length === 10 ? '52' + wa : wa;
      const url = 'https://wa.me/' + num + '?text=' + encodeURIComponent('Hola CIVIZO, me interesa cotizar un servicio.');
      $('btnWhats').href = url; $('btnWhats').hidden = false;
      $('whatsFlotante').href = url; $('whatsFlotante').hidden = false;
    }
  }
  async function cargar() {
    try {
      if (NUBE) { const r = await N.leerSitio(); aplicar(r.contenido, r.fotos); }
      else { const l = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || 'null'); if (l) aplicar(l.contenido, l.fotos); }
    } catch (e) { /* se queda el contenido base de la página */ }
  }
  cargar();

  /* ------------------------------------------------ Solicitud de cotización */
  const form = $('formSolicitud');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const v = n => String((form.elements[n] && form.elements[n].value) || '').trim();
    const error = t => { $('formError').textContent = t; };
    if (v('sitio_web')) { form.hidden = true; $('gracias').hidden = false; return; }   // trampa para robots
    if (v('nombre').length < 2) return error('Escribe tu nombre.'), form.elements.nombre.focus();
    if (v('telefono').replace(/\D/g, '').length < 8) return error('Escribe un teléfono de al menos 8 dígitos.'), form.elements.telefono.focus();
    if (v('correo') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('correo'))) return error('Revisa el correo.'), form.elements.correo.focus();
    error('');
    const ahora = new Date().toISOString();
    const sol = {
      nombre: v('nombre').slice(0, 120), empresa: v('empresa').slice(0, 160), telefono: v('telefono').slice(0, 40), correo: v('correo').slice(0, 160),
      servicio: v('servicio').slice(0, 60), fecha: v('fecha').slice(0, 10), personas: Math.max(0, Math.min(100000, parseInt(v('personas'), 10) || 0)),
      mensaje: v('mensaje').slice(0, 2000), estatus: 'nueva', creado: ahora, actualizado: ahora, origen: 'sitio web'
    };
    const btn = $('btnEnviar'); btn.disabled = true; btn.firstChild.textContent = 'Enviando… ';
    try {
      if (NUBE) await N.enviarSolicitud(sol);
      else { const c = D.cargar(); c.datos.solicitudes.push(Object.assign({ id: 'sol-' + D.uid() }, sol)); if (!D.guardar(c.datos)) throw new Error('local'); }
      form.hidden = true; $('gracias').hidden = false;
      $('gracias').scrollIntoView({ block: 'center' });
    } catch (e) {
      error('No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo' + ($('btnWhats').hidden ? '.' : ', o escríbenos por WhatsApp.'));
      btn.disabled = false; btn.firstChild.textContent = 'Enviar solicitud ';
    }
  });
})();
