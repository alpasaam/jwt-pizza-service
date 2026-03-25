/**
 * Deliverable 9 — Grafana Loki logging (HTTP, DB, factory, exceptions; sanitized).
 */

const config = require('./config.js');

function noopMiddleware(req, res, next) {
  next();
}

function sanitizeString(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  out = out.replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"*****"');
  out = out.replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"*****"');
  out = out.replace(/"jwt"\s*:\s*"[^"]*"/gi, '"jwt":"*****"');
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer *****');
  return out;
}

function sanitizeForLog(data) {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return sanitizeString(str);
  } catch {
    return '[unserializable]';
  }
}

function loggingEnabled() {
  const L = config.logging;
  return !!(L && L.endpointUrl && L.apiKey && L.source);
}

class Logger {
  httpLogger = (req, res, next) => {
    const origSend = res.send.bind(res);
    res.send = (body) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: sanitizeForLog(req.body),
        resBody: sanitizeForLog(body),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      return origSend(body);
    };
    next();
  };

  log(level, type, logData) {
    if (!loggingEnabled()) return;
    const labels = { component: config.logging.source, level, type };
    const values = [this.nowString(), sanitizeForLog(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };
    this.sendLogToGrafana(logEvent);
  }

  logException(err) {
    if (!loggingEnabled()) return;
    this.log('error', 'exception', {
      message: err.message,
      stack: err.stack,
    });
  }

  logDbQuery(sql, params) {
    if (!loggingEnabled()) return;
    this.log('info', 'db', {
      sql: this.sanitizeSql(sql),
      params: this.redactDbParams(params),
    });
  }

  sanitizeSql(sql) {
    if (typeof sql !== 'string') return sql;
    return sql
      .replace(/\$2[aby]\$[0-9]+\$[A-Za-z0-9./]{53}/g, '[bcrypt]')
      .replace(/eyJ[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/g, '[jwt]');
  }

  redactDbParams(params) {
    if (!params || !Array.isArray(params)) return params;
    return params.map((p) => {
      if (typeof p === 'string') {
        if (p.startsWith('$2')) return '*****';
        if (p.length > 100) return '[redacted]';
      }
      return p;
    });
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sendLogToGrafana(event) {
    if (process.env.NODE_ENV === 'test') return;
    const body = JSON.stringify(event);
    fetch(config.logging.endpointUrl, {
      method: 'post',
      body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
  }
}

const instance = new Logger();

if (!loggingEnabled()) {
  module.exports = {
    httpLogger: noopMiddleware,
    log: () => {},
    logException: () => {},
    logDbQuery: () => {},
  };
} else {
  module.exports = {
    httpLogger: instance.httpLogger.bind(instance),
    log: instance.log.bind(instance),
    logException: instance.logException.bind(instance),
    logDbQuery: instance.logDbQuery.bind(instance),
  };
}
