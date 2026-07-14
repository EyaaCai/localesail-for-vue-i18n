# 插件配置

## defaultLocalesPath

- 类型：`string`
- 默认值：`src/locales`
- 描述：指定 LocaleSail 提取文案和预览翻译值时使用的 locale JSON 目录。

## doNotDisturb

- 类型：`boolean`
- 默认值：`false`
- 描述：执行命令时候是否弹窗提醒。

## i18nValueHover

- 类型：`boolean`
- 默认值：`true`
- 描述：是否开启悬浮展示 key/value 及跳转功能。

## langFile

- 类型：`string`
- 默认值：`zh-cn.json`
- 描述：指定国际化 JSON 文件名称。

## puidType

- 类型：`string`
- 默认值：`short`
- 描述：为国际化 JSON 的 value 生成唯一 key 的类型，默认为 short，长度为 12，一般不需要配置。

## modulePrefixFoUpdateJson

- 类型：`string`
- 默认值：`""`
- 描述：更新国际化 JSON 时以此前缀当做模块前缀，默认为空，当一个项目有多个 vue 模块，每个模块都有对应的国际化需求时，推荐使用单独的配置文件[richierc.json]()。

## notAlertBeforeUpdateI18n

- 类型：`boolean`
- 默认值：`false`
- 描述：更新国际化 JSON 时是否禁止展示更新文件地址，默认展示。

## notUseFileNameAsKey

- 类型：`boolean`
- 默认值：`false`
- 描述：是否使用文件名作为 key 前缀，默认是。

## fileNameSubstitute

- 类型：`string`
- 默认值：`components`
- 描述：当**notUseFileNameAsKey**为 true 生效，作为 fileName 的替代使用。

## parentDirLevel

- 类型：`number`
- 默认值：`1`
- 描述：更新国际化 JSON 时会以父文件夹及文件名为 `scope`,防止不同文件更新 JSON 相互干扰，此配置为父文件夹得层级，默认为 `1`。比如 `HelloWord.vue`在 `src/components`文件夹下：则对应 scope 如下所示：

  ```bash
  {
      "components":{
          "HelloWord":{
              // HelloWord.vue 的 scope
          }
      }
  }

  ```

## useCompactPathMode

- 类型：`boolean`
- 默认值：`false`
- 描述：是否开启**紧凑路径模式**。开启后，将根据相对路径自动生成多层级 Key，有效防止不同目录下同名文件的 Key 冲突。

## useCompactModeBasePath

- 类型：`string`
- 默认值：`src`
- 描述：紧凑路径模式的基准路径。

## generateI18nFilesOutputDir

- 类型：`string`
- 默认值：`src/i18n/lang/zh-cn`
- 描述：执行“生成拆分 i18n 文件”命令时，拆分出的 JS/TS 模块文件的输出根目录。

## generateI18nFilesExt

- 类型：`string (auto | js | ts)`
- 默认值：`auto`
- 描述：生成拆分文件的后缀名。设置为 `auto` 时将根据项目根目录是否存在 `tsconfig.json` 自动识别。

::: tip 提示
在 VSCode 的设置面板中，所有配置项均以 `localeSail.` 作为前缀。
:::
