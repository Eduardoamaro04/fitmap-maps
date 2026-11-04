/*!
 * FitMapMaps v1.3.0
 * Biblioteca externa para usar o Google Maps + Places API (New) no FitMap.
 * Cuida de tudo que envolve o mapa: carregar o Google Maps, buscar locais na área visível,
 * buscar cidades/endereços, calcular distâncias, gerenciar filtros/favoritos da busca,
 * desenhar os pinos customizados, abrir a janelinha de detalhes e formatar os dados do Google.
 * Licença MIT (veja o arquivo LICENSE).
 */
(function (global) {
  "use strict";

  const VERSAO = "1.3.0";
  const NOME_DO_CALLBACK = "__fitmapMapsPronto";
  const NOMES_DOS_TIPOS = { academia: "Academia", restaurante: "Restaurante" };
  const NOMES_DOS_DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

  /* ---------- Utilitários ---------- */

  // Fórmula de Haversine: distância em km entre dois pontos { lat, lng }
  function distanciaKm(a, b) {
    const raio = 6371;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * raio * Math.asin(Math.sqrt(x));
  }

  function escapar(texto) {
    return String(texto || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function entradaAcessivel(p) {
    const a = p.accessibilityOptions;
    if (!a) {
      return false;
    }
    return a.hasWheelchairAccessibleEntrance === true || a.wheelchairAccessibleEntrance === true;
  }

  /* ---------- Formatação pronta dos dados do local para os cartões e janelinha ---------- */

  function montarLinhaNota(l, pedirNotaEHorario) {
    if (l.nota) {
      const porcentagem = Math.round((l.nota / 5) * 100);
      return '<p class="nota"><span class="valor">' + Number(l.nota).toFixed(1).replace(".", ",") + "</span> " +
             '<span class="estrelas" style="--pct:' + porcentagem + '%"></span>' +
             (l.avaliacoes ? " <span>(" + l.avaliacoes + ")</span>" : "") + "</p>";
    }
    if (l.nota === null && pedirNotaEHorario) {
      return '<p class="nota">Nenhuma avaliação</p>';
    }
    return "";
  }

  function montarTipoEEndereco(l) {
    const partes = [];
    if (l.categoria) {
      partes.push(l.categoria);
    }
    if (l.endereco) {
      partes.push(l.endereco);
    }
    return partes.join(" · ");
  }

  function montarLinhaStatus(l) {
    const s = l.statusHorario;
    if (!s) {
      return "";
    }
    if (s.vinteEQuatroHoras) {
      return '<p><span class="aberto">Aberto 24 horas</span></p>';
    }
    if (s.aberto) {
      return '<p><span class="aberto">Aberto</span> · Fecha ' + s.fechaAs + "</p>";
    }
    const quando = s.abreLogo ? s.abreAs : NOMES_DOS_DIAS[s.abreDia] + " " + s.abreAs;
    return '<p><span class="fechado">Fechado</span> · Abre ' + quando + "</p>";
  }

  function montarFoto(l) {
    if (!l.foto) {
      return "";
    }
    const credito = l.foto.autor
      ? '<a class="credito" href="' + escapar(l.foto.autorLink) + '" target="_blank" rel="noopener">' + escapar(l.foto.autor) + "</a>"
      : "";
    return '<div class="foto"><img src="' + escapar(l.foto.url) + '" alt="Foto de ' + escapar(l.nome) + '" loading="lazy">' + credito + "</div>";
  }

  function enriquecerLugar(l, pedirNotaEHorario) {
    l.categoria = l.categoria || NOMES_DOS_TIPOS[l.tipo] || "";
    l.iconeHtml = l.tipo === "academia" ? '<i class="fa-solid fa-dumbbell"></i>' : '<i class="ri-restaurant-line"></i>';
    l.notaHtml = montarLinhaNota(l, pedirNotaEHorario);
    l.resumo = montarTipoEEndereco(l);
    l.statusHtml = montarLinhaStatus(l);
    l.fotoHtml = montarFoto(l);
    return l;
  }

  function montarJanelinha(l) {
    let destino = l.link;
    if (!destino) {
      destino = "https://www.google.com/maps/dir/?api=1&destination=" + l.lat + "," + l.lng +
                "&destination_place_id=" + encodeURIComponent(l.id);
    }

    let html = '<div class="cartao-mapa">' +
               '<a class="abrir" href="' + escapar(destino) + '" target="_blank" rel="noopener" ' +
               'title="Abrir no Google Maps" aria-label="Abrir no Google Maps"><i class="ri-external-link-line"></i></a>' +
               "<h3>" + escapar(l.nome) + "</h3>" +
               "<p>" + escapar(l.endereco) + "</p>";

    if (l.entradaAcessivel) {
      html = html + '<p class="acessivel"><i class="fa-solid fa-wheelchair"></i> Entrada acessível</p>';
    }
    return html + "</div>";
  }

  /* ---------- iniciar: carrega o Google e cria o mapa ---------- */
  function iniciar(opcoes) {
    const config = montarConfig(opcoes || {});

    if (config.aoAtualizar) {
      config.aoAtualizar([], "Carregando o mapa...", "Aguardando o mapa carregar...");
    }

    return new Promise(function (resolver, rejeitar) {
      let terminou = false;

      function falhar(mensagem) {
        if (config.aoStatus) {
          config.aoStatus(mensagem, true);
        }
        if (config.aoErro) {
          config.aoErro(mensagem);
        }
        if (!terminou) {
          terminou = true;
          rejeitar(new Error(mensagem));
        }
      }

      if (!config.chave) {
        falhar("FitMapMaps: faltou informar a chave do Google (opção \"chave\").");
        return;
      }

      const elemento = typeof config.elemento === "string"
        ? document.getElementById(config.elemento)
        : config.elemento;
      if (!elemento) {
        falhar("FitMapMaps: não encontrei o elemento do mapa (opção \"elemento\").");
        return;
      }

      global.gm_authFailure = function () {
        falhar("O Google recusou a chave. Confira no Google Cloud: se a \"Maps JavaScript API\" e a \"Places API (New)\" estão ativadas, e se este endereço (ex.: localhost) está permitido na chave.");
      };

      global[NOME_DO_CALLBACK] = function () {
        montar().catch(function (erro) {
          console.error(erro);
          falhar("Não consegui iniciar o mapa. Abra o console do navegador (tecla F12) para ver o erro.");
        });
      };

      const script = document.createElement("script");
      script.src = "https://maps.googleapis.com/maps/api/js" +
        "?key=" + encodeURIComponent(config.chave) +
        "&v=weekly&loading=async" +
        "&language=" + encodeURIComponent(config.idioma) +
        "&region=" + encodeURIComponent(config.regiao) +
        "&callback=" + NOME_DO_CALLBACK;
      script.async = true;
      script.onerror = function () {
        falhar("Não consegui carregar o Google Maps. Veja sua conexão com a internet.");
      };
      document.head.appendChild(script);

      async function montar() {
        const bibMapas = await google.maps.importLibrary("maps");
        const bibNucleo = await google.maps.importLibrary("core");
        const bibPlaces = await google.maps.importLibrary("places");
        const bibMarcador = await google.maps.importLibrary("marker");

        const mapa = new bibMapas.Map(elemento, {
          center: config.centro,
          zoom: config.zoom,
          mapId: config.mapId,
          colorScheme: config.tema === "claro" ? bibNucleo.ColorScheme.LIGHT : bibNucleo.ColorScheme.DARK,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });

        const instancia = criarInstancia(
          mapa,
          new bibMapas.InfoWindow({ headerDisabled: config.janelaSemBotaoFechar }),
          bibPlaces,
          bibMarcador,
          config
        );

        let entregue = false;
        const entregar = function () {
          if (!entregue) {
            entregue = true;
            terminou = true;
            if (config.aoStatus) {
              config.aoStatus("", false);
            }
            resolver(instancia);
            if (config.aoAtualizar && config.buscaInicial !== false) {
              instancia.buscarNestaArea();
            }
          }
        };
        google.maps.event.addListenerOnce(mapa, "idle", entregar);
        setTimeout(entregar, 5000);
      }
    });
  }

  function montarConfig(o) {
    return {
      chave: o.chave,
      elemento: o.elemento,
      centro: o.centro || { lat: -9.931042, lng: -67.818991 },
      zoom: o.zoom || 14,
      buscas: o.buscas || { academia: "academias", restaurante: "restaurantes fitness e saudáveis" },
      pedirNotaEHorario: o.pedirNotaEHorario !== undefined ? Boolean(o.pedirNotaEHorario) : true,
      pedirFoto: o.pedirFoto === true,
      maxResultados: Math.min(Math.max(o.maxResultados || 20, 1), 20),
      tema: o.tema || "escuro",
      idioma: o.idioma || "pt-BR",
      regiao: o.regiao || "BR",
      mapId: o.mapId || "DEMO_MAP_ID",
      desenharPino: o.desenharPino || null,
      aoClicarNoPino: o.aoClicarNoPino || null,
      aoAtualizar: o.aoAtualizar || null,
      aoSelecionar: o.aoSelecionar || null,
      aoAviso: o.aoAviso || null,
      aoStatus: o.aoStatus || null,
      aoErro: o.aoErro || null,
      buscaInicial: o.buscaInicial !== false,
      janelaSemBotaoFechar: o.janelaSemBotaoFechar !== undefined ? Boolean(o.janelaSemBotaoFechar) : true,
      chaveFavoritos: o.chaveFavoritos || "fitmap-favoritos"
    };
  }

  /* ---------- criarInstancia: métodos e estado do mapa ---------- */
  function criarInstancia(mapa, janela, bibPlaces, bibMarcador, config) {
    let pinos = {};
    let resultados = [];
    let tiposBuscados = [];
    let areaBusca = null;
    let origem = config.centro;
    let idSelecionado = null;
    let numeroDaBusca = 0;
    let filtroAtual = "todos";
    let textoBusca = "";
    let mapaPronto = true;

    let favoritos = [];
    try {
      favoritos = JSON.parse(localStorage.getItem(config.chaveFavoritos)) || [];
    } catch (erro) {
      favoritos = [];
    }

    if (config.janelaSemBotaoFechar) {
      mapa.addListener("click", function () {
        janela.close();
      });
    }

    function avisar(texto) {
      if (config.aoAviso) {
        config.aoAviso(texto);
      }
    }

    function capturarArea() {
      const limites = mapa.getBounds();
      if (!limites) {
        return null;
      }
      const c = mapa.getCenter();
      return { limites: limites, centro: { lat: c.lat(), lng: c.lng() } };
    }

    async function buscarLocais(tipo, area) {
      const textoDaBusca = config.buscas[tipo];
      if (!textoDaBusca) {
        throw new Error("FitMapMaps: o tipo \"" + tipo + "\" não existe na opção \"buscas\".");
      }

      const campos = [
        "id", "displayName", "formattedAddress", "shortFormattedAddress",
        "location", "googleMapsURI", "primaryTypeDisplayName", "accessibilityOptions"
      ];
      if (config.pedirNotaEHorario) {
        campos.push("rating", "userRatingCount", "regularOpeningHours", "utcOffsetMinutes");
      }
      if (config.pedirFoto) {
        campos.push("photos");
      }

      const resposta = await bibPlaces.Place.searchByText({
        textQuery: textoDaBusca,
        fields: campos,
        locationRestriction: area.limites,
        maxResultCount: config.maxResultados,
        language: config.idioma,
        region: config.regiao.toLowerCase()
      });

      const lista = [];
      for (let i = 0; i < resposta.places.length; i++) {
        const p = resposta.places[i];
        if (!p.location) {
          continue;
        }
        const lugar = {
          id: p.id,
          tipo: tipo,
          nome: p.displayName || "Sem nome",
          endereco: p.shortFormattedAddress || p.formattedAddress || "Endereço não informado",
          lat: p.location.lat(),
          lng: p.location.lng(),
          categoria: p.primaryTypeDisplayName || NOMES_DOS_TIPOS[tipo] || "",
          link: p.googleMapsURI || "",
          entradaAcessivel: entradaAcessivel(p),
          nota: p.rating || null,
          avaliacoes: p.userRatingCount || null,
          statusHorario: statusDoHorario(p),
          foto: fotoDoLocal(p)
        };
        lista.push(enriquecerLugar(lugar, config.pedirNotaEHorario));
      }
      return lista;
    }

    function statusDoHorario(p) {
      try {
        const horas = p.regularOpeningHours;
        if (!horas || !horas.periods || horas.periods.length === 0) {
          return null;
        }
        if (horas.periods.length === 1 && !horas.periods[0].close) {
          return { aberto: true, vinteEQuatroHoras: true };
        }
        if (typeof p.utcOffsetMinutes !== "number") {
          return null;
        }

        const SEMANA = 7 * 24 * 60;
        const agoraNoLocal = new Date(Date.now() + p.utcOffsetMinutes * 60000);
        const agora = agoraNoLocal.getUTCDay() * 1440 + agoraNoLocal.getUTCHours() * 60 + agoraNoLocal.getUTCMinutes();

        let proxima = null;
        for (let i = 0; i < horas.periods.length; i++) {
          const abrir = horas.periods[i].open;
          const fechar = horas.periods[i].close;
          if (!abrir || !fechar) {
            continue;
          }
          const abre = abrir.day * 1440 + abrir.hour * 60 + abrir.minute;
          let fecha = fechar.day * 1440 + fechar.hour * 60 + fechar.minute;
          if (fecha <= abre) {
            fecha = fecha + SEMANA;
          }

          if ((agora >= abre && agora < fecha) || (agora + SEMANA >= abre && agora + SEMANA < fecha)) {
            return { aberto: true, fechaAs: formatarHora(fechar.hour, fechar.minute) };
          }

          const espera = (abre - agora + SEMANA) % SEMANA;
          if (proxima === null || espera < proxima.espera) {
            proxima = { espera: espera, dia: abrir.day, hora: abrir.hour, minuto: abrir.minute };
          }
        }

        if (proxima === null) {
          return null;
        }
        return {
          aberto: false,
          abreAs: formatarHora(proxima.hora, proxima.minuto),
          abreDia: proxima.dia,
          abreLogo: proxima.espera < 1440
        };
      } catch (erro) {
        return null;
      }
    }

    function formatarHora(hora, minuto) {
      return String(hora).padStart(2, "0") + ":" + String(minuto).padStart(2, "0");
    }

    function fotoDoLocal(p) {
      try {
        if (!config.pedirFoto || !p.photos || p.photos.length === 0) {
          return null;
        }
        const foto = p.photos[0];
        const autor = foto.authorAttributions && foto.authorAttributions[0];
        return {
          url: foto.getURI({ maxWidth: 200, maxHeight: 200 }),
          autor: autor ? autor.displayName : "",
          autorLink: autor ? autor.uri : ""
        };
      } catch (erro) {
        return null;
      }
    }

    async function procurarEndereco(texto) {
      const resposta = await bibPlaces.Place.searchByText({
        textQuery: texto,
        fields: ["location", "viewport"],
        maxResultCount: 1,
        language: config.idioma,
        region: config.regiao.toLowerCase()
      });
      if (resposta.places.length === 0 || !resposta.places[0].location) {
        return null;
      }
      const lugar = resposta.places[0];
      return {
        centro: { lat: lugar.location.lat(), lng: lugar.location.lng() },
        limites: lugar.viewport || null
      };
    }

    function irPara(destino) {
      return new Promise(function (resolver) {
        let acabou = false;
        const acabar = function () {
          if (!acabou) {
            acabou = true;
            resolver();
          }
        };
        google.maps.event.addListenerOnce(mapa, "idle", acabar);
        setTimeout(acabar, 1500);

        if (destino.limites) {
          mapa.fitBounds(destino.limites);
        } else {
          mapa.setCenter(destino.centro);
          mapa.setZoom(14);
        }
      });
    }

    function focarEm(lat, lng, zoomMinimo) {
      mapa.panTo({ lat: lat, lng: lng });
      if (zoomMinimo && mapa.getZoom() < zoomMinimo) {
        mapa.setZoom(zoomMinimo);
      }
    }

    function desenharPinoPadrao(lugar) {
      const visual = document.createElement("div");
      visual.className = "pino pino-" + lugar.tipo + (lugar.id === idSelecionado ? " sel" : "");
      visual.innerHTML = lugar.tipo === "academia"
        ? '<i class="fa-solid fa-dumbbell"></i>'
        : '<i class="ri-restaurant-line"></i>';
      return visual;
    }

    function mostrarPinos(lugares) {
      for (const id in pinos) {
        pinos[id].map = null;
      }
      pinos = {};

      lugares.forEach(function (lugar) {
        const visual = config.desenharPino ? config.desenharPino(lugar) : desenharPinoPadrao(lugar);

        const pino = new bibMarcador.AdvancedMarkerElement({
          map: mapa,
          position: { lat: lugar.lat, lng: lugar.lng },
          content: visual,
          title: lugar.nome,
          gmpClickable: true
        });
        pino.addEventListener("gmp-click", function () {
          if (config.aoClicarNoPino) {
            config.aoClicarNoPino(lugar.id);
          } else {
            selecionar(lugar.id);
          }
        });
        pinos[lugar.id] = pino;
      });
    }

    function destacarPino(id) {
      for (const outro in pinos) {
        const ativo = outro === id;
        pinos[outro].content.classList.toggle("sel", ativo);
        pinos[outro].zIndex = ativo ? 1000 : null;
      }
    }

    function abrirJanela(id, html) {
      if (!pinos[id]) {
        return;
      }
      janela.setContent(html);
      janela.open({ map: mapa, anchor: pinos[id] });
    }

    function fecharJanela() {
      janela.close();
    }

    function redimensionar() {
      google.maps.event.trigger(mapa, "resize");
    }

    /* ---------- Gerenciamento completo de buscas, filtros e favoritos ---------- */

    function ehFavorito(id) {
      return favoritos.some(function (f) { return f.id === id; });
    }

    function obterVisiveis() {
      let base = [];
      if (filtroAtual === "fav") {
        base = favoritos.map(function (f) {
          return enriquecerLugar(Object.assign({}, f), config.pedirNotaEHorario);
        });
      } else {
        for (let i = 0; i < resultados.length; i++) {
          if (filtroAtual === "todos" || resultados[i].tipo === filtroAtual) {
            base.push(resultados[i]);
          }
        }
      }

      const visiveis = base.filter(function (l) {
        const conteudo = (l.nome + " " + l.endereco + " " + l.categoria).toLowerCase();
        return conteudo.includes(textoBusca);
      });

      visiveis.sort(function (a, b) {
        return distanciaKm(origem, a) - distanciaKm(origem, b);
      });

      for (let i = 0; i < visiveis.length; i++) {
        visiveis[i].favorito = ehFavorito(visiveis[i].id);
        visiveis[i].selecionado = (visiveis[i].id === idSelecionado);
      }

      return visiveis;
    }

    function mensagemListaVazia() {
      if (filtroAtual === "fav") {
        return "Você ainda não favoritou nenhum local. Clique no ♡ de um cartão para salvar.";
      }
      if (textoBusca !== "") {
        return "Nenhum local combina com o filtro digitado.";
      }
      if (!mapaPronto) {
        return "Aguardando o mapa carregar...";
      }
      return "Nenhum local encontrado nesta área. Mova ou afaste o mapa e clique em \"Buscar nesta área\".";
    }

    function atualizar() {
      const visiveis = obterVisiveis();

      const aindaExiste = visiveis.some(function (l) { return l.id === idSelecionado; });
      if (!aindaExiste) {
        idSelecionado = null;
        fecharJanela();
      }

      mostrarPinos(visiveis);

      const n = visiveis.length;
      const textoContagem = filtroAtual === "fav"
        ? n + (n === 1 ? " favorito" : " favoritos")
        : n + (n === 1 ? " local nesta área" : " locais nesta área");

      if (config.aoAtualizar) {
        config.aoAtualizar(visiveis, textoContagem, mensagemListaVazia());
      }
    }

    async function buscarNestaArea() {
      if (filtroAtual === "fav") {
        avisar("No filtro Favoritos não há busca. Escolha Tudo, Restaurantes ou Academias.");
        setTimeout(function () { avisar(""); }, 5000);
        return;
      }

      const area = capturarArea();
      if (area === null) {
        avisar("O mapa ainda está carregando. Tente de novo em um instante.");
        return;
      }

      areaBusca = area;
      origem = area.centro;
      numeroDaBusca = numeroDaBusca + 1;
      resultados = [];
      tiposBuscados = [];
      await carregarTipos();
    }

    async function carregarTipos() {
      if (areaBusca === null) {
        return;
      }
      if (filtroAtual === "fav") {
        atualizar();
        return;
      }

      const todosOsTipos = Object.keys(config.buscas);
      const precisa = filtroAtual === "todos" ? todosOsTipos : [filtroAtual];
      const faltam = [];
      for (let i = 0; i < precisa.length; i++) {
        if (!tiposBuscados.includes(precisa[i])) {
          faltam.push(precisa[i]);
        }
      }

      if (faltam.length === 0) {
        atualizar();
        return;
      }

      const meuNumero = numeroDaBusca;
      avisar("Buscando locais...");

      try {
        const respostas = await Promise.all(faltam.map(function (tipo) {
          return buscarLocais(tipo, areaBusca);
        }));

        if (meuNumero !== numeroDaBusca) {
          return;
        }

        for (let i = 0; i < respostas.length; i++) {
          for (let j = 0; j < respostas[i].length; j++) {
            const lugar = respostas[i][j];
            const jaExiste = resultados.some(function (r) { return r.id === lugar.id; });
            if (!jaExiste) {
              resultados.push(lugar);
            }
          }
          tiposBuscados.push(faltam[i]);
        }
        avisar("");
      } catch (erro) {
        console.error(erro);
        avisar("Não consegui buscar os locais. Confira se a \"Places API (New)\" está ativada no Google Cloud (abra o console com F12 para ver o erro).");
      }

      atualizar();
    }

    function filtrarPorTipo(tipo) {
      filtroAtual = tipo;
      return carregarTipos();
    }

    function filtrarPorTexto(texto) {
      textoBusca = String(texto || "").trim().toLowerCase();
      atualizar();
    }

    function selecionar(id) {
      const l = obterVisiveis().find(function (x) { return x.id === id; });
      if (!l) {
        return;
      }
      idSelecionado = id;
      destacarPino(id);
      focarEm(l.lat, l.lng, 15);
      abrirJanela(id, montarJanelinha(l));
      if (config.aoSelecionar) {
        config.aoSelecionar(id);
      }
    }

    function alternarFavorito(id) {
      const posicao = favoritos.findIndex(function (f) { return f.id === id; });
      let virouFavorito = false;

      if (posicao >= 0) {
        favoritos.splice(posicao, 1);
        virouFavorito = false;
      } else {
        const l = obterVisiveis().find(function (x) { return x.id === id; }) ||
                  resultados.find(function (x) { return x.id === id; });
        if (!l) {
          return false;
        }
        favoritos.push({
          id: l.id, tipo: l.tipo, nome: l.nome, endereco: l.endereco,
          lat: l.lat, lng: l.lng, categoria: l.categoria, link: l.link,
          nota: l.nota, avaliacoes: l.avaliacoes, entradaAcessivel: l.entradaAcessivel
        });
        virouFavorito = true;
      }

      try {
        localStorage.setItem(config.chaveFavoritos, JSON.stringify(favoritos));
      } catch (erro) {
        console.error(erro);
      }

      if (filtroAtual === "fav") {
        atualizar();
      }

      return virouFavorito;
    }

    async function irParaCidade(texto) {
      const consulta = String(texto || "").trim();
      if (consulta === "") {
        return;
      }

      avisar("Procurando " + consulta + "...");
      try {
        const destino = await procurarEndereco(consulta);
        if (destino === null) {
          avisar("Não encontrei \"" + consulta + "\". Tente outro nome ou endereço.");
          setTimeout(function () { avisar(""); }, 6000);
          return;
        }

        avisar("");
        await irPara(destino);
        await buscarNestaArea();
      } catch (erro) {
        console.error(erro);
        avisar("Não consegui procurar esse endereço agora. Veja o console (F12).");
        setTimeout(function () { avisar(""); }, 6000);
      }
    }

    return {
      // Comandos principais usados pelo site
      buscarNestaArea: buscarNestaArea,
      filtrarPorTipo: filtrarPorTipo,
      filtrarPorTexto: filtrarPorTexto,
      irParaCidade: irParaCidade,
      selecionar: selecionar,
      alternarFavorito: alternarFavorito,
      ehFavorito: ehFavorito,
      redimensionar: redimensionar,

      // Comandos de baixo nível (para usos customizados e exemplo.html)
      capturarArea: capturarArea,
      buscarLocais: buscarLocais,
      procurarEndereco: procurarEndereco,
      irPara: irPara,
      focarEm: focarEm,
      mostrarPinos: mostrarPinos,
      destacarPino: destacarPino,
      abrirJanela: abrirJanela,
      fecharJanela: fecharJanela,
      mapaDoGoogle: mapa
    };
  }

  global.FitMapMaps = {
    versao: VERSAO,
    iniciar: iniciar,
    distanciaKm: distanciaKm,
    escapar: escapar
  };

})(window);
