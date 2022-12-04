const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();
var moment = require('moment');
const axios = require('axios');
const schedule = require('node-schedule');
const { WAWebJS, Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const pornModulo = require('./bot_modules/porn');

let time = 20000;
let token = '';

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "client-one" }),
  // puppeteer: {
  //   executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  // }
});

let db = new sqlite3.Database('./db/dados.db3', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database.');
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.initialize();

client.on('message', message => {

  pornModulo.getVideo(client, message, db);

  return;

  if (message.from == '558399506299-1405780291@g.us' && (message.body.toLowerCase().includes("raio") || message.body.includes("⚡"))) {
    db.serialize(() => {
      let sql = `SELECT Valor FROM Outros WHERE Key = 'Raio';`;

      db.get(sql, (err, row) => {
        if (err) {
          return console.error(err.message);
        }
        db.run("UPDATE Outros SET Valor = (Valor + 1) WHERE Key = 'Raio'", function (err) {
          if (err) {
            return console.error(err.message);
          }
        });
        message.reply(`⚡ Um integrante desse grupo já deu mais ou menos uns ${row.Valor + 1} raios.`)
      });
    });
  }

  if (message.from == '558399506299-1405780291@g.us' && (message.body.toLowerCase().includes("burro") || message.body.toLowerCase().includes("jumento") || message.body.toLowerCase().includes("lula"))) {
    const fig = MessageMedia.fromFilePath('lula.webp');
    client.sendMessage(message.from, fig, { sendMediaAsSticker: true });
  }

  if (message.body === '/proximojogo') {
    getJogo(client, message, true);
  }

  if (message.body === '/aisabe') {
    AiSabe(message);
  }

  if (message.body.startsWith('/jogo ')) {
    let tmp = message.body.split(' ');
    if (tmp.length != 2) return message.reply(`❌ Comando está errado, utilize */jogo 'ID'*, sem aspas.`);
    var idJogo = tmp[1];
    if (!isNumeric(idJogo)) return message.reply(`❌ O ID do jogo precisa ser um número */jogo 'ID'*, sem aspas.`);
    getJogo(client, message, true, idJogo)
  }

  if (message.body == '/jogo' || message.body == '/j') {
    db.serialize(() => {
      db.each(`SELECT DATETIME(DateUtc) AS DataHora, MatchNumber, HomeTeamScore, AwayTeamScore FROM Jogos WHERE DATETIME(DateUtc) > DATETIME(DATETIME('NOW', '-5 HOURS'), '-5 MINUTES') LIMIT 2;`, (err, jogo) => {
        if (err) {
          console.error(err.message);
        }
        getJogo(client, message, true, jogo.MatchNumber)
      });
    });
  }

  // if (message.body === '/jogos') {
  //   db.serialize(() => {
  //     var sqlJogos = `SELECT * FROM Jogos `;
  //     db.all(sqlJogos, (err, rows) => {
  //       if (err) {
  //         console.error(err.message);
  //       }
  //       var r = "🏆 Troféu Ai Sabe 🏆\n\n";
  //       r += "\n\n*Jogos:*\n";

  //       rows.forEach((row) => {
  //         if (getBandeira(row.HomeTeam) != '') {
  //           r += getBandeira(row.HomeTeam) + " " + row.HomeTeam + " x " + row.AwayTeam + " " + getBandeira(row.AwayTeam);
  //           r += "\n🗓️ " + moment(row.DateUtc).format("DD/MM/YYYY [às] HH:mm");
  //           r += "\n🆔 " + row.MatchNumber + "\n\n";
  //         }
  //       });

  //       message.reply(r);
  //     });
  //   });
  // }

  if (message.body === '/oitavas') {
    db.serialize(() => {
      var sqlJogos = `SELECT * FROM Jogos WHERE RoundNumber = 4`;
      db.all(sqlJogos, (err, rows) => {
        if (err) {
          console.error(err.message);
        }
        var r = "🏆 Troféu Ai Sabe 🏆\n\n";
        r += "\n\n*Oitavas*\n";

        rows.forEach((row) => {
          if (getBandeira(row.HomeTeam) != '') {
            r += getBandeira(row.HomeTeam) + " " + row.HomeTeam + " x " + row.AwayTeam + " " + getBandeira(row.AwayTeam);
            r += "\n🗓️ " + moment(row.DateUtc).format("DD/MM/YYYY [às] HH:mm");
            r += "\n🆔 " + row.MatchNumber + "\n\n";
          }
        });

        message.reply(r);
      });
    });
  }

  if (message.body === '/tabela') {
    // atualizarTabela();
    db.serialize(() => {
      var sqlJogos = `SELECT Usuarios.Apelido, Usuarios.Codigo,
      SUM(CASE WHEN 
              Palpites.MatchNumber = Jogos.MatchNumber AND
              Palpites.GolsHomeTime = Jogos.HomeTeamScore AND
              Palpites.GolsForaTime = Jogos.AwayTeamScore AND
              Usuarios.Codigo = Palpites.CodUsuario
          THEN 1 ELSE 0 END) Pontos
      
      FROM Usuarios
      INNER JOIN Palpites ON Palpites.CodUsuario = Usuarios.Codigo
      INNER JOIN Jogos ON Jogos.MatchNumber = Palpites.MatchNumber
      GROUP BY Usuarios.Codigo
      ORDER BY Pontos DESC`;

      db.all(sqlJogos, (err, rows) => {
        if (err) {
          console.error(err.message);
        }
        rows.forEach((usuario) => {
          var sql = `UPDATE Usuarios SET Pontos = ${rows[0]} WHERE Codigo = '${rows["Codigo"]}'`;
          db.run(`UPDATE Usuarios SET Pontos = ${usuario.Pontos} WHERE Codigo = '${usuario.Codigo}'`);
        });
        var r = "🏆 Troféu Ai Sabe 🏆\n\n";
        r += "*Tabela de pontos*\n";
        var countPos = 0;
        rows.forEach((row) => {
          if (countPos == 0) r += "🥇 ";
          else if (countPos == 1) r += "🥈 ";
          else if (countPos == 2) r += "🥉 ";
          else if (countPos == rows.length - 1) r += "🔦 ";
          else r += "➡️ ";
          r += `${row.Apelido} - ${row.Pontos} Pontos\n`;
          countPos++;

        });
        message.reply(r);
      });
    });
  }

  if (message.body === '/jogosdia') {
    // getJogo(client, message, true, undefined, true)
    db.serialize(() => {
      let sql = "SELECT * FROM Jogos WHERE DATE(DateUtc) = DATE('now')";
      db.all(sql, (err, row) => {
        if (err) {
          console.error(err.message);
        }

        var r = "🏆 Troféu Ai Sabe 🏆\n\n";
        row.forEach((row) => {

          r += getBandeira(row.HomeTeam) + " " + row.HomeTeam;

          if (row.HomeTeamScore != null) r += ` ${row.HomeTeamScore} x ${row.AwayTeamScore} `;
          else r += " x ";

          r += row.AwayTeam + " " + getBandeira(row.AwayTeam);

          r += "\n🗓️ " + moment(row.DateUtc).format("DD/MM/YYYY [às] HH:mm");
          r += "\n🆔 " + row.MatchNumber;
          r += "\n\n"
        });
        message.reply(r);
      });
    });
  }

  if (message.body.startsWith('/c ')) {
    let apelidoTmp = message.body.split(' ');

    apelidoTmp[0] = '';
    let apelido = apelidoTmp.join(" ").trim();

    db.serialize(() => {
      var user = message.author != undefined ? user = message.author : user = message.from;
      db.get(`SELECT * FROM Usuarios WHERE Codigo = '${user}'`, (err, row) => {
        if (err) {
          return console.log(err.message);
        }
        if (row == undefined) {
          message.getContact().then((response) => {
            var sql = `INSERT INTO Usuarios (Codigo, Apelido, Nome) VALUES ('${user}', '${apelido}', '${response.name}' )`;

            db.run(sql, function (err) {
              if (err) {
                return console.log(err.message);
              }
              // get the last insert id
              console.log(`${moment()} - Cadastrado [${apelido}] [${user}]`);
              message.reply(`✅ Agora vc está cadastrado, seu apelido será *${apelido}*\n\nFique a vontade pra palpitar.`);
            });
          });
        } else {
          message.reply(`Irmão, vc já está cadastrado, ta pensando que é bagunça!?\n\n*${row.Apelido}*\n\n😡 Seu bostinha`);
        }

      });
    });
  }

  if (message.body.startsWith('/bet ')) {
    let tmp = message.body.toLowerCase().split(' ');
    if (tmp.length != 3) return message.reply(`❌ Ta faltando alguma informação ai, tem que ter 'ID' e o placar com dois números separados por X.\nExemplo /bet ${idJogo} 1x1`);

    var idJogo = tmp[1].trim();

    var placar = tmp[2].split('x');
    if (placar.length != 2) return message.reply(`❌ O placar escolhido ta errado, tem que ser dois números separados por X.\nExemplo /bet ${idJogo} 1x1`);

    var placar1 = placar[0].trim();
    var placar2 = placar[1].trim();

    if (!isNumeric(placar1)) return message.reply(`❌ O placar escolhido ta errado, tem que ser dois números separados por X.\nExemplo /bet ${idJogo} 1x1`);
    if (!isNumeric(placar2)) return message.reply(`❌ O placar escolhido ta errado, tem que ser dois números separados por X.\nExemplo /bet ${idJogo} 1x1`);

    db.serialize(() => {
      var user = message.author != undefined ? user = message.author : user = message.from;
      db.get(`SELECT * FROM Jogos WHERE MatchNumber = ${idJogo}`, (err, row) => {
        if (err) {
          return console.log(err.message);
        }

        if (row == undefined) return message.reply("Esse jogo não existe, use o comando */jogos* para ver todos os jogos disponiveis.");

        if (!moment().isAfter(moment(row.DateUtc).subtract(12, 'hours'))) {
          return message.reply("❌ Os palpites para esse jogo ainda não foram aberto.\n\nOs palpites abrem em " + moment(row.DateUtc).subtract(12, 'hours').format('DD/MM/YYYY [às] HH:mm') + "\n\n⚠️ Você só pode palpitar nos jogos do dia.\nUse */jogosdia* para saber quais jogos estão abertos.");
        }
        if (moment() > moment(row.DateUtc)) return message.reply("⚠️ O jogo já começou, infelizmente os palpites estão encerrados.");

        db.get(`SELECT * FROM Usuarios WHERE Codigo = '${user}'`, (err, row) => {
          if (err) {
            return console.log(err.message);
          }
          if (row != undefined) {
            db.get(`SELECT * FROM Palpites WHERE CodUsuario = '${user}' AND MatchNumber = ${idJogo}`, (err, row) => {
              if (err) {
                return console.log(err.message);
              }
              if (row == undefined) {
                var sql = `INSERT INTO Palpites (CodUsuario, MatchNumber, GolsHomeTime, GolsForaTime) VALUES ('${user}', ${idJogo}, ${placar1}, ${placar2} )`;
                db.run(sql, function (err) {
                  if (err) {
                    return console.log(err.message);
                  }
                  // get the last insert id
                  console.log(`${moment()} - Palpite [${user}]`);
                  message.reply(`✅ Palpite para o jogo foi cadastrado.\nTorça pra acertar.`);
                  getJogo(client, message, false, idJogo);
                });
              } else {
                var sql = `UPDATE Palpites SET GolsHomeTime =  ${placar1}, GolsForaTime = ${placar2} WHERE CodUsuario = '${user}' AND MatchNumber = ${idJogo}`;
                db.run(sql, function (err) {
                  if (err) {
                    return console.log(err.message);
                  }
                  // get the last insert id
                  console.log(`${moment()} - Palpite [${user}]`);
                  message.reply(`✅ Palpite para o próximo jogo foi atualizado.`);
                  getJogo(client, message, false, idJogo);
                });
              }
            });
          } else {
            message.reply(`Irmão, vc ainda não está cadastrado, por favor, use o comando /c {Apelido} para se cadastrar.`);
          }

        });
      });
    });
  }

  if (message.body === ('/eunaosei')) {
    db.serialize(() => {
      var user = message.author != undefined ? user = message.author : user = message.from;
      db.get(`SELECT * FROM Jogos WHERE date(DateUtc) >= date('now') ORDER BY DateUtc LIMIT 1`, (err, rowJogo) => {
        if (err) {
          return console.log("SELECT Proximo Jogo -> " + err.message);
        }
        db.get(`SELECT * FROM Usuarios WHERE Codigo = '${user}'`, (err, row) => {
          if (err) {
            return console.log("SELECT Usuario -> " + err.message);
          }
          if (row != undefined) {
            db.get(`SELECT * FROM Palpites WHERE CodUsuario = '${user}' AND MatchNumber = ${rowJogo.MatchNumber}`, (err, row) => {
              if (err) {
                return console.log("SELECT Palpite -> " + err.message);
              }

              var t1 = Math.floor(Math.random() * 15);
              var t2 = Math.floor(Math.random() * 15);

              if (row == undefined) {

                var sql = `INSERT INTO Palpites (CodUsuario, MatchNumber, GolsHomeTime, GolsForaTime) VALUES ('${user}', ${rowJogo.MatchNumber}, ${t1}, ${t2} )`;
                db.run(sql, function (err) {
                  if (err) {
                    return console.log("INSERT Palpite -> " + err.message);
                  }
                  // get the last insert id
                  console.log(`${moment().format("YYYY-MM-DD")} - Palpite [${user}]`);
                  message.reply(`✅ Palpite para o próximo jogo foi cadastrado com placares aleatórios KKKKKKKK Foda-se.`);
                  getJogo(client, message, false, rowJogo.MatchNumber);
                });
              } else {
                var sql = `UPDATE Palpites SET GolsHomeTime =  ${t1}, GolsForaTime = ${t2} WHERE CodUsuario = '${user}' AND MatchNumber = ${rowJogo.MatchNumber}`;
                db.run(sql, function (err) {
                  if (err) {
                    return console.log("UPDATE Palpite -> " + err.message);
                  }
                  // get the last insert id
                  console.log(`${moment().format("YYYY-MM-DD")} - Palpite [${user}]`);
                  message.reply(`✅ Palpite para o próximo jogo foi cadastrado com placares aleatórios KKKKKKKK Foda-se.`);
                  getJogo(client, message, false, rowJogo.MatchNumber);
                });
              }
            });
          } else {
            message.reply(`Irmão, vc ainda não está cadastrado, por favor, use o comando /c {Apelido} para se cadastrar.`);
          }

        });
      });
    });
  }

  if (message.body.startsWith('/minhasbets')) {
    db.serialize(() => {
      var user = message.author != undefined ? user = message.author : user = message.from;

      let sql = `SELECT 
      (SELECT Apelido FROM Usuarios WHERE Codigo = '${user}') AS Apelido,
      MatchNumber, Jogos.HomeTeam, Jogos.AwayTeam, Jogos.HomeTeamScore, Jogos.AwayTeamScore, Jogos.DateUtc,
      (SELECT GolsHomeTime FROM Palpites WHERE CodUsuario = '${user}' AND Palpites.MatchNumber = Jogos.MatchNumber ) AS GolsHomeTime,
      (SELECT GolsForaTime FROM Palpites WHERE CodUsuario = '${user}' AND Palpites.MatchNumber = Jogos.MatchNumber ) AS GolsForaTime
      FROM Jogos WHERE DATE(DateUtc) <= DATE('now', '-3 hour');`;

      db.all(sql, (err, row) => {
        if (err) {
          console.error(err.message);
        }

        var r = "🏆 Troféu Ai Sabe 🏆\n\n";
        var palpites = '\n\n*Palpites:*';
        var naoPalpitadosGeral = "\n*Não palpitou em:*"
        var palpitesAbertos = '\n\n*Palpites em aberto:*';
        var naoPalpitados = '\n\n*Ainda não palpitados:*';

        var contJogos = row.length;
        var pontos = 0;
        var contApostas = 0;

        row.forEach((rowJogo) => {
          contApostas++;
          if (moment().isAfter(rowJogo.DateUtc)) {
            if (rowJogo.GolsHomeTime != null) {
              palpites += '\n';
              if (rowJogo.GolsHomeTime == rowJogo.HomeTeamScore && rowJogo.GolsForaTime == rowJogo.AwayTeamScore) {
                palpites += "✅ ";
                pontos++;
              } else {
                palpites += "❌ ";
              }
              palpites += getBandeira(rowJogo.HomeTeam) + " " + rowJogo.HomeTeam;
              palpites += ` ${rowJogo.GolsHomeTime} x ${rowJogo.GolsForaTime} `;
              palpites += rowJogo.AwayTeam + " " + getBandeira(rowJogo.AwayTeam);
            } else {
              naoPalpitadosGeral += '\n';
              naoPalpitadosGeral += "🤦‍♂️ ";
              naoPalpitadosGeral += getBandeira(rowJogo.HomeTeam) + " " + rowJogo.HomeTeam;
              naoPalpitadosGeral += ` x `;
              naoPalpitadosGeral += rowJogo.AwayTeam + " " + getBandeira(rowJogo.AwayTeam);
            }
          } else {
            if (rowJogo.GolsHomeTime != null) {
              palpitesAbertos += '\n';
              palpitesAbertos += "➡️ ";
              palpitesAbertos += getBandeira(rowJogo.HomeTeam) + " " + rowJogo.HomeTeam;
              palpitesAbertos += ` ${rowJogo.GolsHomeTime} x ${rowJogo.GolsForaTime} `;
              palpitesAbertos += rowJogo.AwayTeam + " " + getBandeira(rowJogo.AwayTeam);
            } else {
              naoPalpitados += "\n";
              naoPalpitados += getBandeira(rowJogo.HomeTeam) + " " + rowJogo.HomeTeam;
              naoPalpitados += " x ";
              naoPalpitados += rowJogo.AwayTeam + " " + getBandeira(rowJogo.AwayTeam);

              naoPalpitados += "\n🗓️ " + moment(rowJogo.DateUtc).format("DD/MM/YYYY [às] HH:mm");
              naoPalpitados += "\n🆔 " + rowJogo.MatchNumber;
              naoPalpitados += "\n\n"
            }
          }
        });

        r += "*Estatísticas:*\n"
        r += `${row[0].Apelido} tem ${pontos} pontos, palpitou em ${Math.round((contApostas / contJogos) * 100)}% dos jogos e acertou em ${Math.round((pontos / contJogos) * 100)}% deles.`

        r += palpites;
        r += naoPalpitadosGeral;
        r += palpitesAbertos;
        r += naoPalpitados;

        message.reply(r);
      });
    });
  }

  // Admin
  if (message.body.startsWith('/attjogo ')) {
    var user = message.author != undefined ? user = message.author : user = message.from;
    let admins = "558386768721@c.us;558381881161@c.us";
    if (!admins.includes(user)) return;
    let tmp = message.body.toLowerCase().split(' ');
    if (tmp.length != 3) return message.reply(`❌ Ta faltando alguma informação ai, tem que ter 'ID' e o placar com dois números separados por X.\nExemplo /bet ${idJogo} 1x1`);

    var idJogo = tmp[1].trim();

    var placar = tmp[2].split('x');
    if (placar.length != 2) return message.reply(`❌ O placar escolhido ta errado, tem que ser dois números separados por X.\nExemplo /bet ${idJogo} 1x1`);

    var placar1 = placar[0].trim();
    var placar2 = placar[1].trim();

    if (!isNumeric(placar1)) return message.reply(`❌ O placar escolhido ta errado, tem que ser dois números separados por X.\nExemplo /bet ${idJogo} 1x1`);
    if (!isNumeric(placar2)) return message.reply(`❌ O placar escolhido ta errado, tem que ser dois números separados por X.\nExemplo /bet ${idJogo} 1x1`);

    db.serialize(() => {
      var sql = `UPDATE Jogos SET HomeTeamScore =  ${placar1}, AwayTeamScore = ${placar2} WHERE MatchNumber = ${idJogo}`;
      db.run(sql, function (err) {
        if (err) {
          message.reply(`❌ Deu erro`);
          return console.log(err.message);
        }
        message.reply(`✅ Placar atualizado`);
        getJogo(client, message, false, idJogo);
      });
    });
  }

});

function atualizarTabela() {
  db.serialize(() => {
    var sqlJogos = `SELECT Codigo FROM Usuarios`;
    db.all(sqlJogos, (err, rowsUsers) => {
      if (err) {
        console.error(err.message);
      }
      rowsUsers.forEach((rowUser) => {
        db.all(`SELECT MatchNumber, GolsHomeTime, GolsForaTime FROM Palpites WHERE CodUsuario = '${rowUser.Codigo}'`, (err, rowsPalpites) => {
          if (err) {
            console.error(err.message);
          }
          rowsPalpites.forEach((rowsPalpite) => {
            db.get(`SELECT HomeTeamScore, AwayTeamScore FROM Jogos WHERE MatchNumber = ${rowsPalpite.MatchNumber}`, (err, rowJogo) => {
              if (err) {
                console.error(err.message);
              }
              var pontos = 0;

              if (rowsPalpite.GolsHomeTime == rowJogo.HomeTeamScore && rowsPalpite.GolsForaTime == rowJogo.AwayTeamScore) {
                pontos++;
              }
              db.run(`UPDATE Usuarios SET Pontos = ${pontos} WHERE Codigo = '${rowUser.Codigo}'`, function (err) {
                if (err) {
                  return console.log(err.message);
                }
              });
            });
          });
        });
      });
      // get the last insert id
      console.log(`${moment()} - Tabela atualizada`);
    });
  });
}

function getJogo(client, message, reply, idJogo, data, grupo) {
  db.serialize(() => {
    var sql = idJogo == undefined ? `SELECT * FROM Jogos WHERE DATETIME(DateUtc) >= DATETIME('now', '-3 hour') ORDER BY DateUtc LIMIT 1` : `SELECT * FROM Jogos WHERE MatchNumber = ${idJogo}`
    if (data == true) sql = `SELECT * FROM Jogos WHERE DATE(DateUtc) = DATE('now')`;
    console.log(sql)
    db.all(sql, (err, row) => {
      if (err) {
        console.error(err.message);
      }

      if (row.length == 0) return message.reply("😔 Hoje não haverá jogos. Sinto muito.");

      row.forEach((row) => {
        var sqlPalpites = `SELECT Usuarios.Apelido,
        Palpites.GolsHomeTime,
        Palpites.GolsForaTime
        FROM Palpites
        INNER JOIN Usuarios ON Usuarios.Codigo = Palpites.CodUsuario
        WHERE Palpites.MatchNumber = ${row.MatchNumber}`;
        db.all(sqlPalpites, (err, rows) => {
          if (err) {
            console.error(`${sqlPalpites}\n${err.message}`);
          }
          var r = "🏆 Troféu Ai Sabe 🏆\n\n";
          r += getBandeira(row.HomeTeam) + " " + row.HomeTeam;

          if (row.HomeTeamScore != null) r += ` ${row.HomeTeamScore} x ${row.AwayTeamScore} `;
          else r += " x ";

          r += row.AwayTeam + " " + getBandeira(row.AwayTeam);

          if (moment().isBefore(row.DateUtc)) {
            r += "\n🗓️ " + moment(row.DateUtc).format("DD/MM/YYYY [às] HH:mm");
            r += "\n🆔 " + row.MatchNumber;
          }

          r += "\n\n*Palpites:*\n";
          if (rows.length == 0) {

            if (moment().isAfter(row.DateUtc)) {
              r += `_Ninguém palpitou nesse jogo._ 🤡\n`;
            } else {
              r += `_Ainda não há palpites para esse jogo, seja o primeiro._ 👍🏻\n`;
            }

          } else {
            rows.forEach((rowPalpite) => {

              if (moment().isAfter(row.DateUtc)) {
                if (rowPalpite.GolsHomeTime < row.HomeTeamScore || rowPalpite.GolsForaTime < row.AwayTeamScore) {
                  r += "❌ ~";
                } else if (rowPalpite.GolsHomeTime == row.HomeTeamScore && rowPalpite.GolsForaTime == row.AwayTeamScore) {
                  r += "✅ ";
                } else {
                  r += "➡️ ";
                }
              } else {
                r += "➡️ ";
              }

              r += `${rowPalpite.Apelido} - ${rowPalpite.GolsHomeTime} x ${rowPalpite.GolsForaTime}`;

              if (moment().isAfter(row.DateUtc)) {
                if (rowPalpite.GolsHomeTime < row.HomeTeamScore || rowPalpite.GolsForaTime < row.AwayTeamScore) {
                  r += "~";
                }
              }
              r += "\n";
            });
          }
          if (moment().isBefore(row.DateUtc)) {
            r += `\n⚠️ Para palpitar nesse jogo use o comando:\n/bet ${row.MatchNumber} "Gols ${row.HomeTeam}"x"Gols ${row.AwayTeam}"`;
            r += `\n\n*Exemplo - /bet ${row.MatchNumber} 1x0*`;
          }

          if (reply == true) { message.reply(r); }
          else {
            if (grupo == null && message != null) {
              client.sendMessage(message.from, r);
            } else {
              client.sendMessage(grupo, r);
            }
          }
        });
      });
    });
  });
}

function AiSabe(message) {
  var r = "🏆 Troféu Ai Sabe 🏆\n\n";
  r += "📖 *Regras*\n";
  r += "⚠️ Serão validados palpites iguais.\n";
  r += "⚠️ Palpites não podem ser alterados durante o jogo.\n";
  r += "⚠️ Palpites só serão abertos no dia do jogo.\n";
  r += "⚠️ Palpites válidos apenas dentro dos 90 minutos de jogo.\n";
  r += "\n\n*Comandos*\n\n";
  r += "\n_/c 'Apelido'_\nUtilizado para realizar o cadastro do seu apelido, só pode ser utilizado uma vez.\nExemplo - /c Neymar\n⚠️ Não precisa colocar as aspas.\n\n";
  r += "\n_/proximojogo_\nUtilizado para ver o próximo jogo.\n\n";
  r += "\n_/jogosDIA_\nLista todos os jogos do dia.\n\n";
  r += "\n_/jogos_\nLista todos os jogos com ID do jogo, times, datas e resultados.\n\n";
  r += "\n_/jogo 'ID'_\nMostra times, data, resultados e palpites com base no ID do jogo informado. \nExemplo - /jogo 1\n⚠️ Não precisa colocar as aspas.\n\n";
  r += "\n_/tabela_\nMostra a tabela de pontos em ordem de colocação.\n\n";
  r += "\n_/eunaosei_\nLança um palpite aleatório para o próximo jogo KKKKK.\n\n";
  r += "\n\n\n*Como apostar 👇*\n";
  r += "\nPrimeiro você deve saber o ID do jogo que vai apostar, pode usar o comando \n*/jogos* ou */proximojogo* para ver os IDs.";
  r += "\nCom base na sua sabedoria futibolistica mentalize os resultados.";
  r += "\nPara efetivar seu palpite, utilize o comando \n*/bet 'ID' 'Gols t1'x'Gols t2'*";
  r += "\n⚠️ Atenção\n ⚠️ Não precisa ter aspas;\n ⚠️ É obrigatorio ter o ID do jogo;\n ⚠️ Precisa ter o X entre os placares;\n ⚠️ Ao executar o comando para o mesmo ID seu palpite será atualizado.";
  r += "\nExemplo de como palpitar 👉 /bet 1 3x2";

  message.reply(r);
}


function getBandeira(time) {
  var bandeira = "";
  switch (time) {
    case "England": bandeira = "🏴󠁧󠁢󠁥󠁮󠁧󠁿"; break;
    case "Andorra": bandeira = "🇦🇩"; break;
    case "United Arab Emirates": bandeira = "🇦🇪"; break;
    case "Afghanistan": bandeira = "🇦🇫"; break;
    case "Antigua and Barbuda": bandeira = "🇦🇬"; break;
    case "Anguilla": bandeira = "🇦🇮"; break;
    case "Albania": bandeira = "🇦🇱"; break;
    case "Armenia": bandeira = "🇦🇲"; break;
    case "Angola": bandeira = "🇦🇴"; break;
    case "Antarctica": bandeira = "🇦🇶"; break;
    case "Argentina": bandeira = "🇦🇷"; break;
    case "American Samoa": bandeira = "🇦🇸"; break;
    case "Austria": bandeira = "🇦🇹"; break;
    case "Australia": bandeira = "🇦🇺"; break;
    case "Aruba": bandeira = "🇦🇼"; break;
    case "Åland Islands": bandeira = "🇦🇽"; break;
    case "Azerbaijan": bandeira = "🇦🇿"; break;
    case "Bosnia and Herzegovina": bandeira = "🇧🇦"; break;
    case "Barbados": bandeira = "🇧🇧"; break;
    case "Bangladesh": bandeira = "🇧🇩"; break;
    case "Belgium": bandeira = "🇧🇪"; break;
    case "Burkina Faso": bandeira = "🇧🇫"; break;
    case "Bulgaria": bandeira = "🇧🇬"; break;
    case "Bahrain": bandeira = "🇧🇭"; break;
    case "Burundi": bandeira = "🇧🇮"; break;
    case "Benin": bandeira = "🇧🇯"; break;
    case "Saint Barthélemy": bandeira = "🇧🇱"; break;
    case "Bermuda": bandeira = "🇧🇲"; break;
    case "Brunei Darussalam": bandeira = "🇧🇳"; break;
    case "Bolivia": bandeira = "🇧🇴"; break;
    case "Bonaire, Sint Eustatius and Saba": bandeira = "🇧🇶"; break;
    case "Brazil": bandeira = "🇧🇷"; break;
    case "Bahamas": bandeira = "🇧🇸"; break;
    case "Bhutan": bandeira = "🇧🇹"; break;
    case "Bouvet Island": bandeira = "🇧🇻"; break;
    case "Botswana": bandeira = "🇧🇼"; break;
    case "Belarus": bandeira = "🇧🇾"; break;
    case "Belize": bandeira = "🇧🇿"; break;
    case "Canada": bandeira = "🇨🇦"; break;
    case "Cocos (Keeling) Islands": bandeira = "🇨🇨"; break;
    case "Congo": bandeira = "🇨🇩"; break;
    case "Central African Republic": bandeira = "🇨🇫"; break;
    case "Congo": bandeira = "🇨🇬"; break;
    case "Switzerland": bandeira = "🇨🇭"; break;
    case "Côte D'Ivoire": bandeira = "🇨🇮"; break;
    case "Cook Islands": bandeira = "🇨🇰"; break;
    case "Chile": bandeira = "🇨🇱"; break;
    case "Cameroon": bandeira = "🇨🇲"; break;
    case "China": bandeira = "🇨🇳"; break;
    case "Colombia": bandeira = "🇨🇴"; break;
    case "Costa Rica": bandeira = "🇨🇷"; break;
    case "Cuba": bandeira = "🇨🇺"; break;
    case "Cape Verde": bandeira = "🇨🇻"; break;
    case "Curaçao": bandeira = "🇨🇼"; break;
    case "Christmas Island": bandeira = "🇨🇽"; break;
    case "Cyprus": bandeira = "🇨🇾"; break;
    case "Czech Republic": bandeira = "🇨🇿"; break;
    case "Germany": bandeira = "🇩🇪"; break;
    case "Djibouti": bandeira = "🇩🇯"; break;
    case "Denmark": bandeira = "🇩🇰"; break;
    case "Dominica": bandeira = "🇩🇲"; break;
    case "Dominican Republic": bandeira = "🇩🇴"; break;
    case "Algeria": bandeira = "🇩🇿"; break;
    case "Ecuador": bandeira = "🇪🇨"; break;
    case "Estonia": bandeira = "🇪🇪"; break;
    case "Egypt": bandeira = "🇪🇬"; break;
    case "Western Sahara": bandeira = "🇪🇭"; break;
    case "Eritrea": bandeira = "🇪🇷"; break;
    case "Spain": bandeira = "🇪🇸"; break;
    case "Ethiopia": bandeira = "🇪🇹"; break;
    case "Finland": bandeira = "🇫🇮"; break;
    case "Fiji": bandeira = "🇫🇯"; break;
    case "Falkland Islands (Malvinas)": bandeira = "🇫🇰"; break;
    case "Micronesia": bandeira = "🇫🇲"; break;
    case "Faroe Islands": bandeira = "🇫🇴"; break;
    case "France": bandeira = "🇫🇷"; break;
    case "Gabon": bandeira = "🇬🇦"; break;
    case "United Kingdom": bandeira = "🇬🇧"; break;
    case "Grenada": bandeira = "🇬🇩"; break;
    case "Georgia": bandeira = "🇬🇪"; break;
    case "French Guiana": bandeira = "🇬🇫"; break;
    case "Guernsey": bandeira = "🇬🇬"; break;
    case "Ghana": bandeira = "🇬🇭"; break;
    case "Gibraltar": bandeira = "🇬🇮"; break;
    case "Greenland": bandeira = "🇬🇱"; break;
    case "Gambia": bandeira = "🇬🇲"; break;
    case "Guinea": bandeira = "🇬🇳"; break;
    case "Guadeloupe": bandeira = "🇬🇵"; break;
    case "Equatorial Guinea": bandeira = "🇬🇶"; break;
    case "Greece": bandeira = "🇬🇷"; break;
    case "South Georgia": bandeira = "🇬🇸"; break;
    case "Guatemala": bandeira = "🇬🇹"; break;
    case "Guam": bandeira = "🇬🇺"; break;
    case "Guinea-Bissau": bandeira = "🇬🇼"; break;
    case "Guyana": bandeira = "🇬🇾"; break;
    case "Hong Kong": bandeira = "🇭🇰"; break;
    case "Heard Island and Mcdonald Islands": bandeira = "🇭🇲"; break;
    case "Honduras": bandeira = "🇭🇳"; break;
    case "Croatia": bandeira = "🇭🇷"; break;
    case "Haiti": bandeira = "🇭🇹"; break;
    case "Hungary": bandeira = "🇭🇺"; break;
    case "Indonesia": bandeira = "🇮🇩"; break;
    case "Ireland": bandeira = "🇮🇪"; break;
    case "Israel": bandeira = "🇮🇱"; break;
    case "Isle of Man": bandeira = "🇮🇲"; break;
    case "India": bandeira = "🇮🇳"; break;
    case "British Indian Ocean Territory": bandeira = "🇮🇴"; break;
    case "Iraq": bandeira = "🇮🇶"; break;
    case "Iran": bandeira = "🇮🇷"; break;
    case "Iceland": bandeira = "🇮🇸"; break;
    case "Italy": bandeira = "🇮🇹"; break;
    case "Jersey": bandeira = "🇯🇪"; break;
    case "Jamaica": bandeira = "🇯🇲"; break;
    case "Jordan": bandeira = "🇯🇴"; break;
    case "Japan": bandeira = "🇯🇵"; break;
    case "Kenya": bandeira = "🇰🇪"; break;
    case "Kyrgyzstan": bandeira = "🇰🇬"; break;
    case "Cambodia": bandeira = "🇰🇭"; break;
    case "Kiribati": bandeira = "🇰🇮"; break;
    case "Comoros": bandeira = "🇰🇲"; break;
    case "Saint Kitts and Nevis": bandeira = "🇰🇳"; break;
    case "North Korea": bandeira = "🇰🇵"; break;
    case "South Korea": bandeira = "🇰🇷"; break;
    case "Kuwait": bandeira = "🇰🇼"; break;
    case "Cayman Islands": bandeira = "🇰🇾"; break;
    case "Kazakhstan": bandeira = "🇰🇿"; break;
    case "Lao People's Democratic Republic": bandeira = "🇱🇦"; break;
    case "Lebanon": bandeira = "🇱🇧"; break;
    case "Saint Lucia": bandeira = "🇱🇨"; break;
    case "Liechtenstein": bandeira = "🇱🇮"; break;
    case "Sri Lanka": bandeira = "🇱🇰"; break;
    case "Liberia": bandeira = "🇱🇷"; break;
    case "Lesotho": bandeira = "🇱🇸"; break;
    case "Lithuania": bandeira = "🇱🇹"; break;
    case "Luxembourg": bandeira = "🇱🇺"; break;
    case "Latvia": bandeira = "🇱🇻"; break;
    case "Libya": bandeira = "🇱🇾"; break;
    case "Morocco": bandeira = "🇲🇦"; break;
    case "Monaco": bandeira = "🇲🇨"; break;
    case "Moldova": bandeira = "🇲🇩"; break;
    case "Montenegro": bandeira = "🇲🇪"; break;
    case "Saint Martin (French Part)": bandeira = "🇲🇫"; break;
    case "Madagascar": bandeira = "🇲🇬"; break;
    case "Marshall Islands": bandeira = "🇲🇭"; break;
    case "Macedonia": bandeira = "🇲🇰"; break;
    case "Mali": bandeira = "🇲🇱"; break;
    case "Myanmar": bandeira = "🇲🇲"; break;
    case "Mongolia": bandeira = "🇲🇳"; break;
    case "Macao": bandeira = "🇲🇴"; break;
    case "Northern Mariana Islands": bandeira = "🇲🇵"; break;
    case "Martinique": bandeira = "🇲🇶"; break;
    case "Mauritania": bandeira = "🇲🇷"; break;
    case "Montserrat": bandeira = "🇲🇸"; break;
    case "Malta": bandeira = "🇲🇹"; break;
    case "Mauritius": bandeira = "🇲🇺"; break;
    case "Maldives": bandeira = "🇲🇻"; break;
    case "Malawi": bandeira = "🇲🇼"; break;
    case "Mexico": bandeira = "🇲🇽"; break;
    case "Malaysia": bandeira = "🇲🇾"; break;
    case "Mozambique": bandeira = "🇲🇿"; break;
    case "Namibia": bandeira = "🇳🇦"; break;
    case "New Caledonia": bandeira = "🇳🇨"; break;
    case "Niger": bandeira = "🇳🇪"; break;
    case "Norfolk Island": bandeira = "🇳🇫"; break;
    case "Nigeria": bandeira = "🇳🇬"; break;
    case "Nicaragua": bandeira = "🇳🇮"; break;
    case "Netherlands": bandeira = "🇳🇱"; break;
    case "Norway": bandeira = "🇳🇴"; break;
    case "Nepal": bandeira = "🇳🇵"; break;
    case "Nauru": bandeira = "🇳🇷"; break;
    case "Niue": bandeira = "🇳🇺"; break;
    case "New Zealand": bandeira = "🇳🇿"; break;
    case "Oman": bandeira = "🇴🇲"; break;
    case "Panama": bandeira = "🇵🇦"; break;
    case "Peru": bandeira = "🇵🇪"; break;
    case "French Polynesia": bandeira = "🇵🇫"; break;
    case "Papua New Guinea": bandeira = "🇵🇬"; break;
    case "Philippines": bandeira = "🇵🇭"; break;
    case "Pakistan": bandeira = "🇵🇰"; break;
    case "Poland": bandeira = "🇵🇱"; break;
    case "Saint Pierre and Miquelon": bandeira = "🇵🇲"; break;
    case "Pitcairn": bandeira = "🇵🇳"; break;
    case "Puerto Rico": bandeira = "🇵🇷"; break;
    case "Palestinian Territory": bandeira = "🇵🇸"; break;
    case "Portugal": bandeira = "🇵🇹"; break;
    case "Palau": bandeira = "🇵🇼"; break;
    case "Paraguay": bandeira = "🇵🇾"; break;
    case "Qatar": bandeira = "🇶🇦"; break;
    case "Réunion": bandeira = "🇷🇪"; break;
    case "Romania": bandeira = "🇷🇴"; break;
    case "Serbia": bandeira = "🇷🇸"; break;
    case "Russia": bandeira = "🇷🇺"; break;
    case "Rwanda": bandeira = "🇷🇼"; break;
    case "Saudi Arabia": bandeira = "🇸🇦"; break;
    case "Solomon Islands": bandeira = "🇸🇧"; break;
    case "Seychelles": bandeira = "🇸🇨"; break;
    case "Sudan": bandeira = "🇸🇩"; break;
    case "Sweden": bandeira = "🇸🇪"; break;
    case "Singapore": bandeira = "🇸🇬"; break;
    case "Saint Helena, Ascension and Tristan Da Cunha": bandeira = "🇸🇭"; break;
    case "Slovenia": bandeira = "🇸🇮"; break;
    case "Svalbard and Jan Mayen": bandeira = "🇸🇯"; break;
    case "Slovakia": bandeira = "🇸🇰"; break;
    case "Sierra Leone": bandeira = "🇸🇱"; break;
    case "San Marino": bandeira = "🇸🇲"; break;
    case "Senegal": bandeira = "🇸🇳"; break;
    case "Somalia": bandeira = "🇸🇴"; break;
    case "Suriname": bandeira = "🇸🇷"; break;
    case "South Sudan": bandeira = "🇸🇸"; break;
    case "Sao Tome and Principe": bandeira = "🇸🇹"; break;
    case "El Salvador": bandeira = "🇸🇻"; break;
    case "Sint Maarten (Dutch Part)": bandeira = "🇸🇽"; break;
    case "Syrian Arab Republic": bandeira = "🇸🇾"; break;
    case "Swaziland": bandeira = "🇸🇿"; break;
    case "Turks and Caicos Islands": bandeira = "🇹🇨"; break;
    case "Chad": bandeira = "🇹🇩"; break;
    case "French Southern Territories": bandeira = "🇹🇫"; break;
    case "Togo": bandeira = "🇹🇬"; break;
    case "Thailand": bandeira = "🇹🇭"; break;
    case "Tajikistan": bandeira = "🇹🇯"; break;
    case "Tokelau": bandeira = "🇹🇰"; break;
    case "Timor-Leste": bandeira = "🇹🇱"; break;
    case "Turkmenistan": bandeira = "🇹🇲"; break;
    case "Tunisia": bandeira = "🇹🇳"; break;
    case "Tonga": bandeira = "🇹🇴"; break;
    case "Turkey": bandeira = "🇹🇷"; break;
    case "Trinidad and Tobago": bandeira = "🇹🇹"; break;
    case "Tuvalu": bandeira = "🇹🇻"; break;
    case "Taiwan": bandeira = "🇹🇼"; break;
    case "Tanzania": bandeira = "🇹🇿"; break;
    case "Ukraine": bandeira = "🇺🇦"; break;
    case "Uganda": bandeira = "🇺🇬"; break;
    case "United States Minor Outlying Islands": bandeira = "🇺🇲"; break;
    case "USA": bandeira = "🇺🇸"; break;
    case "Uruguay": bandeira = "🇺🇾"; break;
    case "Uzbekistan": bandeira = "🇺🇿"; break;
    case "Vatican City": bandeira = "🇻🇦"; break;
    case "Saint Vincent and The Grenadines": bandeira = "🇻🇨"; break;
    case "Venezuela": bandeira = "🇻🇪"; break;
    case "Virgin Islands, British": bandeira = "🇻🇬"; break;
    case "Virgin Islands, U.S.": bandeira = "🇻🇮"; break;
    case "Viet Nam": bandeira = "🇻🇳"; break;
    case "Vanuatu": bandeira = "🇻🇺"; break;
    case "Wallis and Futuna": bandeira = "🇼🇫"; break;
    case "Samoa": bandeira = "🇼🇸"; break;
    case "Yemen": bandeira = "🇾🇪"; break;
    case "Mayotte": bandeira = "🇾🇹"; break;
    case "South Africa": bandeira = "🇿🇦"; break;
    case "Zambia": bandeira = "🇿🇲"; break;
    case "Zimbabwe": bandeira = "🇿🇼"; break;
    case "Wales": bandeira = "🏴󠁧󠁢󠁷󠁬󠁳󠁿"; break;
    default: bandeira = '';
  }
  return bandeira;
}

function isNumeric(value) {
  return /^-?\d+$/.test(value);
}

function atualizarPlacar() {
  setTimeout(() => {
    db.serialize(() => {

      db.all(`SELECT DATETIME(DateUtc) AS DataHora, MatchNumber, HomeTeam, AwayTeam, HomeTeamScore, AwayTeamScore FROM Jogos WHERE DATETIME(DateUtc) > DATETIME(DATETIME('NOW', '-5 HOURS'), '-5 MINUTES') LIMIT 2;`, (err, jogos) => {
        if (err) {
          console.error(err.message);
        }

        for (var jogo = 0; jogo < jogos.length; jogo++) {

          //jogos.forEach((jogo) => {

          if (moment().isAfter(jogos[jogo].DataHora) && token != '') {
            // Jogo inciado
            // Verifica o placar atualizado
            var urlRequest = 'http://api.cup2022.ir/api/v1/match/' + jogos[jogo].MatchNumber;
            axios({
              method: 'GET',
              url: urlRequest,
              headers: { "Authorization": `Bearer ${token}` }
            }).then(res => {
              const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
              if (res.status == 200) {
                var gol1 = res.data.data[0].home_score;
                var gol2 = res.data.data[0].away_score;
                if (jogos[jogo].HomeTeamScore != gol1 || jogos[jogo].AwayTeamScore != gol2) {
                  if (jogos[jogo].HomeTeamScore != gol1 && gol1 != 0) {
                    var msg = `⚽ Acabou de sair gol da ${getBandeira(jogos[jogo].HomeTeam)} ${jogos[jogo].HomeTeam}, veja como estão os palpites 👇`;
                    client.sendMessage("558399506299-1405780291@g.us", msg);
                  } else if (jogos[jogo].AwayTeamScore != gol2 && gol2 != 0) {
                    var msg = `⚽ Acabou de sair gol da ${getBandeira(jogos[jogo].AwayTeam)} ${jogos[jogo].AwayTeam}, veja como estão os palpites 👇`;
                    client.sendMessage("558399506299-1405780291@g.us", msg);
                  }
                  var sql = `UPDATE Jogos SET HomeTeamScore = ${gol1}, AwayTeamScore = ${gol2} WHERE MatchNumber = ${jogos[jogo].MatchNumber}`;
                  db.run(sql, (err) => {
                    if (err) {
                      console.error(err.message);
                    }
                    getJogo(client, null, false, jogos[jogo].MatchNumber, false, "558399506299-1405780291@g.us");
                    console.log(`Atualização de placar ${jogos[jogo].MatchNumber}: ${gol1}x${gol2}`);
                  })
                }
              }
            }).catch(err => {
              console.log('Error: ', err.message);
            });


            atualizarPlacar(token);
          } else {
            // Jogo não iniciado
            var horaJogo = moment(jogos[jogo].DataHora);
            const dataInicioJogo = new Date(horaJogo);
            console.log(dataInicioJogo);
            const job = schedule.scheduleJob(dataInicioJogo, function () {
              // console.log(`Jogo ${jogos[jogo].MatchNumber} iniciado.`);
              time = 20000;
              job.cancel();
              if (jogo == 0) {
                axios({
                  method: 'post',
                  url: 'http://api.cup2022.ir/api/v1/user/login',
                  data: {
                    email: 'lavyksoares@gmail.com',
                    password: 'lavyk123'
                  }
                }).then(res => {
                  const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
                  console.log('API Resultados -> Status Code:', res.status);
                  console.log('Novo token solicitado');
                  if (res.status == 200) {
                    token = res.data.data.token;
                  }
                }).catch(err => {
                  console.log('Error: ', err.message);
                });
              }
              atualizarPlacar(token);
            });

            getJogo(client, null, false, jogos[jogo].MatchNumber, false, "558399506299-1405780291@g.us");
            console.log(`Jogo ${jogos[jogo].MatchNumber} agendado para iniciar a atualização automatica em ${dataInicioJogo}`);

            time = 86400000;
          }
        };
      });
    });
  }, time);
}