"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCommandline = exports.setConfig = exports.getConfig = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * 程序启动后请不要再手动修改 config.json 文件，修改也没用
 * 如需修改请通过主人指令，并且会立即生效
 */
const config = require("../config.json");
function getConfig() {
    return config;
}
exports.getConfig = getConfig;
function writeConfig() {
    return fs_1.default.promises.writeFile(path_1.default.join(__dirname, "../config.json"), JSON.stringify(config, null, 4));
}
async function addMaster(uin) {
    const masters = new Set(config.masters);
    if (!masters.has(uin)) {
        masters.add(uin);
        config.masters = Array.from(masters);
        await writeConfig();
    }
    return "Success：当前master列表：" + config.masters;
}
async function deleteMaster(uin) {
    const masters = new Set(config.masters);
    if (masters.has(uin)) {
        masters.delete(uin);
        config.masters = Array.from(masters);
        await writeConfig();
    }
    return "Success：当前master列表：" + config.masters;
}
async function setPrefix(prefix) {
    if (prefix) {
        config.prefix = prefix;
        await writeConfig();
        return "Success：prefix已被修改为：" + config.prefix;
    }
    else {
        return "Error：prefix至少需要一个字符";
    }
}
async function setDefaultPlatform(platform) {
    if (![1, 2, 3, 4, 5].includes(platform))
        return "Error：platform必须在1-5之间";
    config.platform = platform;
    await writeConfig();
    return "Success：当前初始platform：" + config.platform;
}
async function setDefaultLogLevel(log_level) {
    config.log_level = log_level;
    await writeConfig();
    return "Success：当前初始log_level：" + config.log_level;
}
async function setConfig(params) {
    if (!params[0])
        return "当前全局配置：\n" + JSON.stringify(config, null, 4);
    let ret;
    try {
        if (params[0] === "add-mst") {
            ret = await addMaster(Number(params[1]));
        }
        else if (params[0] === "del-mst") {
            ret = await deleteMaster(Number(params[1]));
        }
        else if (params[0] === "prefix") {
            ret = await setPrefix(params[1]);
        }
        else if (params[0] === "platform") {
            ret = await setDefaultPlatform(Number(params[1]));
        }
        else if (params[0] === "log_level") {
            ret = await setDefaultLogLevel(params[1]);
        }
        else {
            ret = "Error：未知参数：" + params[0];
        }
    }
    catch {
        ret = "Error：default-config.json写入失败，请检查是否被其它程序占用";
    }
    return ret;
}
exports.setConfig = setConfig;
function parseCommandline(commandline) {
    const split = commandline.split(" ");
    let cmd = "", params = [];
    for (let v of split) {
        if (v === "")
            continue;
        if (!cmd)
            cmd = v;
        else
            params.push(v);
    }
    return {
        cmd, params
    };
}
exports.parseCommandline = parseCommandline;
