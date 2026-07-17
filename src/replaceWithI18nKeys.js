const { registerCommand } = require('./utils/vs');
const { openFileByPath } = require('./utils');
const { operation } = require('./utils/constant');
const replaceWithI18nKeys = require('./lib/replaceWithI18nKeys');

module.exports = context => {
    const commandIds = [
        operation.replaceWithI18nKeys.cmd,
        ...(operation.replaceWithI18nKeys.aliases || []),
    ];
    const handler = uri => {
        if (uri && uri.path) {
            openFileByPath(uri.path).then(editor => {
                replaceWithI18nKeys({ editor, context });
            });
        } else {
            replaceWithI18nKeys({ context });
        }
    };

    commandIds.forEach(commandId => {
        context.subscriptions.push(registerCommand(commandId, handler));
    });
};
