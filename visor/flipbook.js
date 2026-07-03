/* ============================================================
   FLIPBOOK — visor con efecto de volteo de página
   Páginas desde imágenes (SVG/GIF/PNG/WebP/JPG) o desde PDF.
   Capas de imagen animadas, sonidos por objeto, cama musical,
   enlaces con ventana emergente, videos de YouTube, zoom y barra.
   Requiere: page-flip (StPageFlip), config.js y pdf.js (solo modo PDF)
   ============================================================ */

(function () {
  "use strict";

  var CFG = window.FLIPBOOK_CONFIG || {};
  var MODO_IMAGENES = !!(CFG.paginas && CFG.paginas.length);
  var PDF_URL = CFG.pdf || "documento.pdf";
  var CALIDAD = CFG.calidad || 2;
  var PORTADA = CFG.portada !== false;

  var visor = document.getElementById("visor");
  var libroEl = document.getElementById("libro");
  var capaVideos = document.getElementById("capa-videos");
  var avisoAudio = document.getElementById("aviso-audio");
  var cargandoEl = document.getElementById("cargando");

  var pageFlip = null;
  var paginasHTML = [];     // divs de cada página
  var numPaginas = 0;
  var ratioPagina = 1.414;  // alto / ancho (se recalcula al cargar)
  var modoActual = "";      // "landscape" | "portrait"
  var interactuado = false; // si el usuario ya tocó/clicó (para autoplay)

  document.body.style.background = CFG.fondo || "#16213E";

  /* ==================== SONIDO DE VOLTEO ==================== */

  var audioCtx = null;
  var audioVolteo = null; // HTMLAudio si se usa archivo propio

  if (typeof CFG.sonidoVolteo === "string") {
    audioVolteo = new Audio(CFG.sonidoVolteo);
    audioVolteo.preload = "auto";
  }

  function obtenerCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  // Sonido de papel sintetizado (no requiere archivo mp3)
  var bufferPapel = null;
  var DUR_PAPEL = 0.38;

  function crearBufferPapel(ctx) {
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * DUR_PAPEL), ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) {
      var t = i / d.length;
      // roce continuo + chasquido final
      var env = Math.pow(Math.sin(Math.PI * t), 1.5) * 0.5;
      if (t > 0.82) env += (t - 0.82) * 5 * Math.exp(-(t - 0.82) * 22);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    return buf;
  }

  function sonidoPapel() {
    var ctx = obtenerCtx();
    if (!ctx) return;

    var tocar = function () {
      if (!bufferPapel) bufferPapel = crearBufferPapel(ctx);
      var src = ctx.createBufferSource();
      src.buffer = bufferPapel;
      var filtro = ctx.createBiquadFilter();
      filtro.type = "bandpass";
      filtro.Q.value = 0.8;
      filtro.frequency.setValueAtTime(500, ctx.currentTime);
      filtro.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + DUR_PAPEL * 0.8);
      var gain = ctx.createGain();
      gain.gain.value = 0.55;
      src.connect(filtro).connect(gain).connect(ctx.destination);
      src.start();
    };

    if (ctx.state === "running") tocar();
    else ctx.resume().then(tocar).catch(function () {});
  }

  function reproducirVolteo() {
    if (CFG.sonidoVolteo === false || silenciado) return;
    if (audioVolteo) {
      audioVolteo.currentTime = 0;
      audioVolteo.play().catch(function () {});
    } else {
      sonidoPapel();
    }
  }

  /* ==================== SONIDOS ====================
     Tres niveles:
     1. musica       → cama musical en bucle para todo el libro
     2. sonidos[]    → objetos de sonido dentro de una página (varios
                       por página, con botón o invisibles, auto o al clic)
     3. audios{}     → (compatibilidad) un audio por página            */

  // --- Cama musical ---
  var musica = null;
  if (CFG.musica) {
    var cfgM = typeof CFG.musica === "string" ? { src: CFG.musica } : CFG.musica;
    musica = new Audio(cfgM.src);
    musica.loop = cfgM.bucle !== false;
    musica.volume = cfgM.volumen != null ? cfgM.volumen : 0.35;
    musica.preload = "auto";
  }

  function iniciarMusica() {
    if (!musica || silenciado || !musica.paused) return;
    var p = musica.play();
    if (p) p.catch(function () {
      if (!interactuado) avisoAudio.classList.add("visible");
    });
  }

  // --- Compatibilidad: un audio por página (config "audios") ---
  var audiosPagina = {}; // numPagina(1-based) -> HTMLAudio

  function audioDePagina(n) {
    var mapa = CFG.audios || {};
    if (!mapa[n]) return null;
    if (!audiosPagina[n]) {
      audiosPagina[n] = new Audio(mapa[n]);
      audiosPagina[n].preload = "auto";
      audiosPagina[n].muted = silenciado;
      audiosPagina[n].addEventListener("play", alAudioEmpezar);
      audiosPagina[n].addEventListener("pause", alAudioTerminar);
    }
    return audiosPagina[n];
  }

  // --- Objetos de sonido (botones 🔈 e imágenes con sonido) ---
  var objetosSonido = []; // { audio, pagina, elemento|null, auto, bucle }

  function crearObjetoSonido(pagina, src, opciones) {
    var o = {
      audio: new Audio(src),
      pagina: pagina,
      elemento: null,
      auto: !!opciones.auto,
      bucle: !!opciones.bucle
    };
    o.audio.preload = "auto";
    o.audio.loop = o.bucle;
    o.audio.muted = silenciado;
    o.audio.addEventListener("ended", function () {
      if (o.elemento) o.elemento.classList.remove("sonando");
    });
    // la cama musical se aparta mientras suene este audio
    o.audio.addEventListener("play", alAudioEmpezar);
    o.audio.addEventListener("pause", alAudioTerminar);
    objetosSonido.push(o);
    return o;
  }

  // --- La cama musical cede ante los audios de página (igual que con videos) ---
  var timerMusicaVuelve = null;

  function hayAudioDePaginaSonando() {
    if (objetosSonido.some(function (o) { return !o.audio.paused; })) return true;
    return Object.keys(audiosPagina).some(function (n) {
      return !audiosPagina[n].paused;
    });
  }

  function alAudioEmpezar() {
    clearTimeout(timerMusicaVuelve);
    if (musica && !musica.paused) {
      musicaPendiente = true;
      musica.pause();
    }
  }

  function alAudioTerminar() {
    // pequeño respiro: en las colas un audio termina y el siguiente
    // empieza enseguida; no queremos que la música parpadee entre ambos
    clearTimeout(timerMusicaVuelve);
    timerMusicaVuelve = setTimeout(function () {
      if (hayVideoSonando() || hayAudioDePaginaSonando()) return;
      if (musicaPendiente && musica) {
        musicaPendiente = false;
        musica.currentTime = 0; // continúa desde el principio
        iniciarMusica();
      }
    }, 300);
  }

  function alternarObjeto(o) {
    if (o.audio.paused) {
      var p = o.audio.play();
      if (o.elemento) o.elemento.classList.add("sonando");
      if (p) p.catch(function () {
        if (!interactuado) avisoAudio.classList.add("visible");
      });
    } else {
      o.audio.pause();
      if (o.elemento) o.elemento.classList.remove("sonando");
    }
  }

  // Si varias fuentes automáticas coinciden en un pliego, se reproducen
  // en COLA (orden de lectura). Las que están en bucle suenan en paralelo.
  var generacionAudio = 0; // invalida colas anteriores al cambiar de pliego

  function actualizarAudios(visibles) {
    generacionAudio++;
    var gen = generacionAudio;
    var vis = {};
    visibles.forEach(function (i) { vis[i + 1] = true; });

    // pausar los audios por página (compatibilidad)
    Object.keys(audiosPagina).forEach(function (n) {
      audiosPagina[n].onended = null;
      audiosPagina[n].pause();
    });

    // pausar y rebobinar los objetos que ya no se muestran
    objetosSonido.forEach(function (o) {
      if (!vis[o.pagina]) {
        o.audio.pause();
        o.audio.currentTime = 0;
        if (o.elemento) o.elemento.classList.remove("sonando");
      }
    });

    // cola de reproducción en orden de lectura
    var cola = [];
    visibles.slice().sort(function (a, b) { return a - b; })
      .forEach(function (i) {
        var a = audioDePagina(i + 1);
        if (a) cola.push({ audio: a, elemento: null });
        objetosSonido.forEach(function (o) {
          if (o.pagina !== i + 1 || !o.auto) return;
          if (o.bucle) {
            // ambiente en bucle: suena en paralelo, no bloquea la cola
            o.audio.currentTime = 0;
            var p = o.audio.play();
            if (o.elemento) o.elemento.classList.add("sonando");
            if (p) p.catch(function () {
              if (!interactuado) avisoAudio.classList.add("visible");
            });
          } else {
            cola.push({ audio: o.audio, elemento: o.elemento });
          }
        });
      });

    reproducirCola(cola, 0, gen);
  }

  function reproducirCola(cola, pos, gen) {
    if (gen !== generacionAudio || pos >= cola.length) return;
    var item = cola[pos];
    var a = item.audio;
    a.currentTime = 0;
    a.onended = function () {
      a.onended = null;
      if (item.elemento) item.elemento.classList.remove("sonando");
      reproducirCola(cola, pos + 1, gen); // siguiente audio del pliego
    };
    if (item.elemento) item.elemento.classList.add("sonando");
    var p = a.play();
    if (p) p.catch(function () {
      // autoplay bloqueado: pedir un toque del usuario
      if (!interactuado) avisoAudio.classList.add("visible");
    });
  }

  // Primer toque/clic: desbloquea audio
  function alInteractuar() {
    if (interactuado) return;
    interactuado = true;
    avisoAudio.classList.remove("visible");
    obtenerCtx();
    if (!silenciado) iniciarMusica();
    if (pageFlip) actualizarAudios(paginasVisibles());
  }
  document.addEventListener("pointerdown", alInteractuar, { capture: true });
  avisoAudio.addEventListener("click", alInteractuar);

  /* ==================== VIDEOS DE YOUTUBE ==================== */

  // Cada video acepta en config.js:
  //   autoplay : true → se reproduce solo al mostrar su página (se pausa al salir)
  //   inicio   : segundo donde empieza el video
  //   fin      : segundo donde se detiene
  var videos = [];        // { cfg, div, player, listo, mostrando }
  var ytApiPedida = false;

  function prepararVideos() {
    var lista = CFG.videos || [];
    if (!lista.length) return;

    lista.forEach(function (v, idx) {
      var div = document.createElement("div");
      div.className = "video-yt";
      var inner = document.createElement("div");
      inner.id = "yt-player-" + idx;
      div.appendChild(inner);
      capaVideos.appendChild(div);
      videos.push({ cfg: v, div: div, player: null, listo: false, mostrando: false });
    });

    if (!ytApiPedida) {
      ytApiPedida = true;
      var tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  }

  window.onYouTubeIframeAPIReady = function () {
    videos.forEach(function (v, idx) {
      // start/end aplican cuando el usuario pulsa play (videos sin autoplay)
      var vars = { rel: 0, modestbranding: 1, playsinline: 1 };
      if (v.cfg.inicio != null) vars.start = Math.floor(v.cfg.inicio);
      if (v.cfg.fin != null) vars.end = Math.ceil(v.cfg.fin);

      v.player = new YT.Player("yt-player-" + idx, {
        videoId: v.cfg.id,
        playerVars: vars,
        events: {
          onReady: function () {
            v.listo = true;
            if (silenciado) { try { v.player.mute(); } catch (er) {} }
            // si su página ya estaba visible cuando la API terminó de cargar
            if (v.mostrando && v.cfg.autoplay) autoreproducirVideo(v);
          },
          onStateChange: function (ev) {
            if (!window.YT) return;
            if (ev.data === YT.PlayerState.PLAYING) alVideoEmpezar();
            else if (ev.data === YT.PlayerState.ENDED ||
                     ev.data === YT.PlayerState.PAUSED) alVideoTerminar();
          }
        }
      });
    });
  };

  // Reproduce desde "inicio" y se detiene en "fin" (si están definidos)
  function autoreproducirVideo(v) {
    if (!v.listo || !v.player) return;
    v.player.loadVideoById({
      videoId: v.cfg.id,
      startSeconds: v.cfg.inicio != null ? v.cfg.inicio : 0,
      endSeconds: v.cfg.fin != null ? v.cfg.fin : undefined
    });
    if (silenciado) { try { v.player.mute(); } catch (e) {} }
  }

  function actualizarVideos(visibles) {
    var vis = {};
    visibles.forEach(function (i) { vis[i + 1] = true; });

    videos.forEach(function (v) {
      var mostrar = !!vis[v.cfg.pagina];
      if (mostrar) {
        var r = rectDePagina(v.cfg.pagina - 1);
        if (r) {
          v.div.style.left = (r.x + r.w * (v.cfg.x || 0) / 100) + "px";
          v.div.style.top = (r.y + r.h * (v.cfg.y || 0) / 100) + "px";
          v.div.style.width = (r.w * (v.cfg.ancho || 50) / 100) + "px";
          v.div.style.height = (r.h * (v.cfg.alto || 30) / 100) + "px";
          v.div.classList.add("visible");
          // autoplay solo al ENTRAR a la página (no en reposicionamientos)
          if (!v.mostrando && v.cfg.autoplay) autoreproducirVideo(v);
          v.mostrando = true;
        }
      } else {
        v.div.classList.remove("visible");
        v.mostrando = false;
        if (v.listo && v.player && typeof v.player.pauseVideo === "function") {
          v.player.pauseVideo(); // se silencia al dejar de mostrar la página
        }
      }
    });
  }

  function ocultarVideos() {
    videos.forEach(function (v) { v.div.classList.remove("visible"); });
  }

  // --- Un video en reproducción silencia todo lo demás ---
  var musicaPendiente = false; // la cama musical se retoma al terminar el video

  function hayVideoSonando() {
    return videos.some(function (v) {
      return v.listo && v.player &&
        typeof v.player.getPlayerState === "function" &&
        v.player.getPlayerState() === 1; // 1 = reproduciendo
    });
  }

  function alVideoEmpezar() {
    generacionAudio++; // cancela colas de audio pendientes
    Object.keys(audiosPagina).forEach(function (n) {
      audiosPagina[n].onended = null;
      audiosPagina[n].pause();
    });
    objetosSonido.forEach(function (o) {
      o.audio.pause();
      if (o.elemento) o.elemento.classList.remove("sonando");
    });
    if (musica && !musica.paused) {
      musicaPendiente = true;
      musica.pause();
    }
  }

  function alVideoTerminar() {
    if (hayVideoSonando()) return;          // aún suena otro video
    if (hayAudioDePaginaSonando()) return;  // aún suena un audio de página
    if (musicaPendiente && musica) {
      musicaPendiente = false;
      musica.currentTime = 0; // vuelve a empezar, no importa
      iniciarMusica();
    }
  }

  /* ==================== PÁGINAS VISIBLES ==================== */

  function paginasVisibles() {
    if (!pageFlip) return [];
    var idx = pageFlip.getCurrentPageIndex();
    var orient = pageFlip.getOrientation(); // "portrait" | "landscape"
    var res = [];
    if (orient === "portrait") {
      res = [idx];
    } else if (PORTADA && idx === 0) {
      res = [0];
    } else {
      res = [idx, idx + 1];
    }
    return res.filter(function (i) { return i >= 0 && i < numPaginas; });
  }

  // Rectángulo (relativo al visor) que ocupa la página idx en pantalla
  function rectDePagina(idx) {
    var bloque = libroEl.querySelector(".stf__block");
    if (!bloque) return null;
    var rb = bloque.getBoundingClientRect();
    var rv = visor.getBoundingClientRect();
    var x = rb.left - rv.left;
    var y = rb.top - rv.top;

    if (pageFlip.getOrientation() === "portrait") {
      return { x: x, y: y, w: rb.width, h: rb.height };
    }
    var mitad = rb.width / 2;
    // Con portada: impares a la izquierda, pares a la derecha (0-based)
    // Sin portada: pares a la izquierda, impares a la derecha
    var izquierda = PORTADA ? (idx % 2 === 1) : (idx % 2 === 0);
    return { x: izquierda ? x : x + mitad, y: y, w: mitad, h: rb.height };
  }

  function refrescarCapas() {
    var vis = paginasVisibles();
    actualizarVideos(vis);
  }

  /* ==================== CARGA DE PÁGINAS ==================== */

  // --- Modo A: libro desde una lista de imágenes (SVG, GIF, PNG, WebP...) ---
  function cargarImagenes() {
    var lista = CFG.paginas;
    numPaginas = lista.length;
    return Promise.all(lista.map(function (src) {
      return new Promise(function (resolver) {
        var img = new Image();
        img.onload = function () { resolver({ img: img, src: src }); };
        img.onerror = function () { resolver({ img: null, src: src }); };
        img.src = src;
      });
    })).then(function (cargadas) {
      var primera = null;
      for (var i = 0; i < cargadas.length; i++) {
        if (cargadas[i].img) { primera = cargadas[i].img; break; }
      }
      if (primera && primera.naturalWidth > 0) {
        ratioPagina = primera.naturalHeight / primera.naturalWidth;
      }
      cargadas.forEach(function (c, i) {
        var div = document.createElement("div");
        div.className = "pagina";
        if (c.img) {
          c.img.className = "pagina-img";
          c.img.draggable = false;
          div.appendChild(c.img);
        } else {
          div.innerHTML =
            '<div class="pagina-error">No se pudo cargar<br><strong>' +
            c.src + "</strong><br><small>página " + (i + 1) + "</small></div>";
        }
        paginasHTML.push(div);
      });
    });
  }

  // --- Modo B: libro desde un PDF (pdf.js) ---
  function cargarPDF() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return pdfjsLib.getDocument(PDF_URL).promise.then(function (pdf) {
      numPaginas = pdf.numPages;
      var cadena = Promise.resolve();
      for (var n = 1; n <= numPaginas; n++) {
        (function (num) {
          cadena = cadena.then(function () { return renderizarPagina(pdf, num); });
        })(n);
      }
      return cadena;
    });
  }

  function renderizarPagina(pdf, num) {
    return pdf.getPage(num).then(function (page) {
      var vp = page.getViewport({ scale: CALIDAD });
      if (num === 1) ratioPagina = vp.height / vp.width;

      var canvas = document.createElement("canvas");
      canvas.className = "pagina-canvas";
      canvas.width = vp.width;
      canvas.height = vp.height;

      var div = document.createElement("div");
      div.className = "pagina";
      // Nota: no usamos data-density="hard" (tapas rígidas) porque en modo
      // HTML rompe la animación de volteo de la primera y última página.
      div.appendChild(canvas);
      paginasHTML.push(div);

      return page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: vp
      }).promise;
    });
  }

  /* ==================== OBJETOS SOBRE LAS PÁGINAS ====================
     Se insertan DENTRO de cada hoja, así que se doblan y voltean con
     ella (y un GIF/SVG animado sigue animándose durante el volteo).   */

  var ICONO_PARLANTE =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1-3.29-2.5-4.03v8.05' +
    'c1.5-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71' +
    's-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';

  // Evita que StPageFlip interprete el clic sobre un objeto como volteo
  function aislarDeVolteo(el) {
    ["mousedown", "touchstart"].forEach(function (ev) {
      el.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
  }

  function posicionar(el, c) {
    el.style.left = (c.x || 0) + "%";
    el.style.top = (c.y || 0) + "%";
    if (c.ancho != null) el.style.width = c.ancho + "%";
    if (c.alto != null) el.style.height = c.alto + "%";
  }

  function decorarPaginas() {
    // --- Capas de imagen (GIF, SVG animado, WebP, APNG, PNG...) ---
    (CFG.imagenes || []).forEach(function (c) {
      var div = paginasHTML[c.pagina - 1];
      if (!div) return;
      var img = document.createElement("img");
      img.className = "imagen-capa";
      img.src = c.src;
      img.draggable = false;
      posicionar(img, c);
      if (c.sonido) {
        // imagen con sonido: clic para reproducir/pausar
        var o = crearObjetoSonido(c.pagina, c.sonido, { auto: c.auto, bucle: c.bucle });
        o.elemento = img;
        img.classList.add("con-sonido");
        img.title = "Clic para escuchar";
        aislarDeVolteo(img);
        img.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          alternarObjeto(o);
        });
      } else {
        img.classList.add("decorativa");
      }
      div.appendChild(img);
    });

    // --- Objetos de sonido (botón 🔈 o invisibles) ---
    (CFG.sonidos || []).forEach(function (c) {
      var div = paginasHTML[c.pagina - 1];
      if (!div) return;
      var o = crearObjetoSonido(c.pagina, c.src, { auto: c.auto, bucle: c.bucle });
      if (c.oculto) return; // sin botón: solo suena (normalmente con auto: true)
      var btn = document.createElement("button");
      btn.className = "sonido-btn";
      btn.innerHTML = ICONO_PARLANTE;
      btn.title = "Reproducir sonido";
      btn.style.left = (c.x != null ? c.x : 5) + "%";
      btn.style.top = (c.y != null ? c.y : 5) + "%";
      o.elemento = btn;
      aislarDeVolteo(btn);
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        alternarObjeto(o);
      });
      div.appendChild(btn);
    });

    // --- Enlaces sobre la página ---
    (CFG.enlaces || []).forEach(function (c) {
      var div = paginasHTML[c.pagina - 1];
      if (!div) return;
      var a = document.createElement("a");
      a.className = "enlace-pagina " + (c.texto ? "con-texto" : "hotspot");
      if (c.texto) a.textContent = c.texto;
      if (c.autoajuste) {
        // autoajuste: el ancho del botón lo define su propio texto
        posicionar(a, { x: c.x, y: c.y, alto: c.alto });
        a.classList.add("autoajuste");
      } else {
        posicionar(a, c);
      }
      if (c.tamano != null) a.style.fontSize = c.tamano + "cqw";
      aislarDeVolteo(a);
      if (c.html || c.popup) {
        // ventana emergente sobre el libro
        a.href = "#";
        a.title = c.texto || "Abrir";
        a.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          abrirPopup(c);
        });
      } else if (c.url) {
        // otra pestaña
        a.href = c.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.title = c.texto || c.url;
      }
      div.appendChild(a);
    });

    // --- Etiquetas de texto sobre la página ---
    // pagina, texto, x, y | ancho: largo máximo de línea (%; el texto
    // se reparte en varias líneas como párrafo) | tamano: % del ancho
    // de página | fuente, color, negrita, cursiva, interlineado |
    // alineacion: "izquierda" | "centro" | "derecha" | "justificado"
    (CFG.textos || []).forEach(function (c) {
      var div = paginasHTML[c.pagina - 1];
      if (!div) return;
      var t = document.createElement("div");
      t.className = "texto-capa";
      t.textContent = c.texto || "";
      t.style.left = (c.x || 0) + "%";
      t.style.top = (c.y || 0) + "%";
      if (c.ancho != null) t.style.width = c.ancho + "%";
      else t.style.maxWidth = (100 - (c.x || 0)) + "%";
      t.style.fontSize = (c.tamano != null ? c.tamano : 3) + "cqw";
      if (c.fuente) t.style.fontFamily = c.fuente;
      if (c.color) t.style.color = c.color;
      if (c.negrita) t.style.fontWeight = "bold";
      if (c.cursiva) t.style.fontStyle = "italic";
      if (c.interlineado) t.style.lineHeight = String(c.interlineado);
      var al = {
        izquierda: "left", centro: "center", derecha: "right",
        justificado: "justify", left: "left", center: "center",
        right: "right", justify: "justify"
      }[c.alineacion];
      if (al) t.style.textAlign = al;
      div.appendChild(t);
    });
  }

  /* ==================== VENTANA EMERGENTE (popup) ==================== */

  var popupEl = document.getElementById("popup");
  var popupContenido = document.getElementById("popup-contenido");
  var popupCerrar = document.getElementById("popup-cerrar");

  // c.html  → HTML directo dentro de la ventana
  // c.popup → ruta o URL que se abre en un iframe dentro de la ventana
  function abrirPopup(c) {
    if (!popupEl || !popupContenido) return;
    popupContenido.innerHTML = "";
    if (c.html) {
      var caja = document.createElement("div");
      caja.className = "popup-html";
      caja.innerHTML = c.html;
      popupContenido.appendChild(caja);
    } else if (c.popup) {
      var frame = document.createElement("iframe");
      frame.src = c.popup;
      frame.setAttribute("allowfullscreen", "");
      frame.style.height = "60vh"; // alto de arranque
      frame.addEventListener("load", function () {
        // si el contenido es del mismo dominio, ajustamos el alto a su medida
        try {
          var doc = frame.contentDocument || frame.contentWindow.document;
          if (!doc || !doc.documentElement) return;
          // colapsar antes de medir: con el iframe alto, scrollHeight
          // devuelve como mínimo el alto del propio iframe
          frame.style.height = "10px";
          var h = Math.max(
            doc.documentElement.scrollHeight,
            doc.body ? doc.body.scrollHeight : 0
          );
          frame.style.height = h > 0
            ? Math.min(h + 4, visor.clientHeight * 0.75) + "px"
            : "60vh";
        } catch (e) { /* otro dominio: se queda el alto por defecto */ }
      });
      popupContenido.appendChild(frame);
    }
    popupEl.classList.add("visible");
  }

  function cerrarPopup() {
    if (!popupEl) return false;
    if (!popupEl.classList.contains("visible")) return false;
    popupEl.classList.remove("visible");
    if (popupContenido) popupContenido.innerHTML = ""; // detiene iframes
    return true;
  }

  if (popupCerrar) popupCerrar.addEventListener("click", cerrarPopup);
  if (popupEl) {
    popupEl.addEventListener("click", function (e) {
      if (e.target === popupEl) cerrarPopup(); // clic fuera de la caja
    });
  }

  /* ==================== TAMAÑO Y ORIENTACIÓN ==================== */

  function calcularModo() {
    var vw = visor.clientWidth, vh = visor.clientHeight;
    var margen = 0.96;

    // intentar doble página
    var bw = vw * margen;
    var bh = (bw / 2) * ratioPagina;
    if (bh > vh * margen) {
      bh = vh * margen;
      bw = (bh / ratioPagina) * 2;
    }
    var anchoPag = bw / 2;

    // si la pantalla es angosta, una sola página
    if (vw < 620 || anchoPag < 240) {
      var pw = Math.min(vw * margen, (vh * margen) / ratioPagina);
      return { modo: "portrait", w: pw, h: pw * ratioPagina };
    }
    return { modo: "landscape", w: bw, h: bh };
  }

  function crearLibro() {
    var m = calcularModo();
    modoActual = m.modo;
    libroEl.style.width = Math.round(m.w) + "px";
    libroEl.style.height = Math.round(m.h) + "px";

    var anchoPag = m.modo === "landscape" ? m.w / 2 : m.w;

    pageFlip = new St.PageFlip(libroEl, {
      width: Math.round(anchoPag),
      height: Math.round(m.h),
      size: "stretch",
      minWidth: 120,
      maxWidth: 4000,
      minHeight: 120,
      maxHeight: 4000,
      usePortrait: m.modo === "portrait",
      showCover: PORTADA,
      drawShadow: true,
      maxShadowOpacity: 0.45,
      flippingTime: 850,
      mobileScrollSupport: false,
      showPageCorners: true,
      autoSize: true
    });

    pageFlip.loadFromHTML(paginasHTML);

    // StPageFlip fuerza densidad "hard" (rígida) en la portada y la última
    // página cuando showCover=true, y eso sustituye el doblez de esquina por
    // un giro plano. Reponemos todas las páginas a "soft" para que TODAS
    // volteen con la esquina doblada.
    try {
      pageFlip.getPageCollection().getPages().forEach(function (p) {
        p.setDensity("soft");
      });
    } catch (e) { /* API interna: si cambia en otra versión, no rompemos */ }

    // sonido + audio por página en cada volteo
    pageFlip.on("flip", function () {
      reproducirVolteo();
      actualizarAudios(paginasVisibles());
    });

    // ocultar videos durante la animación, mostrarlos al terminar
    pageFlip.on("changeState", function (e) {
      if (e.data === "flipping" || e.data === "user_fold" || e.data === "fold_corner") {
        ocultarVideos();
      } else if (e.data === "read") {
        refrescarCapas();
      }
    });

    pageFlip.on("changeOrientation", function () {
      requestAnimationFrame(refrescarCapas);
    });

    requestAnimationFrame(function () {
      refrescarCapas();
      actualizarAudios(paginasVisibles());
    });
  }

  function reconstruirLibro() {
    var idx = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
    if (pageFlip) {
      pageFlip.destroy();
      pageFlip = null;
    }
    libroEl.innerHTML = "";
    crearLibro();
    if (idx > 0) {
      try { pageFlip.turnToPage(idx); } catch (e) { /* ignorar */ }
    }
    requestAnimationFrame(refrescarCapas);
  }

  // Nota: este listener se registra ANTES de crear el libro, así que se
  // ejecuta primero: ajustamos el contenedor y luego StPageFlip (que también
  // escucha "resize") recalcula con el tamaño ya actualizado.
  var timerResize = null;
  window.addEventListener("resize", function () {
    if (!pageFlip) return;
    if (zoom.activo) salirZoom();
    ocultarVideos();
    var m = calcularModo();
    if (m.modo === modoActual) {
      libroEl.style.width = Math.round(m.w) + "px";
      libroEl.style.height = Math.round(m.h) + "px";
    }
    clearTimeout(timerResize);
    timerResize = setTimeout(function () {
      var m2 = calcularModo();
      if (m2.modo !== modoActual) {
        reconstruirLibro();
      } else {
        requestAnimationFrame(refrescarCapas);
      }
    }, 250);
  });

  /* ==================== BARRA DE NAVEGACIÓN ==================== */

  // config.js → barra: true (por defecto) la muestra; false la elimina del todo
  var BARRA = CFG.barra !== false;
  var barraEl = document.getElementById("barra");
  var toggleBarraEl = document.getElementById("toggle-barra");
  var btnMute = document.getElementById("btn-mute");
  var zoomCapa = document.getElementById("zoom-capa");
  var avisoZoomEl = document.getElementById("aviso-zoom");

  // Silencio global: volteo, música, objetos y videos.
  // La interfaz ARRANCA MUTEADA (empezarSilenciado: false para arrancar con sonido).
  var silenciado = CFG.empezarSilenciado !== false;

  function aplicarSilencio() {
    if (audioVolteo) audioVolteo.muted = silenciado;
    if (musica) {
      musica.muted = silenciado;
      if (!silenciado && interactuado && !hayVideoSonando()) iniciarMusica();
    }
    Object.keys(audiosPagina).forEach(function (n) {
      audiosPagina[n].muted = silenciado;
    });
    objetosSonido.forEach(function (o) {
      o.audio.muted = silenciado;
    });
    videos.forEach(function (v) {
      if (v.listo && v.player) {
        try { if (silenciado) v.player.mute(); else v.player.unMute(); } catch (e) {}
      }
    });
    if (btnMute) {
      btnMute.textContent = silenciado ? "🔇" : "🔊";
      btnMute.title = silenciado ? "Activar sonido" : "Silenciar";
    }
  }

  function irAPagina(n) {
    if (!pageFlip) return;
    salirZoom();
    try { pageFlip.flip(n); } catch (e) {
      try { pageFlip.turnToPage(n); } catch (e2) {}
    }
  }

  function conBoton(id, fn) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", fn);
  }

  if (!BARRA) {
    if (barraEl) barraEl.style.display = "none";
    if (toggleBarraEl) toggleBarraEl.style.display = "none";
  } else {
    conBoton("btn-mute", function () {
      silenciado = !silenciado;
      aplicarSilencio();
    });
    conBoton("btn-primera", function () { irAPagina(0); });
    conBoton("btn-ultima", function () { irAPagina(numPaginas - 1); });
    conBoton("btn-prev", function () {
      if (pageFlip) { salirZoom(); pageFlip.flipPrev(); }
    });
    conBoton("btn-next", function () {
      if (pageFlip) { salirZoom(); pageFlip.flipNext(); }
    });
    conBoton("btn-zoom-mas", function () {
      setZoom((zoom.activo ? zoom.escala : 1) * 1.4);
    });
    conBoton("btn-zoom-menos", function () {
      if (zoom.activo) setZoom(zoom.escala / 1.4);
    });
    if (toggleBarraEl && barraEl) {
      toggleBarraEl.addEventListener("click", function () {
        var oculta = barraEl.classList.toggle("oculta");
        toggleBarraEl.textContent = oculta ? "▴" : "▾";
        toggleBarraEl.title = oculta ? "Mostrar la barra" : "Ocultar la barra";
      });
    }
  }

  aplicarSilencio(); // refleja el estado inicial (muteado) en botón y audios

  /* ==================== ZOOM ====================
     Entrar:  doble clic / doble tap, pellizco, Ctrl+rueda o botón ＋
     Mover:   arrastrar (o flechas del teclado)
     Salir:   doble clic, Esc, alejar hasta 1x o botón −            */

  var ZOOM_MAX = 3;
  var zoom = { activo: false, escala: 1, tx: 0, ty: 0 };

  function aplicarZoom(inmediato) {
    libroEl.classList.toggle("sin-transicion", !!inmediato);
    libroEl.style.transformOrigin = "0 0";
    libroEl.style.transform =
      "translate(" + zoom.tx + "px, " + zoom.ty + "px) scale(" + zoom.escala + ")";
  }

  // Mantiene el libro dentro del visor (o centrado si cabe entero)
  function clampPan() {
    var vw = visor.clientWidth, vh = visor.clientHeight;
    var l0 = libroEl.offsetLeft, t0 = libroEl.offsetTop;
    var w = libroEl.offsetWidth * zoom.escala;
    var h = libroEl.offsetHeight * zoom.escala;
    if (w <= vw) zoom.tx = (vw - w) / 2 - l0;
    else zoom.tx = Math.min(-l0, Math.max(vw - w - l0, zoom.tx));
    if (h <= vh) zoom.ty = (vh - h) / 2 - t0;
    else zoom.ty = Math.min(-t0, Math.max(vh - h - t0, zoom.ty));
  }

  function entrarZoomUI() {
    if (zoomCapa) zoomCapa.classList.add("activa");
    ocultarVideos();
    videos.forEach(function (v) {
      if (v.listo && v.player) { try { v.player.pauseVideo(); } catch (e) {} }
    });
  }

  function salirZoom() {
    if (!zoom.activo) return;
    zoom.activo = false;
    zoom.escala = 1;
    zoom.tx = 0;
    zoom.ty = 0;
    libroEl.classList.remove("sin-transicion");
    libroEl.style.transform = "";
    if (zoomCapa) zoomCapa.classList.remove("activa", "arrastrando");
    requestAnimationFrame(refrescarCapas);
  }

  // Cambia la escala manteniendo fijo el punto (fx, fy) del visor
  function setZoom(s1, fx, fy) {
    if (!pageFlip) return;
    s1 = Math.max(1, Math.min(ZOOM_MAX, s1));
    if (s1 <= 1.02) { salirZoom(); return; }
    if (fx == null) { fx = visor.clientWidth / 2; fy = visor.clientHeight / 2; }
    var s0 = zoom.activo ? zoom.escala : 1;
    if (!zoom.activo) {
      zoom.activo = true;
      zoom.tx = 0;
      zoom.ty = 0;
      entrarZoomUI();
    }
    var l0 = libroEl.offsetLeft, t0 = libroEl.offsetTop;
    var px = (fx - l0 - zoom.tx) / s0;
    var py = (fy - t0 - zoom.ty) / s0;
    zoom.escala = s1;
    zoom.tx = fx - l0 - px * s1;
    zoom.ty = fy - t0 - py * s1;
    clampPan();
    aplicarZoom();
  }

  // Las esquinas del libro se reservan para voltear página con clic
  function esEsquinaLibro(fx, fy) {
    var bloque = libroEl.querySelector(".stf__block");
    if (!bloque || !pageFlip) return false;
    var rb = bloque.getBoundingClientRect();
    var rv = visor.getBoundingClientRect();
    var x = fx - (rb.left - rv.left);
    var y = fy - (rb.top - rv.top);
    var w = rb.width, h = rb.height;
    var pw = pageFlip.getOrientation() === "portrait" ? w : w / 2;
    var radio = Math.sqrt(pw * pw + h * h) / 5;
    return x > 0 && y > 0 && x < w && y < h &&
      (x < radio || x > w - radio) && (y < radio || y > h - radio);
  }

  // --- Doble clic: entra (fuera de las esquinas) o sale del zoom ---
  document.addEventListener("dblclick", function (e) {
    if (e.target.closest &&
        e.target.closest("#barra, #toggle-barra, #popup, .sonido-btn, .enlace-pagina")) return;
    if (zoom.activo) {
      e.preventDefault();
      e.stopPropagation();
      salirZoom();
      return;
    }
    if (!pageFlip) return;
    var r = visor.getBoundingClientRect();
    var fx = e.clientX - r.left, fy = e.clientY - r.top;
    if (esEsquinaLibro(fx, fy)) return;
    setZoom(2, fx, fy);
  }, true);

  // --- Rueda: Ctrl+rueda entra; con zoom activo la rueda ajusta ---
  visor.addEventListener("wheel", function (e) {
    if (!pageFlip) return;
    if (e.target.closest && e.target.closest("#popup")) return;
    if (zoom.activo || e.ctrlKey) {
      e.preventDefault();
      var r = visor.getBoundingClientRect();
      var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom((zoom.activo ? zoom.escala : 1) * factor, e.clientX - r.left, e.clientY - r.top);
    }
  }, { passive: false });

  // --- Paneo con ratón (en fase de captura para no molestar a StPageFlip) ---
  var arrastre = null;
  document.addEventListener("mousedown", function (e) {
    if (!zoom.activo) return;
    if (e.target.closest && e.target.closest("#barra, #toggle-barra, #popup")) return;
    e.preventDefault();
    e.stopPropagation();
    arrastre = { x: e.clientX, y: e.clientY };
    if (zoomCapa) zoomCapa.classList.add("arrastrando");
  }, true);

  document.addEventListener("mousemove", function (e) {
    if (!zoom.activo) return;
    e.stopPropagation();
    if (!arrastre) return;
    zoom.tx += e.clientX - arrastre.x;
    zoom.ty += e.clientY - arrastre.y;
    arrastre = { x: e.clientX, y: e.clientY };
    clampPan();
    aplicarZoom(true);
  }, true);

  document.addEventListener("mouseup", function () {
    if (arrastre) {
      arrastre = null;
      if (zoomCapa) zoomCapa.classList.remove("arrastrando");
    }
  }, true);

  // --- Táctil: pellizco para acercar/alejar y un dedo para panear ---
  var pinch = null;
  var panTactil = null;

  document.addEventListener("touchstart", function (e) {
    if (e.target.closest && e.target.closest("#popup")) return;
    if (e.touches.length === 2) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      var r = visor.getBoundingClientRect();
      var t1 = e.touches[0], t2 = e.touches[1];
      pinch = {
        d0: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        s0: zoom.activo ? zoom.escala : 1,
        cx: (t1.clientX + t2.clientX) / 2 - r.left,
        cy: (t1.clientY + t2.clientY) / 2 - r.top
      };
    } else if (zoom.activo && e.touches.length === 1) {
      if (e.target.closest && e.target.closest("#barra, #toggle-barra")) return;
      e.stopPropagation();
      panTactil = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { capture: true, passive: false });

  document.addEventListener("touchmove", function (e) {
    if (pinch && e.touches.length === 2) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      var t1 = e.touches[0], t2 = e.touches[1];
      var d1 = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (pinch.d0 > 0) setZoom(pinch.s0 * d1 / pinch.d0, pinch.cx, pinch.cy);
    } else if (panTactil && zoom.activo && e.touches.length === 1) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      zoom.tx += e.touches[0].clientX - panTactil.x;
      zoom.ty += e.touches[0].clientY - panTactil.y;
      panTactil = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      clampPan();
      aplicarZoom(true);
    }
  }, { capture: true, passive: false });

  document.addEventListener("touchend", function (e) {
    if (pinch && e.touches.length < 2) pinch = null;
    if (e.touches.length === 0) panTactil = null;
  }, true);

  /* ==================== TECLADO ==================== */

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (cerrarPopup()) return; // primero la ventana emergente
      salirZoom();
      return;
    }
    if (!pageFlip) return;
    if (zoom.activo) {
      var paso = 60;
      if (e.key === "ArrowRight") zoom.tx -= paso;
      else if (e.key === "ArrowLeft") zoom.tx += paso;
      else if (e.key === "ArrowUp") zoom.ty += paso;
      else if (e.key === "ArrowDown") zoom.ty -= paso;
      else if (e.key === "+") { setZoom(zoom.escala * 1.4); return; }
      else if (e.key === "-") { setZoom(zoom.escala / 1.4); return; }
      else return;
      clampPan();
      aplicarZoom(true);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "PageDown") pageFlip.flipNext();
    if (e.key === "ArrowLeft" || e.key === "PageUp") pageFlip.flipPrev();
  });

  /* ==================== INICIO ==================== */

  var cargador = MODO_IMAGENES ? cargarImagenes() : cargarPDF();

  cargador
    .then(function () {
      decorarPaginas();
      prepararVideos();
      crearLibro();
      iniciarMusica(); // si el navegador la bloquea, arranca al primer toque
      cargandoEl.classList.add("oculto");
      // pista de zoom, se desvanece sola
      if (avisoZoomEl) {
        avisoZoomEl.classList.add("visible");
        setTimeout(function () { avisoZoomEl.classList.remove("visible"); }, 4000);
      }
    })
    .catch(function (err) {
      cargandoEl.innerHTML =
        '<p style="color:#fff;font-family:sans-serif;text-align:center;padding:20px">' +
        "No se pudo cargar el libro:<br><strong>" +
        (MODO_IMAGENES ? "lista de páginas (paginas)" : PDF_URL) +
        "</strong><br><br>Revisa las rutas en config.js</p>";
      console.error(err);
    });
})();
