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
const FILE_CONCURRENCY = 4;

const toText = (payload) => JSON.stringify(payload);

const messageOf = (error) => (error && error.message ? error.message : String(error));

const mapLimit = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const lane = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  };
  const laneCount = Math.min(Math.max(limit, 1), items.length);
  const lanes = [];
  for (let i = 0; i < laneCount; i++) {
    lanes.push(lane());
  }
  await Promise.all(lanes);
  return results;
};

const assertTarget = (target) => {
  if (typeof target !== 'string' || target.length === 0) {
    throw new Error('path is required');
  }
  if (!fs.existsSync(target)) {
    throw new Error(`path not found: ${target}`);
  }
  return target;
};

const resolveBatchTargets = (args) => {
  const paths = args && args.paths;
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('paths must be a non-empty array of file or directory paths');
  }
  paths.forEach((item) => {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error('paths items must be non-empty strings');
    }
  });
  return paths;
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

const collectFilesFromTargets = (targets) => {
  const files = [];
  const errors = [];
  targets.forEach((target) => {
    if (!fs.existsSync(target)) {
      errors.push({ path: target, error: 'path-not-found' });
      return;
    }
    try {
      collectTargetFiles(target).forEach((file) => files.push(file));
    } catch (error) {
      errors.push({ path: target, error: messageOf(error) });
    }
  });
  return { files: Array.from(new Set(files)), errors };
};

const scanFile = async (filePath) => {
  const startedAt = Date.now();
  try {
    const document = await workspace.openTextDocument(filePath);
    const entriesMap = retrieveCN({ document });
    return Object.assign(
      { file: filePath, entries: Object.values(entriesMap) },
      { ms: Date.now() - startedAt },
    );
  } catch (error) {
    return {
      file: filePath,
      entries: [],
      error: messageOf(error),
      ms: Date.now() - startedAt,
    };
  }
};

const extractChinese = async (args) => {
  const batch = Array.isArray(args && args.paths);
  let singleTarget = null;
  let targets;
  if (batch) {
    targets = resolveBatchTargets(args);
  } else {
    singleTarget = assertTarget(args && args.path);
    targets = [singleTarget];
  }
  const { files, errors } = collectFilesFromTargets(targets);
  const results = await mapLimit(files, FILE_CONCURRENCY, scanFile);
  const fileResults = results.filter((item) => item.entries.length > 0 && !item.error);
  const totalEntries = results.reduce((sum, item) => sum + item.entries.length, 0);
  const payload = batch
    ? { targets, fileCount: files.length, totalEntries, files: fileResults }
    : { target: singleTarget, fileCount: files.length, totalEntries, files: fileResults };
  const allErrors = errors.concat(
    results
      .filter((item) => item.error)
      .map((item) => ({ path: item.file, error: item.error })),
  );
  if (allErrors.length > 0) payload.errors = allErrors;
  return payload;
};

const applyOne = async (target, context) => {
  const startedAt = Date.now();
  if (!fs.existsSync(target)) {
    return { file: target, ok: false, error: 'path-not-found', ms: Date.now() - startedAt };
  }
  try {
    const document = await workspace.openTextDocument(target);
    const outcome = await replaceWithI18nKeys({
      editor: { document },
      context,
      headless: true,
    });
    return Object.assign(
      { file: target, ms: Date.now() - startedAt },
      outcome || { ok: false, error: 'unknown-error' },
    );
  } catch (error) {
    return { file: target, ok: false, error: messageOf(error), ms: Date.now() - startedAt };
  }
};

const applyI18nKeys = async (args, context) => {
  if (!Array.isArray(args && args.paths)) {
    const target = assertTarget(args && args.path);
    return applyOne(target, context);
  }
  const targets = resolveBatchTargets(args);
  const results = await mapLimit(targets, FILE_CONCURRENCY, (target) =>
    applyOne(target, context),
  );
  const okCount = results.filter((item) => item.ok).length;
  return {
    totalFiles: results.length,
    okCount,
    failedCount: results.length - okCount,
    ok: okCount === results.length,
    results,
  };
};

const writeOne = async (target, context, dryRun) => {
  const startedAt = Date.now();
  if (!fs.existsSync(target)) {
    return { file: target, ok: false, error: 'path-not-found', ms: Date.now() - startedAt };
  }
  try {
    const document = await workspace.openTextDocument(target);
    const outcome = await updateJson({
      editor: { document },
      context,
      headless: true,
      dryRun,
    });
    return Object.assign(
      { file: target, ms: Date.now() - startedAt },
      outcome || { ok: false, error: 'unknown-error' },
    );
  } catch (error) {
    return { file: target, ok: false, error: messageOf(error), ms: Date.now() - startedAt };
  }
};

// 暂存 JSON 的读改写必须串行，批量与并发调用共用同一把进程内锁
let stagingWriteQueue = Promise.resolve();

const withStagingWriteLock = (task) => {
  const next = stagingWriteQueue.then(() => task());
  stagingWriteQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};

const writeLocale = async (args, context) => {
  const dryRun = Boolean(args && args.dryRun);
  if (!Array.isArray(args && args.paths)) {
    const target = assertTarget(args && args.path);
    return withStagingWriteLock(() => writeOne(target, context, dryRun));
  }
  const targets = resolveBatchTargets(args);
  return withStagingWriteLock(async () => {
    const results = [];
    for (const target of targets) {
      results.push(await writeOne(target, context, dryRun));
    }
    const okCount = results.filter((item) => item.ok).length;
    return {
      dryRun,
      totalFiles: results.length,
      okCount,
      failedCount: results.length - okCount,
      ok: okCount === results.length,
      results,
    };
  });
};

const splitLocaleModules = async (args, context) => {
  const target = assertTarget(args.path);
  const outcome = await generateI18nFilesLogic({
    context,
    uri: { fsPath: target },
    headless: true,
    dryRun: Boolean(args.dryRun),
  });
  return outcome || { ok: false, error: 'unknown-error' };
};

const BATCH_INPUT_SCHEMA = {
  path: {
    type: 'string',
    description: '单个文件或目录的绝对路径（与 paths 二选一）',
  },
  paths: {
    type: 'array',
    items: { type: 'string' },
    description: '多个文件/目录的绝对路径，一次调用批量处理（推荐，避免多轮调用）',
  },
};

const TOOL_DEFINITIONS = [
  {
    name: 'extract_chinese',
    description:
      '扫描指定文件或目录中的中文文案，返回待处理的中文清单（只读，不修改任何文件）。可用 path 传单路径，或用 paths 一次传多个文件/目录（内部限流并发扫描）。注意：i18n key 在写入语言包（write_locale）时才生成，本工具的返回不包含 key。目录会递归扫描 .vue/.js/.ts/.jsx/.tsx 文件，自动忽略 node_modules、dist 等目录。返回含 timing（本次调用耗时 ms），批量时每个文件附带 ms。',
    inputSchema: {
      type: 'object',
      properties: BATCH_INPUT_SCHEMA,
      anyOf: [{ required: ['path'] }, { required: ['paths'] }],
    },
  },
  {
    name: 'apply_i18n_keys',
    description:
      '把指定文件中已存在于语言包（locale JSON）的中文文案替换为 i18n key 调用，并通过编辑器 API 格式化保存。可用 path 传单文件，或用 paths 一次传多个文件（内部限流并发，返回 results 数组）。翻译函数跟随文件内已有声明与调用（useI18n 解构、useLocale 等局部翻译函数、$t/this.$t），无现成写法时按 Vue 2/Vue 3 场景选择 $t 或 t。需先通过 LocaleSail 的提取流程把文案写入语言包，否则不会有替换发生。返回含 timing 与每个文件的 ms。',
    inputSchema: {
      type: 'object',
      properties: BATCH_INPUT_SCHEMA,
      anyOf: [{ required: ['path'] }, { required: ['paths'] }],
    },
  },
  {
    name: 'write_locale',
    description:
      '扫描指定源码文件中的中文文案，生成 i18n key 并合并写入项目语言包（locale JSON）；已存在相同文案的词条会智能合并。可用 path 传单文件，或用 paths 一次传多个文件（批量按顺序写入暂存，保证一致，返回 results 数组）。返回的 newEntries（key→中文文案映射）为本次实际写入的条目，是后续替换与翻译流程的 key 来源。dryRun=true 时只返回将新增/更新的条目，不修改任何文件。返回含 timing 与每个文件的 ms。',
    inputSchema: {
      type: 'object',
      properties: BATCH_INPUT_SCHEMA,
      anyOf: [{ required: ['path'] }, { required: ['paths'] }],
    },
  },
  {
    name: 'split_locale_modules',
    description:
      '把语言包 JSON 按目录结构拆分为 JS/TS 模块文件（移动语义：成功后清空源 JSON）；需要项目开启 useCompactPathMode。dryRun=true 时只返回拆分计划，不清空、不写入任何文件。返回含 timing。',
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

const createToolSet = (context, options) => {
  const log =
    options && typeof options.log === 'function' ? options.log : () => {};
  const dispatch = (name, args) => {
    if (name === 'extract_chinese') return extractChinese(args);
    if (name === 'apply_i18n_keys') return applyI18nKeys(args, context);
    if (name === 'write_locale') return writeLocale(args, context);
    if (name === 'split_locale_modules') return splitLocaleModules(args, context);
    throw new Error(`Unknown tool: ${name}`);
  };
  return {
    listTools: () => TOOL_DEFINITIONS,
    callTool: async (name, args) => {
      const startedAt = Date.now();
      const targetCount =
        args && Array.isArray(args.paths) ? args.paths.length : 1;
      try {
        const payload = await dispatch(name, args || {});
        const ms = Date.now() - startedAt;
        const summary = [];
        if (payload && typeof payload.fileCount === 'number') {
          summary.push(`files=${payload.fileCount}`);
        }
        if (payload && typeof payload.totalFiles === 'number') {
          summary.push(`files=${payload.totalFiles} ok=${payload.okCount}`);
        }
        log(
          `tools/call ${name} targets=${targetCount}${summary
            .map((item) => ` ${item}`)
            .join('')} ms=${ms}`,
        );
        const result =
          payload && typeof payload === 'object'
            ? Object.assign({}, payload, { timing: { ms } })
            : payload;
        return toText(result);
      } catch (error) {
        const ms = Date.now() - startedAt;
        log(
          `tools/call ${name} targets=${targetCount} ms=${ms} error=${messageOf(
            error,
          )}`,
        );
        throw error;
      }
    },
  };
};

module.exports = { createToolSet, TOOL_DEFINITIONS };
module.exports._private = {
  mapLimit,
  resolveBatchTargets,
  collectFilesFromTargets,
};
