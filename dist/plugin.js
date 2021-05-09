"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restorePlugins = exports.findAllPlugins = exports.deactivateAll = exports.deactivate = exports.activate = exports.rebootPlugin = exports.deletePlugin = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * 导入的插件
 */
const plugins = new Map();
class PluginError extends Error {
    constructor() {
        super(...arguments);
        this.name = "PluginError";
    }
}
class Plugin {
    constructor(name, path) {
        this.name = name;
        this.path = path;
        this.binds = new Set();
        this.fullpath = require.resolve(this.path);
        require(this.path);
    }
    async _editBotPluginCache(bot, method) {
        const dir = path_1.default.join(bot.dir, "plugin");
        let set;
        try {
            const arr = JSON.parse(await fs_1.default.promises.readFile(dir, { encoding: "utf8" }));
            set = new Set(arr);
        }
        catch {
            set = new Set;
        }
        set[method](this.name);
        return fs_1.default.promises.writeFile(dir, JSON.stringify(Array.from(set), null, 4));
    }
    async activate(bot) {
        if (this.binds.has(bot)) {
            throw new PluginError("这个机器人实例已经启用了此插件");
        }
        const mod = require.cache[this.fullpath];
        if (typeof mod?.exports.activate !== "function") {
            throw new PluginError("此插件未导出activate方法，无法启用。");
        }
        try {
            const res = mod?.exports.activate(bot);
            if (res instanceof Promise)
                await res;
            await this._editBotPluginCache(bot, "add");
            this.binds.add(bot);
        }
        catch (e) {
            throw new PluginError("启用插件时遇到错误。\n错误信息：" + e.message);
        }
    }
    async deactivate(bot) {
        if (!this.binds.has(bot)) {
            throw new PluginError("这个机器人实例尚未启用此插件");
        }
        const mod = require.cache[this.fullpath];
        if (typeof mod?.exports.deactivate !== "function") {
            throw new PluginError("此插件未导出deactivate方法，无法禁用。");
        }
        try {
            const res = mod?.exports.deactivate(bot);
            if (res instanceof Promise)
                await res;
            await this._editBotPluginCache(bot, "delete");
            this.binds.delete(bot);
        }
        catch (e) {
            throw new PluginError("禁用插件时遇到错误。\n错误信息：" + e.message);
        }
    }
    async goDie() {
        const mod = require.cache[this.fullpath];
        try {
            for (let bot of this.binds) {
                await this.deactivate(bot);
            }
            if (typeof mod.exports.destructor === "function") {
                const res = mod.exports.destructor();
                if (res instanceof Promise)
                    await res;
            }
        }
        catch { }
        const ix = mod.parent?.children?.indexOf(mod);
        if (ix >= 0)
            mod.parent?.children.splice(ix, 1);
        for (const fullpath in require.cache) {
            if (require.cache[fullpath]?.id.startsWith(mod.path)) {
                delete require.cache[fullpath];
            }
        }
        delete require.cache[this.fullpath];
    }
    async reboot() {
        try {
            const binded = Array.from(this.binds);
            await this.goDie();
            require(this.path);
            for (let bot of binded) {
                await this.activate(bot);
            }
        }
        catch (e) {
            throw new PluginError("重启插件时遇到错误。\n错误信息：" + e.message);
        }
    }
}
/**
 * 导入插件
 * @throws {Error}
 */
async function importPlugin(name) {
    if (plugins.has(name))
        return plugins.get(name);
    let resolved = "";
    const files = await fs_1.default.promises.readdir(path_1.default.join(__dirname, "../plugins"), { withFileTypes: true });
    for (let file of files) {
        if ((file.isDirectory() || file.isSymbolicLink()) && file.name === name) {
            resolved = path_1.default.join(__dirname, "../plugins", name);
        }
    }
    if (!resolved) {
        const modules = await fs_1.default.promises.readdir(path_1.default.join(__dirname, "../node_modules"), { withFileTypes: true });
        for (let file of modules) {
            if (file.isDirectory() && (file.name === name || file.name === "oicq-plugin-" + name)) {
                resolved = file.name;
            }
        }
    }
    if (!resolved)
        throw new PluginError("插件名错误，无法找到此插件");
    try {
        const plugin = new Plugin(name, resolved);
        plugins.set(name, plugin);
        return plugin;
    }
    catch (e) {
        throw new PluginError("导入插件失败，不合法的package\n错误信息：" + e.message);
    }
}
function checkImported(name) {
    if (!plugins.has(name)) {
        throw new PluginError("尚未安装此插件");
    }
    return plugins.get(name);
}
/**
 * 卸载一个插件
 * @throws {Error}
 */
async function deletePlugin(name) {
    await checkImported(name).goDie();
    plugins.delete(name);
}
exports.deletePlugin = deletePlugin;
/**
 * 重启一个插件
 * @throws {Error}
 */
function rebootPlugin(name) {
    return checkImported(name).reboot();
}
exports.rebootPlugin = rebootPlugin;
/**
 * 启用一个插件到bot
 * @throws {Error}
 */
async function activate(name, bot) {
    const plugin = await importPlugin(name);
    return plugin.activate(bot);
}
exports.activate = activate;
/**
 * 禁用一个插件到bot
 * @throws {Error}
 */
function deactivate(name, bot) {
    return checkImported(name).deactivate(bot);
}
exports.deactivate = deactivate;
/**
 * 禁用所有插件
 */
async function deactivateAll(bot) {
    for (let [_, plugin] of plugins) {
        try {
            await plugin.deactivate(bot);
        }
        catch { }
    }
}
exports.deactivateAll = deactivateAll;
/**
 * 查找所有可用插件
 * @throws {Error}
 */
async function findAllPlugins() {
    const plugin_modules = [], node_modules = [];
    const files = await fs_1.default.promises.readdir(path_1.default.join(__dirname, "../plugins"), { withFileTypes: true });
    for (let file of files) {
        if (file.isDirectory() || file.isSymbolicLink()) {
            try {
                require.resolve("../plugins/" + file.name);
                plugin_modules.push(file.name);
            }
            catch { }
        }
    }
    const modules = await fs_1.default.promises.readdir(path_1.default.join(__dirname, "../node_modules"), { withFileTypes: true });
    for (let file of modules) {
        if (file.isDirectory() && file.name.startsWith("oicq-plugin-")) {
            try {
                require.resolve(file.name);
                node_modules.push(file.name);
            }
            catch { }
        }
    }
    return {
        plugin_modules, node_modules, plugins
    };
}
exports.findAllPlugins = findAllPlugins;
/**
 * 机器人实例启动后恢复它原先绑定的插件
 */
async function restorePlugins(bot) {
    const dir = path_1.default.join(bot.dir, "plugin");
    try {
        const arr = JSON.parse(await fs_1.default.promises.readFile(dir, { encoding: "utf8" }));
        for (let name of arr) {
            try {
                const plugin = await importPlugin(name);
                await plugin.activate(bot);
            }
            catch { }
        }
    }
    catch { }
    return plugins;
}
exports.restorePlugins = restorePlugins;
