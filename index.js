const TelegramBot = require('node-telegram-bot-api')

const { telegram } = require('./config.json')
const bot = new TelegramBot(telegram.token, {polling: true})


