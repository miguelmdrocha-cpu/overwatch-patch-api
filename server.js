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
// LIMPA HTML
// ======================================================

function limparHTML(texto) {
  if (!texto) return "";

  return texto
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCharCode(Number(n));
      } catch {
        return " ";
      }
    })
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// ======================================================
// NORMALIZA TEXTO
// ======================================================

function normalizar(texto) {
  return limparHTML(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ======================================================
// ESCAPA REGEX
// ======================================================

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ======================================================
// ENCONTRA HERÓI
// ======================================================

function encontrarHeroi(texto) {
  const normalizado = normalizar(texto);

  if (!normalizado) return null;

  for (const heroi of HEROIS) {
    if (normalizado === normalizar(heroi)) {
      return heroi;
    }
  }

  return null;
}

// ======================================================
// CLASSIFICA MUDANÇA
// ======================================================

function classificarMudanca(texto) {
  const t = normalizar(texto);

  // Primeiro verificamos expressões claramente negativas.
  const nerfs = [
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "diminuiu",
    "diminuido",
    "diminuida",
    "diminuem",
    "menos",
    "reduzida de",
    "reduzido de",
    "reduzida para",
    "reduzido para",
    "dano reduzido",
    "vida reduzida",
    "duracao reduzida",
    "alcance reduzido",
    "velocidade reduzida",
    "efeito reduzido",
    "tempo de recarga aumentado",
    "recarga aumentada"
  ];

  // Expressões claramente positivas.
  const buffs = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "aumentou",
    "aumentam",
    "mais",
    "aumentado de",
    "aumentada de",
    "aumentado para",
    "aumentada para",
    "dano aumentado",
    "vida aumentada",
    "duracao aumentada",
    "alcance aumentado",
    "velocidade aumentada",
    "efeito aumentado",
    "tempo de recarga reduzido",
    "recarga reduzida",
    "reduzido em"
  ];

  // Casos especiais onde a palavra "reduzido"
  // representa uma melhoria.
  if (
    t.includes("tempo de recarga reduzido") ||
    t.includes("recarga reduzida")
  ) {
    return "buff";
  }

  // Casos especiais onde "aumentado" representa
  // uma piora.
  if (
    t.includes("tempo de recarga aumentado") ||
    t.includes("recarga aumentada")
  ) {
    return "nerf";
  }

  if (nerfs.some(palavra => t.includes(palavra))) {
    return "nerf";
  }

  if (buffs.some(palavra => t.includes(palavra))) {
    return "buff";
  }

  return "ajuste";
}

// ======================================================
// EXTRAI LI
// ======================================================

function extrairLista(html) {
  const lista = [];

  const regex =
    /<li[^>]*>([\s\S]*?)<\/li>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto = limparHTML(match[1]);

    if (texto) {
      lista.push(texto);
    }
  }

  return lista;
}

// ======================================================
// EXTRAI NOME DA HABILIDADE
// ======================================================

function extrairNomeHabilidade(html) {
  const regex =
    /<div[^>]*class=["'][^"']*PatchNotesAbilityUpdate-name[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;

  const match = regex.exec(html);

  if (!match) return null;

  const nome = limparHTML(match[1]);

  return nome || null;
}

// ======================================================
// EXTRAI MUDANÇAS DE UMA HABILIDADE
// ======================================================

function extrairMudancasHabilidade(html, heroi, habilidade) {
  const mudancas = [];

  const regex =
    /<div[^>]*class=["'][^"']*PatchNotesAbilityUpdate[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;

  /*
   * Como o HTML possui divs aninhadas, usamos uma segunda
   * estratégia mais simples: localizar o nome da habilidade
   * e pegar o bloco de detalhes até o próximo bloco.
   */

  const nomeEscapado = escaparRegex(habilidade);

  const regexHabilidade = new RegExp(
    `<div[^>]*class=["'][^"']*PatchNotesAbilityUpdate[^"']*["'][^>]*>[\\\\s\\\\S]*?PatchNotesAbilityUpdate-name[^>]*>\\\\s*${nomeEscapado}\\\\s*<\\\\/div>[\\\\s\\\\S]*?<div[^>]*class=["'][^"']*PatchNotesAbilityUpdate-detailList[^"']*["'][^>]*>([\\\\s\\\\S]*?)<\\\\/div>`,
    "i"
  );

  const match = regexHabilidade.exec(html);

  if (!match) {
    return mudancas;
  }

  const itens = extrairLista(match[1]);

  for (const texto of itens) {
    mudancas.push({
      hero: heroi,
      habilidade: habilidade,
      tipo: classificarMudanca(texto),
      change: texto
    });
  }

  return mudancas;
}

// ======================================================
// EXTRAI UM BLOCO DE HERÓI
// ======================================================

function extrairBlocosHerois(html) {
  const blocos = [];

  /*
   * O HTML atual da Blizzard possui exatamente:
   *
   * PatchNotesHeroUpdate
   *   PatchNotesHeroUpdate-header
   *     PatchNotesHeroUpdate-name
   *   PatchNotesHeroUpdate-body
   */

  const marcador =
    'class="PatchNotesHeroUpdate"';

  let posicao = 0;

  while (true) {
    const inicio =
      html.indexOf(marcador, posicao);

    if (inicio === -1) {
      break;
    }

    const inicioBloco =
      html.lastIndexOf("<div", inicio);

    const proximoBloco =
      html.indexOf(
        '<div class="PatchNotesHeroUpdate"',
        inicio + marcador.length
      );

    const fim =
      proximoBloco === -1
        ? html.length
        : proximoBloco;

    const bloco =
      html.substring(
        inicioBloco,
        fim
      );

    blocos.push(bloco);

    posicao =
      fim;
  }

  return blocos;
}

// ======================================================
// EXTRAI DADOS DOS HERÓIS
// ======================================================

function extrairDadosHerois(html) {
  const resultado = {};

  for (const heroi of HEROIS) {
    resultado[heroi] = {
      hero: heroi,
      buffs: [],
      nerfs: [],
      ajustes: [],
      buffsTexto: "",
      nerfsTexto: "",
      ajustesTexto: "",
      buffsPartes: [],
      nerfsPartes: [],
      ajustesPartes: []
    };
  }

  const blocos =
    extrairBlocosHerois(html);

  console.log(
    `Blocos de heróis encontrados: ${blocos.length}`
  );

  for (const bloco of blocos) {

    // ----------------------------------------------
    // NOME DO HERÓI
    // ----------------------------------------------

    const regexNome =
      /PatchNotesHeroUpdate-name[^>]*>([\s\S]*?)<\/h5>/i;

    const matchNome =
      regexNome.exec(bloco);

    if (!matchNome) {
      continue;
    }

    const nomeBruto =
      limparHTML(matchNome[1]);

    const heroi =
      encontrarHeroi(nomeBruto);

    if (!heroi) {
      continue;
    }

    console.log(
      `Herói encontrado: ${heroi}`
    );

    const mudancas = [];

    // ----------------------------------------------
    // ATUALIZAÇÕES GERAIS
    // ----------------------------------------------

    const regexGeral =
      /PatchNotesHeroUpdate-generalUpdates[^>]*>([\s\S]*?)<\/div>/i;

    const matchGeral =
      regexGeral.exec(bloco);

    if (matchGeral) {
      const itens =
        extrairLista(matchGeral[1]);

      for (const texto of itens) {
        mudancas.push({
          hero: heroi,
          habilidade: null,
          tipo: classificarMudanca(texto),
          change: texto
        });
      }
    }

    // ----------------------------------------------
    // HABILIDADES
    // ----------------------------------------------

    const regexHabilidades =
      /PatchNotesAbilityUpdate-name[^>]*>([\s\S]*?)<\/div>/gi;

    let matchHabilidade;

    while (
      (matchHabilidade =
        regexHabilidades.exec(bloco)) !== null
    ) {
      const habilidade =
        limparHTML(
          matchHabilidade[1]
        );

      if (!habilidade) {
        continue;
      }

      /*
       * Procuramos o detalhe da habilidade a partir
       * da posição do nome.
       */

      const inicioDetalhe =
        matchHabilidade.index;

      const trecho =
        bloco.substring(
          inicioDetalhe,
          inicioDetalhe + 3000
        );

      const regexDetalhes =
        /PatchNotesAbilityUpdate-detailList[^>]*>([\s\S]*?)<\/div>/i;

      const matchDetalhes =
        regexDetalhes.exec(trecho);

      if (!matchDetalhes) {
        continue;
      }

      const itens =
        extrairLista(
          matchDetalhes[1]
        );

      for (const texto of itens) {
        mudancas.push({
          hero: heroi,
          habilidade: habilidade,
          tipo: classificarMudanca(texto),
          change: texto
        });
      }
    }

    // ----------------------------------------------
    // SEPARA
    // ----------------------------------------------

    for (const mudanca of mudancas) {
      if (mudanca.tipo === "buff") {
        resultado[heroi].buffs.push(
          mudanca
        );
      } else if (
        mudanca.tipo === "nerf"
      ) {
        resultado[heroi].nerfs.push(
          mudanca
        );
      } else {
        resultado[heroi].ajustes.push(
          mudanca
        );
      }
    }
  }

  return resultado;
}
// ======================================================
// CRIA TEXTO
// ======================================================

function criarTexto(lista) {
  if (!lista || lista.length === 0) {
    return "";
  }

  return lista
    .map(item => {
      if (item.habilidade) {
        return `${item.habilidade}: ${item.change}`;
      }

      return item.change;
    })
    .join("\n");
}

// ======================================================
// CRIA TEXTO DE CORREÇÕES
// ======================================================

function criarTextoCorrecoes(lista) {
  if (!lista || lista.length === 0) {
    return "";
  }

  return lista
    .map(item => item.trim())
    .filter(Boolean)
    .join("\n");
}

// ======================================================
// DIVIDE TEXTO
// ======================================================

function dividirTexto(
  texto,
  limite = 1900
) {
  if (!texto) return [];

  const partes = [];
  let atual = "";

  const linhas =
    texto.split("\n");

  for (const linha of linhas) {
    if (
      atual.length +
        linha.length +
        1 >
      limite
    ) {
      if (atual.trim()) {
        partes.push(
          atual.trim()
        );
      }

      atual = linha;
    } else {
      atual +=
        (atual ? "\n" : "") +
        linha;
    }
  }

  if (atual.trim()) {
    partes.push(
      atual.trim()
    );
  }

  return partes;
}

// ======================================================
// BAIXA PÁGINA DA BLIZZARD
// ======================================================

function baixarPagina(
  url,
  redirecionamentos = 0
) {
  return new Promise(
    (resolve, reject) => {

      if (
        redirecionamentos > 5
      ) {
        reject(
          new Error(
            "Muitos redirecionamentos"
          )
        );

        return;
      }

      const cliente =
        url.startsWith("https")
          ? https
          : http;

      const requisicao =
        cliente.get(
          url,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

              "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

              "Accept-Language":
                "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
            },

            timeout: 20000
          },

          resposta => {

            const status =
              resposta.statusCode || 0;

            if (
              status >= 300 &&
              status < 400 &&
              resposta.headers.location
            ) {

              resposta.resume();

              let novaUrl =
                resposta.headers.location;

              if (
                novaUrl.startsWith("/")
              ) {
                const base =
                  new URL(url);

                novaUrl =
                  base.protocol +
                  "//" +
                  base.host +
                  novaUrl;
              }

              baixarPagina(
                novaUrl,
                redirecionamentos + 1
              )
                .then(resolve)
                .catch(reject);

              return;
            }

            if (
              status < 200 ||
              status >= 300
            ) {
              resposta.resume();

              reject(
                new Error(
                  `HTTP ${status} ao acessar a Blizzard`
                )
              );

              return;
            }

            let dados = "";

            resposta.setEncoding(
              "utf8"
            );

            resposta.on(
              "data",
              parte => {
                dados += parte;
              }
            );

            resposta.on(
              "end",
              () => {
                resolve(dados);
              }
            );
          }
        );

      requisicao.on(
        "timeout",
        () => {
          requisicao.destroy(
            new Error(
              "Tempo limite ao acessar a Blizzard"
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
// OBTÉM DADOS
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
    "Baixando patch notes da Blizzard..."
  );

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

  // ====================================================
  // TEXTOS
  // ====================================================

  for (
    const heroi of HEROIS
  ) {

    const dados =
      dadosHerois[heroi];

    dados.buffsTexto =
      criarTexto(
        dados.buffs
      );

    dados.nerfsTexto =
      criarTexto(
        dados.nerfs
      );

    dados.ajustesTexto =
      criarTexto(
        dados.ajustes
      );

    dados.buffsPartes =
      dividirTexto(
        dados.buffsTexto
      );

    dados.nerfsPartes =
      dividirTexto(
        dados.nerfsTexto
      );

    dados.ajustesPartes =
      dividirTexto(
        dados.ajustesTexto
      );
  }

  // ====================================================
  // RESULTADO
  // ====================================================

  const resultado = {
    atualizadoEm:
      new Date().toISOString(),

    fonte:
      BLIZZARD_URL,

    herois:
      dadosHerois,

    correcoes: [],

    correcoesTexto: "",

    correcoesPartes: []
  };

  cache = {
    dados: resultado,
    atualizadoEm: agora
  };

  return resultado;
}

// ======================================================
// SERVIDOR HTTP
// ======================================================

const servidor =
  http.createServer(
    async (req, res) => {

      // ----------------------------------------------
      // CORS
      // ----------------------------------------------

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
      );

      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
      );

      // ----------------------------------------------
      // OPTIONS
      // ----------------------------------------------

      if (
        req.method === "OPTIONS"
      ) {
        res.writeHead(204);
        res.end();
        return;
      }

      const url =
        new URL(
          req.url,
          `http://${req.headers.host}`
        );

      // ==============================================
      // /
      // ==============================================

      if (
        req.method === "GET" &&
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
            status: "online",
            api:
              "Overwatch Patch API",
            endpoints: [
              "/dados",
              "/patch",
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
        req.method === "GET" &&
        url.pathname ===
          "/test-blizzard"
      ) {

        try {

          const html =
            await baixarPagina(
              BLIZZARD_URL
            );

          const termo =
            url.searchParams.get(
              "buscar"
            );

          if (termo) {

            const regex =
              new RegExp(
                escaparRegex(
                  termo
                ),
                "gi"
              );

            const ocorrencias = [];

            let match;

            while (
              (match =
                regex.exec(
                  html
                )) !== null &&
              ocorrencias.length <
                5
            ) {

              const inicio =
                Math.max(
                  0,
                  match.index -
                    1200
                );

              const fim =
                Math.min(
                  html.length,
                  match.index +
                    termo.length +
                    2500
                );

              ocorrencias.push({
                posicao:
                  match.index,

                trecho:
                  html.substring(
                    inicio,
                    fim
                  )
              });
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
                {
                  sucesso: true,
                  tamanhoHTML:
                    html.length,
                  termoBuscado:
                    termo,
                  ocorrenciasEncontradas:
                    ocorrencias.length,
                  ocorrencias
                },
                null,
                2
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

        } catch (erro) {

          res.writeHead(
            500,
            {
              "Content-Type":
                "application/json; charset=utf-8"
            }
          );

          res.end(
            JSON.stringify({
              sucesso: false,
              erro:
                erro.message
            })
          );
        }

        return;
      }

      // ==============================================
      // /dados
      // ==============================================

      if (
        req.method === "GET" &&
        url.pathname === "/dados"
      ) {

        try {

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

        } catch (erro) {

          console.error(
            "Erro em /dados:",
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
                "Erro ao obter dados da Blizzard",

              detalhes:
                erro.message
            })
          );
        }

        return;
      }

      // ==============================================
      // /patch
      // ==============================================

      if (
        req.method === "GET" &&
        url.pathname === "/patch"
      ) {

        try {

          const dados =
            await obterDados();

          const nomeHeroi =
            url.searchParams.get(
              "hero"
            );

          // ------------------------------------------
          // SEM HERÓI
          // ------------------------------------------

          if (!nomeHeroi) {

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

          // ------------------------------------------
          // COM HERÓI
          // ------------------------------------------

          const heroi =
            encontrarHeroi(
              nomeHeroi
            );

          if (!heroi) {

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
                  "Herói não encontrado",
                hero:
                  nomeHeroi
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
              dados.herois[
                heroi
              ]
            )
          );

        } catch (erro) {

          console.error(
            "Erro em /patch:",
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
                "Erro ao obter patch",
              detalhes:
                erro.message
            })
          );
        }

        return;
      }

      // ==============================================
      // 404
      // ==============================================

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
            "Endpoint não encontrado"
        })
      );
    }
  );

// ======================================================
// INICIA SERVIDOR
// ======================================================

servidor.listen(
  PORT,
  () => {

    console.log(
      `Servidor iniciado na porta ${PORT}`
    );

    console.log(
      "Endpoint: /patch?hero=D.Va"
    );
  }
);
