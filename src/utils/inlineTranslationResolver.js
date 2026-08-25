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

const getSplitFileCandidates = (baseDir, key) => {
  if (!baseDir || !key || key.indexOf('.') === -1) return [];

  const parts = key.split('.');
  parts.pop();
  if (parts.length === 0) return [];

  const fileName = parts.pop();
  const relativeDir = parts.join(path.sep);
  const targetDir = relativeDir ? path.join(baseDir, relativeDir) : baseDir;

  return [
    path.join(targetDir, `${fileName}.js`),
    path.join(targetDir, `${fileName}.ts`),
  ];
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
  getScopedTranslateScopes,
  getUseLocaleScopes,
  getUseI18nTranslateCallers,
  readSplitLocaleFile,
};
