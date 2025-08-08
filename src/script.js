const IDLE_TIMEOUT_MS = 60 * 1000; // 1 menit

export class Counter {
  constructor(state, env) {
    this.state = state;
    this.env = env; // Jika Anda perlu mengakses variabel lingkungan dari Durable Object
    this.totalHits = 0;
    this.rps = 0;
    this.hitsThisSecond = 0;
    this.lastSecond = Math.floor(Date.now() / 1000);
    this.periodStartTime = null;
    this.lastRequestTime = null; // Tambahan untuk melacak waktu request terakhir

    // Memuat status dari penyimpanan Durable Object saat inisialisasi
    // Penting untuk memuat status agar tidak hilang jika objek di-evict dari memori
    this.state.blockConcurrencyWhile(async () => {
      const storedState = await this.state.storage.get("metrics");
      if (storedState) {
        this.totalHits = storedState.totalHits || 0;
        this.rps = storedState.rps || 0;
        this.hitsThisSecond = storedState.hitsThisSecond || 0;
        this.lastSecond = storedState.lastSecond || Math.floor(Date.now() / 1000);
        this.periodStartTime = storedState.periodStartTime;
        this.lastRequestTime = storedState.lastRequestTime;
      }
    });
  }

  // Metode untuk memperbarui metrik dan menjadwalkan alarm
  async incrementHits() {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);

    if (this.periodStartTime === null) {
      this.periodStartTime = now;
    }
    this.totalHits++;
    this.hitsThisSecond++;
    this.lastRequestTime = now; // Perbarui waktu request terakhir

    // Logic RPS
    if (currentSecond !== this.lastSecond) {
      this.rps = this.hitsThisSecond;
      this.hitsThisSecond = 0;
      this.lastSecond = currentSecond;
    }

    // Reset jika sudah ≥ 1000 hit & 120 detik sejak periode dimulai
    // (Logic ini tetap saya sertakan sesuai kode asli Anda, bisa disesuaikan)
    if (this.totalHits >= 1000 && this.periodStartTime !== null && (now - this.periodStartTime) >= 120000) {
      this.resetMetrics();
    }

    // Jadwalkan atau batalkan alarm reset idle
    await this.setIdleAlarm();

    // Simpan status ke penyimpanan Durable Object
    await this.saveMetrics();
  }

  async getMetrics() {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);

    // Perbarui RPS untuk detik terakhir jika ada perubahan detik saat ini
    if (currentSecond !== this.lastSecond) {
        this.rps = this.hitsThisSecond;
        this.hitsThisSecond = 0;
        this.lastSecond = currentSecond;
        await this.saveMetrics(); // Simpan perubahan RPS saat ini
    }

    return {
      rps: this.rps,
      totalHits: this.totalHits,
      since: this.periodStartTime ? Math.floor((now - this.periodStartTime) / 1000) : 0
    };
  }

  async resetMetrics() {
    this.totalHits = 0;
    this.rps = 0;
    this.hitsThisSecond = 0;
    this.lastSecond = Math.floor(Date.now() / 1000);
    this.periodStartTime = null;
    this.lastRequestTime = null;
    await this.state.storage.delete("metrics"); // Hapus dari penyimpanan persisten juga
    console.log("Metrics have been reset due to idle or threshold.");
  }

  async setIdleAlarm() {
    const currentAlarm = await this.state.storage.getAlarm();
    const now = Date.now();

    // Jika ada request baru, batalkan alarm sebelumnya dan jadwalkan yang baru
    if (currentAlarm !== null) {
      await this.state.storage.deleteAlarm();
    }

    // Jadwalkan alarm untuk reset jika idle
    await this.state.storage.setAlarm(now + IDLE_TIMEOUT_MS);
    console.log(`Idle alarm set for: ${new Date(now + IDLE_TIMEOUT_MS).toISOString()}`);
  }

  async saveMetrics() {
    await this.state.storage.put("metrics", {
      totalHits: this.totalHits,
      rps: this.rps,
      hitsThisSecond: this.hitsThisSecond,
      lastSecond: this.lastSecond,
      periodStartTime: this.periodStartTime,
      lastRequestTime: this.lastRequestTime
    });
  }

  // Handler untuk Durable Object Alarms
  async alarm() {
    console.log("Alarm triggered!");
    const now = Date.now();

    // Periksa apakah benar-benar idle (tidak ada request dalam 1 menit terakhir)
    if (this.lastRequestTime === null || (now - this.lastRequestTime) >= IDLE_TIMEOUT_MS) {
      await this.resetMetrics();
    } else {
      // Jika ada request masuk setelah alarm dijadwalkan tapi sebelum terpicu,
      // jadwalkan ulang alarm. Ini adalah edge case yang penting.
      await this.setIdleAlarm();
      console.log("Alarm triggered but not truly idle, rescheduling.");
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/increment") {
      await this.incrementHits();
      return new Response("Incremented", { status: 200 });
    } else if (path === "/get") {
      const metrics = await this.getMetrics();
      return new Response(JSON.stringify(metrics), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response("Not Found", { status: 404 });
    }
  }
}
