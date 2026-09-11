const http = require("http");

const PORT = process.env.PORT || 10000;

function limparHTML(texto) {
  return texto
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const server = http.createServer(async (req, res) => {

  res.setHeader("Content-Type", "application/json; charset=utf-8");

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
  // TESTE DA BLIZZARD
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
  // ESTRUTURA DA PÁGINA
  // =========================

  if (req.url === "/estrutura") {

    try {

      const response = await fetch(
        "https://overwatch.blizzard.com/pt-br/news/patch-notes/"
      );

      const html = await response.text();

      // Procurar títulos H1 até H6
      const titulos = [];

      const regexTitulos =
        /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;

      let match;

      while (
        (match = regexTitulos.exec(html)) !== null &&
        titulos.length < 100
      ) {

        const titulo = limparHTML(match[1]);

        if (titulo) {
          titulos.push(titulo);
        }
      }

      // Procurar alguns marcadores importantes
      const htmlMinusculo = html.toLowerCase();

      const marcadores = {

        patchNotes:
          htmlMinusculo.includes("patch notes"),

        notasDoPatch:
          htmlMinusculo.includes("notas do patch"),

        heroUpdates:
          htmlMinusculo.includes("hero updates"),

        atualizacoesDeHerois:
          htmlMinusculo.includes("atualizações de heróis"),

        bugFixes:
          htmlMinusculo.includes("bug fixes"),

        correcoes:
          htmlMinusculo.includes("correções"),

        atualizacoes:
          htmlMinusculo.includes("atualizações")
      };

      res.writeHead(200);

      res.end(JSON.stringify({

        status: "ok",

        blizzardStatus: response.status,

        tamanhoDaPagina: html.length,

        quantidadeDeTitulos: titulos.length,

        titulos: titulos,

        marcadores: marcadores

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
  // ROTA NÃO ENCONTRADA
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
