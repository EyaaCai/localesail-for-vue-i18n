# 插件详述

> 约定：**汉字**--`汉字开头的连续非空字符串`

## 一、Json 生成，更新(Ctrl+Alt+U)

### 1.汉字检索原则

- 位于 `<template></template>`中的汉字，如 `<span>汉字123</span>`
- 位于 `<template></template>`中的标签属性的汉字，如 `<span title="汉字"></span>`
- 位于 `<template></template>`中的 `{{`与 `}}`之间的汉字，如 `<span>{{test ? "汉字" : "中文" }}</span>`，同时会保留插值里的静态中文文本，如 `<span>发运单号：{{ detail.carriageId }}</span>`
- 位于 `<script></script>`中的 `"`与 `"`之间的汉字，`'`与 `'`之间的**汉字**，并支持模板字符串中的插值参数与兜底中文提取
- 过滤单行注释

### 2. 生成更新 Json 路径配置,见[路径及 JSON](#r4EQa)

### 3. 生成更新原则

- 当 json 为空或者文件不存在，将检测的**汉字**当做 value，将[`modulePrefix`].[`parents(level 读取)`].[`当前 vue 文件名字`]+唯一 Id 当做 key，存储在 json 中
- 当 json 文件不为空，执行智能替换

  备注：主要是防止国际化后，执行 JSON 生成命令误操作，会导致 json 数据为空或错误
- 智能替换：

  i. 相同 val 时，新的 key,val 替换原来的 key,val

  ii. 不同 val 时，保存新增 key,val 和原有的 key,val

## 二、国际化替换(Ctrl+Alt+I)

### 1. 替换原则

- 汉字检索原则 1，**汉字 123**替换为  **`{{$t('unique-key')}}`**
- 汉字检索原则 2，**`title="汉字"`**  替换为  **`:title="$t('unique-key')"`**
- 汉字检索原则 3，**汉字**替换为 **`$t('unique-key')`**
- 汉字检索原则 4，**汉字**替换为 **`this.$t('unique-key')`**，在 mixin 文件中也会优先使用这个写法
- TypeScript、`<script setup>` 场景会优先替换为 **`t('unique-key')`**
- 模板字符串中的插值会转换为 i18n 参数，例如 **`` `本次共打印${count}个订单` ``** 会提取为 **`本次共打印{0}个订单`**，并替换为 **`t('unique-key', [count])`**；如果插值表达式里还包含中文兜底文本，也会单独提取

### 2. 相关正则，见[源码](https://github.com/EyaaCai/localesail-for-vue-i18n/blob/master/src/utils/regex.js)

### 3. 替换依据 Json,见[路径及 JSON](#r4EQa)

## 三、国际化提示(Ctrl+Alt+O)

### 1. 提示原则

- 支持识别 **`$t('key')`**、**`this.$t('key')`**、**`t('key')`**、**`i18n.t('key')`**
- 支持短 key 回查完整路径。例如代码中使用 **`t('6gt5yaxm60k0')`**，JSON 中实际保存为 **`views.account.print_page.print_invoice.index.6gt5yaxm60k0`** 时，也会展示对应翻译
- 用新生成的唯一 key 或短 hash key 来标识，为了防止 json 中的 key 被使用多次
- 编辑内容后会自动刷新提示结果，无需重复手动执行查看命令

### 2. 提示依据 Json,见[路径及 JSON](#r4EQa)

## 四、Json 扁平处理

### 1. 扁平化原则：

- 将所有的有 value 的 key 的所有父对象和 key 用 `.`连接
- Json 扁平处理没有提供快捷键，通过右键文件夹或者 json 文件来执行命令

### 2. 扁平依据选中 json，生成/更新 xxx_flat.json 与 json 文件路径同级

## 五、路径及 JSON

> 根目录：认定当前项目 `package.json`为根目录

> 当前文件：执行 Json 生成等命令所在的文件

### 1. 路径

- 默认路径：**`[根目录]/src/locales/zh-cn.json`** 为默认 json 路径
- 提供字符串配置项：**`Default Locales Path`**,如"test",则对应的 json 路径：**`[根目录]/``test/zh-cn.json`**

### 2. json 文件的属性名及 value

- 默认：**[当前文件的父文件夹名].[当前文件名(无后缀)]**

  到父文件夹名之前
- 其他配置项：

  -**`Default Locales Path`**，默认 `src/locales`，指定语言包目录

  -**`Lang File`**，默认 `zh-cn.json`，指定语言包文件名

  -**`Puid Type`**，默认 `short`，指定生成 key 的随机 ID 类型

  -**`Not Alert Before Update I18n`**，默认提示，若为 true 则会直接更新 json 不弹窗提醒

  -**`Do Not Disturb`**,默认 false,若为 true 则会关闭任何命令提醒

  -**`I18n Value Hover`**，默认 true,开启悬浮提示框功能

  -**`Module Prefix Fo Update Json`**，默认空，生成 JSON key 时添加模块前缀

  -**`Not Use File Name As Key`**，默认 false，是否不使用当前文件名作为 key 层级

  -**`File Name Substitute`**，默认 `components`，当不使用文件名且没有其它前缀时的替代层级

  -**`Parent Dir Level`**，默认 1，生成 key 时读取上级目录的层级数

  -**`Use Compact Path Mode`**，默认 false，开启后按相对路径生成更完整的 key 层级

  -**`Use Compact Mode Base Path`**，默认 `src`，紧凑路径模式的基准路径

  -**`Use Hash Key Only`**，默认 false，代码替换时只使用短 hash key，JSON 中仍保存完整路径

  -**`Generate I18n Files Output Dir`**，默认 `src/i18n/lang/zh-cn`，拆分 i18n 文件输出目录

  -**`Generate I18n Files Ext`**，默认 `auto`，拆分 i18n 文件后缀，可选 `auto`、`js`、`ts`

### 3. localesailrc.json

- 可通过 **LocaleSail: Create Workspace Configuration** 生成项目级配置文件 `localesailrc.json`

-`localesailrc.json` 优先级高于 VSCode 全局配置

-`localesailrc.json` 每次执行命令或触发 hover 时都会重新读取，不需要重启扩展
