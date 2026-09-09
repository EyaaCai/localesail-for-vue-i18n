const fs = require('fs');
const path = require('path');
const parseJson = require('json-to-ast');

const isQuote = (value) => value === "'" || value === '"';

const findProperty = (node, key) =>
  node &&
  Array.isArray(node.children) &&
  node.children.find(
    (child) => child.type === 'Property' && child.key && child.key.value === key,
  );

const findJsonProperty = (ast, key) => {
  const directMatch = findProperty(ast, key);
  if (directMatch) return directMatch;

  const parts = String(key || '').split('.');
  if (parts.length === 0 || !parts[0]) return null;

  const findNestedProperty = (node, partIndex) => {
    for (let end = parts.length; end > partIndex; end--) {
      const part = parts.slice(partIndex, end).join('.');
      const property = findProperty(node, part);
      if (!property) continue;
      if (end === parts.length) return property;

      const nestedMatch = findNestedProperty(property.value, end);
      if (nestedMatch) return nestedMatch;
    }
    return null;
  };

  return findNestedProperty(ast, 0);
};

const getLineOffsets = (content) => {
  const lines = [];
  let lineStart = 0;
  for (let index = 0; index <= content.length; index++) {
    if (index === content.length || content[index] === '\n') {
      lines.push({
        text: content.slice(lineStart, index).replace(/\r$/, ''),
        startOffset: lineStart,
      });
      lineStart = index + 1;
    }
  }
  return lines;
};

const isUnquotedPropertyKey = (line, keyIndex, key) => {
  const before = line.slice(0, keyIndex);
  if (keyIndex > 0 && /[\w$'"]/.test(line[keyIndex - 1])) return false;
  if (
    keyIndex + key.length < line.length &&
    /[\w$]/.test(line[keyIndex + key.length])
  ) {
    return false;
  }
  return before.trim() === '' || /[,{]/.test(before.trim().slice(-1));
};

const isQuotedPropertyKey = (line, keyIndex, key) => {
  const quote = line[keyIndex - 1];
  if (!isQuote(quote)) return false;

  const afterKey = line.slice(keyIndex + key.length).trimStart();
  if (!afterKey.startsWith(quote)) return false;
  return afterKey.slice(1).trimStart().startsWith(':');
};

const findJavaScriptKeyLocation = (content, key) => {
  for (const { text, startOffset } of getLineOffsets(content)) {
    let searchStart = 0;
    while (searchStart < text.length) {
      const keyIndex = text.indexOf(key, searchStart);
      if (keyIndex === -1) break;

      const afterKey = text.slice(keyIndex + key.length).trimStart();
      const isProperty =
        isQuotedPropertyKey(text, keyIndex, key) ||
        (afterKey.startsWith(':') &&
          isUnquotedPropertyKey(text, keyIndex, key));
      if (isProperty) {
        const quote = isQuotedPropertyKey(text, keyIndex, key)
          ? text[keyIndex - 1]
          : null;
        const propertyStartOffset =
          startOffset + keyIndex - (quote ? 1 : 0);
        const propertyEndOffset =
          propertyStartOffset + key.length + (quote ? 2 : 0);
        return {
          startOffset: propertyStartOffset,
          endOffset: propertyEndOffset,
        };
      }

      searchStart = keyIndex + Math.max(key.length, 1);
    }
  }
  return null;
};

const getJsonKeyLocation = (content, key) => {
  try {
    const ast = parseJson(content);
    const property = findJsonProperty(ast, key);
    if (!property || !property.key || !property.key.loc) return null;
    return {
      startOffset: property.key.loc.start.offset,
      endOffset: property.key.loc.end.offset,
    };
  } catch (e) {
    return null;
  }
};

const getLocaleKeyLocation = (filePath, key) => {
  if (!filePath || !key || !fs.existsSync(filePath)) return null;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }

  const extension = path.extname(filePath).toLowerCase();
  return extension === '.json'
    ? getJsonKeyLocation(content, key)
    : findJavaScriptKeyLocation(content, key);
};

module.exports = {
  findJsonProperty,
  findJavaScriptKeyLocation,
  getJsonKeyLocation,
  getLocaleKeyLocation,
};
