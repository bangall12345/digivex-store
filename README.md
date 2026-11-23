# DIGIVEX STORE 2.0

Aplikasi toko top-up berbasis HTML/CSS/JavaScript dengan Supabase.

## Perubahan pada paket ini
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
