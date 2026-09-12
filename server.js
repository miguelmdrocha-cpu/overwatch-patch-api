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
// HERÓIS
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
// LIMPEZA
// ======================================================

function limparHTML(texto) {
  if (!texto) return "";

  return texto
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function encontrarHeroi(nome) {
  const normalizado = normalizar(nome);

  return (
    HEROIS.find(
      (hero) => normalizar(hero) === normalizado
    ) || null
  );
}

// ======================================================
// CLASSIFICAÇÃO
// ======================================================

function classificarMudanca(texto) {
  const t = normalizar(texto);

  if (!t) return "ajuste";

  const ajustes = [
    "efeitos sonoros",
    "efeitos visuais",
    "efeito sonoro",
    "efeito visual",
    "animacao",
    "animacoes",
    "movimentacao da camera",
    "movimento da camera",
    "camera nao fica",
    "volume",
    "prioridade sonora",
    "efeitos de atordoamento",
    "efeitos de detencao",
    "tamanho dos riscos",
    "nova animacao",
    "novas animacoes",
    "exploracao em primeira pessoa",
    "revertido",
    "revertida",
    "revertidos",
    "revertidas",
    "revertendo"
  ];

  for (const palavra of ajustes) {
    if (t.includes(palavra)) {
      return "ajuste";
    }
  }

  // ----------------------------------------------------
  // RECARGA
  // ----------------------------------------------------

  if (
    t.includes("tempo de recarga") ||
    t.includes("recarga")
  ) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas") ||
      t.includes("diminuiu") ||
      t.includes("diminui")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas") ||
      t.includes("aumentou") ||
      t.includes("aumenta")
    ) {
      return "nerf";
    }
  }

  // ----------------------------------------------------
  // RECUPERAÇÃO
  // ----------------------------------------------------

  if (
    t.includes("recuperacao") ||
    t.includes("tempo de recuperacao")
  ) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas") ||
      t.includes("diminuiu") ||
      t.includes("diminui")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas") ||
      t.includes("aumentou") ||
      t.includes("aumenta")
    ) {
      return "nerf";
    }
  }

  // ----------------------------------------------------
  // TEMPO DE LANÇAMENTO
  // ----------------------------------------------------

  if (t.includes("tempo de lancamento")) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas") ||
      t.includes("diminuiu") ||
      t.includes("diminui")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas") ||
      t.includes("aumentou") ||
      t.includes("aumenta")
    ) {
      return "nerf";
    }
  }

  // ----------------------------------------------------
  // DISPERSÃO
  // ----------------------------------------------------

  if (t.includes("dispersao")) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas") ||
      t.includes("diminuiu") ||
      t.includes("diminui")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas") ||
      t.includes("aumentou") ||
      t.includes("aumenta")
    ) {
      return "nerf";
    }
  }

  // ----------------------------------------------------
  // ATRASO
  // ----------------------------------------------------

  if (t.includes("atraso")) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas") ||
      t.includes("diminuiu") ||
      t.includes("diminui")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas") ||
      t.includes("aumentou") ||
      t.includes("aumenta")
    ) {
      return "nerf";
    }
  }

  // ----------------------------------------------------
  // CUSTO
  // ----------------------------------------------------

  if (t.includes("custo")) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas") ||
      t.includes("diminuiu") ||
      t.includes("diminui") ||
      t.includes("reduz")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas") ||
      t.includes("aumentou") ||
      t.includes("aumenta")
    ) {
      return "nerf";
    }
  }

  // ----------------------------------------------------
  // DURAÇÃO
  // ----------------------------------------------------

  if (t.includes("duracao")) {
    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas") ||
      t.includes("aumentou") ||
      t.includes("aumenta")
    ) {
      return "buff";
    }

    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas") ||
      t.includes("diminuiu") ||
      t.includes("diminui")
    ) {
      return "nerf";
    }
  }

  // ----------------------------------------------------
  // ATRIBUTOS
  // ----------------------------------------------------

  const atributos = [
    "dano",
    "cura",
    "vida",
    "armadura",
    "alcance",
    "velocidade",
    "taxa de regeneracao",
    "quantidade",
    "limite",
    "potencia",
    "municao",
    "projetil",
    "restituicao",
    "precisao"
  ];

  for (const atributo of atributos) {
    if (t.includes(atributo)) {
      if (
        t.includes("aumentado") ||
        t.includes("aumentada") ||
        t.includes("aumentados") ||
        t.includes("aumentadas") ||
        t.includes("aumentou") ||
        t.includes("aumenta")
      ) {
        return "buff";
      }

      if (
        t.includes("reduzido") ||
        t.includes("reduzida") ||
        t.includes("reduzidos") ||
        t.includes("reduzidas") ||
        t.includes("diminuiu") ||
        t.includes("diminui") ||
        t.includes("reduz")
      ) {
        return "nerf";
      }
    }
  }

  // ----------------------------------------------------
  // FALLBACK
  // ----------------------------------------------------

  if (
    t.includes("aumentado") ||
    t.includes("aumentada") ||
    t.includes("aumentados") ||
    t.includes("aumentadas") ||
    t.includes("aumentou") ||
    t.includes("aumenta")
  ) {
    return "buff";
  }

  if (
    t.includes("reduzido") ||
    t.includes("reduzida") ||
    t.includes("reduzidos") ||
    t.includes("reduzidas") ||
    t.includes("diminuiu") ||
    t.includes("diminui") ||
    t.includes("reduz")
  ) {
    return "nerf";
  }

  return "ajuste";
}

// ======================================================
// EXTRAIR LI
// ======================================================

function extrairLista(html) {
  const resultados = [];

  const regex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto = limparHTML(match[1]);

    if (texto) {
      resultados.push(texto);
    }
  }

  return resultados;
}

// ======================================================
// EXTRAIR DIV COMPLETA
// ======================================================
// Esta função é importante porque o HTML da Blizzard
// possui várias DIVs dentro de PatchNotesHeroUpdate.
// Regex simples acaba cortando o bloco antes da hora.

function extrairDivsPorClasse(html, classe) {
  const resultados = [];

  const aberturaRegex = new RegExp(
    `<div\\b[^>]*class=["'][^"']*\\b${classe}\\b[^"']*["'][^>]*>`,
    "gi"
  );

  let match;

  while ((match = aberturaRegex.exec(html)) !== null) {
    const inicio = match.index;

    let pos = aberturaRegex.lastIndex;
    let profundidade = 1;

    const divRegex = /<\/?div\b[^>]*>/gi;
    divRegex.lastIndex = pos;

    let divMatch;

    while ((divMatch = divRegex.exec(html)) !== null) {
      const tag = divMatch[0];

      if (/^<div\b/i.test(tag)) {
        profundidade++;
      } else if (/^<\/div/i.test(tag)) {
        profundidade--;

        if (profundidade === 0) {
          const fim = divMatch.index + tag.length;

          resultados.push(
            html.substring(inicio, fim)
          );

          aberturaRegex.lastIndex = fim;

          break;
        }
      }
    }
  }

  return resultados;
}

// ======================================================
// EXTRAIR NOME DA HABILIDADE
// ======================================================

function extrairNomeHabilidade(bloco) {
  const regex =
    /<div\b[^>]*class=["'][^"']*\bPatchNotesAbilityUpdate-name\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;

  const match = bloco.match(regex);

  if (!match) {
    return null;
  }

  const nome = limparHTML(match[1]);

  return nome || null;
}

// ======================================================
// EXTRAIR MUDANÇAS DA HABILIDADE
// ======================================================

function extrairMudancasHabilidade(bloco) {
  const regex =
    /<div\b[^>]*class=["'][^"']*\bPatchNotesAbilityUpdate-detailList\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;

  const match = bloco.match(regex);

  if (!match) {
    return [];
  }

  return extrairLista(match[1]);
}

// ======================================================
// EXTRAIR HABILIDADES
// ======================================================

function extrairBlocosHabilidades(blocoHeroi) {
  return extrairDivsPorClasse(
    blocoHeroi,
    "PatchNotesAbilityUpdate"
  );
}

// ======================================================
// EXTRAIR HERÓIS
// ======================================================

function extrairBlocosHerois(html) {
  return extrairDivsPorClasse(
    html,
    "PatchNotesHeroUpdate"
  );
}

// ======================================================
// IDENTIFICAR ESTÁDIO
// ======================================================

function pertenceAoEstadio(bloco) {
  const t = normalizar(bloco);

  return (
    t.includes("atualizacoes do estadio") ||
    t.includes("atualizacoes do estdio") ||
    t.includes("stadium")
  );
}

// ======================================================
// EXTRAIR DADOS DOS HERÓIS
// ======================================================

function extrairDadosHerois(html) {
  const buffs = [];
  const nerfs = [];
  const ajustes = [];

  const blocosHerois = extrairBlocosHerois(html);

  console.log(
    `Blocos de heróis encontrados: ${blocosHerois.length}`
  );

  for (const bloco of blocosHerois) {
    if (pertenceAoEstadio(bloco)) {
      continue;
    }

    const nomeRegex =
      /<h5\b[^>]*class=["'][^"']*\bPatchNotesHeroUpdate-name\b[^"']*["'][^>]*>([\s\S]*?)<\/h5>/i;

    const nomeMatch = bloco.match(nomeRegex);

    if (!nomeMatch) {
      continue;
    }

    const nomeOriginal = limparHTML(
      nomeMatch[1]
    );

    const hero = encontrarHeroi(
      nomeOriginal
    );

    if (!hero) {
      console.log(
        `Herói não reconhecido: ${nomeOriginal}`
      );

      continue;
    }

    // --------------------------------------------------
    // COMENTÁRIO DOS DESENVOLVEDORES
    // --------------------------------------------------

    const devRegex =
      /<div\b[^>]*class=["'][^"']*\bPatchNotes-dev\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;

    const devMatch = bloco.match(devRegex);

    if (devMatch) {
      const comentario = limparHTML(
        devMatch[1]
      );

      if (comentario) {
        const tipo =
          classificarMudanca(comentario);

        const item = {
          hero,
          habilidade: null,
          tipo,
          change: comentario
        };

        if (tipo === "buff") {
          buffs.push(item);
        } else if (tipo === "nerf") {
          nerfs.push(item);
        } else {
          ajustes.push(item);
        }
      }
    }

    // --------------------------------------------------
    // ALTERAÇÕES GERAIS
    // --------------------------------------------------

    const generalRegex =
      /<div\b[^>]*class=["'][^"']*\bPatchNotesHeroUpdate-generalUpdates\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;

    const generalMatch =
      bloco.match(generalRegex);

    if (generalMatch) {
      const mudancasGerais =
        extrairLista(generalMatch[1]);

      for (const mudanca of mudancasGerais) {
        const tipo =
          classificarMudanca(mudanca);

        const item = {
          hero,
          habilidade: null,
          tipo,
          change: mudanca
        };

        if (tipo === "buff") {
          buffs.push(item);
        } else if (tipo === "nerf") {
          nerfs.push(item);
        } else {
          ajustes.push(item);
        }
      }
    }

    // --------------------------------------------------
    // HABILIDADES
    // --------------------------------------------------

    const habilidades =
      extrairBlocosHabilidades(bloco);

    for (const habilidadeBloco of habilidades) {
      const habilidade =
        extrairNomeHabilidade(
          habilidadeBloco
        );

      if (!habilidade) {
        continue;
      }

      const mudancas =
        extrairMudancasHabilidade(
          habilidadeBloco
        );

      for (const mudanca of mudancas) {
        const tipo =
          classificarMudanca(mudanca);

        const item = {
          hero,
          habilidade,
          tipo,
          change: mudanca
        };

        if (tipo === "buff") {
          buffs.push(item);
        } else if (tipo === "nerf") {
          nerfs.push(item);
        } else {
          ajustes.push(item);
        }
      }
    }
  }

  return {
    buffs,
    nerfs,
    ajustes
  };
}
// ======================================================
// CORREÇÕES
// ======================================================

function extrairCorrecoes(html) {
  const resultados = [];

  const secoes =
    extrairDivsPorClasse(
      html,
      "PatchNotes-section"
    );

  for (const secao of secoes) {
    const tituloRegex =
      /<h4\b[^>]*class=["'][^"']*\bPatchNotes-sectionTitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i;

    const tituloMatch =
      secao.match(tituloRegex);

    if (!tituloMatch) {
      continue;
    }

    const titulo =
      normalizar(
        limparHTML(tituloMatch[1])
      );

    if (
      !titulo.includes("corre") &&
      !titulo.includes("bug") &&
      !titulo.includes("fix")
    ) {
      continue;
    }

    const itens =
      extrairLista(secao);

    for (const item of itens) {
      if (item) {
        resultados.push(item);
      }
    }
  }

  return resultados;
}

// ======================================================
// TEXTO
// ======================================================

function criarTexto(lista) {
  if (!lista || lista.length === 0) {
    return "Nenhuma alteração encontrada.";
  }

  return lista
    .map((item) => {
      if (item.habilidade) {
        return (
          `🦸 **${item.hero}**\n` +
          `🔹 **${item.habilidade}**\n` +
          `${item.change}`
        );
      }

      return (
        `🦸 **${item.hero}**\n` +
        `${item.change}`
      );
    })
    .join("\n\n");
}

function criarTextoCorrecoes(lista) {
  if (!lista || lista.length === 0) {
    return "Nenhuma correção encontrada.";
  }

  return lista
    .map((item) => `🛠️ ${item}`)
    .join("\n\n");
}

// ======================================================
// DIVIDIR TEXTO
// ======================================================

function dividirTexto(
  texto,
  tamanho = 3500
) {
  const partes = [];

  if (!texto) {
    return partes;
  }

  let atual = "";

  const linhas =
    texto.split("\n");

  for (const linha of linhas) {
    if (
      atual.length +
        linha.length +
        1 >
      tamanho
    ) {
      if (atual.trim()) {
        partes.push(
          atual.trim()
        );
      }

      atual = "";
    }

    atual += linha + "\n";
  }

  if (atual.trim()) {
    partes.push(
      atual.trim()
    );
  }

  return partes;
}

// ======================================================
// BAIXAR BLIZZARD
// ======================================================

function baixarPagina(url) {
  return new Promise(
    (resolve, reject) => {
      https
        .get(
          url,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

              "Accept-Language":
                "pt-BR,pt;q=0.9,en;q=0.8"
            }
          },
          (res) => {
            let dados = "";

            res.setEncoding("utf8");

            res.on(
              "data",
              (chunk) => {
                dados += chunk;
              }
            );

            res.on(
              "end",
              () => {
                if (
                  res.statusCode >=
                    300 &&
                  res.statusCode < 400 &&
                  res.headers.location
                ) {
                  baixarPagina(
                    res.headers.location
                  )
                    .then(resolve)
                    .catch(reject);

                  return;
                }

                if (
                  res.statusCode !==
                  200
                ) {
                  reject(
                    new Error(
                      `Blizzard retornou HTTP ${res.statusCode}`
                    )
                  );

                  return;
                }

                resolve(dados);
              }
            );
          }
        )
        .on(
          "error",
          reject
        );
    }
  );
}

// ======================================================
// OBTER DADOS
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

  const html =
    await baixarPagina(
      BLIZZARD_URL
    );

  console.log(
    `HTML recebido: ${html.length} caracteres`
  );

  const dadosHerois =
    extrairDadosHerois(
      html
    );

  const correcoes =
    extrairCorrecoes(
      html
    );

  const buffsTexto =
    criarTexto(
      dadosHerois.buffs
    );

  const nerfsTexto =
    criarTexto(
      dadosHerois.nerfs
    );

  const ajustesTexto =
    criarTexto(
      dadosHerois.ajustes
    );

  const correcoesTexto =
    criarTextoCorrecoes(
      correcoes
    );

  const tudoTexto = [
    "🟢 BUFFS",
    buffsTexto,
    "",
    "🔴 NERFS",
    nerfsTexto,
    "",
    "⚪ ALTERAÇÕES",
    ajustesTexto,
    "",
    "🛠️ CORREÇÕES E BUGS",
    correcoesTexto
  ].join("\n\n");

  const resultado = {
    atualizadoEm:
      new Date().toISOString(),

    fonte:
      BLIZZARD_URL,

    buffs:
      dadosHerois.buffs,

    nerfs:
      dadosHerois.nerfs,

    ajustes:
      dadosHerois.ajustes,

    correcoes,

    buffsPartes:
      dividirTexto(
        buffsTexto
      ),

    nerfsPartes:
      dividirTexto(
        nerfsTexto
      ),

    alteracoesPartes:
      dividirTexto(
        ajustesTexto
      ),

    correcoesPartes:
      dividirTexto(
        correcoesTexto
      ),

    tudoPartes:
      dividirTexto(
        tudoTexto
      )
  };

  cache.dados =
    resultado;

  cache.atualizadoEm =
    agora;

  return resultado;
}

// ======================================================
// PATCH DE UM HERÓI
// ======================================================

async function obterPatchHeroi(
  nomeHeroi
) {
  const dados =
    await obterDados();

  const hero =
    encontrarHeroi(
      nomeHeroi
    );

  if (!hero) {
    return null;
  }

  const mudancas = [
    ...dados.buffs.filter(
      (item) =>
        normalizar(
          item.hero
        ) ===
        normalizar(hero)
    ),

    ...dados.nerfs.filter(
      (item) =>
        normalizar(
          item.hero
        ) ===
        normalizar(hero)
    ),

    ...dados.ajustes.filter(
      (item) =>
        normalizar(
          item.hero
        ) ===
        normalizar(hero)
    )
  ];

  if (
    mudancas.length === 0
  ) {
    return {
      hero,

      buffs: [],

      nerfs: [],

      ajustes: [],

      texto:
        `Nenhuma alteração encontrada para ${hero}.`
    };
  }

  const buffs =
    mudancas.filter(
      (item) =>
        item.tipo ===
        "buff"
    );

  const nerfs =
    mudancas.filter(
      (item) =>
        item.tipo ===
        "nerf"
    );

  const ajustes =
    mudancas.filter(
      (item) =>
        item.tipo ===
        "ajuste"
    );

  let texto =
    `🦸 **${hero}**\n\n`;

  // ----------------------------------------------------
  // BUFFS
  // ----------------------------------------------------

  if (
    buffs.length > 0
  ) {
    texto +=
      "🟢 **BUFFS**\n\n";

    for (
      const item of buffs
    ) {
      if (
        item.habilidade
      ) {
        texto +=
          `🔹 **${item.habilidade}**\n` +
          `${item.change}\n\n`;
      } else {
        texto +=
          `${item.change}\n\n`;
      }
    }
  }

  // ----------------------------------------------------
  // NERFS
  // ----------------------------------------------------

  if (
    nerfs.length > 0
  ) {
    texto +=
      "🔴 **NERFS**\n\n";

    for (
      const item of nerfs
    ) {
      if (
        item.habilidade
      ) {
        texto +=
          `🔹 **${item.habilidade}**\n` +
          `${item.change}\n\n`;
      } else {
        texto +=
          `${item.change}\n\n`;
      }
    }
  }

  // ----------------------------------------------------
  // ALTERAÇÕES
  // ----------------------------------------------------

  if (
    ajustes.length > 0
  ) {
    texto +=
      "⚪ **ALTERAÇÕES**\n\n";

    for (
      const item of ajustes
    ) {
      if (
        item.habilidade
      ) {
        texto +=
          `🔹 **${item.habilidade}**\n` +
          `${item.change}\n\n`;
      } else {
        texto +=
          `${item.change}\n\n`;
      }
    }
  }

  return {
    hero,

    buffs,

    nerfs,

    ajustes,

    texto:
      texto.trim()
  };
}

// ======================================================
// SERVIDOR
// ======================================================

const server =
  http.createServer(
    async (req, res) => {
      try {
        const url =
          new URL(
            req.url,
            `http://${
              req.headers.host ||
              "localhost"
            }`
          );

        // ==================================================
        // /
        // ==================================================

        if (
          url.pathname === "/"
        ) {
          res.writeHead(
            200,
            {
              "Content-Type":
                "application/json; charset=utf-8"
            }
          );

          res.end(
            JSON.stringify({
              sucesso: true,

              mensagem:
                "Overwatch Patch API funcionando!",

              endpoints: [
                "/",
                "/dados",
                "/patch?hero=D.Va",
                "/test-blizzard"
              ]
            })
          );

          return;
        }

        // ==================================================
        // /test-blizzard
        // ==================================================

        if (
          url.pathname ===
          "/test-blizzard"
        ) {
          const html =
            await baixarPagina(
              BLIZZARD_URL
            );

          const buscar =
            url.searchParams.get(
              "buscar"
            );

          let resultado = {
            sucesso: true,

            tamanhoHTML:
              html.length,

            inicioHTML:
              html.substring(
                0,
                1000
              )
          };

          if (buscar) {
            const indice =
              normalizar(
                html
              ).indexOf(
                normalizar(
                  buscar
                )
              );

            resultado.busca =
              buscar;

            resultado.encontrado =
              indice !== -1;

            if (
              indice !== -1
            ) {
              resultado.trecho =
                html.substring(
                  Math.max(
                    0,
                    indice - 1500
                  ),

                  Math.min(
                    html.length,
                    indice + 5000
                  )
                );
            }
          }

          res.writeHead(
            200,
            {
              "Content-Type":
                "application/json; charset=utf-8"
            }
          );

          res.end(
            JSON.stringify(
              resultado
            )
          );

          return;
        }

        // ==================================================
        // /dados
        // ==================================================

        if (
          url.pathname ===
          "/dados"
        ) {
          const dados =
            await obterDados();

          res.writeHead(
            200,
            {
              "Content-Type":
                "application/json; charset=utf-8"
            }
          );

          res.end(
            JSON.stringify(
              dados
            )
          );

          return;
        }

        // ==================================================
        // /patch
        // ==================================================

        if (
          url.pathname ===
          "/patch"
        ) {
          const nomeHeroi =
            url.searchParams.get(
              "hero"
            );

          if (!nomeHeroi) {
            res.writeHead(
              400,
              {
                "Content-Type":
                  "application/json; charset=utf-8"
              }
            );

            res.end(
              JSON.stringify({
                erro:
                  "Informe o herói usando ?hero=D.Va"
              })
            );

            return;
          }

          const resultado =
            await obterPatchHeroi(
              nomeHeroi
            );

          if (!resultado) {
            res.writeHead(
              404,
              {
                "Content-Type":
                  "application/json; charset=utf-8"
              }
            );

            res.end(
              JSON.stringify({
                erro:
                  `Herói não encontrado: ${nomeHeroi}`
              })
            );

            return;
          }

          res.writeHead(
            200,
            {
              "Content-Type":
                "application/json; charset=utf-8"
            }
          );

          res.end(
            JSON.stringify(
              resultado
            )
          );

          return;
        }

        // ==================================================
        // 404
        // ==================================================

        res.writeHead(
          404,
          {
            "Content-Type":
              "application/json; charset=utf-8"
          }
        );

        res.end(
          JSON.stringify({
            erro:
              "Endpoint não encontrado."
          })
        );
      } catch (erro) {
        console.error(
          "Erro:",
          erro
        );

        res.writeHead(
          500,
          {
            "Content-Type":
              "application/json; charset=utf-8"
          }
        );

        res.end(
          JSON.stringify({
            erro:
              "Erro interno no servidor.",

            detalhes:
              erro.message
          })
        );
      }
    }
  );

// ======================================================
// INICIAR SERVIDOR
// ======================================================

server.listen(
  PORT,
  () => {
    console.log(
      `Servidor rodando na porta ${PORT}`
    );

    console.log(
      "Endpoint: /patch?hero=D.Va"
    );
  }
);
