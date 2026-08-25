const { executeCommand } = require("../utils/vs");
const { getEditor, showMessage } = require("../utils");
const { operation } = require("../utils/constant");
const { updateDecorations } = require("./inlineTranslationPreview")._private;

module.exports = ({ editor }) => {
	const currentEditor = getEditor(editor);
	if (!currentEditor) return;

	const count = updateDecorations(currentEditor, { force: true });
	if (!count) {
		showMessage({
			message: `
                There are no i18n keys in current file.`,
			editor: currentEditor,
			needOpen: false,
			callback: {
				func: () => executeCommand(operation.replaceWithI18nKeys.cmd),
				name: operation.replaceWithI18nKeys.title
			}
		});
		return;
	}

	showMessage({
		message: `${operation.showI18n.title} success.`,
		editor: currentEditor,
		needOpen: false
	});
};
