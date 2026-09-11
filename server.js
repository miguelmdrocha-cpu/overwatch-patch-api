const http = require("http");

const PORT = process.env.PORT || 10000;

/*
==================================================
LIMPA HTML
==================================================
*/

function limparHTML(texto) {
  return texto
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/*
==================================================
NORMALIZA TEXTO
==================================================
*/

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/*
==================================================
EXTRAI TÍTULOS
==================================================
*/

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

/*
==================================================
CLASSIFICA UMA ALTERAÇÃO
==================================================
*/

function classificarMudanca(texto) {
  const t = normalizar(texto);

  const buffsEspecificos = [
    "recarga reduzida",
    "tempo de recarga reduzido",
    "tempo de recarga diminui",
    "tempo de recarga diminuido",
    "tempo de recarga diminuiu",
    "intervalo reduzido",
    "intervalo diminui",
    "intervalo diminuido",
    "intervalo entre ataques reduzido",
    "cooldown reduzido",
    "cooldown diminui",
    "cooldown diminuido",
    "dano aumentado",
    "dano aumenta",
    "dano aumentado de",
    "vida aumentada",
    "vida aumenta",
    "vida aumentada de",
    "cura aumentada",
    "cura aumenta",
    "cura aumentada de",
    "velocidade aumentada",
    "velocidade aumenta",
    "velocidade do projetil aumentada",
    "velocidade do projetil aumenta",
    "duracao aumentada",
    "duracao aumenta",
    "municao aumentada",
    "municao aumenta",
    "alcance aumentado",
    "alcance aumenta",
    "raio aumentado",
    "raio aumenta"
  ];

  const nerfsEspecificos = [
    "recarga aumentada",
    "tempo de recarga aumentado",
    "tempo de recarga aumenta",
    "tempo de recarga aumentou",
    "intervalo aumentado",
    "intervalo aumenta",
    "intervalo entre ataques aumentado",
    "cooldown aumentado",
    "cooldown aumenta",
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
    "velocidade do projetil reduz",
    "duracao reduzida",
    "duracao reduz",
    "municao reduzida",
    "municao reduz",
    "alcance reduzido",
    "alcance reduz",
    "raio reduzido",
    "raio reduz"
  ];

  if (
    buffsEspecificos.some(
      palavra => t.includes(normalizar(palavra))
    )
  ) {
    return "buff";
  }

  if (
    nerfsEspecificos.some(
      palavra => t.includes(normalizar(palavra))
    )
  ) {
    return "nerf";
  }

  const palavrasBuff = [
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
    "incrementada"
  ];

  const palavrasNerf = [
    "reduzido",
    "reduzida",
    "reduzidos",
    "reduzidas",
    "redução",
    "reduzir",
    "diminuiu",
    "diminuido",
    "diminuída",
    "diminuição",
    "menos dano",
    "menos vida",
    "menos cura",
    "enfraquecido",
    "enfraquecida"
  ];

  const encontrouBuff =
    palavrasBuff.some(
      palavra => t.includes(normalizar(palavra))
    );

  const encontrouNerf =
    palavrasNerf.some(
      palavra => t.includes(normalizar(palavra))
    );

  if (encontrouBuff && encontrouNerf) {
    return "alteracao";
  }

  if (encontrouBuff) {
    return "buff";
  }

  if (encontrouNerf) {
    return "nerf";
  }

  return "alteracao";
}

/*
==================================================
EXTRAI ALTERAÇÕES INDIVIDUAIS
==================================================
*/

function extrairMudancas(trecho) {
  const mudancas = [];

  const regexLi =
    /<li[^>]*>([\s\S]*?)<\/li>/gi;

  let match;

  while ((match = regexLi.exec(trecho)) !== null) {
    const texto = limparHTML(match[1]);

    if (
      texto &&
      texto.length >= 5 &&
      !mudancas.includes(texto)
    ) {
      mudancas.push(texto);
    }
  }

  if (mudancas.length === 0) {
    const regexP =
      /<p[^>]*>([\s\S]*?)<\/p>/gi;

    while ((match = regexP.exec(trecho)) !== null) {
      const texto = limparHTML(match[1]);

      if (
        texto &&
        texto.length >= 5 &&
        !mudancas.includes(texto)
      ) {
        mudancas.push(texto);
      }
    }
  }

  if (mudancas.length === 0) {
    const texto = limparHTML(trecho);

    if (texto) {
      mudancas.push(texto);
    }
  }

  return mudancas;
}

/*
==================================================
SEPARA MUDANÇAS
==================================================
*/

function separarMudancas(hero, mudancas) {
  const resultado = [];

  for (const mudanca of mudancas) {
    resultado.push({
      hero: hero,
      tipo: classificarMudanca(mudanca),
      change: mudanca
    });
  }

  return resultado;
}

/*
==================================================
CRIA TEXTO
==================================================
*/

function criarTexto(lista) {
  if (lista.length === 0) {
    return "Nenhum resultado encontrado nesta atualização.";
  }

  let texto = "";
  let ultimoHeroi = "";

  lista.forEach((item) => {

    if (item.hero !== ultimoHeroi) {

      if (texto !== "") {
        texto += "\n";
      }

      texto += `🦸 **${item.hero}**\n`;

      ultimoHeroi = item.hero;
    }

    if (item.tipo === "buff") {
      texto += `🟢 ${item.change}\n`;
    }

    else if (item.tipo === "nerf") {
      texto += `🔴 ${item.change}\n`;
    }

    else {
      texto += `⚪ ${item.change}\n`;
    }
  });

  return texto.trim();
}

/*
==================================================
CRIA TEXTO DE CORREÇÕES
==================================================
*/

function criarTextoCorrecoes(lista) {
  if (lista.length === 0) {
    return "Nenhuma correção encontrada nesta atualização.";
  }

  return lista
    .map(item => `🔧 ${item}`)
    .join("\n");
}

/*
==================================================
DIVIDE TEXTO
==================================================
*/

function dividirTexto(texto, limite = 3500) {
  const partes = [];

  let atual = "";

  const blocos = texto.split("\n\n");

  for (const bloco of blocos) {

    if (
      (atual + "\n\n" + bloco).length >
      limite
    ) {

      if (atual.length > 0) {
        partes.push(atual.trim());
      }

      atual = bloco;

    } else {

      atual +=
        (atual ? "\n\n" : "") +
        bloco;
    }
  }

  if (atual.length > 0) {
    partes.push(atual.trim());
  }

  return partes;
}

/*
==================================================
ENCONTRA UMA SEÇÃO PELO TÍTULO
==================================================
*/

function extrairSecaoPorTitulo(html, tituloProcurado) {

  const regexTitulo =
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;

  let match;

  while ((match = regexTitulo.exec(html)) !== null) {

    const titulo =
      limparHTML(match[1]);

    if (
      normalizar(titulo) ===
      normalizar(tituloProcurado)
    ) {

      const inicio =
        match.index + match[0].length;

      const restante =
        html.substring(inicio);

      const proximoTitulo =
        /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i
          .exec(restante);

      if (proximoTitulo) {
        return restante.substring(
          0,
          proximoTitulo.index
        );
      }

      return restante;
    }
  }

  return "";
}

/*
==================================================
OBTER DADOS DA BLIZZARD
==================================================
*/

async function obterDados() {

  const response =
    await fetch(
      "https://overwatch.blizzard.com/pt-br/news/patch-notes/"
    );

  const html =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Blizzard respondeu com status ${response.status}`
    );
  }

  const titulos =
    extrairTitulos(html);

  const indiceHerois =
    titulos.findIndex(
      titulo =>
        normalizar(titulo) ===
        normalizar("Atualizações dos heróis")
    );

  const indiceCorrecoes =
    titulos.findIndex(
      titulo =>
        normalizar(titulo) ===
        normalizar("Correção de problemas")
    );

  /*
  ================================================
  LISTA DE HERÓIS
  ================================================
  */

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

  /*
  ================================================
  TODAS AS MUDANÇAS
  ================================================
  */

  const todasMudancas = [];

  for (const nome of nomesHerois) {

    const regexHeroi =
      new RegExp(
        `<h[1-6][^>]*>\\s*${nome.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}\\s*<\\/h[1-6]>`,
        "i"
      );

    const matchHeroi =
      regexHeroi.exec(html);

    if (!matchHeroi) {
      continue;
    }

    const inicioHeroi =
      matchHeroi.index;

    const depoisHeroi =
      html.substring(
        inicioHeroi +
        matchHeroi[0].length
      );

    const proximoTitulo =
      /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i
        .exec(depoisHeroi);

    const trecho =
      proximoTitulo
        ? depoisHeroi.substring(
            0,
            proximoTitulo.index
          )
        : depoisHeroi.substring(
            0,
            10000
          );

    const mudancas =
      extrairMudancas(trecho);

    const classificadas =
      separarMudancas(
        nome,
        mudancas
      );

    todasMudancas.push(
      ...classificadas
    );
  }

  /*
  ================================================
  BUFFS / NERFS / ALTERAÇÕES
  ================================================
  */

  const buffs =
    todasMudancas.filter(
      item => item.tipo === "buff"
    );

  const nerfs =
    todasMudancas.filter(
      item => item.tipo === "nerf"
    );

  const alteracoes =
    todasMudancas.filter(
      item => item.tipo === "alteracao"
    );

  /*
  ================================================
  TEXTOS
  ================================================
  */

  const buffsTexto =
    criarTexto(buffs);

  const nerfsTexto =
    criarTexto(nerfs);

  const alteracoesTexto =
    criarTexto(alteracoes);

  /*
  ================================================
  CORREÇÕES
  ================================================
  */

  const trechoCorrecoes =
    extrairSecaoPorTitulo(
      html,
      "Correção de problemas"
    );

  const correcoes =
    extrairMudancas(
      trechoCorrecoes
    );

  const correcoesTexto =
    criarTextoCorrecoes(
      correcoes
    );

  /*
  ================================================
  TUDO
  ================================================
  */

  const tudoLista = [
    ...todasMudancas,
    ...correcoes.map(correcao => ({
      hero: "Correções",
      tipo: "alteracao",
      change: correcao
    }))
  ];

  const tudoTexto =
    criarTexto(tudoLista);

  /*
  ================================================
  PARTES
  ================================================
  */

  const buffsPartes =
    dividirTexto(buffsTexto);

  const nerfsPartes =
    dividirTexto(nerfsTexto);

  const alteracoesPartes =
    dividirTexto(alteracoesTexto);

  const correcoesPartes =
    dividirTexto(correcoesTexto);

  const tudoPartes =
    dividirTexto(tudoTexto);

  /*
  ================================================
  NOME DO PATCH
  ================================================
  */

  let patch =
    "Patch Notes";

  if (indiceHerois > 0) {
    patch =
      titulos[indiceHerois - 1];
  }

  /*
  ================================================
  RETORNO
  ================================================
  */

  return {

    status: "ok",

    blizzardStatus:
      response.status,

    patch:
      patch,

    todasMudancas:
      todasMudancas,

    buffs:
      buffs,

    nerfs:
      nerfs,

    alteracoes:
      alteracoes,

    correcoes:
      correcoes,

    tudo:
      tudoLista,

    buffsTexto:
      buffsTexto,

    nerfsTexto:
      nerfsTexto,

    alteracoesTexto:
      alteracoesTexto,

    correcoesTexto:
      correcoesTexto,

    tudoTexto:
      tudoTexto,

    buffsPartes:
      buffsPartes,

    nerfsPartes:
      nerfsPartes,

    alteracoesPartes:
      alteracoesPartes,

    correcoesPartes:
      correcoesPartes,

    tudoPartes:
      tudoPartes,

    quantidadeDeMudancas:
      todasMudancas.length,

    quantidadeDeBuffs:
      buffs.length,

    quantidadeDeNerfs:
      nerfs.length,

    quantidadeDeAlteracoes:
      alteracoes.length,

    quantidadeDeCorrecoes:
      correcoes.length,

    quantidadeTotal:
      todasMudancas.length +
      correcoes.length,

    quantidadeDePartesBuffs:
      buffsPartes.length,

    quantidadeDePartesNerfs:
      nerfsPartes.length,

    quantidadeDePartesAlteracoes:
      alteracoesPartes.length,

    quantidadeDePartesCorrecoes:
      correcoesPartes.length,

    quantidadeDePartesTudo:
      tudoPartes.length,

    secaoDeCorrecoesEncontrada:
      indiceCorrecoes !== -1
  };
}

/*
==================================================
SERVIDOR
==================================================
*/

const server =
  http.createServer(
    async (req, res) => {

      res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
      );

      /*
      ==============================================
      ROTA /
      ==============================================
      */

      if (req.url === "/") {

        res.writeHead(200);

        res.end(
          JSON.stringify({
            status: "online",
            message:
              "Overwatch Patch API está funcionando!"
          })
        );

        return;
      }

      /*
      ==============================================
      TESTE BLIZZARD
      ==============================================
      */

      if (
        req.url === "/test-blizzard"
      ) {

        try {

          const response =
            await fetch(
              "https://overwatch.blizzard.com/pt-br/news/patch-notes/"
            );

          const html =
            await response.text();

          res.writeHead(200);

          res.end(
            JSON.stringify({
              status: "ok",
              blizzardStatus:
                response.status,
              tamanhoDaPagina:
                html.length
            })
          );

        } catch (error) {

          res.writeHead(500);

          res.end(
            JSON.stringify({
              status: "error",
              message:
                error.message
            })
          );
        }

        return;
      }

      /*
      ==============================================
      ROTA /dados
      ==============================================
      */

      if (req.url === "/dados") {

        try {

          const dados =
            await obterDados();

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

          res.end(
            JSON.stringify(
              {
                status: "error",
                message:
                  error.message
              },
              null,
              2
            )
          );
        }

        return;
      }

      /*
      ==============================================
      ROTA /patch
      ==============================================
      */

      if (req.url.startsWith("/patch")) {

        try {

          const url =
            new URL(
              req.url,
              `http://localhost:${PORT}`
            );

          const nomeHeroi =
            url.searchParams.get("hero");

          if (!nomeHeroi) {

            res.writeHead(400);

            res.end(
              JSON.stringify({
                status: "error",
                message:
                  "Informe o nome do herói. Exemplo: /patch?hero=D.Va"
              })
            );

            return;
          }

          const dados =
            await obterDados();

          const busca =
            normalizar(nomeHeroi);

          const resultados =
            dados.todasMudancas.filter(
              item =>
                normalizar(item.hero) ===
                busca
            );

          if (resultados.length === 0) {

            res.writeHead(404);

            res.end(
              JSON.stringify({
                status: "error",
                message:
                  `Herói "${nomeHeroi}" não encontrado nesta atualização.`
              })
            );

            return;
          }

          const texto =
            criarTexto(resultados);

          const partes =
            dividirTexto(texto);

          res.writeHead(200);

          res.end(
            JSON.stringify(
              {
                status: "ok",
                hero:
                  resultados[0].hero,
                mudancas:
                  resultados,
                texto:
                  texto,
                partes:
                  partes,
                quantidade:
                  resultados.length
              },
              null,
              2
            )
          );

        } catch (error) {

          res.writeHead(500);

          res.end(
            JSON.stringify(
              {
                status: "error",
                message:
                  error.message
              },
              null,
              2
            )
          );
        }

        return;
      }

      /*
      ==============================================
      ROTA NÃO ENCONTRADA
      ==============================================
      */

      res.writeHead(404);

      res.end(
        JSON.stringify({
          status: "error",
          message:
            "Rota não encontrada"
        })
      );
    }
  );

/*
==================================================
INICIA SERVIDOR
==================================================
*/

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `API funcionando na porta ${PORT}`
    );

  }
);w
