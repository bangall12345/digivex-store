# DIGIVEX STORE 2.0

Aplikasi toko top-up berbasis HTML/CSS/JavaScript dengan Supabase.

## Perubahan pada paket ini
- Konfigurasi Supabase dipusatkan di `supabase-config.js`.
- Login/pendaftaran pelanggan menggunakan Supabase Auth (email + password).
- Admin dashboard memakai Supabase Auth dan memeriksa role `admin` dari `public.user_roles`.
- Dashboard menampilkan pesanan, pendapatan dari pesanan berstatus `Sukses`, status pesanan, dan katalog.
- Produk tetap memakai struktur tabel yang diperiksa: `id`, `nama`, `icon`, `kategori`, `items` (jsonb).

## Langkah pemasangan
1. Backup database Supabase.
2. Cocokkan URL dan publishable/anon key di `supabase-config.js` dengan Project URL di Supabase Settings > API. Paket memakai URL yang muncul pada `login.html` dan `admin.html` asli; `script.js` asli memiliki URL berbeda.
3. Jalankan `supabase-migration.sql` di Supabase SQL Editor.
4. Buat akun pelanggan melalui halaman Daftar.
5. Buat akun admin melalui Supabase Authentication > Users.
6. Salin UUID akun admin dari Authentication > Users, lalu jalankan perintah INSERT contoh di bagian akhir file SQL dengan UUID yang benar. Jangan berikan role admin kepada akun pelanggan biasa.
7. Periksa pengaturan email confirmation di Supabase.
8. Deploy seluruh folder ke hosting statis, atau push ke branch `main` GitHub untuk menjalankan workflow build APK.

## Keamanan dan batasan
- `supabase-config.js` hanya boleh berisi publishable/anon key. Jangan pernah memasukkan `service_role` key ke APK/browser.
- RLS harus aktif. Dashboard tidak dapat membaca/mengubah data jika policy belum dipasang atau role admin belum diberikan.
- Pelacakan pada versi ini mengharuskan pengguna login dan hanya menampilkan pesanan miliknya; ini mencegah kebocoran data pelanggan.
- Dashboard versi ini mengelola status pesanan serta tambah/hapus produk. Edit detail produk yang sudah ada dan manajemen akun pelanggan belum ditambahkan.
- APK belum dibangun di lingkungan ini. Workflow GitHub Actions akan menghasilkan APK debug setelah source di-push ke GitHub.
