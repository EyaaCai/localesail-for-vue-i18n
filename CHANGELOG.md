# Change Log

## 0.4.2

- **拆分语言包字符串转义修复**：`Build Split Locale Modules` 生成 JS/TS 语言模块时，会正确保留 `\n`、`\r`、单引号、反斜杠和 JS 行分隔字符的转义，避免多行文案破坏字符串语法。
- **生成后格式化增强**：生成拆分语言包后调用宿主项目的 VS Code formatter，并传入目标文件解析出的 `editor.tabSize` / `editor.insertSpaces`，让输出更贴近宿主项目格式规则。
- **自动覆盖预览刷新调整**：inline preview 编辑过程中不再随每次文本变化实时刷新，改为保存文件后刷新，并保留切换编辑器、选区变化和配置变化触发，减少输入时的重复刷新和焦点范围干扰。

## 0.4.1

- **拆分语言包路径别名**：新增 `splitLocalePathAliases` 配置，支持将历史 key 前缀映射到实际拆分语言包目录，例如 `order/components` -> `views/forwarder/order/components`，并按最长前缀优先匹配。
- **预览解析兼容增强**：inline preview 与 hover 在按 key 路径查找失败后，会继续尝试路径别名和当前源码相对路径，不做全量扫描。
- **Hash Key 查找优化**：`useHashKeyOnly` 场景下会额外按当前源码路径生成候选 key，减少未开启紧凑路径模式的历史项目漏查。
- **紧凑路径默认开启**：`useCompactPathMode` 默认值改为 `true`，让新项目默认按相对路径生成更完整、更稳定的 key 层级。
- **文档完善**：补充 `splitLocalePathAliases` 配置说明，并同步紧凑路径模式默认值。

## 0.4.0

- **自动覆盖预览**：新增当前打开文件的 i18n key 翻译覆盖显示，支持聚焦 key 时临时还原源码，左右分屏时非聚焦编辑器继续保留覆盖预览。
- **多语言悬浮详情**：hover 会展示所有可发现语言，优先读取拆分语言包，缺失翻译会明确标识。
- **路径级 key 解析**：支持按 key 路径读取生成后的 JS/TS 拆分语言包，并在降级到 `defaultLocalesPath` 时用 `[D]` 标记。
- **Vue i18n 兼容增强**：支持 `useI18n()` 解构别名、composer 调用，以及可配置的局部翻译函数名。
- **缓存优化**：缓存 locale 文件解析结果，并根据文件修改时间和大小自动失效，减少重复读取和解析。
- **配置清理**：移除 `puidType` 和无效的 `doNotDisturb`，并将 `modulePrefixFoUpdateJson` 改为 `modulePrefixForUpdateJson`。
- **文档整理**：配置说明改为中文，并补充自动预览、拆分语言包、多语言 hover 等说明。

## 0.3.0

- **提取准确性增强**：优化 Vue template 提取逻辑，避免将动态属性表达式、已国际化函数调用、多行 `{{ }}` 插值表达式、多行动态属性值误提取成整段代码结构。
- **静态文案提取优化**：Vue 文本插值现在只提取静态中文片段，例如 `发运单号：{{ detail.carriageId }}` 会提取为 `发运单号：`。
- **忽略下一行**：新增 `LocaleSail: Ignore Next Line` 命令，并支持 `localesail-disable-next-line` 注释跳过下一行的提取和替换。
- **可配置 Hash 长度**：新增 `localeSail.hashLength` 配置，默认生成 8 位 hash key，支持 6 到 24 位，并会避开当前 locale scope 下已有 key。
- **替换风格复用**：替换源码时会优先复用当前文件已有的 `$t(...)`、`this.$t(...)`、`i18n.t(...)`、`t(...)` 或 `useI18n` 别名，避免 Vue 3 项目被强制替换成未定义的 `t(...)`。
- **右键菜单整理**：保留提取、替换、生成拆分语言包为一级右键入口，低频功能收进 `LocaleSail` 子菜单。
- **中文文档完善**：根 README 改为中文默认文档，补充安装、使用教程、提取规则、忽略注释、Hash 长度、按 key 路径生成拆分语言包等说明。

## 0.2.0

- **Independent Brand**: Renamed the user-facing extension to `LocaleSail for Vue i18n` with a new description, overview, command labels, documentation identity, and original icon family.
- **Project Links**: Moved repository, homepage, and issue metadata to the distinct `EyaaCai/localesail-for-vue-i18n` URL.
- **Independent Namespace**: Replaced the previous command and configuration prefixes with `localeSail.*`; settings saved by pre-0.2 releases must be entered again under the new keys.
- **Workspace Config**: Renamed the generated workspace config file to `localesailrc.json`; existing `richierc.json` files are still read for compatibility.

## 0.1.4

- **Attribute Extraction Fix**: Prevented standalone Vue attribute lines such as `label="中文"` from being extracted as template text.
- **Split File Formatting Fix**: `Generate Split I18n Files` now opens newly-created files before formatting and retries once when the formatter is not ready, avoiding first-run formatting failures.
- **Test Harness Fix**: Restored the missing test root path so extension tests can run reliably.

## 0.1.3

- **Template Interpolation**: Extraction and replacement now understand Vue template text around `{{ }}` and preserve interpolation expressions as i18n params.
- **Literal Extraction**: Template literals with Chinese fallback text inside interpolation expressions are now extracted more completely.
- **Mixin Awareness**: Script replacement now prefers `this.$t(...)` for mixin-style files.
- **Hover Refresh**: `Show I18n Translate Detail` refreshes automatically after edits and avoids stale notifications.
- **Split File Safety**: `Generate Split I18n Files` only clears the source JSON after formatting succeeds.

## 0.1.2

- **I18n Detail Fixes**: Fixed `Show I18n Translate Detail` and hover lookup for `t(...)`, `$t(...)`, `this.$t(...)`, and `i18n.t(...)` calls.
- **Hash Key Lookup**: Added fallback lookup for hash-only keys such as `t('6gt5yaxm60k0')` when locale JSON stores the full nested path.
- **Template Literal Support**: Preserved template literal interpolations as i18n params during extraction and replacement.
- **Config Generation**: Completed `richierc.json` generation so it includes every contributed configuration key.
- **Windows Path Fixes**: Improved command handling from Explorer context menus by using filesystem paths.

## 0.1.0

- **Rebranding**: Extension renamed to `Vue Swift i18n Plus` (eyaa edition).
- **Support Vue3 and TypeScript(Vue 3 and TypeScript)**: Support TypeScript and Vue 3 script setup internationalization scheme.
- **Core Enhancement**: Optimized `getLocales` and `getCustomSetting` to support live configuration updates without restarting the extension.
- **New Feature**: Added `Generate Split I18n Files` command.
  - Support automatic splitting of flat JSON into directory-based JS/TS modules.
  - **Smart Append Object**: When files already exist, the tool now identifies new keys and appends them to the end of the Export Object, preserving all original comments and formatting.
- **Bug Fixes**: Fixed `safeEval` syntax errors during existing file parsing.
- **Cleanup**: Removed unused dependencies and cleaned up internal utility modules.

---

_Based on the original work of RichieChoo (vue-swift-i18n)._
