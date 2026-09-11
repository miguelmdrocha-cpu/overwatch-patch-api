const http = require("http");

const PORT = process.env.PORT || 10000;

const BLIZZARD_URL =
  "https://overwatch.blizzard.com/pt-br/news/patch-notes/live/";

const CACHE_TIME = 5 * 60 * 1000; // 5 minutos

let cache = {
  timestamp: 0,
  data: null
};

/* =========================================================
   UTILIDADES
========================================================= */

function limparHTML(texto = "") {
  return texto
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
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
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function normalizar(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escaparRegex(texto = "") {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textoLimpo(texto = "") {
  return limparHTML(texto)
    .replace(/\s+/g, " ")
    .trim();
}

function removerDuplicados(lista) {
  const vistos = new Set();

  return lista.filter(item => {
    const chave = normalizar(
      `${item.heroi || ""}|${item.habilidade || ""}|${item.mudanca || ""}`
    );

    if (vistos.has(chave)) {
      return false;
    }

    vistos.add(chave);
    return true;
  });
}

/* =========================================================
   CLASSIFICAÇÃO
========================================================= */

const TERMOS_BUFF = [
  "aumentado",
  "aumentada",
  "aumentados",
  "aumentadas",
  "reduzido de",
  "reduzida de",
  "reduzidos de",
  "reduzidas de",
  "mais dano",
  "mais vida",
  "mais cura",
  "mais velocidade",
  "menor tempo de recarga",
  "tempo de recarga reduzido",
  "recarga reduzida",
  "cooldown reduzido",
  "dano aumentado",
  "cura aumentada",
  "vida aumentada",
  "alcance aumentado",
  "velocidade aumentada",
  "ganhou",
  "concede",
  "concedido",
  "concedida"
];

const TERMOS_NERF = [
  "diminuído",
  "diminuída",
  "diminuídos",
  "diminuídas",
  "reduzido para",
  "reduzida para",
  "reduzidos para",
  "reduzidas para",
  "menos dano",
  "menos vida",
  "menos cura",
  "menos velocidade",
  "tempo de recarga aumentado",
  "recarga aumentada",
  "cooldown aumentado",
  "dano reduzido",
  "cura reduzida",
  "vida reduzida",
  "alcance reduzido",
  "velocidade reduzida",
  "removido",
  "removida",
  "removidos",
  "removidas"
];

function classificarMudanca(texto) {
  const t = normalizar(texto);

  const temBuff = TERMOS_BUFF.some(termo =>
    t.includes(normalizar(termo))
  );

  const temNerf = TERMOS_NERF.some(termo =>
    t.includes(normalizar(termo))
  );

  if (temBuff && !temNerf) {
    return "buff";
  }

  if (temNerf && !temBuff) {
    return "nerf";
  }

  if (temBuff && temNerf) {
    return "alteracao";
  }

  if (
    t.includes("corrigimos um problema") ||
    t.includes("corrigido") ||
    t.includes("corrigida") ||
    t.includes("corrigidos") ||
    t.includes("corrigidas") ||
    t.includes("fixed") ||
    t.includes("fix an issue")
  ) {
    return "correcao";
  }

  return "alteracao";
}

/* =========================================================
   EXTRAÇÃO DE BLOCOS HTML
========================================================= */

/*
  O parser trabalha em cima da ordem real do HTML.

  Isso é importante porque a Blizzard atualmente usa uma
  estrutura semelhante a:

  Herói
    Comentário dos desenvolvedores
    Habilidade
      - mudança
      - mudança
    Outra habilidade
      - mudança
*/

function extrairElementos(html) {
  const elementos = [];

  const regex =
    /<(h[1-6]|li|p|strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const conteudo = textoLimpo(match[2]);

    if (!conteudo) continue;

    elementos.push({
      tag,
      texto: conteudo,
      indice: match.index
    });
  }

  return elementos;
}

/* =========================================================
   HERÓIS
========================================================= */

/*
  Lista de fallback.

  Ela NÃO é usada como única fonte.
  O parser também tenta descobrir os heróis diretamente
  na estrutura da página.
*/

const HEROIS_FALLBACK = [
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
  "Hazard",
  "Junker Queen",
  "Doomfist",
  "Sigma",

  "Anran",
  "Freja",
  "Genji",
  "Junkrat",
  "Sierra",
  "Symmetra",
  "Torbjörn",
  "Vendetta",
  "Widowmaker",
  "Ashe",
  "Bastion",
  "Cassidy",
  "Echo",
  "Hanzo",
  "Mei",
  "Pharah",
  "Reaper",
  "Sojourn",
  "Soldado: 76",
  "Sombra",
  "Tracer",

  "Ana",
  "Baptiste",
  "Brigitte",
  "Illari",
  "Juno",
  "Kiriko",
  "Lifeweaver",
  "Lucio",
  "Mercy",
  "Moira",
  "Mizuki",
  "Wuyang",
  "Zenyatta",
  "Jetpack Cat"
];

const HEROIS_NORMALIZADOS = new Map(
  HEROIS_FALLBACK.map(nome => [normalizar(nome), nome])
);

function encontrarHeroi(texto) {
  const n = normalizar(texto);

  if (HEROIS_NORMALIZADOS.has(n)) {
    return HEROIS_NORMALIZADOS.get(n);
  }

  for (const [normalizado, original] of HEROIS_NORMALIZADOS) {
    if (n === normalizado) {
      return original;
    }
  }

  return null;
}

/* =========================================================
   DETECÇÃO DE HABILIDADES
========================================================= */

const NOMES_IGNORAR = [
  "image",
  "imagem",
  "comentário dos desenvolvedores",
  "comentario dos desenvolvedores",
  "atualizações dos heróis",
  "atualizacoes dos herois",
  "correção de problemas",
  "correcao de problemas",
  "correção de bugs",
  "correcao de bugs",
  "geral",
  "tanque",
  "dano",
  "suporte",
  "topo da publicação",
  "notas de atualização em vigor",
  "notas de atualizacao em vigor"
];

function pareceNomeDeHabilidade(texto) {
  if (!texto) return false;

  const n = normalizar(texto);

  if (NOMES_IGNORAR.includes(n)) {
    return false;
  }

  if (encontrarHeroi(texto)) {
    return false;
  }

  /*
    Não consideramos frases muito grandes como habilidades.
  */
  if (texto.length > 100) {
    return false;
  }

  /*
    Se parece uma frase de mudança, não é título.
  */
  if (
    n.startsWith("tempo de ") ||
    n.startsWith("dano ") ||
    n.startsWith("cura ") ||
    n.startsWith("velocidade ") ||
    n.startsWith("agora ") ||
    n.startsWith("nao ") ||
    n.startsWith("não ") ||
    n.startsWith("corrigimos ") ||
    n.startsWith("corrigido ") ||
    n.startsWith("corrigida ") ||
    n.startsWith("corrigimos um problema")
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   DETECÇÃO DE MUDANÇAS
========================================================= */

function pareceMudanca(texto) {
  if (!texto) return false;

  const n = normalizar(texto);

  const indicadores = [
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
    "diminuido",
    "agora ",
    "nao mais",
    "não mais",
    "removido",
    "removida",
    "adicionado",
    "adicionada",
    "passou",
    "tempo de recarga",
    "dano",
    "cura",
    "vida",
    "alcance",
    "velocidade",
    "corrigimos",
    "corrigido",
    "corrigida",
    "corrigidos",
    "corrigidas",
    "fixed",
    "increased",
    "decreased",
    "reduced",
    "removed",
    "added"
  ];

  return indicadores.some(item => n.includes(normalizar(item)));
}

/* =========================================================
   EXTRAÇÃO DAS MUDANÇAS
========================================================= */

function extrairMudancasDoElemento(htmlElemento) {
  const resultado = [];

  /*
    Primeiro tenta pegar <li>, que é o formato principal
    utilizado nas notas da Blizzard.
  */
  const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

  let match;

  while ((match = liRegex.exec(htmlElemento)) !== null) {
    const texto = textoLimpo(match[1]);

    if (texto && pareceMudanca(texto)) {
      resultado.push(texto);
    }
  }

  /*
    Caso não existam <li>, tenta parágrafos.
  */
  if (resultado.length === 0) {
    const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;

    while ((match = pRegex.exec(htmlElemento)) !== null) {
      const texto = textoLimpo(match[1]);

      if (texto && pareceMudanca(texto)) {
        resultado.push(texto);
      }
    }
  }

  return resultado;
}

/* =========================================================
   PARSER PRINCIPAL
========================================================= */

function extrairMudancas(html) {
  const elementos = extrairElementos(html);

  const mudancas = [];

  let heroiAtual = null;
  let habilidadeAtual = null;

  for (let i = 0; i < elementos.length; i++) {
    const elemento = elementos[i];
    const texto = elemento.texto;

    /*
      Se o elemento for um herói conhecido,
      ele vira o herói atual.
    */
    const heroiDetectado = encontrarHeroi(texto);

    if (
      heroiDetectado &&
      (elemento.tag === "h1" ||
        elemento.tag === "h2" ||
        elemento.tag === "h3" ||
        elemento.tag === "h4" ||
        elemento.tag === "h5" ||
        elemento.tag === "h6")
    ) {
      heroiAtual = heroiDetectado;
      habilidadeAtual = null;
      continue;
    }

    /*
      Mudanças em <li>.
    */
    if (elemento.tag === "li" && pareceMudanca(texto)) {
      if (!heroiAtual) continue;

      const tipo = classificarMudanca(texto);

      mudancas.push({
        heroi: heroiAtual,
        habilidade: habilidadeAtual || "Geral",
        mudanca: texto,
        tipo
      });

      continue;
    }

    /*
      Cabeçalhos são candidatos a habilidades.
    */
    if (
      ["h1", "h2", "h3", "h4", "h5", "h6"].includes(elemento.tag)
    ) {
      if (
        heroiAtual &&
        pareceNomeDeHabilidade(texto) &&
        !encontrarHeroi(texto)
      ) {
        habilidadeAtual = texto;
      }
    }
  }

  return removerDuplicados(mudancas);
}

/* =========================================================
   SEGUNDA CAMADA DE PARSER
========================================================= */

/*
  Algumas páginas da Blizzard possuem o nome da habilidade
  dentro de <strong> ou <b> antes da lista de mudanças.

  Esta função captura essa situação.
*/

function extrairMudancasPorBlocos(html) {
  const resultado = [];

  /*
    Divide por títulos de heróis conhecidos.
  */
  const nomesOrdenados = [...HEROIS_FALLBACK]
    .sort((a, b) => b.length - a.length)
    .map(escaparRegex)
    .join("|");

  const regexHeroi = new RegExp(
    `<h[1-6][^>]*>\\s*(?:${nomesOrdenados})\\s*<\\/h[1-6]>`,
    "gi"
  );

  const encontrados = [];

  let match;

  while ((match = regexHeroi.exec(html)) !== null) {
    encontrados.push({
      inicio: match.index,
      fim: regexHeroi.lastIndex,
      nome: textoLimpo(match[0])
    });
  }

  for (let i = 0; i < encontrados.length; i++) {
    const atual = encontrados[i];

    const inicio = atual.fim;

    const fim =
      i + 1 < encontrados.length
        ? encontrados[i + 1].inicio
        : html.length;

    const bloco = html.slice(inicio, fim);

    const heroi =
      encontrarHeroi(atual.nome) ||
      atual.nome.replace(/<[^>]+>/g, "").trim();

    /*
      Captura títulos h1-h6, strong e b.
    */
    const tituloRegex =
      /<(h[1-6]|strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi;

    const titulos = [];

    while ((match = tituloRegex.exec(bloco)) !== null) {
      const titulo = textoLimpo(match[2]);

      if (!titulo) continue;

      if (!pareceNomeDeHabilidade(titulo)) {
        continue;
      }

      if (encontrarHeroi(titulo)) {
        continue;
      }

      titulos.push({
        posicao: match.index,
        nome: titulo
      });
    }

    /*
      Captura todos os <li>.
    */
    const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

    while ((match = liRegex.exec(bloco)) !== null) {
      const mudanca = textoLimpo(match[1]);

      if (!mudanca || !pareceMudanca(mudanca)) {
        continue;
      }

      /*
        Descobre a habilidade imediatamente anterior.
      */
      let habilidade = "Geral";

      for (const titulo of titulos) {
        if (titulo.posicao <= match.index) {
          habilidade = titulo.nome;
        } else {
          break;
        }
      }

      resultado.push({
        heroi,
        habilidade,
        mudanca,
        tipo: classificarMudanca(mudanca)
      });
    }
  }

  return removerDuplicados(resultado);
}

/* =========================================================
   CORREÇÕES
========================================================= */

function extrairCorrecoes(html) {
  const resultado = [];

  const regex =
    /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;

  const elementos = [];

  let match;

  while ((match = regex.exec(html)) !== null) {
    elementos.push({
      posicao: match.index,
      titulo: textoLimpo(match[2])
    });
  }

  /*
    Procuramos seções relacionadas a correções.
  */
  for (let i = 0; i < elementos.length; i++) {
    const tituloNormalizado = normalizar(elementos[i].titulo);

    const ehCorrecao =
      tituloNormalizado.includes("correcao de problemas") ||
      tituloNormalizado.includes("correcao de bugs") ||
      tituloNormalizado === "bug fixes" ||
      tituloNormalizado === "correcoes";

    if (!ehCorrecao) continue;

    const inicio = elementos[i].posicao;

    const fim =
      i + 1 < elementos.length
        ? elementos[i + 1].posicao
        : html.length;

    const bloco = html.slice(inicio, fim);

    const liRegex =
      /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

    let li;

    while ((li = liRegex.exec(bloco)) !== null) {
      const texto = textoLimpo(li[1]);

      if (!texto) continue;

      resultado.push({
        heroi: "Geral",
        habilidade: "Correção de problemas",
        mudanca: texto,
        tipo: "correcao"
      });
    }
  }

  return removerDuplicados(resultado);
}

/* =========================================================
   PARSER FINAL
========================================================= */

function parsearPagina(html) {
  /*
    Primeiro parser.
  */
  let mudancas = extrairMudancas(html);

  /*
    Segundo parser especializado.
  */
  const mudancasPorBloco = extrairMudancasPorBlocos(html);

  /*
    Junta os dois.
  */
  mudancas = removerDuplicados([
    ...mudancas,
    ...mudancasPorBloco
  ]);

  /*
    Correções.
  */
  const correcoes = extrairCorrecoes(html);

  mudancas = removerDuplicados([
    ...mudancas,
    ...correcoes
  ]);

  /*
    Classificação final.
  */
  const buffs = mudancas.filter(m => m.tipo === "buff");
  const nerfs = mudancas.filter(m => m.tipo === "nerf");
  const alteracoes = mudancas.filter(m => m.tipo === "alteracao");
  const correcoesFinais = mudancas.filter(
    m => m.tipo === "correcao"
  );

  return {
    fonte: BLIZZARD_URL,
    atualizadoEm: new Date().toISOString(),

    total: mudancas.length,

    totalBuffs: buffs.length,
    totalNerfs: nerfs.length,
    totalAlteracoes: alteracoes.length,
    totalCorrecoes: correcoesFinais.length,

    buffs,
    nerfs,
    alteracoes,
    correcoes: correcoesFinais,

    todasMudancas: mudancas,

    texto: criarTextoDiscord(mudancas),

    partes: dividirTexto(criarTextoDiscord(mudancas))
  };
}

/* =========================================================
   TEXTO PARA DISCORD
========================================================= */

function emojiTipo(tipo) {
  switch (tipo) {
    case "buff":
      return "🟢";

    case "nerf":
      return "🔴";

    case "correcao":
      return "🔧";

    default:
      return "🟡";
  }
}

function criarTextoDiscord(lista) {
  const grupos = new Map();

  for (const item of lista) {
    if (!grupos.has(item.heroi)) {
      grupos.set(item.heroi, []);
    }

    grupos.get(item.heroi).push(item);
  }

  const linhas = [];

  for (const [heroi, itens] of grupos) {
    linhas.push(`## 🦸 ${heroi}`);

    let habilidadeAnterior = null;

    for (const item of itens) {
      if (item.habilidade !== habilidadeAnterior) {
        linhas.push(`### ${item.habilidade}`);
        habilidadeAnterior = item.habilidade;
      }

      linhas.push(
        `${emojiTipo(item.tipo)} ${item.mudanca}`
      );
    }

    linhas.push("");
  }

  return linhas.join("\n").trim();
}

/* =========================================================
   DIVIDIR TEXTO PARA DISCORD
========================================================= */

function dividirTexto(texto, limite = 3900) {
  if (!texto) return [];

  const partes = [];

  let atual = "";

  const linhas = texto.split("\n");

  for (const linha of linhas) {
    const candidata =
      atual.length === 0
        ? linha
        : atual + "\n" + linha;

    if (candidata.length > limite) {
      if (atual) {
        partes.push(atual);
      }

      atual = linha;
    } else {
      atual = candidata;
    }
  }

  if (atual) {
    partes.push(atual);
  }

  return partes;
}

/* =========================================================
   DOWNLOAD DA BLIZZARD
========================================================= */

async function baixarPagina() {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    const resposta = await fetch(BLIZZARD_URL, {
      method: "GET",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OverwatchPatchAPI/1.0)",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          "pt-BR,pt;q=0.9,en;q=0.8"
      },

      signal: controller.signal
    });

    if (!resposta.ok) {
      throw new Error(
        `Blizzard respondeu com HTTP ${resposta.status}`
      );
    }

    return await resposta.text();
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   OBTER DADOS
========================================================= */

async function obterDados() {
  const agora = Date.now();

  if (
    cache.data &&
    agora - cache.timestamp < CACHE_TIME
  ) {
    return cache.data;
  }

  console.log("🔄 Buscando notas oficiais da Blizzard...");

  const html = await baixarPagina();

  console.log(
    `📄 HTML recebido: ${html.length.toLocaleString("pt-BR")} caracteres`
  );

  const dados = parsearPagina(html);

  console.log(
    `✅ ${dados.total} mudanças encontradas`
  );

  console.log(
    `🟢 Buffs: ${dados.totalBuffs}`
  );

  console.log(
    `🔴 Nerfs: ${dados.totalNerfs}`
  );

  console.log(
    `🟡 Alterações: ${dados.totalAlteracoes}`
  );

  console.log(
    `🔧 Correções: ${dados.totalCorrecoes}`
  );

  cache = {
    timestamp: agora,
    data: dados
  };

  return dados;
}

/* =========================================================
   RESPOSTAS HTTP
========================================================= */

function enviarJSON(res, status, dados) {
  const resposta = JSON.stringify(
    dados,
    null,
    2
  );

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-
