const http = require('http');
const crypto = require('crypto');

const MCP_PATH = '/mcp';
const MAX_BODY_SIZE = 1024 * 1024;
const DEFAULT_PROTOCOL_VERSION = '2025-03-26';

const sendJson = (res, statusCode, payload, extraHeaders) => {
  const body = JSON.stringify(payload);
  res.writeHead(
    statusCode,
    Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
      extraHeaders || {},
    ),
  );
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        settled = true;
        reject(new Error('request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', () => {
      if (settled) return;
      settled = true;
      reject(new Error('request stream error'));
    });
    req.on('close', () => {
      if (settled) return;
      settled = true;
      reject(new Error('request aborted'));
    });
  });

const safeEqual = (first, second) => {
  const bufFirst = Buffer.from(String(first));
  const bufSecond = Buffer.from(String(second));
  if (bufFirst.length !== bufSecond.length) return false;
  return crypto.timingSafeEqual(bufFirst, bufSecond);
};

const isAuthorized = (req, token) => {
  const header = req.headers.authorization || '';
  const prefix = 'Bearer ';
  if (header.indexOf(prefix) !== 0) return false;
  return safeEqual(header.slice(prefix.length), token);
};

const resultMessage = (id, payload) => ({ jsonrpc: '2.0', id, result: payload });
const errorMessage = (id, code, message) => ({
  jsonrpc: '2.0',
  id: id === undefined ? null : id,
  error: { code, message },
});

const handleMessage = async (message, handlers) => {
  const method = message.method;
  const params = message.params || {};
  if (method === 'initialize') {
    return resultMessage(message.id, {
      protocolVersion: params.protocolVersion || handlers.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: {
        name: handlers.serverName,
        version: handlers.serverVersion,
      },
    });
  }
  if (method === 'ping') {
    return resultMessage(message.id, {});
  }
  if (method === 'tools/list') {
    return resultMessage(message.id, { tools: handlers.listTools() });
  }
  if (method === 'tools/call') {
    const name = params.name;
    const tool = handlers.listTools().find((item) => item.name === name);
    if (!tool) {
      return errorMessage(message.id, -32602, `Unknown tool: ${name}`);
    }
    try {
      const text = await handlers.callTool(name, params.arguments || {});
      return resultMessage(message.id, {
        content: [{ type: 'text', text }],
      });
    } catch (error) {
      return resultMessage(message.id, {
        content: [
          {
            type: 'text',
            text: `Error: ${
              error && error.message ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      });
    }
  }
  return errorMessage(message.id, -32601, `Method not found: ${method}`);
};

const createMcpServer = (handlers) => {
  const server = http.createServer((req, res) => {
    const handle = async () => {
      const url = String(req.url || '').split('?')[0];
      if (url !== MCP_PATH) {
        sendJson(res, 404, errorMessage(null, -32000, 'Not found'));
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' });
        res.end();
        return;
      }
      if (!isAuthorized(req, handlers.token)) {
        sendJson(res, 401, errorMessage(null, -32001, 'Unauthorized'));
        return;
      }
      const contentType = String(
        req.headers['content-type'] || '',
      ).toLowerCase();
      if (contentType.indexOf('application/json') === -1) {
        sendJson(
          res,
          415,
          errorMessage(null, -32002, 'Content-Type must be application/json'),
        );
        return;
      }
      let rawBody;
      try {
        rawBody = await readBody(req);
      } catch (error) {
        sendJson(
          res,
          413,
          errorMessage(null, -32700, error.message || 'request error'),
        );
        return;
      }
      let message;
      try {
        message = JSON.parse(rawBody);
      } catch (error) {
        sendJson(res, 400, errorMessage(null, -32700, 'Parse error'));
        return;
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        sendJson(res, 400, errorMessage(null, -32600, 'Invalid Request'));
        return;
      }
      if (message.id === undefined) {
        // JSON-RPC 通知（如 notifications/initialized）按 MCP 规范返回 202 空响应
        res.writeHead(202);
        res.end();
        return;
      }
      const response = await handleMessage(message, handlers);
      sendJson(res, 200, response);
    };

    handle().catch((error) => {
      if (!res.headersSent) {
        sendJson(
          res,
          500,
          errorMessage(null, -32603, error.message || 'Internal error'),
        );
      } else {
        res.end();
      }
    });
  });
  return server;
};

const startMcpServer = ({
  port,
  host,
  token,
  listTools,
  callTool,
  serverName,
  serverVersion,
  protocolVersion,
}) =>
  new Promise((resolve, reject) => {
    const server = createMcpServer({
      token,
      listTools,
      callTool,
      serverName,
      serverVersion,
      protocolVersion: protocolVersion || DEFAULT_PROTOCOL_VERSION,
    });
    const onError = (error) => reject(error);
    server.once('error', onError);
    server.listen(port, host || '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve(server);
    });
  });

module.exports = { startMcpServer, MCP_PATH };
