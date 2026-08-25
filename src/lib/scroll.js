const fs = require("fs");
const flatten = require("flat");
const validator = require("validator");

const { msg, Range, Selection, executeCommand } = require("../utils/vs");
const { jsonAST } = require("../utils/ast");

const jump = line => {
	executeCommand("cursorMove", {
		to: "right",
		by: "line",
		value: 0,
		select: true
	}).then(
		executeCommand("revealLine", {
			at: "top",
			lineNumber: line - 5 //top方向显示五行
		})
	);
};

const selectText = (editor, index, length) => {
	const start = editor.document.positionAt(index);
	const end = editor.document.positionAt(index + length);
	editor.selection = new Selection(start, end);
	jump(start.line);
};

module.exports = (editor, i18nKeys) => {
	const text = editor.document.getText();
	if (!validator.isJSON(text)) {
		const keyIndex = text.indexOf(i18nKeys);
		if (keyIndex !== -1) {
			selectText(editor, keyIndex, i18nKeys.length);
			return;
		}
		msg.error(`Can not find '${i18nKeys}' in '${editor.document.fileName}'`);
		return;
	}

	const keys = i18nKeys.split(".");
	if (!keys.length) return;
	let match, startPos, endPos, range;
	let isAST = false;
	let wholeMatch = text.match(new RegExp(i18nKeys));
	const ast = jsonAST(text, wholeMatch ? i18nKeys : keys, wholeMatch);
	if (ast && ast.loc) {
		const { start, end } = ast.loc;
		editor.selection = new Selection(
			editor.document.positionAt(start.offset + 1),
			editor.document.positionAt(end.offset - 2)
		);
		jump(start.line);
	}
};
