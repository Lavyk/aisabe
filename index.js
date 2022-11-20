const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();
var moment = require('moment');
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "client-one" })
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.initialize();


let db = new sqlite3.Database('./db/dados.db3', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database.');
});

// db.serialize(() => {
//   db.each(`SELECT * FROM Jogos WHERE date(DateUtc) > date('now') ORDER BY DateUtc LIMIT 1`, (err, row) => {
//     if (err) {
//       console.error(err.message);
//     }
//     console.log(row.HomeTeam + "\t" + row.AwayTeam);
//   });
// });

client.on('message', message => {
  console.log(message.body);
});

client.on('message', message => {

  if (message.body === '/proximojogo') {
    db.serialize(() => {
      db.each(`SELECT * FROM Jogos WHERE date(DateUtc) > date('now') ORDER BY DateUtc LIMIT 1`, (err, row) => {
        if (err) {
          console.error(err.message);
        }
        var sqlPalpites = `SELECT Usuarios.Apelido,
        Palpites.GolsHomeTime,
        Palpites.GolsForaTime
        FROM Palpites
        INNER JOIN Usuarios ON Usuarios.Codigo = Palpites.CodUsuario
        WHERE Palpites.MatchNumber = ${row.MatchNumber}`;
        db.all(sqlPalpites, (err, rows) => {
          if (err) {
            console.error(err.message);
          }
          var r = "🏆 Troféu Ai Sabe 🏆\n\n";
          r += getBandeira(row.HomeTeam) + " " + row.HomeTeam + " x " + row.AwayTeam + " " + getBandeira(row.AwayTeam);
          r += "\n🗓️ " + moment(row.DateUtc).format("DD/MM/YYYY [às] HH:mm");

          r += "\n\n*Palpites:*\n";
          if (rows == undefined) {
            r += `Ainda não há palpites para esse jogo, seja o primeiro. 👍🏻`;
          } else {
            rows.forEach((row) => {
              r += `${row.Apelido} - ${row.GolsHomeTime} x ${row.GolsForaTime}`;
              console.log(`${row.Apelido} - ${row.GolsHomeTime} x ${row.GolsForaTime}`)
            });
          }
          r += `\n\n⚠️ Para palpitar nesse jogo use o comando:\n/bet ${row.MatchNumber} {Gols ${row.HomeTeam}}x{Gols ${row.AwayTeam}}`;
          r += `\n\nExemplo - /bet ${row.MatchNumber} 1x0`;
          message.reply(r);
        });
      });
    });
  }

  if (message.body.startsWith('/c')) {
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
          var sql = `INSERT INTO Usuarios (Codigo, Apelido) VALUES ('${user}', '${apelido}' )`;

          db.run(sql, function (err) {
            if (err) {
              return console.log(err.message);
            }
            // get the last insert id
            console.log(`${moment()} - Cadastrado [${apelido}] [${user}]`);
            message.reply(`✅ Agora vc está cadastrado, seu apelido será *${apelido}*\n\nFique a vontade pra palpitar.`);
          });
        } else {
          message.reply(`Irmão, vc já está cadastrado, ta pensando que é bagunça!?\n\n*${row.Apelido}*\n\n😡 Seu bostinha`);
        }

      });
    });
  }

  if (message.body.startsWith('/bet')) {
    let tmp = message.body.split(' ');
    if (tmp.length != 3) return message.reply("O comando ta mt errado, tenta dnv.");

    var idJogo = tmp[1];

    var placar = tmp[2].split('x');
    if (placar.length != 2) return message.reply("O placar escolhido ta errado, tem que ser dois números.");

    var placar1 = placar[0].trim();
    var placar2 = placar[1].trim();

    if (!isNumeric(placar1)) return message.reply("O placar escolhido ta errado, tem que ser dois números.");
    if (!isNumeric(placar2)) return message.reply("O placar escolhido ta errado, tem que ser dois números.");

    db.serialize(() => {
      var user = message.author != undefined ? user = message.author : user = message.from;
      db.get(`SELECT * FROM Jogos WHERE MatchNumber = ${idJogo}`, (err, row) => {
        if (err) {
          return console.log(err.message);
        }

        if (row == undefined) return message.reply("Esse jogo não existe, vai tomar no cu.");

        if (moment().isAfter(row.DateUtc)) return message.reply("O jogo já começou, infelizmente os palpites estão encerrados.");

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
                });
              } else {
                message.reply(`Tu já palpitou nesse jogo, animal.`);
              }
            });
          } else {
            message.reply(`Irmão, vc ainda não está cadastrado, por favor, use o comando /c {Apelido} para se cadastrar.`);
          }

        });
      });
    });
  }

});





function getBandeira(time) {
  var bandeira = "";
  switch (time) {
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
    case "United States": bandeira = "🇺🇸"; break;
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
  }
  return bandeira;
}

function isNumeric(value) {
  return /^-?\d+$/.test(value);
}