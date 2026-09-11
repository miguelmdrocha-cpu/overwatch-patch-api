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
    .replace(/\s+/g, " ")
    .trim();
}

function removerDuplicados(lista) {
  const vistos = new Set();

  return (lista || []).filter((item) => {
    const chave = normalizar(
      typeof item === "string"
        ? item
        : JSON.stringify(item)
    );

    if (!chave || vistos.has(chave)) {
      return false;
    }

    vistos.add(chave);
    return true;
  });
}

function limparTexto(texto) {
  return String(texto || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function pareceMudanca(texto) {
  const t = normalizar(texto);

  if (!t || t.length < 5) {
    return false;
  }

  const termos = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "aumento",
    "aumentar",

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

    "tempo de recarga",
    "recarga",
    "dano",
    "vida",
    "cura",
    "velocidade",
    "duracao",
    "municao",
    "alcance",
    "raio",
    "capacidade",
    "regeneracao",
    "recuperacao",
    "projetil",

    "corrigido",
    "corrigida",
    "correcao",
    "bug",
    "erro",
    "problema",

    "ajustado",
    "ajustada",
    "ajuste",
    "alterado",
    "alterada",
    "alteracao"
  ];

  return termos.some((termo) => t.includes(termo));
}

function classificarMudanca(texto) {
  const t = normalizar(texto);

  const buffs = [
    "recarga reduzida",
    "tempo de recarga reduzido",
    "tempo de recarga diminui",
    "intervalo reduzido",
    "intervalo entre ataques reduzido",
    "cooldown reduzido",

    "dano aumentado",
    "vida aumentada",
    "cura aumentada",
    "velocidade aumentada",
    "velocidade do projetil aumentada",
    "duracao aumentada",
    "municao aumentada",
    "alcance aumentado",
    "raio aumentado",
    "capacidade aumentada",
    "regeneracao aumentada",
    "recuperacao aumentada",

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

  const nerfs = [
    "recarga aumentada",
    "tempo de recarga aumentado",
    "intervalo aumentado",
    "intervalo entre ataques aumentado",
    "cooldown aumentado",

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

    "duracao reduzida",
    "municao reduzida",
    "alcance reduzido",
    "raio reduzido",
    "capacidade reduzida",
    "regeneracao reduzida",
    "recuperacao reduzida",

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

    "menos dano",
    "menos vida",
    "menos cura",

    "enfraquecido",
    "enfraquecida"
  ];

  const temBuff = buffs.some((termo) =>
    t.includes(termo)
  );

  const temNerf = nerfs.some((termo) =>
    t.includes(termo)
  );

  if (temBuff && !temNerf) {
    return "buff";
  }

  if (temNerf && !temBuff) {
    return "nerf";
  }

  return "alteracao";
}

function extrairAtributos(tag) {
  const attrs = {};
  const corpo = String(tag || "");

  const regex =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])([\s\S]*?)\2/g;

  let match;

  while ((match = regex.exec(corpo))) {
    attrs[match[1].toLowerCase()] = match[3];
  }

  return attrs;
}

function extrairElementosOrdenados(html) {
  const elementos = [];

  const regex =
    /<(h[1-6]|strong|b|p|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  let match;

  while ((match = regex.exec(html))) {
    const tag = match[1].toLowerCase();
    const attrs = extrairAtributos(match[2]);

    const texto = limparTexto(
      limparHTML(match[3])
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

function pareceNomeDeHabilidade(texto) {
  const t = limparTexto(texto);

  if (!t || t.length > 80) {
    return false;
  }

  if (/[.!?]/.test(t)) {
    return false;
  }

  if (
    pareceMudanca(t) &&
    t.split(" ").length > 8
  ) {
    return false;
  }

  const n = normalizar(t);

  const ignorar = [
    "comentario dos desenvolvedores",
    "comentarios dos desenvolvedores",
    "herois",
    "tanques",
    "dano",
    "suporte",
    "correcoes de bugs",
    "correcoes",
    "modo competitivo",
    "geral",
    "notas de patch",
    "patch notes",
    "atualizacao",
    "mudancas",
    "ajustes"
  ];

  if (ignorar.includes(n)) {
    return false;
  }

  return true;
}

function encontrarHero(texto) {
  const n = normalizar(texto);

  const ordenados = [...HEROES].sort(
    (a, b) =>
      normalizar(b).length -
      normalizar(a).length
  );

  return (
    ordenados.find(
      (hero) =>
        n === normalizar(hero) ||
        n.includes(normalizar(hero))
    ) || null
  );
}
function extrairBlocosPorHeroi(html) {
  const elementos = extrairElementosOrdenados(html);
  const blocos = [];
  let heroiAtual = null;
  let habilidadeAtual = null;

  for (const elemento of elementos) {
    const possivelHeroi = encontrarHero(elemento.texto);

    if (
      possivelHeroi &&
      (
        elemento.tag.startsWith("h") ||
        normalizar(elemento.texto) === normalizar(possivelHeroi)
      )
    ) {
      heroiAtual = possivelHeroi;
      habilidadeAtual = null;

      if (!blocos.some((b) => b.heroi === heroiAtual)) {
        blocos.push({
          heroi: heroiAtual,
          mudancas: []
        });
      }

      continue;
    }

    if (!heroiAtual) {
      continue;
    }

    const bloco = blocos.find(
      (b) => b.heroi === heroiAtual
    );

    if (!bloco) {
      continue;
    }

    if (
      (elemento.tag === "strong" ||
        elemento.tag === "b") &&
      pareceNomeDeHabilidade(elemento.texto)
    ) {
      habilidadeAtual = elemento.texto;
      continue;
    }

    if (
      elemento.tag.startsWith("h") &&
      pareceNomeDeHabilidade(elemento.texto) &&
      !pareceMudanca(elemento.texto)
    ) {
      habilidadeAtual = elemento.texto;
      continue;
    }

    if (pareceMudanca(elemento.texto)) {
      bloco.mudancas.push({
        habilidade:
          habilidadeAtual || "Geral",
        texto: elemento.texto,
        tipo: classificarMudanca(elemento.texto)
      });
    }
  }

  return blocos;
}

function extrairMudancasDoTexto(html) {
  const elementos = extrairElementosOrdenados(html);
  const mudancas = [];

  let heroiAtual = null;
  let habilidadeAtual = null;

  for (const elemento of elementos) {
    const heroEncontrado = encontrarHero(elemento.texto);

    if (
      heroEncontrado &&
      (
        elemento.tag.startsWith("h") ||
        normalizar(elemento.texto) ===
          normalizar(heroEncontrado)
      )
    ) {
      heroiAtual = heroEncontrado;
      habilidadeAtual = null;
      continue;
    }

    if (!heroiAtual) {
      continue;
    }

    if (
      (elemento.tag === "strong" ||
        elemento.tag === "b") &&
      pareceNomeDeHabilidade(elemento.texto)
    ) {
      habilidadeAtual = elemento.texto;
      continue;
    }

    if (
      elemento.tag.startsWith("h") &&
      pareceNomeDeHabilidade(elemento.texto) &&
      !pareceMudanca(elemento.texto)
    ) {
      habilidadeAtual = elemento.texto;
      continue;
    }

    if (pareceMudanca(elemento.texto)) {
      mudancas.push({
        heroi: heroiAtual,
        habilidade:
          habilidadeAtual || "Geral",
        texto: elemento.texto,
        tipo: classificarMudanca(elemento.texto)
      });
    }
  }

  return mudancas;
}

function extrairMudancas(html) {
  let mudancas = extrairMudancasDoTexto(html);

  mudancas = mudancas.filter(
    (item) =>
      item.heroi &&
      item.texto &&
      item.texto.length >= 5
  );

  const resultado = [];

  for (const item of mudancas) {
    const chave =
      normalizar(item.heroi) +
      "|" +
      normalizar(item.habilidade) +
      "|" +
      normalizar(item.texto);

    if (
      !resultado.some(
        (existente) => existente._chave === chave
      )
    ) {
      resultado.push({
        ...item,
        _chave: chave
      });
    }
  }

  return resultado.map(
    ({ _chave, ...item }) => item
  );
}

function separarMudancas(mudancas) {
  return {
    buffs: mudancas.filter(
      (item) => item.tipo === "buff"
    ),

    nerfs: mudancas.filter(
      (item) => item.tipo === "nerf"
    ),

    alteracoes: mudancas.filter(
      (item) => item.tipo === "alteracao"
    )
  };
}

function extrairSecaoPorTitulo(html, termos) {
  const elementos = extrairElementosOrdenados(html);

  const procurados = termos.map((x) =>
    normalizar(x)
  );

  let iniciou = false;
  const linhas = [];

  for (const elemento of elementos) {
    const textoNormalizado =
      normalizar(elemento.texto);

    if (
      elemento.tag.startsWith("h") &&
      procurados.some((termo) =>
        textoNormalizado.includes(termo)
      )
    ) {
      iniciou = true;
      continue;
    }

    if (
      iniciou &&
      elemento.tag.startsWith("h") &&
      elementos.indexOf(elemento) > 0
    ) {
      const outroTitulo = textoNormalizado;

      const pareceNovaSecao =
        outroTitulo.length > 0 &&
        !procurados.some((termo) =>
          outroTitulo.includes(termo)
        );

      if (pareceNovaSecao) {
        break;
      }
    }

    if (iniciou) {
      linhas.push(elemento.texto);
    }
  }

  return linhas;
}

function extrairCorrecoes(html) {
  const termos = [
    "correções de bugs",
    "correções",
    "correcoes de bugs",
    "correcoes",
    "bug fixes"
  ];

  const linhas = extrairSecaoPorTitulo(
    html,
    termos
  );

  const correcoes = [];

  for (const linha of linhas) {
    const texto = limparTexto(linha);

    if (!texto || texto.length < 5) {
      continue;
    }

    if (
      normalizar(texto).includes(
        "comentario dos desenvolvedores"
      )
    ) {
      continue;
    }

    correcoes.push(texto);
  }

  return removerDuplicados(correcoes);
}

function criarTexto(mudancas, heroiFiltro = null) {
  const filtradas = mudancas.filter((item) => {
    if (!heroiFiltro) {
      return true;
    }

    return (
      normalizar(item.heroi) ===
      normalizar(heroiFiltro)
    );
  });

  if (!filtradas.length) {
    return heroiFiltro
      ? `❌ Nenhuma alteração encontrada para ${heroiFiltro}.`
      : "❌ Nenhuma alteração encontrada.";
  }

  const grupos = {};

  for (const item of filtradas) {
    const chave =
      item.heroi + "|" + item.habilidade;

    if (!grupos[chave]) {
      grupos[chave] = {
        heroi: item.heroi,
        habilidade: item.habilidade,
        itens: []
      };
    }

    grupos[chave].itens.push(item);
  }

  const linhas = [];
  let ultimoHeroi = null;

  for (const chave of Object.keys(grupos)) {
    const grupo = grupos[chave];

    if (grupo.heroi !== ultimoHeroi) {
      if (linhas.length) {
        linhas.push("");
      }

      linhas.push(`🦸 **${grupo.heroi}**`);
      linhas.push("");

      ultimoHeroi = grupo.heroi;
    }

    if (
      grupo.habilidade &&
      grupo.habilidade !== "Geral"
    ) {
      linhas.push(
        `🔹 **${grupo.habilidade}**`
      );
    }

    for (const item of grupo.itens) {
      let emoji = "⚪";

      if (item.tipo === "buff") {
        emoji = "🟢";
      } else if (item.tipo === "nerf") {
        emoji = "🔴";
      }

      linhas.push(
        `${emoji} ${item.texto}`
      );
    }

    linhas.push("");
  }

  return linhas.join("\n").trim();
}

function criarTextoCorrecoes(correcoes) {
  if (!correcoes.length) {
    return "🛠️ Nenhuma correção encontrada.";
  }

  return [
    "🛠️ **Correções de bugs**",
    "",
    ...correcoes.map(
      (correcao) => `🔧 ${correcao}`
    )
  ].join("\n");
}

function dividirTexto(texto, limite = 1900) {
  if (!texto) {
    return [];
  }

  const partes = [];
  let atual = "";

  const linhas = texto.split("\n");

  for (const linha of linhas) {
    if (
      (atual + "\n" + linha).length >
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

function encontrarHeroiSolicitado(nome) {
  const procurado = normalizar(nome);

  return (
    HEROES.find(
      (hero) =>
        normalizar(hero) === procurado
    ) ||
    HEROES.find((hero) => {
      const normalizado = normalizar(hero);

      return (
        normalizado.includes(procurado) ||
        procurado.includes(normalizado)
      );
    }) ||
    null
  );
}

function requisicaoBlizzard() {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

    fetch(BLIZZARD_URL, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Overwatch Patch API)",
        "Accept":
          "text/html,application/xhtml+xml",
        "Accept-Language":
          "pt-BR,pt;q=0.9,en;q=0.8"
      },
      signal: controller.signal
    })
      .then(async (response) => {
        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(
            `Blizzard respondeu com HTTP ${response.status}`
          );
        }

        const html = await response.text();

        if (!html || html.length < 1000) {
          throw new Error(
            "A página da Blizzard retornou conteúdo insuficiente."
          );
        }

        resolve(html);
      })
      .catch((erro) => {
        clearTimeout(timer);
        reject(erro);
      });
  });
}

async function obterDados() {
  const agora = Date.now();

  if (
    cache.data &&
    agora - cache.time < CACHE_TIME
  ) {
    return cache.data;
  }

  const html = await requisicaoBlizzard();

  const mudancas = extrairMudancas(html);
  const separados = separarMudancas(mudancas);
  const correcoes = extrairCorrecoes(html);

  const textoBuffs = criarTexto(
    separados.buffs
  );

  const textoNerfs = criarTexto(
    separados.nerfs
  );

  const textoAlteracoes = criarTexto(
    separados.alteracoes
  );

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
    atualizadoEm: new Date().toISOString(),

    totalAlteracoes: mudancas.length,

    mudancas,

    buffs: separados.buffs,
    nerfs: separados.nerfs,
    alteracoes: separados.alteracoes,

    correcoes,

    texto: criarTexto(mudancas),

    textoBuffs,

    textoNerfs,

    textoAlteracoes,

    textoTudo,

    textoCorrecoes,

    // Compatibilidade com os comandos do BDFD
    buffsPartes: dividirTexto(textoBuffs),

    nerfsPartes: dividirTexto(textoNerfs),

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

function enviarJSON(res, statusCode, dados) {
  const corpo = JSON.stringify(
    dados,
    null,
    2
  );

  res.writeHead(statusCode, {
    "Content-Type":
      "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache"
  });

  res.end(corpo);
}

function enviarTexto(res, statusCode, texto) {
  res.writeHead(statusCode, {
    "Content-Type":
      "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(texto);
}

const server = http.createServer(
  async (req, res) => {
    try {
      const url = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
      );

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type"
        });

        return res.end();
      }

      if (url.pathname === "/") {
        return enviarJSON(res, 200, {
          sucesso: true,
          nome: "Overwatch Patch API",
          status: "online",
          fonte: BLIZZARD_URL,
          endpoints: [
            "/",
            "/test-blizzard",
            "/dados",
            "/patch",
            "/patch?hero=D.Va"
          ]
        });
      }

      if (
        url.pathname === "/test-blizzard"
      ) {
        const html =
          await requisicaoBlizzard();

        return enviarJSON(res, 200, {
          sucesso: true,
          fonte: BLIZZARD_URL,
          tamanhoHTML: html.length,
          mensagem:
            "Página da Blizzard acessada com sucesso."
        });
      }

      if (url.pathname === "/dados") {
        const dados = await obterDados();

        return enviarJSON(res, 200, dados);
      }

      if (url.pathname === "/patch") {
        const dados = await obterDados();

        const heroParametro =
          url.searchParams.get("hero");

        if (heroParametro) {
          const heroi =
            encontrarHeroiSolicitado(
              heroParametro
            );

          if (!heroi) {
            return enviarJSON(res, 404, {
              sucesso: false,
              erro:
                `Herói "${heroParametro}" não encontrado.`,
              heroisDisponiveis: HEROES
            });
          }

          const mudancasHeroi =
            dados.mudancas.filter(
              (item) =>
                normalizar(item.heroi) ===
                normalizar(heroi)
            );

          return enviarJSON(res, 200, {
            sucesso: true,
            heroi,
            totalAlteracoes:
              mudancasHeroi.length,

            mudancas: mudancasHeroi,

            buffs: mudancasHeroi.filter(
              (item) =>
                item.tipo === "buff"
            ),

            nerfs: mudancasHeroi.filter(
              (item) =>
                item.tipo === "nerf"
            ),

            alteracoes:
              mudancasHeroi.filter(
                (item) =>
                  item.tipo === "alteracao"
              ),

            texto: criarTexto(
              mudancasHeroi,
              heroi
            ),

            partes: dividirTexto(
              criarTexto(
                mudancasHeroi,
                heroi
              )
            )
          });
        }

        return enviarJSON(res, 200, {
          sucesso: true,
          totalAlteracoes:
            dados.totalAlteracoes,

          buffs: dados.buffs,
          nerfs: dados.nerfs,
          alteracoes: dados.alteracoes,

          texto: dados.texto,

          partes: dividirTexto(
            dados.texto
          ),

          correcoes:
            dados.correcoes,

          textoCorrecoes:
            dados.textoCorrecoes,

          partesCorrecoes:
            dividirTexto(
              dados.textoCorrecoes
            ),

          atualizadoEm:
            dados.atualizadoEm,

          fonte: dados.fonte
        });
      }

      return enviarJSON(res, 404, {
        sucesso: false,
        erro: "Endpoint não encontrado.",
        endpoints: [
          "/",
          "/test-blizzard",
          "/dados",
          "/patch",
          "/patch?hero=D.Va"
        ]
      });
    } catch (erro) {
      console.error(
        "Erro na API:",
        erro
      );

      return enviarJSON(res, 500, {
        sucesso: false,
        erro:
          erro && erro.message
            ? erro.message
            : "Erro interno do servidor."
      });
    }
  }
);

server.listen(PORT, () => {
  console.log(
    `Overwatch Patch API rodando na porta ${PORT}`
  );

  console.log(
    "Endpoint: /patch"
  );

  console.log(
    "Endpoint: /patch?hero=D.Va"
  );
});
