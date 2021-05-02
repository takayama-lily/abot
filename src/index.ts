import oicq from "oicq"
import { getConfig, setConfig, parseCommandline } from "./config"
import help from "./help"
import { createEins, createZwei, writeConfBot } from "./bot"
import { rebootPlugin, deletePlugin, findAllPlugins, activate, deactivate, deactivateAll, restorePlugins } from "./plugin"

/**
 * 你创建的所有机器人实例
 */
const bots = new Map<number, oicq.Client>()

async function onMessage(this: oicq.Client, data: oicq.PrivateMessageEventData) {
    const { masters, prefix } = getConfig()
    if (!masters.includes(data.user_id) || !data.raw_message.startsWith(prefix))
        return
    const { cmd, params } = parseCommandline(data.raw_message.replace(prefix, ""))
    this.logger.info("收到指令，正在处理：" + data.raw_message)
    const msg = await cmdHanders[cmd]?.call(this, params, data) || "Error：未知指令：" + cmd
    data.reply(msg)
    this.logger.info("处理完毕，指令回复：" + msg)
}
function onOnline(this: oicq.Client) {
    broadcastOne(this, "此账号刚刚从掉线中恢复，现在一切正常。")
}
function onOffline(this: oicq.Client, data: oicq.OfflineEventData) {
    broadcastAll(this.uin + "已离线，\n原因为：" + data.message)
}

/**
 * 全部bot给全部管理者发消息
 */
function broadcastAll(message: string) {
    const { masters } = getConfig()
    for (let master of masters) {
        for (let [_, bot] of bots) {
            if (bot.isOnline()) {
                bot.sendPrivateMsg(master, ">广播：" + message)
            }
        }
    }
}

/**
 * 单个bot给全部管理者发消息
 */
function broadcastOne(bot: oicq.Client, message: string) {
    const { masters } = getConfig()
    for (let master of masters) {
        bot.sendPrivateMsg(master, ">广播：" + message)
    }
}

async function bindMasterEvents(bot: oicq.Client) {
    bots.set(bot.uin, bot)
    bot.removeAllListeners("system.login.slider")
    bot.removeAllListeners("system.login.device")
    bot.removeAllListeners("system.login.error")
    bot.on("system.online", onOnline)
    bot.on("system.offline", onOffline)
    bot.on("message.private", onMessage)
    const plugins = await restorePlugins(bot)
    let n = 0
    for (let [_, plugin] of plugins) {
        if (plugin.binds.has(bot))
            ++n
    }
    setTimeout(() => {
        broadcastOne(bot, `启动成功。启用了${n}个插件。
※发送 ${getConfig().prefix}help 可以查询指令用法。`)
    }, 3000)
}

const cmdHanders: {
    [k: string]: (
        this: oicq.Client,
        params: ReturnType<typeof parseCommandline>["params"],
        data: oicq.PrivateMessageEventData
    ) => Promise<string>
} = {

    async help(params) {
        return help[params[0]] || help.default
    },

    async conf(params) {
        if (params[0] === "help") {
            return help.conf
        }
        return await setConfig(params)
    },

    async shutdown() {
        process.exit(0)
    },

    async plug(params, data) {
        const cmd = params[0]
        if (!cmd) {
            try {
                const { plugins, plugin_modules, node_modules} = await findAllPlugins()
                let msg = "可用插件模块一览："
                for (let name of [...plugin_modules, ...node_modules]) {
                    const plugin = plugins.get(name)
                    msg += `\n${name} / ${plugin?"已":"未"}导入 / bot: `
                    if (plugin) {
                        for (let bot of plugin.binds) {
                            msg += `${bot.nickname}(${bot.uin}), `
                        }
                    }
                }
                msg += `\n※ 共找到${plugin_modules.length + node_modules.length}个插件`
                return msg
            } catch (e) {
                return "Error: " + e.message
            }
        }
        if (cmd === "help") {
            return help.plug
        }
        const name = params[1],
            uin = Number(params[2]) || data.self_id,
            bot = bots.get(uin)
        let msg = ""
        try {
            if (!name)
                throw new Error("请输入插件名称")
            switch (cmd) {
                case "on":
                    if (!bot) {
                        throw new Error("账号输入错误，无法找到该实例")
                    }
                    await activate(name, bot)
                    msg = `机器人${uin}启用插件成功`
                    break
                case "off":
                    if (!bot) {
                        throw new Error("账号输入错误，无法找到该实例")
                    }
                    await deactivate(name, bot)
                    msg = `机器人${uin}禁用插件成功`
                    break
                case "on-all":
                    for (let [_, bot] of bots) {
                        await activate(name, bot)
                    }
                    msg = "全部机器人启用插件成功"
                    break
                case "off-all":
                    for (let [_, bot] of bots) {
                        await deactivate(name, bot)
                    }
                    msg = "全部机器人禁用插件成功"
                    break
                case "del":
                    await deletePlugin(name)
                    msg = "卸载插件成功"
                    break
                case "reboot":
                    await rebootPlugin(name)
                    msg = "重启插件成功"
                    break
                default:
                    throw new Error("未知参数：" + cmd)
            }
            return "Success: " + msg
        } catch (e) {
            return "Error: " + e.message
        }
    },

    async set(params, data) {
        let bot = bots.get(data.self_id) as oicq.Client,
            key = params[0] as keyof oicq.ConfBot,
            value = params[1] as any
        if (!key)
            return "当前机器人的运行时参数：\n" + JSON.stringify(bot.config, null, 4) + "\n※ 修改输入：>set {key} {value}\n※ 修改 platform 需要重新登录"
        if (!Reflect.has(bot.config, key))
            return "Error：请输入正确的key"
        if (!value)
            return "Error：请输入正确的value"
        if (value === "false")
            value = false
        if (typeof bot.config[key] === "boolean")
            value = Boolean(value)
        if (typeof bot.config[key] === "number")
            value = isNaN(Number(value)) ? bot.config[key] : Number(value)
        bot.config[key] = value
        if (key === "log_level") {
            bot.logger.level = value
        }
        try {
            await writeConfBot(bot)
            return "Success: 设置成功"
        } catch (e) {
            return "Error: " + e.message
        }
    },

    async bot(params, data) {
        const cmd = params[0], uin = Number(params[1])
        if (!cmd) {
            let msg = ""
            for (let [uin, bot] of bots) {
                msg += `> ${bot.nickname} (${uin})
    在线：${bot.isOnline()}
    群：${bot.gl.size}个，好友：${bot.fl.size}个
    消息量：${bot.getStatus().data?.msg_cnt_per_min}/分
`
            }
            return msg
        }
        if (cmd === "help") {
            return help.bot
        }
        if (cmd === "login") {
            if (bots.has(uin)) {
                return "Error：已经登录过这个号了"
            }
            const bot = await createZwei(uin, data, this)
            bot?.once("system.online", function () {
                bindMasterEvents(bot)
                data.reply(">登录成功")
            })
            return ">开始登录流程，账号：" + uin
        }
        const bot = bots.get(uin)
        if (!bot)
            return "Error: 账号输入错误，无法找到该实例"
        if (cmd === "off") {
            await bot.logout()
            return "Success：已将该账号下线"
        } else if (cmd === "on") {
            bot.login()
            return "Sucess：已将该账号上线"
        } else if (cmd === "del") {
            if (bot.isOnline()) {
                return "Error：此机器人正在登录中，请先离线再删除"
            }
            await deactivateAll(bot)
            bots.delete(uin)
            return "Sucess：已删除此机器人实例"
        } else {
            return "Error：未知参数：" + cmd
        }
    }
}

;(async function startup() {
    process.title = "abot"
    const bot = await createEins()
    bot.once("system.online", function () {
        bot.logger.mark("可发送 >help 给机器人查看指令帮助")
        bindMasterEvents(bot)
    })
})()
