const fs = require('fs');
const {
  Location,
  Position,
  Range,
  file,
} = require('../utils/vs');
const { getI18nKeyMatches } = require('../utils/regex');
const {
  createLocaleResolver,
  getTranslateContext,
} = require('./inlineTranslationPreview')._private;
const { getLocaleKeyLocation } = require('./localeKeyLocation');

const getKeyMatchAtPosition = (document, position) => {
  const text = document.getText();
  const { translateCallers } = getTranslateContext(
    document.uri.fsPath,
    text,
  );
  const lineText = document.lineAt(position.line).text;

  return getI18nKeyMatches(lineText, translateCallers).find(
    ({ index, length }) =>
      position.character >= index && position.character <= index + length,
  );
};

const provideDefinition = (document, position) => {
  const match = getKeyMatchAtPosition(document, position);
  if (!match) return undefined;

  const result = createLocaleResolver(document)(match.key, match.caller);
  if (!result.exist || !result.filePath) return undefined;

  const location = getLocaleKeyLocation(result.filePath, result.key);
  if (!location) return undefined;

  let content;
  try {
    content = fs.readFileSync(result.filePath, 'utf8');
  } catch (e) {
    return undefined;
  }
  const positionAt = (offset) => {
    const before = content.slice(0, offset);
    const lines = before.split(/\r?\n/);
    return new Position(lines.length - 1, lines[lines.length - 1].length);
  };

  return new Location(
    file(result.filePath),
    new Range(positionAt(location.startOffset), positionAt(location.endOffset)),
  );
};

module.exports = {
  provideDefinition,
  _private: {
    getKeyMatchAtPosition,
  },
};
