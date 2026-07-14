# Change Log

## 0.2.0

- **Independent Brand**: Renamed the user-facing extension to `LocaleSail for Vue i18n` with a new description, overview, command labels, documentation identity, and original icon family.
- **Project Links**: Moved repository, homepage, and issue metadata to the distinct `EyaaCai/localesail-for-vue-i18n` URL.
- **Independent Namespace**: Replaced the previous command and configuration prefixes with `localeSail.*`; settings saved by pre-0.2 releases must be entered again under the new keys.

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
