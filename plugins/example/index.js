"use strict"
const http = require("http")

const server = http.createServer((req, res) => {
    res.end("hello world")
}).listen(6565).on("error", () => { })

/**
 * 启用后收到123回复456
 */
function listener(data) {
    if (data.raw_message === "123") {
        data.reply("456")
    }
}

/**
 * 当一个bot实例启用了此插件时被调用
 * @param {import("oicq").Client} bot 
 */
function activate(bot) {
    bot.on("message.private", listener)
}

/**
 * 当一个bot实例禁用了此插件时被调用
 * @param {import("oicq").Client} bot 
 */
function deactivate(bot) {
    bot.off("message.private", listener)
}

/**
 * 当插件被重启或卸载之前被调用，用来释放资源(例如监听的端口)
 * 若没有请求任何资源，不必导出此函数
 */
function destructor() {
    return new Promise((resolve) => {
        server.close(resolve)
    })
}

module.exports = {
    activate, deactivate, destructor,
}
