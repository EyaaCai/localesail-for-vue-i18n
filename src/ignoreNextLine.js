const { registerCommand, Position, msg } = require('./utils/vs');
const { getEditor, getRange } = require('./utils');
const { operation } = require('./utils/constant');

const disableNextLineText = 'localesail-disable-next-line';

const getCommentText = (editor, line) => {
  const { languageId } = editor.document;
  if (languageId === 'vue') {
    const { script } = getRange(editor);
    const inScript = line >= script.begin && line <= script.end;
    return inScript
      ? `// ${disableNextLineText}`
      : `<!-- ${disableNextLineText} -->`;
  }
  return `// ${disableNextLineText}`;
};

module.exports = (context) => {
  context.subscriptions.push(
    registerCommand(operation.ignoreNextLine.cmd, () => {
      const editor = getEditor();
      if (!editor) return;

      const line = editor.selection.active.line;
      const currentLineText = editor.document.lineAt(line).text;
      const previousLineText =
        line > 0 ? editor.document.lineAt(line - 1).text : '';

      if (previousLineText.includes(disableNextLineText)) {
        msg.info(`${operation.ignoreNextLine.title}: already ignored.`);
        return;
      }

      const indent = currentLineText.match(/^\s*/)[0];
      const comment = `${indent}${getCommentText(editor, line)}\n`;

      editor.edit((editBuilder) => {
        editBuilder.insert(new Position(line, 0), comment);
      });
    }),
  );
};
