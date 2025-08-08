let totalHits = 0;        // Total hit dalam periode
let rps = 0;              // Request per detik terakhir
let hitsThisSecond = 0;   // Hit dalam detik berjalan
let lastSecond = Math.floor(Date.now() / 1000);
let periodStartTime = null; // Timestamp awal periode

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);

    // Hit baru (kecuali /stats)
    if (path !== "/stats") {
      if (periodStartTime === null) {
        periodStartTime = now;
      }
      totalHits++;
      hitsThisSecond++;
    }

    // Hitungan RPS update tiap detik
    if (currentSecond !== lastSecond) {
      if (hitsThisSecond > 0) {
        rps = hitsThisSecond;
      }
      hitsThisSecond = 0;
      lastSecond = currentSecond;
    }

    // Reset jika sudah ≥ 1000 hit & 120 detik sejak periode dimulai
    if (totalHits >= 1000 && periodStartTime !== null && (now - periodStartTime) >= 120000) {
      totalHits = 0;
      rps = 0;
      periodStartTime = null;
    }

    // Endpoint statistik
    if (path === "/stats") {
      return new Response(JSON.stringify({
        rps,
        totalHits,
        since: periodStartTime ? Math.floor((now - periodStartTime) / 1000) : 0
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // CORS
        },
      });
    }

    // Respon default
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*", // CORS
      },
    });
  }
};
