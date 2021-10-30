import fs from "fs"
import path from "path"
import oicq from "oicq"

/**
 * 导入的插件
 */
const plugins = new Map<string, Plugin>()

class PluginError extends Error {
    name = "PluginError"
}

class Plugin {
    protected readonly fullpath: string
    readonly binds = new Set<oicq.Client>()

    constructor(protected readonly name: string, protected readonly path: string) {
        this.fullpath = require.resolve(this.path)
        require(this.path)
    }

    protected async _editBotPluginCache(bot: oicq.Client, method: "add" | "delete") {
        const dir = path.join(bot.dir, "plugin")
        let set: Set<string>
        try {
            const arr = JSON.parse(await fs.promises.readFile(dir, { encoding: "utf8" })) as string[]
            set = new Set(arr)
        } catch {
            set = new Set
        }
        set[method](this.name)
        return fs.promises.writeFile(dir, JSON.stringify(Array.from(set), null, 4))
    }

    async activate(bot: oicq.Client) {
        if (this.binds.has(bot)) {
            throw new PluginError("这个机器人实例已经启用了此插件")
        }
        const mod = require.cache[this.fullpath]
        if (typeof mod?.exports.activate !== "function") {
            throw new PluginError("此插件未导出activate方法，无法启用。")
        }
        try {
            const res = mod?.exports.activate(bot)
            if (res instanceof Promise)
                await res
            await this._editBotPluginCache(bot, "add")
            this.binds.add(bot)
        } catch (e: any) {
            throw new PluginError("启用插件时遇到错误。\n错误信息：" + e.message)
        }
    }

    async deactivate(bot: oicq.Client) {
        if (!this.binds.has(bot)) {
            throw new PluginError("这个机器人实例尚未启用此插件")
        }
        const mod = require.cache[this.fullpath]
        if (typeof mod?.exports.deactivate !== "function") {
            throw new PluginError("此插件未导出deactivate方法，无法禁用。")
        }
        try {
            const res = mod?.exports.deactivate(bot)
            if (res instanceof Promise)
                await res
            await this._editBotPluginCache(bot, "delete")
            this.binds.delete(bot)
        } catch (e: any) {
            throw new PluginError("禁用插件时遇到错误。\n错误信息：" + e.message)
        }
    }

    async goDie() {
        const mod = require.cache[this.fullpath] as NodeJS.Module
        try {
            for (let bot of this.binds) {
                await this.deactivate(bot)
            }
            if (typeof mod.exports.destructor === "function") {
                const res = mod.exports.destructor()
                if (res instanceof Promise)
                    await res
            }
        } catch { }
        const ix = mod.parent?.children?.indexOf(mod) as number;
        if (ix >= 0)
            mod.parent?.children.splice(ix, 1);
        for (const fullpath in require.cache) {
            if (require.cache[fullpath]?.id.startsWith(mod.path)) {
                delete require.cache[fullpath]
            }
        }
        delete require.cache[this.fullpath];
    }

    async reboot() {
        try {
            const binded = Array.from(this.binds)
            await this.goDie()
            require(this.path)
            for (let bot of binded) {
                await this.activate(bot)
            }
        } catch (e: any) {
            throw new PluginError("重启插件时遇到错误。\n错误信息：" + e.message)
        }
    }
}

/**
 * 导入插件
 * @throws {Error}
 */
async function importPlugin(name: string) {
    if (plugins.has(name))
        return plugins.get(name) as Plugin
    let resolved = ""
    const files = await fs.promises.readdir(
        path.join(__dirname, "../plugins"),
        { withFileTypes: true }
    )
    for (let file of files) {
        if ((file.isDirectory() || file.isSymbolicLink()) && file.name === name) {
            resolved = path.join(__dirname, "../plugins", name)
        }
    }
    if (!resolved) {
        const modules = await fs.promises.readdir(
            path.join(__dirname, "../node_modules"),
            { withFileTypes: true }
        )
        for (let file of modules) {
            if (file.isDirectory() && (file.name === name || file.name === "oicq-plugin-" + name)) {
                resolved = file.name
            }
        }
    }
    if (!resolved)
        throw new PluginError("插件名错误，无法找到此插件")
    try {
        const plugin = new Plugin(name, resolved)
        plugins.set(name, plugin)
        return plugin
    } catch (e: any) {
        throw new PluginError("导入插件失败，不合法的package\n错误信息：" + e.message)
    }
}

function checkImported(name: string) {
    if (!plugins.has(name)) {
        throw new PluginError("尚未安装此插件")
    }
    return plugins.get(name) as Plugin
}

/**
 * 卸载一个插件
 * @throws {Error}
 */
export async function deletePlugin(name: string) {
    await checkImported(name).goDie()
    plugins.delete(name)
}

/**
 * 重启一个插件
 * @throws {Error}
 */
export function rebootPlugin(name: string) {
    return checkImported(name).reboot()
}

/**
 * 启用一个插件到bot
 * @throws {Error}
 */
export async function activate(name: string, bot: oicq.Client) {
    const plugin = await importPlugin(name)
    return plugin.activate(bot)
}

/**
 * 禁用一个插件到bot
 * @throws {Error}
 */
export function deactivate(name: string, bot: oicq.Client) {
    return checkImported(name).deactivate(bot)
}

/**
 * 禁用所有插件
 */
export async function deactivateAll(bot: oicq.Client) {
    for (let [_, plugin] of plugins) {
        try {
            await plugin.deactivate(bot)
        } catch { }
    }
}

/**
 * 查找所有可用插件
 * @throws {Error}
 */
export async function findAllPlugins() {
    const plugin_modules: string[] = [], node_modules: string[] = []
    const files = await fs.promises.readdir(
        path.join(__dirname, "../plugins"),
        { withFileTypes: true }
    )
    for (let file of files) {
        if (file.isDirectory() || file.isSymbolicLink()) {
            try {
                require.resolve("../plugins/" + file.name)
                plugin_modules.push(file.name)
            } catch { }
        }
    }
    const modules = await fs.promises.readdir(
        path.join(__dirname, "../node_modules"),
        { withFileTypes: true }
    )
    for (let file of modules) {
        if (file.isDirectory() && file.name.startsWith("oicq-plugin-")) {
            try {
                require.resolve(file.name)
                node_modules.push(file.name)
            } catch { }
        }
    }
    return {
        plugin_modules, node_modules, plugins
    }
}

/**
 * 机器人实例启动后恢复它原先绑定的插件
 */
export async function restorePlugins(bot: oicq.Client) {
    const dir = path.join(bot.dir, "plugin")
    try {
        const arr = JSON.parse(await fs.promises.readFile(dir, { encoding: "utf8" })) as string[]
        for (let name of arr) {
            try {
                const plugin = await importPlugin(name)
                await plugin.activate(bot)
            } catch { }
        }
    } catch { }
    return plugins
}
