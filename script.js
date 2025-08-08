let requestCount = 0;
let lastCheck = Date.now();
let currentRPS = 0;

export default {
  async fetch(request, env, ctx) {
    const now = Date.now();

    // Hitung request
    requestCount++;

    // Reset setiap 1 detik
    if (now - lastCheck >= 1000) {
      currentRPS = requestCount;
      requestCount = 0;
      lastCheck = now;
    }

    return new Response(JSON.stringify({ rps: currentRPS }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
