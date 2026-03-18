/**
 * Deliverable 8 — Metrics for JWT Pizza Service (Grafana OTLP).
 * Request tracking, auth, active users, pizza purchases, system metrics; periodic send.
 */

const os = require('os');
const config = require('./config.js');

if (!config.metrics) {
  const noop = (req, res, next) => next();
  module.exports = {
    requestTracker: noop,
    authSuccess: () => {},
    authFailure: () => {},
    userLogin: () => {},
    userLogout: () => {},
    pizzaPurchase: () => {},
  };
} else {
const requests = {};
const requestDurations = {};
let authSuccessCount = 0;
let authFailureCount = 0;
let activeUsers = 0;
let pizzasSoldTotal = 0;
let pizzaFailuresTotal = 0;
let pizzaRevenueTotal = 0;
let lastPizzaCreationLatencyMs = 0;

function requestTracker(req, res, next) {
  const start = Date.now();
  const endpoint = `${req.method} ${req.path}`;
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    if (!requestDurations[endpoint]) requestDurations[endpoint] = { sum: 0, count: 0 };
    requestDurations[endpoint].sum += durationMs;
    requestDurations[endpoint].count += 1;
  });
  next();
}

function authSuccess() {
  authSuccessCount++;
}

function authFailure() {
  authFailureCount++;
}

function userLogin() {
  activeUsers++;
}

function userLogout() {
  if (activeUsers > 0) activeUsers--;
}

function pizzaPurchase(success, latencyMs, pizzasCount, revenue) {
  lastPizzaCreationLatencyMs = latencyMs;
  if (success) {
    pizzasSoldTotal += pizzasCount;
    pizzaRevenueTotal += revenue;
  } else {
    pizzaFailuresTotal += 1;
  }
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return Number((cpuUsage * 100).toFixed(2));
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  return Number(((usedMemory / totalMemory) * 100).toFixed(2));
}

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };
  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };
  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key,
      value: { stringValue: String(attributes[key]) },
    });
  });
  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }
  return metric;
}

function sendToGrafana(metricsToSend) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [{ metrics: metricsToSend }],
      },
    ],
  };
  fetch(config.metrics.endpointUrl, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      'Content-Type': 'application/json',
    },
  }).catch((err) => console.error('Error pushing metrics:', err));
}

function sendMetricsPeriodically(periodMs) {
  const timer = setInterval(() => {
    try {
      const metricsToSend = [];

      Object.keys(requests).forEach((endpoint) => {
        metricsToSend.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { endpoint }));
      });
      Object.keys(requestDurations).forEach((endpoint) => {
        const d = requestDurations[endpoint];
        metricsToSend.push(createMetric('request_duration_sum_ms', d.sum, 'ms', 'sum', 'asDouble', { endpoint }));
        metricsToSend.push(createMetric('request_duration_count', d.count, '1', 'sum', 'asInt', { endpoint }));
      });

      metricsToSend.push(createMetric('auth_success', authSuccessCount, '1', 'sum', 'asInt', {}));
      metricsToSend.push(createMetric('auth_failure', authFailureCount, '1', 'sum', 'asInt', {}));
      metricsToSend.push(createMetric('active_users', activeUsers, '1', 'gauge', 'asInt', {}));
      metricsToSend.push(createMetric('pizzas_sold', pizzasSoldTotal, '1', 'sum', 'asInt', {}));
      metricsToSend.push(createMetric('pizza_failures', pizzaFailuresTotal, '1', 'sum', 'asInt', {}));
      metricsToSend.push(createMetric('pizza_revenue', pizzaRevenueTotal, '1', 'sum', 'asDouble', {}));
      metricsToSend.push(createMetric('pizza_creation_latency_ms', lastPizzaCreationLatencyMs, 'ms', 'gauge', 'asDouble', {}));

      metricsToSend.push(createMetric('cpu_percent', getCpuUsagePercentage(), '%', 'gauge', 'asDouble', {}));
      metricsToSend.push(createMetric('memory_percent', getMemoryUsagePercentage(), '%', 'gauge', 'asDouble', {}));

      sendToGrafana(metricsToSend);
    } catch (error) {
      console.error('Error sending metrics', error);
    }
  }, periodMs);
  if (typeof timer.unref === 'function') timer.unref();
}

sendMetricsPeriodically(10000);

module.exports = {
  requestTracker,
  authSuccess,
  authFailure,
  userLogin,
  userLogout,
  pizzaPurchase,
};
}
