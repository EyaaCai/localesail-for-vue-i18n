# Change Log

## 0.5.0

- **MCP 服务（AI 集成）**：扩展内置仅监听 `127.0.0.1` 的 MCP 服务（访问令牌鉴权），本机 AI 客户端可通过四个工具调用 LocaleSail 能力：`extract_chinese`（扫描中文清单，只读）、`write_locale`（生成 key 写入语言包）、`apply_i18n_keys`（替换为 i18n key 调用）、`split_locale_modules`（拆分语言包模块，支持 `dryRun` 预览）；新增 `localeSail.mcp.enabled` / `localeSail.mcp.port` 配置项与 `LocaleSail: Copy MCP Configuration` / `LocaleSail: Show MCP Status` 命令。
- **写入方式统一切换到编辑器 API**：`Replace Copy with i18n Keys`、`Extract Chinese Copy`、`Build Split Locale Modules` 的写回均改为通过编辑器 API（WorkspaceEdit）应用，交互行为保持不变；解决了IDE"文件已被外部修改"的保存冲突提示，也支持无可见编辑器的自动化调用场景。
- **key 前缀与错误处理增强**：操作的文件不属于当前工作区时（例如 AI 通过绝对路径处理其他项目），改为向上查找 `package.json` 定位项目根，保证紧凑路径 key 前缀完整；无法定位项目根时 MCP 工具明确报错（`no-project-root`）而不是静默降级为文件名前缀；同时修复了非项目文件向上查找配置时的无限递归问题。
- **替换翻译函数跟随文件内声明**：`Replace Copy with i18n Keys` 与 MCP `apply_i18n_keys` 现在会解析文件里已声明的翻译函数并优先复用：`useI18n` 解构（含 `const { t: tt }` 别名）与 `localeSail.scopedTranslateFunctionNames` 配置的局部翻译函数（默认 `useLocale`，声明的 scope 与当前文件 key 前缀一致时启用），覆盖 `$t`、自定义名（如 `originT`）与 `x.t` 调用形态；Vue 3 `<script setup>` 的模板与脚本不再在有可用声明时产出未定义的 `t(...)`。无现成声明与调用时保持原有默认逻辑。
- **MCP 批量调用与耗时可观测**：`extract_chinese` / `write_locale` / `apply_i18n_keys` 新增 `paths` 入参，可一次传入本轮全部文件与目录（`path` 单路径用法保持不变）：`write_locale` 批量按顺序写入暂存保证一致，`extract_chinese` / `apply_i18n_keys` 批内限流并发；批量结果按文件返回（含 `prefix`、`newEntries`、`ms`），返回值统一含 `timing`；每次调用的工具名、文件数与耗时记录到 `LocaleSail MCP` 输出通道，便于定位慢点。

## 0.4.5

- **字符串转义还原**：提取 JS 字符串、Vue 模板文本、插值字面和属性值中的 `\n`、`\t`、`\\` 等转义序列时还原为运行时值，语言包中不再出现 `\\n`；替换功能按还原值匹配词条，重新提取时旧字面值词条自动合并清理。
- **格式化缩进跟随宿主项目**：生成拆分语言包、替换后的格式化缩进改为检测目标目录附近已有文件的实际风格（2/4 空格、tab 缩进），不再取 `editor.tabSize` 的默认值；初始写入缩进同步适配，formatter 未生效时兜底输出也不偏离项目风格。

## 0.4.4

- **Replace Copy 翻译函数修复**：Vue 2 template 使用 `$t(...)`，Vue 3 `<script setup>` template 使用 `t(...)`，并正确区分 Options API 的 `setup()` 函数。
- **替换后自动处理**：`Replace Copy with i18n Keys` 替换完成后自动格式化并保存，保存暂时失败时会自动重试，最终失败会明确提示。
- **拆分语言包格式化稳定性**：`Build Split Locale Modules` 在 formatter 尚未就绪时自动重试，并保存最新文档模型，减少部分文件格式化失败或结果未落盘的问题。

## 0.4.3

- **Key Definition Jump**：光标位于国际化 key 时，支持按 `F12` 或 `Ctrl+左键`跳转到对应语言文件中的 key 定义位置；兼容拆分后的 JS/TS 语言模块、JSON 语言包、嵌套 key、短 hash key、局部翻译函数和路径别名。
- **Vue Setup 提取增强**：同时支持 Vue SFC 中的 `<script setup>`、多个 `<script>` 块和 Options API `setup()` 函数，并根据实际代码上下文选择合适的翻译函数。
- **拆分语言包生成修复**：生成或追加语言模块时支持合法的裸属性 key，保留已有模板字符串和原始格式，避免多行文案被破坏。
- **Inline Preview 刷新修复**：国际化 key 新增、修改或删除后能够正确更新当前文件的翻译覆盖预览。
- **测试环境改进**：扩展测试改为使用本机 VS Code 和隔离测试数据目录，不再自动下载固定版本的 VS Code。

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
