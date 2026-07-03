/* ============================================================
   CONFIGURACIÓN DEL FLIPBOOK
   Copia la carpeta "plantilla", renómbrala para tu libro y
   edita solo este archivo. Las páginas se numeran desde 1.
   Posiciones y tamaños en % del tamaño de la página
   (x, y = esquina superior izquierda).
   ============================================================ */

window.FLIPBOOK_CONFIG = {

  /* ---------- PÁGINAS DEL LIBRO ----------
     MODO A (recomendado): lista ordenada de imágenes.
     Cada archivo es una hoja: SVG, PNG, JPG, WebP, GIF...
     Los SVG/GIF/WebP animados se animan dentro del libro.
     Todas deben tener la misma proporción (la marca la primera). */
  paginas: [
    "hojas/01-portada.svg",
    "hojas/02.png",
    "hojas/03.gif",
    "hojas/04.svg"
  ],

  /* MODO B: un PDF (se usa solo si no defines "paginas") */
  // pdf: "documento.pdf",
  // calidad: 2, // nitidez del render del PDF (1-3)

  // Color de fondo del visor
  fondo: "#16213E",

  // Mostrar la primera página sola, como portada
  portada: true,

  // Barra de navegación (silencio, páginas, zoom):
  //   true  → visible (con botón ▾ para ocultarla/mostrarla)
  //   false → sin barra (los gestos de zoom y volteo siguen funcionando)
  barra: true,

  // Sonido al voltear página:
  //   true → papel sintetizado | "ruta.mp3" → archivo propio | false → sin sonido
  sonidoVolteo: true,

  // La interfaz carga con el botón 🔊 muteado (recomendado por los
  // navegadores). Pon false para intentar arrancar con sonido.
  // empezarSilenciado: true,

  /* ---------- CAMA MUSICAL ----------
     Música de fondo para todo el libro.
       src     : archivo de audio
       volumen : 0 a 1 (por defecto 0.35)
       bucle   : true → se repite sin fin (por defecto) | false → suena una vez
     La cama musical se aparta sola cuando se reproduce un video o un
     audio de página, y se retoma desde el principio cuando terminan.
     Forma corta:  musica: "audios/fondo.mp3" */
  // musica: { src: "audios/fondo.mp3", volumen: 0.3, bucle: true },

  /* ---------- CAPAS DE IMAGEN SOBRE LAS HOJAS ----------
     Cuantas quieras, en cualquier formato (GIF y SVG/WebP animados
     incluidos). Se doblan y voltean JUNTO con la página.
       pagina, src, x, y, ancho (alto opcional: se calcula solo)
       sonido : ruta de audio → la imagen suena al hacerle clic
       bucle  : true → su sonido se repite
       auto   : true → su sonido arranca al mostrar la página      */
  imagenes: [
    // { pagina: 3, src: "capas/mariposa.gif", x: 62, y: 8, ancho: 25 },
    // { pagina: 5, src: "capas/campana.svg", x: 10, y: 70, ancho: 15,
    //   sonido: "audios/campana.mp3" }
  ],

  /* ---------- OBJETOS DE SONIDO ----------
     Varios por página si hace falta.
       pagina, src
       x, y   : posición del icono de parlante (en % de la página)
       auto   : true → se reproduce al mostrar la página
                (si hay varios en el pliego, suenan en cola, en orden)
       bucle  : true → se repite (los bucle+auto suenan en paralelo)
       oculto : true → sin icono, invisible (p. ej. sonido ambiental
                o un audio tapado por una imagen)                    */
  sonidos: [
    // { pagina: 2, src: "audios/narracion.mp3", x: 6, y: 6, auto: true },
    // { pagina: 3, src: "audios/ambiente.mp3", auto: true, oculto: true, bucle: true }
  ],

  /* ---------- ETIQUETAS DE TEXTO ----------
       pagina, texto (usa \n para saltos de línea manuales)
       x, y        : posición (%)
       ancho       : largo máximo de línea (%): el texto largo se
                     reparte en varias líneas, como un párrafo
       tamano      : tamaño de letra en % del ancho de página
       fuente      : familia tipográfica CSS ("Georgia, serif", etc.)
       color       : color CSS ("#C9A84C", "white"...)
       negrita, cursiva : true / false
       alineacion  : "izquierda" | "centro" | "derecha" | "justificado"
       interlineado: 1.3 por defecto                                  */
  textos: [
    // { pagina: 2, texto: "Un texto largo que se distribuye en varias líneas.",
    //   x: 10, y: 60, ancho: 80, tamano: 3.5, fuente: "Georgia, serif",
    //   color: "#16213E", negrita: false, cursiva: true, alineacion: "centro" }
  ],

  /* ---------- ENLACES SOBRE LAS HOJAS ----------
       pagina, x, y, ancho, alto
       texto      : rótulo visible (sin texto = zona invisible clicable)
       autoajuste : true → ignora "ancho": el botón se ajusta
                    horizontalmente al largo de su texto
       tamano     : tamaño de letra del rótulo, en % del ancho de página
       url   : abre en otra pestaña
       popup : ruta o URL en ventana emergente sobre el libro
               (la ventana ajusta su ALTO al contenido, con tope y scroll)
       html  : contenido HTML directo en la ventana emergente        */
  enlaces: [
    // { pagina: 4, x: 10, y: 82, texto: "Más información",
    //   autoajuste: true, url: "https://ejemplo.com" },
    // { pagina: 5, x: 55, y: 75, ancho: 30, alto: 9,
    //   texto: "Ver ficha", popup: "fichas/ficha1.html" },
    // { pagina: 6, x: 20, y: 30, ancho: 50, alto: 30,
    //   html: "<h3>Título</h3><p>Contenido con <strong>HTML</strong>.</p>" }
  ],

  /* ---------- VIDEOS DE YOUTUBE ----------
       pagina, id (lo que va tras watch?v=), x, y, ancho, alto
       autoplay : true → arranca al mostrar la página (se pausa al salir)
       inicio / fin : segundos de comienzo y parada (opcionales)     */
  videos: [
    // { pagina: 4, id: "dQw4w9WgXcQ", x: 10, y: 55, ancho: 50, alto: 40,
    //   autoplay: true, inicio: 30, fin: 90 }
  ]

  /* (Compatibilidad) El formato antiguo audios: { 2: "a.mp3" } sigue
     funcionando, pero "sonidos" lo reemplaza con más control. */
};
