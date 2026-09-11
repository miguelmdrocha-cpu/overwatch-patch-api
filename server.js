const http = require("http");

const PORT = process.env.PORT || 10000;

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
CLASSIFICA UMA ALTERAÇÃO INDIVIDUAL
==================================================
*/

function classificarMudanca(texto) {
  const t = normalizar(texto);

  /*
  ----------------------------------------------
  BUFFS ESPECÍFICOS
  ----------------------------------------------
  */

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

  /*
  ----------------------------------------------
  NERFS ESPECÍFICOS
  ----------------------------------------------
  */

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

  /*
  ----------------------------------------------
  PRIMEIRO: CASOS ESPECÍFICOS
  ----------------------------------------------
  */

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

  /*
  ----------------------------------------------
  PADRÕES GERAIS
  ----------------------------------------------
  */

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

  /*
  Se encontrou os dois na mesma alteração,
  deixamos como alteração.
  */

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

  /*
  ----------------------------------------------
  1. Tenta encontrar <li>
  ----------------------------------------------
  */

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

  /*
  ----------------------------------------------
  2. Se não encontrou <li>, tenta <p>
  ----------------------------------------------
  */

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

  /*
  ----------------------------------------------
  3. Último recurso:
     usa o texto inteiro
  ----------------------------------------------
  */

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
CRIA LISTAS DE BUFFS / NERFS / ALTERAÇÕES
==================================================
*/

function separarMudancas(hero, mudancas) {
  const resultado = [];

  for (const mudanca of mudancas) {
    const tipo = classificarMudanca(mudanca);

    resultado.push({
      hero: hero,
      tipo: tipo,
      change: mudanca
    });
  }

  return resultado;
}

/*
==================================================
CRIA TEXTO PARA O DISCORD
==================================================
*/

function criarTexto(lista) {
  if (lista.length === 0) {
    return "Nenhum resultado encontrado nesta atualização.";
  }

  let texto = "";

  let ultimoHeroi = "";

  lista.forEach((item) => {

    /*
    Só mostra o nome do herói quando muda.
    */

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
DIVIDE TEXTO EM PARTES
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
OBTER DADOS DA BLIZZARD
==================================================
*/

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
  ----------------------------------------------
  LISTA DE HERÓIS
  ----------------------------------------------
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
  ----------------------------------------------
  TODAS AS ALTERAÇÕES
  ----------------------------------------------
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

    /*
    Encontra o próximo título.

    Isso delimita o bloco desse herói.
    */

    const proximoTitulo =
      /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i.exec(
        depoisHeroi
      );

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

    /*
    Extrai cada alteração individual.
    */

    const mudancas =
      extrairMudancas(trecho);

    /*
    Classifica cada alteração.
    */

    const classificadas =
      separarMudancas(
        nome,
        mudancas
      );

    /*
    Adiciona ao conjunto geral.
    */

    todasMudancas.push(
      ...classificadas
    );
  }

  /*
  ==================================================
  SEPARAÇÃO FINAL
  ==================================================
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
  ==================================================
  TEXTOS
  ==================================================
  */

  const buffsTexto =
    criarTexto(buffs);

  const nerfsTexto =
    criarTexto(nerfs);

  const alteracoesTexto =
    criarTexto(alteracoes);

  /*
  ==================================================
  PARTES
  ==================================================
  */

  const buffsPartes =
    dividirTexto(buffsTexto);

  const nerfsPartes =
    dividirTexto(nerfsTexto);

  const alteracoesPartes =
    dividirTexto(alteracoesTexto);

  /*
  ==================================================
  NOME DO PATCH
  ==================================================
  */

  let patch = "Patch Notes";

  if (indiceHerois > 0) {
    patch =
      titulos[indiceHerois - 1];
  }

  /*
  ==================================================
  RESPOSTA DA API
  ==================================================
  */

  return {

    status: "ok",

    blizzardStatus:
      response.status,

    patch: patch,

    /*
    Dados individuais
    */

    todasMudancas:
      todasMudancas,

    buffs:
      buffs,

    nerfs:
      nerfs,

    alteracoes:
      alteracoes,

    /*
    Textos prontos para Discord
    */

    buffsTexto:
      buffsTexto,

    nerfsTexto:
      nerfsTexto,

    alteracoesTexto:
      alteracoesTexto,

    /*
    Partes para mensagens grandes
    */

    buffsPartes:
      buffsPartes,

    nerfsPartes:
      nerfsPartes,

    alteracoesPartes:
      alteracoesPartes,

    /*
    Quantidades
    */

    quantidadeDeMudancas:
      todasMudancas.length,

    quantidadeDeBuffs:
      buffs.length,

    quantidadeDeNerfs:
      nerfs.length,

    quantidadeDeAlteracoes:
      alteracoes.length,

    quantidadeDePartesBuffs:
      buffsPartes.length,

    quantidadeDePartesNerfs:
      nerfsPartes.length,

    quantidadeDePartesAlteracoes:
      alteracoesPartes.length,

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
      ----------------------------------------------
      ROTA /
      ----------------------------------------------
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
      ----------------------------------------------
      TESTE DA BLIZZARD
      ----------------------------------------------
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
      ----------------------------------------------
      ROTA /dados
      ----------------------------------------------
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
      ----------------------------------------------
      ROTA NÃO ENCONTRADA
      ----------------------------------------------
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
);
