let requestCount = 0;
let lastReset = Date.now();
let currentRPS = 0;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/hit") {
      requestCount++;
      return new Response("ok", {
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    if (url.pathname === "/stats") {
      const now = Date.now();
      if (now - lastReset >= 1000) {
        currentRPS = requestCount;
        requestCount = 0;
        lastReset = now;
      }
      return new Response(JSON.stringify({ rps: currentRPS }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
