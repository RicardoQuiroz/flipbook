# Flipbook para GitHub Pages

>Para probarlo en tu PC, sirve la carpeta por HTTP en vez de abrir el archivo directamente. En una terminal:<br><br>
>cd D:\Git\flipbook<br>
>python -m http.server 8000<br><br>
>y abre http://localhost:8000 (el ejemplo estará en http://localhost:8000/ejemplo/). Si usas VS Code, la extensión "Live Server" hace lo mismo con un clic.<br>
>En GitHub Pages funcionará sin nada de esto, porque ya se sirve por HTTPS.

Visor con efecto de volteo de página (estilo Heyzine), hecho solo con HTML, CSS y JS. El libro puede construirse desde una **lista de imágenes** (SVG, GIF, PNG, WebP — los formatos animados se animan) o desde un **PDF**. Soporta capas de imagen animadas dentro de las hojas, objetos de sonido posicionables (varios por página), cama musical, enlaces con ventana emergente HTML, videos de YouTube, zoom por gestos y barra de navegación opcional. Diseñado para incrustarse en un iframe.

## Estructura del repositorio

| Carpeta | Qué es |
|---|---|
| `visor/` | **Código único del visor** (`flipbook.js` + `flipbook.css`). Una corrección aquí llega a todos los libros al instante. No necesitas editarlo. |
| `plantilla/` | Punto de partida para cada libro nuevo: `index.html` (apunta a `../visor/`) y `config.js` documentado. |
| `ejemplo/` | Un libro completo funcionando, para consultar. |
| Cada libro | Su carpeta con `index.html`, `config.js` y sus recursos (hojas, audios, capas, fichas). |

## Árbol hierático

flipbook/
├── visor/            ← código ÚNICO (flipbook.js + flipbook.css)
├── plantilla/        ← para copiar por cada libro nuevo
│   ├── index.html    (apunta a ../visor/)
│   └── config.js     (documentado, listo para editar)
├── ejemplo/          ← tu libro de prueba (ya apunta a ../visor/)
│   ├── index.html, config.js
│   └── hojas/, audios/, capas/, fichas/
├── README.md
└── demo-incrustacion.html

Las librerías pdf.js y page-flip llegan por CDN (cdnjs/jsdelivr), así que no hay nada que instalar.

## Cómo publicar un nuevo libro

1. Copia la carpeta `plantilla/` y renómbrala, p. ej. `mi-libro/`.
2. Mete dentro tus recursos: `hojas/` (imágenes de las páginas), `audios/`, `capas/`, `fichas/`...
3. Edita su `config.js`: lista de páginas, sonidos, videos, enlaces, textos.
4. Haz commit y push. Quedará en:
   `https://TU-USUARIO.github.io/TU-REPO/mi-libro/`

Importante: la carpeta del libro debe estar **al lado de `visor/`** (mismo nivel), porque su `index.html` usa la ruta relativa `../visor/`. Si la anidas más profundo, ajusta esa ruta (o usa la URL absoluta de GitHub Pages, p. ej. `https://TU-USUARIO.github.io/TU-REPO/visor/flipbook.js`).

## Configuración (`config.js`)

Posiciones y tamaños siempre en % de la página; las páginas se numeran desde 1. El `config.js` de la raíz está completamente comentado como referencia.

```js
window.FLIPBOOK_CONFIG = {
  // MODO A (recomendado): hojas desde imágenes, en orden.
  // SVG/GIF/WebP animados se animan dentro del libro.
  paginas: ["hojas/01.svg", "hojas/02.gif", "hojas/03.png"],

  // MODO B: un PDF (solo si no defines "paginas")
  // pdf: "documento.pdf", calidad: 2,

  fondo: "#16213E",
  portada: true,          // primera página sola, como portada
  barra: true,            // false = sin barra de navegación
  sonidoVolteo: true,     // true | "archivo.mp3" | false

  // Cama musical para todo el libro (bucle: false = suena una vez)
  musica: { src: "audios/fondo.mp3", volumen: 0.3, bucle: true },

  // Etiquetas de texto sobre las hojas. "ancho" = largo máximo de
  // línea (%): el texto largo se reparte en varias líneas. "tamano"
  // en % del ancho de página; escala con el libro.
  textos: [
    { pagina: 2, texto: "Texto de ejemplo", x: 10, y: 60, ancho: 80,
      tamano: 3.5, fuente: "Georgia, serif", color: "#16213E",
      negrita: true, cursiva: false, alineacion: "centro" }
  ],

  // Capas de imagen DENTRO de las hojas (se doblan y voltean con la página);
  // cuantas quieras, formatos animados incluidos. Con "sonido", la imagen
  // reproduce/pausa su audio al hacerle clic.
  imagenes: [
    { pagina: 3, src: "capas/mariposa.gif", x: 62, y: 8, ancho: 25 },
    { pagina: 5, src: "capas/campana.svg", x: 10, y: 70, ancho: 15,
      sonido: "audios/campana.mp3" }
  ],

  // Objetos de sonido: varios por página. Icono de parlante posicionable
  // (x, y), "auto" arranca al mostrar la página (varios en un pliego
  // suenan en cola), "bucle" repite, "oculto" lo hace invisible.
  sonidos: [
    { pagina: 2, src: "audios/narracion.mp3", x: 6, y: 6, auto: true },
    { pagina: 2, src: "audios/ambiente.mp3", auto: true, bucle: true, oculto: true }
  ],

  // Enlaces sobre las hojas: "url" abre otra pestaña; "popup" abre un
  // archivo/URL en ventana emergente sobre el libro; "html" muestra ese
  // HTML en la ventana. Sin "texto" el enlace es una zona invisible.
  // "autoajuste: true" hace que el ancho del botón lo defina su texto;
  // "tamano" controla la letra del rótulo (% del ancho de página).
  // La ventana emergente ajusta su alto al contenido (tope 82% + scroll).
  enlaces: [
    { pagina: 4, x: 10, y: 82, texto: "Más info", autoajuste: true, url: "https://..." },
    { pagina: 5, x: 55, y: 75, ancho: 30, alto: 9, texto: "Ficha", popup: "fichas/f1.html" },
    { pagina: 6, x: 20, y: 30, ancho: 50, alto: 30, html: "<h3>Hola</h3>" }
  ],

  // Videos de YouTube (id = lo que va tras watch?v=)
  videos: [
    { pagina: 4, id: "dQw4w9WgXcQ", x: 10, y: 55, ancho: 80, alto: 40,
      autoplay: true, inicio: 30, fin: 90 }
  ]
};
```

Notas: los sonidos automáticos de un mismo pliego suenan en cola (izquierda → derecha); los que están en `bucle` suenan en paralelo. Todos los sonidos de un objeto se detienen al dejar de mostrarse su página. Cuando un video de YouTube empieza a reproducirse, todos los demás sonidos se silencian; y la cama musical también se aparta mientras suena cualquier audio de página. En ambos casos, la música se retoma desde el inicio cuando el video o los audios terminan. La interfaz carga muteada — el visitante activa el sonido con el 🔊 de la barra (`empezarSilenciado: false` para intentar arrancar con sonido). El botón 🔊 silencia todo, incluida la música y los videos. El formato antiguo `audios: { 2: "a.mp3" }` sigue funcionando.

## Incrustar en otra página (iframe)

```html
<iframe
  src="https://TU-USUARIO.github.io/TU-REPO/mi-libro/"
  width="100%" height="600" style="border:0;"
  allow="autoplay; encrypted-media; picture-in-picture"
  allowfullscreen>
</iframe>
```

## Barra de navegación y zoom

La barra inferior incluye: 🔊 silenciar/activar todos los sonidos (volteo, audios de página y videos), ⏮ primera página, ◀ anterior, ▶ siguiente, ⏭ última, y − / ＋ de zoom. El botón ▾ de la esquina la oculta o muestra. Para publicar un libro sin barra, pon `barra: false` en `config.js` (los gestos siguen funcionando).

Zoom por gestos: doble clic o doble tap amplía hacia ese punto (y doble clic de nuevo sale); pellizco con dos dedos en táctil; Ctrl+rueda del ratón; estando ampliado se panea arrastrando (o con las flechas del teclado) y se sale con Esc. Las esquinas del libro quedan reservadas para voltear página.

## Navegación

Se pasa de página arrastrando las esquinas, haciendo clic en los bordes, deslizando en pantallas táctiles, con las flechas ← → del teclado, o con los botones de la barra.

## Nota sobre el audio automático

Los navegadores bloquean el audio hasta que el usuario interactúa con la página. Si el audio de la primera página queda bloqueado, aparece un icono 🔊 discreto; con un solo toque en cualquier parte, el audio se activa. A partir de ahí, todo se reproduce automáticamente al voltear.

## Ejemplo

La carpeta `ejemplo/` contiene un libro de prueba funcionando: ábrelo en
`https://TU-USUARIO.github.io/TU-REPO/ejemplo/`.
