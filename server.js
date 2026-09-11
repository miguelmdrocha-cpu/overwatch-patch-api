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

function extrairTitulos(html) {
  const titulos = [];

  const regex =
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto = limparHTML(match[1]);

    if (texto && !titulos.includes(texto)) {
      titulos.push(texto);
    }
  }

  return titulos;
}

const server = http.createServer(async (req, res) => {

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  // =========================
  // ROTA PRINCIPAL
  // =========================

  if (req.url === "/") {

    res.writeHead(200);

    res.end(JSON.stringify({
      status: "online",
      message: "Overwatch Patch API está funcionando!"
    }));

    return;
  }

  // =========================
  // TESTE DE CONEXÃO
  // =========================

  if (req.url === "/test-blizzard") {

    try {

      const response = await fetch(
        "https://overwatch.blizzard.com/pt-br/news/patch-notes/"
      );

      const html = await response.text();

      res.writeHead(200);

      res.end(JSON.stringify({
        status: "ok",
        blizzardStatus: response.status,
        tamanhoDaPagina: html.length
      }));

    } catch (error) {

      res.writeHead(500);

      res.end(JSON.stringify({
        status: "error",
        message: error.message
      }));
    }

    return;
  }

  // =========================
  // NOVA ROTA DE EXTRAÇÃO
  // =========================

  if (req.url === "/extrair") {

    try {

      const response = await fetch(
        "https://overwatch.blizzard.com/pt-br/news/patch-notes/"
      );

      const html = await response.text();

      const titulos = extrairTitulos(html);

      // Procurar a posição da seção de heróis
      const posicaoHerois =
        html.toLowerCase().indexOf(
          "atualizações dos heróis"
        );

      // Procurar a posição da seção de correções
      const posicaoCorrecoes =
        html.toLowerCase().indexOf(
          "bug fixes"
        );

      let trechoHerois = "";

      if (posicaoHerois !== -1) {

        trechoHerois = limparHTML(
          html.substring(
            posicaoHerois,
            posicaoHerois + 8000
          )
        );
      }

      res.writeHead(200);

      res.end(JSON.stringify({

        status: "ok",

        blizzardStatus: response.status,

        tamanhoDaPagina: html.length,

        secaoDeHeroisEncontrada:
          posicaoHerois !== -1,

        secaoDeCorrecoesEncontrada:
          posicaoCorrecoes !== -1,

        quantidadeDeTitulos:
          titulos.length,

        titulos: titulos,

        amostraDaSecaoDeHerois:
          trechoHerois

      }, null, 2));

    } catch (error) {

      res.writeHead(500);

      res.end(JSON.stringify({

        status: "error",

        message: error.message

      }, null, 2));
    }

    return;
  }

  // =========================
  // 404
  // =========================

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
