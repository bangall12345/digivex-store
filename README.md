# DIGIVEX STORE 🚀

Selamat datang di aplikasi **Top Up Game & Pulsa**! Aplikasi web modern berbasis HTML, CSS, dan JavaScript yang terintegrasi dengan database Supabase.

## ✨ Fitur Utama:
- 🎮 **Katalog Produk**: Top Up Diamond (Mobile Legends, Free Fire), Pulsa, dan Paket Data.
- 🔍 **Pencarian & Filter**: Cari produk dengan mudah berdasarkan kategori.
- 🛒 **Sistem Checkout**: Input User ID/Zone ID otomatis menyesuaikan jenis produk.
- 🧾 **Riwayat Transaksi**: Menyimpan dan menampilkan riwayat pesanan pengguna.
- 🚚 **Lacak Pesanan**: Pantau status pesanan secara real-time.
- 💬 **Form Kontak WhatsApp**: Hubungi admin langsung melalui form yang terintegrasi dengan WhatsApp.
- 👑 **Panel Admin**:
  - Login aman menggunakan PIN (Default: `admin123`, bisa diubah).
  - Tambah Game/Kategori baru.
  - Edit nominal & harga produk langsung dari aplikasi.
  - Kelola status pesanan (Pending menjadi Sukses).
  - Melihat total pendapatan.

## 🛠️ Cara Menjalankan Aplikasi:
1. Pastikan file `index.html`, `style.css`, dan `script.js` berada di folder yang sama.
2. Buka file `script.js` dan pastikan konfigurasi Supabase sudah benar:
   ```javascript
   const SUPABASE_URL = "URL_SUPABASE_ANDA";
   const SUPABASE_KEY = "ANON_KEY_SUPABASE_ANDA";