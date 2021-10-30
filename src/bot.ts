import fs from "fs"
import path from "path"
import crypto from "crypto"
import * as oicq from "oicq"
import { getConfig } from "./config"

export function writeConfBot(bot: oicq.Client) {
    return fs.promises.writeFile(
        path.join(bot.dir, "confbot"),
        JSON.stringify(bot.config, null, 4)
    )
}

async function genConfBot(uin: number) {
    const file = path.join(__dirname, "../data", String(uin), "confbot")
    try {
        const raw = await fs.promises.readFile(file, { encoding: "utf-8" })
        return Object.assign(JSON.parse(raw), {
            data_dir: path.join(__dirname, "../data")
        }) as oicq.Config
    } catch {
        const config = getConfig();
        return {
            log_level: config["log_level"],
            platform: config["platform"],
            data_dir: path.join(__dirname, "../data")
        } as oicq.Config
    }
}

/**
 * eins 是德语里"一"的意思
 * 这里表示第一个被创建的机器人实例，主人通过给它发消息来管理整个系统
 * 可以通过它创建其它机器人实例
 */
export async function createEins() {
    const config = getConfig();
    const eins = oicq.createClient(config["eins"], await genConfBot(config["eins"]))
    eins.logger.mark("正在登录第一个账号，登录成功后stdin会被重定向到此账号。")
    
    eins.on("system.login.slider", function () {
        eins.logger.mark("取ticket教程：https://github.com/takayama-lily/oicq/wiki/01.滑动验证码和设备锁")
        process.stdout.write("ticket: ")
        process.stdin.once("data", this.sliderLogin.bind(this))
    })
    eins.on("system.login.device", function () {
        eins.logger.mark("完成后按Enter键继续..")
        process.stdin.once("data", () => this.login())
    })
    eins.on("system.login.error", function (data) {
        if (data.message.includes("密码错误")) {
            inputPassword()
        } else {
            this.terminate()
            console.log("当前账号无法登录，按Enter键退出程序...")
            process.stdin.once("data", process.exit)
        }
    });

    function inputPassword() {
        eins.logger.mark("首次登录请输入密码：");
        process.stdin.once("data", (data)=>{
            const input = String(data).trim();
            if (!input.length)
                return inputPassword();
            const password = crypto.createHash("md5").update(input).digest();
            fs.writeFileSync(path.join(eins.dir, "password"), password, {mode: 0o600});
            eins.login(password);
        })
    }

    try {
        eins.login(fs.readFileSync(path.join(eins.dir, "password")));
    } catch {
        inputPassword();
    }

    return eins
}

export async function createZwei(uin: number, delegate: oicq.PrivateMessageEvent, eins: oicq.Client) {
    try {
        var zwei = oicq.createClient(uin, await genConfBot(uin))
    } catch (e) {
        delegate.reply("Error：账号输入错误")
        return
    }
    zwei.on("system.login.slider", function (data) {
        delegate.reply(`>登录流程：收到滑动验证码，请前往 ${data.url} 完成滑动并取出ticket输入。\n>取消登录输入："cancel"
>取ticket教程：https://github.com/takayama-lily/oicq/wiki/01.滑动验证码和设备锁`)
        eins.on("message.private", function a(data) {
            if (data.user_id === delegate.user_id) {
                this.off("message.private", a)
                if (data.raw_message === "cancel") {
                    delegate.reply(">登录流程：已取消")
                    zwei.terminate()
                } else {
                    zwei.sliderLogin(data.raw_message)
                }
            }
        })
    })
    zwei.on("system.login.device", function (data) {
        delegate.reply(`>登录流程：需要验证设备锁，请前往 ${data.url} 完成验证后输入"ok"。\n>取消登录输入："cancel"`)
        eins.on("message.private", function b(data) {
            if (data.user_id === delegate.user_id) {
                this.off("message.private", b)
                if (data.raw_message === "cancel") {
                    delegate.reply(">登录流程：已取消")
                    zwei.terminate()
                } else {
                    zwei.login()
                    delegate.reply(">登录流程完成，可使用 \">bot\" 命令查看是否登录成功")
                }
            }
        })
    })
    zwei.on("system.login.error", function (data) {
        if (data.message.includes("密码错误")) {
            delegate.reply(`>登录流程：密码错误！`)
            inputPassword()
        } else {
            this.terminate()
            delegate.reply(`>登录流程遇到错误：${data.message}\n>登录已取消`)
        }
    });

    function inputPassword() {
        delegate.reply(`>登录流程：首次登录请输入密码\n>取消登录输入："cancel"`)
        eins.on("message.private", async function c(data) {
            if (data.user_id === delegate.user_id) {
                this.off("message.private", c)
                if (data.raw_message === "cancel") {
                    delegate.reply(">登录流程：已取消")
                } else {
                    const password = crypto.createHash("md5").update(data.raw_message).digest();
                    await fs.promises.writeFile(path.join(zwei.dir, "password"), password, {mode: 0o600});
                    zwei.login(password)
                }
            }
        })
    }

    try {
        zwei.login(await fs.promises.readFile(path.join(zwei.dir, "password")));
    } catch {
        inputPassword();
    }

    return zwei
}
