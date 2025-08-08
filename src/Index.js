// src/index.js - Ini akan menjadi Worker yang menerima semua lalu lintas masuk

// URL Pages.dev Anda yang sebenarnya
const PAGES_DEV_URL = "https://l7.skyhosting.lol"; 

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dapatkan Durable Object Stub
    let id = env.COUNTER.idFromName("my-app-metrics");
    let stub = env.COUNTER.get(id);

    // Header CORS (penting jika Anda mengakses /stats dari domain lain)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Bisa jadi spesifik ke domain Pages.dev jika diperlukan
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight OPTIONS requests for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- Logic Utama ---

    if (path === "/stats") {
      // Jika permintaan ke /stats, ambil metrik dari Durable Object
      const metricsResponse = await stub.fetch(new Request("http://dummy-host/get"));
      const metricsBody = await metricsResponse.text();
      const headers = new Headers(metricsResponse.headers);
      
      // Tambahkan header CORS
      for (const [key, value] of Object.entries(corsHeaders)) {
          headers.set(key, value);
      }
      return new Response(metricsBody, { status: metricsResponse.status, headers: headers });

    } else {
      // Untuk semua permintaan lain (termasuk root, assets, dll.)
      // 1. Catat sebagai hit di Durable Object
      await stub.fetch(new Request("http://dummy-host/increment"));

      // 2. Teruskan permintaan ke Pages.dev Anda
      let newUrl = new URL(request.url);
      newUrl.hostname = new URL(PAGES_DEV_URL).hostname;
      newUrl.protocol = new URL(PAGES_DEV_URL).protocol;

      // Buat permintaan baru untuk diteruskan
      let newRequest = new Request(newUrl.toString(), request);
      // Hapus header Host agar tidak terjadi error routing di Pages.dev
      newRequest.headers.set("Host", new URL(PAGES_DEV_URL).hostname); 

      // Lakukan fetch ke Pages.dev dan kembalikan responsnya
      const pagesResponse = await fetch(newRequest);

      // Anda mungkin ingin menyalin beberapa header dari respons Pages.dev
      // Misalnya, Content-Type
      const responseHeaders = new Headers(pagesResponse.headers);
      // Jika Anda tidak ingin Pages.dev menampilkan sesuatu yang spesifik, Anda bisa memodifikasi respons di sini

      return new Response(pagesResponse.body, {
          status: pagesResponse.status,
          statusText: pagesResponse.statusText,
          headers: responseHeaders,
      });
    }
  }
};
