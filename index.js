const TelegramBot = require('node-telegram-bot-api')
const mysql = require('mysql2')
const config = require('./database')
const { telegram, api_bytez } = require('./config.json')
const bot = new TelegramBot(telegram.token, {polling: true})
const Bytez = require ('bytez.js')
const sdk = new Bytez(api_bytez.key)

const TimEout = 300 // Таймаут ожидания сообщения пользователя в милисекундах

const Get_text_to_image = {} // Получения текста для генерации изображения


// Подключение к базе для генерации очереди обработки от AI
const mysqlPool = mysql.createPool(config)
global.pool = mysqlPool.promise()

// Команды бота в боковом меню
async function setBotMenu() {
    await bot.setMyCommands([
        { command: '/text_to_image', description: 'Сгенерировать изображение' }
    ]);
}
setBotMenu()


// Генерация текста в изображение
async function Text_to_Image(text) {
    try {
        const model = sdk.model("stabilityai/stable-diffusion-xl-base-1.0")
        const { error, output } = await model.run(text)

        if (error) {
            throw new Error(error)
        }
        
        return output
    } catch (error) {
        console.error("Ошибка в Text_to_Image:", error);
        return 1
    }
}


bot.on('message', async (msg) => {
    
    const text = msg.text
    const chatId = msg.from.id


    if(text === '/text_to_image') {

        bot.sendMessage(chatId, 'Отправь текст для генерации изображения')

        setTimeout( async () => {
                Get_text_to_image[chatId] = true;
        }, TimEout);

    }

    if(Get_text_to_image[chatId]){

        await global.pool.query(`INSERT INTO Queue (author_telegram_id, text, type) VALUES (?, ?, ?)`, [chatId, text, 'text_to_image']);

        bot.sendMessage(chatId, '🕔 Задача по генерации изображения добавлена в очередь...')

        delete Get_text_to_image[chatId];
    }

})


//Раз в 15 секунд проверяем очередь на генерацию
setInterval( async () => {
    
    const [Processing] = await global.pool.query("SELECT * FROM Queue WHERE status = ? LIMIT 1", ['Processing'])

    if(Processing[0]) return

    const [Get_Queue] = await global.pool.query("SELECT id, type, text, author_telegram_id FROM Queue WHERE status != ? ORDER BY id asc LIMIT 1", ['DONE'])

    if(Get_Queue[0]){

        //Разделение по типам генерации
        if(Get_Queue[0].type === 'text_to_image') {

            await global.pool.query("UPDATE Queue SET status = ? WHERE id = ?", ['Processing', Get_Queue[0].id])

            await bot.sendMessage(Get_Queue[0].author_telegram_id, '🔄 Генерация изображения...')

            const aiResponse = await Text_to_Image(Get_Queue[0].text);

            if(aiResponse === 1){
                await global.pool.query("UPDATE Queue SET status = ? WHERE id = ?", ['DONE', Get_Queue[0].id])
                bot.sendMessage(Get_Queue[0].author_telegram_id, 'Произошла ошибка при генерации изображения, попробуйте еще раз')
            } else {
                await global.pool.query("UPDATE Queue SET status = ? WHERE id = ?", ['DONE', Get_Queue[0].id])
                bot.sendPhoto(Get_Queue[0].author_telegram_id, aiResponse)
            }
        }

    } else {
        return console.log('Очередь на генерацию пуста')
    }

}, 15000);