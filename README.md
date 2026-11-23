# DIGIVEX STORE 2.0

Aplikasi toko top-up berbasis HTML/CSS/JavaScript dengan Supabase.

## Perubahan pada paket ini
- Beranda diperbarui dengan tema ungu-neon dan banner Mobile Legends lokal agar tidak bergantung pada tautan gambar ImgBB yang rusak.
- Katalog Pulsa menampilkan operator Indonesia: Telkomsel, by.U, IM3, Tri, XL, AXIS, dan Smartfren. Kartu yang belum memiliki nominal di database ditandai “Segera tersedia”; admin perlu menambahkan nominal dan harga melalui dashboard sebelum transaksi dapat dibuat.
- Katalog Game menyediakan kartu tambahan Steam Wallet, Roblox Gift Cards, Magic Chess: Go Go, dan eFootball bila belum ada di database. Produk tambahan juga memerlukan nominal/harga dari admin sebelum dapat dipesan.
- Konfigurasi Supabase dipusatkan di `supabase-config.js`.
- Login/pendaftaran pelanggan menggunakan Supabase Auth (email + password), termasuk konfirmasi password dan penyimpanan profil.
- Admin dashboard memakai Supabase Auth dan memeriksa role `admin` dari `public.user_roles`.
- Dashboard menampilkan pesanan, pendapatan dari pesanan berstatus `Sukses`, status pesanan, dan katalog.
- Produk tetap memakai struktur tabel yang diperiksa: `id`, `nama`, `icon`, `kategori`, `items` (jsonb).

## Langkah pemasangan
1. Backup database Supabase.
2. Cocokkan URL dan publishable/anon key di `supabase-config.js` dengan Project URL di Supabase Settings > API. Paket memakai URL yang muncul pada `login.html` dan `admin.html` asli; `script.js` asli memiliki URL berbeda.
3. Pastikan tabel `profiles` memiliki kolom `id` (uuid, primary key/foreign key ke auth.users), `full_name` (text), dan `email` (text), dengan RLS/policy agar pengguna terautentikasi dapat membaca dan mengubah profil miliknya sendiri.
4. Jalankan `supabase-migration.sql` di Supabase SQL Editor.
5. Buat akun pelanggan melalui halaman Daftar.
6. Buat akun admin melalui Supabase Authentication > Users.
7. Salin UUID akun admin dari Authentication > Users, lalu jalankan perintah INSERT contoh di bagian akhir file SQL dengan UUID yang benar. Jangan berikan role admin kepada akun pelanggan biasa.
8. Periksa pengaturan email confirmation di Supabase.
9. Deploy seluruh folder ke hosting statis, atau push ke branch `main` GitHub untuk menjalankan workflow build APK.

## Keamanan dan batasan
- `supabase-config.js` hanya boleh berisi publishable/anon key. Jangan pernah memasukkan `service_role` key ke APK/browser.
- RLS harus aktif. Dashboard tidak dapat membaca/mengubah data jika policy belum dipasang atau role admin belum diberikan.
- Pelacakan pada versi ini mengharuskan pengguna login dan hanya menampilkan pesanan miliknya; ini mencegah kebocoran data pelanggan.
- Dashboard versi ini mengelola status pesanan serta tambah/hapus produk. Edit detail produk yang sudah ada dan manajemen akun pelanggan belum ditambahkan.
- APK belum dibangun di lingkungan ini. Workflow GitHub Actions akan menghasilkan APK debug setelah source di-push ke GitHub.

## Perubahan keamanan (hasil audit 23 Nov 2026)
- Pesanan dibuat lewat fungsi `create_order()` (harga diambil dari tabel `products`); insert langsung ke `orders` ditutup. **Jalankan ulang `supabase-migration.sql` sebelum men-deploy kode baru**, kalau tidak checkout akan gagal.
- Migrasi kini menghapus policy non-DIGIVEX di `orders/products/user_roles/profiles` dan memasang RLS `profiles`. Periksa `pg_policies` lebih dulu bila ada policy lama yang sengaja dipakai.
- Semua data dari database di-escape sebelum dirender; handler `onclick` inline dari data dihapus.
- Ada tabel `digivex_audit` untuk jejak perubahan status pesanan dan produk.
- `admin.html` tidak lagi dibundel ke APK; service worker memakai network-first (CACHE `digivex-v6`).

## Belum dikerjakan (perlu keputusan/akses Anda)
- **Verifikasi pembayaran (C-2)**: butuh pilihan gateway (Midtrans/Xendit/Tripay) dan Edge Function webhook dengan secret server. Selama belum ada, status `Sukses` tetap manual oleh admin; jangan terima uang sungguhan.
- MFA admin: tulis alur TOTP di admin.html, lalu aktifkan blok MFA (bagian 6) di file SQL.
- Dashboard Supabase: aktifkan konfirmasi email dan CAPTCHA, naikkan minimum password.
- SRI + versi tetap untuk supabase-js: ambil versi persis dan hash `sha384` dengan perintah di audit (butuh akses jaringan), atau salin pustaka ke `assets/`.
- APK rilis bertanda tangan (keystore di GitHub Secrets) dan penguncian action ke SHA commit.

## Pembayaran Xendit (kerangka, belum teruji)
1. Jalankan `supabase-payments.sql`. 2. `supabase secrets set XENDIT_SECRET_KEY=... XENDIT_CALLBACK_TOKEN=... SITE_URL=...`
3. `supabase functions deploy create-payment` dan `supabase functions deploy xendit-webhook` (gabungkan `supabase/config.toml.example`).
4. Di dashboard Xendit (sandbox), isi URL webhook invoice: `https://<project>.supabase.co/functions/v1/xendit-webhook`.
5. Uji alur penuh di sandbox, cocokkan nama field dengan dokumentasi Xendit terbaru, lalu set `DIGIVEX_PAYMENT_ENABLED = true` dan aktifkan blok GO-LIVE di SQL.


## Penyempurnaan tampilan Premium Level 2
- Halaman Akun kini memiliki menu Pusat Bantuan, Riwayat, Rewards (belum aktif), Tukar Voucher (belum aktif), Hubungi CS, dan informasi toko.
- Halaman Pusat Bantuan memuat FAQ, kontak WhatsApp melalui formulir CS yang sudah ada, informasi toko, syarat, dan kebijakan privasi.
- Perubahan visual hanya pada `index.html` dan `style.css`; alur autentikasi, query Supabase, database, `script.js`, konfigurasi, dan dashboard admin tidak diubah.
- Rewards dan voucher ditampilkan sebagai fitur segera hadir, bukan fitur aktif. Customer Service menggunakan nomor WhatsApp admin yang sudah ada di `script.js`.


## Pembaruan lanjutan V3 (23 Nov 2026)
- Memperbaiki race condition pemuatan `components.html`: aplikasi menunggu modal checkout/nominal tersedia sebelum inisialisasi selesai.
- Dashboard Admin kini dapat mengedit produk yang sudah ada (nama, ikon, kategori, dan daftar nominal/harga), selain tambah dan hapus.
- Dashboard Admin memiliki tab data pelanggan yang hanya-baca dari `profiles` (`id`, `full_name`, `email`). Pengelolaan akun Auth atau penonaktifan pelanggan belum disediakan.
- Workflow APK kini menyalin aset lokal ke `www/assets`, menyertakan konfigurasi Supabase, dan tidak membundel `admin.html` ke APK.
- Cache PWA dinaikkan ke `digivex-v7` agar file versi baru terambil.

### Sebelum dipakai
- Deploy ulang seluruh folder hasil ekstrak, bukan hanya `index.html`.
- Jalankan `supabase-migration.sql` dan `supabase-payments.sql` pada proyek Supabase yang dipakai DIGIVEX jika belum dijalankan. Backup database terlebih dahulu.
- Pastikan tabel `profiles` memiliki `id`, `full_name`, dan `email`, serta tabel `user_roles` berisi role admin yang benar.
- Pembayaran otomatis tetap NONAKTIF (`DIGIVEX_PAYMENT_ENABLED=false`). Kerangka Xendit belum dianggap siap produksi sampai secret, callback, fungsi `mark_order_paid`, dan transaksi sandbox diverifikasi.
- Jangan membagikan `service_role` key; hanya publishable key boleh berada di file browser.

## Pembaruan V4 — penyempurnaan tampilan
Fokus rilis ini adalah visual storefront: header, banner, kategori, katalog, footer, navigasi bawah, profil, form, dan modal checkout. CSS responsif disempurnakan untuk ponsel dan layar besar. Logika bisnis, autentikasi, data produk, serta pembayaran tidak diubah. Cache PWA dinaikkan ke `digivex-v8`.
