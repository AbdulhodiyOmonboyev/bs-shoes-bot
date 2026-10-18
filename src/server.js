const http = require('http');

/**
 * Render uchun Web Server va unsleep tizimi
 */
function startWebServer(port = process.env.PORT || 3000) {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const pathname = rawUrl.split('?')[0];

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    if (pathname === '/' || pathname === '/health' || pathname === '/unsleep' || pathname === '/ping') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'online',
        service: 'BS-SHOES Telegram Bot',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(port, () => {
    console.log(`🌐 Web server ishga tushdi: port ${port}`);
  });

  // Renderda uxlab qolmasligi uchun unsleep ping
  unsleep(port, 2);

  return server;
}

function unsleep(port = process.env.PORT || 3000, intervalMinutes = 2) {
  const INTERVAL_MS = intervalMinutes * 60 * 1000;

  const performUnsleepPing = async () => {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || `http://localhost:${port}`;
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const targetUrl = `${cleanUrl}/unsleep?t=${Date.now()}`;

    try {
      await fetch(targetUrl);
    } catch (err) {
      // ignore local connection errors
    }

    if (cleanUrl.startsWith('https://')) {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        await fetch(proxyUrl);
      } catch (e) {
        // ignore proxy fallback
      }
    }
  };

  setTimeout(performUnsleepPing, 10 * 1000);
  return setInterval(performUnsleepPing, INTERVAL_MS);
}

module.exports = {
  startWebServer,
  unsleep
};
