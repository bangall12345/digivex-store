const sb = window.createDigivexClient();

// Escape semua data dari database/pengguna sebelum masuk innerHTML (H-1).
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rupiah = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(n) || 0);
const safeIcon = (i, d) => /^fa-[a-z0-9-]+$/.test(i || '') ? i : d;
const safeColor = (c, d) => /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : d;

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
    try { if (toast.showPopover && !toast.matches(':popover-open')) toast.showPopover(); } catch (e) {}
    clearTimeout(window._toastTimer); clearTimeout(window._toastHide);
    window._toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        window._toastHide = setTimeout(() => { try { toast.hidePopover(); } catch (e) {} }, 450);
    }, 3000);
}

window.onload = async function() {
    // Pastikan modal checkout/nominal sudah tersedia sebelum pengguna bisa bertransaksi.
    try { await window.digivexComponentsReady; } catch (e) { showToast('Komponen toko gagal dimuat. Muat ulang halaman.', 'error'); console.error(e); }
    const { data, error } = await sb.auth.getSession();
    const loginButton = document.getElementById('loginAccountBtn');
    const logoutButton = document.getElementById('logoutAccountBtn');
    const guestNote = document.getElementById('guestAccountNote');

    if (!error && data.session) {
        const authUser = data.session.user;
        currentUserId = authUser.id;
        userEmail = (authUser.email || '').toLowerCase();
        userLogin = authUser.user_metadata?.full_name || userEmail.split('@')[0];

        // Peran admin tetap diverifikasi dari tabel user_roles.
        const { data: roleData, error: roleError } = await sb
            .from('user_roles').select('role').eq('user_id', currentUserId).maybeSingle();
        if (!roleError && roleData?.role === 'admin') userRole = 'admin';

        document.getElementById('profileNameDisplay').innerText = userLogin;
        if (loginButton) loginButton.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'inline-flex';
        if (guestNote) guestNote.style.display = 'none';
        if (userRole !== 'admin') {
            document.querySelectorAll('a[href="admin.html"]').forEach(a => a.style.display = 'none'); const adminMenu = null;
            if (adminMenu) adminMenu.style.display = 'none';
        }
        await loadRiwayatFromDB();
    } else {
        document.getElementById('profileNameDisplay').innerText = 'Pengunjung';
        if (loginButton) loginButton.style.display = 'block';
        if (logoutButton) logoutButton.style.display = 'none';
        if (guestNote) guestNote.style.display = 'block';
        document.querySelectorAll('a[href="admin.html"]').forEach(a => a.style.display = 'none'); const adminMenu = null;
        if (adminMenu) adminMenu.style.display = 'none';
    }

    const tb = document.getElementById('testBanner');
    if (tb && window.DIGIVEX_PAYMENT_ENABLED) tb.remove();
    await loadProductsFromDB();

    // Lanjutkan pilihan nominal setelah pengunjung login.
    try {
        const pending = JSON.parse(sessionStorage.getItem('digivex_pending_purchase') || 'null');
        if (pending && currentUserId) {
            sessionStorage.removeItem('digivex_pending_purchase');
            selectedGame = dataGame.find(g => String(g.id) === String(pending.gameId));
            if (selectedGame && Array.isArray(selectedGame.items)) {
                const item = selectedGame.items.find(i => i.nama === pending.itemName);
                if (item) pilihNominal(item.nama, Number(item.harga));
            }
        }
    } catch (e) { console.warn('Pemulihan pilihan produk dilewati:', e); }
};

async function loadProductsFromDB() {
    const container = document.getElementById('popularList') || document.getElementById('productList');
    if(!container) return;
    container.innerHTML = '<p style="grid-column:1/-1; color:var(--text-muted); text-align:center; width:100%;">Menghubungkan ke database...</p>';
    
    try {
        const { data, error } = await sb.from('products').select('*');
        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = '<p style="color:orange; text-align:center;">Database kosong.</p>';
        } else {
            dataGame = data;
        }
        filterKategori('Game', null);
    } catch (err) {
        container.innerHTML = `<div style="color:red;">Sistem Error: ${escapeHtml(err.message)}</div>`;
    }
}

async function loadRiwayatFromDB() {
    if (!currentUserId) {
        const history = document.getElementById('historyList');
        if (history) history.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Masuk untuk melihat riwayat transaksi Anda.</div>';
        return;
    }
    // Gunakan user_id agar riwayat akurat
    const { data, error } = await sb.from('orders').select('id,created_at,user_name,product_name,item_name,price,target_id,payment_method,status').eq('user_id', currentUserId).order('created_at', { ascending: false });
    if (error) return console.error(error);
    renderRiwayatUser(data);
}

async function prosesLogout() {
    await sb.auth.signOut();
    localStorage.clear();
    showToast("Berhasil keluar", "info");
    setTimeout(() => window.location.replace("index.html"), 700);
}

function gantiHalaman(namaHalaman, element) {
    if ((namaHalaman === 'history' || namaHalaman === 'tracking') && !currentUserId) {
        sessionStorage.setItem('digivex_after_login', namaHalaman);
        window.location.href = 'login.html';
        return;
    }
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const target = document.getElementById('page-' + namaHalaman);
    if (!target) { console.warn('Halaman tidak ditemukan:', namaHalaman); return; }
    target.classList.add('active');
    document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));
    if(element) element.classList.add('active');
    document.body.classList.toggle('settings-view', namaHalaman === 'settings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(namaHalaman === 'history') loadRiwayatFromDB();
}

function filterKategori(kategori, element) {
    currentKategori = kategori;
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active-cat'));

    const _st = document.getElementById('sectionTitle'); if (_st) _st.innerText = 'Katalog Game';
    renderProductGrid();
}

// Fungsi Render Produk dan Pencarian
const katalogTambahan = {
    Pulsa: [
        { nama: 'Telkomsel', icon: 'fa-signal', color: '#f04455' },
        { nama: 'by.U', icon: 'fa-sim-card', color: '#6c63ff' },
        { nama: 'IM3', icon: 'fa-signal', color: '#f5b52e' },
        { nama: 'Tri (3)', icon: 'fa-signal', color: '#e83e8c' },
        { nama: 'XL', icon: 'fa-signal', color: '#36a3ff' },
        { nama: 'AXIS', icon: 'fa-sim-card', color: '#a66bff' },
        { nama: 'Smartfren', icon: 'fa-signal', color: '#e84b4b' }
    ],
    Game: [
        { nama: 'Mobile Legends', icon: 'fa-shield-halved', color: '#5c9dff', image: 'assets/mobile-legends-hero.jpg' },
        { nama: 'Free Fire', icon: 'fa-fire', color: '#ff9b32', image: 'https://freefiremobile-a.akamaihd.net/common/web_event/official2.ff.garena.all/img/20228/09d54b4426b623dde923aa83beeccbe5.jpg' },
        { nama: 'Steam Wallet', icon: 'fa-steam', color: '#78a9df' },
        { nama: 'Roblox Gift Cards', icon: 'fa-cube', color: '#f4f4f4' },
        { nama: 'Magic Chess: Go Go', icon: 'fa-chess-knight', color: '#b99cff' },
        { nama: 'eFootball', icon: 'fa-futbol', color: '#42b6ff' }
    ]
};

function renderProductGrid() {
    const container = document.getElementById('productList');
    const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase();
    if (!container) return;
    container.innerHTML = '';
    container.onclick = e => {
        const card = e.target.closest('.product-card'); if (!card) return;
        if (card.dataset.id) bukaNominal(card.dataset.id);
        else if (card.dataset.soon) infoProdukBelumAktif(card.dataset.soon);
    };

    const filteredData = dataGame.filter(g =>
        (String(g.kategori || 'Game').toLowerCase() === 'game') &&
        String(g.nama || '').toLowerCase().includes(keyword)
    );

    const suggestions = (katalogTambahan[currentKategori] || []).filter(item =>
        !dataGame.some(g => { const n = String(g.nama || '').toLowerCase(); const target = item.nama.toLowerCase(); return n === target || n.includes(target) || target.includes(n); }) &&
        item.nama.toLowerCase().includes(keyword)
    );

    if (filteredData.length === 0 && suggestions.length === 0) {
        container.innerHTML = '<p class="empty-catalog">Produk tidak ditemukan.</p>';
        return;
    }

    const artworkFor = (name, category) => {
        if (category !== 'Game') return '';
        const normalized = String(name || '').toLowerCase();
        if (normalized.includes('mobile legends')) return 'assets/mobile-legends-hero.jpg';
        if (normalized.includes('free fire')) return 'https://freefiremobile-a.akamaihd.net/common/web_event/official2.ff.garena.all/img/20228/09d54b4426b623dde923aa83beeccbe5.jpg';
        return '';
    };

    filteredData.forEach(g => {
        const id = escapeHtml(g.id);
        const name = escapeHtml(g.nama || 'Produk');
        const artwork = artworkFor(g.nama, g.kategori || currentKategori);
        container.innerHTML += `
            <div class="product-card ${(g.image_url || artwork) ? 'has-artwork' : ''}" data-id="${id}" style="--product-color:${safeColor(g.color, '#9b7bff')};">
                ${g.image_url ? `<img class="product-artwork admin-product-image" src="${escapeHtml(g.image_url)}" alt="Foto ${name}" loading="lazy" onerror="var p=this.parentElement;this.remove();if(p)p.classList.remove('has-artwork');">` : artwork ? `<img class="product-artwork" src="${artwork}" alt="Artwork ${name}" loading="lazy" onerror="var p=this.parentElement;this.remove();if(p)p.classList.remove('has-artwork');">` : `<i class="fa-solid ${safeIcon(g.icon, 'fa-gamepad')} product-icon"></i>`}
                <div class="product-info"><h4>${name}</h4></div>
            </div>`;
    });

    suggestions.forEach(item => {
        const artwork = item.image || artworkFor(item.nama, currentKategori);
        const name = escapeHtml(item.nama);
        container.innerHTML += `
            <div class="product-card catalog-suggestion ${artwork ? 'has-artwork' : ''}" data-soon="${name}" style="--product-color:${item.color};">
                ${artwork ? `<img class="product-artwork" src="${artwork}" alt="Artwork ${name}" loading="lazy" onerror="var p=this.parentElement;this.remove();if(p)p.classList.remove('has-artwork');">` : `<i class="fa-solid ${item.icon} product-icon"></i>`}
                <div class="product-info"><h4>${name}</h4><small>Segera tersedia</small></div>
            </div>`;
    });
}

function infoProdukBelumAktif(nama) {
    showToast(nama + ' belum tersedia saat ini. Silakan hubungi Customer Service.', 'info');
}

function cariProduk() {
    renderProductGrid();
}

function bukaNominal(gameId) {
    selectedGame = dataGame.find(g => String(g.id) === String(gameId));
    if (!selectedGame) return;
    const title = selectedGame.nama || 'Game';
    const titleNode = document.getElementById('gamePageTitle');
    const publisherNode = document.getElementById('gamePagePublisher');
    const hero = document.getElementById('gameHeroImage');
    const isML = title.toLowerCase().includes('mobile legends');
    titleNode.textContent = title;
    publisherNode.textContent = isML ? 'Moonton' : (selectedGame.publisher || 'Produk digital');
    document.getElementById('gameDescriptionTitle').textContent = 'Tentang ' + title;
    hero.src = selectedGame.image_url || (isML ? 'assets/mobile-legends-hero.jpg' : 'assets/digivex-logo-mark.png');
    hero.alt = title;
    document.getElementById('gameServerLabel').style.display = isML ? '' : 'none';
    document.getElementById('gameTargetId').value = '';
    document.getElementById('gameServerId').value = '';
    const grid = document.getElementById('gameNominalGrid');
    const items = Array.isArray(selectedGame.items) ? selectedGame.items : [];
    grid.innerHTML = '';
    selectedItem = null;
    document.getElementById('gameSelectionSummary').textContent = 'Belum ada item produk yang dipilih.';
    document.getElementById('gameOrderButton').disabled = true;
    if (!items.length) grid.innerHTML = '<p class="game-empty">Nominal produk belum tersedia. Silakan hubungi Customer Service.</p>';
    items.forEach((item, i) => {
        const card = document.createElement('button');
        card.type = 'button'; card.className = 'game-nominal-card'; card.dataset.index = String(i);
        const name = document.createElement('strong'); name.textContent = item.nama || 'Produk';
        const price = document.createElement('span'); price.textContent = rupiah(item.harga);
        card.append(name, price);
        card.addEventListener('click', () => {
            grid.querySelectorAll('.game-nominal-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
            selectedItem = { nama: String(item.nama), harga: Number(item.harga) };
            document.getElementById('gameSelectionSummary').textContent = selectedItem.nama + ' • ' + rupiah(selectedItem.harga);
            document.getElementById('gameOrderButton').disabled = false;
        });
        grid.appendChild(card);
    });
    switchGameTab('transaction');
    gantiHalaman('game', null);
}

function switchGameTab(tab) {
    const transaction = tab === 'transaction';
    document.getElementById('gameTransactionPanel').hidden = !transaction;
    document.getElementById('gameDescriptionPanel').hidden = transaction;
    document.querySelectorAll('.game-tabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
}

function submitGameSelection() {
    if (!selectedGame || !selectedItem) return;
    const target = document.getElementById('gameTargetId').value.trim();
    const server = document.getElementById('gameServerId').value.trim();
    if (!target) { showToast('Masukkan ID tujuan terlebih dahulu.', 'error'); document.getElementById('gameTargetId').focus(); return; }
    if (!currentUserId) {
        sessionStorage.setItem('digivex_pending_purchase', JSON.stringify({ gameId: selectedGame.id, itemName: selectedItem.nama }));
        window.location.href = 'login.html'; return;
    }
    pilihNominal(selectedItem.nama, selectedItem.harga);
    setTimeout(() => {
        const uid = document.getElementById('userId');
        const zone = document.getElementById('zoneId');
        if (uid) uid.value = target;
        if (zone && (String(selectedGame.nama || '').toLowerCase().includes('mobile legends') || selectedGame.id === 'ml')) zone.value = server;
    }, 0);
}

// Modal memakai <dialog> bawaan browser: Escape, fokus, dan latar tidak bisa diklik sudah otomatis.
function bukaModal(id) { const d = document.getElementById(id); if (d && !d.open) d.showModal(); }
function tutupModal(id) { const d = document.getElementById(id); if (d && d.open) d.close(); }
document.addEventListener('close', e => {
    if (e.target && e.target.id === 'checkoutModal') { const f = document.getElementById('formOrder'); if (f) f.reset(); }
}, true);
function tutupNominal() { tutupModal('nominalModal'); }

function pilihNominal(namaItem, harga) {
    selectedItem = { nama: namaItem, harga: harga };
    if (!currentUserId) {
        sessionStorage.setItem('digivex_pending_purchase', JSON.stringify({ gameId: selectedGame.id, itemName: namaItem }));
        window.location.href = 'login.html';
        return;
    }
    const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga);
    document.getElementById('modalProduct').innerText = selectedGame.nama;
    document.getElementById('modalItem').innerText = namaItem;
    document.getElementById('modalPrice').innerText = hargaFormat;
    
    const zoneGroup = document.getElementById('zoneIdGroup');
    const zoneInput = document.getElementById('zoneId');
    const labelUserId = document.getElementById('labelUserId');
    const inputUserId = document.getElementById('userId');

    if (String(selectedGame.nama || '').toLowerCase().includes('mobile legends') || selectedGame.id === 'ml') {
        zoneGroup.style.display = 'block'; 
        zoneInput.setAttribute('required', 'true');
        labelUserId.innerText = "Masukkan User ID";
        inputUserId.placeholder = "Contoh: 12345678";
    } else {
        zoneGroup.style.display = 'none'; 
        zoneInput.removeAttribute('required'); 
        labelUserId.innerText = "Masukkan Nomor HP / ID";
    }

    const note = document.getElementById('paymentNote');
    if (note) note.innerText = window.DIGIVEX_PAYMENT_ENABLED ? 'Anda akan diarahkan ke halaman pembayaran.' : 'Mode uji coba: pembayaran dikonfirmasi manual oleh admin.';
    tutupNominal();
    bukaModal('checkoutModal');
}

function tutupCheckout() {
    tutupModal('checkoutModal');
    const formOrder = document.getElementById('formOrder'); if (formOrder) formOrder.reset();
}

async function prosesPesanan(event) {
    event.preventDefault();
    if (!currentUserId) { window.location.href = 'login.html'; return; }
    const btn = event.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'Memproses...'; btn.disabled = true;

    const userIdInput = document.getElementById('userId').value;
    const zoneId = document.getElementById('zoneId').value;
    const payment = document.getElementById('paymentMethod').value;
    let targetId = userIdInput + ((String(selectedGame.nama || '').toLowerCase().includes('mobile legends') || selectedGame.id === 'ml') && zoneId ? " (" + zoneId + ")" : "");

    // Harga, nama pembeli, dan status ditentukan server (fungsi create_order).
    const { data: order, error } = await sb.rpc('create_order', {
        p_product_id: selectedGame.id,
        p_item_name: selectedItem.nama,
        p_target_id: targetId,
        p_payment_method: payment
    });

    btn.innerHTML = 'Buat Pesanan'; btn.disabled = false;

    if (error) {
        showToast("Gagal: " + error.message, "error");
    } else {
        if (window.DIGIVEX_PAYMENT_ENABLED && order?.id) {
            const { data: pay, error: payErr } = await sb.functions.invoke('create-payment', { body: { order_id: order.id } });
            if (!payErr && pay?.redirect_url) { window.location.href = pay.redirect_url; return; }
            showToast("Pesanan dibuat, tetapi pembayaran gagal dibuka. Coba lagi dari Riwayat.", "error");
        }
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
                    <h4>${escapeHtml(o.product_name)} - ${escapeHtml(o.item_name)}</h4>
                    <span class="${statusClass}">${escapeHtml(o.status || 'Pending')}</span>
                </div>
                <p>ID Tujuan: ${escapeHtml(o.target_id)}</p>
                <p>Total: <strong>${hargaFormat}</strong></p>
            </div>
        `;
    });
}

async function lacakPesanan() {
    if (!currentUserId) { window.location.href = 'login.html'; return; }
    const input = document.getElementById('trackingInput').value.trim();
    const resContainer = document.getElementById('trackingResult');
    if (!input) return showToast("Masukkan ID atau Nama", "error");
    
    // Buang karakter khusus filter PostgREST (koma, kurung, %, *) dan batasi ke pesanan milik sendiri.
    const clean = input.replace(/[^A-Za-z0-9@._ -]/g, '').slice(0, 60).trim();
    if (!clean) return showToast("Karakter tidak valid", "error");
    const { data, error } = await sb.from('orders')
        .select('id,created_at,user_name,product_name,item_name,price,target_id,payment_method,status')
        .eq('user_id', currentUserId)
        .or(`target_id.ilike.%${clean}%,user_name.ilike.%${clean}%`)
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
                    <h4>${escapeHtml(o.product_name)} - ${escapeHtml(o.item_name)}</h4>
                    <span class="${statusClass}">${escapeHtml(o.status || 'Pending')}</span>
                </div>
                <p>Pembeli: ${escapeHtml(o.user_name)}</p>
                <p>ID Tujuan: ${escapeHtml(o.target_id)}</p>
                <p>Total: <strong>${hargaFormat}</strong></p>
            </div>
        `;
    });
}

// FUNGSI UNTUK FORM WA
function bukaFormWa() { bukaModal('waModal'); }
function tutupFormWa() { tutupModal('waModal'); }
function kirimFormWa(e) {
    e.preventDefault();
    const nama = document.getElementById("waName").value.trim();
    const hp = document.getElementById("waPhone").value.trim();
    const pesan = document.getElementById("waMessage").value.trim();
    const text = encodeURIComponent(`Halo Admin DIGIVEX STORE!\n\n*Nama:* ${nama}\n*No HP:* ${hp}\n*Pesan:* ${pesan}`);
    window.open(`https://wa.me/${ADMIN_WA_NUMBER}?text=${text}`, "_blank");
    tutupFormWa();
    document.getElementById("formWa").reset();
}



// ===== POPULER SEKARANG (gaya kartu 2 kolom) =====
const popularPalette = [
    { bg: 'linear-gradient(135deg,#c9c9d6,#b3b5c6)', fg: '#1c1b26', sub: '#4b4a5c' },
    { bg: 'linear-gradient(135deg,#3a2a52,#241a38)', fg: '#fff', sub: '#c9bde0' },
    { bg: 'linear-gradient(135deg,#5b91c2,#4a7fb3)', fg: '#fff', sub: '#e3eefa' },
    { bg: 'linear-gradient(135deg,#3b2f6b,#272048)', fg: '#fff', sub: '#cfc6ee' },
    { bg: 'linear-gradient(135deg,#4a2236,#2e1522)', fg: '#fff', sub: '#e6c3d2' },
    { bg: 'linear-gradient(135deg,#cfc6dc,#b9afca)', fg: '#1c1b26', sub: '#514a63' },
    { bg: 'linear-gradient(135deg,#e2dccd,#cfc7b3)', fg: '#1f1d18', sub: '#5a5546' },
    { bg: 'linear-gradient(135deg,#2b3347,#1b2030)', fg: '#fff', sub: '#c3cadb' }
];

function renderPopularList() {
    const box = document.getElementById('popularList');
    if (!box) return;
    const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const art = name => {
        const n = String(name || '').toLowerCase();
        if (n.includes('mobile legends')) return 'assets/mobile-legends-hero.jpg';
        if (n.includes('pubg')) return 'assets/pubg-mobile.jpg';
        if (n.includes('free fire')) return 'https://freefiremobile-a.akamaihd.net/common/web_event/official2.ff.garena.all/img/20228/09d54b4426b623dde923aa83beeccbe5.jpg';
        return '';
    };
    const active = dataGame.filter(g => String(g.kategori || 'Game').toLowerCase() === 'game' && String(g.nama || '').toLowerCase().includes(keyword))
        .map(g => ({ id: g.id, nama: g.nama || 'Produk', pub: g.publisher || (String(g.nama||'').toLowerCase().includes('mobile legends') ? 'Moonton' : 'DIGIVEX'), img: g.image_url || art(g.nama), color: g.color }));
    const soon = (katalogTambahan.Game || []).filter(it => it.nama.toLowerCase().includes(keyword) &&
        !dataGame.some(g => { const n = String(g.nama||'').toLowerCase(), t = it.nama.toLowerCase(); return n === t || n.includes(t) || t.includes(n); }))
        .map(it => ({ soon: it.nama, nama: it.nama, pub: 'Segera tersedia', img: it.image || art(it.nama), color: it.color, icon: it.icon }));
    const items = active.concat(soon);
    const section = box.closest('.popular-section'); if (section) section.hidden = !items.length;
    box.innerHTML = items.map((it, i) => {
        const p = popularPalette[i % popularPalette.length];
        const name = escapeHtml(it.nama);
        const thumb = it.img
            ? `<img src="${escapeHtml(it.img)}" alt="${name}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'pop-fallback',textContent:'${name.charAt(0)}'}))">`
            : `<span class="pop-fallback">${name.charAt(0)}</span>`;
        const attr = it.id !== undefined ? `data-id="${escapeHtml(it.id)}"` : `data-soon="${name}"`;
        return `<div class="pop-card" ${attr} style="--pop-bg:${p.bg};--pop-fg:${p.fg};--pop-sub:${p.sub}">${thumb}<div class="pop-text"><b>${name}</b><span>${escapeHtml(it.pub)}</span></div></div>`;
    }).join('');
    box.onclick = e => {
        const c = e.target.closest('.pop-card'); if (!c) return;
        if (c.dataset.id) bukaNominal(c.dataset.id); else if (c.dataset.soon) infoProdukBelumAktif(c.dataset.soon);
    };
}
(function () {
    const base = renderProductGrid;
    renderProductGrid = function () { base(); renderPopularList(); };
})();


// ===== CAROUSEL BANNER (geser kiri/kanan + otomatis) =====
(function () {
    const track = document.getElementById('bannerTrack');
    const dotsBox = document.getElementById('bannerDots');
    if (!track || !dotsBox) return;
    const slides = Array.from(track.children);
    let index = 0, timer = null, touched = false;
    dotsBox.innerHTML = slides.map((_, i) => '<i' + (i === 0 ? ' class="on"' : '') + '></i>').join('');
    const dots = Array.from(dotsBox.children);
    const goTo = i => { track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: 'smooth' }); };
    track.addEventListener('scroll', () => {
        const w = track.clientWidth || 1;
        const i = Math.round(track.scrollLeft / w);
        if (i !== index && dots[i]) { dots[index].classList.remove('on'); dots[i].classList.add('on'); index = i; }
    }, { passive: true });
    const start = () => { stop(); if (slides.length > 1) timer = setInterval(() => { if (!touched) goTo((index + 1) % slides.length); touched = false; }, 4500); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    ['touchstart', 'pointerdown', 'wheel'].forEach(ev => track.addEventListener(ev, () => { touched = true; }, { passive: true }));
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    // Klik banner membuka game terkait; geseran tidak dianggap klik.
    let downX = 0;
    track.addEventListener('pointerdown', e => { downX = e.clientX; });
    track.addEventListener('click', e => {
        const a = e.target.closest('.banner-slide'); if (!a) return;
        e.preventDefault();
        if (Math.abs(e.clientX - downX) > 8) return;
        const key = a.dataset.game || '';
        const g = (typeof dataGame !== 'undefined' ? dataGame : []).find(x => String(x.nama || '').toLowerCase().includes(key));
        if (g) bukaNominal(g.id); else if (typeof infoProdukBelumAktif === 'function') infoProdukBelumAktif(a.getAttribute('aria-label'));
    });
    start();
})();

// ===== CHAT ADMIN (sisi pelanggan) =====
(function () {
    const $ = id => document.getElementById(id);
    let uid = null, started = false, isOpen = false, channel = null, timer = null, sending = false, unread = 0, lastTs = '';
    const seen = new Set();
    const IMG_BASE = (window.DIGIVEX_SUPABASE_URL || '') + '/storage/v1/object/public/chat-images/';
    const okImg = u => typeof u === 'string' && u.startsWith(IMG_BASE);
    let hasImg = true, pendingFile = null, pendingObj = null;
    const cols = () => 'id,sender,body,created_at' + (hasImg ? ',image_url' : '');
    function clearPending() {
        if (pendingObj) URL.revokeObjectURL(pendingObj);
        pendingFile = null; pendingObj = null;
        const p = $('chatPrev'); if (p) p.hidden = true;
        const f = $('chatFile'); if (f) f.value = '';
    }
    function pickFile(f) {
        if (!f) return;
        if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { showToast('Format foto harus JPG, PNG, WEBP, atau GIF.', 'error'); $('chatFile').value = ''; return; }
        if (f.size > 5 * 1024 * 1024) { showToast('Ukuran foto maksimal 5 MB.', 'error'); $('chatFile').value = ''; return; }
        if (pendingObj) URL.revokeObjectURL(pendingObj);
        pendingFile = f; pendingObj = URL.createObjectURL(f);
        $('chatPrevImg').src = pendingObj; $('chatPrevName').textContent = f.name; $('chatPrev').hidden = false;
    }
    const seenKey = () => 'digivex_chat_seen_' + uid;
    const hhmm = ts => { try { return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

    function setBadge(n) {
        unread = Math.max(0, n);
        const b = $('chatBadge'); if (!b) return;
        b.hidden = unread <= 0; b.textContent = unread > 9 ? '9+' : String(unread);
    }
    function markRead(ts) {
        if (ts && ts > lastTs) lastTs = ts;
        try { if (uid && lastTs) localStorage.setItem(seenKey(), lastTs); } catch (e) {}
        setBadge(0);
    }
    function showNote(text) {
        const box = $('chatBody'); if (!box) return;
        box.innerHTML = ''; const d = document.createElement('div'); d.className = 'chat-empty'; d.textContent = text; box.appendChild(d);
    }
    function addMsg(m) {
        if (!m || !m.id || seen.has(m.id)) return;
        seen.add(m.id);
        const box = $('chatBody'); if (!box) return;
        const ph = box.querySelector('.chat-empty'); if (ph) ph.remove();
        const row = document.createElement('div');
        row.className = 'chat-msg ' + (m.sender === 'admin' ? 'from-admin' : 'from-me');
        const t = document.createElement('div'); t.className = 'chat-text';
        if (okImg(m.image_url)) {
            t.classList.add('has-img');
            const l = document.createElement('a'); l.href = m.image_url; l.target = '_blank'; l.rel = 'noopener noreferrer';
            const im = document.createElement('img'); im.className = 'chat-img'; im.loading = 'lazy'; im.alt = 'Foto'; im.src = m.image_url;
            l.appendChild(im); t.appendChild(l);
            if (m.body && m.body !== '\u{1F4F7} Foto') { const c = document.createElement('span'); c.className = 'chat-cap'; c.textContent = m.body; t.appendChild(c); }
        } else { t.textContent = m.body; }
        const s = document.createElement('small'); s.textContent = hhmm(m.created_at);
        row.append(t, s); box.appendChild(row);
        box.scrollTop = box.scrollHeight;
    }
    async function loadAll() {
        if (!uid) return;
        let { data, error } = await sb.from('chat_messages').select(cols())
            .eq('user_id', uid).order('created_at', { ascending: true }).limit(300);
        if (error && hasImg) {
            hasImg = false;
            ({ data, error } = await sb.from('chat_messages').select(cols())
                .eq('user_id', uid).order('created_at', { ascending: true }).limit(300));
        }
        if (error) { if (!seen.size) showNote('Chat belum tersedia saat ini. Silakan coba lagi nanti.'); return; }
        (data || []).forEach(addMsg);
        const box = $('chatBody');
        if (box && !box.querySelector('.chat-msg') && !box.querySelector('.chat-empty')) showNote('Halo! Tulis pesanmu di bawah, admin akan membalas secepatnya.');
        if (isOpen && data && data.length) markRead(data[data.length - 1].created_at);
    }
    async function checkUnread() {
        if (!uid || isOpen) return;
        let since = ''; try { since = localStorage.getItem(seenKey()) || ''; } catch (e) {}
        const { count, error } = await sb.from('chat_messages').select('id', { count: 'exact', head: true })
            .eq('user_id', uid).eq('sender', 'admin').gt('created_at', since || '1970-01-01T00:00:00Z');
        if (!error) setBadge(count || 0);
    }
    function onIncoming(m) {
        if (!m) return;
        if (isOpen) { addMsg(m); if (m.sender === 'admin') markRead(m.created_at); }
        else if (m.sender === 'admin' && !seen.has(m.id)) { seen.add(m.id); setBadge(unread + 1); }
    }
    function start() {
        if (started || !uid) return;
        started = true;
        try {
            if (typeof sb.channel === 'function') {
                channel = sb.channel('chat-' + uid)
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'user_id=eq.' + uid }, p => onIncoming(p.new))
                    .subscribe();
            }
        } catch (e) { channel = null; }
        checkUnread();
        // Cadangan bila realtime belum aktif: cek berkala.
        timer = setInterval(() => { if (document.hidden) return; isOpen ? loadAll() : checkUnread(); }, 8000);
    }

    window.bukaChat = async function () {
        const sheet = $('chatSheet'); if (!sheet) return;
        sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
        document.body.classList.add('chat-open'); isOpen = true;
        const logged = typeof currentUserId !== 'undefined' && !!currentUserId;
        $('chatGuest').hidden = logged; $('chatForm').hidden = !logged; $('chatBody').hidden = !logged;
        if (!logged) return;
        uid = currentUserId; start();
        await loadAll();
        setTimeout(() => { const i = $('chatInput'); if (i) i.focus(); }, 280);
    };
    window.tutupChat = function () {
        const sheet = $('chatSheet'); if (!sheet) return;
        sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('chat-open'); isOpen = false;
        if (uid) markRead(lastTs);
    };
    window.kirimChat = function (e) {
        if (e) e.preventDefault();
        const input = $('chatInput'); const text = (input.value || '').trim();
        if ((!text && !pendingFile) || sending || !uid) return false;
        sending = true; $('chatSend').disabled = true; $('chatAttach').disabled = true;
        (async () => {
            let image_url = null;
            if (pendingFile) {
                if (!hasImg) throw new Error('foto-nonaktif');
                const f = pendingFile, ext = (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
                const path = uid + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
                const up = await sb.storage.from('chat-images').upload(path, f, { contentType: f.type, cacheControl: '31536000', upsert: false });
                if (up.error) throw up.error;
                image_url = sb.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
            }
            const row = { user_id: uid, sender: 'user', body: text || '\u{1F4F7} Foto' };
            if (image_url) row.image_url = image_url;
            const { data, error } = await sb.from('chat_messages').insert(row).select(cols()).single();
            if (error) throw error;
            input.value = ''; clearPending(); addMsg(data); if (data.created_at > lastTs) lastTs = data.created_at;
        })()
            .catch(err => showToast(/banyak pesan/i.test((err && err.message) || '') ? 'Terlalu banyak pesan. Coba lagi sebentar.' : (err && err.message === 'foto-nonaktif' ? 'Fitur kirim foto belum aktif.' : 'Pesan gagal terkirim. Coba lagi.'), 'error'))
            .finally(() => { sending = false; $('chatSend').disabled = false; $('chatAttach').disabled = false; input.focus(); });
        return false;
    };
    (function () {
        const at = $('chatAttach'), fi = $('chatFile'), x = $('chatPrevX');
        if (at && fi) { at.addEventListener('click', () => fi.click()); fi.addEventListener('change', ev => pickFile(ev.target.files && ev.target.files[0])); }
        if (x) x.addEventListener('click', clearPending);
    })();
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) window.tutupChat(); });

    // Mulai memantau pesan baru begitu status login diketahui.
    let tries = 0;
    const waiter = setInterval(() => {
        if (typeof currentUserId !== 'undefined' && currentUserId) { clearInterval(waiter); uid = currentUserId; start(); }
        else if (++tries > 40) clearInterval(waiter);
    }, 1000);
})();
