/* =========================================================================
   CIVIZO · Nube (Firebase Auth + Firestore por REST, sin librerías)

   Mismo enfoque que Profectus y Forguard. Si CONFIG_NUBE (js/config.js)
   está vacío, la app sigue en modo local y este archivo no hace nada.

   Colecciones
     usuarios/{uid}      { correo, nombre, rol, activo, creado, ultimoAcceso }
     sistema/arranque    marca que ya existe un dueño (lo crea la 1.ª cuenta)
     sistema/config      { empresa, parametros }
     insumos, recetas, servicios, eventos   un documento por elemento
     borrados/{id}       { col, docId, cuando } para avisar a otros equipos

   Sincronización
     · Al entrar se descarga todo.
     · Cada cambio local se compara con la última versión conocida de cada
       documento y solo se escribe lo que cambió (con 800 ms de espera).
     · Cada minuto, y al volver a la pestaña, se piden solo los documentos con
       `actualizado` reciente y los borrados nuevos. Lo que el usuario está
       editando y aún no se sube no se pisa.
   ========================================================================= */
(function (raizGlobal) {
  'use strict';
  const CFG = raizGlobal.CONFIG_NUBE || {};
  const HAY_NUBE = !!(CFG.apiKey && CFG.projectId);
  const LLAVE_SESION = 'civizo.sesion.v1';
  const COLS = ['insumos', 'recetas', 'servicios', 'eventos', 'solicitudes', 'proveedores', 'movimientos'];
  const ROLES = [
    { id: 'owner', nombre: 'Dueño', desc: 'Todo, incluidas las cuentas' },
    { id: 'admin', nombre: 'Administrador', desc: 'Todo, incluidas las cuentas y ajustes' },
    { id: 'editor', nombre: 'Editor', desc: 'Captura y modifica insumos, recetas, servicios y eventos' },
    { id: 'consulta', nombre: 'Consulta', desc: 'Solo ve e imprime' }
  ];
  const TIMEOUT_MS = 20000;
  const MARGEN_RELOJ_MS = 5 * 60 * 1000;

  function fetchConTimeout(url, op, ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms || TIMEOUT_MS);
    return fetch(url, Object.assign({}, op, { signal: c.signal })).finally(() => clearTimeout(t));
  }

  /* ------------------------------------------------------------ Auth */
  const urlAuth = m => 'https://identitytoolkit.googleapis.com/v1/accounts:' + m + '?key=' + encodeURIComponent(CFG.apiKey);
  const MENSAJES = {
    EMAIL_NOT_FOUND: 'No existe una cuenta con ese correo.',
    INVALID_PASSWORD: 'Contraseña incorrecta.',
    INVALID_LOGIN_CREDENTIALS: 'Correo o contraseña incorrectos.',
    USER_DISABLED: 'Esta cuenta está deshabilitada.',
    EMAIL_EXISTS: 'Ya existe una cuenta con ese correo.',
    INVALID_EMAIL: 'El correo no es válido.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Demasiados intentos. Espera unos minutos.',
    WEAK_PASSWORD: 'La contraseña debe tener al menos 6 caracteres.',
    MISSING_PASSWORD: 'Escribe la contraseña.',
    OPERATION_NOT_ALLOWED: 'El acceso con correo y contraseña no está activado en Firebase (Authentication → Sign-in method).',
    CONFIGURATION_NOT_FOUND: 'Falta activar Authentication en el proyecto de Firebase.'
  };
  async function llamarAuth(metodo, cuerpo) {
    let r;
    try { r = await fetchConTimeout(urlAuth(metodo), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }); }
    catch (e) { throw new Error('Sin conexión con el servidor. Revisa tu internet.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const cod = ((d.error && d.error.message) || 'ERROR').split(' ')[0].split(':')[0];
      const e = new Error(MENSAJES[cod] || ('No se pudo completar (' + cod + ').'));
      e.codigo = cod; throw e;
    }
    return d;
  }
  let sesion = null;
  try { sesion = JSON.parse(localStorage.getItem(LLAVE_SESION) || 'null'); } catch (e) { sesion = null; }
  function guardarSesion() { try { if (sesion) localStorage.setItem(LLAVE_SESION, JSON.stringify(sesion)); else localStorage.removeItem(LLAVE_SESION); } catch (e) { /* */ } }
  function fijarTokens(d) {
    sesion = {
      uid: d.localId || d.user_id, correo: d.email || (sesion && sesion.correo) || '',
      idToken: d.idToken || d.id_token, refreshToken: d.refreshToken || d.refresh_token,
      vence: Date.now() + (parseInt(d.expiresIn || d.expires_in, 10) || 3600) * 1000 - 60000
    };
    guardarSesion();
  }
  async function renovarToken() {
    if (!sesion || !sesion.refreshToken) throw new Error('SIN_SESION');
    const r = await fetchConTimeout('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(CFG.apiKey), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(sesion.refreshToken)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { sesion = null; guardarSesion(); throw new Error('SIN_SESION'); }
    fijarTokens(d);
  }
  async function token() { if (!sesion) throw new Error('SIN_SESION'); if (Date.now() >= sesion.vence) await renovarToken(); return sesion.idToken; }

  /* ------------------------------------------------------- Firestore */
  const raiz = () => 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId + '/databases/(default)/documents';
  const nombreDoc = ruta => 'projects/' + CFG.projectId + '/databases/(default)/documents/' + ruta;
  function aValor(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
    if (typeof v === 'object') return { mapValue: { fields: aCampos(v, true) } };
    return { stringValue: String(v) };
  }
  function aCampos(o, interno) { const f = {}; Object.keys(o).forEach(k => { if ((interno || k !== 'id') && o[k] !== undefined) f[k] = aValor(o[k]); }); return f; }
  function deValor(v) {
    if (!v || typeof v !== 'object') return null;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('stringValue' in v) return v.stringValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
    if ('mapValue' in v) return deCampos(v.mapValue.fields || {});
    return null;
  }
  function deCampos(f) { const o = {}; Object.keys(f).forEach(k => { o[k] = deValor(f[k]); }); return o; }
  const docDe = x => { const o = deCampos(x.fields || {}); o.id = decodeURIComponent(x.name.split('/').pop()); return o; };

  async function pedir(ruta, op, permitir404, reintento) {
    const t = await token();
    const o = Object.assign({}, op);
    o.headers = Object.assign({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, o.headers || {});
    let r;
    try { r = await fetchConTimeout(raiz() + ruta, o); } catch (e) { const er = new Error('SIN_CONEXION'); er.red = true; throw er; }
    if (r.status === 401 && !reintento) { await renovarToken(); return pedir(ruta, op, permitir404, true); }
    if (r.status === 404 && permitir404) return null;
    if (r.status === 403) throw new Error('SIN_PERMISO');
    if (!r.ok) { const txt = await r.text().catch(() => ''); const e = new Error('HTTP ' + r.status + ' ' + txt.slice(0, 300)); e.status = r.status; throw e; }
    if (r.status === 204) return null;
    return r.json().catch(() => null);
  }
  async function listar(col) {
    const salida = []; let tk = '';
    do {
      const d = await pedir('/' + col + '?pageSize=300' + (tk ? '&pageToken=' + encodeURIComponent(tk) : ''), { method: 'GET' });
      ((d && d.documents) || []).forEach(doc => salida.push(docDe(doc)));
      tk = (d && d.nextPageToken) || '';
    } while (tk);
    return salida;
  }
  async function consulta(col, where) {
    const r = await pedir(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], where } }) });
    return (Array.isArray(r) ? r : []).filter(x => x.document).map(x => docDe(x.document));
  }
  async function leer(ruta) { const d = await pedir('/' + ruta, { method: 'GET' }, true); return d ? docDe(d) : null; }
  async function escribir(ruta, obj) { await pedir('/' + ruta, { method: 'PATCH', body: JSON.stringify({ fields: aCampos(JSON.parse(JSON.stringify(obj))) }) }); }
  async function borrar(ruta) { await pedir('/' + ruta, { method: 'DELETE' }); }
  const rutaDoc = (col, id) => col + '/' + encodeURIComponent(id);

  /* Lectura y escritura públicas (sin sesión): el sitio web lee su contenido y
     envía solicitudes de cotización. Las reglas deciden qué se permite. */
  async function publico(ruta, op) {
    const sep = ruta.includes('?') ? '&' : '?';
    let r;
    try { r = await fetchConTimeout(raiz() + ruta + sep + 'key=' + encodeURIComponent(CFG.apiKey), Object.assign({ headers: { 'Content-Type': 'application/json' } }, op || {})); }
    catch (e) { throw new Error('Sin conexión con el servidor.'); }
    if (r.status === 404) return null;
    if (!r.ok) { const e = new Error(r.status === 403 ? 'SIN_PERMISO' : 'HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json().catch(() => null);
  }

  /* --------------------------------------------------- Comparación */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  const reemplazarEnSitio = (destino, origen) => { Object.keys(destino).forEach(k => { delete destino[k]; }); Object.assign(destino, origen); };

  /* ----------------------------------------------- Estado de sync */
  let base = {};          // col -> Map(id -> canon) ; 'config' -> canon
  let marca = null;       // ISO de la última sondeada
  let pendiente = null, enCurso = false, otraVez = false;
  let alEstado = () => { };
  function fijarBase(db) {
    base = { config: canon({ empresa: db.empresa, parametros: db.parametros }) };
    COLS.forEach(c => { base[c] = new Map(db[c].map(o => [o.id, canon(o)])); });
  }
  const sucio = (col, o) => base[col] && base[col].get(o.id) !== canon(o);
  function hayPendientes(db) {
    if (!db || !base.config) return false;
    if (canon({ empresa: db.empresa, parametros: db.parametros }) !== base.config) return true;
    return COLS.some(c => db[c].some(o => sucio(c, o)) || Array.from(base[c].keys()).some(id => !db[c].some(o => o.id === id)));
  }

  const Nube = {
    HAY_NUBE, ROLES, COLS,
    sesion: () => sesion,
    canon,
    async entrar(correo, clave) { fijarTokens(await llamarAuth('signInWithPassword', { email: correo, password: clave, returnSecureToken: true })); return sesion; },
    async registrarme(correo, clave) { fijarTokens(await llamarAuth('signUp', { email: correo, password: clave, returnSecureToken: true })); return sesion; },
    async crearCuentaAjena(correo, clave) { const d = await llamarAuth('signUp', { email: correo, password: clave, returnSecureToken: false }); return d.localId; },
    async enviarRestablecer(correo) { await llamarAuth('sendOobCode', { requestType: 'PASSWORD_RESET', email: correo }); },
    salir() { sesion = null; guardarSesion(); base = {}; marca = null; },

    /** Perfil de la cuenta. Si no existe: la 1.ª cuenta del proyecto se vuelve dueño; las demás quedan en espera. */
    async perfil(nombre) {
      let p = await leer('usuarios/' + sesion.uid);
      if (p) {
        if (p.activo) escribir('usuarios/' + sesion.uid + '?updateMask.fieldPaths=ultimoAcceso', { ultimoAcceso: new Date().toISOString() }).catch(() => { });
        return p;
      }
      const ahora = new Date().toISOString();
      const arranque = await leer('sistema/arranque').catch(() => null);
      if (!arranque) {
        const owner = { correo: sesion.correo, nombre: nombre || '', rol: 'owner', activo: true, creado: ahora, ultimoAcceso: ahora };
        try {
          await pedir(':commit', { method: 'POST', body: JSON.stringify({ writes: [
            { update: { name: nombreDoc('usuarios/' + sesion.uid), fields: aCampos(owner) }, currentDocument: { exists: false } },
            { update: { name: nombreDoc('sistema/arranque'), fields: aCampos({ uid: sesion.uid, cuando: ahora }) }, currentDocument: { exists: false } }
          ] }) });
          return Object.assign(owner, { id: sesion.uid, primero: true });
        } catch (e) { /* otra cuenta ganó el arranque: sigue como solicitud */ }
      }
      const sol = { correo: sesion.correo, nombre: nombre || '', rol: 'consulta', activo: false, creado: ahora, ultimoAcceso: ahora };
      await escribir('usuarios/' + sesion.uid, sol);
      return Object.assign(sol, { id: sesion.uid });
    },

    /** Descarga todo y deja la base para comparar. */
    async cargarTodo(vacio) {
      const inicio = Date.now();
      const [config, ...listas] = await Promise.all([leer('sistema/config').catch(e => { if (e.message === 'SIN_PERMISO') throw e; return null; })].concat(COLS.map(listar)));
      const db = vacio();
      if (config) { if (config.empresa) db.empresa = Object.assign(db.empresa, config.empresa); if (config.parametros) db.parametros = Object.assign(db.parametros, config.parametros); }
      COLS.forEach((c, i) => { db[c] = listas[i]; });
      marca = new Date(inicio - MARGEN_RELOJ_MS).toISOString();
      return db;
    },
    fijarBase,
    hayPendientes,
    alEstado(f) { alEstado = f; },

    /** Programa la subida de lo que cambió. */
    programar(db) { clearTimeout(pendiente); alEstado('pendiente'); pendiente = setTimeout(() => Nube.subir(db), 800); },
    async subir(db) {
      if (enCurso) { otraVez = true; return; }
      enCurso = true;
      let error = null;
      try {
        const ahora = new Date().toISOString();
        const conf = { empresa: db.empresa, parametros: db.parametros };
        if (canon(conf) !== base.config) { await escribir('sistema/config', conf); base.config = canon(conf); }
        for (const c of COLS) {
          for (const o of db[c]) {
            if (!sucio(c, o)) continue;
            o.actualizado = ahora;
            if (sesion) o.por = sesion.correo;
            const firma = canon(o);
            await escribir(rutaDoc(c, o.id), o);
            base[c].set(o.id, firma);
          }
          const vivos = new Set(db[c].map(o => o.id));
          for (const id of Array.from(base[c].keys())) {
            if (vivos.has(id)) continue;
            await borrar(rutaDoc(c, id));
            base[c].delete(id);
            escribir('borrados/' + encodeURIComponent(c + '__' + id), { col: c, docId: id, cuando: ahora }).catch(() => { });
          }
        }
      } catch (e) { error = e; }
      enCurso = false;
      if (otraVez) { otraVez = false; return Nube.subir(db); }
      if (error) {
        alEstado(error.message === 'SIN_PERMISO' ? 'sin-permiso' : 'error', error);
        if (error.message !== 'SIN_PERMISO') { clearTimeout(pendiente); pendiente = setTimeout(() => Nube.subir(db), 15000); }
      } else alEstado('ok');
    },

    /**
     * Trae lo que otros cambiaron desde la última vez y lo mezcla en `db`
     * (modificando los objetos en sitio para no romper la pantalla abierta).
     * Devuelve true si hubo cambios.
     */
    async sondear(db) {
      if (!marca || enCurso) return false;
      const desde = marca;
      const nueva = new Date(Date.now() - MARGEN_RELOJ_MS).toISOString();
      const filtro = { fieldFilter: { field: { fieldPath: 'actualizado' }, op: 'GREATER_THAN', value: aValor(desde) } };
      const [config, borrados, ...cambios] = await Promise.all([
        leer('sistema/config').catch(() => null),
        consulta('borrados', { fieldFilter: { field: { fieldPath: 'cuando' }, op: 'GREATER_THAN', value: aValor(desde) } }).catch(() => [])
      ].concat(COLS.map(c => consulta(c, filtro))));
      let hubo = false;
      if (config) {
        const remoto = canon({ empresa: config.empresa, parametros: config.parametros });
        const local = canon({ empresa: db.empresa, parametros: db.parametros });
        if (remoto !== base.config && local === base.config) {
          if (config.empresa) reemplazarEnSitio(db.empresa, config.empresa);
          if (config.parametros) reemplazarEnSitio(db.parametros, config.parametros);
          base.config = remoto; hubo = true;
        }
      }
      COLS.forEach((c, i) => {
        cambios[i].forEach(r => {
          const firma = canon(r);
          if (base[c].get(r.id) === firma) return;
          const local = db[c].find(o => o.id === r.id);
          if (local) {
            if (sucio(c, local)) return;          // lo están editando aquí: gana lo local
            reemplazarEnSitio(local, r);
          } else {
            if (base[c].has(r.id)) return;        // lo borraron aquí y falta subirlo
            db[c].push(r);
          }
          base[c].set(r.id, firma); hubo = true;
        });
      });
      borrados.forEach(t => {
        if (!base[t.col]) return;
        const i = db[t.col].findIndex(o => o.id === t.docId);
        if (i >= 0 && !sucio(t.col, db[t.col][i]) && String(db[t.col][i].actualizado || '') <= String(t.cuando)) {
          db[t.col].splice(i, 1); base[t.col].delete(t.docId); hubo = true;
        }
      });
      marca = nueva;
      return hubo;
    },

    /* ----------------------------------------------- Sitio web */
    /** Contenido público del sitio y sus fotos (no requiere sesión). */
    async leerSitio() {
      const [doc, fotos] = await Promise.all([
        publico('/sitio/publico').catch(() => null),
        publico('/sitio_fotos?pageSize=50').catch(() => null)
      ]);
      const f = {};
      ((fotos && fotos.documents) || []).forEach(d => { const o = docDe(d); if (o.data) f[o.id] = o.data; });
      return { contenido: doc ? docDe(doc) : null, fotos: f };
    },
    async guardarSitio(contenido) { const o = Object.assign({}, contenido); delete o.id; await escribir('sitio/publico', o); },
    async guardarFoto(slot, data) { await escribir('sitio_fotos/' + encodeURIComponent(slot), { data, actualizado: new Date().toISOString() }); },
    async borrarFoto(slot) { await borrar('sitio_fotos/' + encodeURIComponent(slot)); },
    /** Solicitud de cotización enviada desde el sitio (sin sesión). */
    async enviarSolicitud(sol) { await publico('/solicitudes', { method: 'POST', body: JSON.stringify({ fields: aCampos(sol) }) }); },

    /* ----------------------------------------------- Cuentas (admin) */
    async usuarios() { return listar('usuarios'); },
    async guardarUsuario(u) { const o = Object.assign({}, u); delete o.id; await escribir('usuarios/' + u.id, o); },
    async borrarUsuario(id) { await borrar('usuarios/' + id); }
  };

  raizGlobal.Nube = Nube;
})(window);
