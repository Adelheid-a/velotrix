import{g as e,h as t,i as n,m as r,n as i,p as a,r as o,s,t as c,u as l}from"./demo-base-DQtcRul4.js";import{B as u,F as d,G as f,H as p,J as m,K as h,M as g,N as ee,O as te,R as ne,T as _,V as re,X as ie,g as ae,h as oe,k as se,m as ce,q as v,r as le,u as ue,w as de,x as fe,z as pe}from"./domain-DSs10orJ.js";var me=l({}.CRM_DB??`data/crm.db`),he=`
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
`;s(n(me),{recursive:!0});var y=new e(me);y.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;`),y.exec(he);var ge=`
  -- Estado inicial a partir de lo que ya había: cerrados sin control; VEXA activa donde el bot atendía;
  -- con asesor y bot apagado, el asesor; sin asesor y bot apagado, back office.
  UPDATE leads SET
    control = CASE
      WHEN estado_contacto IN ('datos_incorrectos','sin_respuesta') OR resultado IN ('venta','no_interesado','descalificado') THEN 'nadie'
      WHEN bot_activo = 1 THEN 'vexa'
      WHEN asesor_id IS NOT NULL THEN 'asesor'
      ELSE 'backoffice' END,
    agente_estado = CASE
      WHEN estado_contacto IN ('datos_incorrectos','sin_respuesta') OR resultado IN ('venta','no_interesado','descalificado') THEN 'desactivado'
      WHEN bot_activo = 1 THEN 'activo'
      ELSE 'pausado' END,
    agente_pausa = CASE
      WHEN estado_contacto IN ('datos_incorrectos','sin_respuesta') OR resultado IN ('venta','no_interesado','descalificado') THEN 'cierre'
      WHEN bot_activo = 1 THEN NULL
      WHEN asesor_id IS NOT NULL THEN 'transferencia'
      ELSE 'control_humano' END;
  UPDATE leads SET bot_activo = 0 WHERE control = 'nadie';
  UPDATE leads SET control_usuario_id = asesor_id WHERE control = 'asesor';
`,_e=`
  UPDATE leads SET aceptacion = CASE WHEN asesor_id IS NULL THEN 'ninguna' WHEN control = 'asesor' THEN 'aceptado' ELSE 'preasignado' END;
  UPDATE leads SET ultima_respuesta_at = COALESCE((SELECT MAX(m.created_at) FROM mensajes m WHERE m.lead_id = leads.id AND m.autor = 'cliente'), responded_at);
  UPDATE leads SET etapa_anterior = 'seguimiento' WHERE resultado = 'sin_avance';
`,ve=[`
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
  `,`DELETE FROM sesiones;`,`
  CREATE TABLE leads_v2 (
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
      CHECK (resultado IS NULL OR resultado IN ('perfilamiento','seguimiento','en_proceso','venta','proximo_mes','sin_avance','no_interesado','descalificado')),
    proximo_contacto     TEXT,
    created_by           INTEGER REFERENCES usuarios(id),
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    first_contact_at     TEXT,
    responded_at         TEXT,
    last_activity_at     TEXT,
    venta_at             TEXT,
    agencia_id           INTEGER REFERENCES agencias(id),
    area                 TEXT CHECK (area IS NULL OR area IN ('nuevos','usados','comerciales')),
    bot_activo           INTEGER NOT NULL DEFAULT 0,
    bot_seguimientos     INTEGER NOT NULL DEFAULT 0,
    bot_proximo_at       TEXT,
    intencion            TEXT CHECK (intencion IS NULL OR intencion IN ('alta','media','baja')),
    mensaje_at           TEXT,
    no_leidos            INTEGER NOT NULL DEFAULT 0,
    prueba_manejo_at     TEXT,
    documentos_at        TEXT,
    apartado_at          TEXT,
    version              TEXT,
    motivo               TEXT,
    registro_marca       INTEGER NOT NULL DEFAULT 0,
    alerta_seguimiento_at TEXT,
    cotizacion_at        TEXT,
    credito_at           TEXT,
    toma_at              TEXT,
    facturacion_at       TEXT,
    CHECK (resultado IS NULL OR estado_contacto = 'contactado')
  );
  INSERT INTO leads_v2 (id, nombre, telefono, correo, auto, fecha_compra, canal, plataforma, canal_compra, pago_inicial, mensualidad,
      historial_crediticio, ciudad, campana_id, asesor_id, estado_contacto, resultado, proximo_contacto, created_by, created_at, updated_at,
      first_contact_at, responded_at, last_activity_at, venta_at, agencia_id, area, bot_activo, bot_seguimientos, bot_proximo_at, intencion,
      mensaje_at, no_leidos, prueba_manejo_at, documentos_at, apartado_at)
    SELECT id, nombre, telefono, correo, auto, fecha_compra, canal, plataforma, canal_compra, pago_inicial, mensualidad,
      historial_crediticio, ciudad, campana_id, asesor_id, estado_contacto, resultado, proximo_contacto, created_by, created_at, updated_at,
      first_contact_at, responded_at, last_activity_at, venta_at, agencia_id, area, bot_activo, bot_seguimientos, bot_proximo_at, intencion,
      mensaje_at, no_leidos, prueba_manejo_at, documentos_at, apartado_at
    FROM leads;
  -- Las ventas que ya existían se dieron por registradas.
  UPDATE leads_v2 SET registro_marca = 1 WHERE resultado = 'venta';
  DROP TABLE leads;
  ALTER TABLE leads_v2 RENAME TO leads;
  CREATE INDEX leads_asesor ON leads(asesor_id);
  CREATE INDEX leads_estado ON leads(estado_contacto);
  CREATE INDEX leads_proximo ON leads(proximo_contacto);
  CREATE INDEX leads_created ON leads(created_at);
  CREATE INDEX leads_venta ON leads(venta_at);
  CREATE INDEX leads_ambito ON leads(agencia_id, area);
  CREATE INDEX leads_mensaje ON leads(mensaje_at);
  CREATE INDEX leads_bot ON leads(bot_activo, bot_proximo_at);
  CREATE INDEX leads_resultado ON leads(resultado, proximo_contacto);
  `,`
  ALTER TABLE leads ADD COLUMN control TEXT NOT NULL DEFAULT 'vexa' CHECK (control IN ('vexa','backoffice','asesor','nadie'));
  ALTER TABLE leads ADD COLUMN control_usuario_id INTEGER REFERENCES usuarios(id);
  ALTER TABLE leads ADD COLUMN agente_estado TEXT NOT NULL DEFAULT 'activo' CHECK (agente_estado IN ('activo','pausado','transferencia','desactivado'));
  ALTER TABLE leads ADD COLUMN agente_pausa TEXT;
  ALTER TABLE leads ADD COLUMN humano_solicitado_at TEXT;
  ALTER TABLE leads ADD COLUMN baja_at TEXT;
  ALTER TABLE leads ADD COLUMN baja_motivo TEXT;

  CREATE TABLE tareas (
    id            INTEGER PRIMARY KEY,
    lead_id       INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL,
    responsable   TEXT NOT NULL CHECK (responsable IN ('vexa','backoffice','asesor','sistema')),
    usuario_id    INTEGER REFERENCES usuarios(id),
    prioridad     INTEGER NOT NULL DEFAULT 3 CHECK (prioridad BETWEEN 0 AND 4),
    motivo        TEXT,
    programada_at TEXT NOT NULL,
    vence_at      TEXT,
    estado        TEXT NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada','en_curso','hecha','fallida','cancelada','vencida')),
    resultado     TEXT,
    cancel_motivo TEXT,
    origen        TEXT,                -- evento que la originó (trazabilidad)
    clave         TEXT UNIQUE,         -- evita crear dos veces la misma tarea (reintentos, eventos repetidos)
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    done_at       TEXT,
    done_by       INTEGER REFERENCES usuarios(id)
  );
  CREATE INDEX tareas_lead ON tareas(lead_id, estado);
  CREATE INDEX tareas_abiertas ON tareas(estado, programada_at);

  CREATE TABLE eventos (
    id         INTEGER PRIMARY KEY,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tipo       TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id),
    actor      TEXT,                   -- 'VEXA', 'Sistema' o vacío si fue una persona (usuario_id)
    detalle    TEXT NOT NULL,
    antes      TEXT,
    despues    TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX eventos_lead ON eventos(lead_id, created_at);

  ${ge}
  `,`
  ALTER TABLE leads ADD COLUMN aceptacion TEXT NOT NULL DEFAULT 'ninguna'
    CHECK (aceptacion IN ('ninguna','preasignado','pendiente','aceptado','rechazado','vencido'));
  ALTER TABLE leads ADD COLUMN aceptacion_limite TEXT;
  ALTER TABLE leads ADD COLUMN aceptacion_at TEXT;
  ALTER TABLE leads ADD COLUMN etapa_anterior TEXT;
  ALTER TABLE leads ADD COLUMN ultima_respuesta_at TEXT;
  CREATE INDEX leads_aceptacion ON leads(aceptacion, aceptacion_limite);
  ${_e}
  INSERT OR IGNORE INTO ajustes (clave, valor) VALUES ('motor_desde', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  `,`
  ALTER TABLE tareas ADD COLUMN cita_id INTEGER REFERENCES citas(id) ON DELETE CASCADE;
  CREATE INDEX tareas_cita ON tareas(cita_id);
  `,`
  CREATE TABLE envios (
    id         INTEGER PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    para       TEXT NOT NULL,
    asunto     TEXT NOT NULL,
    mes        TEXT,
    ok         INTEGER NOT NULL,
    error      TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX envios_usuario ON envios(usuario_id, created_at);
  `];function ye(){let{user_version:e}=y.prepare(`PRAGMA user_version`).get();if(e>=ve.length)return;y.exec(`PRAGMA foreign_keys = OFF`);for(let t=e;t<ve.length;t++){y.exec(`BEGIN`);try{y.exec(ve[t]),y.exec(`PRAGMA user_version = ${t+1}`),y.exec(`COMMIT`)}catch(e){throw y.exec(`ROLLBACK`),y.exec(`PRAGMA foreign_keys = ON`),Error(`Falló la migración ${t+1} de la base de datos: ${e.message}`)}}let t=y.prepare(`PRAGMA foreign_key_check`).all();if(y.exec(`PRAGMA foreign_keys = ON`),t.length)throw Error(`La migración dejó ${t.length} referencias rotas en la base de datos.`)}ye();var b=e=>e.normalize(`NFD`).replace(/\p{Diacritic}/gu,``).toLowerCase();y.function(`fold`,{deterministic:!0},e=>typeof e==`string`?b(e):e);var x=()=>new Date().toISOString(),be=0;function S(e){if(be>0){be++;try{return e()}finally{be--}}be=1;try{return xe(e)}finally{be=0}}function xe(e){y.exec(`BEGIN`);try{let t=e();return y.exec(`COMMIT`),t}catch(e){throw y.exec(`ROLLBACK`),e}}var Se=e=>e?`ficha:${e}`:`ficha`;function Ce(e){let t=y.prepare(`SELECT valor FROM ajustes WHERE clave = ?`).get(Se(e));try{return t?JSON.parse(t.valor):{}}catch{return{}}}function we(e,t){return{sistemaMarca:t.sistemaMarca?.trim()||e.sistemaMarca,reglas:{...e.reglas,...t.reglas},cadencia:{...e.cadencia,...t.cadencia},slaMin:t.slaMin??e.slaMin,rezagoDias:t.rezagoDias??e.rezagoDias,vexaActiva:t.vexaActiva??e.vexaActiva,horario:{...e.horario,...t.horario},aceptacionMin:t.aceptacionMin??e.aceptacionMin,primeraActividadMin:t.primeraActividadMin??e.primeraActividadMin,esperaLlamada:{...e.esperaLlamada,...t.esperaLlamada},recuperacion:{...e.recuperacion,...t.recuperacion}}}function C(e=null){let t=we(ae,Ce(null));return e?we(t,Ce(e)):t}var Te=e=>!!y.prepare(`SELECT 1 FROM ajustes WHERE clave = ?`).get(Se(e));function Ee(e,t=null){return y.prepare(`INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).run(Se(t),JSON.stringify(e)),C(t)}function De(e){return y.prepare(`DELETE FROM ajustes WHERE clave = ?`).run(Se(e)),C(e)}function Oe(e){let t=y.prepare(`SELECT SUM(tipo = 'whatsapp') AS whatsapp, SUM(tipo = 'llamada') AS llamadas FROM interacciones WHERE lead_id = ?`).get(e);return{whatsapp:t.whatsapp??0,llamadas:t.llamadas??0}}var w=class extends Error{res;status;constructor(e=500,t){super(t?.message,{cause:t?.cause}),this.res=t?.res,this.status=e}getResponse(){return this.res?new Response(this.res.body,{status:this.status,headers:this.res.headers}):new Response(this.message,{status:this.status})}},ke=`crm_session`,Ae=72e5,je=3e5;function Me(e){let t=a(16),n=r(e,t,64);return`scrypt$${t.toString(`base64`)}$${n.toString(`base64`)}`}function Ne(e,n){let[i,a,o]=n.split(`$`);if(i!==`scrypt`||!a||!o)return!1;let s=Buffer.from(o,`base64`),c=r(e,Buffer.from(a,`base64`),s.length);return t(c,s)}function Pe(e,t){let n=a(32).toString(`base64url`),r=new Date(Date.now()+Ae);y.prepare(`INSERT INTO sesiones (token, usuario_id, expires_at) VALUES (?, ?, ?)`).run(n,t,r.toISOString());let i=e.req.header(`x-forwarded-proto`)===`https`||e.req.url.startsWith(`https:`);o(e,ke,n,{httpOnly:!0,sameSite:`Lax`,path:`/`,secure:i})}function Fe(e){let t=i(e,ke);t&&y.prepare(`DELETE FROM sesiones WHERE token = ?`).run(t),c(e,ke,{path:`/`})}function Ie(e){let t=i(e,ke);if(!t)return null;let n=y.prepare(`SELECT u.id, u.nombre, u.correo, u.rol, u.agencia_id, u.area, u.cambiar_password, s.expires_at FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expires_at > ? AND u.activo = 1`).get(t,x());if(!n)return null;let r=Date.now()+Ae;return Date.parse(n.expires_at)<r-je&&y.prepare(`UPDATE sesiones SET expires_at = ? WHERE token = ?`).run(new Date(r).toISOString(),t),delete n.expires_at,{...n,ambito:Le(n,e.req.header(`x-ambito`))}}function Le(e,t){let n=new URLSearchParams(t??``),r=Number(n.get(`agencia`))||null,i=le.includes(n.get(`area`)??``)?n.get(`area`):null;return{agenciaId:e.agencia_id??r,area:e.area??i}}var Re=async(e,t)=>{let n=Ie(e);if(!n)throw new w(401,{message:`Inicia sesión para continuar.`});if(n.cambiar_password&&!e.req.path.startsWith(`/api/auth/`))throw new w(403,{message:`Antes de continuar, cambia tu contraseña temporal.`});e.set(`user`,n),await t()},T=e=>h(e.rol).veEquipo;function ze(e,t,n){return!(e.agencia_id&&e.agencia_id!==t||e.area&&e.area!==n)}function Be(e){if(!T(e))throw new w(403,{message:`Solo gerentes o administradores pueden hacer esto.`})}function E(e){if(!h(e.rol).edita)throw new w(403,{message:`Tu rol solo puede consultar; los cambios los hace el coordinador o back office.`})}function Ve(e){if(!h(e.rol).editaTodo)throw new w(403,{message:`Solo el coordinador o back office pueden hacer este cambio.`})}var He=6e4,Ue=60*He,We=e=>new Intl.DateTimeFormat(`en-CA`,{timeZone:`America/Mexico_City`}).format(new Date(e)),Ge=(e,t)=>new Date(`${e}T${String(t).padStart(2,`0`)}:00:00-06:00`).getTime(),D=e=>new Intl.DateTimeFormat(`es-MX`,{timeZone:`America/Mexico_City`,weekday:`short`,day:`numeric`,month:`short`,hour:`numeric`,minute:`2-digit`}).format(new Date(e));function Ke(e,t,n=x()){let r=y.prepare(`SELECT id, lead_id, fecha, estado, tipo FROM citas WHERE id = ?`).get(e);if(!r)return;let i=X(r.lead_id);if(!i||(y.prepare(`UPDATE tareas SET estado = 'cancelada', cancel_motivo = 'La cita cambió', done_at = ? WHERE cita_id = ? AND estado IN ('programada','en_curso') AND tipo IN ('confirmar_cita','recordatorio_cita')`).run(n,e),r.estado!==`agendada`&&r.estado!==`confirmada`)||r.tipo===`entrega`)return;let a=C(i.agencia_id),o=new Date(n).getTime(),s=new Date(r.fecha).getTime();if(s<=o)return;let c=Math.min(v(i),2);if(r.estado===`agendada`){let e=ie(r.fecha),i=Ge(We(s-24*Ue),18),l=e||i<=o||$(a,i)>s?$(a,o):i;F(r.lead_id,{tipo:`confirmar_cita`,responsable:`backoffice`,prioridad:c,motivo:e?`Definir la hora de la cita del ${D(r.fecha).split(`,`)[0]} (quedó sin hora)`:`Confirmar ${_.tipoCita[r.tipo].toLowerCase()} del ${D(r.fecha)}`,programadaAt:new Date(l).toISOString(),venceAt:new Date(Math.max(l+30*He,s-2*Ue)).toISOString(),origen:`cita`,clave:`confirmar:${r.id}:${r.fecha}`,citaId:r.id},t,n)}let l=Ge(We(s),8);!ie(r.fecha)&&l>o&&s-l>=Ue&&R(i.agencia_id)&&!i.baja_at&&F(r.lead_id,{tipo:`recordatorio_cita`,responsable:`vexa`,prioridad:c,motivo:`Recordatorio de la cita de hoy a las ${D(r.fecha).split(`, `).pop()}`,programadaAt:new Date(l).toISOString(),venceAt:r.fecha,origen:`cita`,clave:`recordatorio:${r.id}:${r.fecha}`,citaId:r.id},t,n)}function qe(e,t,n,r=x()){let i=y.prepare(`SELECT id, lead_id, fecha, estado, tipo FROM citas WHERE id = ?`).get(e);if(i){if(t===`confirmada`)y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = 'Confirmada', done_at = ?, done_by = ? WHERE cita_id = ? AND tipo = 'confirmar_cita' AND estado IN ('programada','en_curso')`).run(r,n.usuarioId??null,e);else{if(t===`agendada`)return Ke(e,n,r);if(y.prepare(`UPDATE tareas SET estado = 'cancelada', cancel_motivo = ?, done_at = ? WHERE cita_id = ? AND estado IN ('programada','en_curso') AND tipo IN ('confirmar_cita','recordatorio_cita')`).run(`La cita quedó como ${_.estadoCita[t].toLowerCase()}`,r,e),t===`no_asistio`&&i.tipo!==`entrega`){let e=X(i.lead_id),t=$(C(e.agencia_id),new Date(r).getTime());F(i.lead_id,{tipo:`recuperar_cita`,responsable:`backoffice`,prioridad:Math.min(v(e),2),motivo:`Recuperar la cita: no asistió el ${D(i.fecha)}`,programadaAt:new Date(t).toISOString(),venceAt:new Date(t+4*Ue).toISOString(),origen:`cita`,clave:`recuperar:${i.id}`,citaId:i.id},n,r)}(t===`asistio`||t===`cancelada`)&&L(i.lead_id,[`recuperar_cita`],t===`asistio`?`Asistió`:`Cancelada`,n.usuarioId??null,r)}}}function Je(e){let t=x(),n=y.prepare(`SELECT t.id, t.lead_id, t.cita_id FROM tareas t WHERE t.tipo = 'recordatorio_cita' AND t.responsable = 'vexa' AND t.estado = 'programada' AND t.programada_at <= ? LIMIT 50`).all(t);for(let r of n)try{S(()=>{let n=r.cita_id?y.prepare(`SELECT fecha, estado FROM citas WHERE id = ?`).get(r.cita_id):void 0,i=X(r.lead_id),a=!n||!i?`La cita ya no existe`:[`agendada`,`confirmada`].includes(n.estado)?i.baja_at?`El cliente pidió no ser contactado`:null:`La cita ya no está en pie`;if(a||!n||!i){y.prepare(`UPDATE tareas SET estado = 'cancelada', cancel_motivo = ?, done_at = ? WHERE id = ?`).run(a,t,r.id);return}let o=D(n.fecha).split(`, `).pop();e(i.id,`¡Buen día, ${i.nombre.split(` `)[0]}! Te recuerdo tu cita de hoy a las ${o} en ${i.agencia??`la agencia`}${i.asesor?` con ${i.asesor.split(` `)[0]}`:``}. ¿Nos confirmas que vienes?`,t),y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = 'Enviado', done_at = ? WHERE id = ?`).run(t,r.id),J(i.id,null,`whatsapp`,`VEXA · recordatorio de la cita de hoy (${o}).`,t)})}catch(e){console.error(`Recordatorio de cita (tarea ${r.id}):`,e)}return n.length}var Ye=6e4,Xe=60*Ye,Ze=(e,t,n)=>new Date($(C(e),new Date(t).getTime())+n*Ye).toISOString();function Qe(e,t,n=x()){let r=X(e);if(!r.asesor_id)throw new w(409,{message:`Asígnale un asesor antes de transferir.`});let i=C(r.agencia_id);if(!i.reglas.aceptacionAsesor)return $e(e,t,n,`Transferido al asesor`);let a=Ze(r.agencia_id,n,i.aceptacionMin);I(e,{tipos:[`asignacion`]},`Nueva solicitud de aceptación`,t,n),y.prepare(`UPDATE leads SET aceptacion = 'pendiente', aceptacion_limite = ?, aceptacion_at = NULL, version = COALESCE(version, ?), proximo_contacto = ? WHERE id = ?`).run(a,r.auto?pe:null,n,e),r.control===`vexa`&&z(r,{agente:`transferencia`,pausa:`transferencia`},t,`Transferencia pendiente: VEXA espera a que el asesor acepte`,n),F(e,{tipo:`asignacion`,responsable:`asesor`,usuarioId:r.asesor_id,prioridad:Math.min(v(r),2),motivo:`Aceptar la oportunidad (ya tiene el historial)`,programadaAt:n,venceAt:a,origen:`aceptacion`,clave:`aceptacion:${e}:${r.asesor_id}:${n}`},t,n),P(e,t,`asignacion`,`Oportunidad transferida a ${r.asesor}: tiene ${i.aceptacionMin} min laborales para aceptarla`,n)}function $e(e,t,n,r){let i=X(e),a=C(i.agencia_id);y.prepare(`UPDATE leads SET aceptacion = 'aceptado', aceptacion_at = ?, aceptacion_limite = NULL WHERE id = ?`).run(n,e),z(i,{control:`asesor`,usuarioId:i.asesor_id,agente:i.agente_estado===`desactivado`?`desactivado`:`pausado`,pausa:i.agente_estado===`desactivado`?i.agente_pausa:`transferencia`},t,r,n),I(e,{responsables:[`vexa`,`backoffice`],tipos:[`whatsapp`,`llamada`,`perfilamiento`,`asignacion`]},`El asesor tomó la oportunidad`,t,n),L(e,[`asignacion`],`Aceptada`,t.usuarioId??null,n),F(e,{tipo:`llamada`,responsable:`asesor`,usuarioId:i.asesor_id,prioridad:v(i)===0?0:Math.min(v(i),2),motivo:`Primera atención del asesor`,programadaAt:n,venceAt:Ze(i.agencia_id,n,a.primeraActividadMin),origen:`aceptacion`,clave:`primera:${e}:${n}`},t,n),y.prepare(`UPDATE leads SET proximo_contacto = ? WHERE id = ?`).run(n,e);let o=X(e);o.estado_contacto===`contactado`&&o.resultado===`perfilamiento`&&Y(o,t.usuarioId??null,{resultado:`seguimiento`},n)}function et(e,t,n=x()){E(e);let r=q(e,t);if(e.rol===`asesor`&&r.asesor_id!==e.id)throw new w(403,{message:`Esta oportunidad es de otro asesor.`});if(r.aceptacion!==`pendiente`)throw new w(409,{message:`No hay una oportunidad por aceptar en este cliente.`});$e(t,{usuarioId:e.id},n,e.rol===`asesor`?`Aceptó la oportunidad`:`Aceptó la oportunidad por ${r.asesor}`),J(t,e.id,`asignacion`,e.rol===`asesor`?`Aceptó la oportunidad`:`${r.asesor} queda como responsable (lo confirmó coordinación)`,n)}function tt(e,t,n,r=x()){E(e);let i=q(e,t);if(e.rol===`asesor`&&i.asesor_id!==e.id)throw new w(403,{message:`Esta oportunidad es de otro asesor.`});if(i.aceptacion!==`pendiente`)throw new w(409,{message:`No hay una oportunidad por aceptar en este cliente.`});nt(i,`rechazado`,{usuarioId:e.id},`${i.asesor} rechazó la oportunidad${n?.trim()?`: ${n.trim()}`:``}`,r)}function nt(e,t,n,r,i){y.prepare(`UPDATE leads SET aceptacion = ?, aceptacion_limite = NULL WHERE id = ?`).run(t,e.id),y.prepare(`UPDATE tareas SET estado = ?, resultado = ?, done_at = ? WHERE lead_id = ? AND tipo = 'asignacion' AND responsable = 'asesor' AND estado IN ('programada','en_curso')`).run(t===`vencido`?`vencida`:`hecha`,t===`vencido`?`No la aceptó a tiempo`:`Rechazada`,i,e.id),F(e.id,{tipo:`asignacion`,responsable:`backoffice`,prioridad:1,motivo:`Reasignar asesor: ${r.toLowerCase()}`,programadaAt:i,venceAt:new Date(new Date(i).getTime()+30*Ye).toISOString(),origen:`aceptacion`,clave:`reasignar:${e.id}:${i}`},n,i),y.prepare(`UPDATE leads SET proximo_contacto = ? WHERE id = ?`).run(i,e.id),P(e.id,n,`asignacion`,r,i),J(e.id,n.usuarioId??null,`asignacion`,r,i)}function rt(){let e=x(),t=y.prepare(`SELECT id FROM leads WHERE aceptacion = 'pendiente' AND aceptacion_limite < ? LIMIT 50`).all(e);for(let{id:n}of t)try{S(()=>{let t=X(n);nt(t,`vencido`,{actor:`Sistema`},`${t.asesor??`El asesor`} no aceptó la oportunidad a tiempo`,e)})}catch(e){console.error(`Aceptación vencida (lead ${n}):`,e)}return t.length}var it=()=>y.prepare(`SELECT valor FROM ajustes WHERE clave = 'motor_desde'`).get()?.valor??`9999`;function at(e,t=x()){let n=X(e),r=C(n.agencia_id),i=n.aceptacion===`aceptado`&&!!n.asesor_id,a=!i&&R(n.agencia_id)&&n.control===`vexa`&&n.agente_estado===`activo`,o=Xn(r,new Date(t).getTime(),3),s={actor:`Sistema`};o.forEach(([r,o],c)=>{let l=c===0?Math.max(r,Math.min(new Date(t).getTime(),o-Xe)):r+Math.min(2*Xe,(o-r)/3),u=c===2;F(e,{tipo:u?`llamada`:a?`whatsapp`:i?`llamada`:`whatsapp`,responsable:u?`backoffice`:a?`vexa`:i?`asesor`:`backoffice`,usuarioId:!u&&i?n.asesor_id:null,prioridad:Math.max(v(n),2),motivo:`${u?`Llamada de rescate`:`Recuperación ${c+1} de 3`} · dejó de responder en ${_.resultado[n.resultado??`seguimiento`].toLowerCase()}`,programadaAt:new Date(l).toISOString(),venceAt:new Date(o).toISOString(),origen:`recuperacion`,clave:`recuperacion:${e}:${n.ultima_respuesta_at??`x`}:${c+1}`},s,t)}),P(e,s,`recuperacion`,`Dejó de responder: 3 intentos de recuperación (${i?`asesor`:a?`VEXA`:`back office`} y rescate de back office)`,t),y.prepare(`UPDATE leads SET proximo_contacto = (SELECT MIN(programada_at) FROM tareas WHERE lead_id = ? AND origen = 'recuperacion' AND estado = 'programada' AND responsable <> 'vexa') WHERE id = ?`).run(e,e)}function ot(){let e=Date.now(),t=new Date(e).toISOString(),n=y.prepare(`SELECT l.id, l.agencia_id, l.ultima_respuesta_at FROM leads l
       WHERE l.estado_contacto = 'contactado' AND l.resultado IN ('perfilamiento','seguimiento','en_proceso')
         AND l.baja_at IS NULL AND l.ultima_respuesta_at IS NOT NULL AND l.created_at >= ?
         AND (l.proximo_contacto IS NULL OR l.proximo_contacto < ?)
         AND NOT EXISTS (SELECT 1 FROM citas c WHERE c.lead_id = l.id AND c.estado IN ('agendada','confirmada') AND c.fecha > ?)
         AND NOT EXISTS (SELECT 1 FROM tareas t WHERE t.lead_id = l.id AND t.origen = 'recuperacion' AND t.created_at > l.ultima_respuesta_at)
         AND NOT EXISTS (SELECT 1 FROM tareas t WHERE t.lead_id = l.id AND t.tipo = 'intervencion' AND t.estado IN ('programada','en_curso'))
       LIMIT 200`).all(it(),t,t),r=0;for(let i of n){let n=C(i.agencia_id).recuperacion.inactividadHoras;if(!(new Date(i.ultima_respuesta_at).getTime()>e-n*Xe))try{S(()=>at(i.id,t)),r++}catch(e){console.error(`Recuperación (lead ${i.id}):`,e)}}return r}function st(){let e=x(),t=new Date(Date.now()-30*Ye).toISOString(),n=y.prepare(`SELECT l.id FROM leads l
       WHERE l.estado_contacto = 'contactado' AND l.resultado IN ('perfilamiento','seguimiento','en_proceso') AND l.baja_at IS NULL
         AND EXISTS (SELECT 1 FROM tareas t WHERE t.lead_id = l.id AND t.origen = 'recuperacion' AND t.created_at > l.ultima_respuesta_at)
         AND NOT EXISTS (SELECT 1 FROM tareas t WHERE t.lead_id = l.id AND t.origen = 'recuperacion' AND t.estado IN ('programada','en_curso'))
         AND (SELECT MAX(t.programada_at) FROM tareas t WHERE t.lead_id = l.id AND t.origen = 'recuperacion') < ?
         AND (l.alerta_seguimiento_at IS NULL OR l.alerta_seguimiento_at < l.ultima_respuesta_at)
       LIMIT 50`).all(t);for(let{id:t}of n)try{S(()=>{let n=X(t),r=y.prepare(`SELECT COUNT(*) AS total, SUM(estado = 'hecha') AS hechas FROM tareas WHERE lead_id = ? AND origen = 'recuperacion' AND created_at > ?`).get(t,n.ultima_respuesta_at);if((r.hechas??0)>=r.total)Y(n,null,{resultado:`sin_avance`,motivo:`tres_intentos`},e);else{let n=`⚠ Alerta de falta de seguimiento: la recuperación terminó con ${r.hechas??0} de ${r.total} intentos hechos. No pasa a Sin avance hasta completarla.`;y.prepare(`UPDATE leads SET alerta_seguimiento_at = ? WHERE id = ?`).run(e,t),J(t,null,`nota`,n,e),P(t,{actor:`Sistema`},`alerta`,n,e)}})}catch(e){console.error(`Cierre de recuperación (lead ${t}):`,e)}return n.length}function ct(e,t,n=x()){y.prepare(`UPDATE leads SET ultima_respuesta_at = ?, alerta_seguimiento_at = CASE WHEN estado_contacto = 'contactado' THEN NULL ELSE alerta_seguimiento_at END WHERE id = ?`).run(n,e),I(e,{origen:`recuperacion`},`El cliente respondió`,t,n)}var lt=e=>e.normalize(`NFD`).replace(/\p{Diacritic}/gu,``).toLowerCase(),ut=e=>e.split(` `)[0]??e,dt={jetta:489900,virtus:399900,polo:319900,"t-cross":459900,taos:569900,tiguan:719900,teramont:989900,nivus:449900,saveiro:359900,amarok:0xf8ffc,crafter:1089900,transporter:899900,caddy:619900},ft=e=>{if(!e)return null;let t=Object.keys(dt).find(t=>lt(e).includes(t));return t?/\b20\d\d\b/.test(e)?Math.round(dt[t]*.6/1e3)*1e3:dt[t]:null},O=e=>`$${e.toLocaleString(`es-MX`)}`;function pt(e){let t=new Intl.DateTimeFormat(`en-CA`,{timeZone:`America/Mexico_City`}).format(new Date(Date.now()+864e5));return new Date(`${t}T${String(e).padStart(2,`0`)}:00:00-06:00`).toISOString()}function mt(e,t){let n=e.area===`usados`?`Seminuevos`:e.area===`comerciales`?`Vehículos Comerciales`:`Autos Nuevos`,r=re(t)?``:`

Nuestro horario de piso es de 9 a 19 h, pero yo te atiendo ahora mismo y un asesor te contacta a primera hora.`;return{texto:`¡Hola, ${ut(e.nombre)}! Soy VEXA, la asistente digital de ${n} ${e.agencia??``}.`.replace(/\s+\./,`.`)+` Gracias por tu interés${e.auto?` en el ${e.auto}`:``}.${r}\n\n¿Cómo te gustaría empezar?`,botones:[`Me gustaría cotizar`,`Quiero agendar una cita`,`Hablar con un asesor`]}}function ht(e,t){let n=ut(e.nombre),r=[`${n}, ¿pudiste ver mi mensaje? Sigo aquí para ayudarte${e.auto?` con el ${e.auto}`:``}.`,`Hola de nuevo, ${n}. ¿Te comparto una cotización sin compromiso${e.auto?` del ${e.auto}`:``}? Solo dime si lo piensas de contado o a crédito.`,`${n}, si prefieres que te llame un asesor a una hora específica, solo dime cuál y lo agendo.`,`${n}, también podemos agendar una visita para que lo veas y hagas tu prueba de manejo. ¿Qué día te queda mejor?`,`${n}, no quiero ser insistente. Te dejo este chat abierto: cuando quieras retomamos tu cotización.`];return{texto:r[Math.min(t,r.length-1)],botones:t===0?[`Sí, cotizar`,`Agendar cita`]:void 0}}function gt(e,t){let n=lt(e),r=ut(t.nombre),i=t.asesor?ut(t.asesor):`un asesor`,a=t.cotizacion??null,o=a?.precio??null,s=a?[a.modelo,a.version].filter(Boolean).join(` `):t.auto;if(/asesor|humano|persona|llam(a|en|ar)me|marcar/.test(n))return{texto:`Claro, ${r}. Le paso tu conversación a ${i}${t.area?`, del equipo de ${_.area[t.area]}`:``}. Te escribe en unos minutos.`,pasarAsesor:!0,pideHumano:!0,datos:{intencion:`alta`}};let c=n.match(/\b(1[0-8]|9)(?::00)?\s*(h|hrs|am|pm)?\b/);if(/manana|11|17|5 ?pm|en la tarde|en la manana/.test(n)&&/cita|ir|visit|agend|puedo|ok|si|perfect|va/.test(n)||c&&t.turnosBot>1&&/cita|agend|manana/.test(n)){let e=/17|5 ?pm|tarde/.test(n)?17:11;return{texto:`¡Listo, ${r}! Te agendé mañana a las ${e}:00 h en ${t.agencia??`la agencia`}. ${i===`un asesor`?`Un asesor`:i} te va a recibir y te confirma un día antes. 📍 ¿Quieres que tengamos la unidad lista para prueba de manejo?`,botones:[`Sí, prueba de manejo`,`Solo visita`],cita:{fecha:pt(e)},datos:{intencion:`alta`}}}if(t.tieneCita&&/prueba de manejo|manejarlo|solo visita|nada mas visita|solo verlo/.test(n))return{texto:`${/solo visita|nada mas visita|solo verlo/.test(n)?`Anotado, te esperamos.`:`Anotado: tendremos el ${s??`auto`} listo para tu prueba de manejo. Trae tu licencia vigente.`} ${i===`un asesor`?`Un asesor`:i} te escribe por aquí para confirmar. ¡Nos vemos mañana!`,pasarAsesor:!0,datos:{intencion:`alta`}};if(/cita|agend|visit|ir a la agencia|prueba de manejo|conocerlo|verlo/.test(n))return t.tieneCita?{texto:`Ya tienes una cita con nosotros, ${r}. Si quieres moverla, ${i} te ayuda en un momento.`,pasarAsesor:!0}:{texto:`¡Perfecto! Tengo espacio mañana. ¿Te queda mejor a las 11:00 o a las 17:00?`,botones:[`Mañana 11:00`,`Mañana 17:00`],datos:{intencion:`alta`}};if(/contado|cash|efectivo|de una sola/.test(n))return{texto:`Excelente. ${o?`De contado, el ${s} tiene precio de lista de ${O(o)}; tu asesor te confirma la disponibilidad.`:`Tu asesor te comparte el precio y la disponibilidad del catálogo de la agencia.`} ¿Para cuándo lo necesitas?`,botones:[`Esta semana`,`Este mes`,`Solo estoy cotizando`],datos:{canal_compra:`contado`,intencion:`alta`}};if(/financ|credito|mensualidad|plazo|enganche|meses/.test(n)&&!/\d{4,}|\d+\s*(mil|k)\b/.test(n)){let e=a?.financiamiento;return a&&e?.enganche_20&&e.m20_60?{texto:`Con financiamiento, el ${[a.modelo,e.version,e.anio].filter(Boolean).join(` `)}${e.precio?` (${O(e.precio)})`:``} queda así, sujeto a aprobación:
• 20% de enganche (${O(e.enganche_20)}): desde ${O(e.m20_60)} al mes a 5 años`+(e.enganche_40&&e.m40_60?`
• 40% de enganche (${O(e.enganche_40)}): desde ${O(e.m40_60)} al mes a 5 años`:``)+`
¿Cuánto te gustaría dar de enganche?`,botones:[`20%`,`40%`,`Otra cantidad`],datos:{canal_compra:`credito`,intencion:`media`}}:{texto:`Con financiamiento manejamos enganche desde 10% y plazos de 12 a 72 meses. ¿Cuánto te gustaría dar de enganche, aproximadamente?`,botones:[`Menos de $50,000`,`$50,000 a $100,000`,`Más de $100,000`],datos:{canal_compra:`credito`,intencion:`media`}}}let l=n.match(/^\s*(20|40)\s*%/);if(l&&a?.financiamiento){let e=a.financiamiento,t=l[1]===`20`,n=t?e.enganche_20:e.enganche_40,r=t?e.m20_60:e.m40_60;if(n&&r)return{texto:`Con ${l[1]}% de enganche (${O(n)}), el ${[a.modelo,e.version].filter(Boolean).join(` `)} te queda desde ${O(r)} al mes a 5 años, sujeto a aprobación. ¿Para cuándo te gustaría estrenar?`,botones:[`Esta semana`,`Este mes`,`Solo estoy cotizando`],datos:{pago_inicial:n,canal_compra:`credito`,intencion:`media`}}}let u=n.match(/(\d[\d,.]*)\s*(mil|k)?/);if(u&&/mil|k|\$|enganche|\d{5,}/.test(n)){let e=Number(u[1].replace(/[,.]/g,``));if(u[2]&&(e*=1e3),/menos de/.test(n)&&(e=4e4),/mas de/.test(n)&&(e=12e4),e>=5e3&&e<=5e6){let t=o?Math.round((o-e)*1.25/48/100)*100:null;return{texto:`Gracias, ${r}. Con ${O(e)} de enganche${t?`, el ${s} te quedaría en unos ${O(t)} al mes a 48 meses`:``} (sujeto a aprobación). ¿Para cuándo te gustaría estrenar?`,botones:[`Esta semana`,`Este mes`,`Solo estoy cotizando`],datos:{pago_inicial:e,canal_compra:`credito`,intencion:`media`}}}}return/esta semana|\bya\b|urge|lo antes|\bhoy\b/.test(n)?{texto:`¡Perfecto! Para esta semana lo mejor es que lo veas en persona. ¿Te agendo mañana a las 11:00 o a las 17:00?`,botones:[`Mañana 11:00`,`Mañana 17:00`],datos:{fecha_compra:`esta_semana`,intencion:`alta`}}:/este mes|semanas|quincena/.test(n)?{texto:`Muy bien. Te comparto la ficha y la cotización, y ${i} te da seguimiento. ¿Te gustaría agendar una visita para verlo?`,botones:[`Agendar cita`,`Después`],datos:{fecha_compra:`este_mes`,intencion:`media`}}:/cotizando|viendo|comparando|despues|no se|aun no|todavia/.test(n)?{texto:`Sin problema, ${r}. Te dejo la información y te escribo en unos días por si tienes dudas. Aquí estoy cuando lo necesites.`,datos:{fecha_compra:`cotizando`,intencion:`baja`}}:/cotiz|precio|cuanto|costo|vale|info/.test(n)?{texto:`${o?`El ${s}${a?.anio?` ${a.anio}`:``} tiene precio de lista desde ${O(o)}.`:`Con gusto te cotizo.`}${a?.ficha_url?`\nFicha técnica: ${a.ficha_url}`:``} ¿Lo pagarías de contado o con financiamiento?`,botones:[`De contado`,`Con financiamiento`],datos:{intencion:`media`}}:/color|gris|blanco|negro|rojo|azul|plata/.test(n)?{texto:`Sí, ${r}. Te confirmo los colores disponibles${t.auto?` del ${t.auto}`:``} en inventario y te mando fotos. ¿Te gustaría verlo en persona?`,botones:[`Agendar cita`,`Solo fotos`]}:/a cuenta|mi auto|mi carro|toma|avaluo|cambio/.test(n)?{texto:`¡Claro! Recibimos tu auto a cuenta. Un valuador lo revisa sin costo cuando vengas. ¿Qué auto tienes (marca, modelo y año)?`,datos:{intencion:`media`}}:/entrega|cuanto tarda|disponib|inventario|stock/.test(n)?{texto:`Las unidades de inventario se entregan en 3 a 5 días hábiles después de la firma. ¿Te agendo para apartarla?`,botones:[`Agendar cita`,`Después`]}:t.turnosBot>=5?{texto:`Gracias, ${r}. Para darte una respuesta exacta le paso tu mensaje a ${i}; te contesta en unos minutos.`,pasarAsesor:!0}:t.canal_compra?t.fecha_compra?{texto:`Entendido. ¿Te agendo una visita para que lo veas? Tengo mañana a las 11:00 o a las 17:00.`,botones:[`Mañana 11:00`,`Mañana 17:00`]}:{texto:`¿Para cuándo te gustaría estrenar?`,botones:[`Esta semana`,`Este mes`,`Solo estoy cotizando`]}:{texto:`Con gusto te ayudo. ¿Lo pagarías de contado o con financiamiento?`,botones:[`De contado`,`Con financiamiento`]}}function _t(){return{autos:y.prepare(`SELECT * FROM autos ORDER BY modelo`).all(),precios:y.prepare(`SELECT * FROM precios ORDER BY modelo, anio DESC, precio_lista`).all(),tabulador:y.prepare(`SELECT * FROM tabulador ORDER BY precio`).all()}}var vt=()=>y.prepare(`SELECT * FROM respuestas_rapidas ORDER BY orden, id`).all(),yt=()=>y.prepare(`SELECT * FROM cadencia ORDER BY orden`).all();function bt(e,t){let n=t.atajo.trim().replace(/^\//,``).replace(/\s+/g,``).toLowerCase();if(!n)throw new w(400,{message:`Escribe un atajo (por ejemplo: cita).`});if(y.prepare(`SELECT id FROM respuestas_rapidas WHERE atajo = ? AND id IS NOT ?`).get(n,e))throw new w(409,{message:`Ya existe una respuesta con el atajo /${n}.`});if(e===null){let{orden:e}=y.prepare(`SELECT COALESCE(MAX(orden), 0) + 1 AS orden FROM respuestas_rapidas`).get();return Number(y.prepare(`INSERT INTO respuestas_rapidas (nombre, atajo, texto, orden) VALUES (?, ?, ?, ?)`).run(t.nombre.trim(),n,t.texto.trim(),e).lastInsertRowid)}return y.prepare(`UPDATE respuestas_rapidas SET nombre = ?, atajo = ?, texto = ? WHERE id = ?`).run(t.nombre.trim(),n,t.texto.trim(),e),e}var xt=e=>y.prepare(`DELETE FROM respuestas_rapidas WHERE id = ?`).run(e);function St(e){S(()=>{y.exec(`DELETE FROM cadencia`);let t=y.prepare(`INSERT INTO cadencia (orden, cuando, llamada, mensaje) VALUES (?, ?, ?, ?)`);e.forEach((e,n)=>t.run(n+1,e.cuando.trim(),e.llamada.trim(),e.mensaje?.trim()||null))})}function Ct(e,t){if(!e)return null;let n=` ${b(e)} `;return[...t].sort((e,t)=>t.length-e.length).find(e=>n.includes(` ${b(e)} `)||n.includes(` ${b(e)}`))??null}function wt(e){let t=Ct(e,y.prepare(`SELECT modelo FROM autos WHERE activo = 1 UNION SELECT modelo FROM precios UNION SELECT modelo FROM tabulador`).all().map(e=>e.modelo));if(!t)return null;let n=y.prepare(`SELECT * FROM tabulador WHERE modelo = ? ORDER BY anio DESC LIMIT 1`).get(t),r=y.prepare(`SELECT * FROM precios WHERE modelo = ? ORDER BY anio DESC, precio_lista LIMIT 1`).get(t),i=y.prepare(`SELECT * FROM autos WHERE modelo = ?`).get(t),a=r?.precio_lista??n?.precio??i?.precio_desde;return a?{modelo:i?.modelo??r?.modelo??t,version:r?.version??n?.version??null,anio:r?.anio??n?.anio??i?.anio??null,precio:a,ficha_url:i?.ficha_url??null,financiamiento:n?.enganche_20&&n.m20_60?{version:n.version,anio:n.anio,precio:n.precio,enganche_20:n.enganche_20,m20_60:n.m20_60,enganche_40:n.enganche_40,m40_60:n.m40_60}:null}:null}var k=e=>{let t=(e??``).replace(/[^\d.]/g,``);return t&&Number.isFinite(Number(t))?Math.round(Number(t)):null},A=e=>(e??``).trim()||null,Tt=e=>{let t=e.trim().replace(/\s+/g,` `).toLowerCase();return t.charAt(0).toUpperCase()+t.slice(1)},Et=e=>e.trim().toLowerCase().replace(/(^|[\s-])([a-záéíóúñ])/g,(e,t,n)=>t+n.toUpperCase()).replace(/\bId\.(\d)/i,`ID.$1`).replace(/\bGli\b/,`GLI`).replace(/\bGti\b/,`GTI`),j=(e,...t)=>e.findIndex(e=>t.every(t=>e.some(e=>b(e).includes(t))));function M(e,...t){let n=Object.keys(e).find(e=>t.every(t=>b(e).includes(t)));return n?e[n]:null}function Dt(e,t){let n={autos:0,precios:0,tabulador:0,respuestas:0,cadencia:0,metas:0},r=M(e,`config`,`autos`),i=M(e,`precios`,`lista`),a=M(e,`tabulador`),o=M(e,`respuestas`,`rapidas`),s=M(e,`mensajes`,`segui`),c=M(e,`metas`,`mensuales`),l=M(e,`configuracion`);return S(()=>{if(r){let e=j(r,`auto`,`ficha`);y.exec(`DELETE FROM autos`);let t=y.prepare(`INSERT OR REPLACE INTO autos (modelo, ficha_url, catalogo_url, imagen_url, anio, precio_desde, versiones, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);for(let i of r.slice(e+1))A(i[0])&&(t.run(Et(i[0]),A(i[1]),A(i[2]),A(i[3]),k(i[4]),k(i[5]),A(i[6]),A(i[7])),n.autos++)}if(i){let e=j(i,`auto`,`precio`);y.exec(`DELETE FROM precios`);let t=y.prepare(`INSERT INTO precios (modelo, version, anio, precio_lista) VALUES (?, ?, ?, ?)`);for(let r of i.slice(e+1)){let e=k(r[2]);A(r[0])&&e&&(t.run(Et(r[0]),A(r[1])??``,k(r[3]),e),n.precios++)}}if(a){let e=j(a,`auto`,`version`,`precio`);y.exec(`DELETE FROM tabulador`);let t=y.prepare(`INSERT INTO tabulador (modelo, version, anio, precio, enganche_20, enganche_40, m20_36, m20_48, m20_60, m40_36, m40_48, m40_60, oferta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),r=(a[e]??[]).map(e=>b(e)),i=(e,t=0)=>r.findIndex((n,r)=>r>=t&&e(n)),o=i(e=>e===`auto`),s=i(e=>e.startsWith(`version`)),c=i(e=>e===`ano`||e===`anio`),l=i(e=>e===`precio`),u=i(e=>e===`0.2`||e===`20%`),d=i(e=>e===`0.4`||e===`40%`),f=i(e=>e.startsWith(`3 ano`),d+1),p=i(e=>e.startsWith(`3 ano`),f+1),m=i(e=>e.includes(`promo`)),h=(e,t)=>t>=0?e[t]:void 0;for(let r of a.slice(e+1))A(h(r,o))&&k(h(r,l))&&(t.run(Et(h(r,o)),A(h(r,s))?Et(h(r,s)):null,k(h(r,c)),k(h(r,l)),k(h(r,u)),k(h(r,d)),k(h(r,f)),k(h(r,f+1)),k(h(r,f+2)),k(h(r,p)),k(h(r,p+1)),k(h(r,p+2)),A(h(r,m))),n.tabulador++)}if(o){let e=j(o,`nombre`,`atajo`);y.exec(`DELETE FROM respuestas_rapidas`);let t=y.prepare(`INSERT INTO respuestas_rapidas (nombre, atajo, texto, orden) VALUES (?, ?, ?, ?)`),r=new Set;for(let i of o.slice(e+1)){let e=A(i[0]),a=A(i[2]);if(!e||!a)continue;let o=(i[1]??``).trim().toLowerCase().replace(/\s+/g,``);for(o&&o!==`na`||(o=b(e).split(` `)[0]??`r${n.respuestas+1}`);r.has(o);)o+=`2`;r.add(o),t.run(Tt(e),o,a,++n.respuestas)}}if(s){y.exec(`DELETE FROM cadencia`);let e=y.prepare(`INSERT INTO cadencia (orden, cuando, llamada, mensaje) VALUES (?, ?, ?, ?)`),t=[];for(let e of s){let n=e.map(e=>e.trim()).filter(Boolean);if(!n.length)continue;let r=n.find(e=>/llamada/i.test(e));r?t.push({cuando:Tt(n[0].replace(/\.\s+/g,` · `)),llamada:Tt(r),mensaje:null}):/^mensaje/i.test(n[0])&&t.length&&(t[t.length-1].mensaje=Tt(n[0]))}t.forEach((t,n)=>e.run(n+1,t.cuando,t.llamada,t.mensaje)),n.cadencia=t.length}if(c&&t.agenciaId&&t.area){let e={};for(let t of l??[]){let n=b(t[0]??``),r=Number(t[1]);Number.isFinite(r)&&(n.includes(`meta contribucion`)&&(e.contribucion_digital=r),n.includes(`citas vs contactables`)&&(e.tasa_citas=r),n.includes(`ventas vs citas`)&&(e.tasa_cierre=r),n.includes(`meta contactabilidad`)&&(e.tasa_contactabilidad=r))}let r=j(c,`periodo`,`objetivo`),i=y.prepare(`INSERT INTO metas_centro (mes, agencia_id, area, ventas_agencia, contribucion_digital, tasa_cierre, tasa_citas, tasa_contactabilidad)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(mes, agencia_id, area) DO UPDATE SET ventas_agencia = excluded.ventas_agencia, contribucion_digital = excluded.contribucion_digital,
           tasa_cierre = excluded.tasa_cierre, tasa_citas = excluded.tasa_citas, tasa_contactabilidad = excluded.tasa_contactabilidad`);for(let a of c.slice(r+1)){let r=(a[0]??``).match(/(\d{4})-(\d{2})|(\d{2})\/(\d{2})\/(\d{4})/),o=r?r[1]?`${r[1]}-${r[2]}`:`${r[5]}-${r[4]}`:null,s=k(a[3]);o&&s&&(i.run(o,t.agenciaId,t.area,s,e.contribucion_digital??.3,e.tasa_cierre??.6,e.tasa_citas??.4,e.tasa_contactabilidad??.4),n.metas++)}}}),n}var Ot=36e5,kt=3*Ot,At=`
  EXISTS (SELECT 1 FROM mensajes mc WHERE mc.id = (
      SELECT id FROM mensajes WHERE lead_id = l.id AND autor = 'cliente' ORDER BY created_at DESC, id DESC LIMIT 1)
    AND (CAST(strftime('%w', mc.created_at, '-6 hours') AS INTEGER) = 0
         OR CAST(strftime('%H', mc.created_at, '-6 hours') AS INTEGER) NOT BETWEEN 9 AND 18))`,jt=`EXISTS (SELECT 1 FROM tareas th WHERE th.lead_id = l.id AND th.tipo = 'intervencion' AND th.estado IN ('programada','en_curso'))`,Mt=e=>({humano:jt,mias:`l.control_usuario_id = ${Number(e)} AND l.control IN ('backoffice','asesor')`,bot:`l.control = 'vexa' AND l.agente_estado = 'activo'`,transferencia:`l.aceptacion = 'pendiente'`,todas:`1=1`,sin_leer:`l.no_leidos > 0`,asesor:`l.control IN ('backoffice','asesor')`,fuera:At});function Nt(e,t){let n=K(e),r=Mt(e.id),i=[n.sql,`l.mensaje_at IS NOT NULL`,r[t.filtro]],a=[...n.params];if(t.q?.trim()){let e=t.q.replace(/\D/g,``);i.push(e.length>=3?`l.telefono LIKE ?`:`fold(l.nombre) LIKE ?`),a.push(e.length>=3?`%${e}%`:`%${b(t.q.trim())}%`)}let o=`
    SELECT l.id AS lead_id, l.nombre, l.telefono, l.auto, ag.nombre AS agencia, l.area, u.nombre AS asesor,
           l.bot_activo, l.intencion, l.no_leidos,
           m.autor AS ultimo_autor, m.texto AS ultimo_texto, m.created_at AS ultimo_at,
           ${At} AS fuera_horario,
           l.control, cu.nombre AS control_usuario, l.agente_estado, l.aceptacion, ${jt} AS pide_humano
    FROM leads l
    LEFT JOIN usuarios cu ON cu.id = l.control_usuario_id
    JOIN mensajes m ON m.id = (SELECT id FROM mensajes WHERE lead_id = l.id ORDER BY created_at DESC, id DESC LIMIT 1)
    LEFT JOIN agencias ag ON ag.id = l.agencia_id
    LEFT JOIN usuarios u ON u.id = l.asesor_id
    WHERE ${i.join(` AND `)}
    ORDER BY ${jt} DESC, l.mensaje_at DESC LIMIT 200`,s=y.prepare(o).all(...a),c=y.prepare(`SELECT ${fe.map(e=>`SUM(${r[e]}) AS ${e}`).join(`, `)} FROM leads l WHERE ${n.sql} AND l.mensaje_at IS NOT NULL`).get(...n.params);return{conversaciones:s,conteos:Object.fromEntries(Object.entries(c).map(([e,t])=>[e,t??0]))}}function Pt(e){return y.prepare(`SELECT m.id, m.lead_id, m.autor, u.nombre AS usuario, m.texto, m.botones, m.created_at
       FROM mensajes m LEFT JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.lead_id = ? ORDER BY m.created_at ASC, m.id ASC`).all(e).map(e=>({...e,botones:e.botones?JSON.parse(e.botones):null}))}function Ft(e,t){q(e,t).no_leidos>0&&y.prepare(`UPDATE leads SET no_leidos = 0 WHERE id = ?`).run(t);let n=Xt(t).filter(e=>e.tipo===`control`||e.tipo===`intervencion`);return{lead:q(e,t),mensajes:Pt(t),eventos:n}}function N(e,t,n,r={}){let i=r.at??x();return y.prepare(`INSERT INTO mensajes (lead_id, autor, usuario_id, texto, botones, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(e,t,r.usuarioId??null,n,r.botones?.length?JSON.stringify(r.botones):null,i),y.prepare(`UPDATE leads SET mensaje_at = ?, last_activity_at = ?, updated_at = ?,
       no_leidos = CASE WHEN ? = 'cliente' THEN no_leidos + 1 ELSE no_leidos END
     WHERE id = ?`).run(i,i,i,t,e),i}function It(e,t,n,r={}){E(e);let i=q(e,t);if(i.baja_at)throw new w(409,{message:`El cliente pidió no ser contactado: no se le pueden enviar mensajes.`});let a=(i.control===`backoffice`||i.control===`asesor`)&&i.control_usuario_id&&i.control_usuario_id!==e.id;if(a&&!r.forzar)throw new w(409,{res:Response.json({error:`${i.control_usuario??`Otra persona`} tiene el control de esta conversación. ¿Enviar de todos modos? Quedará como intervención.`,requiereConfirmar:!0},{status:409})});return S(()=>{let r=N(t,`asesor`,n.trim(),{usuarioId:e.id});y.prepare(`UPDATE leads SET no_leidos = 0, first_contact_at = COALESCE(first_contact_at, ?) WHERE id = ?`).run(r,t),a?P(t,{usuarioId:e.id},`intervencion`,`Escribió en una conversación que lleva ${i.control_usuario} (intervención)`,r):i.control!==`vexa`&&i.control!==`nadie`&&i.control_usuario_id||tn(e,t,{motivo:i.control===`vexa`?`Escribió por WhatsApp: tomó la conversación de VEXA`:`Escribió por WhatsApp: tomó la conversación`},r),J(t,e.id,`whatsapp`,n.trim(),r),i.estado_contacto===`nuevo`&&Y(i,e.id,{estado:`en_espera`},r)}),Ft(e,t)}function Lt(e,t,n){return H(e,t,n?`devolver`:`tomar`,{forzar:!n}),Ft(e,t)}var Rt=e=>y.prepare(`SELECT l.*, ag.nombre AS agencia, u.nombre AS asesor,
              (SELECT COUNT(*) FROM mensajes WHERE lead_id = l.id AND autor = 'bot') AS turnos_bot,
              EXISTS (SELECT 1 FROM citas c WHERE c.lead_id = l.id AND c.estado IN ('agendada','confirmada')) AS tiene_cita
       FROM leads l LEFT JOIN agencias ag ON ag.id = l.agencia_id LEFT JOIN usuarios u ON u.id = l.asesor_id WHERE l.id = ?`).get(e),zt=e=>new Intl.DateTimeFormat(`es-MX`,{timeZone:`America/Mexico_City`,weekday:`short`,day:`numeric`,month:`short`,hour:`numeric`,minute:`2-digit`}).format(new Date(e));function Bt(e,t,n=x()){N(e.id,`bot`,t.texto,{botones:t.botones,at:n}),y.prepare(`UPDATE leads SET no_leidos = ? WHERE id = ?`).run(t.pasarAsesor?Math.max(1,e.no_leidos):0,e.id),y.prepare(`UPDATE leads SET first_contact_at = COALESCE(first_contact_at, ?) WHERE id = ?`).run(n,e.id);let r=t.datos??{},i=Object.entries(r).filter(([,e])=>e!=null);if(i.length&&y.prepare(`UPDATE leads SET ${i.map(([e])=>`${e} = ?`).join(`, `)} WHERE id = ?`).run(...i.map(([,e])=>e),e.id),t.cita){let r=y.prepare(`INSERT INTO citas (lead_id, asesor_id, fecha, estado, tipo, notas, created_at, updated_at) VALUES (?, ?, ?, 'agendada', 'visita', 'Agendada por VEXA en WhatsApp', ?, ?)`).run(e.id,e.asesor_id,t.cita.fecha,n,n);Ke(Number(r.lastInsertRowid),{actor:`VEXA`},n);let i=Math.max(Date.now(),new Date(t.cita.fecha).getTime()-24*Ot);y.prepare(`UPDATE leads SET proximo_contacto = ? WHERE id = ?`).run(new Date(i).toISOString(),e.id),J(e.id,null,`cita`,`${_.tipoCita.visita} agendada por VEXA para el ${zt(t.cita.fecha)}`,n)}t.pasarAsesor?(J(e.id,null,`nota`,t.pideHumano?`El cliente pidió hablar con una persona.`:`VEXA pasó la conversación al asesor.`,n),t.pideHumano||!e.asesor_id?an(null,e.id,t.pideHumano?`Pidió hablar con una persona por WhatsApp`:`VEXA no pudo resolver; necesita a una persona`,n):rn(null,e.id,n)):y.prepare(`UPDATE leads SET bot_proximo_at = ? WHERE id = ?`).run(new Date(new Date(n).getTime()+kt).toISOString(),e.id)}function Vt(e,t,n=x()){let r=Rt(e);if(!r)throw new w(404,{message:`No encontramos ese cliente.`});return S(()=>{N(e,`cliente`,t,{at:n}),y.prepare(`UPDATE leads SET bot_seguimientos = 0, bot_proximo_at = NULL WHERE id = ?`).run(e),I(e,{origen:`protocolo`},`Respondió el cliente`,{actor:`Sistema`},n),ct(e,{actor:`Sistema`},n),r.estado_contacto===`contactado`?r.resultado===`sin_avance`&&Y(r,null,{estado:`contactado`,resultado:null},n):Y(r,null,{estado:`contactado`},n)}),r.bot_activo===1}function Ht(e,t){let n=Rt(e);if(!n||!n.bot_activo||n.control!==`vexa`||!C(n.agencia_id).vexaActiva)return;let r=gt(t,{nombre:n.nombre,auto:n.auto,area:n.area,agencia:n.agencia,asesor:n.asesor,turnosBot:n.turnos_bot,canal_compra:n.canal_compra,pago_inicial:n.pago_inicial,fecha_compra:n.fecha_compra,tieneCita:!!n.tiene_cita,cotizacion:Ut(n.auto)});S(()=>Bt(n,r))}function Ut(e){let t=wt(e);if(t||!qt())return t;let n=ft(e);return n?{modelo:e,version:null,anio:null,precio:n,ficha_url:null,financiamiento:null}:null}function Wt(e,t,n,r){let i=r===`recuperacion`?ht(e,t===1?0:3):t===1?mt(e,n):ht(e,t-2);N(e.id,`bot`,i.texto,{botones:i.botones,at:n}),y.prepare(`UPDATE leads SET bot_proximo_at = NULL WHERE id = ?`).run(e.id)}function Gt(){Un(),nr(Wt),rr(),rt(),Je((e,t,n)=>{N(e,`bot`,t,{at:n})}),ot(),st();let e=y.prepare(`SELECT l.id, m.texto FROM leads l JOIN mensajes m ON m.id = (SELECT id FROM mensajes WHERE lead_id = l.id ORDER BY created_at DESC, id DESC LIMIT 1)
       WHERE l.bot_activo = 1 AND m.autor = 'cliente' AND m.created_at <= ? LIMIT 50`).all(new Date(Date.now()-3e4).toISOString());for(let{id:t,texto:n}of e)Ht(t,n);let t=Number(new Intl.DateTimeFormat(`en-US`,{timeZone:`America/Mexico_City`,hour:`numeric`,hourCycle:`h23`}).format(new Date));if(t<8||t>=21)return 0;let n=y.prepare(`SELECT id FROM leads WHERE bot_activo = 1 AND bot_proximo_at IS NOT NULL AND bot_proximo_at <= ? AND bot_seguimientos < ? LIMIT 50`).all(x(),3);for(let{id:e}of n){let t=Rt(e);t&&S(()=>{Bt(t,ht(t,t.bot_seguimientos));let n=t.bot_seguimientos+1;y.prepare(`UPDATE leads SET bot_seguimientos = ?, bot_proximo_at = CASE WHEN ? < ? THEN bot_proximo_at ELSE NULL END WHERE id = ?`).run(n,n,3,e),J(e,null,`whatsapp`,`Seguimiento automático ${n} de 3 (sin respuesta del cliente).`)})}return n.length}function Kt(){setInterval(()=>{try{Gt()}catch(e){console.error(`Seguimientos del bot:`,e)}},6e4).unref?.()}var qt=()=>y.prepare(`SELECT valor FROM ajustes WHERE clave = 'demo'`).get()?.valor===`1`;function Jt(){return{conectado:qt()||!!{}.WHATSAPP_TOKEN,ultimoMensaje:y.prepare(`SELECT MAX(created_at) AS at FROM mensajes WHERE autor = 'bot'`).get().at}}var Yt=6e4;function P(e,t,n,r,i=x(),a){y.prepare(`INSERT INTO eventos (lead_id, tipo, usuario_id, actor, detalle, antes, despues, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(e,n,t.usuarioId??null,t.actor??null,r,a?.antes??null,a?.despues??null,i)}function Xt(e){return y.prepare(`SELECT e.id, e.lead_id, e.tipo, COALESCE(u.nombre, e.actor) AS actor, e.detalle, e.antes, e.despues, e.created_at
       FROM eventos e LEFT JOIN usuarios u ON u.id = e.usuario_id WHERE e.lead_id = ? ORDER BY e.created_at DESC, e.id DESC`).all(e)}function F(e,t,n,r=x()){let i=y.prepare(`INSERT OR IGNORE INTO tareas (lead_id, tipo, responsable, usuario_id, prioridad, motivo, programada_at, vence_at, origen, clave, created_at, cita_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(e,t.tipo,t.responsable,t.usuarioId??null,t.prioridad,t.motivo,t.programadaAt,t.venceAt??null,t.origen,t.clave??null,r,t.citaId??null);return i.changes&&P(e,n,`tarea_creada`,`Tarea P${t.prioridad} · ${_.tarea[t.tipo]} para ${_.responsable[t.responsable]}: ${t.motivo}`,r),i.changes>0}function I(e,t,n,r,i=x()){let a=[`lead_id = ?`,`estado IN ('programada','en_curso')`],o=[e];t.responsables?.length&&(a.push(`responsable IN (${t.responsables.map(()=>`?`).join(`,`)})`),o.push(...t.responsables)),t.tipos?.length&&(a.push(`tipo IN (${t.tipos.map(()=>`?`).join(`,`)})`),o.push(...t.tipos)),t.origen&&(a.push(`origen = ?`),o.push(t.origen));let s=y.prepare(`SELECT id, tipo FROM tareas WHERE ${a.join(` AND `)}`).all(...o);if(!s.length)return 0;y.prepare(`UPDATE tareas SET estado = 'cancelada', cancel_motivo = ?, done_at = ? WHERE id IN (${s.map(()=>`?`).join(`,`)})`).run(n,i,...s.map(e=>e.id));let c=[...new Set(s.map(e=>_.tarea[e.tipo]))].join(`, `);return P(e,r,`tarea_cancelada`,`${s.length===1?`Tarea cancelada`:`${s.length} tareas canceladas`} (${c}): ${n}`,i),s.length}function L(e,t,n,r,i=x(),a=!1){let o=y.prepare(`SELECT id FROM tareas WHERE lead_id = ? AND estado IN ('programada','en_curso') AND tipo IN (${t.map(()=>`?`).join(`,`)})
       ORDER BY prioridad, programada_at ${a?`LIMIT 1`:``}`).all(e,...t);for(let e of o)y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = ?, done_at = ?, done_by = ? WHERE id = ?`).run(n,i,r,e.id);return o.length}function R(e){return(qt()||!!{}.WHATSAPP_TOKEN)&&C(e).vexaActiva}var Zt=(e,t,n)=>e===`vexa`?`VEXA ${_.agenteEstado[n].toLowerCase()}`:`${e===`nadie`?`Nadie`:`${_.control[e]}${t?` (${t})`:``}`}, VEXA ${_.agenteEstado[n].toLowerCase()}`;function z(e,t,n,r,i=x()){let a=t.control??e.control,o=t.usuarioId===void 0?a===e.control?e.control_usuario_id:null:t.usuarioId,s=t.agente??e.agente_estado;a!==`vexa`&&s===`activo`&&(s=`pausado`);let c=s===`activo`?null:t.pausa===void 0?e.agente_pausa:t.pausa;if(a===e.control&&o===e.control_usuario_id&&s===e.agente_estado&&c===e.agente_pausa)return;let l=e=>e?y.prepare(`SELECT nombre FROM usuarios WHERE id = ?`).get(e)?.nombre??null:null;y.prepare(`UPDATE leads SET control = ?, control_usuario_id = ?, agente_estado = ?, agente_pausa = ?,
       bot_activo = ?, bot_proximo_at = CASE WHEN ? = 1 THEN bot_proximo_at ELSE NULL END, updated_at = ? WHERE id = ?`).run(a,o,s,c,+(s===`activo`),+(s===`activo`),i,e.id),P(e.id,n,`control`,r,i,{antes:Zt(e.control,l(e.control_usuario_id),e.agente_estado),despues:Zt(a,l(o),s)}),s!==`activo`&&I(e.id,{responsables:[`vexa`]},r,n,i)}function Qt(e,t){if(R(e))return{control:`vexa`,agente:`activo`,pausa:null};let n=C(e).vexaActiva?`control_humano`:`agencia`;return{control:t?`asesor`:`backoffice`,agente:`pausado`,pausa:n}}function $t(e,t,n,r){let i=e=>p(e)||e.estado_contacto===`sin_respuesta`;if(i(t)&&!i(e))z(t,{control:`nadie`,usuarioId:null,agente:`desactivado`,pausa:`cierre`},n,`Cliente cerrado: nadie conversa con él`,r),I(t.id,{},`Cliente cerrado`,n,r);else if(!i(t)&&i(e)&&!t.baja_at){let e=t.aceptacion===`aceptado`?t.asesor_id:null,i=Qt(t.agencia_id,e);z(t,{control:i.control,usuarioId:i.control===`asesor`?e:null,agente:i.agente,pausa:i.pausa},n,`El cliente se reabrió`,r)}}function B(e,t){if(!m(e.rol,t))throw new w(403,{message:`Tu rol no puede ${_.accion[t].toLowerCase()}.`})}function en(e){if(e.baja_at)throw new w(409,{message:`El cliente pidió no ser contactado. Solo coordinación puede reactivar el contacto.`});if(p(e)||e.estado_contacto===`sin_respuesta`)throw new w(409,{message:`El cliente está cerrado. Para retomarlo, cambia primero su etapa.`})}var V=e=>({usuarioId:e.id});function tn(e,t,n={},r=x()){B(e,`tomar`);let i=q(e,t);en(i);let a=e.rol===`asesor`?`asesor`:`backoffice`;if(i.control===a&&i.control_usuario_id===e.id)return;if(e.rol===`asesor`&&i.aceptacion!==`aceptado`)throw new w(409,{message:`Primero acepta la oportunidad; al aceptarla recibes el control.`});let o=(i.control===`backoffice`||i.control===`asesor`)&&i.control_usuario_id&&i.control_usuario_id!==e.id;if(o&&!n.forzar)throw new w(409,{res:Response.json({error:`${i.control_usuario??`Otra persona`} tiene el control de este cliente. ¿Tomarlo de todos modos?`,requiereConfirmar:!0},{status:409})});z(i,{control:a,usuarioId:e.id,agente:i.agente_estado===`desactivado`?`desactivado`:`pausado`,pausa:i.agente_estado===`desactivado`?i.agente_pausa:`control_humano`},V(e),n.motivo??(o?`Tomó el control (lo tenía ${i.control_usuario})`:`Tomó el control`),r),L(t,[`intervencion`],`Una persona tomó el control`,e.id,r)}function nn(e,t,n=x()){B(e,`devolver`);let r=q(e,t);if(en(r),!R(r.agencia_id))throw new w(409,{message:`VEXA no está conectada o está apagada en esta agencia.`});(r.control!==`vexa`||r.agente_estado!==`activo`)&&(z(r,{control:`vexa`,usuarioId:null,agente:`activo`,pausa:null},V(e),`Devolvió la conversación a VEXA`,n),y.prepare(`UPDATE leads SET bot_seguimientos = 0, bot_proximo_at = ? WHERE id = ?`).run(new Date(Date.now()+180*Yt).toISOString(),t))}function rn(e,t,n=x()){e&&B(e,`transferir`);let r=e?q(e,t):X(t);if(en(r),!r.asesor_id)throw new w(409,{message:`Asígnale un asesor antes de transferir.`});(r.aceptacion!==`aceptado`||r.control!==`asesor`)&&Qe(t,e?V(e):{actor:`VEXA`},n)}function an(e,t,n,r=x()){e&&B(e,`intervencion`);let i=e?q(e,t):X(t);if(i.baja_at)throw new w(409,{message:`El cliente pidió no ser contactado.`});let a=e?V(e):{actor:`VEXA`},o=i.control===`asesor`&&i.asesor_id?`asesor`:`backoffice`;z(i,{control:o,usuarioId:o===`asesor`?i.asesor_id:null,agente:i.agente_estado===`desactivado`?`desactivado`:`pausado`,pausa:`pidio_humano`},a,`Se pidió atención humana: ${n}`,r),y.prepare(`SELECT 1 FROM tareas WHERE lead_id = ? AND tipo = 'intervencion' AND estado IN ('programada','en_curso')`).get(t)||F(t,{tipo:`intervencion`,responsable:o,usuarioId:o===`asesor`?i.asesor_id:null,prioridad:0,motivo:n,programadaAt:r,venceAt:new Date(new Date(r).getTime()+10*Yt).toISOString(),origen:`pidio_humano`},a,r),y.prepare(`UPDATE leads SET humano_solicitado_at = ?, proximo_contacto = ? WHERE id = ?`).run(r,r,t)}function on(e,t,n=x()){B(e,`detener`);let r=q(e,t);r.agente_estado!==`desactivado`&&z(r,{control:r.control===`vexa`?`backoffice`:r.control,agente:`desactivado`,pausa:`manual`},V(e),`Detuvo las automatizaciones de VEXA`,n)}function sn(e,t,n,r=x()){B(e,`baja`),E(e);let i=q(e,t);if(i.baja_at){if(e.rol!==`coordinador`&&e.rol!==`superadmin`)throw new w(403,{message:`Solo coordinación puede reactivar el contacto con un cliente que pidió la baja.`});y.prepare(`UPDATE leads SET baja_at = NULL, baja_motivo = NULL WHERE id = ?`).run(t),P(t,V(e),`baja`,`Reactivó el contacto (con autorización del cliente)`,r),p(i)||z(X(t),{control:i.asesor_id?`asesor`:`backoffice`,usuarioId:i.asesor_id??null,agente:`pausado`,pausa:`control_humano`},V(e),`Contacto reactivado`,r)}else y.prepare(`UPDATE leads SET baja_at = ?, baja_motivo = ?, proximo_contacto = NULL WHERE id = ?`).run(r,n?.trim()||null,t),z(i,{control:`nadie`,usuarioId:null,agente:`desactivado`,pausa:`baja`},V(e),`El cliente pidió no ser contactado${n?.trim()?`: ${n.trim()}`:``}`,r),I(t,{},`El cliente pidió no ser contactado`,V(e),r)}function H(e,t,n,r){n!==`detener`&&E(e);let i=x();return S(()=>{switch(n){case`tomar`:return tn(e,t,r,i);case`devolver`:return nn(e,t,i);case`transferir`:return rn(e,t,i);case`intervencion`:return an(e,t,r.motivo?.trim()||`Solicitud del equipo`,i);case`detener`:return on(e,t,i);case`baja`:return sn(e,t,r.motivo,i);case`aceptar`:return et(e,t,i);case`rechazar`:return tt(e,t,r.motivo,i)}}),q(e,t)}function cn(e){return e.rol===`asesor`?{responsables:[`asesor`],soloMias:!0}:e.rol===`backoffice`?{responsables:[`backoffice`],soloMias:!1}:{responsables:[`backoffice`,`asesor`],soloMias:!1}}function ln(e){let t=K(e),n=cn(e),r=G(),i=y.prepare(`SELECT t.id, t.tipo, t.responsable, t.prioridad, t.motivo, t.programada_at, t.vence_at, t.lead_id
       FROM tareas t JOIN leads l ON l.id = t.lead_id
       WHERE ${t.sql} AND t.estado IN ('programada','en_curso') AND t.programada_at <= ?
         AND t.responsable IN (${n.responsables.map(()=>`?`).join(`,`)})
         ${n.soloMias?`AND (t.usuario_id = ? OR (t.usuario_id IS NULL AND l.asesor_id = ?))`:``}
       ORDER BY t.prioridad, COALESCE(t.vence_at, t.programada_at) LIMIT 300`).all(...t.params,r,...n.responsables,...n.soloMias?[e.id,e.id]:[]),a=y.prepare(`SELECT l.id FROM leads l
       WHERE ${t.sql} AND l.proximo_contacto IS NOT NULL AND l.proximo_contacto <= ? AND NOT ${U} AND l.baja_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM tareas t WHERE t.lead_id = l.id AND t.estado IN ('programada','en_curso') AND t.responsable <> 'vexa')
         ${e.rol===`backoffice`?`AND l.aceptacion <> 'aceptado'`:``}
       ORDER BY l.proximo_contacto LIMIT 200`).all(...t.params,r),o=[];for(let e of i){let t=X(e.lead_id);t&&o.push({id:e.id,tipo:e.tipo,responsable:e.responsable,prioridad:e.prioridad,motivo:e.motivo,programada_at:e.programada_at,vence_at:e.vence_at,lead:t})}for(let{id:e}of a){let t=X(e);t&&o.push({id:-e,tipo:`seguimiento`,responsable:t.aceptacion===`aceptado`?`asesor`:`backoffice`,prioridad:3,motivo:`Contacto agendado`,programada_at:t.proximo_contacto,vence_at:t.proximo_contacto,lead:t})}return o.sort((e,t)=>e.prioridad-t.prioridad||(e.vence_at??e.programada_at).localeCompare(t.vence_at??t.programada_at))}function un(e){if(![`backoffice`,`coordinador`,`superadmin`,`asesor`].includes(e.rol))return[];let t=K(e);return y.prepare(`SELECT t.id, t.lead_id, t.motivo, t.created_at, t.vence_at, l.nombre, l.auto
       FROM tareas t JOIN leads l ON l.id = t.lead_id
       WHERE ${t.sql} AND t.tipo = 'intervencion' AND t.prioridad = 0 AND t.estado IN ('programada','en_curso')
         ${e.rol===`asesor`?`AND t.responsable = 'asesor'`:e.rol===`backoffice`?`AND t.responsable = 'backoffice'`:``}
       ORDER BY t.created_at LIMIT 5`).all(...t.params)}function dn(e){let t=K(e),n=W(),r=G(),i=x(),a=C(e.ambito.agenciaId),o=cn(e),s=y.prepare(`SELECT COUNT(*) AS n, COUNT(l.first_contact_at) AS intentados, COUNT(l.responded_at) AS contestaron,
              AVG(CASE WHEN l.first_contact_at > l.created_at THEN (julianday(l.first_contact_at) - julianday(l.created_at)) * 1440 END) AS primer_min
       FROM leads l WHERE ${t.sql} AND l.created_at >= ?`).get(...t.params,n),c=y.prepare(`SELECT COUNT(*) AS hechas, SUM(i.texto NOT LIKE 'No contest%' AND i.texto NOT LIKE 'Buzón%') AS efectivas
       FROM interacciones i JOIN leads l ON l.id = i.lead_id WHERE ${t.sql} AND i.tipo = 'llamada' AND i.created_at >= ? ${T(e)?``:`AND i.usuario_id = ?`}`).get(...t.params,n,...T(e)?[]:[e.id]),l=y.prepare(`SELECT COUNT(*) AS total, SUM(t.estado = 'hecha') AS hechas, SUM(t.estado IN ('programada','en_curso') AND COALESCE(t.vence_at, t.programada_at) < ?) AS vencidas
       FROM tareas t JOIN leads l ON l.id = t.lead_id
       WHERE ${t.sql} AND t.responsable IN (${o.responsables.map(()=>`?`).join(`,`)}) AND t.programada_at BETWEEN ? AND ?
         AND t.estado <> 'cancelada' ${o.soloMias?`AND (t.usuario_id = ? OR l.asesor_id = ?)`:``}`).get(i,...t.params,...o.responsables,n,r,...o.soloMias?[e.id,e.id]:[]),u=new Date(new Date(r).getTime()+1),d=y.prepare(`SELECT COUNT(*) AS total, SUM(c.estado = 'confirmada') AS confirmadas FROM citas c JOIN leads l ON l.id = c.lead_id
       WHERE ${t.sql} AND c.estado IN ('agendada','confirmada') AND c.fecha BETWEEN ? AND ?`).get(...t.params,u.toISOString(),new Date(u.getTime()+864e5-1).toISOString()),f=Jt(),p=y.prepare(`SELECT COUNT(DISTINCT m.lead_id) AS n FROM mensajes m JOIN leads l ON l.id = m.lead_id WHERE ${t.sql} AND m.autor = 'bot' AND m.created_at >= ?`).get(...t.params,n),m=y.prepare(`SELECT COUNT(*) AS n FROM tareas t JOIN leads l ON l.id = t.lead_id WHERE ${t.sql} AND t.tipo = 'intervencion' AND t.created_at >= ?`).get(...t.params,n);return{slaMin:a.slaMin,primerIntentoMin:s.primer_min,leadsHoy:s.n,leadsIntentados:s.intentados,leadsContestaron:s.contestaron,llamadas:{hechas:c.hechas,efectivas:c.efectivas??0},tareas:{total:l.total,hechas:l.hechas??0,vencidas:ln(e).filter(e=>new Date(e.vence_at??e.programada_at).getTime()<Date.now()).length},citasManana:{total:d.total,confirmadas:d.confirmadas??0},vexa:{conectado:f.conectado,conversacionesHoy:p.n,pidieronPersona:m.n}}}var fn=[`contesto`,`no_contesto`,`buzon`,`numero_equivocado`,`llamar_despues`,`no_interesado`,`no_contacto`,`enviado`,`confirmada`,`cancelo`,`hecha`],pn=[`cita`,`asesor`,`vexa`,`registrar`];function mn(e,t){let n=y.prepare(`SELECT * FROM tareas WHERE id = ?`).get(t);if(!n)throw new w(404,{message:`No encontramos esa tarea.`});if(q(e,n.lead_id),n.estado!==`programada`&&n.estado!==`en_curso`)throw new w(409,{message:`Esa tarea ya se cerró. Abre la siguiente.`});return n}function hn(e,t,n){E(e);let r=mn(e,t),i=n.nota?.trim()??``,a=r.tipo!==`whatsapp`&&r.tipo!==`asignacion`,o=x();return S(()=>{switch(n.resultado){case`contesto`:case`llamar_despues`:case`no_interesado`:if(n.resultado===`llamar_despues`&&!n.cuando)throw new w(400,{message:`Elige a qué hora hay que llamarle.`});if(Z(e,r.lead_id,{tipo:`llamada`,texto:i||(n.resultado===`llamar_despues`?`Contestó: pidió que le llamemos después.`:`Contestó la llamada.`),contesto:!0,tareaId:r.id,resultadoTarea:`Contestó`}),n.resultado===`llamar_despues`&&(y.prepare(`UPDATE leads SET proximo_contacto = ? WHERE id = ?`).run(n.cuando,r.lead_id),J(r.lead_id,e.id,`nota`,`Pidió que le llamemos después: no se le escribe antes.`,o)),n.resultado===`no_interesado`){let t=n.motivo&&ne.includes(n.motivo)?n.motivo:`ya_no_le_interesa`;Wn(e,r.lead_id,{resultado:t===`no_pidio_info`||t===`otro_asunto`?`descalificado`:`no_interesado`,motivo:t})}n.resultado===`contesto`&&(n.siguiente===`asesor`?H(e,r.lead_id,`transferir`,{}):n.siguiente===`vexa`&&H(e,r.lead_id,`devolver`,{}));break;case`no_contesto`:case`buzon`:if(a&&Z(e,r.lead_id,{tipo:`llamada`,texto:i||(n.resultado===`buzon`?`Buzón de voz.`:`No contestó.`),contesto:!1,tareaId:r.id,resultadoTarea:n.resultado===`buzon`?`Buzón`:`No contestó`}),r.tipo===`confirmar_cita`||r.tipo===`recuperar_cita`){let e=$(C(X(r.lead_id).agencia_id),Date.now()+72e5);y.prepare(`UPDATE tareas SET estado = 'programada', programada_at = ?, done_at = NULL, resultado = 'No contestó; se reintenta' WHERE id = ?`).run(new Date(e).toISOString(),r.id)}break;case`numero_equivocado`:Z(e,r.lead_id,{tipo:`llamada`,texto:i||`Número equivocado.`,contesto:!1,tareaId:r.id,resultadoTarea:`Número equivocado`}),Wn(e,r.lead_id,{estado_contacto:`datos_incorrectos`}),X(r.lead_id)?.correo&&J(r.lead_id,e.id,`nota`,`Número equivocado: tiene correo, conviene escribirle por ahí.`,o);break;case`no_contacto`:y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = 'No quiere contacto', done_at = ?, done_by = ? WHERE id = ?`).run(o,e.id,r.id),H(e,r.lead_id,`baja`,{motivo:i||`Lo pidió en la llamada`});break;case`enviado`:Z(e,r.lead_id,{tipo:`whatsapp`,texto:i||`WhatsApp enviado.`,tareaId:r.id,resultadoTarea:`Enviado`});break;case`confirmada`:if(!r.cita_id)throw new w(400,{message:`Esta tarea no es de una cita.`});y.prepare(`UPDATE citas SET estado = 'confirmada', updated_at = ? WHERE id = ?`).run(o,r.cita_id),y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = 'Confirmada', done_at = ?, done_by = ? WHERE id = ?`).run(o,e.id,r.id),J(r.lead_id,e.id,`cita`,`Cita confirmada${i?` — ${i}`:``}`,o);break;case`cancelo`:if(!r.cita_id)throw new w(400,{message:`Esta tarea no es de una cita.`});y.prepare(`UPDATE citas SET estado = 'cancelada', updated_at = ? WHERE id = ?`).run(o,r.cita_id),y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = 'Canceló la cita', done_at = ?, done_by = ? WHERE id = ?`).run(o,e.id,r.id),y.prepare(`UPDATE tareas SET estado = 'cancelada', cancel_motivo = 'La cita se canceló', done_at = ? WHERE cita_id = ? AND estado = 'programada'`).run(o,r.cita_id),y.prepare(`UPDATE leads SET proximo_contacto = ? WHERE id = ?`).run(o,r.lead_id),J(r.lead_id,e.id,`cita`,`El cliente canceló la cita${i?` — ${i}`:``}`,o);break;case`hecha`:y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = ?, done_at = ?, done_by = ? WHERE id = ?`).run(i||`Hecha`,o,e.id,r.id),i&&J(r.lead_id,e.id,`nota`,i,o)}}),q(e,r.lead_id)}function gn(e){let t=K(e),n=cn(e),r=x(),i=y.prepare(`SELECT COUNT(*) AS n FROM tareas t JOIN leads l ON l.id = t.lead_id
       WHERE ${t.sql} AND t.estado IN ('programada','en_curso') AND t.responsable IN (${n.responsables.map(()=>`?`).join(`,`)})
         AND COALESCE(t.vence_at, t.programada_at) < ? ${n.soloMias?`AND (t.usuario_id = ? OR l.asesor_id = ?)`:``}`).get(...t.params,...n.responsables,r,...n.soloMias?[e.id,e.id]:[]),a=y.prepare(`SELECT l.id, l.nombre FROM leads l WHERE ${t.sql} AND l.control_usuario_id = ? AND l.control IN ('backoffice','asesor') AND l.baja_at IS NULL LIMIT 50`).all(...t.params,e.id),o=y.prepare(`SELECT DISTINCT l.id, l.nombre FROM interacciones i JOIN leads l ON l.id = i.lead_id
       WHERE ${t.sql} AND i.usuario_id = ? AND i.created_at >= ? AND NOT ${U} AND l.baja_at IS NULL
         AND l.estado_contacto NOT IN ('sin_respuesta','datos_incorrectos') AND (l.proximo_contacto IS NULL OR l.proximo_contacto < ?)
         AND NOT EXISTS (SELECT 1 FROM tareas t WHERE t.lead_id = l.id AND t.estado IN ('programada','en_curso') AND t.programada_at >= ?)
         AND NOT (l.control = 'vexa' AND l.agente_estado = 'activo')
       LIMIT 50`).all(...t.params,e.id,W(),r,r),s=y.prepare(`SELECT SUM(i.tipo = 'llamada') AS llamadas, SUM(i.tipo = 'llamada' AND i.texto NOT LIKE 'No contest%' AND i.texto NOT LIKE 'Buzón%') AS efectivas
       FROM interacciones i WHERE i.usuario_id = ? AND i.created_at >= ?`).get(e.id,W()),c=y.prepare(`SELECT COUNT(*) AS n FROM tareas WHERE done_by = ? AND tipo = 'confirmar_cita' AND resultado = 'Confirmada' AND done_at >= ?`).get(e.id,W());return{vencidas:i.n,conversaciones:a,tocadosSinAccion:o,resumen:{llamadas:s.llamadas??0,efectivas:s.efectivas??0,citasConfirmadas:c.n}}}function _n(e){E(e);let t=K(e),n=cn(e),r=x(),i=$(C(e.ambito.agenciaId),new Date(new Date(G()).getTime()+6e4).getTime()),a=y.prepare(`SELECT t.id, t.lead_id FROM tareas t JOIN leads l ON l.id = t.lead_id
       WHERE ${t.sql} AND t.estado IN ('programada','en_curso') AND t.responsable IN (${n.responsables.map(()=>`?`).join(`,`)})
         AND COALESCE(t.vence_at, t.programada_at) < ? ${n.soloMias?`AND (t.usuario_id = ? OR l.asesor_id = ?)`:``}`).all(...t.params,...n.responsables,r,...n.soloMias?[e.id,e.id]:[]),o=gn(e);return S(()=>{for(let t of a)y.prepare(`UPDATE tareas SET programada_at = ?, vence_at = ? WHERE id = ?`).run(new Date(i).toISOString(),new Date(i+72e5).toISOString(),t.id),P(t.lead_id,{usuarioId:e.id},`tarea_reprogramada`,`Cierre de turno: la tarea pasa al primer bloque del siguiente horario`,r)}),{reprogramadas:a.length,...o}}var vn=15,yn=()=>new Date(Date.now()-vn*864e5).toISOString(),bn=`
  SELECT l.*, c.nombre AS campana, u.nombre AS asesor, ag.nombre AS agencia,
         ct.id AS cita_id, ct.fecha AS cita_fecha, ct.estado AS cita_estado, ct.tipo AS cita_tipo, ct.notas AS cita_notas,
         cu.nombre AS control_usuario,
         tp.id AS tarea_id, tp.tipo AS tarea_tipo, tp.responsable AS tarea_responsable, tp.programada_at AS tarea_at,
         tp.vence_at AS tarea_vence_at, tp.prioridad AS tarea_prioridad, tp.motivo AS tarea_motivo,
         EXISTS (SELECT 1 FROM tareas tq WHERE tq.lead_id = l.id AND tq.origen = 'protocolo' AND tq.estado IN ('programada','en_curso')) AS en_protocolo,
         EXISTS (SELECT 1 FROM tareas tq WHERE tq.lead_id = l.id AND tq.origen = 'recuperacion' AND tq.estado IN ('programada','en_curso')) AS en_recuperacion,
         (SELECT MIN(tq.programada_at) FROM tareas tq WHERE tq.lead_id = l.id AND tq.origen = 'protocolo') AS protocolo_inicio
  FROM leads l
  LEFT JOIN campanas c ON c.id = l.campana_id
  LEFT JOIN usuarios u ON u.id = l.asesor_id
  LEFT JOIN usuarios cu ON cu.id = l.control_usuario_id
  LEFT JOIN agencias ag ON ag.id = l.agencia_id
  LEFT JOIN tareas tp ON tp.id = (
    SELECT t2.id FROM tareas t2 WHERE t2.lead_id = l.id AND t2.estado IN ('programada','en_curso')
    ORDER BY t2.prioridad, t2.programada_at LIMIT 1)
  LEFT JOIN citas ct ON ct.id = (
    SELECT c2.id FROM citas c2
    WHERE c2.lead_id = l.id AND c2.estado <> 'cancelada'
    ORDER BY c2.estado IN ('agendada','confirmada') DESC,
             CASE WHEN c2.estado IN ('agendada','confirmada') THEN c2.fecha END ASC,
             c2.fecha DESC
    LIMIT 1)`,xn=(e,t)=>`(CASE ${e} ${Object.entries(t).map(([e,t])=>`WHEN '${e}' THEN ${t}`).join(` `)} ELSE 0 END)`,Sn=`(${xn(`l.fecha_compra`,g.fechaCompra)} + (CASE WHEN (EXISTS (SELECT 1 FROM citas cp WHERE cp.lead_id = l.id AND cp.estado IN ('agendada','confirmada'))
  OR (SELECT cp.estado FROM citas cp WHERE cp.lead_id = l.id AND cp.estado <> 'cancelada' ORDER BY cp.fecha DESC LIMIT 1) = 'asistio') THEN ${g.cita} ELSE 0 END)
  + ${xn(`l.historial_crediticio`,g.historial)} + ${xn(`l.canal_compra`,g.canalCompra)}
  + (CASE WHEN l.canal_compra = 'contado' THEN 10 ${g.enganche.map(e=>`WHEN IFNULL(l.pago_inicial, 0) >= ${e.desde} THEN ${e.puntos}`).join(` `)} ELSE 0 END))`,Cn=oe.calificado-1,wn=`(CASE
  WHEN l.resultado IN ('en_proceso','venta') THEN MAX(${Sn}, ${oe.hot})
  WHEN l.fecha_compra = 'cotizando' THEN MIN(${Sn}, ${Cn})
  WHEN l.historial_crediticio = 'buro_negativo' AND IFNULL(l.canal_compra, '') <> 'contado' THEN MIN(${Sn}, ${Cn})
  ELSE ${Sn} END)`;function Tn(e){let t=ce.indexOf(e),n=ce[t+1];return[oe[e],n?oe[n]-1:100]}var En=e=>`EXISTS (SELECT 1 FROM tareas tx WHERE tx.lead_id = l.id AND tx.estado IN ('programada','en_curso')${e?` AND tx.tipo = '${e}'`:``})`;function Dn(e){switch(e){case`sin_accion`:return{sql:`NOT ${U} AND l.baja_at IS NULL AND l.estado_contacto NOT IN ('sin_respuesta','datos_incorrectos')
              AND l.proximo_contacto IS NULL AND NOT ${En()} AND NOT (l.control = 'vexa' AND l.agente_estado = 'activo')
              AND NOT EXISTS (SELECT 1 FROM citas cx WHERE cx.lead_id = l.id AND cx.estado IN ('agendada','confirmada'))`,params:[]};case`sin_asesor`:return{sql:`l.resultado IN ('seguimiento','en_proceso') AND l.asesor_id IS NULL`,params:[]};case`vencido`:return{sql:`l.proximo_contacto IS NOT NULL AND l.proximo_contacto < ? AND NOT ${U} AND l.baja_at IS NULL`,params:[new Date().toISOString()]};case`humano`:return{sql:En(`intervencion`),params:[]};case`por_aceptar`:return{sql:`l.aceptacion = 'pendiente'`,params:[]};case`reasignar`:return{sql:`l.aceptacion IN ('rechazado','vencido') AND NOT ${U}`,params:[]}}}var U=`(l.estado_contacto = 'datos_incorrectos' OR l.resultado IN (${d.map(e=>`'${e}'`).join(`,`)}))`,On=()=>new Intl.DateTimeFormat(`en-CA`,{timeZone:`America/Mexico_City`}).format(new Date),W=()=>new Date(`${On()}T00:00:00.000-06:00`).toISOString(),G=()=>new Date(`${On()}T23:59:59.999-06:00`).toISOString();function kn(e){let t=e.replace(/\D/g,``);return t.length>10?t.slice(-10):t}function K(e){let t=[],n=[];return T(e)||(t.push(`l.asesor_id = ?`),n.push(e.id)),e.ambito.agenciaId&&(t.push(`l.agencia_id = ?`),n.push(e.ambito.agenciaId)),e.ambito.area&&(t.push(`l.area = ?`),n.push(e.ambito.area)),{sql:t.length?t.join(` AND `):`1=1`,params:n}}var An=(e=null)=>new Date(Date.now()-C(e).rezagoDias*864e5).toISOString();function jn(e,t){switch(e){case`nuevos`:return{sql:`l.estado_contacto IN ('nuevo','en_espera') AND l.created_at >= ?`,params:[An(t)]};case`rezago`:return{sql:`l.estado_contacto IN ('nuevo','en_espera') AND l.created_at < ?`,params:[An(t)]};case`pendientes`:return{sql:`l.estado_contacto = 'sin_respuesta' AND l.created_at >= ?`,params:[yn()]};case`hoy`:return{sql:`l.proximo_contacto IS NOT NULL AND l.proximo_contacto <= ? AND NOT ${U}`,params:[G()]};case`todos`:return{sql:`1=1`,params:[]};case`asistieron`:return{sql:`${Mn} IS NOT NULL`,params:[]};case`ventas`:return{sql:`l.resultado = 'venta'`,params:[]}}}var Mn=`(SELECT MAX(ca.fecha) FROM citas ca WHERE ca.lead_id = l.id AND ca.estado = 'asistio')`;function Nn(e){return e===`asistieron`?Mn:e===`ventas`?`l.venta_at`:`l.created_at`}var Pn=()=>new Date(`${On().slice(0,8)}01T00:00:00.000-06:00`).toISOString();function Fn(e,t){let n=K(e),r=jn(t.bandeja,e.ambito.agenciaId),i=[n.sql,r.sql],a=[...n.params,...r.params];if(t.q){let e=`%${b(t.q.trim())}%`,n=t.q.replace(/\D/g,``);n.length>=3?(i.push(`(fold(l.nombre) LIKE ? OR l.telefono LIKE ?)`),a.push(e,`%${n}%`)):(i.push(`(fold(l.nombre) LIKE ? OR fold(l.correo) LIKE ? OR fold(l.auto) LIKE ?)`),a.push(e,e,e))}if(t.asesorId&&T(e)&&(i.push(`l.asesor_id = ?`),a.push(t.asesorId)),t.campanaId&&(i.push(`l.campana_id = ?`),a.push(t.campanaId)),t.hueco){let e=Dn(t.hueco);i.push(e.sql),a.push(...e.params)}if(t.clase){let[e,n]=Tn(t.clase);i.push(`${wn} BETWEEN ? AND ?`),a.push(e,n)}let o=Nn(t.bandeja);t.desde&&(i.push(`${o} >= ?`),a.push(t.desde));let s=t.bandeja===`hoy`?`l.proximo_contacto ASC`:t.orden===`puntaje`?`${wn} DESC, ${o} DESC`:t.orden===`vence`?`COALESCE(tp.vence_at, tp.programada_at, ${o}) ASC`:`${o} DESC`,c=Math.min(t.limit??500,5e3),l=t.bandeja===`asistieron`?bn.replace(`SELECT l.*,`,`SELECT l.*, ${Mn} AS asistio_at,`):t.bandeja===`nuevos`?bn.replace(`SELECT l.*,`,`SELECT l.*, (SELECT COUNT(*) FROM interacciones ia WHERE ia.lead_id = l.id AND ia.tipo = 'whatsapp') AS wa_count,
                    (SELECT COUNT(*) FROM interacciones ia WHERE ia.lead_id = l.id AND ia.tipo = 'llamada') AS ll_count,`):bn,u=y.prepare(`${l} WHERE ${i.join(` AND `)} ORDER BY ${s} LIMIT ${c}`).all(...a);return{leads:u,total:u.length<c?u.length:y.prepare(`SELECT COUNT(*) AS n FROM leads l WHERE ${i.join(` AND `)}`).get(...a).n}}function In(e){let t=K(e),n=G(),r=y.prepare(`SELECT
         SUM(l.estado_contacto IN ('nuevo','en_espera') AND l.created_at >= ?) AS nuevos,
         SUM(l.estado_contacto IN ('nuevo','en_espera') AND l.created_at < ?) AS rezago,
         SUM(l.estado_contacto = 'sin_respuesta' AND l.created_at >= ?) AS pendientes,
         SUM(l.proximo_contacto IS NOT NULL AND l.proximo_contacto <= ? AND NOT ${U}) AS hoy,
         COUNT(*) AS todos,
         SUM(${Mn} >= ?) AS asistieron,
         SUM(l.resultado = 'venta' AND l.venta_at >= ?) AS ventas,
         SUM(l.no_leidos > 0) AS conversaciones
       FROM leads l WHERE ${t.sql}`).get(An(e.ambito.agenciaId),An(e.ambito.agenciaId),yn(),n,Pn(),Pn(),...t.params),i=y.prepare(`SELECT COUNT(*) AS n FROM citas c JOIN leads l ON l.id = c.lead_id
       WHERE ${t.sql} AND c.fecha BETWEEN ? AND ? AND c.estado IN ('agendada','confirmada')`).get(...t.params,W(),n);return{huecos:Object.fromEntries(de.map(e=>{let n=Dn(e);return[e,y.prepare(`SELECT COUNT(*) AS n FROM leads l WHERE ${t.sql} AND ${n.sql}`).get(...t.params,...n.params).n]})),nuevos:r.nuevos??0,rezago:r.rezago??0,pendientes:r.pendientes??0,hoy:ln(e).length,todos:r.todos??0,asistieron:r.asistieron??0,ventas:r.ventas??0,conversaciones:r.conversaciones??0,citas_hoy:i.n}}function q(e,t){let n=y.prepare(`${bn} WHERE l.id = ?`).get(t);if(!n||!T(e)&&n.asesor_id!==e.id||!ze(e,n.agencia_id,n.area))throw new w(404,{message:`No encontramos ese cliente.`});return n}function Ln(e){return y.prepare(`SELECT i.id, i.lead_id, i.tipo, i.texto, i.created_at, u.nombre AS usuario
       FROM interacciones i LEFT JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.lead_id = ? ORDER BY i.created_at DESC, i.id DESC`).all(e)}function J(e,t,n,r,i=x()){y.prepare(`INSERT INTO interacciones (lead_id, usuario_id, tipo, texto, created_at) VALUES (?, ?, ?, ?, ?)`).run(e,t,n,r,i)}var Rn=e=>y.prepare(`SELECT id, nombre, agencia_id, area FROM usuarios WHERE id = ? AND activo = 1 AND rol = 'asesor'`).get(e);function zn(e,t,n){let r=n?.agencia_id??t.agencia_id??e.ambito.agenciaId,i=n?.area??t.area??e.ambito.area;if(!r||!i)throw new w(400,{message:`Elige la agencia y el área del cliente, o asígnale un asesor.`});if(!ze(e,r,i))throw new w(403,{message:`No puedes dar de alta clientes en esa agencia o área.`});return{agencia_id:r,area:i}}var Bn=[`nombre`,`telefono`,`correo`,`auto`,`fecha_compra`,`canal`,`plataforma`,`canal_compra`,`pago_inicial`,`mensualidad`,`historial_crediticio`,`ciudad`,`campana_id`,`proximo_contacto`,`version`,`registro_marca`,...te.map(e=>e.campo)];function Vn(e,t){let n=y.prepare(`SELECT id, nombre FROM leads WHERE telefono = ? AND id IS NOT ?`).get(e,t??null);if(n){let e=`Ese teléfono ya está registrado (${n.nombre}, folio #${n.id}).`;throw new w(409,{res:Response.json({error:e,existingId:n.id},{status:409})})}}function Hn(e,t){E(e);let n=kn(t.telefono);Vn(n);let r=h(e.rol).editaTodo?t.asesor_id??null:e.id,i=r?Rn(r):void 0;if(r&&!i)throw new w(400,{message:`Ese asesor no existe o está inactivo.`});let a=zn(e,t,i),o=x(),s=r?r===e.id?`aceptado`:`preasignado`:`ninguna`,c=Qt(a.agencia_id,s===`aceptado`?r:null);return q(e,S(()=>{let l=y.prepare(`INSERT INTO leads (nombre, telefono, correo, auto, fecha_compra, canal, plataforma, canal_compra,
           pago_inicial, mensualidad, historial_crediticio, ciudad, campana_id, asesor_id, proximo_contacto,
           created_by, created_at, updated_at, last_activity_at, agencia_id, area, version,
           control, control_usuario_id, agente_estado, agente_pausa, bot_activo, aceptacion, aceptacion_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(t.nombre.trim(),n,t.correo??null,t.auto??null,t.fecha_compra??null,t.canal??null,t.plataforma??null,t.canal_compra??null,t.pago_inicial??null,t.mensualidad??null,t.historial_crediticio??null,t.ciudad??null,t.campana_id??null,r,t.proximo_contacto??null,e.id,o,o,o,a.agencia_id,a.area,t.version??null,c.control,c.control===`asesor`?r:null,c.agente,c.pausa,+(c.agente===`activo`),s,s===`aceptado`?o:null),u=Number(l.lastInsertRowid);return J(u,e.id,`nota`,`Lead dado de alta`,o),i&&J(u,e.id,`asignacion`,`Asignado a ${i.nombre}`,o),$n(u,{usuarioId:e.id},o),u}))}function Y(e,t,n,r){let i=C(e.agencia_id),a=y.prepare(`SELECT asesor_id, registro_marca, proximo_contacto, motivo, etapa_anterior FROM leads WHERE id = ?`).get(e.id),o=i.reglas.seguimientoRequiereAsesor&&!a.asesor_id,s=n.estado??e.estado_contacto,c=n.resultado===void 0?e.resultado:n.resultado;if(n.estado&&n.estado!==`contactado`&&n.resultado===void 0&&(c=null),c&&(s=`contactado`),s!==`contactado`&&(c=null),s===`contactado`&&!c){let t=e.resultado===`sin_avance`?a.etapa_anterior:null;c=t&&!(o&&ee.includes(t))?t:o?`perfilamiento`:`seguimiento`}if(e.responded_at&&[`nuevo`,`en_espera`,`sin_respuesta`].includes(s))throw new w(409,{message:`Este cliente ya contestó; no puede regresar a "sin respuesta". Registra el resultado de la conversación.`});if(c!==e.resultado&&c){if(o&&ee.includes(c))throw new w(409,{message:`Asígnale un asesor antes de pasarlo a ${_.resultado[c]}. Mientras, se queda En perfilamiento.`});if(c===`venta`&&i.reglas.ventaRequiereRegistro&&!a.registro_marca)throw new w(409,{message:`Antes de marcar la venta, confirma que ya está cargada en ${i.sistemaMarca}.`});if(c===`proximo_mes`&&(!a.proximo_contacto||a.proximo_contacto<=r))throw new w(400,{message:`Elige la fecha en que hay que volver a buscarlo; ese día regresa solo a En seguimiento.`})}let l=f(c),d=null;if(l.length&&(d=n.motivo===void 0?c===e.resultado?a.motivo:null:n.motivo,d&&!l.includes(d)))throw new w(400,{message:`Ese motivo no corresponde a la etapa elegida.`});if(s===e.estado_contacto&&c===e.resultado&&d===a.motivo)return;let p=null,m=``;if(s===`sin_respuesta`){let t=Oe(e.id),n=u(i.cadencia,t);n.completa||(p=e.estado_contacto===`sin_respuesta`&&e.alerta_seguimiento_at?e.alerta_seguimiento_at:r,m=`${t.whatsapp} de ${n.metaWa} WhatsApp y ${t.llamadas} de ${n.metaLl} llamadas registrados`)}c===`sin_avance`&&e.resultado&&e.resultado!==`sin_avance`&&y.prepare(`UPDATE leads SET etapa_anterior = ? WHERE id = ?`).run(e.resultado,e.id),y.prepare(`UPDATE leads SET estado_contacto = ?, resultado = ?, motivo = ?, alerta_seguimiento_at = ?,
       responded_at = CASE WHEN ? = 'contactado' THEN COALESCE(responded_at, ?) ELSE responded_at END,
       first_contact_at = CASE WHEN ? <> 'nuevo' THEN COALESCE(first_contact_at, ?) ELSE first_contact_at END,
       venta_at = CASE WHEN ? = 'venta' THEN COALESCE(venta_at, ?) ELSE NULL END,
       updated_at = ?, last_activity_at = ?
     WHERE id = ?`).run(s,c,d,p,s,r,s,r,c,r,r,r,e.id);let h=e.resultado?_.resultado[e.resultado]:_.estado[e.estado_contacto],g=c?_.resultado[c]:_.estado[s],te=d?` · ${_.motivo[d]}`:``;J(e.id,t,`estado`,h===g?`${g}${te}`:`${h} → ${g}${te}`,r),p&&p===r&&J(e.id,t,`nota`,`⚠ Alerta de falta de seguimiento: se cerró sin respuesta con ${m}.`,r),$t(e,X(e.id),t?{usuarioId:t}:{actor:`Sistema`},r)}var X=e=>y.prepare(`${bn} WHERE l.id = ?`).get(e);function Un(){let e=x(),t=y.prepare(`SELECT id FROM leads WHERE resultado = 'proximo_mes' AND proximo_contacto <= ? LIMIT 200`).all(e);for(let{id:n}of t){let t=X(n);if(t)try{S(()=>Y(t,null,{estado:`contactado`,resultado:null},e))}catch(e){console.error(`Próximo mes (lead ${n}):`,e)}}return t.length}function Wn(e,t,n){E(e);let r=q(e,t),i=x();if(!h(e.rol).editaTodo&&Object.keys(n).filter(e=>n[e]===void 0||ue.includes(e)?!1:((e===`telefono`&&typeof n[e]==`string`?kn(n[e]):n[e])??null)!==(r[e]??null)).length)throw new w(403,{message:`Los datos del cliente los corrige el coordinador o back office. Tú puedes mover la etapa, agregar notas y agendar citas.`});return S(()=>{let a=[],o=[];for(let e of Bn){if(n[e]===void 0)continue;let r=n[e];typeof r==`boolean`&&(r=+!!r),e===`telefono`&&typeof r==`string`&&(r=kn(r),Vn(r,t)),a.push(`${e} = ?`),o.push(r)}a.length&&y.prepare(`UPDATE leads SET ${a.join(`, `)}, updated_at = ? WHERE id = ?`).run(...o,i,t);let s=!1;for(let a of te){let o=n[a.campo];o!==void 0&&!!o!=!!r[a.campo]&&(J(t,e.id,`estado`,o?`${a.label} ✓`:`${a.label}: se desmarcó`,i),y.prepare(`UPDATE leads SET last_activity_at = ? WHERE id = ?`).run(i,t),o&&se.some(e=>e.campo===a.campo)&&(s=!0))}if(n.registro_marca!==void 0&&!!n.registro_marca!=!!r.registro_marca){let a=C(r.agencia_id).sistemaMarca;J(t,e.id,`estado`,n.registro_marca?`Cargado en ${a} ✓`:`${a}: se desmarcó`,i)}let c=n.estado_contacto!==void 0||n.resultado!==void 0||n.motivo!==void 0;if(n.asesor_id!==void 0&&n.asesor_id!==r.asesor_id){if(!h(e.rol).editaTodo)throw new w(403,{message:`Solo el coordinador o back office pueden reasignar clientes.`});let a=n.asesor_id?Rn(n.asesor_id):void 0;if(n.asesor_id&&!a)throw new w(400,{message:`Ese asesor no existe o está inactivo.`});if(a&&!ze(e,a.agencia_id,a.area))throw new w(403,{message:`Ese asesor es de una agencia o área que no administras.`});let o=a&&(a.agencia_id!==r.agencia_id||a.area!==r.area);y.prepare(`UPDATE leads SET asesor_id = ?, agencia_id = COALESCE(?, agencia_id), area = COALESCE(?, area), updated_at = ? WHERE id = ?`).run(n.asesor_id,a?.agencia_id??null,a?.area??null,i,t),J(t,e.id,`asignacion`,a?`Reasignado a ${a.nombre}`:`Sin asesor asignado`,i);let s={usuarioId:e.id};if(I(t,{responsables:[`asesor`]},`Cambió el asesor`,s,i),L(t,[`asignacion`],a?`Asignado a ${a.nombre}`:`Sin asesor`,e.id,i),r.control===`asesor`&&z(X(t),{control:`backoffice`,usuarioId:null},s,a?`Cambió el asesor: back office la lleva mientras ${a.nombre} acepta`:`Sin asesor: el control pasa a back office`,i),a?r.estado_contacto===`contactado`&&!p(r)&&!r.baja_at?Qe(t,s,i):y.prepare(`UPDATE leads SET aceptacion = 'preasignado', aceptacion_limite = NULL, aceptacion_at = NULL WHERE id = ?`).run(t):y.prepare(`UPDATE leads SET aceptacion = 'ninguna', aceptacion_limite = NULL, aceptacion_at = NULL WHERE id = ?`).run(t),o&&a?.area){let n=y.prepare(`SELECT nombre FROM agencias WHERE id = ?`).get(a.agencia_id);J(t,e.id,`asignacion`,`Pasó a ${_.area[a.area]}${n?` · ${n.nombre}`:``}`,i)}}c?Y(r,e.id,{estado:n.estado_contacto,resultado:n.resultado,motivo:n.motivo},i):s&&r.resultado!==`en_proceso`&&r.resultado!==`venta`&&Y(r,e.id,{resultado:`en_proceso`},i)}),q(e,t)}function Z(e,t,n){E(e);let r=q(e,t),i=x(),a=n.tipo!==`nota`;return S(()=>{if(J(t,e.id,n.tipo,n.texto.trim(),i),y.prepare(`UPDATE leads SET last_activity_at = ?, updated_at = ?,
         first_contact_at = CASE WHEN ? THEN COALESCE(first_contact_at, ?) ELSE first_contact_at END
       WHERE id = ?`).run(i,i,+!!a,i,t),n.proximo_contacto!==void 0&&y.prepare(`UPDATE leads SET proximo_contacto = ? WHERE id = ?`).run(n.proximo_contacto,t),n.tareaId?(y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = ?, done_at = ?, done_by = ? WHERE id = ? AND lead_id = ? AND estado IN ('programada','en_curso')`).run(n.resultadoTarea??`Hecha`,i,e.id,n.tareaId,t),n.contesto&&L(t,[`intervencion`],`Contestó`,e.id,i)):n.tipo===`llamada`?L(t,[`llamada`,`intervencion`],n.contesto?`Contestó`:`No contestó`,e.id,i,!n.contesto):n.tipo===`whatsapp`&&!n.contesto&&L(t,[`whatsapp`],`Enviado`,e.id,i,!0),n.contesto&&(ir(t,`El cliente contestó`,{usuarioId:e.id},i),ct(t,{usuarioId:e.id},i)),n.contesto){r.estado_contacto!==`contactado`&&Y(r,e.id,{estado:`contactado`},i);let a=X(t),o=e.rol===`asesor`?`asesor`:`backoffice`;n.tipo!==`llamada`||a.baja_at||a.control===`nadie`||a.control===o&&a.control_usuario_id===e.id||z(a,{control:o,usuarioId:e.id,agente:a.agente_estado===`desactivado`?`desactivado`:`pausado`,pausa:a.agente_estado===`desactivado`?a.agente_pausa:`control_humano`},{usuarioId:e.id},`Contestó la llamada: toma el control quien llamó`,i)}else a&&r.estado_contacto===`nuevo`?Y(r,e.id,{estado:`en_espera`},i):a&&r.estado_contacto===`en_espera`&&u(C(r.agencia_id).cadencia,Oe(t)).completa&&Y(r,e.id,{estado:`sin_respuesta`},i);tr(t)&&er(t)}),q(e,t)}var Q=6e4,Gn=60*Q,Kn=6*Gn;function qn(e){let t=new Date(e-Kn);return{ymd:t.toISOString().slice(0,10),dia:t.getUTCDay()}}var Jn=(e,t)=>new Date(`${e}T${String(Math.min(t,23)).padStart(2,`0`)}:${t>=24?`59`:`00`}:00-06:00`).getTime();function Yn(e,t){let{ymd:n,dia:r}=qn(t),i=r===0?e.horario.domingo:r===6?e.horario.sabado:e.horario.semana;return i?[Jn(n,i[0]),Jn(n,i[1])]:null}function $(e,t){for(let n=0;n<14;n++){let r=t+n*24*Gn,i=Yn(e,n===0?t:Jn(qn(r).ymd,12));if(i){if(n===0){if(t<i[0])return i[0];if(t<i[1])return t}else return i[0]}}return t}function Xn(e,t,n){let r=[],i=$(e,t);for(;r.length<n;){let t=Yn(e,i);r.push([Math.max(i,t[0]),t[1]]),i=$(e,Jn(qn(t[1]+12*Gn).ymd,0))}return r}function Zn(e,t){return t<=1?0:(t===2?e.esperaLlamada.p2:t===3?e.esperaLlamada.p3:e.esperaLlamada.p4)*Q}function Qn(e,t,n,r){let{dias:i,whatsappPorDia:a,llamadasPorDia:o}=e.cadencia,s=Xn(e,t,i),c=[],l=0,u=0;return s.forEach(([i,s],d)=>{let f=[];for(let e=0;e<Math.max(a,o);e++)e<a&&f.push(`whatsapp`),e<o&&f.push(`llamada`);let p=i+30*Q;if(d===0){let a=f.shift();a===`whatsapp`?c.push({tipo:`whatsapp`,at:r?t:$(e,t),n:++l,jornada:1}):a&&f.unshift(a);let o=f.indexOf(`llamada`);if(o>=0){f.splice(o,1);let r=$(e,Math.max(t,i)+Zn(e,n));c.push({tipo:`llamada`,at:r,n:++u,jornada:1}),p=r+45*Q}}let m=s-30*Q,h=f.length?Math.max(10*Q,(m-p)/f.length):0;f.forEach((e,t)=>{let n=Math.min(p+t*h,s-5*Q);c.push({tipo:e,at:n,n:e===`whatsapp`?++l:++u,jornada:d+1})})}),c.sort((e,t)=>e.at-t.at)}function $n(e,t,n=x()){let r=X(e);if(!r||r.baja_at||![`nuevo`,`en_espera`].includes(r.estado_contacto))return 0;let i=C(r.agencia_id),a=R(r.agencia_id)&&r.control===`vexa`,o=v(r),s=Qn(i,new Date(n).getTime(),o,a),{dias:c,whatsappPorDia:l,llamadasPorDia:u}=i.cadencia,d=c*l,f=c*u,p=0;for(let r of s){let s=r.tipo===`whatsapp`&&r.n===d;F(e,{tipo:r.tipo,responsable:r.tipo===`whatsapp`&&a?`vexa`:`backoffice`,prioridad:r.tipo===`llamada`&&r.n===1?o:Math.max(o,2),motivo:`${r.tipo===`whatsapp`?`WhatsApp ${r.n} de ${d}`:`Llamada ${r.n} de ${f}`} · jornada ${r.jornada} de ${c}${s?` · cierre del ciclo`:``}`,programadaAt:new Date(r.at).toISOString(),venceAt:new Date(r.n===1&&r.jornada===1?r.at+i.slaMin*Q:Yn(i,r.at)?.[1]??r.at+2*Gn).toISOString(),origen:`protocolo`,clave:`protocolo:${e}:${r.tipo}:${r.n}`},t,n)&&p++}return p&&(P(e,t,`protocolo`,`Protocolo de contacto: ${d} WhatsApp${a?` de VEXA`:``} y ${f} llamadas en ${c} jornadas`,n),er(e)),p}function er(e){let t=y.prepare(`SELECT MIN(programada_at) AS at FROM tareas WHERE lead_id = ? AND origen = 'protocolo' AND estado IN ('programada','en_curso') AND responsable <> 'vexa'`).get(e);return t.at&&y.prepare(`UPDATE leads SET proximo_contacto = ? WHERE id = ?`).run(t.at,e),t.at}var tr=e=>!!y.prepare(`SELECT 1 FROM tareas WHERE lead_id = ? AND origen = 'protocolo' AND estado IN ('programada','en_curso')`).get(e);function nr(e){let t=x(),n=Number(new Intl.DateTimeFormat(`en-US`,{timeZone:`America/Mexico_City`,hour:`numeric`,hourCycle:`h23`}).format(new Date)),r=n>=8&&n<21,i=y.prepare(`SELECT id, lead_id, motivo, origen FROM tareas WHERE origen IN ('protocolo','recuperacion') AND responsable = 'vexa' AND tipo = 'whatsapp'
         AND estado = 'programada' AND programada_at <= ? ORDER BY programada_at LIMIT 50`).all(t);for(let n of i){let i=Number(/(?:WhatsApp|Recuperación) (\d+)/.exec(n.motivo)?.[1]??1),a=n.origen===`recuperacion`;if(!(i>1&&!r))try{S(()=>{let r=X(n.lead_id),o=r?r.baja_at?`El cliente pidió no ser contactado`:!a&&r.estado_contacto!==`nuevo`&&r.estado_contacto!==`en_espera`?`El cliente ya no está en protocolo`:a&&(r.estado_contacto!==`contactado`||r.resultado===`sin_avance`||r.resultado===`venta`||r.resultado===`no_interesado`||r.resultado===`descalificado`)?`El cliente ya no está en recuperación`:r.control!==`vexa`||r.agente_estado!==`activo`?`VEXA ya no tiene la conversación`:null:`El cliente ya no existe`;o||!r?y.prepare(`UPDATE tareas SET estado = 'cancelada', cancel_motivo = ?, done_at = ? WHERE id = ?`).run(o,t,n.id):(e(r,i,t,n.origen),y.prepare(`UPDATE tareas SET estado = 'hecha', resultado = 'Enviado', done_at = ? WHERE id = ?`).run(t,n.id),J(r.id,null,`whatsapp`,a?`VEXA · recuperación ${i} de 3 (dejó de responder).`:`VEXA · WhatsApp ${i} del protocolo (sin respuesta del cliente).`,t),y.prepare(`UPDATE leads SET first_contact_at = COALESCE(first_contact_at, ?), last_activity_at = ? WHERE id = ?`).run(t,t,r.id),r.estado_contacto===`nuevo`&&Y(r,null,{estado:`en_espera`},t))})}catch(e){console.error(`Protocolo (tarea ${n.id}):`,e)}}return i.length}function rr(){let e=x(),t=new Date(Date.now()-30*Q).toISOString(),n=y.prepare(`SELECT l.id FROM leads l
       WHERE l.estado_contacto IN ('nuevo','en_espera') AND l.baja_at IS NULL AND l.alerta_seguimiento_at IS NULL
         AND EXISTS (SELECT 1 FROM tareas t WHERE t.lead_id = l.id AND t.origen = 'protocolo')
         AND NOT EXISTS (SELECT 1 FROM tareas t WHERE t.lead_id = l.id AND t.origen = 'protocolo' AND t.estado IN ('programada','en_curso'))
         AND (SELECT MAX(t.programada_at) FROM tareas t WHERE t.lead_id = l.id AND t.origen = 'protocolo') < ?
       LIMIT 50`).all(t);for(let{id:t}of n)try{S(()=>{let n=X(t),r=u(C(n.agencia_id).cadencia,Oe(t));if(r.completa)Y(n,null,{estado:`sin_respuesta`},e);else{let n=Oe(t);y.prepare(`UPDATE leads SET alerta_seguimiento_at = ? WHERE id = ?`).run(e,t);let i=`⚠ Alerta de falta de seguimiento: terminó el protocolo con ${n.whatsapp} de ${r.metaWa} WhatsApp y ${n.llamadas} de ${r.metaLl} llamadas registrados. No se cierra hasta completarlo o registrar una excepción.`;J(t,null,`nota`,i,e),P(t,{actor:`Sistema`},`alerta`,i,e)}})}catch(e){console.error(`Cierre de protocolo (lead ${t}):`,e)}return n.length}var ir=(e,t,n,r=x())=>I(e,{origen:`protocolo`},t,n,r);export{T as $,It as A,St as B,dn as C,Ft as D,Xt as E,Kt as F,mt as G,Dt as H,Vt as I,Ke as J,ht as K,xt as L,Jt as M,Nt as N,Lt as O,Gt as P,Me as Q,yt as R,ln as S,H as T,vt as U,bt as V,gt as W,Ie as X,Pe as Y,Fe as Z,fn as _,In as a,w as at,_n as b,G as c,Ee as ct,Ln as d,_e as dt,Re as et,Fn as f,ge as ft,Wn as g,S as gt,K as h,x as ht,Y as i,Ne as it,qt as j,Ht as k,q as l,Te as lt,kn as m,b as mt,er as n,Ve as nt,Hn as o,De as ot,J as p,y as pt,qe as q,Z as r,Be as rt,An as s,C as st,$n as t,E as tt,W as u,me as ut,pn as v,hn as w,gn as x,un as y,_t as z};