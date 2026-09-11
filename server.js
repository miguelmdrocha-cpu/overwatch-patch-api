
const http = require("http");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.url === "/") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "online",
      message: "Overwatch Patch API está funcionando!"
    }));
    return;
  }

  if (req.url === "/buffs") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "ok",
      patch: "Teste",
      buffs: [
        {
          hero: "Teste",
          change: "Dano aumentado"
        }
      ]
    }));
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
