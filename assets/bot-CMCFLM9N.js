import{a as e,i as t,n,r}from"./crypto-V_dT3c6Z.js";import{i,s as a,t as o}from"./node-CanpiEz0.js";import{S as s,T as c,g as l,t as u}from"./domain-3gSL5seR.js";var d=a({}.CRM_DB??`data/crm.db`),f=`
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('asesor','gerente','admin')),
  activo        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  token      TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campanas (
  id     INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS leads (
  id                   INTEGER PRIMARY KEY,
  nombre               TEXT NOT NULL,
  telefono             TEXT NOT NULL UNIQUE,
  correo               TEXT,
  auto                 TEXT,
  fecha_compra         TEXT,
  canal                TEXT,
  plataforma           TEXT,
  canal_compra         TEXT,
  pago_inicial         INTEGER,
  mensualidad          INTEGER,
  historial_crediticio TEXT,
  ciudad               TEXT,
  campana_id           INTEGER REFERENCES campanas(id),
  asesor_id            INTEGER REFERENCES usuarios(id),
  estado_contacto      TEXT NOT NULL DEFAULT 'nuevo'
    CHECK (estado_contacto IN ('nuevo','en_espera','sin_respuesta','contactado','datos_incorrectos')),
  resultado            TEXT
    CHECK (resultado IS NULL OR resultado IN ('seguimiento','sin_avance','proximo_mes','en_proceso','venta','no_interesado')),
  proximo_contacto     TEXT,
  created_by           INTEGER REFERENCES usuarios(id),
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  first_contact_at     TEXT,  -- primer intento de contacto: mide el tiempo de respuesta
  responded_at         TEXT,  -- cuando el cliente contestó por primera vez
  last_activity_at     TEXT,
  -- Un resultado solo existe si el cliente fue contactado.
  CHECK (resultado IS NULL OR estado_contacto = 'contactado')
);
CREATE INDEX IF NOT EXISTS leads_asesor ON leads(asesor_id);
CREATE INDEX IF NOT EXISTS leads_estado ON leads(estado_contacto);
CREATE INDEX IF NOT EXISTS leads_proximo ON leads(proximo_contacto);

CREATE TABLE IF NOT EXISTS interacciones (
  id         INTEGER PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id),
  tipo       TEXT NOT NULL CHECK (tipo IN ('llamada','whatsapp','correo','nota','estado','asignacion')),
  texto      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS interacciones_lead ON interacciones(lead_id, created_at);

-- Fase 2: citas. Se crea desde ahora para que el modelo quede completo.
CREATE TABLE IF NOT EXISTS citas (
  id         INTEGER PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  asesor_id  INTEGER REFERENCES usuarios(id),
  fecha      TEXT NOT NULL,
  estado     TEXT NOT NULL DEFAULT 'agendada' CHECK (estado IN ('agendada','confirmada','asistio','no_asistio','cancelada')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS citas_fecha ON citas(fecha);

-- Fase 3: metas mensuales. Las metas por etapa se derivan de estas tasas.
CREATE TABLE IF NOT EXISTS metas (
  mes                 TEXT PRIMARY KEY,  -- 'YYYY-MM'
  ventas_agencia      INTEGER NOT NULL,
  contribucion_digital REAL NOT NULL DEFAULT 0.30,
  tasa_cierre         REAL NOT NULL DEFAULT 0.60,
  tasa_asistencia     REAL NOT NULL DEFAULT 0.60,
  tasa_citas          REAL NOT NULL DEFAULT 0.40,
  tasa_contactabilidad REAL NOT NULL DEFAULT 0.40
);
`;i(o(d),{recursive:!0});var p=new e(d);p.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;`),p.exec(f);var m=[`
  CREATE TABLE interacciones_v2 (
    id         INTEGER PRIMARY KEY,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id),
    tipo       TEXT NOT NULL CHECK (tipo IN ('llamada','whatsapp','correo','nota','estado','asignacion','cita')),
    texto      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  INSERT INTO interacciones_v2 SELECT id, lead_id, usuario_id, tipo, texto, created_at FROM interacciones;
  DROP TABLE interacciones;
  ALTER TABLE interacciones_v2 RENAME TO interacciones;
  CREATE INDEX interacciones_lead ON interacciones(lead_id, created_at);

  ALTER TABLE citas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'visita'
    CHECK (tipo IN ('visita','prueba_manejo','firma','entrega'));
  ALTER TABLE citas ADD COLUMN notas TEXT;
  ALTER TABLE citas ADD COLUMN created_by INTEGER REFERENCES usuarios(id);
  ALTER TABLE citas ADD COLUMN updated_at TEXT;
  CREATE INDEX citas_lead ON citas(lead_id, estado);
  `,`
  ALTER TABLE leads ADD COLUMN venta_at TEXT;
  UPDATE leads SET venta_at = COALESCE(last_activity_at, updated_at) WHERE resultado = 'venta';
  CREATE INDEX leads_created ON leads(created_at);
  CREATE INDEX leads_venta ON leads(venta_at);
  CREATE INDEX citas_created ON citas(created_at);
  `,`
  CREATE TABLE agencias (
    id     INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    ciudad TEXT,
    activa INTEGER NOT NULL DEFAULT 1
  );
  -- Corporativo: sin agencia. Gerente: su agencia (y opcionalmente un área). Asesor: agencia y área.
  ALTER TABLE usuarios ADD COLUMN agencia_id INTEGER REFERENCES agencias(id);
  ALTER TABLE usuarios ADD COLUMN area TEXT CHECK (area IS NULL OR area IN ('nuevos','usados','comerciales'));

  ALTER TABLE leads ADD COLUMN agencia_id INTEGER REFERENCES agencias(id);
  ALTER TABLE leads ADD COLUMN area TEXT CHECK (area IS NULL OR area IN ('nuevos','usados','comerciales'));
  ALTER TABLE leads ADD COLUMN bot_activo INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE leads ADD COLUMN bot_seguimientos INTEGER NOT NULL DEFAULT 0; -- seguimientos automáticos enviados sin respuesta
  ALTER TABLE leads ADD COLUMN bot_proximo_at TEXT;                         -- cuándo toca el siguiente seguimiento del bot
  ALTER TABLE leads ADD COLUMN intencion TEXT CHECK (intencion IS NULL OR intencion IN ('alta','media','baja'));
  ALTER TABLE leads ADD COLUMN mensaje_at TEXT;                             -- último mensaje de WhatsApp
  ALTER TABLE leads ADD COLUMN no_leidos INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX leads_ambito ON leads(agencia_id, area);
  CREATE INDEX leads_mensaje ON leads(mensaje_at);
  CREATE INDEX leads_bot ON leads(bot_activo, bot_proximo_at);

  CREATE TABLE mensajes (
    id         INTEGER PRIMARY KEY,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    autor      TEXT NOT NULL CHECK (autor IN ('cliente','bot','asesor')),
    usuario_id INTEGER REFERENCES usuarios(id),
    texto      TEXT NOT NULL,
    botones    TEXT, -- JSON: respuestas rápidas que ofreció el bot
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX mensajes_lead ON mensajes(lead_id, created_at);

  -- La meta vive en cada centro (agencia + área); agencia y grupo son la suma.
  CREATE TABLE metas_centro (
    mes                  TEXT NOT NULL,
    agencia_id           INTEGER NOT NULL REFERENCES agencias(id),
    area                 TEXT NOT NULL CHECK (area IN ('nuevos','usados','comerciales')),
    ventas_agencia       INTEGER NOT NULL,
    contribucion_digital REAL NOT NULL DEFAULT 0.30,
    tasa_cierre          REAL NOT NULL DEFAULT 0.60,
    tasa_asistencia      REAL NOT NULL DEFAULT 0.60,
    tasa_citas           REAL NOT NULL DEFAULT 0.40,
    tasa_contactabilidad REAL NOT NULL DEFAULT 0.40,
    PRIMARY KEY (mes, agencia_id, area)
  );

  CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT);
  `,`
  CREATE TABLE usuarios_v2 (
    id            INTEGER PRIMARY KEY,
    nombre        TEXT NOT NULL,
    correo        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    rol           TEXT NOT NULL CHECK (rol IN ('asesor','backoffice','coordinador','gerente','admin')),
    activo        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    agencia_id    INTEGER REFERENCES agencias(id),
    area          TEXT CHECK (area IS NULL OR area IN ('nuevos','usados','comerciales'))
  );
  INSERT INTO usuarios_v2 (id, nombre, correo, password_hash, rol, activo, created_at, agencia_id, area)
    SELECT id, nombre, correo, password_hash, rol, activo, created_at, agencia_id, area FROM usuarios;
  DROP TABLE usuarios;
  ALTER TABLE usuarios_v2 RENAME TO usuarios;
  `,`
  CREATE TABLE usuarios_v3 (
    id            INTEGER PRIMARY KEY,
    nombre        TEXT NOT NULL,
    correo        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    rol           TEXT NOT NULL CHECK (rol IN ('asesor','backoffice','coordinador','gerente','admin','superadmin')),
    activo        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    agencia_id    INTEGER REFERENCES agencias(id),
    area          TEXT CHECK (area IS NULL OR area IN ('nuevos','usados','comerciales'))
  );
  INSERT INTO usuarios_v3 SELECT id, nombre, correo, password_hash, rol, activo, created_at, agencia_id, area FROM usuarios;
  DROP TABLE usuarios;
  ALTER TABLE usuarios_v3 RENAME TO usuarios;

  CREATE TABLE dudas (
    id             INTEGER PRIMARY KEY,
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
    pregunta       TEXT NOT NULL,
    respuesta_ia   TEXT,                 -- lo que contestó la IA (si pudo)
    estado         TEXT NOT NULL CHECK (estado IN ('ia','pendiente','respondida')),
    respuesta      TEXT,                 -- respuesta de soporte
    respondida_por INTEGER REFERENCES usuarios(id),
    respondida_at  TEXT,
    leida          INTEGER NOT NULL DEFAULT 1, -- 0 = hay respuesta de soporte que quien preguntó no ha visto
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX dudas_usuario ON dudas(usuario_id, created_at);
  CREATE INDEX dudas_estado ON dudas(estado, created_at);

  -- Respuestas que soporte guarda para que la IA las use la próxima vez.
  CREATE TABLE respuestas_frecuentes (
    id         INTEGER PRIMARY KEY,
    pregunta   TEXT NOT NULL,
    respuesta  TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `,`
  ALTER TABLE usuarios ADD COLUMN cambiar_password INTEGER NOT NULL DEFAULT 0; -- 1 = contraseña puesta por otro; debe cambiarla al entrar
  ALTER TABLE usuarios ADD COLUMN ultimo_acceso TEXT;
  CREATE TABLE accesos (
    id         INTEGER PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    correo     TEXT NOT NULL,
    ip         TEXT,
    exito      INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX accesos_fecha ON accesos(created_at);
  `,`
  CREATE TABLE autos (
    id           INTEGER PRIMARY KEY,
    modelo       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    anio         INTEGER,
    precio_desde INTEGER,
    versiones    TEXT,
    descripcion  TEXT,
    ficha_url    TEXT,
    catalogo_url TEXT,
    imagen_url   TEXT,
    activo       INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE precios (
    id           INTEGER PRIMARY KEY,
    modelo       TEXT NOT NULL COLLATE NOCASE,
    version      TEXT NOT NULL,
    anio         INTEGER,
    precio_lista INTEGER NOT NULL
  );
  -- Tabulador: una versión de referencia por modelo, con enganche y mensualidades a 3, 4 y 5 años.
  CREATE TABLE tabulador (
    id          INTEGER PRIMARY KEY,
    modelo      TEXT NOT NULL COLLATE NOCASE,
    version     TEXT,
    anio        INTEGER,
    precio      INTEGER,
    enganche_20 INTEGER, m20_36 INTEGER, m20_48 INTEGER, m20_60 INTEGER,
    enganche_40 INTEGER, m40_36 INTEGER, m40_48 INTEGER, m40_60 INTEGER,
    oferta      TEXT
  );
  CREATE TABLE respuestas_rapidas (
    id     INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    atajo  TEXT NOT NULL,
    texto  TEXT NOT NULL,
    orden  INTEGER NOT NULL DEFAULT 0
  );
  -- Cadencia de contacto desde que se asigna el lead: intento N, cuándo, la llamada y el mensaje si no contesta.
  CREATE TABLE cadencia (
    id      INTEGER PRIMARY KEY,
    orden   INTEGER NOT NULL,
    cuando  TEXT NOT NULL,
    llamada TEXT NOT NULL,
    mensaje TEXT
  );
  ALTER TABLE leads ADD COLUMN prueba_manejo_at TEXT;
  ALTER TABLE leads ADD COLUMN documentos_at TEXT;
  ALTER TABLE leads ADD COLUMN apartado_at TEXT;
  `,`DELETE FROM sesiones;`];function h(){let{user_version:e}=p.prepare(`PRAGMA user_version`).get();if(e>=m.length)return;p.exec(`PRAGMA foreign_keys = OFF`);for(let t=e;t<m.length;t++){p.exec(`BEGIN`);try{p.exec(m[t]),p.exec(`PRAGMA user_version = ${t+1}`),p.exec(`COMMIT`)}catch(e){throw p.exec(`ROLLBACK`),p.exec(`PRAGMA foreign_keys = ON`),Error(`Falló la migración ${t+1} de la base de datos: ${e.message}`)}}let t=p.prepare(`PRAGMA foreign_key_check`).all();if(p.exec(`PRAGMA foreign_keys = ON`),t.length)throw Error(`La migración dejó ${t.length} referencias rotas en la base de datos.`)}h();var g=e=>e.normalize(`NFD`).replace(/\p{Diacritic}/gu,``).toLowerCase();p.function(`fold`,{deterministic:!0},e=>typeof e==`string`?g(e):e);var _=()=>new Date().toISOString();function v(e){p.exec(`BEGIN`);try{let t=e();return p.exec(`COMMIT`),t}catch(e){throw p.exec(`ROLLBACK`),e}}var y=new Map,b=(e,t)=>y.get(t),x=(e,t,n,r)=>{y.set(t,n)},S=(e,t,n)=>{y.delete(t)},C=class extends Error{res;status;constructor(e=500,t){super(t?.message,{cause:t?.cause}),this.res=t?.res,this.status=e}getResponse(){return this.res?new Response(this.res.body,{status:this.status,headers:this.res.headers}):new Response(this.message,{status:this.status})}},w=`crm_session`,T=72e5,E=3e5;function D(e){let t=n(16),i=r(e,t,64);return`scrypt$${t.toString(`base64`)}$${i.toString(`base64`)}`}function O(e,n){let[i,a,o]=n.split(`$`);if(i!==`scrypt`||!a||!o)return!1;let s=Buffer.from(o,`base64`),c=r(e,Buffer.from(a,`base64`),s.length);return t(c,s)}function k(e,t){let r=n(32).toString(`base64url`),i=new Date(Date.now()+T);p.prepare(`INSERT INTO sesiones (token, usuario_id, expires_at) VALUES (?, ?, ?)`).run(r,t,i.toISOString()),x(e,w,r,{httpOnly:!0,sameSite:`Lax`,path:`/`,secure:e.req.header(`x-forwarded-proto`)===`https`||e.req.url.startsWith(`https:`)})}function A(e){let t=b(e,w);t&&p.prepare(`DELETE FROM sesiones WHERE token = ?`).run(t),S(e,w,{path:`/`})}function j(e){let t=b(e,w);if(!t)return null;let n=p.prepare(`SELECT u.id, u.nombre, u.correo, u.rol, u.agencia_id, u.area, u.cambiar_password, s.expires_at FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expires_at > ? AND u.activo = 1`).get(t,_());if(!n)return null;let r=Date.now()+T;return Date.parse(n.expires_at)<r-E&&p.prepare(`UPDATE sesiones SET expires_at = ? WHERE token = ?`).run(new Date(r).toISOString(),t),delete n.expires_at,{...n,ambito:M(n,e.req.header(`x-ambito`))}}function M(e,t){let n=new URLSearchParams(t??``),r=Number(n.get(`agencia`))||null,i=u.includes(n.get(`area`)??``)?n.get(`area`):null;return{agenciaId:e.agencia_id??r,area:e.area??i}}var N=async(e,t)=>{let n=j(e);if(!n)throw new C(401,{message:`Inicia sesión para continuar.`});if(n.cambiar_password&&!e.req.path.startsWith(`/api/auth/`))throw new C(403,{message:`Antes de continuar, cambia tu contraseña temporal.`});e.set(`user`,n),await t()},P=e=>c(e.rol).veEquipo;function F(e,t,n){return!(e.agencia_id&&e.agencia_id!==t||e.area&&e.area!==n)}function I(e){if(!P(e))throw new C(403,{message:`Solo gerentes o administradores pueden hacer esto.`})}function L(e){if(!c(e.rol).edita)throw new C(403,{message:`Tu rol solo puede consultar; los cambios los hace el coordinador o back office.`})}function R(e){if(!c(e.rol).editaTodo)throw new C(403,{message:`Solo el coordinador o back office pueden hacer este cambio.`})}var z=e=>e.normalize(`NFD`).replace(/\p{Diacritic}/gu,``).toLowerCase(),B=e=>e.split(` `)[0]??e,V={jetta:489900,virtus:399900,polo:319900,"t-cross":459900,taos:569900,tiguan:719900,teramont:989900,nivus:449900,saveiro:359900,amarok:1019900,crafter:1089900,transporter:899900,caddy:619900},H=e=>{if(!e)return null;let t=Object.keys(V).find(t=>z(e).includes(t));return t?/\b20\d\d\b/.test(e)?Math.round(V[t]*.6/1e3)*1e3:V[t]:null},U=e=>`$${e.toLocaleString(`es-MX`)}`;function W(e){let t=new Intl.DateTimeFormat(`en-CA`,{timeZone:`America/Mexico_City`}).format(new Date(Date.now()+864e5));return new Date(`${t}T${String(e).padStart(2,`0`)}:00:00-06:00`).toISOString()}function G(e,t){let n=e.area===`usados`?`Seminuevos`:e.area===`comerciales`?`Vehículos Comerciales`:`Autos Nuevos`,r=s(t)?``:`

Nuestro horario de piso es de 9 a 19 h, pero yo te atiendo ahora mismo y un asesor te contacta a primera hora.`;return{texto:`¡Hola, ${B(e.nombre)}! Soy el asistente digital de ${n} ${e.agencia??``}.`.replace(/\s+\./,`.`)+` Gracias por tu interés${e.auto?` en el ${e.auto}`:``}.${r}\n\n¿Cómo te gustaría empezar?`,botones:[`Me gustaría cotizar`,`Quiero agendar una cita`,`Hablar con un asesor`]}}function K(e,t){let n=B(e.nombre),r=[`${n}, ¿pudiste ver mi mensaje? Sigo aquí para ayudarte${e.auto?` con el ${e.auto}`:``}.`,`Hola de nuevo, ${n}. Este mes hay bonos y tasas preferentes. ¿Te comparto una cotización sin compromiso?`,`${n}, no quiero ser insistente: si prefieres que te llame un asesor a una hora específica, solo dime cuál.`];return{texto:r[Math.min(t,r.length-1)],botones:t===0?[`Sí, cotizar`,`Agendar cita`]:void 0}}function q(e,t){let n=z(e),r=B(t.nombre),i=t.asesor?B(t.asesor):`un asesor`,a=t.cotizacion??null,o=a?.precio??null,s=a?[a.modelo,a.version].filter(Boolean).join(` `):t.auto;if(/asesor|humano|persona|llam(a|en|ar)me|marcar/.test(n))return{texto:`Claro, ${r}. Le paso tu conversación a ${i}${t.area?`, del equipo de ${l.area[t.area]}`:``}. Te escribe en unos minutos.`,pasarAsesor:!0,datos:{intencion:`alta`}};let c=n.match(/\b(1[0-8]|9)(?::00)?\s*(h|hrs|am|pm)?\b/);if(/manana|11|17|5 ?pm|en la tarde|en la manana/.test(n)&&/cita|ir|visit|agend|puedo|ok|si|perfect|va/.test(n)||c&&t.turnosBot>1&&/cita|agend|manana/.test(n)){let e=/17|5 ?pm|tarde/.test(n)?17:11;return{texto:`¡Listo, ${r}! Te agendé mañana a las ${e}:00 h en ${t.agencia??`la agencia`}. ${i===`un asesor`?`Un asesor`:i} te va a recibir y te confirma un día antes. 📍 ¿Quieres que tengamos la unidad lista para prueba de manejo?`,botones:[`Sí, prueba de manejo`,`Solo visita`],cita:{fecha:W(e)},datos:{intencion:`alta`}}}if(/cita|agend|visit|ir a la agencia|prueba de manejo|conocerlo|verlo/.test(n))return t.tieneCita?{texto:`Ya tienes una cita con nosotros, ${r}. Si quieres moverla, ${i} te ayuda en un momento.`,pasarAsesor:!0}:{texto:`¡Perfecto! Tengo espacio mañana. ¿Te queda mejor a las 11:00 o a las 17:00?`,botones:[`Mañana 11:00`,`Mañana 17:00`],datos:{intencion:`alta`}};if(/contado|cash|efectivo|de una sola/.test(n))return{texto:`Excelente. De contado ${o?`el ${s} tiene precio de lista de ${U(o)}`:`tenemos bonos especiales`} y puedes llevártelo esta semana. ¿Para cuándo lo necesitas?`,botones:[`Esta semana`,`Este mes`,`Solo estoy cotizando`],datos:{canal_compra:`contado`,intencion:`alta`}};if(/financ|credito|mensualidad|plazo|enganche|meses/.test(n)&&!/\d{4,}|\d+\s*(mil|k)\b/.test(n)){let e=a?.financiamiento;return a&&e?.enganche_20&&e.m20_60?{texto:`Con financiamiento, el ${[a.modelo,e.version,e.anio].filter(Boolean).join(` `)}${e.precio?` (${U(e.precio)})`:``} queda así, sujeto a aprobación:
• 20% de enganche (${U(e.enganche_20)}): desde ${U(e.m20_60)} al mes a 5 años`+(e.enganche_40&&e.m40_60?`
• 40% de enganche (${U(e.enganche_40)}): desde ${U(e.m40_60)} al mes a 5 años`:``)+`
¿Cuánto te gustaría dar de enganche?`,botones:[`20%`,`40%`,`Otra cantidad`],datos:{canal_compra:`credito`,intencion:`media`}}:{texto:`Con financiamiento manejamos enganche desde 10% y plazos de 12 a 72 meses. ¿Cuánto te gustaría dar de enganche, aproximadamente?`,botones:[`Menos de $50,000`,`$50,000 a $100,000`,`Más de $100,000`],datos:{canal_compra:`credito`,intencion:`media`}}}let u=n.match(/^\s*(20|40)\s*%/);if(u&&a?.financiamiento){let e=a.financiamiento,t=u[1]===`20`,n=t?e.enganche_20:e.enganche_40,r=t?e.m20_60:e.m40_60;if(n&&r)return{texto:`Con ${u[1]}% de enganche (${U(n)}), el ${[a.modelo,e.version].filter(Boolean).join(` `)} te queda desde ${U(r)} al mes a 5 años, sujeto a aprobación. ¿Para cuándo te gustaría estrenar?`,botones:[`Esta semana`,`Este mes`,`Solo estoy cotizando`],datos:{pago_inicial:n,canal_compra:`credito`,intencion:`media`}}}let d=n.match(/(\d[\d,.]*)\s*(mil|k)?/);if(d&&/mil|k|\$|enganche|\d{5,}/.test(n)){let e=Number(d[1].replace(/[,.]/g,``));if(d[2]&&(e*=1e3),/menos de/.test(n)&&(e=4e4),/mas de/.test(n)&&(e=12e4),e>=5e3&&e<=5e6){let t=o?Math.round((o-e)*1.25/48/100)*100:null;return{texto:`Gracias, ${r}. Con ${U(e)} de enganche${t?`, el ${s} te quedaría en unos ${U(t)} al mes a 48 meses`:``} (sujeto a aprobación). ¿Para cuándo te gustaría estrenar?`,botones:[`Esta semana`,`Este mes`,`Solo estoy cotizando`],datos:{pago_inicial:e,canal_compra:`credito`,intencion:`media`}}}}return/esta semana|\bya\b|urge|lo antes|\bhoy\b/.test(n)?{texto:`¡Perfecto! Para esta semana lo mejor es que lo veas en persona. ¿Te agendo mañana a las 11:00 o a las 17:00?`,botones:[`Mañana 11:00`,`Mañana 17:00`],datos:{fecha_compra:`esta_semana`,intencion:`alta`}}:/este mes|semanas|quincena/.test(n)?{texto:`Muy bien. Te comparto la ficha y la cotización, y ${i} te da seguimiento. ¿Te gustaría agendar una visita para verlo?`,botones:[`Agendar cita`,`Después`],datos:{fecha_compra:`este_mes`,intencion:`media`}}:/cotizando|viendo|comparando|despues|no se|aun no|todavia/.test(n)?{texto:`Sin problema, ${r}. Te dejo la información y te escribo en unos días por si tienes dudas. Aquí estoy cuando lo necesites.`,datos:{fecha_compra:`cotizando`,intencion:`baja`}}:/cotiz|precio|cuanto|costo|vale|info/.test(n)?{texto:`${o?`El ${s}${a?.anio?` ${a.anio}`:``} tiene precio de lista desde ${U(o)}.`:`Con gusto te cotizo.`}${a?.ficha_url?`\nFicha técnica: ${a.ficha_url}`:``} ¿Lo pagarías de contado o con financiamiento?`,botones:[`De contado`,`Con financiamiento`],datos:{intencion:`media`}}:/color|gris|blanco|negro|rojo|azul|plata/.test(n)?{texto:`Sí, ${r}. Te confirmo los colores disponibles${t.auto?` del ${t.auto}`:``} en inventario y te mando fotos. ¿Te gustaría verlo en persona?`,botones:[`Agendar cita`,`Solo fotos`]}:/a cuenta|mi auto|mi carro|toma|avaluo|cambio/.test(n)?{texto:`¡Claro! Recibimos tu auto a cuenta. Un valuador lo revisa sin costo cuando vengas. ¿Qué auto tienes (marca, modelo y año)?`,datos:{intencion:`media`}}:/entrega|cuanto tarda|disponib|inventario|stock/.test(n)?{texto:`Las unidades de inventario se entregan en 3 a 5 días hábiles después de la firma. ¿Te agendo para apartarla?`,botones:[`Agendar cita`,`Después`]}:t.turnosBot>=5?{texto:`Gracias, ${r}. Para darte una respuesta exacta le paso tu mensaje a ${i}; te contesta en unos minutos.`,pasarAsesor:!0}:t.canal_compra?t.fecha_compra?{texto:`Entendido. ¿Te agendo una visita para que lo veas? Tengo mañana a las 11:00 o a las 17:00.`,botones:[`Mañana 11:00`,`Mañana 17:00`]}:{texto:`¿Para cuándo te gustaría estrenar?`,botones:[`Esta semana`,`Este mes`,`Solo estoy cotizando`]}:{texto:`Con gusto te ayudo. ¿Lo pagarías de contado o con financiamiento?`,botones:[`De contado`,`Con financiamiento`]}}export{d as _,F as a,_ as b,A as c,N as d,L as f,C as g,O as h,K as i,D as l,I as m,q as n,k as o,R as p,G as r,j as s,H as t,P as u,p as v,v as x,g as y};