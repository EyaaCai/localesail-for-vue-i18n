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
| Command and settings namespace | `vueSwiftI18nPlus.*`                                 | `localeSail.*`                                                                                                                             | `package.json`, `src/utils/constant.js`, and `src/utils/index.js`      |

## Icon proof

- Previous `icon.png` SHA-256: `4229B2B28AF4179637323F9D91FF0940434EB98AC00EB54D3F4838200C7D1724`
- Release 0.2.0 `icon.png` SHA-256: `18CCDF6A8D8C88D519691FD20B500DAFCD2D90399DD79D8215EC33EDA911F194`
- The new Marketplace image is rendered from the independently created `icon-source.svg` asset.
- The documentation favicon and logo use the same new asset family.

## Identifier note

The Marketplace extension identifier remains unchanged only so release 0.2.0 can update the suspended listing. The command IDs and configuration keys now use the independent `localeSail.*` namespace, and all user-facing command titles, settings, documentation, iconography, and project links use LocaleSail.

## Required external steps

1. Rename the GitHub repository to `localesail-for-vue-i18n`.
2. Confirm the repository, homepage, and issue URLs above resolve publicly.
3. Push release `0.2.0` and publish or upload the rebuilt VSIX.
4. Capture the updated Marketplace listing and public GitHub repository as screenshots if Support requests visual proof.

## Release verification

- Extension production build: passed with webpack 4.47.0.
- Documentation static build: passed with VuePress 1.9.10.
- VS Code integration tests: 13 passing on VS Code 1.118.1.
- VSIX: `release/localesail-for-vue-i18n-0.2.0.vsix` (71,288 bytes).
- VSIX SHA-256: `9BE1AE76D0398F4880B7936BAD1AE4C191D5DAFFA1A9F81F3FE7AF8CF8D39B02`.
- The packaged manifest, README, extension bundle, and new icon were inspected directly from the VSIX archive.
