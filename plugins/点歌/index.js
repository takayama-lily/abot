"use strict"
const http = require("http")
const oicq = require("oicq")

/**
 * @this {oicq.Client}
 * @param {oicq.MessageEvent} data 
 */
function listener(data) {
    if (data.raw_message.startsWith("点歌")) {
        const word = data.raw_message.replace("点歌", "").trim()
        if (!word)
            return
        http.get(`http://s.music.163.com/search/get/?type=1&s=${word}&limit=1`, res=>{
            res.on("data", chunk=>{
                try {
                    const id = JSON.parse(String(chunk))?.result?.songs?.[0]?.id
                    if (id) {
                        data.group?.shareMusic("163", id)
                        data.friend?.shareMusic("163", id)
                    }
                    else
                        data.reply("未找到歌曲：" + word)
                } catch (e) {
                    this.logger.error("请求歌曲API遇到错误：")
                    this.logger.error(e)
                }
            })
        }).on("error", (e)=>{
            this.logger.error(e)
        })
    }
}

function activate(bot) {
    bot.on("message", listener)
}
function deactivate(bot) {
    bot.off("message", listener)
}

module.exports = {
    activate, deactivate,
}
