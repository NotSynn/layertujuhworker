// src/index.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dapatkan instance Durable Object. Gunakan IDFromName untuk mendapatkan ID yang konsisten.
    // "my-app-metrics" adalah nama unik untuk instance penghitung Anda.
    let id = env.COUNTER.idFromName("my-app-metrics");
    let stub = env.COUNTER.get(id);

    // Perhatikan header CORS untuk Pages.dev Anda
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://l7.skyhosting.lol", // Ganti dengan domain Pages.dev Anda
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight OPTIONS requests for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    let response;

    if (path === "/stats") {
      // Panggil metode 'get' di Durable Object untuk mendapatkan metrik
      response = await stub.fetch(new Request("http://dummy-host/get"));
    } else {
      // Panggil metode 'increment' di Durable Object untuk mencatat hit
      // Ini akan dipicu saat Pages.dev melakukan fetch(workerUrl)
      response = await stub.fetch(new Request("http://dummy-host/increment"));
    }

    // Ambil body dan headers dari respons Durable Object
    const responseBody = await response.text();
    const responseHeaders = new Headers(response.headers);

    // Tambahkan header CORS ke respons Worker sebelum mengirimkannya kembali ke Pages.dev
    for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
    }

    return new Response(responseBody, {
        status: response.status,
        headers: responseHeaders,
    });
  }
};
