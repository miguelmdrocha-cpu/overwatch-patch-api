const http = require("http");

const PORT = process.env.PORT || 10000;

const BLIZZARD_URL =
  "https://overwatch.blizzard.com/pt-br/news/patch-notes/live/";

const REQUEST_TIMEOUT = 20000;
const CACHE_TIME = 5 * 60 * 1000;

let cache = {
  data: null,
  timestamp: 0
};

/*
 * ============================================================
 * HERÓIS
 * ============================================================
 */

const HEROES = [
  "D.Va",
  "Doomfist",
  "Hazard",
  "Junker Queen",
  "Mauga",
  "Orisa",
  "Ramattra",
  "Reinhardt",
  "Roadhog",
  "Sigma",
  "Winston",
  "Wrecking Ball",
  "Wrecking Ball",
  "Zarya",

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
  "Soldier: 76",
  "Sombra",
  "Symmetra",
  "Torbjörn",
  "Tracer",
  "Venture",
  "Widowmaker",

  "Ana",
  "Baptiste",
  "Brigitte",
  "Illari",
  "Juno",
  "Kiriko",
  "Lifeweaver",
  "Lúcio",
  "Lucio",
  "Mercy",
  "Moira",
  "Wuyang",
  "Zenyatta"
];

/*
 * ============================================================
 * UTILIDADES DE TEXTO
 * ============================================================
 */

function limparHTML(html) {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(p|div|li|h1|h2|h3|h4|h5|h6|section|article|tr)>/gi,
      "\n"
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCharCode(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limparTexto(texto) {
  return String(texto || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function normalizar(texto) {
  return limparTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function removerDuplicados(lista) {
  const vistos = new Set();

  return (lista || []).filter((item) => {
    const chave =
      typeof item === "string"
        ? normalizar(item)
        : JSON.stringify(item);

    if (!chave || vistos.has(chave)) {
      return false;
    }

    vistos.add(chave);
    return true;
  });
}

/*
 * ============================================================
 * ATRIBUTOS NUMÉRICOS
 * ============================================================
 */

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

/*
 * ============================================================
 * IDENTIFICAÇÃO DE MUDANÇAS
 * ============================================================
 */

function pareceMudanca(texto) {
  const t = normalizar(texto);

  if (!t || t.length < 8) {
    return false;
  }

  const palavras = [
    "aument",
    "reduz",
    "dimin",
    "aumento",
    "aumentar",
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "reducao",
    "reduzir",
    "diminuiu",
    "diminuido",
    "diminuida",
    "diminuicao",

    "mais dano",
    "menos dano",
    "mais vida",
    "menos vida",
    "mais cura",
    "menos cura",

    "alterado",
    "alterada",
    "alterados",
    "alteradas",
    "alteracao",
    "alteracoes",

    "agora",
    "passou",
    "passa",

    "tempo de recarga",
    "recarga",
    "cooldown",

    "dano",
    "vida",
    "cura",
    "velocidade",
    "duracao",
    "municao",
    "alcance",
    "taxa",
    "custo",
    "raio",
    "capacidade",
    "regeneracao",
    "recuperacao",
    "tamanho",
    "projetil",
    "projeteis",

    "corrigido",
    "corrigida",
    "correcao",
    "bug",
    "erro",
    "problema",

    "ajustado",
    "ajustada",
    "ajuste",
    "ajustes"
  ];

  return palavras.some((palavra) =>
    t.includes(palavra)
  );
}

/*
 * ============================================================
 * CLASSIFICAÇÃO BUFF / NERF
 * ============================================================
 */

function classificarMudanca(texto) {
  const t = normalizar(texto);

  /*
   * Casos claramente positivos.
   */
  const positivos = [
    "dano aumentado",
    "dano aumenta",
    "vida aumentada",
    "vida aumenta",
    "cura aumentada",
    "cura aumenta",
    "velocidade aumentada",
    "velocidade aumenta",
    "duracao aumentada",
    "duracao aumenta",
    "municao aumentada",
    "municao aumenta",
    "alcance aumentado",
    "alcance aumenta",
    "raio aumentado",
    "raio aumenta",
    "capacidade aumentada",
    "capacidade aumenta",
    "regeneracao aumentada",
    "regeneracao aumenta",

    "mais dano",
    "mais vida",
    "mais cura",

    "melhorado",
    "melhorada",
    "melhoria",
    "incrementado",
    "incrementada",
    "aprimorado",
    "aprimorada",

    "dano aumentado de",
    "vida aumentada de",
    "cura aumentada de",
    "alcance aumentado de",
    "duracao aumentada de",
    "velocidade aumentada de",

    /*
     * Redução de tempo/custo normalmente beneficia
     * o jogador.
     */
    "tempo de recarga reduzido",
    "tempo de recarga diminui",
    "tempo de recarga diminuiu",
    "recarga reduzida",
    "recarga diminuiu",
    "cooldown reduzido",
    "cooldown diminuiu",
    "intervalo reduzido",
    "intervalo entre ataques reduzido",
    "custo reduzido",
    "custo diminuiu"
  ];

  /*
   * Casos claramente negativos.
   */
  const negativos = [
    "dano reduzido",
    "dano reduz",
    "dano diminuiu",
    "vida reduzida",
    "vida reduz",
    "vida diminuiu",
    "cura reduzida",
    "cura reduz",
    "cura diminuiu",
    "velocidade reduzida",
    "velocidade reduz",
    "duracao reduzida",
    "duracao reduz",
    "municao reduzida",
    "municao reduz",
    "alcance reduzido",
    "alcance reduz",
    "raio reduzido",
    "raio reduz",
    "capacidade reduzida",
    "capacidade reduz",
    "regeneracao reduzida",
    "regeneracao reduz",
    "recuperacao reduzida",
    "recuperacao reduz",
    "taxa reduzida",
    "taxa reduz",

    "tempo de recarga aumentado",
    "recarga aumentada",
    "cooldown aumentado",
    "intervalo aumentado",
    "intervalo entre ataques aumentado",
    "custo aumentado",

    "menos dano",
    "menos vida",
    "menos cura",

    "enfraquecido",
    "enfraquecida"
  ];

  const temPositivo = positivos.some((item) =>
    t.includes(item)
  );

  const temNegativo = negativos.some((item) =>
    t.includes(item)
  );

  /*
   * Primeiro resolvemos os casos específicos.
   */
  if (
    t.includes("tempo de recarga reduzido") ||
    t.includes("recarga reduzida") ||
    t.includes("cooldown reduzido") ||
    t.includes("custo reduzido") ||
    t.includes("intervalo reduzido")
  ) {
    return "buff";
  }

  if (
    t.includes("tempo de recarga aumentado") ||
    t.includes("recarga aumentada") ||
    t.includes("cooldown aumentado") ||
    t.includes("custo aumentado") ||
    t.includes("intervalo aumentado")
  ) {
    return "nerf";
  }

  if (
    t.includes("dano reduzido") ||
    t.includes("vida reduzida") ||
    t.includes("cura reduzida") ||
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
    t.includes("cura aumentada") ||
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

/*
 * ============================================================
 * ATRIBUTOS HTML
 * ============================================================
 */

function extrairAtributosHTML(tag) {
  const attrs = {};
  const corpo = String(tag || "");

  const regex =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])([\s\S]*?)\2/g;

  let match;

  while ((match = regex.exec(corpo)) !== null) {
    attrs[match[1].toLowerCase()] = match[3];
  }

  return attrs;
}

/*
 * ============================================================
 * EXTRAÇÃO DOS ELEMENTOS DA PÁGINA
 * ============================================================
 */

function extrairElementosOrdenados(html) {
  const elementos = [];

  const regex =
    /<(h[1-6]|strong|b|p|li|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  let match;

  while ((match = regex.exec(html))) {
    const tag = match[1].toLowerCase();

    const attrs = extrairAtributosHTML(
      match[2]
    );

    const texto = limparHTML(
      match[3]
    );

    if (!texto) {
      continue;
    }

    elementos.push({
      tag,
      texto,
      html: match[0],
      classe: attrs.class || "",
      id: attrs.id || ""
    });
  }

  return elementos;
}

/*
 * ============================================================
 * NOME DE HABILIDADE
 * ============================================================
 */

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

  if (t.includes("Comentários dos desenvolvedores")) {
    return false;
  }

  if (pareceMudanca(t)) {
    return false;
  }

  if (/[.!?]/.test(t)) {
    return false;
  }

  const n = normalizar(t);

  const bloqueados = [
    "geral",
    "tanque",
    "tanques",
    "dano",
    "suporte",
    "herois",
    "heroi",
    "atualizacoes dos herois",
    "atualizacoes de balanceamento",
    "atualizacao dos herois",
    "correcao de bugs",
    "correcoes de bugs",
    "correcoes",
    "correcao",
    "modo competitivo",
    "notas de patch",
    "patch notes",
    "atualizacao",
    "atualizacoes",
    "mudancas",
    "ajustes",
    "bug fixes",
    "stadium",
    "estadio",
    "mapas"
  ];

  if (bloqueados.includes(n)) {
    return false;
  }

  return true;
}

/*
 * ============================================================
 * ENCONTRAR HERÓI
 * ============================================================
 */

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

function encontrarHero(texto) {
  const alvo = normalizar(texto);

  if (!alvo) {
    return null;
  }

  const lista = [...HEROES].sort(
    (a, b) =>
      normalizar(b).length -
      normalizar(a).length
  );

  /*
   * Primeiro tenta correspondência exata.
   */
  for (const hero of lista) {
    if (normalizar(hero) === alvo) {
      return hero;
    }
  }

  /*
   * Depois aceita o nome do herói no começo/fim
   * do texto curto.
   */
  if (alvo.length <= 60) {
    for (const hero of lista) {
      const h = normalizar(hero);

      if (
        alvo.startsWith(h + " ") ||
        alvo.endsWith(" " + h)
      ) {
        return hero;
      }
    }
  }

  return null;
}

/*
 * ============================================================
 * EXTRAÇÃO PRINCIPAL
 * ============================================================
 */

function extrairMudancasDoTexto(html) {
  const elementos =
    extrairElementosOrdenados(html);

  const mudancas = [];

  let heroiAtual = null;
  let habilidadeAtual = null;

  for (const elemento of elementos) {
    const texto =
      limparTexto(elemento.texto);

    if (!texto) {
      continue;
    }

    /*
     * --------------------------------------------------------
     * HERÓI
     * --------------------------------------------------------
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
     * Alguns títulos podem estar em strong/b.
     */
    if (
      (elemento.tag === "strong" ||
        elemento.tag === "b") &&
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

    if (!heroiAtual) {
      continue;
    }

    /*
     * --------------------------------------------------------
     * HABILIDADE
     * --------------------------------------------------------
     */

    if (
      /^h[1-6]$/.test(elemento.tag) &&
      texto.length <= 100 &&
      !pareceMudanca(texto) &&
      pareceNomeDeHabilidade(texto)
    ) {
      habilidadeAtual = texto;
      continue;
    }

    if (
      (elemento.tag === "strong" ||
        elemento.tag === "b") &&
      texto.length <= 100 &&
      pareceNomeDeHabilidade(texto)
    ) {
      habilidadeAtual = texto;
      continue;
    }

    /*
     * --------------------------------------------------------
     * MUDANÇA
     * --------------------------------------------------------
     */

    if (pareceMudanca(texto)) {
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

  /*
   * Remove duplicatas.
   */
  return removerDuplicados(
    mudancas.map((item) =>
      JSON.stringify(item)
    )
  ).map((item) =>
    JSON.parse(item)
  );
}
/*
 * ============================================================
 * ESTRATÉGIA ALTERNATIVA POR BLOCOS
 * ============================================================
 */

function extrairBlocosPorHeroi(html) {
  const elementos =
    extrairElementosOrdenados(html);

  const mudancas = [];

  let heroiAtual = null;
  let habilidadeAtual = null;

  for (const elemento of elementos) {
    const texto =
      limparTexto(elemento.texto);

    if (!texto) {
      continue;
    }

    /*
     * Detecta herói.
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

    if (
      (elemento.tag === "strong" ||
        elemento.tag === "b") &&
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

    if (!heroiAtual) {
      continue;
    }

    /*
     * Detecta habilidade.
     */
    if (
      elemento.tag !== "li" &&
      elemento.tag !== "p" &&
      texto.length <= 100 &&
      pareceNomeDeHabilidade(texto)
    ) {
      const normalizado =
        normalizar(texto);

      const bloqueios = [
        "comentario dos desenvolvedores",
        "comentarios dos desenvolvedores",
        "atualizacoes",
        "atualizacao",
        "correcao",
        "correcoes",
        "bug fixes",
        "geral",
        "tanque",
        "tanques",
        "dano",
        "suporte",
        "herois",
        "heroi",
        "estadio",
        "stadium",
        "mapas"
      ];

      if (
        !bloqueios.includes(normalizado)
      ) {
        habilidadeAtual = texto;
        continue;
      }
    }

    /*
     * Detecta alteração.
     */
    if (pareceMudanca(texto)) {
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
    mudancas.map((item) =>
      JSON.stringify(item)
    )
  ).map((item) =>
    JSON.parse(item)
  );
}

/*
 * ============================================================
 * EXTRAÇÃO COM FALLBACK
 * ============================================================
 */

function extrairMudancas(html) {
  let mudancas =
    extrairMudancasDoTexto(html);

  mudancas = mudancas.filter(
    (item) =>
      item.heroi &&
      item.texto &&
      item.texto.length >= 5
  );

  if (mudancas.length > 0) {
    return mudancas;
  }

  return extrairBlocosPorHeroi(html);
}

/*
 * ============================================================
 * SEPARAR BUFFS / NERFS / ALTERAÇÕES
 * ============================================================
 */

function separarMudancas(mudancas) {
  const buffs = [];
  const nerfs = [];
  const alteracoes = [];

  for (const mudanca of mudancas || []) {
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

/*
 * ============================================================
 * CORREÇÕES DE BUGS
 * ============================================================
 */

function extrairCorrecoes(html) {
  const elementos =
    extrairElementosOrdenados(html);

  const correcoes = [];

  let dentroDaSecao = false;
  let heroiAtual = null;

  for (const elemento of elementos) {
    const texto =
      limparTexto(elemento.texto);

    if (!texto) {
      continue;
    }

    const normalizado =
      normalizar(texto);

    /*
     * Detecta o início da seção de correções.
     */
    if (
      normalizado.includes(
        "correcao de bugs"
      ) ||
      normalizado.includes(
        "correcoes de bugs"
      ) ||
      normalizado === "correcoes" ||
      normalizado === "correcao" ||
      normalizado.includes(
        "bug fixes"
      )
    ) {
      dentroDaSecao = true;
      heroiAtual = null;
      continue;
    }

    if (!dentroDaSecao) {
      continue;
    }

    /*
     * Detecta novo herói.
     */
    if (
      /^h[1-6]$/.test(elemento.tag) &&
      texto.length <= 60
    ) {
      const hero =
        encontrarHeroExato(texto);

      if (hero) {
        heroiAtual = hero;
        continue;
      }
    }

    if (
      elemento.tag !== "li" &&
      elemento.tag !== "p" &&
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
     * Evita pegar o restante da página como correção.
     */
    if (
      /^h[1-3]$/.test(elemento.tag) &&
      !normalizado.includes("correc")
    ) {
      if (
        normalizado.includes(
          "topo da publicacao"
        ) ||
        normalizado.includes(
          "forum de discussao"
        ) ||
        normalizado.includes(
          "notas de atualizacao em vigor"
        )
      ) {
        break;
      }
    }

    /*
     * Correções normalmente começam com essas palavras.
     */
    const ehCorrecao =
      normalizado.startsWith("corrigimos") ||
      normalizado.startsWith("corrigido") ||
      normalizado.startsWith("corrigida") ||
      normalizado.startsWith("corrigimos um") ||
      normalizado.startsWith("resolvemos") ||
      normalizado.startsWith("resolvido") ||
      normalizado.startsWith("resolvida") ||
      normalizado.startsWith("fixed") ||
      normalizado.startsWith("resolved") ||
      normalizado.includes(
        "corrigimos um problema"
      ) ||
      normalizado.includes(
        "corrigido em uma atualizacao"
      );

    if (ehCorrecao) {
      correcoes.push({
        heroi:
          heroiAtual || "Geral",
        texto
      });
    }
  }

  return removerDuplicados(
    correcoes.map((item) =>
      JSON.stringify(item)
    )
  ).map((item) =>
    JSON.parse(item)
  );
}

/*
 * ============================================================
 * FORMATAÇÃO PARA DISCORD / BDFD
 * ============================================================
 */

function criarTexto(lista) {
  if (!lista || lista.length === 0) {
    return "❌ Nenhuma alteração encontrada.";
  }

  return lista
    .map((item) => {
      const hero =
        item.heroi || "Herói";

      const habilidade =
        item.habilidade &&
        item.habilidade !== "Geral"
          ? `\n  ↳ ${item.habilidade}`
          : "";

      let marcador = "⚪";

      if (item.tipo === "buff") {
        marcador = "🟢";
      } else if (item.tipo === "nerf") {
        marcador = "🔴";
      }

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
    .map((item) => {
      const hero =
        item.heroi &&
        item.heroi !== "Geral"
          ? `**${item.heroi}**\n`
          : "";

      return (
        `🔧 ${hero}> ${item.texto}`
      );
    })
    .join("\n\n");
}

/*
 * ============================================================
 * DIVISÃO EM PARTES PARA O BDFD
 * ============================================================
 */

function dividirTexto(
  texto,
  limite = 1900
) {
  if (!texto) {
    return [];
  }

  const partes = [];
  let atual = "";

  const linhas =
    String(texto).split("\n");

  for (const linha of linhas) {
    const candidato =
      atual.length > 0
        ? atual + "\n" + linha
        : linha;

    if (
      candidato.length > limite
    ) {
      if (atual.trim()) {
        partes.push(
          atual.trim()
        );
      }

      /*
       * Caso uma única linha ultrapasse
       * o limite do Discord.
       */
      if (
        linha.length > limite
      ) {
        let restante = linha;

        while (
          restante.length > limite
        ) {
          partes.push(
            restante.slice(
              0,
              limite
            )
          );

          restante =
            restante.slice(limite);
        }

        atual = restante;
      } else {
        atual = linha;
      }
    } else {
      atual = candidato;
    }
  }

  if (atual.trim()) {
    partes.push(
      atual.trim()
    );
  }

  return partes;
}

/*
 * ============================================================
 * ENCONTRAR HERÓI SOLICITADO PELO BDFD
 * ============================================================
 */

function encontrarHeroiSolicitado(nome) {
  const busca =
    normalizar(nome);

  if (!busca) {
    return null;
  }

  /*
   * Exato primeiro.
   */
  const exato =
    HEROES.find(
      (hero) =>
        normalizar(hero) === busca
    );

  if (exato) {
    return exato;
  }

  /*
   * Depois tenta conter o nome.
   */
  const encontrado =
    HEROES.find((hero) => {
      const h =
        normalizar(hero);

      return (
        h.includes(busca) ||
        busca.includes(h)
      );
    });

  return encontrado || null;
}

/*
 * ============================================================
 * REQUISIÇÃO À BLIZZARD
 * ============================================================
 */

async function requisicaoBlizzard() {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT
    );

  try {
    const resposta =
      await fetch(
        BLIZZARD_URL,
        {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; OverwatchPatchAPI/1.0)",
            "Accept":
              "text/html,application/xhtml+xml",
            "Accept-Language":
              "pt-BR,pt;q=0.9,en;q=0.8"
          },
          signal: controller.signal
        }
      );

    if (!resposta.ok) {
      throw new Error(
        `Blizzard retornou HTTP ${resposta.status}`
      );
    }

    const html =
      await resposta.text();

    if (
      !html ||
      html.length < 1000
    ) {
      throw new Error(
        "A página da Blizzard retornou conteúdo insuficiente."
      );
    }

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

/*
 * ============================================================
 * OBTER DADOS
 * ============================================================
 */

async function obterDados() {
  const agora =
    Date.now();

  /*
   * Usa cache enquanto estiver válido.
   */
  if (
    cache.data &&
    agora - cache.timestamp <
      CACHE_TIME
  ) {
    return cache.data;
  }

  const html =
    await requisicaoBlizzard();

  const mudancas =
    extrairMudancas(html);

  const separados =
    separarMudancas(
      mudancas
    );

  const correcoes =
    extrairCorrecoes(html);

  const textoBuffs =
    criarTexto(
      separados.buffs
    );

  const textoNerfs =
    criarTexto(
      separados.nerfs
    );

  const textoAlteracoes =
    criarTexto(
      separados.alteracoes
    );

  const textoCorrecoes =
    criarTextoCorrecoes(
      correcoes
    );

  const dados = {
    sucesso: true,

    nome:
      "Overwatch Patch API",

    fonte:
      BLIZZARD_URL,

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

    textoCorrecoes,

    /*
     * Compatibilidade com BDFD.
     */
    buffsPartes:
      dividirTexto(
        textoBuffs
      ),

    nerfsPartes:
      dividirTexto(
        textoNerfs
      ),

    alteracoesPartes:
      dividirTexto(
        textoAlteracoes
      ),

    correcoesPartes:
      dividirTexto(
        textoCorrecoes
      )
  };

  cache = {
    data: dados,
    timestamp: agora
  };

  return dados;
}

/*
 * ============================================================
 * RESPOSTAS HTTP
 * ============================================================
 */

function enviarJSON(
  res,
  dados,
  status = 200
) {
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
        "*",

      "Access-Control-Allow-Methods":
        "GET, OPTIONS",

      "Access-Control-Allow-Headers":
        "Content-Type",

      "Cache-Control":
        "no-cache"
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

  res.end(
    String(texto || "")
  );
}

/*
 * ============================================================
 * SERVIDOR
 * ============================================================
 */

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
         * ----------------------------------------------------
         * OPTIONS / CORS
         * ----------------------------------------------------
         */

        if (
          req.method === "OPTIONS"
        ) {
          res.writeHead(
            204,
            {
              "Access-Control-Allow-Origin":
                "*",

              "Access-Control-Allow-Methods":
                "GET, OPTIONS",

              "Access-Control-Allow-Headers":
                "Content-Type"
            }
          );

          return res.end();
        }

        /*
         * ----------------------------------------------------
         * PÁGINA INICIAL
         * ----------------------------------------------------
         */

        if (
          url.pathname === "/"
        ) {
          return enviarJSON(
            res,
            {
              sucesso: true,

              api:
                "Overwatch Patch API",

              status:
                "online",

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
         * ----------------------------------------------------
         * TESTE DA BLIZZARD
         * ----------------------------------------------------
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
         * ----------------------------------------------------
         * TODOS OS DADOS
         * ----------------------------------------------------
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
         * ----------------------------------------------------
         * ENDPOINT /PATCH
         * ----------------------------------------------------
         */

        if (
          url.pathname === "/patch"
        ) {
          const dados =
            await obterDados();

          const nomeHeroi =
            url.searchParams.get(
              "hero"
            );

          /*
           * -----------------------------------------------
           * /patch?hero=D.Va
           * -----------------------------------------------
           */

          if (nomeHeroi) {
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
                    `Herói "${nomeHeroi}" não encontrado.`,

                  heroisDisponiveis:
                    HEROES
                },
                404
              );
            }

            const mudancasHeroi =
              dados.mudancas.filter(
                (item) =>
                  normalizar(
                    item.heroi
                  ) ===
                  normalizar(
                    heroi
                  )
              );

            const correcoesHeroi =
              dados.correcoes.filter(
                (item) =>
                  normalizar(
                    item.heroi
                  ) ===
                  normalizar(
                    heroi
                  )
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

                totalAlteracoes:
                  mudancasHeroi.length,

                mudancas:
                  mudancasHeroi,

                buffs:
                  mudancasHeroi.filter(
                    (item) =>
                      item.tipo ===
                      "buff"
                  ),

                nerfs:
                  mudancasHeroi.filter(
                    (item) =>
                      item.tipo ===
                      "nerf"
                  ),

                alteracoes:
                  mudancasHeroi.filter(
                    (item) =>
                      item.tipo ===
                      "alteracao"
                  ),

                correcoes:
                  correcoesHeroi,

                texto,

                textoMudancas,

                textoCorrecoes:
                  textoCorrecoesHeroi,

                partes:
                  dividirTexto(
                    texto
                  ),

                buffsPartes:
                  dividirTexto(
                    criarTexto(
                      mudancasHeroi.filter(
                        (item) =>
                          item.tipo ===
                          "buff"
                      )
                    )
                  ),

                nerfsPartes:
                  dividirTexto(
                    criarTexto(
                      mudancasHeroi.filter(
                        (item) =>
                          item.tipo ===
                          "nerf"
                      )
                    )
                  ),

                alteracoesPartes:
                  dividirTexto(
                    criarTexto(
                      mudancasHeroi.filter(
                        (item) =>
                          item.tipo ===
                          "alteracao"
                      )
                    )
                  ),

                correcoesPartes:
                  dividirTexto(
                    tex
