export function getHealthStatus() {
  return {
    status: 'ok',
    service: 'lifepilot-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  }
}
