let hits = 0;
let lastSecond = Math.floor(Date.now() / 1000);
let rps = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Tambah hit setiap request ke domain Pages
    if (path !== "/stats") {
      hits++;
    }

    const currentSecond = Math.floor(Date.now() / 1000);
    if (currentSecond !== lastSecond) {
      rps = hits;
      hits = 0;
      lastSecond = currentSecond;
    }

    if (path === "/stats") {
      return new Response(JSON.stringify({ rps }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // CORS
        },
      });
    }

    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*", // CORS
      },
    });
  }
};
