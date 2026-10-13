const crypto = require('crypto');
const pkg = require('../../package.json');
const { registerCommand, workspace, window, env } = require('../utils/vs');
const { operation, plugin } = require('../utils/constant');
const { startMcpServer, MCP_PATH } = require('./server');
const { createToolSet } = require('./tools');

const DEFAULT_PORT = 39167;
const TOKEN_STATE_KEY = 'localeSail.mcp.token';
const OUTPUT_CHANNEL_NAME = 'LocaleSail MCP';

const getOrCreateToken = (context) => {
  let token = context.globalState.get(TOKEN_STATE_KEY);
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    context.globalState.update(TOKEN_STATE_KEY, token);
  }
  return token;
};

module.exports = (context) => {
  const toolSet = createToolSet(context);
  const output = window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const token = getOrCreateToken(context);
  let server = null;
  let activePort = null;

  const getMcpConfig = () => workspace.getConfiguration('localeSail.mcp');

  const getPort = () => {
    const configured = getMcpConfig().get('port');
    return typeof configured === 'number' && configured > 0 && configured < 65536
      ? configured
      : DEFAULT_PORT;
  };

  const log = (message) => {
    output.appendLine(`[${new Date().toISOString()}] ${message}`);
  };

  const start = async () => {
    if (server) return;
    const port = getPort();
    try {
      server = await startMcpServer({
        port,
        token,
        listTools: toolSet.listTools,
        callTool: toolSet.callTool,
        serverName: plugin.name,
        serverVersion: pkg.version,
      });
      activePort = port;
      log(`MCP server is ready at http://127.0.0.1:${port}${MCP_PATH}`);
      log(
        `Run "${operation.copyMcpConfig.title}" to copy the client configuration.`,
      );
    } catch (error) {
      server = null;
      activePort = null;
      log(
        `MCP server failed to start (port ${port}): ${
          error && error.message ? error.message : String(error)
        }`,
      );
      log(
        'The port may already be in use by another VS Code window running LocaleSail.',
      );
    }
  };

  const stop = () => {
    if (!server) return;
    try {
      server.close();
    } catch (error) {
      // server 已关闭时忽略
    }
    server = null;
    activePort = null;
  };

  const applyEnabled = () => {
    if (!getMcpConfig().get('enabled', true)) {
      stop();
      return;
    }
    if (server && activePort !== getPort()) {
      stop();
    }
    start();
  };

  const copyMcpConfig = async () => {
    if (!server || !activePort) {
      window.showWarningMessage(
        'LocaleSail MCP is not running. Enable "localeSail.mcp.enabled" in settings and check the LocaleSail MCP output channel for errors.',
      );
      return;
    }
    const snippet = {
      mcpServers: {
        localesail: {
          type: 'http',
          url: `http://127.0.0.1:${activePort}${MCP_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    };
    await env.clipboard.writeText(JSON.stringify(snippet, null, 2));
    window.showInformationMessage(
      'LocaleSail MCP configuration copied to clipboard.',
    );
  };

  const showMcpStatus = async () => {
    const enabled = getMcpConfig().get('enabled', true);
    const port = server ? activePort : getPort();
    const lines = [
      `MCP server: ${server ? 'running' : 'not running'}`,
      `Enabled: ${enabled ? 'yes' : 'no'} (localeSail.mcp.enabled)`,
      `Endpoint: http://127.0.0.1:${port}${MCP_PATH}`,
      `Token: ${token.slice(0, 8)}... (full value via "Copy MCP Configuration")`,
    ];
    if (enabled && !server) {
      lines.push(
        'Startup failed or pending. Check the "LocaleSail MCP" output channel for details.',
      );
    }
    const action = await window.showInformationMessage(
      lines.join('\n'),
      { modal: true },
      operation.copyMcpConfig.title,
    );
    if (action === operation.copyMcpConfig.title) {
      await copyMcpConfig();
    }
  };

  context.subscriptions.push(
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('localeSail.mcp')) {
        applyEnabled();
      }
    }),
    registerCommand(operation.copyMcpConfig.cmd, copyMcpConfig),
    registerCommand(operation.showMcpStatus.cmd, showMcpStatus),
    output,
    { dispose: stop },
  );

  applyEnabled();
};
