const { registerDefinitionProvider } = require('./utils/vs');
const { provideDefinition } = require('./lib/provideDefinition');

module.exports = (context) => {
  context.subscriptions.push(
    registerDefinitionProvider(
      [
        { scheme: 'file', language: 'vue' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascriptreact' },
      ],
      {
        provideDefinition,
      },
    ),
  );
};
