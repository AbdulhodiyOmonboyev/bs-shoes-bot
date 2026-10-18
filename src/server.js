const http = require('http');

/**
 * Unsleep tizimi statistikasi
 */
const unsleepStats = {
  active: true,
  intervalSeconds: 90, // Har 90 soniyada (1.5 minut)
  totalPings: 0,
  successfulPings: 0,
  lastPingAt: null,
  lastStatus: null,
  externalUrl: null,
  lastError: null
};

/**
 * Render uchun Web Server va kuchaytirilgan Unsleep tizimi
 */
function startWebServer(port = process.env.PORT || 3000) {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const pathname = rawUrl.split('?')[0];

    // Barcha keshni to'liq taqiqlash (Cloudflare/Render oraliq keshlamasligi uchun)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (pathname === '/' || pathname === '/unsleep' || pathname === '/ping' || pathname === '/health') {
      res.writeHead(200);
      return res.end(JSON.stringify({
        status: 'online',
        service: 'BS-SHOES Factory Telegram Bot',
        mode: 'unsleep-active',
        interval: `${unsleepStats.intervalSeconds}s`,
        totalPings: unsleepStats.totalPings,
        successfulPings: unsleepStats.successfulPings,
        lastPingAt: unsleepStats.lastPingAt,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(port, () => {
    console.log(`🌐 Web server ishga tushdi: port ${port}`);
  });

  // Har 90 soniyada (1.5 minut) uzluksiz uyg'otib turuvchi Unsleep tizimi
  unsleep(port, 90);

  return server;
}

/**
 * Serverni Renderda uxlab qolishdan (har 3-15 minutda o'chib qolishdan) saqlovchi Unsleep funksiyasi
 * @param {number|string} port - Server porti
 * @param {number} intervalSeconds - Necha soniyada bir so'rov yuborilishi (standart: 90 soniya)
 */
function unsleep(port = process.env.PORT || 3000, intervalSeconds = 90) {
  unsleepStats.intervalSeconds = intervalSeconds;
  const INTERVAL_MS = intervalSeconds * 1000;

  const performUnsleepPing = async () => {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || `http://localhost:${port}`;
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    unsleepStats.externalUrl = cleanUrl;
    
    const timestamp = Date.now();
    const targetUrl = `${cleanUrl}/unsleep?t=${timestamp}`;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    unsleepStats.totalPings++;
    unsleepStats.lastPingAt = new Date().toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent' });

    // 1. To'g'ridan-to'g'ri so'rov (Direct HTTP Ping)
    try {
      const directRes = await fetch(targetUrl, { headers });
      unsleepStats.lastStatus = directRes.status;
      if (directRes.ok) {
        unsleepStats.successfulPings++;
        console.log(`[Unsleep ⚡️] Render uyg'otildi: ${targetUrl} (Status: ${directRes.status}, Vaqt: ${unsleepStats.lastPingAt})`);
      }
    } catch (err) {
      unsleepStats.lastError = err.message;
      console.warn(`[Unsleep ⚠️] To'g'ridan-to'g'ri so'rov ogohlantirishi: ${err.message}`);
    }

    // 2. Tashqi proksi orqali so'rov (External Inbound Ping)
    // Render tashqi IP manzildan kelgan haqiqiy tashrif sifatida qabul qiladi va serverni 100% uyg'oq ushlab turadi!
    if (cleanUrl.startsWith('https://')) {
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`
      ];

      for (const proxyUrl of proxies) {
        try {
          const proxyRes = await fetch(proxyUrl, { headers });
          if (proxyRes.ok) {
            console.log(`[Unsleep 🌐] Tashqi proksi orqali Renderga kirish amalga oshirildi (Status: ${proxyRes.status})`);
            break; // bitta muvaffaqiyatli bo'lsa yetarli
          }
        } catch (proxyErr) {
          // Bitta proksi ishlamasa, boshqasi sinab ko'riladi
        }
      }
    }
  };

  // Server ishga tushishi bilan 5 soniyadan so'ng dastlabki unsleep chaqiruvi
  setTimeout(performUnsleepPing, 5 * 1000);

  // Keyin har 90 soniyada muntazam davom etadi
  const intervalId = setInterval(performUnsleepPing, INTERVAL_MS);

  console.log(`⏰ [Unsleep] Tizim faollashtirildi: Har ${intervalSeconds} soniyada (1.5 minut) uzluksiz so'rov yuboriladi.`);
  return intervalId;
}

function getUnsleepStats() {
  return unsleepStats;
}

module.exports = {
  startWebServer,
  unsleep,
  getUnsleepStats
};
