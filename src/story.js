/* =====================================================================
   EL ÚLTIMO CARRETE — datos de la historia (Santiago de Chile, 2030).
   Aquí viven: tipos de borde, carretes (escenas), personajes + diálogos,
   persecuciones y finales. Nada de esto toca three.js.

   Las líneas de diálogo pueden ser:
     "texto"                                  → habla el personaje
     { who:'DAN', say:'texto' }               → habla otro (Dan, etc.)
     { say:'texto', sfx:'laugh'|'bark'|'meow' }→ con sonido
     { id, ask:'pregunta', who?, options:[    → decisión del jugador
         { t:'opción', v:+1, flags:['x'], reply:[ ...líneas ] } ] }

   El contexto `c` que reciben las funciones de diálogo:
     c.count        veces que ya hablaste con este personaje (0 = primera vez)
     c.has(reelId)  true si ese carrete está ahora en tu montaje
     c.talked(npc)  true si ya hablaste con ese personaje
     c.decided(id)  true si ya tomaste esa decisión
     c.flag(f)      true si tienes esa marca (p.ej. 'idfalso', 'vendido')
     c.valor        tu convicción actual
     c.n            cantidad de carretes en tu montaje
   ===================================================================== */

// ---------- reglas del juego ----------
export const START_TIME = 360;   // segundos para terminar la historia
export const MAX_CAM = 3;        // integridad de la cámara de video
export const NEED = 3;           // convicción mínima para atreverse a publicar
export const SPLICE_BONUS = 8;   // segundos que da un empalme perfecto
export const ERROR_PENALTY = 8;  // segundos que cuesta un error de continuidad

export const INTRO = [
  'SANTIAGO DE CHILE · 2030',
  'Dan, cineasta, fue perseguido hasta la muerte por una de sus obras: una película sobre la esclavitud y las huellas que deja en la salud mental, tanto de las personas como de los animales.',
  'Lo que sigue son sus recuerdos, sueltos como carretes de película sobre una mesa. Ordénalos —puerta con puerta, escalera con escalera— mientras escapas de quienes quieren su cámara.',
  'Si el tiempo se agota o la cámara se rompe, la historia de Dan termina. Tus decisiones forjarán su convicción… y decidirán si la obra se publica.',
];

// ---------- tipos de borde (con qué empieza / termina un carrete) ----------
export const TYPES = {
  START:     { label: 'ACCIÓN',          icon: '🎬', color: '#e9e4d4' },
  DOOR:      { label: 'PUERTA ABIERTA',  icon: '🚪', color: '#ff9f43' },
  STAIRS:    { label: 'ESCALERA',        icon: '🪜', color: '#54a0ff' },
  BRIDGE:    { label: 'PUENTE COLGANTE', icon: '🌉', color: '#1dd1a1' },
  TUNNEL:    { label: 'TÚNEL',           icon: '🕳️', color: '#a77bff' },
  ELEVATOR:  { label: 'ASCENSOR',        icon: '🛗', color: '#7fe3ff' },
  ROAD:      { label: 'CARRETERA SUR',   icon: '🛣️', color: '#ffd1dc' },
  END_GOLD:  { label: 'PUBLICAR',        icon: '🌱', color: '#feca57', finish: true },
  END_NOIR:  { label: 'EXILIO',          icon: '🌧️', color: '#ff5d5d', finish: true },
  END_TWIST: { label: 'EL TRATO',        icon: '💼', color: '#ff6bd6', finish: true },
};
export const isFinish = t => !!TYPES[t].finish;

// ---------- finales ----------
// Los finales fallidos ('TIEMPO', 'CAMARA') los dispara el reloj o la cámara rota.
export const ENDINGS = {
  PUBLICADA: {
    title: 'LA SEMILLA', color: '#feca57',
    text: c => 'La obra de Dan se estrena. La sala guarda silencio… y después aplaude de pie. La sociedad agradece que alguien se haya atrevido a mostrar lo que todos preferían no mirar: la esclavitud y las heridas que deja en las personas y en los animales. Una semilla queda sembrada.'
      + (c.talked('vicente') ? ' Vicente, ya sin cortes, mira la pantalla desde la última fila.' : '')
      + (c.talked('abuelo') ? ' En primera fila, alguien recuerda sin necesidad de cámaras.' : '')
      + (c.talked('eros') && c.talked('psique') ? ' Entre los créditos, dos nombres: Eros y Psique.' : ''),
  },
  MIEDO: {
    title: 'EL BOTÓN SIN PRESIONAR', color: '#9fb3c8',
    text: c => 'Dan llega a la cabina, apoya la mano sobre el proyector… y duda. Le faltó convicción. Nadie lo detiene; nadie lo empuja. La obra se queda en la lata y nadie se anima a alzar la voz, a pesar de las consecuencias.'
      + (c.talked('hollis') ? ' Hollis apaga la luz y guarda silencio con él.' : ''),
  },
  SILENCIO: {
    title: 'EL EXILIO', color: '#ff5d5d',
    text: c => 'Lluvia, neón y la carretera hacia el sur. Dan esconde los carretes bajo el asiento y Lou conduce sin mirar atrás. Está a salvo, pero la obra jamás se estrena: nadie alza la voz, a pesar de las consecuencias.'
      + (c.has('sewer') ? ' Edna escribió la crítica que nunca se publicará.' : '')
      + (c.talked('vicente') ? ' Vicente no tendrá su lugar en la pantalla.' : ''),
  },
  VENDIDA: {
    title: 'EL TRATO', color: '#ff6bd6',
    text: c => (c.flag('vendido')
      ? 'Dan firma. El Productor sonríe, guarda la obra en una bóveda con aire acondicionado y la historia se enfría para siempre.'
      : 'Dan se negó a firmar, pero el Productor tiene abogados: la copia fue incautada esa misma noche.')
      + ' La obra no se publica. Nadie se anima a alzar la voz.',
  },
  TIEMPO: {
    title: 'SE ACABÓ EL TIEMPO', color: '#ff5d5d',
    text: () => 'El último carrete se agotó. Los que perseguían a Dan lo encontraron antes de que terminara el montaje, y su historia termina aquí. La cámara quedó encendida, grabando una sala vacía.',
  },
  CAMARA: {
    title: 'LA CÁMARA SE ROMPIÓ', color: '#ff5d5d',
    text: () => 'Sin la cámara no quedan imágenes. Dan sólo conserva la memoria, igual que su abuelo… pero la obra se perdió con ella, y con ella termina la historia.',
  },
};

// ---------- los carretes ----------
// id         nombre corto usado en las condiciones de diálogo
// props      [x, z, w, d, h, color, forma?] — local al carrete. Deja libre |z|<3.4 para |x|>4.5 (los pasillos).
// npcs       personajes con quienes hablar con E. Mantén |x| <= 4.
// chaser     opcional: perseguidores que aparecen cuando entras a un carrete ya empalmado hacia adelante
// home       [x, _, z, rotY] donde yace suelto el carrete al comenzar
export const REELS = [
  { id: 'sala', name: 'SALA DE CASSETTES', start: 'START', end: 'DOOR',
    floor: '#5a4636', alt: '#4f3d2f', pattern: 'checker', home: [0, 0, 0],
    props: [[-7,-4.5,2.2,2.2,1.6,0x8a6a43],[-3.5,4.8,3,1.6,1.2,0x7a5b3a],[0.5,-4.4,1.6,1.6,2.4,0x6b4a2a,'cyl'],[3,4.5,2,2,1,0x8a6a43],[-9.5,4.5,1.5,1.5,1,0x6d4f2f]],
    npcs: [
      { id: 'abuelo', name: 'Abuelo', x: -2.6, z: -1.6, body: 0x8a8f9c, hat: 'none', hair: 0xe8e8e8,
        lines: c => c.count === 0 ? [
          "Ahí estás, Dan. Te sentí llegar con ese aparato al hombro.",
          { who: 'DAN', say: "¡Abuelo! Mira cuánto grabé: tu risa, el patio, a Eros y a Psique. Sin la cámara no podría rememorar momentos tan sagrados como éste." },
          "Yo no entiendo cómo funciona esa tecnología, hijo. Pero mi memoria sí. Ella ha sido mi mejor herramienta: cada vez me ha recordado las maravillas de la vida.",
          { id: 'abuelo', ask: "Dime, Dan… si algún día te quitan la cámara, ¿qué te queda?",
            options: [
              { t: "Lo que recuerde, igual que usted.", v: 1, flags: ['memoria'], reply: ["Eso, hijo. Las imágenes se rompen; lo que se ama, no."] },
              { t: "Entonces no me queda nada.", v: 0, reply: ["Tonteras. Algo te quedará, aunque ahora no lo veas."] },
            ] },
          { who: 'DAN', say: "(Mis recuerdos andan sueltos como carretes. Aleja el zoom con la rueda del mouse, arrastra uno hasta la puerta que brilla y haz que calce: puerta con puerta, escalera con escalera. Y no me sobra el tiempo.)" },
        ] : [
          c.decided('abuelo') ? "Anda, hijo. El tiempo no espera a nadie." : { id: 'abuelo', ask: "Dan… si algún día te quitan la cámara, ¿qué te queda?",
            options: [
              { t: "Lo que recuerde, igual que usted.", v: 1, flags: ['memoria'], reply: ["Eso, hijo. Las imágenes se rompen; lo que se ama, no."] },
              { t: "Entonces no me queda nada.", v: 0, reply: ["Tonteras. Algo te quedará."] },
            ] },
          c.n > 2 ? "Vas armando tu película, ¿ah? Cuida esa cámara." : "Aleja el zoom, hijo. Los recuerdos no vienen solos.",
        ] },
      { id: 'tv', kind: 'tv', name: 'Televisor', x: 3.6, z: -2.9, body: 0x3a3a40, hat: 'none', markY: 2.4,
        lines: c => c.count === 0 ? [
          { who: 'DAN', say: "(Meto uno de mis viejos cassettes en la tele. Está rayado, pero todavía funciona…)" },
          { say: "♪ [Una risa de niño. Es la tuya.]", sfx: 'laugh' },
          { say: "♪ [Un ladrido alegre, de patas rápidas: Eros.]", sfx: 'bark' },
          { say: "♪ [Un maullido bajito desde el respaldo del sofá: Psique.]", sfx: 'meow' },
          { who: 'DAN', say: "Cuánto los extraño… Fueron mi primera película, sin saberlo." },
        ] : [
          { say: "♪ [Vuelves a reproducir el cassette.]", sfx: 'laugh' },
          { say: "♪ [Guau. Miau. Y tu risa, otra vez.]", sfx: 'bark' },
        ] },
      { id: 'eros', kind: 'dog', name: 'Eros', x: 1.2, z: 1.9, body: 0xc9a46b, hat: 'none', ghost: true, markY: 1.9,
        lines: c => c.count === 0 ? [
          { say: "*Eros mueve la cola. Su figura es tenue, como un recuerdo.*", sfx: 'bark' },
          { who: 'DAN', say: "Ven acá, compañero… Te vi mirar películas conmigo durante años." },
        ] : [ { say: "*Guau.*", sfx: 'bark' } ] },
      { id: 'psique', kind: 'cat', name: 'Psique', x: 4.3, z: 2.2, body: 0x7d7d86, hat: 'none', ghost: true, markY: 1.7,
        lines: c => c.count === 0 ? [
          { say: "*Psique ronronea y se frota contra tu pierna, aunque casi no pesa.*", sfx: 'meow' },
          { who: 'DAN', say: "Los animales también cargan con lo que viven, Psique. Por eso hice la película." },
        ] : [ { say: "*Miau.*", sfx: 'meow' } ] },
    ] },

  { id: 'plaza', name: 'PLAZA DE ARMAS', start: 'DOOR', end: 'STAIRS',
    floor: '#8d8672', alt: '#7a7462', pattern: 'checker', home: [24, 0, -34, -0.12],
    props: [[-6,-5.2,1.6,1.6,3.6,0x6b5a3a,'cyl'],[0,-5.2,1.6,1.6,3.6,0x6b5a3a,'cyl'],[6,-5.2,1.6,1.6,3.6,0x6b5a3a,'cyl'],
            [-6,5.2,1.6,1.6,3.6,0x6b5a3a,'cyl'],[0,5.2,1.6,1.6,3.6,0x6b5a3a,'cyl'],[6,5.2,1.6,1.6,3.6,0x6b5a3a,'cyl'],
            [1.5,-1.2,3,1.4,1,0x5a3320],[-2.5,1.8,1.2,1.2,1.2,0xc23b2e]],
    npcs: [
      { id: 'gus', name: 'Gus, Vendedor de Completos', x: -3.6, z: -2.4, body: 0xc23b2e, hat: 'cap', hatColor: 0xf0e6d0,
        lines: c => c.count === 0 ? [
          "¡Un completo con palta para el cineasta! Treinta años en esta esquina de la Plaza de Armas.",
          "Yo veo pasar a todos: turistas, palomas, artistas… y ahora unos señores de terno preguntando por ti.",
          c.talked('vicente') ? "¿Hablaste con Vicente? Pobre. Lo cortaron de todas partes." : "Dicen que hay un fantasma en el metraje censurado. Yo ni me acerco.",
          "Las escaleras del fondo suben a las azoteas o bajan a las calderas. Arriba hay aire; abajo, menos preguntas.",
        ] : [
          "Se enfría el completo.",
          c.has('roof') ? "Las azoteas sirven para huir. Mal para el vértigo." : "Elige bien la escalera, cineasta.",
        ] },
      { id: 'penny', name: 'Penny, Amiga de Ajedrez', x: 3.4, z: 1.2, body: 0x4aa8a0, hat: 'none',
        lines: c => c.count === 0 ? [
          "¡Dan! Tarde, como siempre. Te guardé el tablero: tus negras contra mis blancas.",
          { who: 'DAN', say: "Un completo y una partida de ajedrez. No necesito más para ser feliz." },
          "¿Sigues andando con esa cámara a todas partes? Te van a hacer famoso… o te van a meter en problemas.",
          { who: 'DAN', say: "Las dos cosas, probablemente." },
          "Qué lástima que muchos no entiendan por qué defiendes lo que defiendes. Yo sí. Pero cuídate.",
        ] : [
          "Jaque en tres jugadas. ¿Y tú, en cuántas?",
          c.n > 3 ? "Buen montaje. Cada pieza en su casilla." : "Lo que termina en escalera debe empezar en escalera, Dan. Lógica pura.",
        ] },
    ] },

  { id: 'roof', name: 'AZOTEAS DEL CENTRO', start: 'STAIRS', end: 'BRIDGE',
    floor: '#46505c', alt: '#3d4651', pattern: 'checker', home: [88, 0, 37, 0.1],
    props: [[-6,4.5,3,3,1.4,0x777f8a],[2,-4.5,2.2,2.2,2.6,0x8a7f77],[6,5.4,3.2,3.2,3,0x6b7c8f,'cyl'],[-2,-5.5,0.5,0.5,4,0x333333,'cyl']],
    chaser: { name: 'Agentes de la productora', body: 0x1c2330, hat: 'tophat', hatColor: 0x111111, speed: 3.4 },
    npcs: [
      { id: 'dani', name: 'Dani, Doble de Riesgo', x: -2, z: 1.2, body: 0xd9a21b, hat: 'none',
        lines: c => c.count === 0 ? [
          "¡Dan! Soy Dani, tu doble de riesgo. Salto de techo en techo para que otros no tengan que hacerlo.",
          "Hay hombres de la productora en la azotea. Si te alcanzan, te quitan la cámara. Y si pierdes la cámara…",
          { id: 'dani', ask: "Dime la verdad, Dan: ¿vale la pena que te persigan por una película?",
            options: [
              { t: "Vale la pena si alguien la ve.", v: 1, reply: ["Así me gusta. Entonces corramos."] },
              { t: "A veces creo que no.", v: 0, reply: ["Pues yo creo que sí. Y ya salté un techo por ti."] },
            ] },
        ] : [
          "¡Rápido! Esos de terno no se cansan.",
          c.has('chasm') ? "Al otro lado del puente están el cerro y el proyector." : "Cruza el puente colgante, si lo encuentras.",
        ] },
    ] },

  { id: 'chasm', name: 'CERRO SANTA LUCÍA', start: 'BRIDGE', end: 'END_GOLD',
    floor: '#6a5836', alt: '#5d4c2d', pattern: 'planks', home: [120, 0, -37, 0.1],
    props: [[-6,-4.8,2.6,2.6,1.6,0x666a70],[-1.5,4.6,2.2,2.2,1.1,0x70757c],[4.5,-4.6,2.4,2.4,1.9,0x5c6066],[7,5.2,1.8,1.8,1.2,0x70757c]],
    npcs: [
      { id: 'hollis', name: 'Hollis, Proyeccionista', x: 1.5, z: 1.2, body: 0x8d7a66, hat: 'tophat', hatColor: 0x222222,
        lines: c => c.count === 0 ? [
          "Hollis, proyeccionista. Cuarenta años proyectando desde este cerro, desde el primer cuadro.",
          "Abajo hay gente sentada en el pasto, esperando una película. Hoy puede ser la tuya.",
          "Pero ojo: cuando la vean, ya no será sólo tuya. Y a algunos no les va a gustar.",
          { id: 'hollis', ask: "¿Proyectamos, Dan?",
            options: [
              { t: "Sí. Que la vean, aunque me cueste todo.", v: 1, reply: ["Eso esperaba. Entonces el arco dorado es tu puerta."] },
              { t: "Aún no… tengo miedo.", v: -1, reply: ["El miedo no es vergüenza. Pero tampoco enciende el proyector por ti."] },
            ] },
        ] : [
          c.valor >= NEED ? "Veo en ti la convicción de quien ya decidió. El arco dorado te espera."
                          : "Aún dudas, Dan. Quizás la convicción que te falta está en las personas que dejaste atrás…",
          "Cuando quieras, yo enciendo.",
        ] },
    ] },

  { id: 'deleted', name: 'METRAJE CENSURADO', start: 'DOOR', end: 'STAIRS',
    floor: '#4a3566', alt: '#412e5a', pattern: 'checker', home: [-8, 0, 35, -0.1],
    props: [[-5,-4.5,2.2,2.2,2.2,0xc04dd0],[0,4.8,2,2,3,0x9b3fb0],[5,-5,2.2,2.2,1.2,0xc04dd0],[-8,4.8,1.6,1.6,1.6,0xb050c0]],
    npcs: [
      { id: 'vicente', name: 'Vicente, el Protagonista Censurado', x: -1, z: -1, body: 0xbfe6ff, hat: 'none', ghost: true,
        lines: c => c.count === 0 ? [
          "…Dan. ¿Me reconoces? Yo era el protagonista de tu película. El que cortaron.",
          "Mi personaje era un hombre al que obligaron a trabajar sin descanso, sin nombre y sin salida. El público quería olvidarlo. Los productores, también.",
          "Y no fui el único. Entre esas escenas también estaban los animales: bueyes, caballos, perros… con la mirada rota. El encierro y el miedo dejan cicatrices en ellos igual que en nosotros.",
          { id: 'vicente', ask: "¿Prometes que mi historia se va a contar?",
            options: [
              { t: "Lo prometo. Se contará, cueste lo que cueste.", v: 1, flags: ['promesa'], reply: ["Gracias. Entonces ya no estoy solo."] },
              { t: "No puedo prometer nada. Me persiguen.", v: 0, reply: ["Lo sé. Pero la memoria pesa más que el miedo, Dan."] },
            ] },
        ] : [
          c.has('deleted') ? "Estoy otra vez en tu película. Gracias." : "Estoy aquí. Siempre estuve.",
          "Los productores dicen que todo lo que cortaron era malo. No les creas.",
        ] },
    ] },

  { id: 'lobby', name: 'HOSTAL EL PASAJE', start: 'DOOR', end: 'ELEVATOR',
    floor: '#8d8a80', alt: '#7b786f', pattern: 'checker', home: [56, 0, 34, -0.15],
    props: [[-1,-4.8,5,1.6,1.3,0x5a3a22],[-8,4.8,1.2,1.2,1.6,0x2f6b3a,'cyl'],[4.5,5,3.4,1.5,0.9,0x7a2a3a],[8.5,-5,1.2,1.2,1.6,0x2f6b3a,'cyl']],
    npcs: [
      { id: 'mona', name: 'Mona, Recepcionista', x: -1.5, z: -2.6, body: 0xb04a6e, hat: 'none',
        lines: c => c.count === 0 ? [
          "Bienvenido al Hostal El Pasaje. Aquí nadie pregunta de dónde vienes.",
          "Dicen que andan siguiendo a un cineasta con una cámara. Yo puedo prestarte otro nombre: un carnet nuevo, con tu foto… un poquito falsa.",
          { id: 'mona', ask: "¿Te animas a ser otra persona por un rato?",
            options: [
              { t: "Acepto el carnet falso.", v: 0, flags: ['idfalso'], reply: ["Listo, ahora eres «Daniel Soto». Los que te buscan dudarán un segundo antes de correr tras de ti."] },
              { t: "No. Mi nombre va en mi obra.", v: 1, reply: ["Valiente… o imprudente. Que te acompañe la suerte."] },
            ] },
          "El ascensor está al fondo: arriba, el penthouse del Sr. Gold. Y por abajo, la pasarela. Elige con cuidado.",
        ] : [
          "¿Ya te vas?",
          c.has('pent') ? "¿Subiste a ver al Productor? Eres valiente." : "El ascensor tiene dos destinos. Elige con cuidado.",
        ] },
    ] },

  { id: 'pent', name: 'PENTHOUSE', start: 'ELEVATOR', end: 'END_TWIST',
    floor: '#2c2438', alt: '#241d30', pattern: 'carpet', home: [88, 0, -34, -0.08],
    props: [[2,-4.6,5,2,1.2,0x3a2a1a],[-6,4.8,1.2,1.2,2.2,0xffd34d,'cyl'],[6,5.2,1.6,1.6,1.2,0x553355],[-8,-5,1.6,1.6,1.2,0x553355]],
    npcs: [
      { id: 'producer', name: 'Sr. Gold, el Productor', x: -1.5, z: 0.8, body: 0x1d1d26, hat: 'tophat', hatColor: 0xffd34d,
        lines: c => c.count === 0 ? [
          "Dan. Por fin. Siéntate; el champaña es de verdad.",
          "Te propongo algo simple: me vendes tu película, completa y sin copias. Yo la… conservo.",
          "Ganarás más de lo que ganarías en diez vidas. Y nadie volverá a perseguirte.",
          { id: 'producer', ask: "¿Y bien? ¿Cerramos el trato?",
            options: [
              { t: "Jamás. Mi obra no está en venta.", v: 2, reply: ["Qué ingenuo. El mercado es paciente, Dan."] },
              { t: "Quizás… si así termina todo.", v: -2, flags: ['vendido'], reply: ["Excelente. La puerta rosada es la salida."] },
            ] },
        ] : [
          "¿Tenemos trato?",
          c.flag('vendido') ? "La puerta rosada, por favor." : "Nadie rechaza dos veces mi oferta… o eso creía.",
        ] },
    ] },

  { id: 'boiler', name: 'SALA DE CALDERAS', start: 'STAIRS', end: 'TUNNEL',
    floor: '#3a3330', alt: '#322c29', pattern: 'checker', home: [24, 0, 37, 0.12],
    props: [[-6,-4.8,3.2,3.2,3.6,0x7a4b3a,'cyl'],[-1,5.2,2.8,2.8,3.2,0x8a5a44,'cyl'],[6,-5,3,3,3.4,0x7a4b3a,'cyl'],[3.5,5.4,4,0.8,0.8,0x555555]],
    npcs: [
      { id: 'rusty', name: 'Rusty, Fogonero', x: 0, z: -1.8, body: 0xa04a2a, hat: 'hardhat', hatColor: 0xffc400,
        lines: c => c.count === 0 ? [
          "Calderas de un edificio que ya nadie recuerda. Aquí nadie hace preguntas y todo se calienta.",
          "Cuando no hay nadie, proyecto películas prohibidas en el muro del fondo. La tuya también la vi, Dan.",
          "Es una obra que duele. Y justamente por eso importa.",
          "El túnel del fondo lleva al colector, y el colector a la carretera sur. Pero ojo: huir también es una decisión.",
        ] : [ "Cuidado con los tubos.", "Hay quienes se esconden para siempre." ] },
    ] },

  { id: 'sewer', name: 'COLECTOR', start: 'TUNNEL', end: 'ROAD',
    floor: '#2f4a46', alt: '#294140', pattern: 'checker', home: [-8, 0, -36, 0.1],
    props: [[-6,5,2.2,2.2,1.4,0x6a5a3a],[2,-5,1.6,1.6,1.6,0x6a6a72,'cyl'],[7,5,2,2,1.2,0x6a5a3a],[-9,-4.6,1.6,1.6,1.6,0x6a6a72,'cyl']],
    chaser: { name: 'Cazarrecompensas', body: 0x3b2a2a, hat: 'cap', hatColor: 0x111111, speed: 3.6 },
    npcs: [
      { id: 'edna', name: 'Edna, Crítica de Cine', x: -2, z: 1.6, body: 0x7a4a8a, hat: 'beret', hatColor: 0x111111,
        lines: c => c.count === 0 ? [
          "Soy crítica. Vivo en el colector porque a nadie le gustan mis reseñas.",
          "Vi tu obra en una proyección privada. Dos estrellas: incómoda, desordenada… y verdadera, lo cual es peor.",
          "Unos cazarrecompensas andan olfateando tu cámara. Corre, y no te caigas al agua.",
          { id: 'edna', ask: "Dime, cineasta: ¿para qué publicar algo que nadie quiere ver?",
            options: [
              { t: "Porque alguien tiene que decirlo.", v: 1, reply: ["Eso mismo escribí yo hace años… y lo guardé en un cajón."] },
              { t: "Quizás es mejor archivarla.", v: -1, reply: ["Eso dicen todos. Y por eso el mundo sigue igual."] },
            ] },
        ] : [
          c.n > 4 ? "Un montaje largo. Ambicioso." : "Apúrate: tengo una columna que entregar.",
          "Al final está la carretera. Lou espera.",
        ] },
    ] },

  { id: 'road', name: 'RUTA AL EXILIO', start: 'ROAD', end: 'END_NOIR',
    floor: '#2a2d33', alt: '#2a2d33', pattern: 'road', home: [120, 0, 34, -0.1],
    props: [[-3.5,-5.3,4.2,2,1.3,0xa02030],[4.5,5.3,0.4,0.4,4.2,0x444444,'cyl'],[-6,5.3,0.4,0.4,4.2,0x444444,'cyl']],
    npcs: [
      { id: 'lou', name: 'Lou, Conductor', x: 1, z: -3.8, body: 0x333a4a, hat: 'cap', hatColor: 0x111111,
        lines: c => c.count === 0 ? [
          "Motor andando. Soy Lou, y sólo manejo hacia el sur, donde nadie pregunta por películas.",
          "Cruza esa puerta roja y la obra queda guardada, y tú a salvo. Es una forma de ganar, ¿no?",
          "Nadie te perseguirá en el exilio. Aunque nadie te escuchará tampoco.",
          c.talked('vicente') ? "¿Hablaste con Vicente? Él no se habría subido a mi auto." : "",
        ].filter(Boolean) : [ "Cuando quieras.", "No me hagas esperar. La lluvia no espera." ] },
    ] },

  { id: 'sky', name: 'PASARELA DEL HOTEL', start: 'ELEVATOR', end: 'BRIDGE',
    floor: '#38424f', alt: '#2f3945', pattern: 'planks', home: [56, 0, -37, 0.15],
    props: [[-6,-5,2,2,1.4,0x777f8a],[-2,5.2,2.2,2.2,1.2,0x777f8a],[5,-5,2.4,2.4,1.8,0x6b7c8f],[7,5.2,1.8,1.8,1.2,0x777f8a]],
    chaser: { name: 'Matones de Von Strudel', body: 0x7a1d3a, hat: 'beret', hatColor: 0xcc2255, speed: 3.5 },
    npcs: [
      { id: 'strudel', name: 'Von Strudel, Director Rival', x: -0.5, z: 1.2, body: 0x7a1d3a, hat: 'beret', hatColor: 0xcc2255,
        lines: c => c.count === 0 ? [
          "¡Así que tú eres Dan! Von Strudel, director. Tu rival… y tu admirador secreto.",
          "Tu película es un panfleto, un grito mal encuadrado. Entrégame la cámara y yo la haré «presentable».",
          { id: 'strudel', ask: "Dime, Dan: ¿qué tiene tu obra que la mía no?",
            options: [
              { t: "Es imperfecta, pero es verdadera. No te la doy.", v: 1, reply: ["¡Verdadera! Qué palabra tan barata. Mis matones te esperan en el puente."] },
              { t: "Quizás tengas razón…", v: -1, reply: ["Claro que la tengo. Dame esa cámara. ¡Muchachos!"] },
            ] },
        ] : [
          c.has('chasm') ? "No llegarás al estreno antes que yo." : "Sigue. El puente no se cruza solo.",
          "Mi cine siempre gana premios.",
        ] },
    ] },
];
