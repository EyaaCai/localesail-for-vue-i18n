# LocaleSail for Vue i18n

[English](#localesail-for-vue-i18n) | [中文文档](https://github.com/EyaaCai/localesail-for-vue-i18n/blob/master/docs/README.md)

Turn Chinese interface copy into maintainable Vue locale keys without leaving VS Code.

LocaleSail is focused on one migration workflow: find Chinese text in Vue and TypeScript, write it to a locale JSON file, replace the source text with vue-i18n calls, and optionally split a large locale file into typed modules.

## What LocaleSail does

| Step | Result |
| --- | --- |
| Extract | Finds Chinese copy in Vue templates, attributes, scripts, TypeScript, and template literals. |
| Replace | Converts matching copy to `$t(...)`, `this.$t(...)`, or `t(...)` calls for the current code context. |
| Inspect | Shows locale values for keys in the editor and refreshes the result after edits. |
| Organize | Flattens or restores nested JSON and builds directory-based JavaScript or TypeScript locale modules. |

LocaleSail preserves template interpolation values as i18n parameters, supports Vue 3 `<script setup>`, and can append new entries to existing split modules without replacing their comments or formatting.

## Quick start

1. Install **LocaleSail for Vue i18n** from the Visual Studio Marketplace.
2. Set `localeSail.defaultLocalesPath` if your locale directory is not `src/locales`.
3. Open a `.vue`, `.js`, or `.ts` file and run **LocaleSail: Extract Chinese Copy**.
4. Review the generated locale JSON, then run **LocaleSail: Replace Copy with i18n Keys**.

Release 0.2.0 introduces the independent `localeSail.*` settings namespace. Settings saved under the pre-0.2 namespace must be entered again with the new keys.
Workspace-level settings are now generated as `localesailrc.json`; existing `richierc.json` files remain supported as a compatibility fallback.

## Commands

| Command | Default shortcut |
| --- | --- |
| Extract Chinese Copy | `Ctrl+Alt+U` / `Ctrl+Cmd+U` |
| Replace Copy with i18n Keys | `Ctrl+Alt+I` / `Ctrl+Cmd+I` |
| Preview Translation Values | `Ctrl+Alt+O` / `Ctrl+Cmd+O` |
| Create Workspace Configuration | `Ctrl+Alt+G` / `Ctrl+Cmd+G` |
| Build Split Locale Modules | Explorer or editor context menu on a JSON file |

See [the detailed behavior guide](./README_DETAIL.md) for extraction rules, replacement forms, JSON paths, and all settings.

## Project links

- [Source and documentation](https://github.com/EyaaCai/localesail-for-vue-i18n)
- [Bug reports and feature requests](https://github.com/EyaaCai/localesail-for-vue-i18n/issues)
- [Release history](./CHANGELOG.md)

## License and lineage

LocaleSail for Vue i18n is distributed under the MIT License. It began as a fork of [RichieChoo/vue-swift-i18n](https://github.com/RichieChoo/vue-swift-i18n); the original copyright notice remains in [LICENSE](./LICENSE), and subsequent LocaleSail changes are maintained independently by Eyaa.
