const sqlite3 = require('sqlite3').verbose();
var moment = require('moment');
const axios = require('axios');

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
});;

function setToken(token) {
  var idJogoAtual = 24;
  
  var urlRequest = 'http://api.cup2022.ir/api/v1/match/' + idJogoAtual;
  setInterval(() => {
    axios({
      method: 'GET',
      url: urlRequest,
      headers: { "Authorization": `Bearer ${token}` }
    }).then(res => {
      const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
      if (res.status == 200) {
        var gol1 = res.data.data[0].home_score;
        var gol2 = res.data.data[0].away_score;
        console.log(`${gol1}x${gol2}`);
      }
    }).catch(err => {
      console.log('Error: ', err.message);
    });;
  }, 10000);
}

// db.serialize(() => {
//   db.each(`SELECT * FROM Jogos WHERE date(DateUtc) > date('now') ORDER BY DateUtc LIMIT 1`, (err, row) => {
//     if (err) {
//       console.error(err.message);
//     }
//     console.log(row.HomeTeam + "\t" + row.AwayTeam);
//   });
// });