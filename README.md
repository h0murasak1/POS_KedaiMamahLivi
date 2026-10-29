# 🌸 POS Kedai Mamah Livi

Sistem Point of Sale (POS) modern, responsif, dan *offline-first* yang dirancang khusus untuk operasional **Kedai Mamah Livi**. Aplikasi ini memiliki antarmuka yang ramah pengguna bertema **Pink & Putih** yang estetik, mendukung sinkronisasi otomatis ke Cloud (Supabase), serta sistem otorisasi pembatalan transaksi berizin.

---

## ✨ Fitur Utama

- **Offline-First & Auto-Sync**:
  - Transaksi tetap berjalan normal saat koneksi internet terputus menggunakan **IndexedDB (Dexie.js)**.
  - Sinkronisasi otomatis ke **Supabase** secara *idempotent* begitu koneksi internet kembali pulih.
- **Kasir & POS Responsif**:
  - Tampilan dioptimalkan untuk perangkat Desktop, Tablet, hingga Android / Smartphone.
  - Pemilihan menu berbasis kategori chip pill, keranjang transaksi interaktif, dan kalkulator pembayaran dengan tombol uang pas.
- **Sistem Otorisasi Pembatalan Transaksi**:
  - Kasir dapat membatalkan transaksi yang keliru dengan memasukkan **PIN Owner** di tempat, atau melalui **Pengajuan Jarak Jauh**.
  - Owner dapat meninjau, menyetujui, atau menolak permintaan pembatalan secara *real-time*.
- **Dashboard & Analitik**:
  - Dashboard terpisah untuk Pemilik (*Owner*) dan Staf Kasir.
  - Grafik tren penjualan harian serta daftar 5 menu terlaris.
- **Manajemen Menu & Kategori**:
  - Kelola nama menu, harga, deskripsi, upload foto menu, status ketersediaan, dan varian harga.
- **Manajemen Staf Kasir**:
  - Pembuatan akun kasir terpercaya oleh Owner serta aktivasi/nonaktivasi akun kasir.
- **Laporan & Audit Log**:
  - Riwayat audit lengkap untuk setiap aktivitas penting sistem.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend**: React 19, Vite, Tailwind CSS v4
- **State & Offline Storage**: Dexie.js (IndexedDB)
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, RPC Functions)
- **Visualisasi & Ikon**: Recharts, Lucide React, Canvas Confetti
- **Notifikasi**: React Hot Toast

---

## 🚀 Panduan Instalasi Lokal

### 1. Clone Repositori
```bash
git clone https://github.com/<username>/POS_KedaiMamahLivi.git
cd POS_KedaiMamahLivi
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi konfigurasi Supabase Anda pada file `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Setup Database
Jalankan skrip migrasi SQL yang berada di dalam direktori `supabase/migrations/` pada **SQL Editor** project Supabase Anda.

### 5. Jalankan Aplikasi
```bash
npm run dev
```
Buka `http://localhost:3000` pada browser Anda.
