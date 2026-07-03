/* Configuración del libro de EJEMPLO — modo imágenes */

window.FLIPBOOK_CONFIG = {

  //█  Hojas del libro, en orden (misma proporción todas)
  paginas: [
    "hojas/01.svg", // portada con SVG animado
    "hojas/02.svg",
    "hojas/03.svg",
    "hojas/04.svg",
    "hojas/05.svg",
    "hojas/06.svg"
  ],

  fondo: "#16213E",
  portada: true,
  barra: true, // false = sin barra de navegación
  sonidoVolteo: true,

  //█  Cama musical para todo el libro (descomenta y pon tu archivo):
musica: { src: "audios/fondo-ginza_midnight-menos14db.mp3", volumen: 0.3 },

  //█  Capas de imagen dentro de las hojas (se voltean con la página)
  imagenes: [
    { pagina: 1, src: "capas/fondo-photon.svg", x: 5, y: 51, ancho: 90 },
    { pagina: 3, src: "capas/estrella.gif", x: 60, y: 52, ancho: 26 },
    { pagina: 6, src: "capas/fumar-de-la-buena.jpg", x: 7, y: 5, ancho: 86 },
    { pagina: 3, src: "capas/leo-echado-en-cama.jpg", x: 7, y: 5, ancho: 86 }
  ],

  //█  Objetos de sonido: icono de parlante posicionable (x, y),
  //█  auto o al clic; oculto: true = invisible (sin icono)
  sonidos: [
    { pagina: 2, src: "audios/solo-un-rato-mas-ya-casi-termino2.mp3",
      x: 8, y: 8, auto: true },
    { pagina: 3, src: "audios/ultimamente-me-canso-mucho-mas-rapido.mp3",
      auto: true, oculto: true }
  ],

  //█  Etiquetas de texto sobre las hojas
  textos: [
    { pagina: 2,
      texto: "Etiqueta de ejemplo: este texto es largo a propósito para mostrar cómo se reparte en varias líneas, como un párrafo.",
      x: 12, y: 62, ancho: 76,          // largo máximo de línea en % → párrafo
      tamano: 5.2,        // % del ancho de página (escala con el libro)
      alineacion: "centro",       // izquierda | centro | derecha | justificado
      fuente: "Georgia, serif", color: "#FFFFFF", cursiva: true 
      //interlineado: 1.3      // opcional
  }
  ],

  //█  Enlaces sobre las hojas
  enlaces: [
    { pagina: 5, x: 18, y: 62, autoajuste: true, tamano: 2.8,
      texto: "Abrir otra pestaña", url: "https://es.wikipedia.org" },
    { pagina: 5, x: 18, y: 72, autoajuste: true,
      texto: "Ficha en ventana emergente", popup: "fichas/ficha1.html" },
    { pagina: 5, x: 18, y: 82, autoajuste: true,
      texto: "HTML directo",
      html: "<h3>Ventana con HTML directo</h3><p>Este contenido viene del propio <code>config.js</code>, sin archivo aparte.</p>" }
  ],

  //█  Videos de YouTube
  // copiar el ID del video en YT
  // los valores x/y hacen referencia a la esquina superior izquierda del video
  // los valores ancho/alto hacen referencia al tamaño del video en valores de porcentaje
  // los valores inicio/fin hacen referencia al segundo de inicio y de finalización del video
  videos: [
    { pagina: 4, id: "dQw4w9WgXcQ", x: 35, y: 5, ancho: 60, alto: 30,
      autoplay: false, inicio: 30, fin: 35 },
    { pagina: 4, id: "c5VVmsV0Rus", x: 35, y: 55, ancho: 60, alto: 30,
      autoplay: false, inicio: 0, fin: 35 }
  ]
};
