const fs = require('fs');
const path = require('path');
const { workspace } = require('../utils/vs');
const retrieveCN = require('../utils/retrieveCN');
const replaceWithI18nKeys = require('../lib/replaceWithI18nKeys');
const updateJson = require('../lib/updateJson');
const generateI18nFilesLogic = require('../lib/generateI18nFilesLogic');

const SUPPORTED_EXTENSIONS = ['.vue', '.js', '.ts', '.jsx', '.tsx'];
const IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  'coverage',
  '.history',
];

const toText = (payload) => JSON.stringify(payload, null, 2);

const assertTarget = (target) => {
  if (typeof target !== 'string' || target.length === 0) {
    throw new Error('path is required');
  }
  if (!fs.existsSync(target)) {
    throw new Error(`path not found: ${target}`);
  }
  return target;
};

const collectTargetFiles = (target) => {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) {
    throw new Error(`unsupported path type: ${target}`);
  }
  const files = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.indexOf(entry.name) !== -1) return;
        walk(path.join(dir, entry.name));
      } else if (
        entry.isFile() &&
        SUPPORTED_EXTENSIONS.indexOf(path.extname(entry.name)) !== -1
      ) {
        files.push(path.join(dir, entry.name));
      }
    });
  };
  walk(target);
  return files;
};

const extractChinese = async (args) => {
  const target = assertTarget(args.path);
  const files = collectTargetFiles(target);
  const results = [];
  let totalEntries = 0;
  for (const filePath of files) {
    const document = await workspace.openTextDocument(filePath);
    const entriesMap = retrieveCN({ document });
    const entries = Object.values(entriesMap);
    totalEntries += entries.length;
    if (entries.length > 0) {
      results.push({ file: filePath, entries });
    }
  }
  return toText({
    target,
    fileCount: files.length,
    totalEntries,
    files: results,
  });
};

const applyI18nKeys = async (args, context) => {
  const target = assertTarget(args.path);
  const document = await workspace.openTextDocument(target);
  const outcome = await replaceWithI18nKeys({
    editor: { document },
    context,
    headless: true,
  });
  return toText(outcome || { ok: false, error: 'unknown-error' });
};

const writeLocale = async (args, context) => {
  const target = assertTarget(args.path);
  const document = await workspace.openTextDocument(target);
  const outcome = await updateJson({
    editor: { document },
    context,
    headless: true,
    dryRun: Boolean(args.dryRun),
  });
  return toText(outcome || { ok: false, error: 'unknown-error' });
};

const splitLocaleModules = async (args, context) => {
  const target = assertTarget(args.path);
  const outcome = await generateI18nFilesLogic({
    context,
    uri: { fsPath: target },
    headless: true,
    dryRun: Boolean(args.dryRun),
  });
  return toText(outcome || { ok: false, error: 'unknown-error' });
};

const TOOL_DEFINITIONS = [
  {
    name: 'extract_chinese',
    description:
      '扫描指定文件或目录中的中文文案，返回待处理的中文清单（只读，不修改任何文件）。注意：i18n key 在写入语言包（write_locale）时才生成，本工具的返回不包含 key。目录会递归扫描 .vue/.js/.ts/.jsx/.tsx 文件，自动忽略 node_modules、dist 等目录。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件或目录的绝对路径',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'apply_i18n_keys',
    description:
      '把指定文件中已存在于语言包（locale JSON）的中文文案替换为 i18n key 调用（$t/this.$t），并通过编辑器 API 格式化保存。需先通过 LocaleSail 的提取流程把文案写入语言包，否则不会有替换发生。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要替换的 .vue/.js/.ts 文件的绝对路径',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_locale',
    description:
      '扫描指定源码文件中的中文文案，生成 i18n key 并合并写入项目语言包（locale JSON）；已存在相同文案的词条会智能合并。返回值中的 newEntries（key→中文文案映射）为本次实际写入的条目，是后续替换与翻译流程的 key 来源。dryRun=true 时只返回将新增/更新的条目，不修改任何文件。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '源码文件的绝对路径（.vue/.js/.ts）',
        },
        dryRun: {
          type: 'boolean',
          description: '仅预览不写入，默认 false',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'split_locale_modules',
    description:
      '把语言包 JSON 按目录结构拆分为 JS/TS 模块文件（移动语义：成功后清空源 JSON）；需要项目开启 useCompactPathMode。dryRun=true 时只返回拆分计划，不清空、不写入任何文件。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            '语言包源 JSON 的绝对路径（通常为 locales 目录下的 zh-cn.json）',
        },
        dryRun: {
          type: 'boolean',
          description: '仅预览拆分计划，默认 false',
        },
      },
      required: ['path'],
    },
  },
];

const createToolSet = (context) => ({
  listTools: () => TOOL_DEFINITIONS,
  callTool: (name, args) => {
    if (name === 'extract_chinese') return extractChinese(args);
    if (name === 'apply_i18n_keys') return applyI18nKeys(args, context);
    if (name === 'write_locale') return writeLocale(args, context);
    if (name === 'split_locale_modules') return splitLocaleModules(args, context);
    throw new Error(`Unknown tool: ${name}`);
  },
});

module.exports = { createToolSet, TOOL_DEFINITIONS };
