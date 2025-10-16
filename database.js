const { db } = require('./config.json')
const fs = require('fs');

const config = {
    host     : db.host,
    port     : 3306,
    user     : db.user,
    password : db.password,
    database : db.database,
    ssl: {
        rejectUnauthorized: db.ssl.rejectUnauthorized,
        ca: fs.readFileSync('./root.crt').toString(),
    },
}

module.exports = config