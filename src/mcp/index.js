const crypto = require('crypto');
const http = require('http');
const pkg = require('../../package.json');
const { registerCommand, workspace, window, env } = require('../utils/vs');
const { operation, plugin } = require('../utils/constant');
const { startMcpServer, MCP_PATH } = require('./server');
const { createToolSet } = require('./tools');

const DEFAULT_PORT = 39167;
const TOKEN_STATE_KEY = 'localeSail.mcp.token';
const OUTPUT_CHANNEL_NAME = 'LocaleSail MCP';
const RETRY_DELAYS_MS = [1000, 3000, 5000];
const PROBE_TIMEOUT_MS = 1500;

const getOrCreateToken = (context) => {
  let token = context.globalState.get(TOKEN_STATE_KEY);
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    context.globalState.update(TOKEN_STATE_KEY, token);
  }
  return token;
};

const probeLocaleSailEndpoint = (port, token) =>
  new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: MCP_PATH,
        method: 'POST',
        timeout: PROBE_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const message = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            settle(
              res.statusCode === 200 &&
                Boolean(message && message.jsonrpc === '2.0'),
            );
          } catch (error) {
            settle(false);
          }
        });
      },
    );
    req.on('error', () => settle(false));
    req.on('timeout', () => {
      req.destroy();
      settle(false);
    });
    req.end(payload);
  });

module.exports = (context) => {
  const toolSet = createToolSet(context);
  const output = window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const token = getOrCreateToken(context);
  let server = null;
  let activePort = null;
  let retryAttempt = 0;
  let retryTimer = null;
  let starting = false;

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

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryAttempt = 0;
  };

  const showStartupFailure = (port, message) =>
    window
      .showWarningMessage(
        `LocaleSail MCP could not start on port ${port}: ${message}`,
        'Retry',
        'Show Output',
      )
      .then((action) => {
        if (action === 'Retry') {
          start();
        } else if (action === 'Show Output') {
          output.show();
        }
      });

  const start = async () => {
    if (starting || server) return;
    if (!getMcpConfig().get('enabled', true)) return;
    starting = true;
    try {
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
        retryAttempt = 0;
        log(`MCP server is ready at http://127.0.0.1:${port}${MCP_PATH}`);
        log(
          `Run "${operation.copyMcpConfig.title}" to copy the client configuration.`,
        );
      } catch (error) {
        server = null;
        activePort = null;
        const message =
          error && error.message ? error.message : String(error);
        const addressInUse = Boolean(error) && error.code === 'EADDRINUSE';
        if (addressInUse && retryAttempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[retryAttempt];
          retryAttempt += 1;
          log(
            `MCP server failed to start (port ${port}): ${message}. Retrying in ${
              delay / 1000
            }s (attempt ${retryAttempt}/${RETRY_DELAYS_MS.length})…`,
          );
          retryTimer = setTimeout(() => {
            retryTimer = null;
            start();
          }, delay);
          return;
        }
        log(`MCP server failed to start (port ${port}): ${message}`);
        if (addressInUse && (await probeLocaleSailEndpoint(port, token))) {
          log(
            `Port ${port} is already serving LocaleSail MCP from another VS Code window. This window will not start a duplicate server.`,
          );
          return;
        }
        if (addressInUse) {
          log('Free the port or set a different "localeSail.mcp.port".');
        }
        showStartupFailure(port, message);
      }
    } finally {
      starting = false;
    }
  };

  const stop = () => {
    clearRetry();
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
    clearRetry();
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
