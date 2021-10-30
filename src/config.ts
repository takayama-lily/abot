import fs from "fs"
import path from "path"
import { Config } from "oicq"

interface GlobalConfig {
    "prefix": string, // 管理指令前缀，默认为">"
    "masters": number[], // 管理权限账号
    "eins": number, // eins 的账号
    "platform": Config["platform"], // 1-5
    "log_level": Config["log_level"], // off,error,warn,info,debug,trace
}

/**
 * 程序启动后请不要再手动修改 config.json 文件，修改也没用
 * 如需修改请通过主人指令，并且会立即生效
 */
const config: GlobalConfig = require("../config.json")

export function getConfig() {
    return config
}

function writeConfig() {
    return fs.promises.writeFile(path.join(__dirname, "../config.json"), JSON.stringify(config, null, 4))
}

async function addMaster(uin: number) {
    const masters = new Set(config.masters)
    if (!masters.has(uin)) {
        masters.add(uin)
        config.masters = Array.from(masters)
        await writeConfig()
    }
    return "Success：当前master列表：" + config.masters
}

async function deleteMaster(uin: number) {
    const masters = new Set(config.masters)
    if (masters.has(uin)) {
        masters.delete(uin)
        config.masters = Array.from(masters)
        await writeConfig()
    }
    return "Success：当前master列表：" + config.masters
}

async function setPrefix(prefix: string) {
    if (prefix) {
        config.prefix = prefix
        await writeConfig()
        return "Success：prefix已被修改为：" + config.prefix
    } else {
        return "Error：prefix至少需要一个字符"
    }
}

async function setDefaultPlatform(platform: number) {
    if (![1,2,3,4,5].includes(platform))
        return "Error：platform必须在1-5之间"
    config.platform = platform
    await writeConfig()
    return "Success：当前初始platform：" + config.platform
}

async function setDefaultLogLevel(log_level: Config["log_level"]) {
    config.log_level = log_level
    await writeConfig()
    return "Success：当前初始log_level：" + config.log_level
}

export async function setConfig(params: ReturnType<typeof parseCommandline>["params"]) {
    if (!params[0])
        return "当前全局配置：\n" + JSON.stringify(config, null, 4)
    let ret: string;
    try {
        if (params[0] === "add-mst") {
            ret = await addMaster(Number(params[1]))
        } else if (params[0] === "del-mst") {
            ret = await deleteMaster(Number(params[1]))
        } else if (params[0] === "prefix") {
            ret = await setPrefix(params[1])
        } else if (params[0] === "platform") {
            ret = await setDefaultPlatform(Number(params[1]))
        } else if (params[0] === "log_level") {
            ret = await setDefaultLogLevel(params[1] as Config["log_level"])
        } else {
            ret = "Error：未知参数：" + params[0]
        }
    } catch {
        ret = "Error：default-config.json写入失败，请检查是否被其它程序占用"
    }
    return ret;
}

export function parseCommandline(commandline: string) {
    const split = commandline.split(" ")
    let cmd = "", params: string[] = []
    for (let v of split) {
        if (v === "")
            continue
        if (!cmd)
            cmd = v
        else
            params.push(v)
    }
    return {
        cmd, params
    }
}
