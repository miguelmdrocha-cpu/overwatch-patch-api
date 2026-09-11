const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;

const BLIZZARD_URL =
  "https://overwatch.blizzard.com/pt-br/news/patch-notes/live/";

const CACHE_TIME = 5 * 60 * 1000;

let cache = {
  dados: null,
  atualizadoEm: 0
};

// ======================================================
// HERÓIS ATUAIS
// ======================================================

const HEROIS = [
  "D.Mon",
  "D.Va",
  "Ana",
  "Anran",
  "Ashe",
  "Baptiste",
  "Bastion",
  "Brigitte",
  "Cassidy",
  "Domina",
  "Doomfist",
  "Echo",
  "Emre",
  "Freja",
  "Genji",
  "Hanzo",
  "Hazard",
  "Illari",
  "Jetpack Cat",
  "Junker Queen",
  "Junkrat",
  "Juno",
  "Kiriko",
  "Lifeweaver",
  "Lúcio",
  "Mauga",
  "Mei",
  "Mercy",
  "Mizuki",
  "Moira",
  "Orisa",
  "Pharah",
  "Ramattra",
  "Reaper",
  "Reinhardt",
  "Roadhog",
  "Shion",
  "Sierra",
  "Sigma",
  "Sojourn",
  "Soldier: 76",
  "Sombra",
  "Symmetra",
  "Torbjörn",
  "Tracer",
  "Vendetta",
  "Venture",
  "Widowmaker",
  "Winston",
  "Wrecking Ball",
  "Wuyang",
  "Zarya",
  "Zenyatta"
];

// ======================================================
// LIMPEZA HTML
// ======================================================

function limparHTML(texto) {
  if (!texto) return "";

  return String(texto)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/section>/gi, "\n")
    .replace(/<\/article>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, numero) => {
      try {
        return String.fromCharCode(Number(numero));
      } catch {
        return "";
      }
    })
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ======================================================
// NORMALIZAÇÃO
// ======================================================

function normalizar(texto) {
  return limparHTML(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// ======================================================
// ESCAPA REGEX
// ======================================================

function escaparRegex(texto) {
  return String(texto).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

// ======================================================
// ENCONTRA HERÓI
// ======================================================

function encontrarHeroi(texto) {
  const normalizado = normalizar(texto);

  if (!normalizado) {
    return null;
  }

  return HEROIS.find(
    hero => normalizar(hero) === normalizado
  ) || null;
}

// ======================================================
// CLASSIFICAÇÃO
// ======================================================

function classificarMudanca(texto) {
  const t = normalizar(texto);

  const nerfs = [
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "diminuiu",
    "diminuido",
    "diminuida",
    "diminuiram",
    "diminuicao",
    "reduzimos",
    "reduzimos de",
    "reduzimos para",
    "reduzida para",
    "reduzido para",
    "menor",
    "menos dano",
    "menos cura",
    "mais lento",
    "mais lenta",
    "recuperacao aumentada",
    "tempo de recarga aumentado",
    "tempo de recarga aumentada",
    "custo aumentado",
    "custo aumentada",
    "removido",
    "removida",
    "removidos",
    "removidas"
  ];

  const buffs = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "aumentamos",
    "aumentamos de",
    "aumentamos para",
    "aumentou",
    "aumento de",
    "maior",
    "mais dano",
    "mais cura",
    "mais rapido",
    "mais rapida",
    "tempo de recarga reduzido",
    "tempo de recarga reduzida",
    "ganhou",
    "ganha",
    "recebeu",
    "recebe",
    "melhorado",
    "melhorada",
    "melhorados",
    "melhoradas"
  ];

  for (const palavra of nerfs) {
    if (t.includes(palavra)) {
      return "nerf";
    }
  }

  for (const palavra of buffs) {
    if (t.includes(palavra)) {
      return "buff";
    }
  }

  return "ajuste";
}

// ======================================================
// IDENTIFICA SE É UMA MUDANÇA
// ======================================================

function pareceMudanca(texto) {
  const t = normalizar(texto);

  if (!t) {
    return false;
  }

  const palavras = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "aumentamos",
    "aumentou",
    "aumento",
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "reduzimos",
    "reduziu",
    "reducao",
    "diminuido",
    "diminuida",
    "diminuiu",
    "dano",
    "tempo",
    "recarga",
    "municao",
    "alcance",
    "velocidade",
    "cura",
    "vida",
    "armadura",
    "escudo",
    "duracao",
    "projetil",
    "projeteis",
    "raio",
    "taxa",
    "dispersao",
    "precisao",
    "impacto",
    "efeito",
    "efeitos",
    "concedido",
    "concedida",
    "concedidos",
    "concedidas",
    "removido",
    "removida",
    "removidos",
    "removidas",
    "agora",
    "passou",
    "alterado",
    "alterada",
    "alterados",
    "alteradas",
    "melhorado",
    "melhorada",
    "recuperacao",
    "custo",
    "capacidade",
    "regeneracao"
  ];

  return palavras.some(
    palavra => t.includes(palavra)
  );
}

// ======================================================
// IDENTIFICA NOME DE HABILIDADE
// ======================================================

function pareceNomeDeHabilidade(texto) {
  if (!texto) {
    return false;
  }

  const original = limparHTML(texto);
  const t = normalizar(original);

  if (!t) {
    return false;
  }

  if (original.length > 120) {
    return false;
  }

  if (pareceMudanca(original)) {
    return false;
  }

  const ignorados = [
    "comentario dos desenvolvedores",
    "comentarios dos desenvolvedores",
    "atualizacoes dos herois",
    "atualizacoes de herois",
    "atualizacoes do estadio",
    "correcao de problemas",
    "correcoes de problemas",
    "bug fixes",
    "hero updates",
    "tank",
    "dano",
    "suporte",
    "geral",
    "herois",
    "mapas",
    "estadio",
    "damage",
    "support",
    "topo da publicacao",
    "forum de discussao geral",
    "forum de relatorio de bugs"
  ];

  if (ignorados.includes(t)) {
    return false;
  }

  if (
    /^nivel \d+$/.test(t) ||
    /^\d+$/.test(t)
  ) {
    return false;
  }

  return true;
}

// ======================================================
// EXTRAI ELEMENTOS DO HTML
// ======================================================

function extrairElementosOrdenados(html) {
  const elementos = [];

  const regex =
    /<(h[1-6]|li|p|strong|b|div|span)[^>]*>([\s\S]*?)<\/\1>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const texto = limparHTML(match[2]);

    if (!texto) {
      continue;
    }

    if (
      (tag === "div" || tag === "span") &&
      texto.length > 500
    ) {
      continue;
    }

    elementos.push({
      tag,
      nivel: tag.startsWith("h")
        ? Number(tag.substring(1))
        : null,
      texto,
      indice: match.index
    });
  }

  return elementos;
}

// ======================================================
// EXTRAI TÍTULOS
// ======================================================

function extrairTitulos(html) {
  const encontrados = [];

  const regex =
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto = limparHTML(match[2]);

    if (!texto) {
      continue;
    }

    encontrados.push({
      nivel: Number(match[1]),
      texto,
      indice: match.index
    });
  }

  return encontrados;
}

// ======================================================
// NOVO PARSER POR TEXTO
// ======================================================

function extrairMudancasPorTexto(html) {
  const mudancas = [];

  const textoLimpo = limparHTML(html);

  if (!textoLimpo) {
    return mudancas;
  }

  const linhas = textoLimpo
    .split("\n")
    .map(linha => linha.trim())
    .filter(Boolean);

  let heroiAtual = null;
  let habilidadeAtual = null;

  for (const linha of linhas) {
    const texto = linha.trim();

    if (!texto) {
      continue;
    }

    // ------------------------------------------
    // IDENTIFICA HERÓI
    // ------------------------------------------

    const heroiEncontrado =
      encontrarHeroi(texto);

    if (heroiEncontrado) {
      heroiAtual = heroiEncontrado;
      habilidadeAtual = null;
      continue;
    }

    if (!heroiAtual) {
      continue;
    }

    // ------------------------------------------
    // IGNORA TÍTULOS GERAIS
    // ------------------------------------------

    const normalizado =
      normalizar(texto);

    if (
      normalizado === "atualizacoes dos herois" ||
      normalizado === "atualizacoes de herois" ||
      normalizado === "comentario dos desenvolvedores" ||
      normalizado === "comentarios dos desenvolvedores" ||
      normalizado === "correcao de problemas" ||
      normalizado === "correcoes de problemas" ||
      normalizado === "bug fixes"
    ) {
      continue;
    }

    // ------------------------------------------
    // IDENTIFICA HABILIDADE
    // ------------------------------------------

    if (
      pareceNomeDeHabilidade(texto) &&
      !pareceMudanca(texto) &&
      texto.length <= 120
    ) {
      habilidadeAtual = texto;
      continue;
    }

    // ------------------------------------------
    // IDENTIFICA MUDANÇA
    // ------------------------------------------

    if (pareceMudanca(texto)) {
      mudancas.push({
        hero: heroiAtual,
        habilidade:
          habilidadeAtual || "Geral",
        tipo: classificarMudanca(texto),
        change: texto
      });
    }
  }

  return mudancas;
}
// ======================================================
// EXTRAI MUDANÇAS DO BLOCO DO HERÓI
// ======================================================

function extrairMudancasDoBlocoHeroi(
  elementos,
  indiceInicial,
  nomeHeroi
) {
  const mudancas = [];

  let habilidadeAtual = null;

  for (
    let i = indiceInicial + 1;
    i < elementos.length;
    i++
  ) {
    const elemento = elementos[i];

    const outroHeroi =
      encontrarHeroi(elemento.texto);

    if (
      outroHeroi &&
      normalizar(outroHeroi) !==
        normalizar(nomeHeroi)
    ) {
      break;
    }

    if (elemento.tag.startsWith("h")) {
      const titulo =
        limparHTML(elemento.texto);

      if (
        pareceNomeDeHabilidade(titulo)
      ) {
        habilidadeAtual = titulo;
      }

      continue;
    }

    if (
      (elemento.tag === "strong" ||
        elemento.tag === "b") &&
      pareceNomeDeHabilidade(
        elemento.texto
      )
    ) {
      habilidadeAtual =
        limparHTML(elemento.texto);

      continue;
    }

    if (
      elemento.tag === "li" ||
      elemento.tag === "p" ||
      elemento.tag === "div" ||
      elemento.tag === "span"
    ) {
      const texto =
        limparHTML(elemento.texto);

      if (!pareceMudanca(texto)) {
        continue;
      }

      if (texto.length > 1000) {
        continue;
      }

      mudancas.push({
        hero: nomeHeroi,
        habilidade:
          habilidadeAtual || "Geral",
        tipo:
          classificarMudanca(texto),
        change: texto
      });
    }
  }

  return mudancas;
}

// ======================================================
// REMOVE MUDANÇAS DUPLICADAS
// ======================================================

function removerMudancasDuplicadas(
  mudancas
) {
  const resultado = [];
  const vistos = new Set();

  for (const mudanca of mudancas) {
    const chave =
      `${normalizar(mudanca.hero)}|` +
      `${normalizar(mudanca.habilidade)}|` +
      `${normalizar(mudanca.change)}`;

    if (vistos.has(chave)) {
      continue;
    }

    vistos.add(chave);
    resultado.push(mudanca);
  }

  return resultado;
}

// ======================================================
// SEPARA POR TIPO
// ======================================================

function separarMudancas(
  hero,
  mudancas
) {
  const resultado = {
    hero,
    buffs: [],
    nerfs: [],
    ajustes: []
  };

  for (const mudanca of mudancas) {
    if (
      mudanca.tipo === "buff"
    ) {
      resultado.buffs.push(
        mudanca
      );
    } else if (
      mudanca.tipo === "nerf"
    ) {
      resultado.nerfs.push(
        mudanca
      );
    } else {
      resultado.ajustes.push(
        mudanca
      );
    }
  }

  return resultado;
}

// ======================================================
// CRIA TEXTO
// ======================================================

function criarTexto(
  mudancas
) {
  if (
    !mudancas ||
    mudancas.length === 0
  ) {
    return "";
  }

  const grupos = {};

  for (const mudanca of mudancas) {
    const habilidade =
      mudanca.habilidade ||
      "Geral";

    if (!grupos[habilidade]) {
      grupos[habilidade] = [];
    }

    grupos[habilidade].push(
      mudanca
    );
  }

  let texto = "";

  for (
    const habilidade of Object.keys(
      grupos
    )
  ) {
    texto +=
      `🔹 **${habilidade}**\n`;

    for (
      const mudanca of
        grupos[habilidade]
    ) {
      let emoji = "🟡";

      if (
        mudanca.tipo === "buff"
      ) {
        emoji = "🟢";
      }

      if (
        mudanca.tipo === "nerf"
      ) {
        emoji = "🔴";
      }

      texto +=
        `${emoji} ${mudanca.change}\n`;
    }

    texto += "\n";
  }

  return texto.trim();
}

// ======================================================
// TEXTO DE CORREÇÕES
// ======================================================

function criarTextoCorrecoes(
  correcoes
) {
  if (
    !correcoes ||
    correcoes.length === 0
  ) {
    return "";
  }

  return correcoes
    .map(
      correcao =>
        `🛠️ ${correcao}`
    )
    .join("\n");
}

// ======================================================
// DIVIDE TEXTO
// ======================================================

function dividirTexto(
  texto,
  limite = 1900
) {
  const partes = [];

  if (!texto) {
    return partes;
  }

  let atual = "";

  const linhas =
    texto.split("\n");

  for (
    const linha of linhas
  ) {
    if (
      (
        atual +
        linha +
        "\n"
      ).length > limite
    ) {
      if (
        atual.trim()
      ) {
        partes.push(
          atual.trim()
        );
      }

      atual =
        linha + "\n";
    } else {
      atual +=
        linha + "\n";
    }
  }

  if (
    atual.trim()
  ) {
    partes.push(
      atual.trim()
    );
  }

  return partes;
}

// ======================================================
// EXTRAI SEÇÃO POR TÍTULO
// ======================================================

function extrairSecaoPorTitulo(
  html,
  titulos
) {
  if (
    !Array.isArray(titulos)
  ) {
    titulos = [titulos];
  }

  for (
    const titulo of titulos
  ) {
    const regexTitulo =
      new RegExp(
        `<h([1-6])[^>]*>\\s*${escaparRegex(
          titulo
        )}\\s*<\\/h\\1>`,
        "i"
      );

    const inicio =
      html.match(
        regexTitulo
      );

    if (!inicio) {
      continue;
    }

    const inicioIndice =
      inicio.index;

    const nivel =
      Number(inicio[1]);

    const restante =
      html.substring(
        inicioIndice +
          inicio[0].length
      );

    const regexProximo =
      new RegExp(
        `<h[1-${nivel}][^>]*>`,
        "i"
      );

    const fim =
      restante.search(
        regexProximo
      );

    if (fim === -1) {
      return restante;
    }

    return restante.substring(
      0,
      fim
    );
  }

  // ------------------------------------------
  // FALLBACK POR TEXTO
  // ------------------------------------------

  const texto =
    limparHTML(html);

  const linhas =
    texto.split("\n");

  let indiceInicio = -1;

  for (
    let i = 0;
    i < linhas.length;
    i++
  ) {
    const atual =
      normalizar(
        linhas[i]
      );

    if (
      titulos.some(
        titulo =>
          atual ===
          normalizar(titulo)
      )
    ) {
      indiceInicio =
        i + 1;

      break;
    }
  }

  if (
    indiceInicio === -1
  ) {
    return "";
  }

  const resultado = [];

  for (
    let i = indiceInicio;
    i < linhas.length;
    i++
  ) {
    const atual =
      normalizar(
        linhas[i]
      );

    if (
      atual ===
        "atualizacoes dos herois" ||
      atual ===
        "atualizacoes de herois"
    ) {
      break;
    }

    resultado.push(
      linhas[i]
    );
  }

  return resultado.join(
    "\n"
  );
}

// ======================================================
// BAIXA PÁGINA DA BLIZZARD
// ======================================================

function baixarPagina(
  url,
  quantidadeRedirecionamentos = 0
) {
  return new Promise(
    (resolve, reject) => {
      if (
        quantidadeRedirecionamentos >
        5
      ) {
        return reject(
          new Error(
            "Muitos redirecionamentos da Blizzard."
          )
        );
      }

      const cliente =
        url.startsWith(
          "https://"
        )
          ? https
          : http;

      const requisicao =
        cliente.get(
          url,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

              "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

              "Accept-Language":
                "pt-BR,pt;q=0.9,en;q=0.8",

              "Cache-Control":
                "no-cache"
            }
          },
          resposta => {
            if (
              resposta.statusCode >=
                300 &&
              resposta.statusCode <
                400 &&
              resposta.headers.location
            ) {
              resposta.resume();

              const novaURL =
                new URL(
                  resposta.headers.location,
                  url
                ).toString();

              return baixarPagina(
                novaURL,
                quantidadeRedirecionamentos +
                  1
              )
                .then(resolve)
                .catch(reject);
            }

            if (
              resposta.statusCode <
                200 ||
              resposta.statusCode >=
                300
            ) {
              resposta.resume();

              return reject(
                new Error(
                  `Blizzard respondeu com HTTP ${resposta.statusCode}.`
                )
              );
            }

            let html = "";

            resposta.setEncoding(
              "utf8"
            );

            resposta.on(
              "data",
              parte => {
                html += parte;
              }
            );

            resposta.on(
              "end",
              () => {
                if (!html) {
                  return reject(
                    new Error(
                      "A Blizzard retornou uma página vazia."
                    )
                  );
                }

                resolve(html);
              }
            );
          }
        );

      requisicao.setTimeout(
        20000,
        () => {
          requisicao.destroy(
            new Error(
              "Tempo limite ao acessar a Blizzard."
            )
          );
        }
      );

      requisicao.on(
        "error",
        erro => {
          reject(erro);
        }
      );
    }
  );
}

// ======================================================
// OBTÉM OS DADOS DA BLIZZARD
// ======================================================

async function obterDados() {
  const agora =
    Date.now();

  if (
    cache.dados &&
    agora -
      cache.atualizadoEm <
      CACHE_TIME
  ) {
    return cache.dados;
  }

  console.log(
    "Baixando página oficial da Blizzard..."
  );

  const html =
    await baixarPagina(
      BLIZZARD_URL
    );

  // ------------------------------------------
  // PARSER ESTRUTURADO
  // ------------------------------------------

  const elementos =
    extrairElementosOrdenados(
      html
    );

  const mudancasEstruturadas =
    [];

  for (
    let i = 0;
    i < elementos.length;
    i++
  ) {
    const hero =
      encontrarHeroi(
        elementos[i].texto
      );

    if (!hero) {
      continue;
    }

    const mudancasHeroi =
      extrairMudancasDoBlocoHeroi(
        elementos,
        i,
        hero
      );

    mudancasEstruturadas.push(
      ...mudancasHeroi
    );
  }

  // ------------------------------------------
  // PARSER DE RECUPERAÇÃO
  // ------------------------------------------

  const mudancasPorTexto =
    extrairMudancasPorTexto(
      html
    );

  // ------------------------------------------
  // JUNTA OS DOIS RESULTADOS
  // ------------------------------------------

  let todasMudancas =
    [
      ...mudancasEstruturadas,
      ...mudancasPorTexto
    ];

  todasMudancas =
    removerMudancasDuplicadas(
      todasMudancas
    );

  // ------------------------------------------
  // ORGANIZA POR HERÓI
  // ------------------------------------------

  const herois = {};

  for (
    const hero of HEROIS
  ) {
    const mudancasHeroi =
      todasMudancas.filter(
        mudanca =>
          normalizar(
            mudanca.hero
          ) ===
          normalizar(hero)
      );

    const separado =
      separarMudancas(
        hero,
        mudancasHeroi
      );

    herois[hero] =
      separado;
  }

  // ------------------------------------------
  // CORREÇÕES
  // ------------------------------------------

  const secaoCorrecoes =
    extrairSecaoPorTitulo(
      html,
      [
        "Correção de problemas",
        "Correções de problemas",
        "Correção de Problemas",
        "Correções de Problemas"
      ]
    );

  const correcoes = [];

  if (
    secaoCorrecoes
  ) {
    const linhas =
      limparHTML(
        secaoCorrecoes
      )
        .split("\n")
        .map(
          linha =>
            linha.trim()
        )
        .filter(Boolean);

    for (
      const linha of linhas
    ) {
      if (
        linha.length < 10
      ) {
        continue;
      }

      if (
        encontrarHeroi(linha)
      ) {
        continue;
      }

      correcoes.push(
        linha
      );
    }
  }

  // ------------------------------------------
  // REMOVE CORREÇÕES DUPLICADAS
  // ------------------------------------------

  const correcoesUnicas =
    [
      ...new Set(
        correcoes.map(
          correcao =>
            correcao.trim()
        )
      )
    ];

  // ------------------------------------------
  // TEXTOS
  // ------------------------------------------

  const texto =
    criarTexto(
      todasMudancas
    );

  const textoCorrecoes =
    criarTextoCorrecoes(
      correcoesUnicas
    );

  const partes =
    dividirTexto(
      texto
    );

  const partesCorrecoes =
    dividirTexto(
      textoCorrecoes
    );

  // ------------------------------------------
  // RESULTADO FINAL
  // ------------------------------------------

  const dados = {
    atualizadoEm:
      new Date().toISOString(),

    fonte:
      BLIZZARD_URL,

    totalMudancas:
      todasMudancas.length,

    totalCorrecoes:
      correcoesUnicas.length,

    mudancas:
      todasMudancas,

    correcoes:
      correcoesUnicas,

    texto,

    textoCorrecoes,

    partes,

    partesCorrecoes,

    herois
  };

  cache = {
    dados,
    atualizadoEm:
      Date.now()
  };

  console.log(
    `Dados atualizados: ${todasMudancas.length} mudanças, ${correcoesUnicas.length} correções.`
  );

  return dados;
}
// ======================================================
// SERVIDOR HTTP
// ======================================================

const server =
  http.createServer(
    async (req, res) => {
      try {
        const url =
          new URL(
            req.url,
            `http://${req.headers.host}`
          );

        const headers = {
          "Content-Type":
            "application/json; charset=utf-8",

          "Access-Control-Allow-Origin":
            "*",

          "Access-Control-Allow-Methods":
            "GET, OPTIONS"
        };

        // ==================================================
        // OPTIONS
        // ==================================================

        if (
          req.method === "OPTIONS"
        ) {
          res.writeHead(
            204,
            headers
          );

          return res.end();
        }

        // ==================================================
        // /
        // ==================================================

        if (
          url.pathname === "/"
        ) {
          res.writeHead(
            200,
            headers
          );

          return res.end(
            JSON.stringify(
              {
                status:
                  "online",

                nome:
                  "Overwatch Patch API",

                fonte:
                  BLIZZARD_URL,

                endpoints: {
                  dados:
                    "/dados",

                  patch:
                    "/patch",

                  patchHeroi:
                    "/patch?hero=D.Va",

                  testBlizzard:
                    "/test-blizzard"
                }
              },
              null,
              2
            )
          );
        }

        // ==================================================
        // /test-blizzard
        // ==================================================

        if (
          url.pathname ===
          "/test-blizzard"
        ) {
          try {
            const dados =
              await obterDados();

            res.writeHead(
              200,
              headers
            );

            return res.end(
              JSON.stringify(
                {
                  status:
                    "ok",

                  mensagem:
                    "Página da Blizzard processada com sucesso.",

                  quantidadeMudancas:
                    dados.totalMudancas,

                  quantidadeCorrecoes:
                    dados.totalCorrecoes,

                  atualizadoEm:
                    dados.atualizadoEm
                },
                null,
                2
              )
            );
          } catch (erro) {
            console.error(
              "Erro /test-blizzard:",
              erro
            );

            res.writeHead(
              500,
              headers
            );

            return res.end(
              JSON.stringify(
                {
                  status:
                    "erro",

                  mensagem:
                    erro.message,

                  tipo:
                    erro.code ||
                    erro.name ||
                    "Erro"
                },
                null,
                2
              )
            );
          }
        }

        // ==================================================
        // /dados
        // ==================================================

        if (
          url.pathname ===
          "/dados"
        ) {
          try {
            const dados =
              await obterDados();

            res.writeHead(
              200,
              headers
            );

            return res.end(
              JSON.stringify(
                dados,
                null,
                2
              )
            );
          } catch (erro) {
            console.error(
              "Erro /dados:",
              erro
            );

            res.writeHead(
              500,
              headers
            );

            return res.end(
              JSON.stringify(
                {
                  erro:
                    erro.message
                },
                null,
                2
              )
            );
          }
        }

        // ==================================================
        // /patch
        // ==================================================

        if (
          url.pathname ===
          "/patch"
        ) {
          try {
            const dados =
              await obterDados();

            const heroQuery =
              url.searchParams.get(
                "hero"
              );

            // ----------------------------------------------
            // SEM HERÓI
            // ----------------------------------------------

            if (!heroQuery) {
              res.writeHead(
                200,
                headers
              );

              return res.end(
                JSON.stringify(
                  {
                    fonte:
                      BLIZZARD_URL,

                    total:
                      dados.mudancas.length,

                    mudancas:
                      dados.mudancas,

                    correcoes:
                      dados.correcoes,

                    texto:
                      dados.texto,

                    textoCorrecoes:
                      dados.textoCorrecoes,

                    partes:
                      dados.partes,

                    partesCorrecoes:
                      dados.partesCorrecoes
                  },
                  null,
                  2
                )
              );
            }

            // ----------------------------------------------
            // PROCURA HERÓI
            // ----------------------------------------------

            const nomeHeroi =
              encontrarHeroi(
                heroQuery
              );

            if (!nomeHeroi) {
              res.writeHead(
                404,
                headers
              );

              return res.end(
                JSON.stringify(
                  {
                    erro:
                      "Herói não encontrado.",

                    heroiRecebido:
                      heroQuery,

                    heroisDisponiveis:
                      HEROIS
                  },
                  null,
                  2
                )
              );
            }

            // ----------------------------------------------
            // RESULTADO DO HERÓI
            // ----------------------------------------------

            const resultadoHeroi =
              dados.herois[
                nomeHeroi
              ];

            res.writeHead(
              200,
              headers
            );

            return res.end(
              JSON.stringify(
                resultadoHeroi,
                null,
                2
              )
            );
          } catch (erro) {
            console.error(
              "Erro /patch:",
              erro
            );

            res.writeHead(
              500,
              headers
            );

            return res.end(
              JSON.stringify(
                {
                  erro:
                    erro.message
                },
                null,
                2
              )
            );
          }
        }

        // ==================================================
        // 404
        // ==================================================

        res.writeHead(
          404,
          headers
        );

        return res.end(
          JSON.stringify(
            {
              erro:
                "Endpoint não encontrado."
            },
            null,
            2
          )
        );

      } catch (erro) {
        console.error(
          "Erro interno:",
          erro
        );

        res.writeHead(
          500,
          {
            "Content-Type":
              "application/json; charset=utf-8"
          }
        );

        return res.end(
          JSON.stringify(
            {
              erro:
                "Erro interno do servidor.",

              detalhes:
                erro.message
            },
            null,
            2
          )
        );
      }
    }
  );

// ======================================================
// INICIA SERVIDOR
// ======================================================

server.listen(
  PORT,
  () => {
    console.log(
      "=========================================="
    );

    console.log(
      "Overwatch Patch API"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `Porta: ${PORT}`
    );

    console.log(
      `Fonte: ${BLIZZARD_URL}`
    );

    console.log(
      "Endpoint: /"
    );

    console.log(
      "Endpoint: /dados"
    );

    console.log(
      "Endpoint: /patch"
    );

    console.log(
      "Endpoint: /patch?hero=D.Va"
    );

    console.log(
      "Endpoint: /test-blizzard"
    );

    console.log(
      "=========================================="
    );
  }
);a
