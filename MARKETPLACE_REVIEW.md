# VS Marketplace rebrand evidence

Support reference: `655cd9f9`

This document maps every item requested by VS Marketplace Support to its implementation in release `0.2.0`. The GitHub repository must be renamed and these changes must be pushed before the response below is sent.

## Change evidence

| Requested area                 | Previous value                                         | Release 0.2.0 value                                                                                                                          | Evidence                                                                     |
| ------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Display name                   | `Vue Swift i18n Plus`                                | `LocaleSail for Vue i18n`                                                                                                                  | `package.json` -> `displayName`                                          |
| Description                    | Generic enhanced i18n automation wording               | `Migrate Chinese Vue and TypeScript UI copy to vue-i18n keys, then organize locale JSON as split JS or TS modules.`                        | `package.json` -> `description`                                          |
| Repository URL                 | `https://github.com/EyaaCai/vue-swift-i18n-plus.git` | `https://github.com/EyaaCai/localesail-for-vue-i18n.git`                                                                                   | `package.json` -> `repository.url`                                       |
| Homepage URL                   | Old repository README URL                              | `https://github.com/EyaaCai/localesail-for-vue-i18n#readme`                                                                                | `package.json` -> `homepage`                                             |
| Issue URL                      | Old repository issue tracker                           | `https://github.com/EyaaCai/localesail-for-vue-i18n/issues`                                                                                | `package.json` -> `bugs.url`                                             |
| Icon                           | Upstream-style black globe                             | Original LocaleSail sail-and-locale-path mark                                                                                                | `icon.png`, `icon-source.svg`, `icon-light.svg`, and `icon-dark.svg` |
| Overview                       | Short “enhanced fork” summary                        | New workflow-led product overview, command table, Chinese-documentation link, project links, migration note, and transparent lineage section | `README.md`                                                                |
| Extension identifier           | `Eyaa.vue-swift-i18n-plus`                            | `Eyaa.localesail-for-vue-i18n`                                                                                                             | `package.json` -> `publisher` + `name`                                  |
| Command and settings namespace | `vueSwiftI18nPlus.*`                                 | `localeSail.*` with LocaleSail command names and compatibility aliases for 0.2.0 IDs                                                       | `package.json`, `src/utils/constant.js`, and `src/utils/index.js`      |
| Workspace config file          | `richierc.json`                                      | `localesailrc.json`, with `richierc.json` still read as a compatibility fallback                                                           | `src/utils/constant.js`, `src/utils/index.js`                           |

## Icon proof

- Previous `icon.png` SHA-256: `4229B2B28AF4179637323F9D91FF0940434EB98AC00EB54D3F4838200C7D1724`
- Release 0.2.0 `icon.png` SHA-256: `18CCDF6A8D8C88D519691FD20B500DAFCD2D90399DD79D8215EC33EDA911F194`
- The new Marketplace image is rendered from the independently created `icon-source.svg` asset.
- The documentation favicon and logo use the same new asset family.

## Identifier note

The Marketplace extension identifier is now `Eyaa.localesail-for-vue-i18n`. The command IDs and configuration keys use the independent `localeSail.*` namespace, user-facing command names use LocaleSail terminology, and legacy 0.2.0 command IDs remain registered only as compatibility aliases.

## Required external steps

1. Rename the GitHub repository to `localesail-for-vue-i18n`.
2. Confirm the repository, homepage, and issue URLs above resolve publicly.
3. Push release `0.2.0` and publish or upload the rebuilt VSIX.
4. Capture the updated Marketplace listing and public GitHub repository as screenshots if Support requests visual proof.

## Release verification

- Extension production build: passed with webpack 4.47.0.
- Documentation static build: not rerun during this migration pass.
- VS Code integration tests: not completed because `vscode-test` could not resolve the VS Code archive location after network access was allowed.
- VSIX: `release/localesail-for-vue-i18n-0.2.0.vsix` (71,511 bytes).
- VSIX SHA-256: `4A078AC795072E907696CE49A2646B08026059872E14CDDFC1635950F7A1D120`.
- The packaged manifest, README, extension bundle, and new icon were inspected directly from the VSIX archive.
