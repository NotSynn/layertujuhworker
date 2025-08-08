let requests = 0;
let lastTime = Date.now();

export default {
  async fetch(request, env) {
    const now = Date.now();

    // Hitung RPS
    if (now - lastTime >= 1000) {
      requests = 0;
      lastTime = now;
    }
    requests++;

    const rps = requests;

    return new Response(JSON.stringify({ rps }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
};
