/* =========================================
   KONFIGURASI SUPABASE
   ========================================= */
const SUPABASE_URL = "https://bopjwidqospiraxzpqz.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_DXnkosMz9WhV5D4KDLvPbA_Nkpeg_ZX"; 

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_WA_NUMBER = "6282162726608";
const ADMIN_EMAIL = "abasyi2020@gmail.com"; 

const defaultDataGame = [
    { id: 'ml', nama: 'Mobile Legends', icon: 'fa-shield-halved', color: '#3b82f6', kategori: 'Game', items: [ { nama: '5 Diamond', harga: 1500 }, { nama: '86 Diamond', harga: 20000 } ] },
    { id: 'ff', nama: 'Free Fire', icon: 'fa-fire', color: '#f59e0b', kategori: 'Game', items: [ { nama: '5 Diamond', harga: 1000 }, { nama: '70 Diamond', harga: 10000 } ] },
    { id: 'tsel', nama: 'Telkomsel', icon: 'fa-signal', color: '#ef4444', kategori: 'Pulsa', items: [ { nama: 'Pulsa 10.000', harga: 11000 }, { nama: 'Pulsa 25.000', harga: 26000 } ] },
    { id: 'isat', nama: 'Indosat', icon: 'fa-signal', color: '#f59e0b', kategori: 'Pulsa', items: [ { nama: 'Pulsa 10.000', harga: 10500 } ] },
    { id: 'tsel-data', nama: 'Data Telkomsel', icon: 'fa-wifi', color: '#ef4444', kategori: 'Data', items: [ { nama: 'Data 5GB', harga: 50000 } ] }
];

let dataGame = [];
let selectedGame = null;
let selectedItem = null;
let userLogin = null;
let userEmail = null;
let userOrderKey = null;
let isAdminLoggedIn = false;
let currentKategori = 'Game'; 


function showToast(message, type = 'success') {
    const toast = document.getElementById('toastContainer');
    const icon = document.getElementById('toastIcon');
    document.getElementById('toastMessage').innerText = message;
    toast.className = 'show ' + type;
    icon.className = type === 'success' ? 'fa-solid fa-circle-check' : (type === 'error' ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-circle-info');
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

window.onload = async function() {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session) {
        localStorage.removeItem('topup_user');
        localStorage.removeItem('topup_email');
        window.location.replace('login.html');
        return;
    }
    const authUser = data.session.user;
    userEmail = (authUser.email || '').toLowerCase();
    userLogin = authUser.user_metadata?.full_name || localStorage.getItem('topup_user') || userEmail.split('@')[0];
    userOrderKey = userLogin + " (" + userEmail + ")";
    isAdminLoggedIn = userEmail === ADMIN_EMAIL;
    localStorage.setItem('topup_user', userLogin);
    localStorage.setItem('topup_email', userEmail);
    const profile = document.getElementById('profileNameDisplay');
    if (profile) profile.innerText = userLogin;
    await loadProductsFromDB();
    await loadRiwayatFromDB();
}

async function loadProductsFromDB() {
    const container = document.getElementById('productList');
    if(!container) return;
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center; width:100%;">Menghubungkan ke database...</p>';
    
    try {
        const { data, error } = await sb.from('products').select('*');
        if (error) {
            container.innerHTML = `<div style="background:#fee2e2; color:#ef4444; padding:15px; border-radius:10px; width:100%; text-align:left; font-size:12px;">
                <strong>Gagal Konek Database:</strong><br>${error.message}
            </div>`;
            return;
        }

        if (data.length === 0) {
            container.innerHTML = '<p style="color:orange; text-align:center;">Database kosong. Memasukkan data awal...</p>';
            await sb.from('products').insert(defaultDataGame);
            dataGame = defaultDataGame;
        } else {
            dataGame = data;
        }

        filterKategori('Game', document.getElementById('cat-Game'));
        isiDropdownAdmin();

    } catch (err) {
        container.innerHTML = `<div style="color:red;">Sistem Error: ${err.message}</div>`;
    }
}

async function loadRiwayatFromDB() {
    // Cek riwayat berdasarkan nama user
    const { data, error } = await sb.from('orders').select('*').eq('user_name', userOrderKey || userLogin).order('created_at', { ascending: false });
    if (error) return console.error(error);
    renderRiwayatUser(data);
}

async function loadAllOrdersAdmin() {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);
    renderAdminOrders(data);
}

async function prosesLogout() {
    const { error } = await sb.auth.signOut();
    if (error) {
        console.error(error);
        return showToast("Gagal keluar. Coba lagi.", "error");
    }
    localStorage.removeItem('topup_user');
    localStorage.removeItem('topup_email');
    showToast("Berhasil keluar", "info");
    setTimeout(() => window.location.replace("login.html"), 700);
}

function gantiHalaman(namaHalaman, element) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('page-' + namaHalaman).classList.add('active');
    document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));
    if(element) element.classList.add('active');
    if(namaHalaman === 'history') loadRiwayatFromDB();
}

function filterKategori(kategori, element) {
    currentKategori = kategori;
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active-cat'));
    if(element) element.classList.add('active-cat');

    document.getElementById('sectionTitle').innerText = "Katalog " + kategori;
    const container = document.getElementById('productList');
    container.innerHTML = "";
    
    const filteredData = dataGame.filter(g => g.kategori === kategori || (!g.kategori && kategori === 'Game'));

    if(filteredData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; width:100%;">Belum ada produk di kategori ini.</p>';
        return;
    }

    filteredData.forEach(g => {
        container.innerHTML += `
            <div class="product-card" onclick="bukaNominal('${g.id}')" style="background: linear-gradient(135deg, ${g.color}33, #1e293b);">
                <i class="fa-solid ${g.icon} product-icon" style="color: ${g.color};"></i>
                <div class="product-info"><h4>${g.nama}</h4></div>
            </div>
        `;
    });
}

function bukaNominal(gameId) {
    selectedGame = dataGame.find(g => g.id === gameId);
    if (!selectedGame) return;
    document.getElementById('nominalTitle').innerText = "Pilih Nominal - " + selectedGame.nama;
    const listContainer = document.getElementById('nominalList');
    listContainer.innerHTML = "";
    selectedGame.items.forEach(item => {
        const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.harga);
        listContainer.innerHTML += `
            <div class="nominal-item" onclick="pilihNominal('${item.nama}', ${item.harga})">
                <div class="nominal-info"><h4>${item.nama}</h4></div>
                <div class="nominal-price">${hargaFormat}</div>
            </div>
        `;
    });
    document.getElementById('nominalModal').classList.add('active');
}

function tutupNominal() { document.getElementById('nominalModal').classList.remove('active'); }

function pilihNominal(namaItem, harga) {
    selectedItem = { nama: namaItem, harga: harga };
    const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga);
    document.getElementById('modalProduct').innerText = selectedGame.nama;
    document.getElementById('modalItem').innerText = namaItem;
    document.getElementById('modalPrice').innerText = hargaFormat;
    
    const zoneGroup = document.getElementById('zoneIdGroup');
    const zoneInput = document.getElementById('zoneId');
    const labelUserId = document.getElementById('labelUserId');
    const inputUserId = document.getElementById('userId');

    if (selectedGame.id === 'ml') {
        zoneGroup.style.display = 'block'; 
        zoneInput.setAttribute('required', 'true');
        labelUserId.innerText = "Masukkan User ID";
        inputUserId.placeholder = "Contoh: 12345678";
    } else if (selectedGame.kategori === 'Pulsa' || selectedGame.kategori === 'Data') {
        zoneGroup.style.display = 'none'; 
        zoneInput.removeAttribute('required'); 
        zoneInput.value = '';
        labelUserId.innerText = "Masukkan Nomor HP";
        inputUserId.placeholder = "Contoh: 08123456789";
    } else {
        zoneGroup.style.display = 'none'; 
        zoneInput.removeAttribute('required'); 
        zoneInput.value = '';
        labelUserId.innerText = "Masukkan User ID";
        inputUserId.placeholder = "Contoh: 12345678";
    }

    tutupNominal();
    document.getElementById('checkoutModal').classList.add('active');
}

function tutupCheckout() {
    document.getElementById('checkoutModal').classList.remove('active');
    document.getElementById('formOrder').reset();
}

async function prosesPesanan(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'Memproses...'; btn.disabled = true;

    const userId = document.getElementById('userId').value;
    const zoneId = document.getElementById('zoneId').value;
    const payment = document.getElementById('paymentMethod').value;
    let targetId = userId + (selectedGame.id === 'ml' && zoneId ? " (" + zoneId + ")" : "");

    // INI BAGIAN YANG DIUBAH: Nama dan Email disatukan
    const { error } = await sb.from('orders').insert([{
        user_name: userOrderKey || (userLogin + " (" + userEmail + ")"), 
        product_name: selectedGame.nama, 
        item_name: selectedItem.nama,
        price: selectedItem.harga, 
        target_id: targetId, 
        payment_method: payment,
        status: 'Pending' 
    }]);

    btn.innerHTML = 'Buat Pesanan'; btn.disabled = false;

    if (error) {
        showToast("Gagal: " + error.message, "error");
    } else {
        tutupCheckout();
        showToast("Pesanan Dibuat! Menunggu konfirmasi Admin.", "success");
        setTimeout(() => { 
            gantiHalaman('history', document.querySelectorAll('.bottom-nav a')[2]); 
        }, 1500);
    }
}

async function lacakPesanan() {
    const input = document.getElementById('trackingInput').value.trim();
    const resContainer = document.getElementById('trackingResult');
    
    if (!input) return showToast("Masukkan ID atau Nama", "error");
    
    resContainer.innerHTML = '<p style="text-align:center; font-size:12px; color:var(--text-muted);">Mencari...</p>';
    
    const { data, error } = await sb.from('orders')
        .select('*')
        .or(`target_id.ilike.%${input}%,user_name.ilike.%${input}%`)
        .order('created_at', { ascending: false });
        
    if (error || !data || data.length === 0) {
        resContainer.innerHTML = '<p style="text-align:center; color:var(--danger); font-size:13px;">Pesanan tidak ditemukan.</p>';
        return;
    }
    
    resContainer.innerHTML = "";
    data.forEach(o => {
        const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(o.price);
        const tgl = new Date(o.created_at).toLocaleString('id-ID');
        const statusClass = o.status === 'Sukses' ? 'badge-sukses' : 'badge-pending';
        
        resContainer.innerHTML += `
            <div class="history-card" style="border-left-color: ${o.status === 'Sukses' ? 'var(--success)' : '#f59e0b'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h4>${o.product_name} - ${o.item_name}</h4>
                    <span class="${statusClass}">${o.status || 'Pending'}</span>
                </div>
                <p>Pembeli: ${o.user_name}</p>
                <p>ID Tujuan: ${o.target_id}</p>
                <p>Total: <strong>${hargaFormat}</strong></p>
                <p style="font-size:11px; opacity:0.7; margin-top:8px;">${tgl}</p>
            </div>
        `;
    });
}

function renderRiwayatUser(orders) {
    const container = document.getElementById('historyList');
    container.innerHTML = "";
    if (!orders || orders.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px 0; color:var(--text-muted);"><i class="fa-solid fa-box-open" style="font-size:40px; margin-bottom:10px; opacity:0.5;"></i><br>Belum ada transaksi.</div>';
        return;
    }
    orders.forEach(o => {
        const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(o.price);
        const tgl = new Date(o.created_at).toLocaleString('id-ID');
        const statusClass = o.status === 'Sukses' ? 'badge-sukses' : 'badge-pending';
        
        container.innerHTML += `
            <div class="history-card" style="border-left-color: ${o.status === 'Sukses' ? 'var(--success)' : '#f59e0b'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h4>${o.product_name} - ${o.item_name}</h4>
                    <span class="${statusClass}">${o.status || 'Pending'}</span>
                </div>
                <p>ID Tujuan: ${o.target_id}</p>
                <p>Total: <strong>${hargaFormat}</strong> (${o.payment_method})</p>
                <p style="font-size:11px; opacity:0.7; margin-top:8px;">${tgl}</p>
            </div>
        `;
    });
}

function bukaAdminLogin() {
    if (!isAdminLoggedIn || userEmail !== ADMIN_EMAIL) {
        return showToast("Akses admin hanya untuk akun admin utama.", "error");
    }
    gantiHalaman('admin', document.querySelectorAll('.bottom-nav a')[4]);
    loadAllOrdersAdmin();
}

function tutupLoginAdmin() { document.getElementById('adminLoginModal').classList.remove('active'); }

function cekPasswordAdmin() {
    if (userEmail !== ADMIN_EMAIL) {
        return showToast("Gunakan akun admin utama untuk mengakses panel admin.", "error");
    }
    isAdminLoggedIn = true;
    tutupLoginAdmin();
    gantiHalaman('admin', document.querySelectorAll('.bottom-nav a')[4]);
    loadAllOrdersAdmin();
    showToast("Identitas admin terverifikasi.", "success");
}

function switchTabAdmin(tab, btn) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.admin-content-box').forEach(c => c.classList.remove('active'));
    document.getElementById('admin-tab-' + tab).classList.add('active');
    if(tab === 'pesanan') loadAllOrdersAdmin();
}

function isiDropdownAdmin() {
    const select = document.getElementById('adminSelectGame');
    if(!select) return;
    select.innerHTML = '<option value="">-- Pilih Produk --</option>';
    dataGame.forEach(g => { 
        select.innerHTML += `<option value="${g.id}">[${g.kategori}] ${g.nama}</option>`; 
    });
}

function tampilkanEditorAdmin() {
    const gameId = document.getElementById('adminSelectGame').value;
    const editorBox = document.getElementById('adminEditorBox');
    if (!gameId) { editorBox.style.display = 'none'; return; }
    const game = dataGame.find(g => g.id === gameId);
    document.getElementById('adminGameTitle').innerText = "Edit: " + game.nama;
    const itemsContainer = document.getElementById('adminItemsContainer');
    itemsContainer.innerHTML = "";
    game.items.forEach((item, index) => {
        itemsContainer.innerHTML += `<div class="admin-item-row"><input type="text" id="editName_${index}" value="${item.nama}" class="admin-input" style="margin-bottom:0; padding:10px;"><input type="number" id="editPrice_${index}" value="${item.harga}" class="admin-input" style="margin-bottom:0; padding:10px;"></div>`;
    });
    editorBox.style.display = 'block';
}

async function simpanPerubahanAdmin() {
    const gameId = document.getElementById('adminSelectGame').value;
    if (!gameId) return;
    const game = dataGame.find(g => g.id === gameId);
    game.items.forEach((item, index) => {
        let newName = document.getElementById(`editName_${index}`).value;
        let newPrice = parseInt(document.getElementById(`editPrice_${index}`).value);
        if(newName && !isNaN(newPrice)) { game.items[index].nama = newName; game.items[index].harga = newPrice; }
    });
    const { error } = await sb.from('products').update({ items: game.items }).eq('id', gameId);
    if (error) return showToast("Gagal: " + error.message, "error");
    showToast("Tersimpan ke Database!", "success");
    filterKategori(currentKategori); 
}

async function tambahGameBaru() {
    const nama = document.getElementById('newGameName').value.trim();
    const cat = document.getElementById('newGameCat').value;
    
    if (!nama) return showToast("Nama game kosong!", "error");
    
    const newId = nama.toLowerCase().replace(/[^a-z0-9]/g, '') + Date.now().toString().slice(-4);
    
    const newGame = { 
        id: newId, 
        nama: nama, 
        icon: 'fa-gamepad', 
        color: '#8b5cf6', 
        kategori: cat, 
        items: [{ nama: 'Contoh Item', harga: 10000 }] 
    };
    
    const { error } = await sb.from('products').insert([newGame]);
    if (error) return showToast("Gagal: " + error.message, "error");
    
    dataGame.push(newGame);
    document.getElementById('newGameName').value = "";
    isiDropdownAdmin();
    filterKategori(currentKategori);
    showToast("Game berhasil ditambahkan!", "success");
}

function gantiPinAdmin() {
    showToast("PIN lokal dinonaktifkan. Admin menggunakan Supabase Auth.", "info");
}

async function ubahStatusSukses(orderId) {
    const { error } = await sb.from('orders').update({ status: 'Sukses' }).eq('id', orderId);
    if(error) return showToast("Gagal update status!", "error");
    showToast("Pesanan Selesai!", "success");
    loadAllOrdersAdmin();
}

function renderAdminOrders(orders) {
    const container = document.getElementById('adminOrderList');
    container.innerHTML = "";
    if (!orders || orders.length === 0) { container.innerHTML = '<p style="color: #94a3b8; text-align: center;">Belum ada pesanan.</p>'; return; }
    
    orders.forEach(o => {
        const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(o.price);
        const isSukses = o.status === 'Sukses';
        
        container.innerHTML += `
            <div style="background: #0f172a; padding: 15px; border-radius: 12px; margin-bottom: 10px; border-left: 4px solid ${isSukses ? '#10b981' : '#f59e0b'};">
                <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 10px;">
                    <strong style="color: var(--primary);">${o.product_name} - ${o.item_name}</strong>
                    <span style="color: var(--success); font-weight: bold;">${hargaFormat}</span>
                </div>
                <p style="font-size: 12px; color: #cbd5e1; margin-bottom:4px;">Pembeli: <strong>${o.user_name}</strong></p>
                <p style="font-size: 12px; color: #cbd5e1; margin-bottom:4px;">Tujuan: ${o.target_id}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                    <span class="${isSukses ? 'badge-sukses' : 'badge-pending'}">${o.status || 'Pending'}</span>
                    ${!isSukses ? `<button onclick="ubahStatusSukses('${o.id}')" class="btn-admin-save" style="width:auto; padding:8px 15px; font-size:12px;"><i class="fa-solid fa-check"></i> Tandai Sukses</button>` : ''}
                </div>
            </div>
        `;
    });
}

functi
