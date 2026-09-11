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
    "aumentado o tempo de recarga",
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "recarga aumentada",
    "tempo de recarga aumentado",
    "dano reduzido",
    "dano diminuido",
    "vida reduzida",
    "duracao reduzida",
    "alcance reduzido",
    "velocidade reduzida",
    "efeito reduzido",
    "reduzido para"
  ];

  const buffs = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "aumentou",
    "aumentam",
    "mais",
    "dano aumentado",
    "dano aumentado para",
    "vida aumentada",
    "duracao aumentada",
    "alcance aumentado",
    "velocidade aumentada",
    "efeito aumentado",
    "tempo de recarga reduzido",
    "recarga reduzida",
    "reduzido em"
  ];

  if (nerfs.some(palavra => t.includes(palavra))) {
    return "nerf";
  }

  if (buffs.some(palavra => t.includes(palavra))) {
    return "buff";
  }

  return "ajuste";
}

// ======================================================
// VERIFICA SE PARECE UMA MUDANÇA
// ======================================================

function pareceMudanca(texto) {
  const t = normalizar(texto);

  if (!t) return false;

  const palavras = [
    "dano",
    "vida",
    "armadura",
    "escudo",
    "recarga",
    "tempo",
    "duracao",
    "alcance",
    "velocidade",
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "aumentou",
    "aumentam",
    "diminuiu",
    "diminuido",
    "diminuida",
    "menos",
    "mais",
    "projetil",
    "projeteis",
    "cura",
    "curado",
    "cura por segundo",
    "efeito",
    "duracao",
    "impacto",
    "taxa",
    "multiplicador",
    "porcentagem",
    "por cento",
    "%"
  ];

  return palavras.some(palavra => t.includes(palavra));
}

// ======================================================
// VERIFICA SE PARECE NOME DE HABILIDADE
// ======================================================

function pareceNomeDeHabilidade(texto) {
  const t = limparHTML(texto).trim();

  if (!t) return false;

  if (t.length > 120) return false;

  if (encontrarHeroi(t)) return false;

  if (pareceMudanca(t)) return false;

  const ignorados = [
    "habilidades",
    "habilidade",
    "passiva",
    "passivas",
    "armas",
    "arma",
    "ultimates",
    "ultimate",
    "talentos",
    "talento",
    "geral",
    "correcoes",
    "correções",
    "atualizacoes",
    "atualizações",
    "notas de patch",
    "patch notes",
    "mudancas",
    "mudanças"
  ];

  const n = normalizar(t);

  if (ignorados.includes(n)) return false;

  if (/^nivel\s+\d+$/i.test(t)) return false;

  if (/^\d+$/.test(t)) return false;

  return true;
}

// ======================================================
// EXTRAI ELEMENTOS ORDENADOS
// ======================================================

function extrairElementosOrdenados(html) {
  const elementos = [];

  const regex =
    /<(h[1-6]|li|p|strong|b|div|span)[^>]*>([\s\S]*?)<\/\1>/gi;

  let match;
  let indice = 0;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const conteudo = match[2];

    const texto = limparHTML(conteudo);

    if (!texto) continue;

    let nivel = null;

    if (/^h[1-6]$/i.test(tag)) {
      nivel = Number(tag.substring(1));
    }

    elementos.push({
      tag,
      nivel,
      texto,
      indice: indice++
    });
  }

  return elementos;
}

// ======================================================
// EXTRAI TÍTULOS
// ======================================================

function extrairTitulos(html) {
  const titulos = [];

  const regex =
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto = limparHTML(match[2]);

    if (!texto) continue;

    titulos.push({
      nivel: Number(match[1]),
      texto
    });
  }

  return titulos;
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

    // Outro título de herói encerra o bloco
    if (
      /^h[1-6]$/i.test(elemento.tag) &&
      encontrarHeroi(elemento.texto)
    ) {
      break;
    }

    // Títulos
    if (/^h[1-6]$/i.test(elemento.tag)) {
      const candidato = elemento.texto.trim();

      if (pareceNomeDeHabilidade(candidato)) {
        habilidadeAtual = candidato;
      }

      continue;
    }

    // Strong / B
    if (
      elemento.tag === "strong" ||
      elemento.tag === "b"
    ) {
      const candidato = elemento.texto.trim();

      if (pareceNomeDeHabilidade(candidato)) {
        habilidadeAtual = candidato;
      }

      continue;
    }

    // Div / Span
    if (
      elemento.tag === "div" ||
      elemento.tag === "span"
    ) {
      const candidato = elemento.texto.trim();

      const quantidadePalavras =
        candidato.split(/\s+/).filter(Boolean).length;

      if (
        candidato.length <= 80 &&
        quantidadePalavras <= 8 &&
        pareceNomeDeHabilidade(candidato)
      ) {
        habilidadeAtual = candidato;
      }

      continue;
    }

    // Mudanças
    if (
      elemento.tag === "li" ||
      elemento.tag === "p"
    ) {
      const texto = elemento.texto.trim();

      if (!pareceMudanca(texto)) {
        continue;
      }

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
// SEPARA MUDANÇAS
// ======================================================

function separarMudancas(mudancas) {
  const buffs = [];
  const nerfs = [];
  const ajustes = [];

  for (const mudanca of mudancas) {
    if (mudanca.tipo === "buff") {
      buffs.push(mudanca);
    } else if (mudanca.tipo === "nerf") {
      nerfs.push(mudanca);
    } else {
      ajustes.push(mudanca);
    }
  }

  return {
    buffs,
    nerfs,
    ajustes
  };
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

function dividirTexto(texto, limite = 1900) {
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
        (atual ? "\n" : "") + linha;
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
  const elementos = extrairElementosOrdenados(html);

  const tituloNormalizado = normalizar(titulo);

  for (let i = 0; i < elementos.length; i++) {
    if (
      normalizar(elementos[i].texto) ===
      tituloNormalizado
    ) {
      const resultados = [];

      for (
        let j = i + 1;
        j < elementos.length;
        j++
      ) {
        if (
          elementos[j].nivel !== null &&
          elementos[j].nivel <= elementos[i].nivel
        ) {
          break;
        }

        resultados.push(elementos[j].texto);
      }

      return resultados;
    }
  }

  return [];
}
// ======================================================
// BAIXA PÁGINA DA BLIZZARD
// ======================================================

function baixarPagina(url, redirecionamentos = 0) {
  return new Promise((resolve, reject) => {
    if (redirecionamentos > 5) {
      reject(new Error("Muitos redirecionamentos"));
      return;
    }

    const cliente = url.startsWith("https")
      ? https
      : http;

    const requisicao = cliente.get(
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
        const status = resposta.statusCode || 0;

        // Redirecionamento
        if (
          status >= 300 &&
          status < 400 &&
          resposta.headers.location
        ) {
          resposta.resume();

          let novaUrl = resposta.headers.location;

          if (novaUrl.startsWith("/")) {
            const base = new URL(url);
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

        if (status < 200 || status >= 300) {
          resposta.resume();

          reject(
            new Error(
              `HTTP ${status} ao acessar a Blizzard`
            )
          );

          return;
        }

        let dados = "";

        resposta.setEncoding("utf8");

        resposta.on("data", parte => {
          dados += parte;
        });

        resposta.on("end", () => {
          resolve(dados);
        });
      }
    );

    requisicao.on("timeout", () => {
      requisicao.destroy(
        new Error(
          "Tempo limite ao acessar a Blizzard"
        )
      );
    });

    requisicao.on("error", erro => {
      reject(erro);
    });
  });
}

// ======================================================
// OBTÉM DADOS
// ======================================================

async function obterDados() {
  const agora = Date.now();

  if (
    cache.dados &&
    agora - cache.atualizadoEm < CACHE_TIME
  ) {
    return cache.dados;
  }

  console.log(
    "Baixando patch notes da Blizzard..."
  );

  const html = await baixarPagina(
    BLIZZARD_URL
  );

  console.log(
    `HTML recebido: ${html.length} caracteres`
  );

  const elementos =
    extrairElementosOrdenados(html);

  console.log(
    `Elementos encontrados: ${elementos.length}`
  );

  const dadosHerois = {};

  for (const heroi of HEROIS) {
    dadosHerois[heroi] = {
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

  // ====================================================
  // PROCURA OS HERÓIS
  // ====================================================

  for (let i = 0; i < elementos.length; i++) {
    const elemento = elementos[i];

    if (!/^h[1-6]$/i.test(elemento.tag)) {
      continue;
    }

    const heroi = encontrarHeroi(
      elemento.texto
    );

    if (!heroi) {
      continue;
    }

    console.log(
      `Herói encontrado: ${heroi}`
    );

    const mudancas =
      extrairMudancasDoBlocoHeroi(
        elementos,
        i,
        heroi
      );

    if (!mudancas.length) {
      continue;
    }

    const separadas =
      separarMudancas(mudancas);

    dadosHerois[heroi].buffs.push(
      ...separadas.buffs
    );

    dadosHerois[heroi].nerfs.push(
      ...separadas.nerfs
    );

    dadosHerois[heroi].ajustes.push(
      ...separadas.ajustes
    );
  }

  // ====================================================
  // CORREÇÕES
  // ====================================================

  let correcoes = [];

  const possiveisTitulos = [
    "Correções de bugs",
    "Correções",
    "Correções de erros",
    "Bug Fixes",
    "Correções de bugs e ajustes"
  ];

  for (const titulo of possiveisTitulos) {
    const secao =
      extrairSecaoPorTitulo(
        html,
        titulo
      );

    if (secao.length) {
      correcoes = secao;
      break;
    }
  }

  // ====================================================
  // MONTA TEXTOS
  // ====================================================

  for (const heroi of HEROIS) {
    const dados =
      dadosHerois[heroi];

    dados.buffsTexto =
      criarTexto(dados.buffs);

    dados.nerfsTexto =
      criarTexto(dados.nerfs);

    dados.ajustesTexto =
      criarTexto(dados.ajustes);

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

  const resultado = {
    atualizadoEm: new Date().toISOString(),

    fonte: BLIZZARD_URL,

    herois: dadosHerois,

    correcoes: correcoes,

    correcoesTexto:
      criarTextoCorrecoes(correcoes),

    correcoesPartes:
      dividirTexto(
        criarTextoCorrecoes(correcoes)
      )
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

const servidor = http.createServer(
  async (req, res) => {
    // CORS
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

    // OPTIONS
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(
      req.url,
      `http://${req.headers.host}`
    );

    // ==================================================
    // /
    // ==================================================

    if (
      req.method === "GET" &&
      url.pathname === "/"
    ) {
      res.writeHead(200, {
        "Content-Type":
          "application/json; charset=utf-8"
      });

      res.end(
        JSON.stringify({
          status: "online",
          api: "Overwatch Patch API",
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

    // ==================================================
    // TESTE BLIZZARD
    // ==================================================

    if (
      req.method === "GET" &&
      url.pathname === "/test-blizzard"
    ) {
      try {
        const html =
          await baixarPagina(
            BLIZZARD_URL
          );

        res.writeHead(200, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

        res.end(
          JSON.stringify({
            sucesso: true,
            tamanhoHTML: html.length,
            inicioHTML: html.substring(
              0,
              500
            )
          })
        );
      } catch (erro) {
        res.writeHead(500, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

        res.end(
          JSON.stringify({
            sucesso: false,
            erro: erro.message
          })
        );
      }

      return;
    }

    // ==================================================
    // /dados
    // ==================================================

    if (
      req.method === "GET" &&
      url.pathname === "/dados"
    ) {
      try {
        const dados =
          await obterDados();

        res.writeHead(200, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

        res.end(
          JSON.stringify(dados)
        );
      } catch (erro) {
        console.error(
          "Erro em /dados:",
          erro
        );

        res.writeHead(500, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

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

    // ==================================================
    // /patch
    // ==================================================

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

        // ----------------------------------------------
        // SEM HERÓI
        // ----------------------------------------------

        if (!nomeHeroi) {
          res.writeHead(200, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          res.end(
            JSON.stringify(
              dados
            )
          );

          return;
        }

        // ----------------------------------------------
        // COM HERÓI
        // ----------------------------------------------

        const heroi =
          encontrarHeroi(
            nomeHeroi
          );

        if (!heroi) {
          res.writeHead(404, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          res.end(
            JSON.stringify({
              erro: "Herói não encontrado",
              hero: nomeHeroi
            })
          );

          return;
        }

        res.writeHead(200, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

        res.end(
          JSON.stringify(
            dados.herois[heroi]
          )
        );
      } catch (erro) {
        console.error(
          "Erro em /patch:",
          erro
        );

        res.writeHead(500, {
          "Content-Type":
            "application/json; charset=utf-8"
        });

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

    // ==================================================
    // 404
    // ==================================================

    res.writeHead(404, {
      "Content-Type":
        "application/json; charset=utf-8"
    });

    res.end(
      JSON.stringify({
        erro: "Endpoint não encontrado"
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
      `Endpoint: /patch?hero=D.Va`
    );
  }
);
