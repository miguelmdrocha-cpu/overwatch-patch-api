const http = require("http");

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
  "D.Va",
  "Domina",
  "Mauga",
  "Winston",
  "Wrecking Ball",
  "Zarya",

  "Anran",
  "Freja",
  "Junkrat",
  "Sierra",
  "Symmetra",
  "Torbjörn",
  "Vendetta",
  "Widowmaker",

  "Baptiste",
  "Brigitte",
  "Jetpack Cat",
  "Kiriko",
  "Wuyang",
  "Zenyatta",

  "Genji",
  "Rainha Junker",
  "Ana"
];

// ======================================================
// LIMPEZA HTML
// ======================================================

function limparHTML(texto) {
  if (!texto) return "";

  return texto
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
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
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ======================================================
// CLASSIFICAÇÃO DA MUDANÇA
// ======================================================

function classificarMudanca(texto) {
  const t = normalizar(texto);

  const buffs = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "reduzido para",
    "reduzida para",
    "reduzidos para",
    "reduzidas para",
    "ganhou",
    "ganha",
    "recebeu",
    "recebe",
    "melhorado",
    "melhorada",
    "melhorados",
    "melhoradas",
    "mais rapido",
    "mais rapida",
    "maior"
  ];

  const nerfs = [
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "diminuido",
    "diminuida",
    "diminuida",
    "diminuiram",
    "perdeu",
    "perde",
    "removido",
    "removida",
    "removidos",
    "removidas",
    "mais lento",
    "mais lenta",
    "menor"
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
// IDENTIFICAÇÃO DE MUDANÇA
// ======================================================

function pareceMudanca(texto) {
  const t = normalizar(texto);

  if (!t) return false;

  const palavras = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "diminuido",
    "diminuida",
    "dano",
    "tempo",
    "recarga",
    "municao",
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
    "concedido",
    "concedida",
    "removido",
    "removida",
    "agora",
    "passou",
    "alterado",
    "alterada"
  ];

  return palavras.some(palavra => t.includes(palavra));
}

// ======================================================
// IDENTIFICA NOME DE HABILIDADE / ARMA
// ======================================================

function pareceNomeDeHabilidade(texto) {
  if (!texto) return false;

  const original = limparHTML(texto);
  const t = normalizar(original);

  if (!t) return false;

  if (original.length > 100) return false;

  if (pareceMudanca(original)) return false;

  const termosIgnorados = [
    "comentario dos desenvolvedores",
    "comentarios dos desenvolvedores",
    "atualizacoes dos herois",
    "atualizacoes do estadio",
    "correcao de problemas",
    "geral",
    "herois",
    "mapas",
    "estadio",
    "tank",
    "dano",
    "suporte"
  ];

  if (termosIgnorados.includes(t)) {
    return false;
  }

  return true;
}

// ======================================================
// EXTRAI TÍTULOS
// ======================================================

function extrairTitulos(html) {
  const encontrados = [];

  const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto = limparHTML(match[2]);

    if (!texto) continue;

    encontrados.push({
      nivel: Number(match[1]),
      texto,
      indice: match.index
    });
  }

  return encontrados;
}

// ======================================================
// EXTRAI ELEMENTOS NA ORDEM DO HTML
// ======================================================

function extrairElementosOrdenados(html) {
  const elementos = [];

  const regex =
    /<(h[1-6]|li|p|strong|b)[^>]*>([\s\S]*?)<\/\1>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();

    const texto = limparHTML(match[2]);

    if (!texto) continue;

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
// EXTRAI MUDANÇAS DE UM BLOCO DE HERÓI
// ======================================================

function extrairMudancasDoBlocoHeroi(
  elementos,
  indiceInicial,
  nomeHeroi,
  nomesHerois
) {
  const mudancas = [];

  let habilidadeAtual = null;

  for (let i = indiceInicial + 1; i < elementos.length; i++) {
    const elemento = elementos[i];

    // --------------------------------------------------
    // Se encontrar outro herói, termina
    // --------------------------------------------------

    const heroiEncontrado = nomesHerois.find(
      nome => normalizar(nome) === normalizar(elemento.texto)
    );

    if (
      elemento.tag.startsWith("h") &&
      heroiEncontrado &&
      normalizar(heroiEncontrado) !== normalizar(nomeHeroi)
    ) {
      break;
    }

    // --------------------------------------------------
    // Títulos
    // --------------------------------------------------

    if (elemento.tag.startsWith("h")) {
      const textoTitulo = limparHTML(elemento.texto);

      if (pareceNomeDeHabilidade(textoTitulo)) {
        habilidadeAtual = textoTitulo;
      }

      continue;
    }

    // --------------------------------------------------
    // Negrito / strong dentro do conteúdo
    // --------------------------------------------------

    if (
      (elemento.tag === "strong" || elemento.tag === "b") &&
      pareceNomeDeHabilidade(elemento.texto)
    ) {
      habilidadeAtual = limparHTML(elemento.texto);
      continue;
    }

    // --------------------------------------------------
    // Mudanças
    // --------------------------------------------------

    if (elemento.tag === "li" || elemento.tag === "p") {
      const texto = limparHTML(elemento.texto);

      if (!pareceMudanca(texto)) continue;

      mudancas.push({
        hero: nomeHeroi,
        habilidade: habilidadeAtual,
        tipo: classificarMudanca(texto),
        change: texto
      });
    }
  }

  return mudancas;
}

// ======================================================
// SEPARA MUDANÇAS POR HERÓI
// ======================================================

function separarMudancas(hero, mudancas) {
  const resultado = {
    hero,
    buffs: [],
    nerfs: [],
    ajustes: []
  };

  for (const mudanca of mudancas) {
    if (mudanca.tipo === "buff") {
      resultado.buffs.push(mudanca);
    } else if (mudanca.tipo === "nerf") {
      resultado.nerfs.push(mudanca);
    } else {
      resultado.ajustes.push(mudanca);
    }
  }

  return resultado;
}

// ======================================================
// CRIA TEXTO
// ======================================================

function criarTexto(mudancas) {
  if (!mudancas || mudancas.length === 0) {
    return "";
  }

  const grupos = {};

  for (const mudanca of mudancas) {
    const habilidade =
      mudanca.habilidade || "Geral";

    if (!grupos[habilidade]) {
      grupos[habilidade] = [];
    }

    grupos[habilidade].push(mudanca);
  }

  let texto = "";

  for (const habilidade of Object.keys(grupos)) {
    texto += `🔹 **${habilidade}**\n`;

    for (const mudanca of grupos[habilidade]) {
      let emoji = "🟡";

      if (mudanca.tipo === "buff") {
        emoji = "🟢";
      } else if (mudanca.tipo === "nerf") {
        emoji = "🔴";
      }

      texto += `${emoji} ${mudanca.change}\n`;
    }

    texto += "\n";
  }

  return texto.trim();
}

// ======================================================
// TEXTO DE CORREÇÕES
// ======================================================

function criarTextoCorrecoes(correcoes) {
  if (!correcoes || correcoes.length === 0) {
    return "";
  }

  return correcoes
    .map(correcao => `🛠️ ${correcao}`)
    .join("\n");
}

// ======================================================
// DIVIDE TEXTO
// ======================================================

function dividirTexto(texto, limite = 1900) {
  const partes = [];

  if (!texto) return partes;

  let atual = "";

  const linhas = texto.split("\n");

  for (const linha of linhas) {
    if ((atual + linha + "\n").length > limite) {
      if (atual.trim()) {
        partes.push(atual.trim());
      }

      atual = linha + "\n";
    } else {
      atual += linha + "\n";
    }
  }

  if (atual.trim()) {
    partes.push(atual.trim());
  }

  return partes;
}

// ======================================================
// EXTRAI SEÇÃO POR TÍTULO
// ======================================================

function extrairSecaoPorTitulo(html, titulo) {
  const regexTitulo = new RegExp(
    `<h([1-6])[^>]*>\\s*${escaparRegex(
      titulo
    )}\\s*<\\/h\\1>`,
    "i"
  );

  const inicio = html.match(regexTitulo);

  if (!inicio) {
    return "";
  }

  const inicioIndice = inicio.index;
  const nivel = Number(inicio[1]);

  const restante = html.substring(
    inicioIndice + inicio[0].length
  );

  const regexProximo = new RegExp(
    `<h[1-${nivel}][^>]*>`,
    "i"
  );

  const fim = restante.search(regexProximo);

  if (fim === -1) {
    return restante;
  }

  return restante.substring(0, fim);
}
// ======================================================
// OBTÉM OS DADOS DA BLIZZARD
// ======================================================

async function obterDados() {
  const agora = Date.now();

  // Usa cache se ainda estiver válido
  if (
    cache.dados &&
    agora - cache.atualizadoEm < CACHE_TIME
  ) {
    return cache.dados;
  }

  return new Promise((resolve, reject) => {
    const requisicao = http.get(
      BLIZZARD_URL,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
        }
      },
      resposta => {
        let html = "";

        resposta.setEncoding("utf8");

        resposta.on("data", parte => {
          html += parte;
        });

        resposta.on("end", () => {
          if (
            resposta.statusCode < 200 ||
            resposta.statusCode >= 300
          ) {
            return reject(
              new Error(
                `Blizzard respondeu com HTTP ${resposta.statusCode}`
              )
            );
          }

          try {
            const elementos =
              extrairElementosOrdenados(html);

            const nomesNormalizados =
              HEROIS.map(normalizar);

            const mudancas = [];

            // ==========================================
            // LOCALIZA CADA HERÓI
            // ==========================================

            for (let i = 0; i < elementos.length; i++) {
              const elemento = elementos[i];

              if (!elemento.tag.startsWith("h")) {
                continue;
              }

              const nomeHeroi = HEROIS.find(
                nome =>
                  normalizar(nome) ===
                  normalizar(elemento.texto)
              );

              if (!nomeHeroi) {
                continue;
              }

              const mudancasHeroi =
                extrairMudancasDoBlocoHeroi(
                  elementos,
                  i,
                  nomeHeroi,
                  HEROIS
                );

              mudancas.push(...mudancasHeroi);
            }

            // ==========================================
            // ORGANIZA POR HERÓI
            // ==========================================

            const herois = {};

            for (const nome of HEROIS) {
              herois[nome] = separarMudancas(
                nome,
                mudancas.filter(
                  m =>
                    normalizar(m.hero) ===
                    normalizar(nome)
                )
              );
            }

            // ==========================================
            // CORREÇÕES
            // ==========================================

            let correcoes = [];

            const secaoCorrecoes =
              extrairSecaoPorTitulo(
                html,
                "Correção de problemas"
              );

            if (secaoCorrecoes) {
              const elementosCorrecoes =
                extrairElementosOrdenados(
                  secaoCorrecoes
                );

              for (const elemento of elementosCorrecoes) {
                if (
                  elemento.tag === "li" ||
                  elemento.tag === "p"
                ) {
                  const texto =
                    limparHTML(elemento.texto);

                  if (
                    texto &&
                    texto.length > 5
                  ) {
                    correcoes.push(texto);
                  }
                }
              }
            }

            // Remove duplicados
            correcoes = [
              ...new Set(correcoes)
            ];

            // ==========================================
            // RESULTADO FINAL
            // ==========================================

            const resultado = {
              fonte: BLIZZARD_URL,
              atualizadoEm:
                new Date().toISOString(),

              herois,

              mudancas,

              correcoes,

              texto: criarTexto(mudancas),

              textoCorrecoes:
                criarTextoCorrecoes(correcoes)
            };

            cache.dados = resultado;
            cache.atualizadoEm = Date.now();

            resolve(resultado);
          } catch (erro) {
            reject(erro);
          }
        });
      }
    );

    // ================================================
    // TIMEOUT
    // ================================================

    requisicao.setTimeout(15000, () => {
      requisicao.destroy(
        new Error(
          "Tempo limite ao acessar a Blizzard."
        )
      );
    });

    requisicao.on("error", erro => {
      reject(erro);
    });
  });
}

// ======================================================
// SERVIDOR HTTP
// ======================================================

const server = http.createServer(
  async (req, res) => {
    try {
      const url = new URL(
        req.url,
        `http://${req.headers.host}`
      );

      // =================================================
      // ROTA PRINCIPAL
      // =================================================

      if (url.pathname === "/") {
        res.writeHead(200, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

        return res.end(
          JSON.stringify(
            {
              status: "online",
              nome: "Overwatch Patch API",
              fonte: BLIZZARD_URL,

              endpoints: {
                dados: "/dados",
                patch: "/patch",
                patchHeroi:
                  "/patch?hero=D.Va",
                testeBlizzard:
                  "/test-blizzard"
              }
            },
            null,
            2
          )
        );
      }

      // =================================================
      // TESTE DA BLIZZARD
      // =================================================

      if (
        url.pathname ===
        "/test-blizzard"
      ) {
        try {
          const dados =
            await obterDados();

          res.writeHead(200, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          return res.end(
            JSON.stringify(
              {
                status: "ok",
                mensagem:
                  "Página da Blizzard processada com sucesso.",
                quantidadeMudancas:
                  dados.mudancas.length,
                quantidadeCorrecoes:
                  dados.correcoes.length
              },
              null,
              2
            )
          );
        } catch (erro) {
          res.writeHead(500, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          return res.end(
            JSON.stringify(
              {
                status: "erro",
                mensagem: erro.message
              },
              null,
              2
            )
          );
        }
      }

      // =================================================
      // DADOS COMPLETOS
      // =================================================

      if (url.pathname === "/dados") {
        try {
          const dados =
            await obterDados();

          res.writeHead(200, {
            "Content-Type":
              "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          });

          return res.end(
            JSON.stringify(
              dados,
              null,
              2
            )
          );
        } catch (erro) {
          res.writeHead(500, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          return res.end(
            JSON.stringify(
              {
                erro: erro.message
              },
              null,
              2
            )
          );
        }
      }

      // =================================================
      // PATCH
      // =================================================

      if (url.pathname === "/patch") {
        try {
          const dados =
            await obterDados();

          const heroQuery =
            url.searchParams.get("hero");

          // ============================================
          // SE NÃO INFORMAR HERÓI
          // ============================================

          if (!heroQuery) {
            res.writeHead(200, {
              "Content-Type":
                "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*"
            });

            return res.end(
              JSON.stringify(
                {
                  fonte: BLIZZARD_URL,
                  total:
                    dados.mudancas.length,
                  mudancas:
                    dados.mudancas,
                  correcoes:
                    dados.correcoes
                },
                null,
                2
              )
            );
          }

          // ============================================
          // PROCURA HERÓI
          // ============================================

          const nomeHeroi =
            HEROIS.find(
              nome =>
                normalizar(nome) ===
                normalizar(heroQuery)
            );

          if (!nomeHeroi) {
            res.writeHead(404, {
              "Content-Type":
                "application/json; charset=utf-8"
            });

            return res.end(
              JSON.stringify(
                {
                  erro:
                    "Herói não encontrado.",
                  heroisDisponiveis:
                    HEROIS
                },
                null,
                2
              )
            );
          }

          // ============================================
          // RETORNA APENAS O HERÓI
          // ============================================

          const resultadoHeroi =
            dados.herois[nomeHeroi];

          res.writeHead(200, {
            "Content-Type":
              "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          });

          return res.end(
            JSON.stringify(
              resultadoHeroi,
              null,
              2
            )
          );
        } catch (erro) {
          res.writeHead(500, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          return res.end(
            JSON.stringify(
              {
                erro: erro.message
              },
              null,
              2
            )
          );
        }
      }

      // =================================================
      // ROTA NÃO ENCONTRADA
      // =================================================

      res.writeHead(404, {
        "Content-Type":
          "application/json; charset=utf-8"
      });

      res.end(
        JSON.stringify(
          {
            erro: "Endpoint não encontrado."
          },
          null,
          2
        )
      );
    } catch (erro) {
      res.writeHead(500, {
        "Content-Type":
          "application/json; charset=utf-8"
      });

      res.end(
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
      `Overwatch Patch API rodando na porta ${PORT}`
    );

    console.log(
      `Fonte: ${BLIZZARD_URL}`
    );

    console.log(
      `Endpoint: /dados`
    );

    console.log(
      `Endpoint: /patch?hero=D.Va`
    );
  }
);
