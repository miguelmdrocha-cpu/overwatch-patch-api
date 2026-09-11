const http = require("http");

const PORT = process.env.PORT || 10000;

function limparHTML(texto) {
  return texto
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extrairTitulos(html) {
  const titulos = [];
  const regex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto = limparHTML(match[1]);

    if (texto && !titulos.includes(texto)) {
      titulos.push(texto);
    }
  }

  return titulos;
}

function classificar(texto) {
  const t = normalizar(texto);

  const buffs = [
    "aumentado",
    "aumentada",
    "aumentados",
    "aumentadas",
    "aumento",
    "mais dano",
    "mais vida",
    "mais cura",
    "reduzido tempo de recarga",
    "reduzida recarga",
    "recarga reduzida"
  ];

  const nerfs = [
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "redução",
    "diminuiu",
    "diminuição",
    "menos dano",
    "menos vida",
    "menos cura",
    "aumentado tempo de recarga",
    "recarga aumentada"
  ];

  if (buffs.some(palavra => t.includes(normalizar(palavra)))) {
    return "buff";
  }

  if (nerfs.some(palavra => t.includes(normalizar(palavra)))) {
    return "nerf";
  }

  return "alteracao";
}

async function obterDados() {
  const response = await fetch(
    "https://overwatch.blizzard.com/pt-br/news/patch-notes/"
  );

  const html = await response.text();

  if (!response.ok) {
    throw new Error(
      `Blizzard respondeu com status ${response.status}`
    );
  }

  const titulos = extrairTitulos(html);

  const indiceHerois = titulos.findIndex(
    titulo =>
      normalizar(titulo) ===
      normalizar("Atualizações dos heróis")
  );

  const indiceCorrecoes = titulos.findIndex(
    titulo =>
      normalizar(titulo) ===
      normalizar("Correção de problemas")
  );

  const herois = [];

  const nomesHerois = [
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

  for (const nome of nomesHerois) {
    const indice = titulos.findIndex(
      titulo =>
        normalizar(titulo) === normalizar(nome)
    );

    if (indice === -1) {
      continue;
    }

    let inicio = html.toLowerCase().indexOf(
      `<h`,
      0
    );

    const regexHeroi = new RegExp(
      `<h[1-6][^>]*>\\s*${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<\\/h[1-6]>`,
      "i"
    );

    const matchHeroi = regexHeroi.exec(html);

    if (!matchHeroi) {
      continue;
    }

    const inicioHeroi = matchHeroi.index;
    const depoisHeroi = html.substring(
      inicioHeroi + matchHeroi[0].length
    );

    const proximoTitulo =
      /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i.exec(
        depoisHeroi
      );

    const trecho = proximoTitulo
      ? depoisHeroi.substring(
          0,
          proximoTitulo.index
        )
      : depoisHeroi.substring(0, 6000);

    const texto = limparHTML(trecho);

    if (texto.length > 0) {
      const tipo = classificar(texto);

      herois.push({
        hero: nome,
        tipo: tipo,
        change: texto.substring(0, 1000)
      });
    }
  }

  const buffs = herois.filter(
    item => item.tipo === "buff"
  );

  const nerfs = herois.filter(
    item => item.tipo === "nerf"
  );

  const alteracoes = herois.filter(
    item => item.tipo === "alteracao"
  );

  let patch = "Patch Notes";

  if (indiceHerois > 0) {
    patch = titulos[indiceHerois - 1];
  }

  return {
    status: "ok",
    blizzardStatus: response.status,
    patch: patch,
    buffs: buffs,
    nerfs: nerfs,
    alteracoes: alteracoes,
    quantidadeDeBuffs: buffs.length,
    quantidadeDeNerfs: nerfs.length,
    quantidadeDeAlteracoes: alteracoes.length,
    secaoDeCorrecoesEncontrada:
      indiceCorrecoes !== -1
  };
}

const server = http.createServer(async (req, res) => {

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  if (req.url === "/") {
    res.writeHead(200);

    res.end(JSON.stringify({
      status: "online",
      message: "Overwatch Patch API está funcionando!"
    }, null, 2));

    return;
  }

  if (req.url === "/dados") {
    try {
      const dados = await obterDados();

      res.writeHead(200);

      res.end(
        JSON.stringify(
          dados,
          null,
          2
        )
      );

    } catch (error) {

      res.writeHead(500);

      res.end(JSON.stringify({
        status: "error",
        message: error.message
      }, null, 2));
    }

    return;
  }

  res.writeHead(404);

  res.end(JSON.stringify({
    status: "error",
    message: "Rota não encontrada"
  }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `API funcionando na porta ${PORT}`
  );
});
