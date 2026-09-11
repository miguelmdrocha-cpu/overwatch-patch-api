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

/* =========================================================
   UTILITÁRIOS
========================================================= */

function limparHTML(texto) {
  if (!texto) return "";

  return String(texto)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]*>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&hellip;/gi, "…")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 16));
      } catch {
        return "";
      }
    })
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(texto) {
  return limparHTML(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function removerDuplicados(lista) {
  const vistos = new Set();
  const resultado = [];

  for (const item of lista) {
    const chave = JSON.stringify(item);

    if (!vistos.has(chave)) {
      vistos.add(chave);
      resultado.push(item);
    }
  }

  return resultado;
}

function ehTextoIgnoravel(texto) {
  const t = normalizar(texto);

  if (!t) return true;

  const ignorados = [
    "comentario dos desenvolvedores",
    "comentarios dos desenvolvedores",
    "atualizacoes dos herois",
    "correcao de problemas",
    "correcoes",
    "correcoes de problemas",
    "stadium",
    "mudancas gerais",
    "geral",
    "tank",
    "dano",
    "suporte"
  ];

  return ignorados.includes(t);
}

/* =========================================================
   HERÓIS
========================================================= */

const NOMES_HEROIS = [
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

const HEROES_NORMALIZADOS = new Map(
  NOMES_HEROIS.map(nome => [normalizar(nome), nome])
);

function encontrarHeroi(texto) {
  const chave = normalizar(texto);

  if (HEROES_NORMALIZADOS.has(chave)) {
    return HEROES_NORMALIZADOS.get(chave);
  }

  return null;
}

/* =========================================================
   CLASSIFICAÇÃO
========================================================= */

function classificarMudanca(texto) {
  const t = normalizar(texto);

  const buffsEspecificos = [
    "recarga reduzida",
    "tempo de recarga reduzido",
    "tempo de recarga diminui",
    "tempo de recarga diminuido",
    "tempo de recarga diminuiu",
    "intervalo reduzido",
    "intervalo diminui",
    "intervalo diminuido",
    "intervalo entre ataques reduzido",
    "cooldown reduzido",
    "cooldown diminui",
    "cooldown diminuido",

    "dano aumentado",
    "dano aumenta",
    "vida aumentada",
    "vida aumenta",
    "cura aumentada",
    "cura aumenta",
    "velocidade aumentada",
    "velocidade aumenta",
    "velocidade do projetil aumentada",
    "velocidade do projetil aumenta",
    "duracao aumentada",
    "duracao aumenta",
    "municao aumentada",
    "municao aumenta",
    "alcance aumentado",
    "alcance aumenta",
    "raio aumentado",
    "raio aumenta",
    "capacidade aumentada",
    "regeneracao aumentada",
    "recuperacao aumentada"
  ];

  const nerfsEspecificos = [
    "recarga aumentada",
    "tempo de recarga aumentado",
    "tempo de recarga aumenta",
    "tempo de recarga aumentou",
    "intervalo aumentado",
    "intervalo aumenta",
    "intervalo entre ataques aumentado",
    "cooldown aumentado",
    "cooldown aumenta",

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
    "velocidade do projetil reduzida",
    "velocidade do projetil reduz",
    "duracao reduzida",
    "duracao reduz",
    "municao reduzida",
    "municao reduz",
    "alcance reduzido",
    "alcance reduz",
    "raio reduzido",
    "raio reduz",
    "capacidade reduzida",
    "regeneracao reduzida",
    "recuperacao reduzida"
  ];

  if (
    buffsEspecificos.some(
      palavra => t.includes(normalizar(palavra))
    )
  ) {
    return "buff";
  }

  if (
    nerfsEspecificos.some(
      palavra => t.includes(normalizar(palavra))
    )
  ) {
    return "nerf";
  }

  const palavrasBuff = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "aumento",
    "aumentar",
    "mais dano",
    "mais vida",
    "mais cura",
    "melhorado",
    "melhorada",
    "melhoria",
    "incrementado",
    "incrementada",
    "aprimorado",
    "aprimorada"
  ];

  const palavrasNerf = [
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "redução",
    "reduzir",
    "diminuiu",
    "diminuido",
    "diminuída",
    "diminuição",
    "menos dano",
    "menos vida",
    "menos cura",
    "enfraquecido",
    "enfraquecida"
  ];

  const encontrouBuff =
    palavrasBuff.some(
      palavra =>
        t.includes(normalizar(palavra))
    );

  const encontrouNerf =
    palavrasNerf.some(
      palavra =>
        t.includes(normalizar(palavra))
    );

  if (
    encontrouBuff &&
    encontrouNerf
  ) {
    return "alteracao";
  }

  if (encontrouBuff) {
    return "buff";
  }

  if (encontrouNerf) {
    return "nerf";
  }

  return "alteracao";
}

/* =========================================================
   EXTRAÇÃO DE TÍTULOS
========================================================= */

function extrairTitulos(html) {
  const titulos = [];

  const regex =
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const texto =
      limparHTML(match[2]);

    if (
      texto &&
      !titulos.some(
        titulo =>
          normalizar(titulo) ===
          normalizar(texto)
      )
    ) {
      titulos.push(texto);
    }
  }

  return titulos;
}

/* =========================================================
   EXTRAÇÃO ESTRUTURAL
========================================================= */

function extrairElementosOrdenados(html) {
  const elementos = [];

  const regex =
    /<(h([1-6])|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const tag =
      match[1].toLowerCase();

    const nivel =
      match[2]
        ? Number(match[2])
        : null;

    const conteudo =
      match[3] || "";

    const texto =
      limparHTML(conteudo);

    if (!texto) {
      continue;
    }

    elementos.push({
      tipo:
        tag === "li"
          ? "li"
          : "heading",

      nivel,

      texto,

      html:
        conteudo,

      index:
        match.index
    });
  }

  return elementos;
}

/* =========================================================
   HABILIDADES / ARMAS
========================================================= */

function pareceNomeDeHabilidade(texto) {
  const t =
    normalizar(texto);

  if (
    !t ||
    t.length < 2 ||
    t.length > 100
  ) {
    return false;
  }

  if (
    encontrarHeroi(texto)
  ) {
    return false;
  }

  if (
    ehTextoIgnoravel(texto)
  ) {
    return false;
  }

  const bloqueados = [
    "atualizacoes",
    "atualizacao",
    "comentario",
    "correcao",
    "correcoes",
    "bug",
    "bugs",
    "notas de atualizacao",
    "patch notes",
    "habilidades",
    "armas"
  ];

  if (
    bloqueados.some(
      palavra =>
        t === normalizar(palavra)
    )
  ) {
    return false;
  }

  const termosDeMudanca = [
    "aumentado",
    "aumentada",
    "reduzido",
    "reduzida",
    "diminuiu",
    "alterado",
    "alterada",
    "agora"
  ];

  if (
    termosDeMudanca.some(
      termo =>
        t.includes(
          normalizar(termo)
        ) &&
        t.length > 25
    )
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   EXTRAÇÃO DAS MUDANÇAS DOS HERÓIS
========================================================= */

function extrairMudancasDoBlocoHeroi(
  elementos,
  indiceHeroi
) {
  const resultado = [];

  let hero = null;
  let habilidade = null;

  for (
    let i = indiceHeroi;
    i < elementos.length;
    i++
  ) {
    const elemento =
      elementos[i];

    if (
      elemento.tipo === "heading"
    ) {
      const novoHeroi =
        encontrarHeroi(
          elemento.texto
        );

      if (novoHeroi) {
        if (
          novoHeroi !== hero
        ) {
          if (hero !== null) {
            break;
          }

          hero =
            novoHeroi;

          habilidade =
            null;

          continue;
        }
      }

      if (!hero) {
        continue;
      }

      if (
        pareceNomeDeHabilidade(
          elemento.texto
        )
      ) {
        habilidade =
          elemento.texto;
      }

      continue;
    }

    if (
      elemento.tipo !== "li" ||
      !hero
    ) {
      continue;
    }

    const texto =
      elemento.texto;

    if (
      texto.length < 5 ||
      ehTextoIgnoravel(texto)
    ) {
      continue;
    }

    /*
      Caso a Blizzard coloque o nome da habilidade
      dentro de <strong> ou <b> no próprio <li>.
    */

    let habilidadeDoLi =
      null;

    const strongRegex =
      /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/i;

    const strongMatch =
      strongRegex.exec(
        elemento.html
      );

    if (strongMatch) {
      const candidato =
        limparHTML(
          strongMatch[2]
        );

      if (
        pareceNomeDeHabilidade(
          candidato
        ) &&
        candidato.length <= 80
      ) {
        habilidadeDoLi =
          candidato;
      }
    }

    const habilidadeFinal =
      habilidadeDoLi ||
      habilidade ||
      "Geral";

    resultado.push({
      hero,
      habilidade:
        habilidadeFinal,
      tipo:
        classificarMudanca(
          texto
        ),
      change:
        texto
    });
  }

  return resultado;
}

function extrairMudancas(html) {
  const elementos =
    extrairElementosOrdenados(
      html
    );

  const resultado = [];

  for (
    let i = 0;
    i < elementos.length;
    i++
  ) {
    const elemento =
      elementos[i];

    if (
      elemento.tipo !==
      "heading"
    ) {
      continue;
    }

    const hero =
      encontrarHeroi(
        elemento.texto
      );

    if (!hero) {
      continue;
    }

    const mudancas =
      extrairMudancasDoBlocoHeroi(
        elementos,
        i
      );

    resultado.push(
      ...mudancas
    );
  }

  return removerDuplicados(
    resultado
  );
}

/* =========================================================
   CORREÇÕES
========================================================= */

function extrairSecaoPorTitulo(
  html,
  tituloProcurado
) {
  const regexTitulo =
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

  let match;

  while (
    (match =
      regexTitulo.exec(html)) !== null
  ) {
    const titulo =
      limparHTML(match[2]);

    if (
      normalizar(titulo) ===
      normalizar(tituloProcurado)
    ) {
      const nivel =
        Number(match[1]);

      const inicio =
        match.index +
        match[0].length;

      const restante =
        html.substring(
          inicio
        );

      const regexProximo =
        new RegExp(
          `<h([1-${nivel}])\\b[^>]*>[\\s\\S]*?<\\/h\\1>`,
          "i"
        );

      const proximo =
        regexProximo.exec(
          restante
        );

      if (proximo) {
        return restante.substring(
          0,
          proximo.index
        );
      }

      return restante;
    }
  }

  return "";
}

function extrairListaSimples(
  html
) {
  const resultado = [];

  const regex =
    /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

  let match;

  while (
    (match =
      regex.exec(html)) !== null
  ) {
    const texto =
      limparHTML(match[1]);

    if (
      texto &&
      texto.length >= 5 &&
      !ehTextoIgnoravel(
        texto
      )
    ) {
      resultado.push(
        texto
      );
    }
  }

  if (
    resultado.length > 0
  ) {
    return removerDuplicados(
      resultado
    );
  }

  const regexP =
    /<p\b[^>]*>([\s\S]*?)<\/p>/gi;

  while (
    (match =
      regexP.exec(html)) !== null
  ) {
    const texto =
      limparHTML(match[1]);

    if (
      texto &&
      texto.length >= 5
    ) {
      resultado.push(
        texto
      );
    }
  }

  return removerDuplicados(
    resultado
  );
}

function extrairCorrecoes(html) {
  let secao =
    extrairSecaoPorTitulo(
      html,
      "Correção de problemas"
    );

  if (!secao) {
    secao =
      extrairSecaoPorTitulo(
        html,
        "Correções"
      );
  }

  if (!secao) {
    return [];
  }

  return extrairListaSimples(
    secao
  );
}

/* =========================================================
   TEXTO PARA DISCORD / BDFD
========================================================= */

function criarTexto(lista) {
  if (
    !lista ||
    lista.length === 0
  ) {
    return "Nenhum resultado encontrado nesta atualização.";
  }

  let texto = "";

  let ultimoHeroi = "";
  let ultimaHabilidade = "";

  for (
    const item of lista
  ) {
    if (
      item.hero !==
      ultimoHeroi
    ) {
      if (texto !== "") {
        texto += "\n";
      }

      texto +=
        `🦸 **${item.hero}**\n`;

      ultimoHeroi =
        item.hero;

      ultimaHabilidade =
        "";
    }

    if (
      item.habilidade &&
      item.habilidade !==
        ultimaHabilidade &&
      item.habilidade !==
        "Geral"
    ) {
      texto +=
        `\n🔹 **${item.habilidade}**\n`;

      ultimaHabilidade =
        item.habilidade;
    }

    if (
      item.tipo === "buff"
    ) {
      texto +=
        `🟢 ${item.change}\n`;
    }

    else if (
      item.tipo === "nerf"
    ) {
      texto +=
        `🔴 ${item.change}\n`;
    }

    else {
      texto +=
        `⚪ ${item.change}\n`;
    }
  }

  return texto.trim();
}

function criarTextoCorrecoes(
  lista
) {
  if (
    !lista ||
    lista.length === 0
  ) {
    return "Nenhuma correção encontrada nesta atualização.";
  }

  return lista
    .map(
      item =>
        `🔧 ${item}`
    )
    .join("\n");
}

function dividirTexto(
  texto,
  limite = 3500
) {
  if (!texto) {
    return [];
  }

  const partes = [];

  let atual = "";

  const blocos =
    texto.split("\n\n");

  for (
    const bloco of blocos
  ) {
    if (!bloco) {
      continue;
    }

    if (
      bloco.length >
      limite
    ) {
      if (atual) {
        partes.push(
          atual.trim()
        );

        atual = "";
      }

      let restante =
        bloco;

      while (
        restante.length >
        limite
      ) {
        let corte =
          restante.lastIndexOf(
            "\n",
            limite
          );

        if (
          corte <
          Math.floor(
            limite * 0.5
          )
        ) {
          corte =
            limite;
        }

        partes.push(
          restante
            .substring(
              0,
              corte
            )
            .trim()
        );

        restante =
          restante
            .substring(
              corte
            )
            .trim();
      }

      if (restante) {
        atual =
          restante;
      }

      continue;
    }

    const candidato =
      atual
        ? `${atual}\n\n${bloco}`
        : bloco;

    if (
      candidato.length >
      limite
    ) {
      if (atual) {
        partes.push(
          atual.trim()
        );
      }

      atual =
        bloco;
    }

    else {
      atual =
        candidato;
    }
  }

  if (atual) {
    partes.push(
      atual.trim()
    );
  }

  return partes;
}

/* =========================================================
   BUSCA NA BLIZZARD
========================================================= */

async function fetchBlizzard(
  url
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "pt-BR,pt;q=0.9,en;q=0.8"
          },

          signal:
            controller.signal
        }
      );

    const html =
      await response.text();

    if (
      !response.ok
    ) {
      throw new Error(
        `Blizzard respondeu com status ${response.status}`
      );
    }

    return {
      response,
      html
    };
  }

  finally {
    clearTimeout(
      timer
    );
  }
}

function descobrirPatch(
  titulos
) {
  const indice =
    titulos.findIndex(
      titulo =>
        normalizar(
          titulo
        ) ===
        normalizar(
          "Atualizações dos heróis"
        )
    );

  if (
    indice > 0
  ) {
    return titulos[
      indice - 1
    ];
  }

  return "Patch Notes";
}

/* =========================================================
   OBTER DADOS
========================================================= */

async function obterDados() {
  const agora =
    Date.now();

  if (
    cache.data &&
    agora -
      cache.time <
      CACHE_TIME
  ) {
    return cache.data;
  }

  const {
    response,
    html
  } =
    await fetchBlizzard(
      BLIZZARD_URL
    );

  const titulos =
    extrairTitulos(
      html
    );

  const todasMudancas =
    extrairMudancas(
      html
    );

  const correcoes =
    extrairCorrecoes(
      html
    );

  const buffs =
    todasMudancas.filter(
      item =>
        item.tipo ===
        "buff"
    );

  const nerfs =
    todasMudancas.filter(
      item =>
        item.tipo ===
        "nerf"
    );

  const alteracoes =
    todasMudancas.filter(
      item =>
        item.tipo ===
        "alteracao"
    );

  const buffsTexto =
    criarTexto(
      buffs
    );

  const nerfsTexto =
    criarTexto(
      nerfs
    );

  const alteracoesTexto =
    criarTexto(
      alteracoes
    );

  const correcoesTexto =
    criarTextoCorrecoes(
      correcoes
    );

  const tudoLista = [
    ...todasMudancas,

    ...correcoes.map(
      correcao => ({
        hero:
          "Correções",

        habilidade:
          "Geral",

        tipo:
          "alteracao",

        change:
          correcao
      })
    )
  ];

  const tudoTexto =
    criarTexto(
      tudoLista
    );

  const buffsPartes =
    dividirTexto(
      buffsTexto
    );

  const nerfsPartes =
 
