const SUPABASE_URL = "https://bopjwildqosplraxzpqz.supabase.co";
const SUPABASE_KEY = "sb_publishable_DXnkosMz9WhV5D4KDLvPbA_Nkpeg_ZX"; 
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_WA_NUMBER = "6282162726608";

let dataGame = [];
let selectedGame = null;
let selectedItem = null;
let userLogin = null;
let userEmail = null;
let userRole = 'user'; 
let currentKategori = 'Game'; 
let currentUserId = null;

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
        window.location.replace('login.html');
        return;
    }
    const authUser = data.session.user;
    currentUserId = authUser.id;
    userEmail = (authUser.email || '').toLowerCase();
    userLogin = authUser.user_metadata?.full_name || userEmail.split('@')[0];
    
    // Peran admin disimpan pada tabel public.user_roles.
    const { data: roleData, error: roleError } = await sb
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUserId)
        .maybeSingle();
    if (!roleError && roleData && roleData.role === 'admin') {
        userRole = 'admin';
    }

    document.getElementById('profileNameDisplay').innerText = userLogin;
    
    // Sembunyikan menu admin jika bukan admin
    if (userRole !== 'admin') {
        const adminMenu = document.querySelector('a[href="admin.html"]');
        if (adminMenu) adminMenu.style.display = 'none';
    }

    await loadProductsFromDB();
    await loadRiwayatFromDB();
}

async function loadProductsFromDB() {
    const container = document.getElementById('productList');
    if(!container) return;
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center; width:100%;">Menghubungkan ke database...</p>';
    
    try {
        const { data, error } = await sb.from('products').select('*');
        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = '<p style="color:orange; text-align:center;">Database kosong.</p>';
        } else {
            dataGame = data;
        }
        filterKategori('Game', document.getElementById('cat-Game'));
    } catch (err) {
        container.innerHTML = `<div style="color:red;">Sistem Error: ${err.message}</div>`;
    }
}

async function loadRiwayatFromDB() {
    // Gunakan user_id agar riwayat akurat
    const { data, error } = await sb.from('orders').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
    if (error) return console.error(error);
    renderRiwayatUser(data);
}

async function prosesLogout() {
    await sb.auth.signOut();
    localStorage.clear();
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
    renderProductGrid();
}

// Fungsi Render Produk dan Pencarian
function renderProductGrid() {
    const container = document.getElementById('productList');
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    container.innerHTML = "";
    
    const filteredData = dataGame.filter(g => 
        (g.kategori === currentKategori || (!g.kategori && currentKategori === 'Game')) &&
        g.nama.toLowerCase().includes(keyword)
    );

    if(filteredData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; width:100%;">Produk tidak ditemukan.</p>';
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

function cariProduk() {
    renderProductGrid();
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
    } else {
        zoneGroup.style.display = 'none'; 
        zoneInput.removeAttribute('required'); 
        labelUserId.innerText = "Masukkan Nomor HP / ID";
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

    const userIdInput = document.getElementById('userId').value;
    const zoneId = document.getElementById('zoneId').value;
    const payment = document.getElementById('paymentMethod').value;
    let targetId = userIdInput + (selectedGame.id === 'ml' && zoneId ? " (" + zoneId + ")" : "");
    let userOrderKey = userLogin + " (" + userEmail + ")";

    const { error } = await sb.from('orders').insert([{
        user_id: currentUserId, 
        user_name: userOrderKey, 
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
        showToast("Pesanan Dibuat!", "success");
        setTimeout(() => { gantiHalaman('history', document.querySelectorAll('.bottom-nav a')[2]); }, 1500);
    }
}

function renderRiwayatUser(orders) {
    const container = document.getElementById('historyList');
    container.innerHTML = "";
    if (!orders || orders.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px 0; color:var(--text-muted);">Belum ada transaksi.</div>';
        return;
    }
    orders.forEach(o => {
        const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(o.price);
        const statusClass = o.status === 'Sukses' ? 'badge-sukses' : 'badge-pending';
        container.innerHTML += `
            <div class="history-card" style="border-left-color: ${o.status === 'Sukses' ? 'var(--success)' : '#f59e0b'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h4>${o.product_name} - ${o.item_name}</h4>
                    <span class="${statusClass}">${o.status || 'Pending'}</span>
                </div>
                <p>ID Tujuan: ${o.target_id}</p>
                <p>Total: <strong>${hargaFormat}</strong></p>
            </div>
        `;
    });
}

async function lacakPesanan() {
    const input = document.getElementById('trackingInput').value.trim();
    const resContainer = document.getElementById('trackingResult');
    if (!input) return showToast("Masukkan ID atau Nama", "error");
    
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
        const statusClass = o.status === 'Sukses' ? 'badge-sukses' : 'badge-pending';
        resContainer.innerHTML += `
            <div class="history-card" style="border-left-color: ${o.status === 'Sukses' ? 'var(--success)' : '#f59e0b'}">
                <div style="display:flex; justify-content:space-between;">
                    <h4>${o.product_name} - ${o.item_name}</h4>
                    <span class="${statusClass}">${o.status || 'Pending'}</span>
                </div>
                <p>Pembeli: ${o.user_name}</p>
                <p>ID Tujuan: ${o.target_id}</p>
                <p>Total: <strong>${hargaFormat}</strong></p>
            </div>
        `;
    });
}

// FUNGSI UNTUK FORM WA
function bukaFormWa() { document.getElementById("waModal").classList.add("active"); }
function tutupFormWa() { document.getElementById("waModal").classList.remove("active"); }
function kirimFormWa(e) {
    e.preventDefault();
    const nama = document.getElementById("waName").value.trim();
    const hp = document.getElementById("waPhone").value.trim();
    const pesan = document.getElementById("waMessage").value.trim();
    const text = `Halo Admin DIGIVEX STORE!%0A%0A*Nama:* ${nama}%0A*No HP:* ${hp}%0A*Pesan:* ${pesan}`;
    window.open(`https://wa.me/${ADMIN_WA_NUMBER}?text=${text}`, "_blank");
    tutupFormWa();
    document.getElementById("formWa").reset();
}

