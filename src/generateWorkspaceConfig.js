const { registerCommand } = require('./utils/vs');
const { openFileByPath } = require('./utils');
const { operation } = require('./utils/constant');
const generateWorkspaceConfig = require('./lib/generateWorkspaceConfig');

module.exports = (context) => {
	const commandIds = [
		operation.generateWorkspaceConfig.cmd,
		...(operation.generateWorkspaceConfig.aliases || []),
	];
	const handler = (uri) => {
		const fsPath = uri && (uri.fsPath || uri.path);
		if (fsPath) {
			openFileByPath(fsPath).then((editor) => {
				generateWorkspaceConfig({ editor, context });
			});
		} else {
			generateWorkspaceConfig({ context });
		}
	};

	commandIds.forEach((commandId) => {
		context.subscriptions.push(registerCommand(commandId, handler));
	});
};
