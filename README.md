# FitMapMaps

Biblioteca JavaScript simples para usar o **Google Maps + Places API (New)** em páginas web.
Ela abre um mapa escuro, busca locais (academias, restaurantes...) na área visível, desenha pinos e abre
janelinhas. **Não tem nenhuma chave dentro dela**: quem usa informa a própria chave.

A biblioteca cuida só de falar com o Google. Cartões, menus, filtros e favoritos ficam por conta do seu site.

- Um único arquivo, sem instalação, sem dependências: `fitmap-maps.js`
- Licença MIT (veja `LICENSE`)

## Antes de usar: o que precisa no Google Cloud

1. Uma chave de API.
2. As APIs **Maps JavaScript API** e **Places API (New)** ativadas no projeto.
3. Conta de faturamento configurada (o Google exige para usar essas APIs; existe uma cota gratuita mensal).
4. **Restrinja a chave** (Credenciais > sua chave): em "Restrições de aplicativo" permita só os endereços
   do seu site (e `http://localhost:*/*` para testes) e em "Restrições de API" permita só as duas APIs acima.
   Coloque também alertas de orçamento.

## Como instalar

**Opção A: arquivo local** (ao lado do seu site)

```html
<script src="fitmap-maps.js"></script>
```

**Opção B: direto do GitHub, pela CDN jsDelivr** (sem enviar o arquivo junto com o site)

```html
<script src="https://cdn.jsdelivr.net/gh/SEU-USUARIO/fitmap-maps@main/fitmap-maps.js"></script>
```

Troque `SEU-USUARIO` pelo seu usuário do GitHub.

## Comandos principais do objeto `mapa`

| Comando | O que faz |
|---|---|
| `mapa.buscarNestaArea()` | Busca todos os locais na área visível do mapa e atualiza os pinos e a lista (`aoAtualizar`) |
| `mapa.filtrarPorTipo(tipo)` | Filtra por `"todos"`, `"academia"`, `"restaurante"` ou `"fav"` (busca no Google só o que faltar) |
| `mapa.filtrarPorTexto(texto)` | Filtra os locais por nome, endereço ou categoria |
| `mapa.irParaCidade(texto)` | Localiza a cidade/endereço, move o mapa até lá e busca os locais da nova área |
| `mapa.selecionar(id)` | Destaca o pino no mapa, aproxima o zoom, abre a janelinha de detalhes e chama `aoSelecionar` |
| `mapa.alternarFavorito(id)` | Adiciona ou remove dos favoritos (salvos no `localStorage`) e devolve `true` ou `false` |
| `mapa.redimensionar()` | Avisa o Google que a caixa do mapa mudou de tamanho |

## Uso mínimo

```html
<div id="map" style="height: 400px"></div>
<script src="fitmap-maps.js"></script>
<script>
  FitMapMaps.iniciar({
    chave: "SUA_CHAVE_DO_GOOGLE",
    elemento: "map",
    centro: { lat: -9.931042, lng: -67.818991 },
    zoom: 14,
    buscas: { academia: "academias" }
  }).then(async function (mapa) {
    const area = mapa.capturarArea();
    const lugares = await mapa.buscarLocais("academia", area);
    mapa.mostrarPinos(lugares);
  });
</script>
```

Veja também o `exemplo.html`.

## Opções do `FitMapMaps.iniciar({...})`

| Opção | O que é | Padrão |
|---|---|---|
| `chave` | Sua chave de API do Google (obrigatória) | — |
| `elemento` | id da `<div>` do mapa, ou o próprio elemento (obrigatória) | — |
| `centro` | `{ lat, lng }` onde o mapa abre | São Paulo |
| `zoom` | De 1 (mundo) a 20 (rua) | `14` |
| `buscas` | `{ tipo: "texto da busca" }`, ex.: `{ academia: "academias" }` | `{}` |
| `pedirNotaEHorario` | `true` pede nota, nº de avaliações e horário (busca de faixa mais cara no Google) | `false` |
| `pedirFoto` | `true` traz a foto de cada local (o Google cobra por foto exibida) | `false` |
| `maxResultados` | Locais por busca, de 1 a 20 | `20` |
| `tema` | `"escuro"` ou `"claro"` | `"escuro"` |
| `idioma` / `regiao` | Idioma e região dos resultados | `"pt-BR"` / `"BR"` |
| `mapId` | ID do mapa no Google Cloud | `"DEMO_MAP_ID"` |
| `desenharPino` | `function(lugar)` que devolve o elemento HTML do pino | pino padrão |
| `aoClicarNoPino` | `function(id)` chamada ao clicar num pino | — |
| `aoErro` | `function(mensagem)` chamada se algo der errado | — |

`iniciar` devolve uma *Promise* que entrega o objeto `mapa` quando o mapa termina de abrir.

## Comandos do objeto `mapa`

| Comando | O que faz |
|---|---|
| `mapa.capturarArea()` | Devolve `{ limites, centro }` da parte visível do mapa (ou `null`) |
| `mapa.buscarLocais(tipo, area)` | *Promise* com a lista de locais do `tipo` dentro da `area` |
| `mapa.procurarEndereco(texto)` | *Promise* com `{ centro, limites }` de uma cidade/endereço (ou `null`) |
| `mapa.irPara(destino)` | *Promise*; leva o mapa até o `destino` e espera ele parar |
| `mapa.focarEm(lat, lng, zoomMinimo)` | Centraliza num ponto e aproxima se estiver longe |
| `mapa.mostrarPinos(lugares)` | Troca todos os pinos do mapa pelos desta lista |
| `mapa.destacarPino(id)` | Põe a classe CSS `sel` só no pino escolhido |
| `mapa.abrirJanela(id, html)` / `mapa.fecharJanela()` | Abre/fecha a janelinha do pino |
| `mapa.redimensionar()` | Avisa o Google que a caixa do mapa mudou de tamanho |
| `mapa.mapaDoGoogle` | O objeto original do Google (uso avançado) |
| `FitMapMaps.distanciaKm(a, b)` | Distância em km entre dois pontos `{ lat, lng }` |

Cada local devolvido por `buscarLocais` tem o formato:

```js
{ id, tipo, nome, endereco, lat, lng, categoria, link, nota, avaliacoes, statusHorario, foto }
```

| Campo | O que é |
|---|---|
| `endereco` | Endereço curto, ex.: `"R. Hélio Melo, 123 - Centro"` |
| `categoria` | Tipo do local segundo o Google, ex.: `"Academia"` |
| `nota` / `avaliacoes` | Nota de 1 a 5 e quantidade de avaliações (`nota` é `null` se não há avaliações). Precisam de `pedirNotaEHorario: true` |
| `statusHorario` | `null` ou `{ aberto: true, fechaAs: "22:00" }`, `{ aberto: true, vinteEQuatroHoras: true }`, `{ aberto: false, abreAs: "06:00", abreDia: 1, abreLogo: true }` (`abreDia`: 0 = domingo ... 6 = sábado; `abreLogo`: abre em menos de 24 h). Precisa de `pedirNotaEHorario: true`; usa o fuso do próprio local |
| `foto` | `null` ou `{ url, autor, autorLink }`. Precisa de `pedirFoto: true`. Ao exibir a foto, mostre também o nome do autor (exigência do Google) |

## Custos (resumo)

A busca simples (sem `pedirNotaEHorario`) fica na faixa mais barata do Google. Pedir nota, avaliações e horário move a busca para uma faixa mais cara, com cota gratuita mensal menor. Cada foto exibida (`pedirFoto`) também é cobrada. Confira os preços atuais em <https://developers.google.com/maps/billing-and-pricing/pricing> e configure alertas de orçamento.

## Observações

- O Google devolve no máximo 20 locais por busca. Para ver mais, mova o mapa e busque de novo.
- Para a restrição da chave por site funcionar, abra a página por um servidor (`http://localhost`), não por `file://`.
- Esta biblioteca não é um produto do Google, apenas usa as APIs dele.
