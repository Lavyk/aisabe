// SELECT DATETIME(DateUtc), MatchNumber, HomeTeam, AwayTeam FROM Jogos WHERE DATETIME(DateUtc) > DATETIME(DATETIME('NOW', '-5 HOURS'), '-5 MINUTES') LIMIT 1;

const sqlite3 = require('sqlite3').verbose();
var moment = require('moment');
const axios = require('axios');
const schedule = require('node-schedule');

let db = new sqlite3.Database('./db/dados.db3', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database.');
});

axios({
  method: 'post',
  url: 'http://api.cup2022.ir/api/v1/user/login',
  data: {
    email: 'lavyksoares@gmail.com',
    password: 'lavyk123'
  }
}).then(res => {
  const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
  console.log('Status Code:', res.status);
  if (res.status == 200) {
    token = res.data.data.token;
    setToken(token);
  }
}).catch(err => {
  console.log('Error: ', err.message);
});

function setToken(token) {
  let time = 30000;
  atualizarPlacar();

  function atualizarPlacar() {
    setTimeout(() => {
      db.serialize(() => {
        db.get(`SELECT DATETIME(DateUtc) AS DataHora, MatchNumber, HomeTeamScore, AwayTeamScore FROM Jogos WHERE DATETIME(DateUtc) > DATETIME(DATETIME('NOW', '-5 HOURS'), '-5 MINUTES') LIMIT 1;`, (err, jogo) => {
          if (err) {
            console.error(err.message);
          }
          if (moment().isAfter(jogo.DataHora)) {
            // Jogo inciado
            // Verifica o placar atualizado
            var urlRequest = 'http://api.cup2022.ir/api/v1/match/' + jogo.MatchNumber;
            axios({
              method: 'GET',
              url: urlRequest,
              headers: { "Authorization": `Bearer ${token}` }
            }).then(res => {
              const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
              if (res.status == 200) {
                var gol1 = res.data.data[0].home_score;
                var gol2 = res.data.data[0].away_score;
                if (jogo.HomeTeamScore != gol1 || jogo.AwayTeamScore != gol2) {
                  var sql = `UPDATE Jogos SET HomeTeamScore = ${gol1}, AwayTeamScore = ${gol2} WHERE MatchNumber = ${jogo.MatchNumber}`;
                  db.run(sql, (err) => {
                    if (err) {
                      console.error(err.message);
                    }
                    console.log(sql);
                    console.log(`Atualização de placar ${jogo.MatchNumber}: ${gol1}x${gol2}`);
                  })
                }
              }
            }).catch(err => {
              console.log('Error: ', err.message);
            });


            atualizarPlacar();
          } else {
            // Jogo não iniciado
            var horaJogo = moment(jogo.DataHora);
            const dataInicioJogo = new Date(horaJogo);
            console.log(dataInicioJogo);
            const job = schedule.scheduleJob(dataInicioJogo, function () {
              console.log(`Jogo ${jogo.MatchNumber} iniciado.`);
              time = 30000;
              job.cancel();
              atualizarPlacar();
            });

            console.log(`Jogo ${jogo.MatchNumber} agendado para iniciar a atualização automatica em ${dataInicioJogo}`);

            time = 86400000;
          }
        });
      });


    }, time);
  }
}

// db.serialize(() => {
//   db.each(`SELECT * FROM Jogos WHERE date(DateUtc) > date('now') ORDER BY DateUtc LIMIT 1`, (err, row) => {
//     if (err) {
//       console.error(err.message);
//     }
//     console.log(row.HomeTeam + "\t" + row.AwayTeam);
//   });
// });