const fs = require('fs');
const path = require('path');
const safeEval = require('safe-eval');

const extractExportDefaultObject = (content = '') => {
  const startIndex = content.indexOf('export default');
  if (startIndex === -1) return null;

  const braceIndex = content.indexOf('{', startIndex);
  if (braceIndex === -1) return null;

  let braceCount = 0;
  for (let i = braceIndex; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
    } else if (content[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        return content.substring(braceIndex, i + 1);
      }
    }
  }

  return null;
};

const readSplitLocaleFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return {};
    const objStr = extractExportDefaultObject(fs.readFileSync(filePath, 'utf8'));
    const result = objStr ? safeEval(`(${objStr})`) || {} : {};
    return { ...result };
  } catch (e) {
    return {};
  }
};

const splitPathPartRegexp = /[./\\]+/;

const normalizeSplitPathParts = (value = '') =>
  String(value)
    .split(splitPathPartRegexp)
    .map((part) => part.trim())
    .filter((part) => !!part);

const isSamePathParts = (left = [], right = []) =>
  left.length === right.length &&
  left.every((part, index) => part === right[index]);

const hasPathPartPrefix = (parts = [], prefix = []) =>
  prefix.length > 0 &&
  parts.length >= prefix.length &&
  prefix.every((part, index) => parts[index] === part);

const toCandidateFiles = (baseDir, routeParts = []) => {
  if (!baseDir || routeParts.length === 0) return [];

  const parts = routeParts.slice();
  const fileName = parts.pop();
  const relativeDir = parts.join(path.sep);
  const targetDir = relativeDir ? path.join(baseDir, relativeDir) : baseDir;

  return [
    path.join(targetDir, `${fileName}.js`),
    path.join(targetDir, `${fileName}.ts`),
  ];
};

const normalizeSplitLocalePathAliases = (pathAliases = {}) => {
  if (!pathAliases || typeof pathAliases !== 'object') return [];

  return Object.keys(pathAliases)
    .map((from) => {
      const targets = Array.isArray(pathAliases[from])
        ? pathAliases[from]
        : [pathAliases[from]];
      return {
        fromParts: normalizeSplitPathParts(from),
        targetPartsList: targets
          .map(normalizeSplitPathParts)
          .filter((parts) => parts.length > 0),
      };
    })
    .filter(
      ({ fromParts, targetPartsList }) =>
        fromParts.length > 0 && targetPartsList.length > 0,
    )
    .sort((a, b) => b.fromParts.length - a.fromParts.length);
};

const getAliasRouteCandidates = (routeParts = [], pathAliases = {}) => {
  const aliases = normalizeSplitLocalePathAliases(pathAliases);
  const candidates = [];

  aliases.forEach(({ fromParts, targetPartsList }) => {
    if (!hasPathPartPrefix(routeParts, fromParts)) return;

    const restParts = routeParts.slice(fromParts.length);
    targetPartsList.forEach((targetParts) => {
      const nextParts = [...targetParts, ...restParts];
      if (!isSamePathParts(nextParts, routeParts)) {
        candidates.push(nextParts);
      }
    });
  });

  return candidates;
};

const getSourceRouteCandidate = (sourceFilePath, sourceBasePath) => {
  if (!sourceFilePath || !sourceBasePath) return [];

  const relativePath = path.relative(sourceBasePath, sourceFilePath);
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return [];
  }

  const extName = path.extname(relativePath);
  return normalizeSplitPathParts(
    extName ? relativePath.slice(0, -extName.length) : relativePath,
  );
};

const pushUniqueCandidates = (target, candidates) => {
  candidates.forEach((filePath) => {
    if (!target.includes(filePath)) {
      target.push(filePath);
    }
  });
};

const getSplitFileCandidates = (baseDir, key, options = {}) => {
  if (!baseDir || !key || key.indexOf('.') === -1) return [];

  const routeParts = key.split('.');
  routeParts.pop();
  if (routeParts.length === 0) return [];

  const candidates = [];
  pushUniqueCandidates(candidates, toCandidateFiles(baseDir, routeParts));

  getAliasRouteCandidates(routeParts, options.pathAliases).forEach(
    (aliasRouteParts) => {
      pushUniqueCandidates(candidates, toCandidateFiles(baseDir, aliasRouteParts));
    },
  );

  const sourceRouteParts = getSourceRouteCandidate(
    options.sourceFilePath,
    options.sourceBasePath,
  );
  if (sourceRouteParts.length > 0) {
    pushUniqueCandidates(candidates, toCandidateFiles(baseDir, sourceRouteParts));
  }

  return candidates;
};

const escapeRegExpSource = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeScopedTranslateFunctionNames = (factoryNames = []) =>
  (Array.isArray(factoryNames) ? factoryNames : [factoryNames])
    .map((name) => String(name || '').trim())
    .filter((name) => !!name);

const getScopedTranslateScopes = (text = '', factoryNames = ['useLocale']) => {
  const factories = normalizeScopedTranslateFunctionNames(factoryNames);
  const scopes = {};
  if (factories.length === 0) return scopes;

  const factorySource = factories.map(escapeRegExpSource).join('|');
  const scopedTranslateFunctionRegexp = new RegExp(
    `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:${factorySource})\\s*\\(\\s*(["'\`])([^"'\`]+)\\2\\s*\\)`,
    'g',
  );
  const scopedTranslateDestructureRegexp = new RegExp(
    `\\b(?:const|let|var)\\s*\\{\\s*([^}]*\\bt\\b[^}]*)\\}\\s*=\\s*(?:${factorySource})\\s*\\(\\s*(["'\`])([^"'\`]+)\\2\\s*\\)`,
    'g',
  );
  let match;

  while ((match = scopedTranslateFunctionRegexp.exec(text))) {
    scopes[match[1]] = match[3];
    scopes[`${match[1]}.t`] = match[3];
  }

  while ((match = scopedTranslateDestructureRegexp.exec(text))) {
    const tBinding = getTranslateBinding(match[1]);
    if (tBinding) {
      scopes[tBinding] = match[3];
    }
  }

  return scopes;
};

const getUseLocaleScopes = (text = '') =>
  getScopedTranslateScopes(text, ['useLocale']);

const getTranslateBinding = (bindingText = '') => {
  const tBinding = bindingText
    .split(',')
    .map((item) => item.trim())
    .find((item) => /^t(?:\s*:|$)/.test(item));

  if (!tBinding) return null;

  const aliasMatch = tBinding.match(/^t\s*:\s*([A-Za-z_$][\w$]*)$/);
  return aliasMatch ? aliasMatch[1] : 't';
};

const getUseI18nTranslateCallers = (text = '') => {
  const callers = [];
  const useI18nRegexp =
    /\b(?:const|let|var)\s*\{\s*([^}]*\bt\b[^}]*)\}\s*=\s*useI18n\s*\(/g;
  const useI18nComposerRegexp =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useI18n\s*\(/g;
  let match;

  while ((match = useI18nRegexp.exec(text))) {
    const tBinding = getTranslateBinding(match[1]);
    if (tBinding) callers.push(tBinding);
  }

  while ((match = useI18nComposerRegexp.exec(text))) {
    callers.push(`${match[1]}.t`);
  }

  return Array.from(new Set(callers));
};

module.exports = {
  extractExportDefaultObject,
  getSplitFileCandidates,
  normalizeSplitLocalePathAliases,
  getScopedTranslateScopes,
  getUseLocaleScopes,
  getUseI18nTranslateCallers,
  readSplitLocaleFile,
};
