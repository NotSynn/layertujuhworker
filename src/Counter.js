// src/Counter.js

const IDLE_TIMEOUT_MS = 60 * 1000; // 1 menit

export class Counter {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    this.totalHits = 0;
    this.rps = 0;
    this.hitsThisSecond = 0;
    this.lastSecond = Math.floor(Date.now() / 1000);
    this.periodStartTime = null;
    this.lastRequestTime = null; // Tambahan untuk melacak waktu request terakhir

    // Menginisialisasi status dari Durable Object Storage saat objek dibuat/diaktifkan
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
      console.log("Counter DO initialized. Current totalHits:", this.totalHits); // Untuk debugging
    });
  }

  // Metode untuk menginkremen hit
  async incrementHits() {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);

    if (this.periodStartTime === null) {
      this.periodStartTime = now;
    }
    this.totalHits++;
    this.hitsThisSecond++;
    this.lastRequestTime = now; // Perbarui waktu request terakhir

    // Logic RPS: hitungan RPS adalah dari detik sebelumnya
    if (currentSecond !== this.lastSecond) {
      this.rps = this.hitsThisSecond;
      this.hitsThisSecond = 0; // Reset untuk detik baru
      this.lastSecond = currentSecond;
    }

    // Reset jika sudah ≥ 1000 hit & 120 detik sejak periode dimulai (logic dari Anda)
    if (this.totalHits >= 1000 && this.periodStartTime !== null && (now - this.periodStartTime) >= 120000) {
      await this.resetMetrics();
      console.log("Metrics reset due to threshold.");
    }

    // Jadwalkan atau batalkan alarm reset idle
    await this.setIdleAlarm();

    // Simpan status ke penyimpanan Durable Object
    await this.saveMetrics();
    console.log(`Hit recorded. totalHits: ${this.totalHits}, rps: ${this.rps}`); // Untuk debugging
  }

  // Metode untuk mendapatkan metrik
  async getMetrics() {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);

    // Pastikan RPS diupdate jika detik sudah berganti
    if (currentSecond !== this.lastSecond) {
        // Ini adalah hit terakhir di detik sebelumnya, jadi ini menjadi RPS
        this.rps = this.hitsThisSecond;
        this.hitsThisSecond = 0;
        this.lastSecond = currentSecond;
        await this.saveMetrics(); // Simpan perubahan RPS saat ini
    }

    // Perbarui lastRequestTime juga saat stats diambil agar tidak idle terlalu cepat
    this.lastRequestTime = now;
    await this.setIdleAlarm(); // Perbarui alarm juga

    return {
      rps: this.rps,
      totalHits: this.totalHits,
      since: this.periodStartTime ? Math.floor((now - this.periodStartTime) / 1000) : 0
    };
  }

  // Metode untuk mereset semua metrik
  async resetMetrics() {
    this.totalHits = 0;
    this.rps = 0;
    this.hitsThisSecond = 0;
    this.lastSecond = Math.floor(Date.now() / 1000);
    this.periodStartTime = null;
    this.lastRequestTime = null;
    await this.state.storage.delete("metrics"); // Hapus dari penyimpanan persisten juga
    console.log("Metrics have been fully reset.");
  }

  // Mengatur/memperbarui alarm untuk reset idle
  async setIdleAlarm() {
    const currentAlarm = await this.state.storage.getAlarm();
    const now = Date.now();
    const nextAlarmTime = now + IDLE_TIMEOUT_MS;

    // Hanya atur alarm jika alarm saat ini tidak ada atau dijadwalkan lebih awal dari yang baru
    if (currentAlarm === null || currentAlarm < nextAlarmTime) {
      await this.state.storage.setAlarm(nextAlarmTime);
      console.log(`Idle alarm set for: ${new Date(nextAlarmTime).toISOString()}`);
    }
  }

  // Menyimpan metrik ke penyimpanan persisten
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
      console.log("Metrics reset due to idle.");
    } else {
      // Jika ada request masuk setelah alarm dijadwalkan tapi sebelum terpicu,
      // jadwalkan ulang alarm agar tetap aktif.
      await this.setIdleAlarm();
      console.log("Alarm triggered but not truly idle, rescheduling.");
    }
  }

  // Metode fetch Durable Object, digunakan oleh Worker utama untuk berinteraksi
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
