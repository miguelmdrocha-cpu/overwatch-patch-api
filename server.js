const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;

const BLIZZARD_URL =
  "https://overwatch.blizzard.com/pt-br/news/patch-notes/live/";

// Verifica novamente as Patch Notes a cada 5 minutos
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
// UTILIDADES
// ======================================================

function limparHTML(texto) {
  if (!texto) return "";

  return texto
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, codigo) => {
      try {
        return String.fromCharCode(Number(codigo));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo) => {
      try {
        return String.fromCharCode(
          parseInt(codigo, 16)
        );
      } catch {
        return "";
      }
    })
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
      (hero) =>
        normalizar(hero) === normalizado
    ) || null
  );
}

// ======================================================
// ENCONTRAR BLOCOS PELO NOME DA CLASSE
// ======================================================

function extrairBlocosPorClasse(
  html,
  classe
) {
  const resultados = [];

  const regex = new RegExp(
    `<[^>]+class=["'][^"']*${classe}[^"']*["'][^>]*>`,
    "gi"
  );

  const encontrados = [];

  let match;

  while ((match = regex.exec(html)) !== null) {
    encontrados.push({
      inicio: match.index,
      fimTag: regex.lastIndex
    });
  }

  for (let i = 0; i < encontrados.length; i++) {
    const atual = encontrados[i];
    const proximo =
      encontrados[i + 1];

    const fim = proximo
      ? proximo.inicio
      : html.length;

    resultados.push(
      html.substring(
        atual.inicio,
        fim
      )
    );
  }

  return resultados;
}

// ======================================================
// EXTRAIR CONTEÚDO DE UMA CLASSE
// ======================================================

function extrairConteudoClasse(
  html,
  classe
) {
  const regex = new RegExp(
    `<[^>]+class=["'][^"']*${classe}[^"']*["'][^>]*>`,
    "i"
  );

  const match = html.match(regex);

  if (!match) {
    return null;
  }

  const inicio =
    match.index + match[0].length;

  return html.substring(inicio);
}

// ======================================================
// CLASSIFICAÇÃO
// ======================================================

function classificarMudanca(texto) {
  const t = normalizar(texto);

  if (!t) {
    return "ajuste";
  }

  // ====================================================
  // ALTERAÇÕES VISUAIS / SONORAS
  // ====================================================

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

  // ====================================================
  // RECARGA
  // ====================================================

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
      t.includes("diminuiu para") ||
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

  // ====================================================
  // RECUPERAÇÃO
  // ====================================================

  if (
    t.includes("recuperacao") ||
    t.includes("tempo de recuperacao")
  ) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas")
    ) {
      return "nerf";
    }
  }

  // ====================================================
  // TEMPO DE LANÇAMENTO
  // ====================================================

  if (
    t.includes("tempo de lancamento") ||
    t.includes("tempo de lançamento")
  ) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas")
    ) {
      return "nerf";
    }
  }

  // ====================================================
  // DISPERSÃO
  // ====================================================

  if (t.includes("dispersao")) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas")
    ) {
      return "nerf";
    }
  }

  // ====================================================
  // ATRASO
  // ====================================================

  if (t.includes("atraso")) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas")
    ) {
      return "nerf";
    }
  }

  // ====================================================
  // CUSTO
  // ====================================================

  if (t.includes("custo")) {
    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas")
    ) {
      return "buff";
    }

    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas")
    ) {
      return "nerf";
    }
  }

  // ====================================================
  // DURAÇÃO
  // ====================================================

  if (t.includes("duracao")) {
    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas")
    ) {
      return "buff";
    }

    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas")
    ) {
      return "nerf";
    }
  }

  // ====================================================
  // ATRIBUTOS
  // ====================================================

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
    "restituicao"
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
        t.includes("diminui")
      ) {
        return "nerf";
      }
    }
  }

  // ====================================================
  // MOVIMENTO
  // ====================================================

  if (
    t.includes("velocidade adicional") ||
    t.includes("movimento adicional")
  ) {
    if (
      t.includes("aumentado") ||
      t.includes("aumentada") ||
      t.includes("aumentados") ||
      t.includes("aumentadas")
    ) {
      return "buff";
    }

    if (
      t.includes("reduzido") ||
      t.includes("reduzida") ||
      t.includes("reduzidos") ||
      t.includes("reduzidas")
    ) {
      return "nerf";
    }
  }

  // ====================================================
  // PALAVRAS GERAIS
  // ====================================================

  if (
    t.includes("aumentado") ||
    t.includes("aumentada") ||
    t.includes("aumentados") ||
    t.includes("aumentadas") ||
    t.includes("aumentou") ||
    t.includes("melhorado") ||
    t.includes("melhorada") ||
    t.includes("melhorados") ||
    t.includes("melhoradas")
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

  return "ajuste";
}

// ======================================================
// EXTRAÇÃO DE LISTAS
// ======================================================

function extrairLista(html) {
  const resultados = [];

  if (!html) {
    return resultados;
  }

  const regex =
    /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const texto =
      limparHTML(match[1]);

    if (texto) {
      resultados.push(texto);
    }
  }

  return resultados;
}

// ======================================================
// EXTRAÇÃO DO NOME DA HABILIDADE
// ======================================================

function extrairNomeHabilidade(bloco) {
  const regex =
    /<[^>]+class=["'][^"']*PatchNotesAbilityUpdate-name[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i;

  const match =
    bloco.match(regex);

  if (!match) {
    return null;
  }

  const nome =
    limparHTML(match[1]);

  return nome || null;
}

// ======================================================
// EXTRAÇÃO DAS MUDANÇAS DA HABILIDADE
// ======================================================

function extrairMudancasHabilidade(
  bloco
) {
  if (!bloco) {
    return [];
  }

  // Primeiro tenta especificamente a lista
  const regex =
    /<[^>]+class=["'][^"']*PatchNotesAbilityUpdate-detailList[^"']*["'][^>]*>([\s\S]*?)(?=<[^>]+class=|$)/i;

  const match =
    bloco.match(regex);

  if (match) {
    const itens =
      extrairLista(match[1]);

    if (itens.length > 0) {
      return itens;
    }
  }

  // Fallback: pega qualquer <li> da habilidade
  return extrairLista(bloco);
}

// ======================================================
// EXTRAÇÃO DOS BLOCOS DE HABILIDADES
// ======================================================

function extrairBlocosHabilidades(
  blocoHeroi
) {
  return extrairBlocosPorClasse(
    blocoHeroi,
    "PatchNotesAbilityUpdate"
  );
}

// ======================================================
// EXTRAÇÃO DOS BLOCOS DE HERÓIS
// ======================================================

function extrairBlocosHerois(html) {
  return extrairBlocosPorClasse(
    html,
    "PatchNotesHeroUpdate"
  );
}

// ======================================================
// ESTÁDIO
// ======================================================

function pertenceAoEstadio(bloco) {
  const t =
    normalizar(bloco);

  return (
    t.includes(
      "atualizacoes do estadio"
    ) ||
    t.includes(
      "atualizacoes do estdio"
    ) ||
    t.includes("stadium")
  );
}

// ======================================================
// ADICIONAR MUDANÇA
// ======================================================

function adicionarMudanca(
  destino,
  hero,
  habilidade,
  mudanca
) {
  if (!mudanca) {
    return;
  }

  const tipo =
    classificarMudanca(mudanca);

  const item = {
    hero,
    habilidade: habilidade || null,
    tipo,
    change: mudanca
  };

  if (tipo === "buff") {
    destino.buffs.push(item);
  } else if (tipo === "nerf") {
    destino.nerfs.push(item);
  } else {
    destino.ajustes.push(item);
  }
}

// ======================================================
// EXTRAÇÃO DOS DADOS DOS HERÓIS
// ======================================================

function extrairDadosHerois(html) {
  const resultado = {
    buffs: [],
    nerfs: [],
    ajustes: []
  };

  const blocosHerois =
    extrairBlocosHerois(html);

  for (const bloco of blocosHerois) {
    if (pertenceAoEstadio(bloco)) {
      continue;
    }

    // ----------------------------------------------
    // NOME DO HERÓI
    // ----------------------------------------------

    const nomeRegex =
      /<[^>]+class=["'][^"']*PatchNotesHeroUpdate-name[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i;

    const nomeMatch =
      bloco.match(nomeRegex);

    if (!nomeMatch) {
      continue;
    }

    const nomeOriginal =
      limparHTML(nomeMatch[1]);

    const hero =
      encontrarHeroi(nomeOriginal);

    if (!hero) {
      continue;
    }

    // ----------------------------------------------
    // COMENTÁRIO DOS DESENVOLVEDORES
    // ----------------------------------------------

    const devRegex =
      /<[^>]+class=["'][^"']*PatchNotes-dev[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi;

    let devMatch;

    while (
      (devMatch = devRegex.exec(bloco)) !== null
    ) {
      const comentario =
        limparHTML(devMatch[1]);

      if (comentario) {
        adicionarMudanca(
          resultado,
          hero,
          null,
          comentario
        );
      }
    }

    // ----------------------------------------------
    // MUDANÇAS GERAIS
    // ----------------------------------------------

    const generalRegex =
      /<[^>]+class=["'][^"']*PatchNotesHeroUpdate-generalUpdates[^"']*["'][^>]*>/i;

    const generalMatch =
      bloco.match(generalRegex);

    if (generalMatch) {
      const inicio =
        generalMatch.index +
        generalMatch[0].length;

      let fim = bloco.length;

      const habilidadesIndex =
        bloco
          .toLowerCase()
          .indexOf(
            "patchnotesheroupdate-abilitieslist",
            inicio
          );

      if (
        habilidadesIndex !== -1
      ) {
        fim = habilidadesIndex;
      }

      const generalHTML =
        bloco.substring(
          inicio,
          fim
        );

      const mudancasGerais =
        extrairLista(generalHTML);

      for (
        const mudanca of mudancasGerais
      ) {
        adicionarMudanca(
          resultado,
          hero,
          null,
          mudanca
        );
      }
    }

    // ----------------------------------------------
    // HABILIDADES
    // ----------------------------------------------

    const habilidades =
      extrairBlocosHabilidades(
        bloco
      );

    for (
      const habilidadeBloco of habilidades
    ) {
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

      for (
        const mudanca of mudancas
      ) {
        adicionarMudanca(
          resultado,
          hero,
          habilidade,
          mudanca
        );
      }
    }
  }

  return resultado;
}
// ======================================================
// CORREÇÕES E BUGS
// ======================================================

function extrairCorrecoes(html) {
  const resultados = [];

  const secoes =
    extrairBlocosPorClasse(
      html,
      "PatchNotes-section"
    );

  for (const secao of secoes) {
    const tituloRegex =
      /<[^>]+class=["'][^"']*PatchNotes-sectionTitle[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i;

    const tituloMatch =
      secao.match(tituloRegex);

    if (!tituloMatch) {
      continue;
    }

    const titulo =
      normalizar(
        limparHTML(
          tituloMatch[1]
        )
      );

    const ehCorrecao =
      titulo.includes("correc") ||
      titulo.includes("bug") ||
      titulo.includes("fix");

    if (!ehCorrecao) {
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
// TEXTO DOS DADOS
// ======================================================

function criarTexto(lista) {
  if (
    !lista ||
    lista.length === 0
  ) {
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

// ======================================================
// TEXTO DAS CORREÇÕES
// ======================================================

function criarTextoCorrecoes(
  lista
) {
  if (
    !lista ||
    lista.length === 0
  ) {
    return "Nenhuma correção encontrada.";
  }

  return lista
    .map(
      (item) =>
        `🛠️ ${item}`
    )
    .join("\n\n");
}

// ======================================================
// DIVIDIR TEXTO PARA DISCORD/BDFD
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

    atual +=
      linha + "\n";
  }

  if (atual.trim()) {
    partes.push(
      atual.trim()
    );
  }

  return partes;
}

// ======================================================
// BAIXAR PÁGINA DA BLIZZARD
// ======================================================

function baixarPagina(url) {
  return new Promise(
    (resolve, reject) => {
      const request =
        https.get(
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
          (res) => {
            let dados = "";

            res.setEncoding(
              "utf8"
            );

            res.on(
              "data",
              (chunk) => {
                dados += chunk;
              }
            );

            res.on(
              "end",
              () => {
                // Redirecionamento
                if (
                  res.statusCode >=
                    300 &&
                  res.statusCode <
                    400 &&
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

                if (!dados) {
                  reject(
                    new Error(
                      "A Blizzard retornou uma página vazia."
                    )
                  );

                  return;
                }

                resolve(dados);
              }
            );
          }
        );

      request.setTimeout(
        30000,
        () => {
          request.destroy(
            new Error(
              "Tempo limite ao acessar as Patch Notes da Blizzard."
            )
          );
        }
      );

      request.on(
        "error",
        reject
      );
    }
  );
}

// ======================================================
// OBTER DADOS ATUALIZADOS
// ======================================================

async function obterDados() {
  const agora =
    Date.now();

  // Usa o cache durante 5 minutos
  if (
    cache.dados &&
    agora -
      cache.atualizadoEm <
      CACHE_TIME
  ) {
    return cache.dados;
  }

  console.log(
    "🔄 Buscando Patch Notes atualizadas da Blizzard..."
  );

  const html =
    await baixarPagina(
      BLIZZARD_URL
    );

  console.log(
    `📄 HTML recebido: ${html.length} caracteres`
  );

  const dadosHerois =
    extrairDadosHerois(
      html
    );

  const correcoes =
    extrairCorrecoes(
      html
    );

  console.log(
    `🟢 Buffs: ${dadosHerois.buffs.length}`
  );

  console.log(
    `🔴 Nerfs: ${dadosHerois.nerfs.length}`
  );

  console.log(
    `⚪ Alterações: ${dadosHerois.ajustes.length}`
  );

  console.log(
    `🛠️ Correções: ${correcoes.length}`
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

  const tudoTexto =
    [
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
    sucesso: true,

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

  const buffs =
    dados.buffs.filter(
      (item) =>
        normalizar(
          item.hero
        ) ===
        normalizar(hero)
    );

  const nerfs =
    dados.nerfs.filter(
      (item) =>
        normalizar(
          item.hero
        ) ===
        normalizar(hero)
    );

  const ajustes =
    dados.ajustes.filter(
      (item) =>
        normalizar(
          item.hero
        ) ===
        normalizar(hero)
    );

  const mudancas = [
    ...buffs,
    ...nerfs,
    ...ajustes
  ];

  if (
    mudancas.length === 0
  ) {
    return {
      sucesso: true,
      hero,
      buffs: [],
      nerfs: [],
      ajustes: [],
      texto:
        `Nenhuma alteração encontrada para ${hero}.`
    };
  }

  let texto =
    `🦸 **${hero}**\n\n`;

  // ----------------------------------------------
  // BUFFS
  // ----------------------------------------------

  if (buffs.length > 0) {
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

  // ----------------------------------------------
  // NERFS
  // ----------------------------------------------

  if (nerfs.length > 0) {
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

  // ----------------------------------------------
  // ALTERAÇÕES
  // ----------------------------------------------

  if (ajustes.length > 0) {
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
    sucesso: true,

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
            `http://${req.headers.host || "localhost"}`
          );

        // --------------------------------------------
        // ROTA PRINCIPAL
        // --------------------------------------------

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
            JSON.stringify(
              {
                sucesso: true,

                mensagem:
                  "Overwatch Patch API funcionando!",

                atualizadoAutomaticamente:
                  true,

                cache:
                  "5 minutos",

                endpoints: [
                  "/",
                  "/dados",
                  "/patch?hero=D.Va",
                  "/test-blizzard"
                ]
              }
            )
          );

          return;
        }

        // --------------------------------------------
        // TESTE DA BLIZZARD
        // --------------------------------------------

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

          const resultado = {
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

        // --------------------------------------------
        // DADOS
        // --------------------------------------------

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

        // --------------------------------------------
        // PATCH DO HERÓI
        // --------------------------------------------

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
              JSON.stringify(
                {
                  sucesso:
                    false,

                  erro:
                    "Informe o herói usando ?hero=D.Va"
                }
              )
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
              JSON.stringify(
                {
                  sucesso:
                    false,

                  erro:
                    `Herói não encontrado: ${nomeHeroi}`
                }
              )
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

        // --------------------------------------------
        // 404
        // --------------------------------------------

        res.writeHead(
          404,
          {
            "Content-Type":
              "application/json; charset=utf-8"
          }
        );

        res.end(
          JSON.stringify(
            {
              sucesso:
                false,

              erro:
                "Endpoint não encontrado."
            }
          )
        );
      } catch (erro) {
        console.error(
          "❌ Erro:",
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
          JSON.stringify(
            {
              sucesso:
                false,

              erro:
                "Erro interno no servidor.",

              detalhes:
                erro.message
            }
          )
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
      `🚀 Servidor rodando na porta ${PORT}`
    );

    console.log(
      `📡 Fonte: ${BLIZZARD_URL}`
    );

    console.log(
      `🔎 Endpoint de herói: /patch?hero=D.Va`
    );

    console.log(
      "🔄 Atualização automática: a cada 5 minutos"
    );
  }
);
