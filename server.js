const http = require("http");

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.url === "/") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "online",
      message: "Overwatch Patch API está funcionando!"
    }));
    return;
  }

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

  res.writeHead(404);
  res.end(JSON.stringify({
    status: "error",
    message: "Rota não encontrada"
  }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`API funcionando na porta ${PORT}`);
});
