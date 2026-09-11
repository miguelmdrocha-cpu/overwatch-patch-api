const http = require("http");

const PORT = process.env.PORT || 10000;

const BLIZZARD_URL =
  "https://overwatch.blizzard.com/pt-br/news/patch-notes/live/";

const REQUEST_TIMEOUT = 20000;
const CACHE_TIME = 5 * 60 * 1000;

let cache = {
  data: null,
  time: 0
};

const HEROES = [
  "D.Va",
  "D.Mon",
  "Domina",
  "Mauga",
  "Winston",
  "Wrecking Ball",
  "Zarya",
  "Orisa",
  "Ramattra",
  "Reinhardt",
  "Roadhog",
  "Rainha Junker",
  "Junker Queen",
  "Hazard",
  "Doomfist",
  "Sigma",

  "Baptiste",
  "Brigitte",
  "Illari",
  "Juno",
  "Kiriko",
  "Lifeweaver",
  "Lucio",
  "Lúcio",
  "Mercy",
  "Moira",
  "Wuyang",
  "Zenyatta",

  "Ana",
  "Ashe",
  "Bastion",
  "Cassidy",
  "Echo",
  "Freja",
  "Genji",
  "Hanzo",
  "Junkrat",
  "Mei",
  "Pharah",
  "Reaper",
  "Sojourn",
  "Soldado: 76",
  "Soldier: 76",
  "Sombra",
  "Symmetra",
  "Torbjörn",
  "Tracer",
  "Venture",
  "Vendetta",
  "Widowmaker",
  "Anran",
  "Sierra",
  "Jetpack Cat"
];

function limparHTML(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizar(texto) {
  return limparTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function removerDuplicados(lista) {
  const vistos = new Set();

  return lista.filter(item => {
    const chave =
      typeof item === "string"
        ? normalizar(item)
        : JSON.stringify(item);

    if (vistos.has(chave)) {
      return false;
    }

    vistos.add(chave);
    return true;
  });
}

function limparTexto(texto) {
  return String(texto || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pareceMudanca(texto) {
  const t = normalizar(texto);

  if (!t) {
    return false;
  }

  if (t.length < 8) {
    return false;
  }

  const palavras = [
    "aument",
    "reduz",
    "diminu",
    "diminui",
    "aumentado",
    "aumentada",
    "reduzido",
    "reduzida",
    "alterado",
    "alterada",
    "agora",
    "passou",
    "passa",
    "tempo de recarga",
    "dano",
    "vida",
    "municao",
    "alcance",
    "duracao",
    "velocidade",
    "taxa",
    "custo",
    "raio",
    "tamanho",
    "projetil",
    "projeteis",
    "conversao",
    "porcentagem",
    "s",
    "segundo",
    "segundos"
  ];

  return palavras.some(palavra =>
    t.includes(palavra)
  );
}

function classificarMudanca(texto) {
  const t = normalizar(texto);

  const positivos = [
    "aumentado",
    "aumentada",
    "aumentou",
    "aumentar",
    "reduzido de",
    "reduzida de",
    "reduzido para",
    "reduzida para",
    "tempo de recarga reduzido",
    "custo reduzido",
    "dano aumentado",
    "vida aumentada",
    "alcance aumentado",
    "duracao aumentada",
    "velocidade aumentada",
    "taxa aumentada"
  ];

  const negativos = [
    "reduzido",
    "reduzida",
    "reduziu",
    "reduzir",
    "aumentado de",
    "aumentada de",
    "aumentado para",
    "aumentada para",
    "tempo de recarga aumentado",
    "custo aumentado",
    "dano reduzido",
    "vida reduzida",
    "alcance reduzido",
    "duracao reduzida",
    "velocidade reduzida",
    "taxa reduzida"
  ];

  const temPositivo = positivos.some(p =>
    t.includes(p)
  );

  const temNegativo = negativos.some(p =>
    t.includes(p)
  );

  /*
   * Em português, palavras como "reduzido" podem ser
   * buff ou nerf dependendo do atributo.
   *
   * Para recarga/custo:
   * reduzir = buff
   *
   * Para dano/vida/alcance:
   * reduzir = nerf
   */

  if (
    t.includes("tempo de recarga reduzido") ||
    t.includes("custo reduzido") ||
    t.includes("tempo de recarga diminu") ||
    t.includes("custo diminu")
  ) {
    return "buff";
  }

  if (
    t.includes("dano reduzido") ||
    t.includes("vida reduzida") ||
    t.includes("alcance reduzido") ||
    t.includes("duracao reduzida") ||
    t.includes("velocidade reduzida") ||
    t.includes("taxa reduzida")
  ) {
    return "nerf";
  }

  if (
    t.includes("dano aumentado") ||
    t.includes("vida aumentada") ||
    t.includes("alcance aumentado") ||
    t.includes("duracao aumentada") ||
    t.includes("velocidade aumentada") ||
    t.includes("taxa aumentada")
  ) {
    return "buff";
  }

  if (temPositivo && !temNegativo) {
    return "buff";
  }

  if (temNegativo && !temPositivo) {
    return "nerf";
  }

  return "alteracao";
}

function extrairAtributos(texto) {
  const t = limparTexto(texto);

  const encontrados = [];

  const padroes = [
    /(?:de|era|eram)\s+([0-9.,]+(?:\s*%|\s*s|\s*ms|\s*m)?)/gi,
    /(?:para)\s+([0-9.,]+(?:\s*%|\s*s|\s*ms|\s*m)?)/gi
  ];

  for (const regex of padroes) {
    let match;

    while ((match = regex.exec(t)) !== null) {
      encontrados.push(match[1]);
    }
  }

  return removerDuplicados(encontrados);
}

function extrairElementosOrdenados(html) {
  const elementos = [];

  const regex =
    /<(h[1-6]|li|p|div)[^>]*>([\s\S]*?)<\/\1>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();

    const texto = limparHTML(match[2]);

    if (!texto) {
      continue;
    }

    elementos.push({
      tag,
      texto
    });
  }

  return elementos;
}

function pareceNomeDeHabilidade(texto) {
  const t = limparTexto(texto);

  if (!t) {
    return false;
  }

  if (t.length > 100) {
    return false;
  }

  if (t.includes("Comentário dos desenvolvedores")) {
    return false;
  }

  if (pareceMudanca(t)) {
    return false;
  }

  const inicio = normalizar(t);

  const bloqueados = [
    "geral",
    "tanque",
    "dano",
    "suporte",
    "herois",
    "heroi",
    "atualizacoes dos herois",
    "atualizacoes de balanceamento",
    "correcao de bugs",
    "correcoes de bugs",
    "bug fixes",
    "stadium",
    "estadio",
    "mapas"
  ];

  if (bloqueados.includes(inicio)) {
    return false;
  }

  return true;
}

function encontrarHero(texto) {
  const alvo = normalizar(texto);

  if (!alvo) {
    return null;
  }

  /*
   * Ordena pelo nome mais longo primeiro para evitar
   * conflitos como "Junker Queen" / "Rainha Junker".
   */

  const lista = [...HEROES].sort(
    (a, b) =>
      normalizar(b).length -
      normalizar(a).length
  );

  for (const hero of lista) {
    const h = normalizar(hero);

    if (
      alvo === h ||
      alvo.startsWith(h + " ") ||
      alvo.endsWith(" " + h) ||
      alvo.includes("\n" + h)
    ) {
      return hero;
    }
  }

  return null;
}

function encontrarHeroExato(texto) {
  const alvo = normalizar(texto);

  if (!alvo) {
    return null;
  }

  const lista = [...HEROES].sort(
    (a, b) =>
      normalizar(b).length -
      normalizar(a).length
  );

  for (const hero of lista) {
    if (normalizar(hero) === alvo) {
      return hero;
    }
  }

  return null;
}

function extrairBlocosPorHeroi(html) {
  const elementos = extrairElementosOrdenados(html);

  const blocos = [];

  let heroiAtual = null;
  let habilidadeAtual = null;
  let patchAtual = null;

  for (const elemento of elementos) {
    const texto = elemento.texto;

    /*
     * Somente títulos curtos são considerados como possível
     * título de herói. Isso evita trocar o herói porque o
     * nome dele apareceu dentro de uma frase.
     */

    if (
      /^h[1-6]$/.test(elemento.tag) &&
      texto.length <= 60
    ) {
      const heroExato =
        encontrarHeroExato(texto);

      if (heroExato) {
        heroiAtual = heroExato;
        habilidadeAtual = null;
        continue;
      }
    }

    /*
     * Também reconhece alguns casos em que o HTML da Blizzard
     * usa um elemento diferente para o nome do herói.
     */

    if (
      elemento.tag !== "li" &&
      texto.length <= 60
    ) {
      const heroExato =
        encontrarHeroExato(texto);

      if (heroExato) {
        heroiAtual = heroExato;
        habilidadeAtual = null;
        continue;
      }
    }

    /*
     * Nome de habilidade normalmente aparece antes dos
     * bullets de alteração.
     */

    if (
      heroiAtual &&
      elemento.tag !== "li" &&
      elemento.tag !== "p" &&
      pareceNomeDeHabilidade(texto)
    ) {
      habilidadeAtual = texto;
      continue;
    }

    /*
     * Mudança encontrada.
     */

    if (
      heroiAtual &&
      pareceMudanca(texto)
    ) {
      blocos.push({
        heroi: heroiAtual,
        habilidade:
          habilidadeAtual || "Geral",
        texto,
        tipo: classificarMudanca(texto),
        atributos: extrairAtributos(texto),
        patch: patchAtual
      });
    }
  }

  return blocos;
  function extrairMudancasDoTexto(html) {
  const elementos = extrairElementosOrdenados(html);

  const mudancas = [];

  let heroiAtual = null;
  let habilidadeAtual = null;

  for (const elemento of elementos) {
    const texto = limparTexto(elemento.texto);

    if (!texto) {
      continue;
    }

    /*
     * Herói: só aceitamos correspondência EXATA em títulos
     * para evitar que uma frase sobre outro personagem
     * altere o herói atual.
     */

    if (
      /^h[1-6]$/.test(elemento.tag) &&
      texto.length <= 60
    ) {
      const hero =
        encontrarHeroExato(texto);

      if (hero) {
        heroiAtual = hero;
        habilidadeAtual = null;
        continue;
      }
    }

    /*
     * Alguns blocos da Blizzard podem não usar h5/h4.
     * Aceitamos também texto curto que seja exatamente
     * o nome de um herói.
     */

    if (
      elemento.tag !== "li" &&
      texto.length <= 60
    ) {
      const hero =
        encontrarHeroExato(texto);

      if (hero) {
        heroiAtual = hero;
        habilidadeAtual = null;
        continue;
      }
    }

    /*
     * Títulos de habilidade/arma.
     */

    if (
      heroiAtual &&
      elemento.tag !== "li" &&
      pareceNomeDeHabilidade(texto)
    ) {
      const bloqueios = [
        "comentario dos desenvolvedores",
        "atualizacoes",
        "atualizacao",
        "correcao",
        "correcoes",
        "bug fixes",
        "herois",
        "heroi",
        "geral",
        "tanque",
        "dano",
        "suporte",
        "estadio",
        "mapas"
      ];

      const normalizado =
        normalizar(texto);

      if (
        !bloqueios.includes(normalizado)
      ) {
        habilidadeAtual = texto;
        continue;
      }
    }

    /*
     * Mudança.
     */

    if (
      heroiAtual &&
      pareceMudanca(texto)
    ) {
      mudancas.push({
        heroi: heroiAtual,
        habilidade:
          habilidadeAtual || "Geral",
        texto,
        tipo: classificarMudanca(texto),
        atributos: extrairAtributos(texto)
      });
    }
  }

  return removerDuplicados(
    mudancas.map(item =>
      JSON.stringify(item)
    )
  ).map(item =>
    JSON.parse(item)
  );
}

function extrairMudancas(html) {
  const mudancas =
    extrairMudancasDoTexto(html);

  /*
   * Se a primeira estratégia não encontrar nada,
   * tentamos a estratégia baseada em blocos.
   */

  if (mudancas.length > 0) {
    return mudancas;
  }

  return extrairBlocosPorHeroi(html);
}

function separarMudancas(mudancas) {
  const buffs = [];
  const nerfs = [];
  const alteracoes = [];

  for (const mudanca of mudancas) {
    if (mudanca.tipo === "buff") {
      buffs.push(mudanca);
    } else if (mudanca.tipo === "nerf") {
      nerfs.push(mudanca);
    } else {
      alteracoes.push(mudanca);
    }
  }

  return {
    buffs,
    nerfs,
    alteracoes
  };
}

function extrairSecaoPorTitulo(html, titulos) {
  const elementos =
    extrairElementosOrdenados(html);

  const procurados =
    titulos.map(normalizar);

  const resultado = [];

  let ativo = false;

  for (const elemento of elementos) {
    const textoNormalizado =
      normalizar(elemento.texto);

    if (
      procurados.includes(textoNormalizado)
    ) {
      ativo = true;
      continue;
    }

    if (
      ativo &&
      /^h[1-6]$/.test(elemento.tag) &&
      textoNormalizado !== ""
    ) {
      /*
       * Ao encontrar outra seção principal,
       * encerramos a seção atual.
       */

      if (
        !procurados.includes(textoNormalizado)
      ) {
        break;
      }
    }

    if (ativo) {
      resultado.push(elemento);
    }
  }

  return resultado;
}

function extrairCorrecoes(html) {
  const elementos =
    extrairElementosOrdenados(html);

  const correcoes = [];

  let dentroDaSecao = false;
  let heroiAtual = null;

  for (const elemento of elementos) {
    const texto = limparTexto(elemento.texto);

    if (!texto) {
      continue;
    }

    const normalizado =
      normalizar(texto);

    /*
     * Detecta as seções de correções da Blizzard.
     */

    if (
      normalizado.includes("correcao de bugs") ||
      normalizado.includes("correcoes de bugs") ||
      normalizado.includes("bug fixes")
    ) {
      dentroDaSecao = true;
      heroiAtual = null;
      continue;
    }

    if (!dentroDaSecao) {
      continue;
    }

    /*
     * Se aparecer uma nova grande seção,
     * podemos encerrar a busca.
     */

    if (
      /^h[1-3]$/.test(elemento.tag) &&
      !normalizado.includes("correc")
    ) {
      if (
        normalizado.includes("topo da publicacao") ||
        normalizado.includes("forum de discussao") ||
        normalizado.includes("notas de atualizacao em vigor")
      ) {
        break;
      }
    }

    /*
     * Detecta o nome do herói dentro da seção
     * de correções.
     */

    if (
      elemento.tag !== "li" &&
      texto.length <= 60
    ) {
      const hero =
        encontrarHeroExato(texto);

      if (hero) {
        heroiAtual = hero;
        continue;
      }
    }

    /*
     * Correções normalmente começam com:
     * "Corrigimos..."
     * "Corrigido..."
     * "Resolvido..."
     * "Fixed..."
     */

    const ehCorrecao =
      normalizado.startsWith("corrigimos") ||
      normalizado.startsWith("corrigido") ||
      normalizado.startsWith("corrigida") ||
      normalizado.startsWith("resolvemos") ||
      normalizado.startsWith("resolvido") ||
      normalizado.startsWith("resolvida") ||
      normalizado.startsWith("fixed") ||
      normalizado.startsWith("resolved");

    if (
      ehCorrecao ||
      normalizado.includes("corrigimos um problema") ||
      normalizado.includes("corrigido em uma atualizacao")
    ) {
      correcoes.push({
        heroi: heroiAtual || "Geral",
        texto
      });
    }
  }

  return removerDuplicados(
    correcoes.map(item =>
      JSON.stringify(item)
    )
  ).map(item =>
    JSON.parse(item)
  );
}

function criarTexto(lista) {
  if (!lista || lista.length === 0) {
    return "❌ Nenhuma alteração encontrada.";
  }

  return lista
    .map(item => {
      const hero =
        item.heroi || "Herói";

      const habilidade =
        item.habilidade &&
        item.habilidade !== "Geral"
          ? `\n  ↳ ${item.habilidade}`
          : "";

      const marcador =
        item.tipo === "buff"
          ? "🟢"
          : item.tipo === "nerf"
          ? "🔴"
          : "⚪";

      return (
        `${marcador} **${hero}**${habilidade}\n` +
        `> ${item.texto}`
      );
    })
    .join("\n\n");
}

function criarTextoCorrecoes(lista) {
  if (!lista || lista.length === 0) {
    return "❌ Nenhuma correção encontrada.";
  }

  return lista
    .map(item => {
      return (
        `🛠️ **${item.heroi}**\n` +
        `> ${item.texto}`
      );
    })
    .join("\n\n");
}

function dividirTexto(texto, limite = 1900) {
  if (!texto) {
    return [""];
  }

  const partes = [];

  let atual = "";

  const linhas = String(texto).split("\n");

  for (const linha of linhas) {
    if (
      (atual + "\n" + linha).length > limite
    ) {
      if (atual.trim()) {
        partes.push(atual.trim());
      }

      atual = linha;
    } else {
      atual +=
        (atual ? "\n" : "") + linha;
    }
  }

  if (atual.trim()) {
    partes.push(atual.trim());
  }

  return partes.length > 0
    ? partes
    : [""];
}

function encontrarHeroiSolicitado(nome) {
  const busca = normalizar(nome);

  if (!busca) {
    return null;
  }

  const exato =
    HEROES.find(
      hero => normalizar(hero) === busca
    );

  if (exato) {
    return exato;
  }

  return HEROES.find(hero =>
    normalizar(hero).includes(busca) ||
    busca.includes(normalizar(hero))
  ) || null;
}

async function requisicaoBlizzard() {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

  try {
    const resposta = await fetch(
      BLIZZARD_URL,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; OverwatchPatchAPI/1.0)",
          "Accept":
            "text/html,application/xhtml+xml"
        },
        signal: controller.signal
      }
    );

    if (!resposta.ok) {
      throw new Error(
        `Blizzard retornou HTTP ${resposta.status}`
      );
    }

    return await resposta.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function obterDados() {
  const agora = Date.now();

  if (
    cache.data &&
    agora - cache.time < CACHE_TIME
  ) {
    return cache.data;
  }

  const html =
    await requisicaoBlizzard();

  const mudancas =
    extrairMudancas(html);

  const separados =
    separarMudancas(mudancas);

  const correcoes =
    extrairCorrecoes(html);

  const textoBuffs =
    criarTexto(separados.buffs);

  const textoNerfs =
    criarTexto(separados.nerfs);

  const textoAlteracoes =
    criarTexto(separados.alteracoes);

  const textoCorrecoes =
    criarTextoCorrecoes(correcoes);

  const textoTudo = [
    criarTexto(mudancas),
    textoCorrecoes
  ]
    .filter(Boolean)
    .join("\n\n");

  const dados = {
    sucesso: true,

    fonte: BLIZZARD_URL,

    atualizadoEm:
      new Date().toISOString(),

    totalAlteracoes:
      mudancas.length,

    mudancas,

    buffs:
      separados.buffs,

    nerfs:
      separados.nerfs,

    alteracoes:
      separados.alteracoes,

    correcoes,

    texto:
      criarTexto(mudancas),

    textoBuffs,

    textoNerfs,

    textoAlteracoes,

    textoTudo,

    textoCorrecoes,

    /*
     * Compatibilidade com os comandos
     * atuais do BDFD.
     */

    buffsPartes:
      dividirTexto(textoBuffs),

    nerfsPartes:
      dividirTexto(textoNerfs),

    alteracoesPartes:
      dividirTexto(textoAlteracoes),

    correcoesPartes:
      dividirTexto(textoCorrecoes),

    tudoPartes:
      dividirTexto(textoTudo)
  };

  cache = {
    data: dados,
    time: agora
  };

  return dados;
}

function enviarJSON(res, dados, status = 200) {
  const corpo =
    JSON.stringify(
      dados,
      null,
      2
    );

  res.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",
      "Access-Control-Allow-Origin":
        "*"
    }
  );

  res.end(corpo);
}

function enviarTexto(
  res,
  texto,
  status = 200
) {
  res.writeHead(
    status,
    {
      "Content-Type":
        "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin":
        "*"
    }
  );

  res.end(texto);
}

const server =
  http.createServer(
    async (req, res) => {
      try {
        const url =
          new URL(
            req.url,
            `http://${req.headers.host || "localhost"}`
          );

        /*
         * Página inicial.
         */

        if (url.pathname === "/") {
          return enviarJSON(
            res,
            {
              sucesso: true,
              api:
                "Overwatch Patch API",
              status: "online",
              fonte:
                BLIZZARD_URL,
              endpoints: [
                "/",
                "/test-blizzard",
                "/dados",
                "/patch",
                "/patch?hero=D.Va"
              ]
            }
          );
        }

        /*
         * Teste direto da Blizzard.
         */

        if (
          url.pathname ===
          "/test-blizzard"
        ) {
          const html =
            await requisicaoBlizzard();

          return enviarJSON(
            res,
            {
              sucesso: true,
              fonte:
                BLIZZARD_URL,
              tamanhoHTML:
                html.length,
              mensagem:
                "Página da Blizzard acessada com sucesso."
            }
          );
        }

        /*
         * Endpoint principal usado pelo BDFD.
         */

        if (
          url.pathname === "/dados"
        ) {
          const dados =
            await obterDados();

          return enviarJSON(
            res,
            dados
          );
        }

        /*
         * Endpoint para consultar um herói.
         */

        if (
          url.pathname === "/patch"
        ) {
          const nomeHeroi =
            url.searchParams.get(
              "hero"
            );

          if (!nomeHeroi) {
            return enviarJSON(
              res,
              {
                sucesso: false,
                erro:
                  "Informe o nome do herói. Exemplo: /patch?hero=D.Va"
              },
              400
            );
          }

          const dados =
            await obterDados();

          const heroi =
            encontrarHeroiSolicitado(
              nomeHeroi
            );

          if (!heroi) {
            return enviarJSON(
              res,
              {
                sucesso: false,
                erro:
                  "Herói não encontrado.",
                heroisDisponiveis:
                  HEROES
              },
              404
            );
          }

          const mudancasHeroi =
            dados.mudancas.filter(
              item =>
                normalizar(item.heroi) ===
                normalizar(heroi)
            );

          const correcoesHeroi =
            dados.correcoes.filter(
              item =>
                normalizar(item.heroi) ===
                normalizar(heroi)
            );

          const textoMudancas =
            criarTexto(
              mudancasHeroi
            );

          const textoCorrecoesHeroi =
            criarTextoCorrecoes(
              correcoesHeroi
            );

          const texto = [
            `🦸 **${heroi}**`,
            "",
            "### Alterações",
            textoMudancas,
            "",
            "### Correções",
            textoCorrecoesHeroi
          ].join("\n");

          return enviarJSON(
            res,
            {
              sucesso: true,
              heroi,
              mudancas:
                mudancasHeroi,
              correcoes:
                correcoesHeroi,
              texto
            }
          );
        }

        return enviarJSON(
          res,
          {
            sucesso: false,
            erro:
              "Endpoint não encontrado."
          },
          404
        );
      } catch (erro) {
        console.error(
          "Erro na API:",
          erro
        );

        return enviarJSON(
          res,
          {
            sucesso: false,
            erro:
              erro.message ||
              "Erro interno da API."
          },
          500
        );
      }
    }
  );

server.listen(
  PORT,
  () => {
    console.log(
      `Overwatch Patch API rodando na porta ${PORT}`
    );
  }
);
}
