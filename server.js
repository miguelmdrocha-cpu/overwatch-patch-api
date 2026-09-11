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
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ======================================================
// ENCONTRAR HERÓI
// ======================================================

function encontrarHeroi(nome) {
  const alvo = normalizar(nome);

  for (const heroi of HEROIS) {
    if (normalizar(heroi) === alvo) {
      return heroi;
    }
  }

  return null;
}

// ======================================================
// CLASSIFICAÇÃO
// ======================================================

function classificarMudanca(texto) {
  const t = normalizar(texto);

  // Ajustes que não devem ser tratados simplesmente
  // como buff/nerf.
  const ajustes = [
    "ajustado",
    "ajustada",
    "ajustados",
    "ajustadas",
    "alterado",
    "alterada",
    "alterados",
    "alteradas",
    "modificado",
    "modificada",
    "modificados",
    "modificadas",
    "passou de",
    "agora causa",
    "agora possui"
  ];

  for (const palavra of ajustes) {
    if (t.includes(palavra)) {
      return "ajuste";
    }
  }

  // Casos claramente negativos.
  const nerfs = [
    "dano reduzido",
    "dano reduzida",
    "cura reduzida",
    "cura reduzido",
    "vida reduzida",
    "vida reduzido",
    "alcance reduzido",
    "alcance reduzida",
    "velocidade reduzida",
    "velocidade reduzido",
    "duracao reduzida",
    "duração reduzida",
    "duracao reduzido",
    "duração reduzido",
    "tempo de recarga aumentado",
    "tempo de recarga aumentada",
    "recarga aumentada",
    "recarga aumentada",
    "custo aumentado",
    "custo aumentada",
    "municao reduzida",
    "munição reduzida",
    "municao reduzido",
    "munição reduzido",
    "quantidade reduzida",
    "quantidade reduzido",
    "reduzido de",
    "reduzida de",
    "reduzido para",
    "reduzida para",
    "reduzidos de",
    "reduzidas de",
    "reduzidos para",
    "reduzidas para"
  ];

  for (const palavra of nerfs) {
    if (t.includes(palavra)) {
      return "nerf";
    }
  }

  // Buffs.
  const buffs = [
    "dano aumentado",
    "dano aumentada",
    "cura aumentada",
    "cura aumentado",
    "vida aumentada",
    "vida aumentado",
    "alcance aumentado",
    "alcance aumentada",
    "velocidade aumentada",
    "velocidade aumentado",
    "duracao aumentada",
    "duração aumentada",
    "duracao aumentado",
    "duração aumentado",
    "tempo de recarga reduzido",
    "tempo de recarga reduzida",
    "recarga reduzida",
    "recarga reduzido",
    "custo reduzido",
    "custo reduzida",
    "quantidade aumentada",
    "quantidade aumentado",
    "aumentado de",
    "aumentada de",
    "aumentado para",
    "aumentada para",
    "aumentados de",
    "aumentadas de",
    "aumentados para",
    "aumentadas para"
  ];

  for (const palavra of buffs) {
    if (t.includes(palavra)) {
      return "buff";
    }
  }

  // Palavras gerais.
  if (
    t.includes("aumentado") ||
    t.includes("aumentada") ||
    t.includes("aumentados") ||
    t.includes("aumentadas") ||
    t.includes("melhorado") ||
    t.includes("melhorada")
  ) {
    return "buff";
  }

  if (
    t.includes("reduzido") ||
    t.includes("reduzida") ||
    t.includes("reduzidos") ||
    t.includes("reduzidas") ||
    t.includes("diminuido") ||
    t.includes("diminuída")
  ) {
    return "nerf";
  }

  return "ajuste";
}

// ======================================================
// EXTRAIR LISTA <li>
// ======================================================

function extrairLista(html) {
  const resultado = [];

  if (!html) return resultado;

  const regex = /<li[^>]*>([\s\S]*?)<\/li>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto = limparHTML(match[1]);

    if (texto) {
      resultado.push(texto);
    }
  }

  return resultado;
}

// ======================================================
// EXTRAIR NOME DA HABILIDADE
// ======================================================

function extrairNomeHabilidade(bloco) {
  const regex =
    /PatchNotesAbilityUpdate-name[^>]*>([\s\S]*?)<\/div>/i;

  const match = bloco.match(regex);

  if (!match) return null;

  const nome = limparHTML(match[1]);

  return nome || null;
}

// ======================================================
// EXTRAIR ALTERAÇÕES DE HABILIDADE
// ======================================================

function extrairMudancasHabilidade(bloco) {
  const resultado = [];

  const regex =
    /<div[^>]*class="PatchNotesAbilityUpdate"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;

  let match;

  while ((match = regex.exec(bloco)) !== null) {
    const habilidadeBloco = match[1];

    const nome = extrairNomeHabilidade(habilidadeBloco);

    const detalhesMatch =
      habilidadeBloco.match(
        /PatchNotesAbilityUpdate-detailList[^>]*>([\s\S]*?)<\/div>/i
      );

    if (!detalhesMatch) continue;

    const mudancas = extrairLista(detalhesMatch[1]);

    for (const mudanca of mudancas) {
      resultado.push({
        habilidade: nome,
        change: mudanca
      });
    }
  }

  return resultado;
}

// ======================================================
// EXTRAIR BLOCO DE UMA HABILIDADE
// ======================================================

function extrairBlocosHabilidades(blocoHeroi) {
  const blocos = [];

  const marcador =
    '<div class="PatchNotesAbilityUpdate"';

  let pos = 0;

  while (true) {
    const inicio = blocoHeroi.indexOf(marcador, pos);

    if (inicio === -1) break;

    const proximo = blocoHeroi.indexOf(
      marcador,
      inicio + marcador.length
    );

    const fim =
      proximo === -1
        ? blocoHeroi.length
        : proximo;

    blocos.push(
      blocoHeroi.substring(inicio, fim)
    );

    pos = fim;
  }

  return blocos;
}

// ======================================================
// EXTRAIR BLOCOS DE HERÓIS
// ======================================================

function extrairBlocosHerois(html) {
  const resultado = [];

  const regex =
    /<div[^>]*class="PatchNotesHeroUpdate"[^>]*>/gi;

  let match;

  const posicoes = [];

  while ((match = regex.exec(html)) !== null) {
    posicoes.push(match.index);
  }

  for (let i = 0; i < posicoes.length; i++) {
    const inicio = posicoes[i];

    const fim =
      i + 1 < posicoes.length
        ? posicoes[i + 1]
        : html.length;

    const bloco = html.substring(inicio, fim);

    resultado.push(bloco);
  }

  return resultado;
}

// ======================================================
// IDENTIFICAR SE O BLOCO É DO ESTÁDIO
// ======================================================

function pertenceAoEstadio(html, inicioBloco) {
  const antes = html.substring(
    Math.max(0, inicioBloco - 12000),
    inicioBloco
  );

  return (
    normalizar(antes).includes(
      "atualizacoes do estadio"
    ) ||
    normalizar(antes).includes(
      "atualizacoes de estadio"
    )
  );
}

// ======================================================
// EXTRAIR DADOS DOS HERÓIS
// ======================================================

function extrairDadosHerois(html) {
  const resultado = [];

  const regexHeroi =
    /PatchNotesHeroUpdate-name[^>]*>([\s\S]*?)<\/h5>/i;

  const posicoes = [];

  const regexBloco =
    /<div[^>]*class="PatchNotesHeroUpdate"[^>]*>/gi;

  let match;

  while ((match = regexBloco.exec(html)) !== null) {
    posicoes.push(match.index);
  }

  for (let i = 0; i < posicoes.length; i++) {
    const inicio = posicoes[i];

    const fim =
      i + 1 < posicoes.length
        ? posicoes[i + 1]
        : html.length;

    const bloco = html.substring(inicio, fim);

    // Ignorar atualizações do Estádio.
    if (pertenceAoEstadio(html, inicio)) {
      continue;
    }

    const nomeMatch = bloco.match(regexHeroi);

    if (!nomeMatch) continue;

    const nomeEncontrado =
      encontrarHeroi(limparHTML(nomeMatch[1]));

    if (!nomeEncontrado) continue;

    // --------------------------------------------
    // ALTERAÇÕES GERAIS DO HERÓI
    // --------------------------------------------

    const regexGeral =
      /PatchNotesHeroUpdate-generalUpdates[^>]*>([\s\S]*?)<\/div>/i;

    const geralMatch = bloco.match(regexGeral);

    if (geralMatch) {
      const mudancasGerais =
        extrairLista(geralMatch[1]);

      for (const mudanca of mudancasGerais) {
        resultado.push({
          hero: nomeEncontrado,
          habilidade: null,
          tipo: classificarMudanca(mudanca),
          change: mudanca
        });
      }
    }

    // --------------------------------------------
    // HABILIDADES
    // --------------------------------------------

    const habilidades =
      extrairBlocosHabilidades(bloco);

    for (const habilidadeBloco of habilidades) {
      const nomeHabilidade =
        extrairNomeHabilidade(habilidadeBloco);

      if (!nomeHabilidade) continue;

      const detalheMatch =
        habilidadeBloco.match(
          /PatchNotesAbilityUpdate-detailList[^>]*>([\s\S]*?)<\/div>/i
        );

      if (!detalheMatch) continue;

      const mudancas =
        extrairLista(detalheMatch[1]);

      for (const mudanca of mudancas) {
        resultado.push({
          hero: nomeEncontrado,
          habilidade: nomeHabilidade,
          tipo: classificarMudanca(mudanca),
          change: mudanca
        });
      }
    }
  }

  return resultado;
}
// ======================================================
// CORREÇÕES
// ======================================================

function extrairCorrecoes(html) {
  const resultado = [];

  if (!html) return resultado;

  /*
   * Procuramos uma seção de correções.
   * A Blizzard pode alterar detalhes internos do HTML,
   * então usamos o título da seção como referência.
   */

  const regexSecao =
    /<div[^>]*class="PatchNotes-section[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="PatchNotes-section)/gi;

  let match;

  while ((match = regexSecao.exec(html)) !== null) {
    const secao = match[1];

    const textoSecao = normalizar(
      limparHTML(
        secao
          .substring(0, 3000)
      )
    );

    if (
      !textoSecao.includes("corre") &&
      !textoSecao.includes("bug")
    ) {
      continue;
    }

    const itens = extrairLista(secao);

    for (const item of itens) {
      if (item && !resultado.includes(item)) {
        resultado.push(item);
      }
    }
  }

  /*
   * Fallback:
   * se a estrutura acima não encontrar a seção,
   * procuramos títulos que contenham Correções.
   */

  if (resultado.length === 0) {
    const regexCorrecao =
      /<h[1-6][^>]*>([\s\S]*?(?:Correções|Correcoes|Bugs)[\s\S]*?)<\/h[1-6]>/gi;

    let titulo;

    while ((titulo = regexCorrecao.exec(html)) !== null) {
      const inicio = titulo.index;

      const trecho =
        html.substring(
          inicio,
          inicio + 20000
        );

      const itens =
        extrairLista(trecho);

      for (const item of itens) {
        if (item && !resultado.includes(item)) {
          resultado.push(item);
        }
      }
    }
  }

  return resultado;
}

// ======================================================
// CRIAR TEXTO
// ======================================================

function criarTexto(lista) {
  if (!lista || lista.length === 0) {
    return "";
  }

  return lista
    .map(item => {
      let linha = "";

      if (item.habilidade) {
        linha += `**${item.hero} — ${item.habilidade}:** `;
      } else {
        linha += `**${item.hero}:** `;
      }

      linha += item.change;

      return linha;
    })
    .join("\n");
}

// ======================================================
// TEXTO DAS CORREÇÕES
// ======================================================

function criarTextoCorrecoes(correcoes) {
  if (!correcoes || correcoes.length === 0) {
    return "";
  }

  return correcoes
    .map(item => `• ${item}`)
    .join("\n");
}

// ======================================================
// DIVIDIR TEXTO
// ======================================================

function dividirTexto(texto, limite = 4000) {
  if (!texto) return [];

  const partes = [];

  let atual = "";

  const linhas = texto.split("\n");

  for (const linha of linhas) {
    if (
      atual.length + linha.length + 1 >
      limite
    ) {
      if (atual.trim()) {
        partes.push(atual.trim());
      }

      atual = linha;
    } else {
      atual +=
        (atual ? "\n" : "") +
        linha;
    }
  }

  if (atual.trim()) {
    partes.push(atual.trim());
  }

  return partes;
}

// ======================================================
// BAIXAR PÁGINA DA BLIZZARD
// ======================================================

function baixarPagina(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept-Language":
            "pt-BR,pt;q=0.9,en;q=0.8"
        }
      },
      response => {
        let dados = "";

        response.setEncoding("utf8");

        response.on(
          "data",
          parte => {
            dados += parte;
          }
        );

        response.on(
          "end",
          () => {
            if (
              response.statusCode >= 300 &&
              response.statusCode < 400 &&
              response.headers.location
            ) {
              baixarPagina(
                response.headers.location
              )
                .then(resolve)
                .catch(reject);

              return;
            }

            if (
              response.statusCode !== 200
            ) {
              reject(
                new Error(
                  `Blizzard respondeu HTTP ${response.statusCode}`
                )
              );

              return;
            }

            resolve(dados);
          }
        );
      }
    ).on(
      "error",
      reject
    );
  });
}

// ======================================================
// OBTER DADOS
// ======================================================

async function obterDados() {
  const agora = Date.now();

  if (
    cache.dados &&
    agora - cache.atualizadoEm <
      CACHE_TIME
  ) {
    return cache.dados;
  }

  const html =
    await baixarPagina(
      BLIZZARD_URL
    );

  const mudancas =
    extrairDadosHerois(html);

  const correcoes =
    extrairCorrecoes(html);

  const buffs =
    mudancas.filter(
      item => item.tipo === "buff"
    );

  const nerfs =
    mudancas.filter(
      item => item.tipo === "nerf"
    );

  const ajustes =
    mudancas.filter(
      item => item.tipo === "ajuste"
    );

  const buffsTexto =
    criarTexto(buffs);

  const nerfsTexto =
    criarTexto(nerfs);

  const ajustesTexto =
    criarTexto(ajustes);

  const correcoesTexto =
    criarTextoCorrecoes(
      correcoes
    );

  const tudoTexto = [
    buffsTexto
      ? "🟢 BUFFS\n" + buffsTexto
      : "",

    nerfsTexto
      ? "🔴 NERFS\n" + nerfsTexto
      : "",

    ajustesTexto
      ? "⚪ ALTERAÇÕES\n" + ajustesTexto
      : "",

    correcoesTexto
      ? "🛠️ CORREÇÕES\n" + correcoesTexto
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const dados = {
    atualizadoEm:
      new Date().toISOString(),

    buffs,

    nerfs,

    ajustes,

    correcoes,

    buffsTexto,

    nerfsTexto,

    ajustesTexto,

    correcoesTexto,

    tudoTexto,

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

  cache.dados = dados;
  cache.atualizadoEm = agora;

  return dados;
}

// ======================================================
// BUSCAR UM HERÓI
// ======================================================

async function obterPatchHeroi(nome) {
  const dados =
    await obterDados();

  const heroi =
    encontrarHeroi(nome);

  if (!heroi) {
    return {
      erro: true,
      mensagem:
        "Herói não encontrado."
    };
  }

  const mudancas =
    [
      ...dados.buffs,
      ...dados.nerfs,
      ...dados.ajustes
    ].filter(
      item =>
        normalizar(
          item.hero
        ) === normalizar(heroi)
    );

  const buffs =
    mudancas.filter(
      item =>
        item.tipo === "buff"
    );

  const nerfs =
    mudancas.filter(
      item =>
        item.tipo === "nerf"
    );

  const ajustes =
    mudancas.filter(
      item =>
        item.tipo === "ajuste"
    );

  let texto = "";

  if (buffs.length) {
    texto +=
      "🟢 **BUFFS**\n\n" +
      criarTexto(buffs) +
      "\n\n";
  }

  if (nerfs.length) {
    texto +=
      "🔴 **NERFS**\n\n" +
      criarTexto(nerfs) +
      "\n\n";
  }

  if (ajustes.length) {
    texto +=
      "⚪ **ALTERAÇÕES**\n\n" +
      criarTexto(ajustes) +
      "\n\n";
  }

  if (!texto) {
    texto =
      "Nenhuma alteração encontrada para este herói.";
  }

  return {
    hero: heroi,

    buffs,

    nerfs,

    ajustes,

    buffsTexto:
      criarTexto(buffs),

    nerfsTexto:
      criarTexto(nerfs),

    ajustesTexto:
      criarTexto(ajustes),

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
            `http://${req.headers.host}`
          );

        res.setHeader(
          "Content-Type",
          "application/json; charset=utf-8"
        );

        // ==============================================
        // ROTA PRINCIPAL
        // ==============================================

        if (url.pathname === "/") {
          res.end(
            JSON.stringify({
              sucesso: true,
              mensagem:
                "Overwatch Patch API funcionando!",
              endpoints: [
                "/dados",
                "/patch?hero=D.Va",
                "/test-blizzard"
              ]
            })
          );

          return;
        }

        // ==============================================
        // TESTE BLIZZARD
        // ==============================================

        if (
          url.pathname ===
          "/test-blizzard"
        ) {
          const html =
            await baixarPagina(
              BLIZZARD_URL
            );

          res.end(
            JSON.stringify({
              sucesso: true,
              tamanhoHTML:
                html.length,
              inicioHTML:
                html.substring(
                  0,
                  500
                )
            })
          );

          return;
        }

        // ==============================================
        // DADOS COMPLETOS
        // ==============================================

        if (
          url.pathname ===
          "/dados"
        ) {
          const dados =
            await obterDados();

          res.end(
            JSON.stringify(
              dados
            )
          );

          return;
        }

        // ==============================================
        // PATCH DE UM HERÓI
        // ==============================================

        if (
          url.pathname ===
          "/patch"
        ) {
          const nome =
            url.searchParams.get(
              "hero"
            );

          if (!nome) {
            res.statusCode = 400;

            res.end(
              JSON.stringify({
                erro: true,
                mensagem:
                  "Informe o herói. Exemplo: /patch?hero=D.Va"
              })
            );

            return;
          }

          const resultado =
            await obterPatchHeroi(
              nome
            );

          if (resultado.erro) {
            res.statusCode = 404;
          }

          res.end(
            JSON.stringify(
              resultado
            )
          );

          return;
        }

        // ==============================================
        // 404
        // ==============================================

        res.statusCode = 404;

        res.end(
          JSON.stringify({
            erro: true,
            mensagem:
              "Endpoint não encontrado."
          })
        );
      } catch (erro) {
        console.error(
          "Erro no servidor:",
          erro
        );

        res.statusCode = 500;

        res.end(
          JSON.stringify({
            erro: true,
            mensagem:
              "Erro interno do servidor.",
            detalhe:
              erro.message
          })
        );
      }
    }
  );

// ======================================================
// INICIAR
// ======================================================

server.listen(
  PORT,
  () => {
    console.log(
      `Servidor rodando na porta ${PORT}`
    );

    console.log(
      `Endpoint: /dados`
    );

    console.log(
      `Endpoint: /patch?hero=D.Va`
    );
  }
);
