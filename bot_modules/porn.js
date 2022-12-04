const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');

const fs = require('fs');

const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const { exec } = require("child_process");

module.exports = {
    getVideo: function (client, message, db) {
        //if (message.from != '558399506299-1405780291@g.us') return;

        var user = message.author != undefined ? user = message.author : user = message.from;
        message.from == '558399506299-1405780291@g.us'
        if (verificarUsuarioPermitido(user) == false || message.from != '558399506299-1405780291@g.us') {
            console.log(`${user} tentou usar sem permissão.`)
            return;
        }

        if (message.body.startsWith('/porn')) {
            db.serialize(() => {
                let sql = `SELECT Valor FROM Outros WHERE Key = 'Porn';`;

                db.get(sql, (err, row) => {
                    if (err) {
                        return console.error(err.message);
                    }
                    db.run("UPDATE Outros SET Valor = (Valor + 1) WHERE Key = 'Porn'", function (err) {
                        if (err) {
                            return console.error(err.message);
                        }
                    });

                    axios(`https://api.redtube.com/?data=redtube.Videos.searchVideos&output=json&search=&thumbsize=big&page=${getRandom(1, 6366)}`)
                        .then(res => {
                            const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';

                            if (res.status == 200) {
                                video = res.data.videos[getRandom(0, 19)].video;
                                db.run(`INSERT INTO Porn_Requests (Codigo, UrlVideo) VALUES ('${user}', '${video.url}')`, function (err) {
                                    if (err) {
                                        return console.error(err.message);
                                    }
                                });
                                console.log(`${user} solicitou um video e recebeu: ${video.url}`);

                                var formatVideo = `\n*${video.title}*\n${getEstrelas(video.rating)}
                        \n😏 ${video.url}
                        \n💦 ${row.Valor + 1} punhetas patrocinadas nesse grupo.`;

                                gerarGif(video).then((path) => {
                                    const media = MessageMedia.fromFilePath(path);
                                    client.sendMessage(message.from, media, { caption: formatVideo })
                                });
                            }
                        }).catch(err => {
                            console.log('Error: ', err.message);
                        });
                });
            });
        }

        function verificarUsuarioPermitido(user) {
            db.serialize(() => {
                let sql = `SELECT * FROM Porn_User WHERE Codigo = '${user}' AND Permitido = 'TRUE'`;
                db.get(sql, (err, row) => {
                    if (row != undefined) return true;
                    else return false;
                })
            });
        }


    }
}


function getRandom(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

function getEstrelas(rate) {
    var str = "";
    var rat = Math.round((rate * 5) / 100);
    for (var a = 0; a < rat; a++) {
        str += "⭐";
    }
    return str;
}

function gerarGif(video) {
    return new Promise((resolve, reject) => {
        var pastaImg = './output/' + video.video_id;

        const canvas = createCanvas(video.thumbs[0].width, video.thumbs[0].height);
        const ctx = canvas.getContext('2d');

        const encoder = new GIFEncoder(video.thumbs[0].width, video.thumbs[0].height);
        encoder.createReadStream().pipe(fs.createWriteStream(pastaImg + ".gif"));
        encoder.start();
        encoder.setRepeat(0);
        encoder.setDelay(500);
        encoder.setQuality(10);

        fs.mkdirSync(pastaImg);

        var c = 0;

        video.thumbs.forEach((f, i) => {
            var nome = f.src.split('/');
            var nomeFinal = nome[nome.length - 1];
            downloadImage(f.src, pastaImg + '/' + nomeFinal);
        });

        setTimeout(async () => {
            await fs.readdir(pastaImg, (err, f) => {
                f.forEach(async (f, i) => {
                    const image = await loadImage(pastaImg + "/" + f);
                    ctx.drawImage(image, 0, 0)
                    encoder.addFrame(ctx);
                    if (i === video.thumbs.length - 1) {
                        encoder.finish();
                    }
                })

                fs.rmSync(pastaImg, { recursive: true, force: true });
                setTimeout(async () => {
                    var cmd = `.\\bot_modules\\gif2webp.exe -q 80 "${pastaImg}.gif" -o "${pastaImg}.webp" "-v"`;
                    exec(cmd, (error, stdout, stderr) => {
                        if (error) {
                            console.log(`error: ${error.message}`);
                            return;
                        }
                        if (stderr) {
                            fs.rmSync(`${pastaImg}.gif`, {
                                force: true,
                            })
                            resolve(`${pastaImg}.webp`)
                            return;
                        }
                    });
                }, 1000);
            });
        }, 3000);
    });
}

async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
            .on('error', reject)
            .once('close', () => resolve(filepath));
    });
}