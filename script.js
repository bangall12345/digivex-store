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
let activeGameCategory = 'Semua';

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
                if (item) { pilihNominal(item.nama, Number(item.harga)); if (pending.targetId) document.getElementById('userId').value = pending.targetId; if (pending.zoneId) document.getElementById('zoneId').value = pending.zoneId; }
            }
        }
    } catch (e) { console.warn('Pemulihan pilihan produk dilewati:', e); }
};

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
    document.getElementById('page-' + namaHalaman).classList.add('active');
    document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));
    if(element) element.classList.add('active');
    document.body.classList.toggle('settings-view', namaHalaman === 'settings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(namaHalaman === 'history') loadRiwayatFromDB();
}

function filterKategori(kategori, element) {
    currentKategori = kategori;
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active-cat'));

    document.getElementById('sectionTitle').innerText = 'Katalog Game';
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
        if (card.dataset.id) bukaHalamanProduk(card.dataset.id);
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
                ${g.image_url ? `<img class="product-artwork admin-product-image" src="${escapeHtml(g.image_url)}" alt="Foto ${name}" loading="lazy" onerror="this.remove();this.parentElement.classList.remove('has-artwork');">` : artwork ? `<img class="product-artwork" src="${artwork}" alt="Artwork ${name}" loading="lazy" onerror="this.remove();this.parentElement.classList.remove('has-artwork');">` : `<i class="fa-solid ${safeIcon(g.icon, 'fa-gamepad')} product-icon"></i>`}
                <div class="product-info"><h4>${name}</h4></div>
            </div>`;
    });

    suggestions.forEach(item => {
        const artwork = item.image || artworkFor(item.nama, currentKategori);
        const name = escapeHtml(item.nama);
        container.innerHTML += `
            <div class="product-card catalog-suggestion ${artwork ? 'has-artwork' : ''}" data-soon="${name}" style="--product-color:${item.color};">
                ${artwork ? `<img class="product-artwork" src="${artwork}" alt="Artwork ${name}" loading="lazy" onerror="this.remove();this.parentElement.classList.remove('has-artwork');">` : `<i class="fa-solid ${item.icon} product-icon"></i>`}
                <div class="product-info"><h4>${name}</h4><small>Segera tersedia</small></div>
            </div>`;
    });
}

function infoProdukBelumAktif(nama) {
    showToast('Nominal ' + nama + ' belum diatur. Admin dapat menambahkannya melalui dashboard Produk.', 'info');
}

function cariProduk() {
    renderProductGrid();
}

function bukaHalamanProduk(gameId) {
    selectedGame = dataGame.find(g => String(g.id) === String(gameId));
    if (!selectedGame) return;
    activeGameCategory = 'Semua';
    selectedItem = null;
    const name = selectedGame.nama || 'Game';
    const normalized = name.toLowerCase();
    const image = selectedGame.image_url || (normalized.includes('mobile legends') ? 'assets/mobile-legends-hero.jpg' : '');
    const hero = document.getElementById('detailGameImage');
    hero.style.display = image ? 'block' : 'none';
    if (image) hero.src = image;
    document.getElementById('detailGameName').innerText = name;
    document.getElementById('detailGamePublisher').innerText = normalized.includes('mobile legends') ? 'Moonton' : (selectedGame.publisher || 'DIGIVEX STORE');
    document.getElementById('gameDescriptionTitle').innerText = 'Tentang ' + name;
    document.getElementById('gameDescriptionText').innerText = selectedGame.deskripsi || ('Pilih produk ' + name + ' yang tersedia, masukkan data akun dengan benar, lalu tekan Pesan Sekarang untuk melanjutkan.');
    document.getElementById('detailZoneLabel').style.display = normalized.includes('mobile legends') ? '' : 'none';
    document.getElementById('detailZoneId').style.display = normalized.includes('mobile legends') ? '' : 'none';
    document.getElementById('detailUserIdLabel').innerText = normalized.includes('mobile legends') ? 'User ID' : 'ID / Nomor Tujuan';
    document.getElementById('detailUserId').placeholder = normalized.includes('mobile legends') ? 'Masukkan User ID' : 'Masukkan ID / Nomor Tujuan';
    document.getElementById('detailUserId').value = '';
    document.getElementById('detailZoneId').value = '';
    document.getElementById('gameSelectedItem').innerText = 'Belum ada item produk yang dipilih.';
    document.getElementById('gameSelectedPrice').innerText = '';
    renderItemGame();
    document.querySelectorAll('.game-tabs button').forEach((b,i)=>b.classList.toggle('active',i===0));
    document.getElementById('gameTransactionPanel').hidden = false;
    document.getElementById('gameDescriptionPanel').hidden = true;
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('page-product').classList.add('active');
    document.body.classList.add('product-view');
    window.scrollTo({top:0,behavior:'smooth'});
}

function tutupHalamanProduk() {
    document.getElementById('page-product').classList.remove('active');
    document.getElementById('page-home').classList.add('active');
    document.body.classList.remove('product-view');
    window.scrollTo({top:0,behavior:'smooth'});
}

function gantiTabGame(tab, button) {
    document.querySelectorAll('.game-tabs button').forEach(b=>b.classList.remove('active'));
    button.classList.add('active');
    document.getElementById('gameTransactionPanel').hidden = tab !== 'transaksi';
    document.getElementById('gameDescriptionPanel').hidden = tab !== 'keterangan';
}

function kategoriItemGame(nama) {
    const n = String(nama || '').toLowerCase();
    if (n.includes('promo')) return 'Promo';
    if (n.includes('weekly') || n.includes('twilight') || n.includes('starlight') || n.includes('pass')) return 'Special Items';
    if (n.includes('first top') || n.includes('firsttop')) return 'First Top Up';
    return 'Top Up';
}

function renderItemGame() {
    if (!selectedGame) return;
    const items = Array.isArray(selectedGame.items) ? selectedGame.items : [];
    const categories = ['Semua', ...new Set(items.map(i=>kategoriItemGame(i.nama)))];
    const categoryBox = document.getElementById('gameItemCategories');
    categoryBox.innerHTML = categories.map(c=>`<button type="button" class="${c===activeGameCategory?'active':''}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
    categoryBox.onclick = e => { const b=e.target.closest('button[data-category]'); if(!b)return; activeGameCategory=b.dataset.category; renderItemGame(); };
    const filtered = items.map((item,index)=>({...item,_index:index})).filter(item=>activeGameCategory==='Semua'||kategoriItemGame(item.nama)===activeGameCategory);
    const grid = document.getElementById('gameItemGrid');
    if (!filtered.length) { grid.innerHTML='<p class="game-empty">Belum ada nominal yang tersedia.</p>'; return; }
    grid.innerHTML = filtered.map(item=>`<button type="button" class="game-item-card ${selectedItem?.nama===item.nama?'selected':''}" data-index="${item._index}"><strong>${escapeHtml(item.nama)}</strong><span>${escapeHtml(rupiah(item.harga))}</span><small><i class="fa-solid fa-bolt"></i> Pengiriman instan</small></button>`).join('');
    grid.onclick = e => { const b=e.target.closest('button[data-index]'); if(!b)return; const item=items[Number(b.dataset.index)]; selectedItem={nama:item.nama,harga:Number(item.harga)}; document.getElementById('gameSelectedItem').innerText=item.nama; document.getElementById('gameSelectedPrice').innerText=rupiah(item.harga); renderItemGame(); };
}

function buatPesananDariHalamanProduk() {
    if (!selectedGame || !selectedItem) { showToast('Pilih nominal produk terlebih dahulu.','info'); return; }
    const userId = document.getElementById('detailUserId').value.trim();
    const zoneId = document.getElementById('detailZoneId').value.trim();
    const isML = String(selectedGame.nama||'').toLowerCase().includes('mobile legends');
    if (!userId || (isML && !zoneId)) { showToast(isML ? 'Masukkan User ID dan Server terlebih dahulu.' : 'Masukkan ID tujuan terlebih dahulu.','error'); return; }
    if (!currentUserId) {
        sessionStorage.setItem('digivex_pending_purchase', JSON.stringify({gameId:selectedGame.id,itemName:selectedItem.nama,targetId:userId,zoneId}));
        window.location.href='login.html'; return;
    }
    pilihNominal(selectedItem.nama, Number(selectedItem.harga));
    document.getElementById('userId').value=userId;
    if (isML) document.getElementById('zoneId').value=zoneId;
}

function bukaNominal(gameId) { bukaHalamanProduk(gameId); }

function tutupNominal() { document.getElementById('nominalModal').classList.remove('active'); }

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

    const note = document.getElementById('paymentNote');
    if (note) note.innerText = window.DIGIVEX_PAYMENT_ENABLED ? 'Anda akan diarahkan ke halaman pembayaran.' : 'Mode uji coba: pembayaran dikonfirmasi manual oleh admin.';
    tutupNominal();
    document.getElementById('checkoutModal').classList.add('active');
}

function tutupCheckout() {
    document.getElementById('checkoutModal').classList.remove('active');
    document.getElementById('formOrder').reset();
}

async function prosesPesanan(event) {
    event.preventDefault();
    if (!currentUserId) { window.location.href = 'login.html'; return; }
    const btn = event.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'Memproses...'; btn.disabled = true;

    const userIdInput = document.getElementById('userId').value;
    const zoneId = document.getElementById('zoneId').value;
    const payment = document.getElementById('paymentMethod').value;
    let targetId = userIdInput + (selectedGame.id === 'ml' && zoneId ? " (" + zoneId + ")" : "");

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
function bukaFormWa() { document.getElementById("waModal").classList.add("active"); }
function tutupFormWa() { document.getElementById("waModal").classList.remove("active"); }
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

