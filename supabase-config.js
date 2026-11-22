// Konfigurasi client publik DIGIVEX. Jangan pernah memasukkan service_role key di sini.
window.DIGIVEX_SUPABASE_URL = 'https://bopjwidqospiraxzpqz.supabase.co';
window.DIGIVEX_SUPABASE_KEY = 'sb_publishable_DXnkosMz9WhV5D4KDLvPbA_Nkpeg_ZX';
window.createDigivexClient = () => {
  if (!window.supabase?.createClient) throw new Error('Library Supabase belum dimuat.');
  return window.supabase.createClient(window.DIGIVEX_SUPABASE_URL, window.DIGIVEX_SUPABASE_KEY);
};
