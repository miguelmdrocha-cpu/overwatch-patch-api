const http = require("http");

const PORT = process.env.PORT || 10000;


/*
==========================================================
LIMPEZA DE HTML
==========================================================
*/

function limparHTML(texto) {
  return texto
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]*>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/gi, (_, n) =>
      String.fromCharCode(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    )
    .replace(/\s+/g, " ")
    .trim();
}


/*
==========================================================
NORMALIZA TEXTO
==========================================================
*/

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}


/*
==========================================================
EXTRAI TÍTULOS DA PÁGINA
==========================================================
*/

function extrairTitulos(html) {
  const titulos = [];

  const regex =
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const texto =
      limparHTML(match[1]);

    if (
      texto &&
      !titulos.includes(texto)
    ) {
      titulos.push(texto);
    }
  }

  return titulos;
}


/*
==========================================================
CLASSIFICA BUFF / NERF / ALTERAÇÃO
==========================================================
*/

function classificarMudanca(texto) {

  const t =
    normalizar(texto);


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
    "cooldown aumentou",

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
      palavra =>
        t.includes(
          normalizar(palavra)
        )
    )
  ) {
    return "buff";
  }


  if (
    nerfsEspecificos.some(
      palavra =>
        t.includes(
          normalizar(palavra)
        )
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
      palavra =>
        t.includes(
          normalizar(palavra)
        )
    );


  const encontrouNerf =
    palavrasNerf.some(
      palavra =>
        t.includes(
          normalizar(palavra)
        )
    );


  if (
    encontrouBuff &&
    encontrouNerf
  ) {
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
==========================================================
VERIFICA SE UM TEXTO PARECE SER UMA MUDANÇA
==========================================================
*/

function pareceMudanca(texto) {

  const t =
    normalizar(texto);


  const palavras = [

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

    "redução",
    "reduzir",

    "diminuiu",
    "diminuido",
    "diminuída",
    "diminuição",

    "aumenta",
    "diminui",

    "melhorado",
    "melhorada",

    "dano",
    "cura",
    "vida",
    "recarga",
    "intervalo",
    "duracao",
    "duração",
    "velocidade",
    "municao",
    "munição",
    "alcance",
    "raio",

    "corrigido",
    "corrigida",
    "corrigidos",
    "corrigidas",

    "correção",
    "correcao"
  ];


  return palavras.some(
    palavra =>
      t.includes(
        normalizar(palavra)
      )
  );
}


/*
==========================================================
VERIFICA SE O TEXTO PARECE SER NOME DE HABILIDADE
==========================================================
*/

function pareceNomeDeHabilidade(texto) {

  if (!texto) {
    return false;
  }


  const t =
    texto.trim();


  if (
    t.length < 2 ||
    t.length > 100
  ) {
    return false;
  }


  /*
    Se parece claramente uma mudança,
    não deve ser tratado como habilidade.
  */

  if (
    pareceMudanca(t)
  ) {
    return false;
  }


  /*
    Evita textos que são claramente
    comentários ou frases longas.
  */

  if (
    t.endsWith(".") ||
    t.endsWith(":")
  ) {
    return false;
  }


  const palavrasIgnoradas = [

    "comentários dos desenvolvedores",
    "comentarios dos desenvolvedores",

    "notas dos desenvolvedores",
    "notas dos desenvolvedores",

    "observação",
    "observacao",

    "observações",
    "observacoes",

    "geral",

    "correções",
    "correcoes",

    "correção de problemas",
    "correcao de problemas"
  ];


  if (
    palavrasIgnoradas.includes(
      normalizar(t)
    )
  ) {
    return false;
  }


  return true;
}


/*
==========================================================
EXTRAI AS MUDANÇAS JUNTO COM HABILIDADE/ARMA
==========================================================
*/

function extrairMudancas(trecho) {

  const mudancas = [];


  /*
    Primeiro pegamos todos os elementos que podem
    representar o nome de uma habilidade.

    A posição é importante porque depois associamos
    cada mudança ao último nome encontrado antes dela.
  */

  const marcadores = [];


  /*
    H1 até H6
  */

  const regexTitulos =
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;

  let tituloMatch;


  while (
    (tituloMatch =
      regexTitulos.exec(trecho)) !== null
  ) {

    const texto =
      limparHTML(
        tituloMatch[1]
      );


    if (
      pareceNomeDeHabilidade(
        texto
      )
    ) {

      marcadores.push({

        texto:
          texto,

        inicio:
          tituloMatch.index,

        prioridade:
          3
      });
    }
  }


  /*
    STRONG
  */

  const regexStrong =
    /<strong[^>]*>([\s\S]*?)<\/strong>/gi;

  let strongMatch;


  while (
    (strongMatch =
      regexStrong.exec(trecho)) !== null
  ) {

    const texto =
      limparHTML(
        strongMatch[1]
      );


    if (
      pareceNomeDeHabilidade(
        texto
      )
    ) {

      marcadores.push({

        texto:
          texto,

        inicio:
          strongMatch.index,

        prioridade:
          2
      });
    }
  }


  /*
    BOLD <b>
  */

  const regexBold =
    /<b[^>]*>([\s\S]*?)<\/b>/gi;

  let boldMatch;


  while (
    (boldMatch =
      regexBold.exec(trecho)) !== null
  ) {

    const texto =
      limparHTML(
        boldMatch[1]
      );


    if (
      pareceNomeDeHabilidade(
        texto
      )
    ) {

      marcadores.push({

        texto:
          texto,

        inicio:
          boldMatch.index,

        prioridade:
          1
      });
    }
  }


  /*
    Ordena os marcadores pela posição no HTML.
  */

  marcadores.sort(
    (a, b) =>
      a.inicio - b.inicio
  );


  /*
    Remove marcadores duplicados
    muito próximos.
  */

  const marcadoresFiltrados = [];


  for (
    const marcador
    of marcadores
  ) {

    const ultimo =
      marcadoresFiltrados[
        marcadoresFiltrados.length - 1
      ];


    if (
      ultimo &&
      normalizar(
        ultimo.texto
      ) ===
      normalizar(
        marcador.texto
      )
    ) {

      /*
        Se for o mesmo texto, ficamos com
        o marcador de maior prioridade.
      */

      if (
        marcador.prioridade >
        ultimo.prioridade
      ) {

        marcadoresFiltrados[
          marcadoresFiltrados.length - 1
        ] = marcador;
      }

      continue;
    }


    marcadoresFiltrados.push(
      marcador
    );
  }


  /*
    Função para descobrir qual é a habilidade
    imediatamente anterior à mudança.
  */

  function encontrarHabilidade(
    posicao
  ) {

    let habilidade =
      null;


    for (
      const marcador
      of marcadoresFiltrados
    ) {

      if (
        marcador.inicio <
        posicao
      ) {

        habilidade =
          marcador.texto;

      } else {

        break;
      }
    }


    return habilidade;
  }


  /*
    Primeiro tentamos <li>, porque normalmente
    as alterações estão em listas.
  */

  const regexLi =
    /<li[^>]*>([\s\S]*?)<\/li>/gi;

  let matchLi;

  let encontrouLi =
    false;


  while (
    (matchLi =
      regexLi.exec(trecho)) !== null
  ) {

    encontrouLi =
      true;


    const texto =
      limparHTML(
        matchLi[1]
      );


    if (
      !texto ||
      texto.length < 5
    ) {
      continue;
    }


    /*
      Evita pegar itens que são apenas
      containers internos sem alteração.
    */

    if (
      !pareceMudanca(texto)
    ) {
      continue;
    }


    const habilidade =
      encontrarHabilidade(
        matchLi.index
      );


    const duplicado =
      mudancas.some(
        item =>
          item.change === texto &&
          item.habilidade ===
            habilidade
      );


    if (!duplicado) {

      mudancas.push({

        habilidade:
          habilidade,

        change:
          texto
      });
    }
  }


  /*
    Se não houver <li>, usamos <p>.
  */

  if (
    !encontrouLi ||
    mudancas.length === 0
  ) {

    const regexP =
      /<p[^>]*>([\s\S]*?)<\/p>/gi;

    let matchP;


    while (
      (matchP =
        regexP.exec(trecho)) !== null
    ) {

      const texto =
        limparHTML(
          matchP[1]
        );


      if (
        !texto ||
        texto.length < 5
      ) {
        continue;
      }


      if (
        !pareceMudanca(texto)
      ) {
        continue;
      }


      const habilidade =
        encontrarHabilidade(
          matchP.index
        );


      const duplicado =
        mudancas.some(
          item =>
            item.change === texto &&
            item.habilidade ===
              habilidade
        );


      if (!duplicado) {

        mudancas.push({

          habilidade:
            habilidade,

          change:
            texto
        });
      }
    }
  }


  /*
    FALLBACK:
    Se a estrutura da página mudar e não encontrarmos
    <li> ou <p>, ainda retornamos o texto bruto.
  */

  if (
    mudancas.length === 0
  ) {

    const texto =
      limparHTML(
        trecho
      );


    if (texto) {

      mudancas.push({

        habilidade:
          null,

        change:
          texto
      });
    }
  }


  return mudancas;
}


/*
==========================================================
SEPARA AS MUDANÇAS
==========================================================
*/

function separarMudancas(
  hero,
  mudancas
) {

  const resultado = [];


  for (
    const mudanca
    of mudancas
  ) {

    resultado.push({

      hero:
        hero,

      habilidade:
        mudanca.habilidade ||
        null,

      tipo:
        classificarMudanca(
          mudanca.change
        ),

      change:
        mudanca.change
    });
  }


  return resultado;
}


/*
==========================================================
CRIA TEXTO PARA O DISCORD
==========================================================
*/

function criarTexto(lista) {

  if (
    lista.length === 0
  ) {

    return (
      "Nenhum resultado encontrado nesta atualização."
    );
  }


  let texto = "";

  let ultimoHeroi = "";


  lista.forEach(
    (item) => {

      if (
        item.hero !==
        ultimoHeroi
      ) {

        if (
          texto !== ""
        ) {

          texto +=
            "\n";
        }


        texto +=
          `🦸 **${item.hero}**\n`;


        ultimoHeroi =
          item.hero;
      }


      /*
        Se temos o nome da habilidade,
        mostramos:

        🟢 **Flecha da Tempestade** —
        Duração aumentada...
      */

      let linha;


      if (
        item.habilidade
      ) {

        linha =
          `**${item.habilidade}** — ${item.change}`;

      } else {

        linha =
          item.change;
      }


      if (
        item.tipo ===
        "buff"
      ) {

        texto +=
          `🟢 ${linha}\n`;

      }

      else if (
        item.tipo ===
        "nerf"
      ) {

        texto +=
          `🔴 ${linha}\n`;

      }

      else {

        texto +=
          `⚪ ${linha}\n`;
      }
    }
  );


  return texto.trim();
}


/*
==========================================================
TEXTO DAS CORREÇÕES
==========================================================
*/

function criarTextoCorrecoes(
  lista
) {

  if (
    lista.length === 0
  ) {

    return (
      "Nenhuma correção encontrada nesta atualização."
    );
  }


  return lista
    .map(
      item =>
        `🔧 ${item}`
    )
    .join("\n");
}


/*
==========================================================
DIVIDE TEXTOS GRANDES
==========================================================
*/

function dividirTexto(
  texto,
  limite = 3500
) {

  const partes = [];

  let atual = "";


  const blocos =
    texto.split("\n\n");


  for (
    const bloco
    of blocos
  ) {

    if (
      (
        atual +
        "\n\n" +
        bloco
      ).length >
      limite
    ) {

      if (
        atual.length > 0
      ) {

        partes.push(
          atual.trim()
        );
      }


      atual =
        bloco;

    } else {

      atual +=
        (
          atual
            ? "\n\n"
            : ""
        ) +
        bloco;
    }
  }


  if (
    atual.length > 0
  ) {

    partes.push(
      atual.trim()
    );
  }


  return partes;
}


/*
==========================================================
EXTRAI UMA SEÇÃO PELO TÍTULO
==========================================================
*/

function extrairSecaoPorTitulo(
  html,
  tituloProcurado
) {

  const regexTitulo =
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;

  let match;


  while (
    (match =
      regexTitulo.exec(html)) !== null
  ) {

    const titulo =
      limparHTML(
        match[1]
      );


    if (
      normalizar(titulo) ===
      normalizar(tituloProcurado)
    ) {

      const inicio =
        match.index +
        match[0].length;


      const restante =
        html.substring(
          inicio
        );


      const proximoTitulo =
        /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i
          .exec(restante);


      if (
        proximoTitulo
      ) {

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
==========================================================
ESCAPA TEXTO PARA REGEX
==========================================================
*/

function escaparRegex(
  texto
) {

  return texto.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


/*
==========================================================
ENCONTRA O BLOCO DE UM HERÓI
==========================================================
*/

function extrairBlocoHeroi(
  html,
  nomeHeroi,
  nomesHerois
) {

  const regexHeroi =
    new RegExp(
      `<h[1-6][^>]*>\\s*${escaparRegex(
        nomeHeroi
      )}\\s*<\\/h[1-6]>`,
      "i"
    );


  const matchHeroi =
    regexHeroi.exec(
      html
    );


  if (
    !matchHeroi
  ) {
    return "";
  }


  const inicio =
    matchHeroi.index +
    matchHeroi[0].length;


  const depoisHeroi =
    html.substring(
      inicio
    );


  /*
    IMPORTANTE:

    Não usamos simplesmente o próximo <h>,
    porque esse próximo <h> pode ser justamente
    o nome de uma habilidade.

    Procuramos especificamente o próximo HERÓI.
  */

  let fim =
    depoisHeroi.length;


  for (
    const outroHeroi
    of nomesHerois
  ) {

    if (
      outroHeroi ===
      nomeHeroi
    ) {
      continue;
    }


    const regexOutro =
      new RegExp(
        `<h[1-6][^>]*>\\s*${escaparRegex(
          outroHeroi
        )}\\s*<\\/h[1-6]>`,
        "i"
      );


    const matchOutro =
      regexOutro.exec(
        depoisHeroi
      );


    if (
      matchOutro &&
      matchOutro.index <
        fim
    ) {

      fim =
        matchOutro.index;
    }
  }


  /*
    Também encerramos quando chegamos a
    uma seção geral importante.
  */

  const secoesFinais = [

    "Correção de problemas",
    "Correcoes de problemas",

    "Notas do patch",
    "Notas de atualização",

    "Atualizações gerais",
    "Atualizacoes gerais"
  ];


  for (
    const secao
    of secoesFinais
  ) {

    const regexSecao =
      new RegExp(
        `<h[1-6][^>]*>\\s*${escaparRegex(
          secao
        )}\\s*<\\/h[1-6]>`,
        "i"
      );


    const matchSecao =
      regexSecao.exec(
        depoisHeroi
      );


    if (
      matchSecao &&
      matchSecao.index <
        fim
    ) {

      fim =
        matchSecao.index;
    }
  }


  return depoisHeroi.substring(
    0,
    fim
  );
}


/*
==========================================================
OBTÉM TODOS OS DADOS DA BLIZZARD
==========================================================
*/

async function obterDados() {

  const response =
    await fetch(
      "https://overwatch.blizzard.com/pt-br/news/patch-notes/"
    );


  const html =
    await response.text();


  if (
    !response.ok
  ) {

    throw new Error(
      `Blizzard respondeu com status ${response.status}`
    );
  }


  const titulos =
    extrairTitulos(
      html
    );


  const indiceHerois =
    titulos.findIndex(
      titulo =>
        normalizar(titulo) ===
        normalizar(
          "Atualizações dos heróis"
        )
    );


  const indiceCorrecoes =
    titulos.findIndex(
      titulo =>
        normalizar(titulo) ===
        normalizar(
          "Correção de problemas"
        )
    );


  /*
    LISTA DOS HERÓIS
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
    "
