### **自用小型插件式QQ机器人框架**

[![node engine](https://img.shields.io/badge/node-%3E%20v14-green)](https://nodejs.org)
[![discord](https://img.shields.io/static/v1?label=chat&message=discord&color=7289da&logo=discord)](https://discord.gg/gKnU7BARzv)

> 多号并行，无依赖，使用 JavaScript/TypeScript 编写插件。

----

无任何界面和控制台，完全使用QQ消息来控制框架。  
框架只实现了以下最基本的功能，其他所有功能都必须用插件的形式来实现。

* 登录和上下线广播
* 为每个机器人实例绑定不同插件（多对多），以及热重载插件

**配置文件 `config.json` 的参数：**

`eins` 用于启动框架的第一个机器人账号  
`masters` 拥有管理权限的用户组账号  
`prefix` 系统指令触发前缀  
`platform` 每次创建新机器人实例时的默认登录协议(1:手机、4:PC、5:平板)  
`log_level` 每次创建新机器人实例时的默认日志等级  

**开始运行：**

```bash
> npm i
> ./run
```

> 启动后通过给 eins 发消息来启用/卸载插件，以及登录新的账号

----

插件为标准npm-package的形式，可放在 `plugins` 或 `node_modules` 目录下  
插件若需要存储数据，推荐新建目录 `./data/plugins/{package_name}`  
插件需要`export`下面三个方法：

* `activate(bot)` 当一个机器人实例启用插件时触发
* `deactivate(bot)` 当一个机器人实例禁用插件时触发
* `destructor()` 重载或卸载插件时触发，用于释放资源(可选)

> [插件开发样例](./plugins)

**注意事项：**

* 插件目前也在主线程中运行，若出现未捕获的错误可能会导致程序崩溃
  * 如果你想要一个更健壮的环境，可以看一下 [Steve-xmh/neonbot](https://github.com/Steve-xmh/neonbot)  
* 程序启动/重启时，只会登录第一个账号(eins)，其它账号需要通过给eins发消息来登录（不会自动登录）
  * 不自动登录的原因是防止多号情况下瞬间登录过多账号导致出现被封号的风险
