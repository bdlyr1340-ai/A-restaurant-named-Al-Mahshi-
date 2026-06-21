const rootURL = "https://cd-store-menu-default-rtdb.firebaseio.com/";
const FALLBACK_ADMIN_PASSWORD = "12345";
const isAdminPage = window.location.pathname.includes("admin.html");

const $ = (selector) => document.querySelector(selector);

const defaultLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='42' fill='%23b67a28'/%3E%3Ccircle cx='90' cy='90' r='54' fill='%23fff1d4' opacity='.95'/%3E%3Ctext x='90' y='104' text-anchor='middle' font-size='62' font-family='Arial'%3E%F0%9F%8D%B2%3C/text%3E%3C/svg%3E";
const defaultFoodImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='520' viewBox='0 0 700 520'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23f4c783'/%3E%3Cstop offset='1' stop-color='%236e3d11'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='700' height='520' rx='42' fill='url(%23g)'/%3E%3Ccircle cx='350' cy='265' r='150' fill='%23fff5df' opacity='.92'/%3E%3Ctext x='350' y='304' text-anchor='middle' font-size='120' font-family='Arial'%3E%F0%9F%8D%BD%EF%B8%8F%3C/text%3E%3C/svg%3E";

const defaultConfig = {
    restaurantName: "مطعم المحشي",
    restaurantLogo: "",
    slogan: "أطيب محاشي بطابع عراقي",
    heroTitle: "طعم المحشي العراقي… بصورة أفخم",
    heroSubtitle: "اختَر وجباتك، اجمعها بالسلة، وأرسل الطلب مباشرة للواتساب أو الانستقرام مع عنوانك.",
    whatsapp: "",
    instagram: "",
    address: "بغداد - العراق",
    workingHours: "12:00 - 01:00",
    deliveryFee: 2000,
    minOrder: 10000,
    prepTime: "25 - 40 دقيقة",
    themeColor: "#b67a28",
    currency: "د.ع",
    adminPassword: FALLBACK_ADMIN_PASSWORD
};

const defaultCategories = {};

const demoItems = {};

const state = {
    config: { ...defaultConfig },
    categories: { ...defaultCategories },
    customCategoryIds: new Set(),
    offers: {},
    menuItems: {},
    orders: {},
    search: "",
    activeCategory: "all",
    cart: loadCart(),
    dataLoaded: false
};

async function guardAdmin() {
    if (sessionStorage.getItem("almahshi_admin_ok") === "yes") return true;
    let configuredPassword = FALLBACK_ADMIN_PASSWORD;
    try {
        const response = await fetch(`${rootURL}config/adminPassword.json?ts=${Date.now()}`);
        const savedPassword = await response.json();
        if (savedPassword) configuredPassword = String(savedPassword);
    } catch (error) {
        console.warn("Could not load admin password, using fallback.", error);
    }
    const pass = prompt("أدخل كلمة مرور المسؤول للدخول للوحة التحكم:");
    if (pass !== configuredPassword) {
        alert("كلمة المرور خاطئة!");
        window.location.href = "index.html";
        return false;
    }
    sessionStorage.setItem("almahshi_admin_ok", "yes");
    return true;
}

function safeText(value, fallback = "") {
    return (value === undefined || value === null || value === "") ? fallback : String(value);
}
function escapeHTML(value) {
    return safeText(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}
function formatPrice(value) {
    const amount = Number(value || 0);
    return `${new Intl.NumberFormat("ar-IQ").format(amount)} ${state.config.currency || "د.ع"}`;
}
function numberValue(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}
function slugify(text) {
    const clean = safeText(text, "cat").trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, "").slice(0, 24);
    return clean || `cat-${Date.now()}`;
}
function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function loadCart() {
    try { return JSON.parse(localStorage.getItem("almahshi_cart") || "{}"); }
    catch { return {}; }
}
function saveCart() {
    localStorage.setItem("almahshi_cart", JSON.stringify(state.cart));
    updateCartCount();
}
function applyTheme() {
    document.documentElement.style.setProperty("--accent", state.config.themeColor || defaultConfig.themeColor);
}
async function loadAllData() {
    try {
        const response = await fetch(`${rootURL}.json?ts=${Date.now()}`);
        const data = await response.json() || {};
        state.config = { ...defaultConfig, ...(data.config || {}) };
        state.customCategoryIds = new Set(Object.keys(data.categories || {}));
        state.categories = { ...defaultCategories, ...(data.categories || {}) };
        state.offers = data.offers || {};
        state.menuItems = data.menuItems || {};
        state.orders = data.orders || {};
        state.dataLoaded = true;
    } catch (error) {
        console.error(error);
        showToast("تعذر الاتصال بقاعدة البيانات، تأكد من الإنترنت أو إعدادات Firebase");
        state.dataLoaded = false;
        state.menuItems = {};
    }
    applyTheme();
    renderCurrentPage();
}
async function sendToFirebase(path, bodyData, method = "POST") {
    const response = await fetch(`${rootURL}${path}.json`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: bodyData === undefined ? undefined : JSON.stringify(bodyData)
    });
    if (!response.ok) throw new Error("Firebase request failed");
    return response.json().catch(() => null);
}
async function deleteData(path) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
        await fetch(`${rootURL}${path}.json`, { method: "DELETE" });
        showToast("تم الحذف بنجاح");
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast("صار خطأ أثناء الحذف");
    }
}
function compressAndConvertImage(fileInput, maxWidth = 900, quality = 0.78) {
    return new Promise(resolve => {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) return resolve("");
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const scale = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = () => resolve("");
            img.src = event.target.result;
        };
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}
function getCategoriesArray() {
    return Object.entries(state.categories || {})
        .map(([id, category]) => ({ id, ...category, sort: numberValue(category.sort) }))
        .sort((a, b) => a.sort - b.sort || safeText(a.name).localeCompare(safeText(b.name), "ar"));
}
function normalizeItem(id, item) {
    return {
        id,
        name: safeText(item.name, "وجبة بدون اسم"),
        price: numberValue(item.price),
        oldPrice: numberValue(item.oldPrice),
        category: safeText(item.category, "uncategorized"),
        description: safeText(item.description, "وجبة شهية من مطعمنا."),
        image: safeText(item.image, ""),
        badges: item.badges || {},
        calories: safeText(item.calories, ""),
        prepTime: safeText(item.prepTime, ""),
        available: item.available !== false,
        sort: numberValue(item.sort),
        demo: Boolean(item.demo)
    };
}
function getItemsArray(includeDemo = false) {
    const raw = state.menuItems || {};
    return Object.entries(raw).map(([id, item]) => normalizeItem(item.id || id, item))
        .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ar"));
}
function getItemById(id) {
    return getItemsArray(false).find(item => item.id === id) || state.cart[id] || null;
}
function categoryInfo(id) { return state.categories[id] || { name: "بدون تصنيف", emoji: "🍽️" }; }
function isOpenNow() {
    const match = safeText(state.config.workingHours).match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const sh = Number(match[1]), sm = Number(match[2]), eh = Number(match[3]), em = Number(match[4]);
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return start <= end ? (minutes >= start && minutes <= end) : (minutes >= start || minutes <= end);
}
function renderCurrentPage() { isAdminPage ? renderAdminPage() : renderPublicPage(); }
function renderPublicPage() {
    const logo = $("#restLogo");
    if (logo) logo.src = state.config.restaurantLogo || defaultLogo;
    if ($("#restName")) $("#restName").textContent = state.config.restaurantName;
    if ($("#restSlogan")) $("#restSlogan").textContent = state.config.slogan;
    if ($("#heroTitle")) $("#heroTitle").textContent = state.config.heroTitle;
    if ($("#heroSubtitle")) $("#heroSubtitle").textContent = state.config.heroSubtitle;
    renderQuickInfo();
    renderOffers();
    renderCategoryChips();
    renderMenuItems();
    renderCart();
    updateCartCount();
}
function renderQuickInfo() {
    const container = $("#quickInfo");
    if (!container) return;
    const open = isOpenNow();
    const openLabel = open === null ? "حسب الطلب" : (open ? "مفتوح الآن" : "مغلق حالياً");
    const openClass = open === null ? "" : (open ? "open" : "closed");
    const tiles = [
        { label: "الحالة", value: openLabel, cls: openClass },
        { label: "ساعات العمل", value: state.config.workingHours || "غير محدد" },
        { label: "وقت التحضير", value: state.config.prepTime || "حسب الطلب" },
        { label: "التوصيل", value: formatPrice(state.config.deliveryFee || 0) }
    ];
    container.innerHTML = tiles.map(tile => `<div class="info-tile ${tile.cls || ""}"><span>${escapeHTML(tile.label)}</span><b>${escapeHTML(tile.value)}</b></div>`).join("");
}
function renderOffers() {
    const wrapper = $("#offersWrapper"), container = $("#offersContainer");
    if (!wrapper || !container) return;
    const offers = Object.entries(state.offers || {}).map(([id, offer]) => ({ id, ...offer }))
        .filter(offer => offer.active !== false && safeText(offer.title));
    if (!offers.length) { wrapper.style.display = "none"; container.innerHTML = ""; return; }
    wrapper.style.display = "block";
    const loopOffers = [...offers, ...offers, ...offers];
    container.innerHTML = loopOffers.map(offer => `
        <div class="offer-banner">
            <img src="${escapeHTML(offer.image || defaultFoodImage)}" alt="عرض">
            <div><b>${escapeHTML(offer.title)}</b><span>${escapeHTML(offer.subtitle || "عرض خاص لفترة محدودة")}</span></div>
        </div>`).join("");
}
function renderCategoryChips() {
    const container = $("#categoryChips");
    if (!container) return;
    const items = getItemsArray(false);
    const counts = items.reduce((acc, item) => { acc[item.category] = (acc[item.category] || 0) + 1; return acc; }, {});
    const allCount = items.length;
    const chips = [`<button class="category-chip ${state.activeCategory === "all" ? "active" : ""}" data-cat="all">كل القائمة (${allCount})</button>`]
        .concat(getCategoriesArray().map(cat => `<button class="category-chip ${state.activeCategory === cat.id ? "active" : ""}" data-cat="${escapeHTML(cat.id)}">${escapeHTML(cat.emoji || "🍽️")} ${escapeHTML(cat.name)} (${counts[cat.id] || 0})</button>`));
    container.innerHTML = chips.join("");
}
function getFilteredItems() {
    const search = state.search.trim().toLowerCase();
    return getItemsArray(false).filter(item => {
        const category = categoryInfo(item.category);
        const text = `${item.name} ${item.description} ${category.name}`.toLowerCase();
        return (!search || text.includes(search)) && (state.activeCategory === "all" || item.category === state.activeCategory);
    });
}
function badgeHTML(item) {
    const badges = [];
    if (item.badges.popular) badges.push(`<span class="food-badge">⭐ الأكثر طلباً</span>`);
    if (item.badges.new) badges.push(`<span class="food-badge green">جديد</span>`);
    if (item.badges.spicy) badges.push(`<span class="food-badge red">حار</span>`);
    if (item.badges.vegetarian) badges.push(`<span class="food-badge green">نباتي</span>`);
    return badges.length ? `<div class="badges">${badges.join("")}</div>` : "";
}
function itemCardHTML(item) {
    const cat = categoryInfo(item.category);
    return `
        <article class="menu-item ${item.available ? "" : "unavailable"}" data-id="${escapeHTML(item.id)}">
            <div class="item-img-wrap">
                <img class="item-img" src="${escapeHTML(item.image || defaultFoodImage)}" alt="${escapeHTML(item.name)}">
                <span class="category-label">${escapeHTML(cat.emoji || "🍽️")} ${escapeHTML(cat.name)}</span>
                ${item.available ? "" : `<span class="unavailable-label">غير متوفر</span>`}
            </div>
            <div class="item-body">
                <h3>${escapeHTML(item.name)}</h3>
                <p class="item-desc">${escapeHTML(item.description)}</p>
                ${badgeHTML(item)}
                <div class="meta-row">
                    ${item.prepTime ? `<span>⏱️ ${escapeHTML(item.prepTime)}</span>` : ""}
                    ${item.calories ? `<span>🔥 ${escapeHTML(item.calories)}</span>` : ""}
                </div>
                <div class="item-foot">
                    <div class="price-block"><strong>${formatPrice(item.price)}</strong>${item.oldPrice > item.price ? `<del>${formatPrice(item.oldPrice)}</del>` : ""}</div>
                    <div class="card-actions">
                        <button class="details-btn" data-action="details" data-id="${escapeHTML(item.id)}" type="button">i</button>
                        <button class="add-btn" data-action="add" data-id="${escapeHTML(item.id)}" ${item.available ? "" : "disabled"} type="button">+</button>
                    </div>
                </div>
            </div>
        </article>`;
}
function renderMenuItems() {
    const container = $("#menu-container"), emptyState = $("#emptyState");
    if (!container) return;
    const allItems = getItemsArray(false);
    const items = getFilteredItems();
    container.innerHTML = items.map(itemCardHTML).join("");
    if (emptyState) {
        emptyState.hidden = items.length > 0;
        if (!allItems.length) {
            emptyState.innerHTML = `<b>القائمة فارغة حالياً</b><p>الأكلات والتصنيفات تظهر هنا فقط بعد إضافتها من لوحة التحكم.</p>`;
        } else {
            emptyState.innerHTML = `<b>ماكو نتائج مطابقة</b><p>جرّب كلمة بحث ثانية أو اختَر تصنيف مختلف.</p>`;
        }
    }
    if (!items.length) container.innerHTML = "";
}
function addToCart(id) {
    const item = getItemById(id);
    if (!item || !item.available) return;
    if (!state.cart[id]) state.cart[id] = { id, name: item.name, price: item.price, image: item.image, qty: 0 };
    state.cart[id].qty += 1;
    state.cart[id].price = item.price;
    state.cart[id].name = item.name;
    state.cart[id].image = item.image;
    saveCart();
    renderCart();
    showToast(`تمت إضافة ${item.name} للسلة`);
}
function changeQty(id, delta) {
    if (!state.cart[id]) return;
    state.cart[id].qty += delta;
    if (state.cart[id].qty <= 0) delete state.cart[id];
    saveCart();
    renderCart();
}
function removeCartItem(id) { delete state.cart[id]; saveCart(); renderCart(); }
function cartLines() { return Object.values(state.cart || {}).filter(item => item.qty > 0); }
function cartSubtotal() { return cartLines().reduce((sum, item) => sum + numberValue(item.price) * numberValue(item.qty), 0); }
function updateCartCount() {
    const count = cartLines().reduce((sum, item) => sum + numberValue(item.qty), 0);
    if ($("#cartCount")) $("#cartCount").textContent = count;
}
function renderCart() {
    const container = $("#cartItems");
    if (!container) return;
    const lines = cartLines();
    if (!lines.length) {
        container.innerHTML = `<div class="cart-empty">السلة فارغة حالياً. اختَر وجباتك من القائمة.</div>`;
    } else {
        container.innerHTML = lines.map(line => `
            <div class="cart-row">
                <img src="${escapeHTML(line.image || defaultFoodImage)}" alt="${escapeHTML(line.name)}">
                <div><h4>${escapeHTML(line.name)}</h4><p>${formatPrice(line.price)} × ${line.qty}</p>
                    <div class="qty-controls"><button data-cart="plus" data-id="${escapeHTML(line.id)}" type="button">+</button><span>${line.qty}</span><button data-cart="minus" data-id="${escapeHTML(line.id)}" type="button">−</button></div>
                </div>
                <button class="remove-line" data-cart="remove" data-id="${escapeHTML(line.id)}" type="button">حذف</button>
            </div>`).join("");
    }
    const subtotal = cartSubtotal();
    const delivery = lines.length ? numberValue(state.config.deliveryFee) : 0;
    if ($("#subtotalAmount")) $("#subtotalAmount").textContent = formatPrice(subtotal);
    if ($("#deliveryAmount")) $("#deliveryAmount").textContent = formatPrice(delivery);
    if ($("#totalAmount")) $("#totalAmount").textContent = formatPrice(subtotal + delivery);
    updateCartCount();
}
function setDrawer(open) {
    $("#cartDrawer")?.classList.toggle("open", open);
    $("#cartBackdrop")?.classList.toggle("open", open);
}
function showFoodModal(id) {
    const item = getItemById(id);
    if (!item) return;
    const cat = categoryInfo(item.category), content = $("#modalFoodContent");
    if (!content) return;
    content.innerHTML = `
        <img class="modal-food-img" src="${escapeHTML(item.image || defaultFoodImage)}" alt="${escapeHTML(item.name)}">
        <div class="modal-food-body">
            <span class="badge-soft">${escapeHTML(cat.emoji || "🍽️")} ${escapeHTML(cat.name)}</span>
            <h2>${escapeHTML(item.name)}</h2><p>${escapeHTML(item.description)}</p>${badgeHTML(item)}
            <div class="meta-row">${item.prepTime ? `<span>⏱️ ${escapeHTML(item.prepTime)}</span>` : ""}${item.calories ? `<span>🔥 ${escapeHTML(item.calories)}</span>` : ""}</div>
            <div class="item-foot"><div class="price-block"><strong>${formatPrice(item.price)}</strong>${item.oldPrice > item.price ? `<del>${formatPrice(item.oldPrice)}</del>` : ""}</div></div>
            <div class="modal-food-actions"><button class="btn btn-primary" data-action="add" data-id="${escapeHTML(item.id)}" type="button">إضافة للسلة</button><button class="btn btn-soft" id="modalCloseBtn" type="button">رجوع للقائمة</button></div>
        </div>`;
    $("#foodModal")?.classList.add("open");
}
function closeFoodModal() { $("#foodModal")?.classList.remove("open"); }
function buildOrderMessage(channel) {
    const lines = cartLines();
    const name = safeText($("#customerName")?.value).trim();
    const phone = safeText($("#customerPhone")?.value).trim();
    const location = safeText($("#customerLocation")?.value).trim();
    const notes = safeText($("#orderNotes")?.value).trim();
    const subtotal = cartSubtotal();
    const delivery = lines.length ? numberValue(state.config.deliveryFee) : 0;
    const total = subtotal + delivery;
    const details = lines.map(item => `• ${item.name} × ${item.qty} = ${formatPrice(item.price * item.qty)}`).join("\n");
    return {
        text: `مرحباً ${state.config.restaurantName}، أريد إرسال طلب جديد:\n\n${details}\n\nالمجموع: ${formatPrice(subtotal)}\nالتوصيل: ${formatPrice(delivery)}\nالإجمالي: ${formatPrice(total)}\n\nالاسم: ${name || "غير مذكور"}\nالهاتف: ${phone || "غير مذكور"}\nالعنوان: ${location}\nملاحظات: ${notes || "لا توجد"}`,
        order: { createdAt: new Date().toISOString(), status: "new", channel, customerName: name, customerPhone: phone, location, notes, items: lines, subtotal, delivery, total }
    };
}
async function submitOrder(channel) {
    const lines = cartLines();
    const location = safeText($("#customerLocation")?.value).trim();
    if (!lines.length) { showToast("السلة فارغة، أضف وجبة أولاً"); return; }
    if (!location) { showToast("اكتب عنوان التوصيل بالتفصيل"); $("#customerLocation")?.focus(); return; }
    const minOrder = numberValue(state.config.minOrder);
    if (minOrder && cartSubtotal() < minOrder) { showToast(`الحد الأدنى للطلب ${formatPrice(minOrder)}`); return; }
    const { text, order } = buildOrderMessage(channel);
    try { await sendToFirebase("orders", order, "POST"); } catch (error) { console.warn("Order log failed", error); }
    if (channel === "whatsapp") {
        if (!state.config.whatsapp) { showToast("رقم الواتساب غير مضبوط من لوحة التحكم"); return; }
        const cleanNumber = state.config.whatsapp.replace(/[^0-9]/g, "");
        window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`, "_blank");
    } else {
        if (!state.config.instagram) { showToast("رابط الانستقرام غير مضبوط من لوحة التحكم"); return; }
        try { await navigator.clipboard.writeText(text); showToast("تم نسخ الطلب، افتح الرسائل والصقه"); }
        catch { showToast("انسخ تفاصيل الطلب يدوياً بعد فتح انستقرام"); }
        window.open(state.config.instagram, "_blank");
    }
}
function bindPublicEvents() {
    $("#searchInput")?.addEventListener("input", event => { state.search = event.target.value; renderMenuItems(); });
    $("#categoryChips")?.addEventListener("click", event => {
        const btn = event.target.closest("[data-cat]");
        if (!btn) return;
        state.activeCategory = btn.dataset.cat;
        renderCategoryChips();
        renderMenuItems();
    });
    $("#menu-container")?.addEventListener("click", event => {
        const btn = event.target.closest("[data-action]");
        if (!btn) return;
        if (btn.dataset.action === "add") addToCart(btn.dataset.id);
        if (btn.dataset.action === "details") showFoodModal(btn.dataset.id);
    });
    $("#modalFoodContent")?.addEventListener("click", event => {
        const add = event.target.closest("[data-action='add']");
        if (add) { addToCart(add.dataset.id); closeFoodModal(); setDrawer(true); }
        if (event.target.closest("#modalCloseBtn")) closeFoodModal();
    });
    $("#cartToggle")?.addEventListener("click", () => setDrawer(true));
    $("#closeCart")?.addEventListener("click", () => setDrawer(false));
    $("#cartBackdrop")?.addEventListener("click", () => setDrawer(false));
    $("#closeFoodModal")?.addEventListener("click", closeFoodModal);
    $("#foodModal")?.addEventListener("click", event => { if (event.target.id === "foodModal") closeFoodModal(); });
    $("#cartItems")?.addEventListener("click", event => {
        const btn = event.target.closest("[data-cart]");
        if (!btn) return;
        if (btn.dataset.cart === "plus") changeQty(btn.dataset.id, 1);
        if (btn.dataset.cart === "minus") changeQty(btn.dataset.id, -1);
        if (btn.dataset.cart === "remove") removeCartItem(btn.dataset.id);
    });
    $("#clearCartBtn")?.addEventListener("click", () => { state.cart = {}; saveCart(); renderCart(); showToast("تم تفريغ السلة"); });
    $("#sendWhatsAppBtn")?.addEventListener("click", () => submitOrder("whatsapp"));
    $("#sendInstagramBtn")?.addEventListener("click", () => submitOrder("instagram"));
    $("#shareMenuBtn")?.addEventListener("click", async () => {
        const url = menuUrl();
        try { await navigator.clipboard.writeText(url); showToast("تم نسخ رابط المنيو"); }
        catch { showToast("رابط المنيو: " + url); }
    });
}
function menuUrl() { return window.location.href.replace(/admin\.html.*/, "index.html"); }

function renderAdminPage() {
    fillConfigForm();
    renderAdminStats();
    renderInsights();
    renderAdminCategories();
    renderCategorySelect();
    renderAdminOffers();
    renderAdminItems();
    renderAdminOrders();
    renderQRCode();
}
function fillConfigForm() {
    const map = {
        setRestName: state.config.restaurantName,
        setSlogan: state.config.slogan,
        setHeroTitle: state.config.heroTitle,
        setHeroSubtitle: state.config.heroSubtitle,
        setWhatsApp: state.config.whatsapp,
        setInstagram: state.config.instagram,
        setAddress: state.config.address,
        setWorkingHours: state.config.workingHours,
        setDeliveryFee: state.config.deliveryFee,
        setMinOrder: state.config.minOrder,
        setPrepTime: state.config.prepTime,
        setThemeColor: state.config.themeColor || defaultConfig.themeColor
    };
    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = value || "";
    });
    const passInput = document.getElementById("setAdminPassword");
    if (passInput && document.activeElement !== passInput) passInput.value = "";
}
function renderAdminStats() {
    const items = getItemsArray(false);
    const activeOffers = Object.values(state.offers || {}).filter(offer => offer.active !== false).length;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("statMeals", items.length);
    set("statCategories", getCategoriesArray().length);
    set("statOffers", activeOffers);
    set("statOrders", Object.keys(state.orders || {}).length);
}
function renderInsights() {
    const panel = $("#insightsPanel");
    if (!panel) return;
    const items = getItemsArray(false);
    const unavailable = items.filter(item => !item.available).length;
    const withoutPhotos = items.filter(item => !item.image).length;
    const withoutDesc = items.filter(item => !item.description || item.description === "وجبة شهية من مطعمنا.").length;
    const topPrice = items.reduce((max, item) => item.price > max.price ? item : max, { name: "لا يوجد", price: 0 });
    const categoryCounts = items.reduce((acc, item) => { acc[item.category] = (acc[item.category] || 0) + 1; return acc; }, {});
    const weakestCategory = getCategoriesArray().map(cat => ({ ...cat, count: categoryCounts[cat.id] || 0 })).sort((a,b) => a.count - b.count)[0];
    const ideas = [
        { title: "صور ناقصة", text: withoutPhotos ? `${withoutPhotos} وجبة بدون صورة. الصورة ترفع شهية الزبون وتزيد الطلب.` : "كل الوجبات لديها صور، ممتاز." },
        { title: "وصف تسويقي", text: withoutDesc ? `${withoutDesc} وجبة تحتاج وصف أقوى. اذكر المكونات، النكهة، والحجم.` : "الأوصاف مكتملة بشكل جيد." },
        { title: "فرصة بيع أعلى", text: topPrice.price ? `أغلى وجبة هي ${topPrice.name}. ضعها ضمن عرض عائلي أو أضف معها مقبلات.` : "أضف وجبات حتى تظهر تحليلات البيع." },
        { title: "التوفر", text: unavailable ? `${unavailable} وجبة غير متوفرة. أبقِها ظاهرة حتى لا تضيع صورها وترتيبها.` : "كل الوجبات متوفرة حالياً." },
        { title: "التوازن", text: weakestCategory ? `تصنيف ${weakestCategory.name} يحتوي ${weakestCategory.count} وجبة. زِد خياراته أو أخفِه إذا غير مهم.` : "أضف تصنيفات لتنظيم المنيو." },
        { title: "نصيحة احترافية", text: "استخدم السعر القديم مع شارة الأكثر طلباً للعروض؛ هذا يعطي إحساس بقيمة أعلى بدون تغيير التصميم." }
    ];
    panel.innerHTML = ideas.map(idea => `<div class="insight-card"><b>${escapeHTML(idea.title)}</b><p>${escapeHTML(idea.text)}</p></div>`).join("");
}
function renderQRCode() {
    const img = $("#qrCodeImg");
    if (img) img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(menuUrl())}`;
}
function renderCategorySelect() {
    const select = $("#itemCategory");
    if (!select) return;
    const selected = select.value;
    const cats = getCategoriesArray();
    const options = cats.length
        ? cats.map(cat => `<option value="${escapeHTML(cat.id)}">${escapeHTML(cat.emoji || "🍽️")} ${escapeHTML(cat.name)}</option>`).join("")
        : `<option value="uncategorized">🍽️ بدون تصنيف</option>`;
    select.innerHTML = options;
    if (selected && [...select.options].some(option => option.value === selected)) select.value = selected;
}
function renderAdminCategories() {
    const list = $("#adminCategoriesList");
    if (!list) return;
    const cats = getCategoriesArray();
    if (!cats.length) { list.innerHTML = `<div class="admin-list-item"><span>لا توجد تصنيفات ثابتة. أضف أي تصنيف تريده وسيظهر بالمنيو.</span></div>`; return; }
    list.innerHTML = cats.map(cat => `
        <div class="admin-list-item">
            <div><b>${escapeHTML(cat.emoji || "🍽️")} ${escapeHTML(cat.name)}</b><br><small>ترتيب: ${cat.sort || 0}</small></div>
            <div class="list-actions">
                <button class="mini-btn success" data-edit-category="${escapeHTML(cat.id)}" type="button">تعديل</button>
                <button class="mini-btn danger" data-delete-category="${escapeHTML(cat.id)}" type="button">حذف</button>
            </div>
        </div>`).join("");
}
function renderAdminOffers() {
    const list = $("#admin-offers-list");
    if (!list) return;
    const offers = Object.entries(state.offers || {}).map(([id, offer]) => ({ id, ...offer }));
    if (!offers.length) { list.innerHTML = `<div class="admin-list-item"><span>لا توجد عروض حالياً. كل العروض قابلة للإضافة والتعديل والحذف.</span></div>`; return; }
    list.innerHTML = offers.map(offer => `
        <div class="admin-list-item">
            <div><b>${escapeHTML(offer.title)}</b><br><small>${escapeHTML(offer.subtitle || "بدون وصف")} — ${offer.active === false ? "متوقف" : "نشط"}</small></div>
            <div class="list-actions">
                <button class="mini-btn success" data-edit-offer="${escapeHTML(offer.id)}" type="button">تعديل</button>
                <button class="mini-btn" data-toggle-offer="${escapeHTML(offer.id)}" type="button">${offer.active === false ? "تفعيل" : "إيقاف"}</button>
                <button class="mini-btn danger" data-delete-offer="${escapeHTML(offer.id)}" type="button">حذف</button>
            </div>
        </div>`).join("");
}
function renderAdminItems() {
    const list = $("#admin-menu-container");
    if (!list) return;
    const items = getItemsArray(false);
    if (!items.length) { list.innerHTML = `<div class="admin-list-item"><span>القائمة فارغة. ابدأ بإضافة وجبة حقيقية بدل النموذج التجريبي.</span></div>`; return; }
    list.innerHTML = items.map(item => {
        const cat = categoryInfo(item.category);
        return `
            <article class="admin-food-card">
                <img src="${escapeHTML(item.image || defaultFoodImage)}" alt="${escapeHTML(item.name)}">
                <div>
                    <h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.description)}</p>
                    <div class="admin-food-meta"><span>${escapeHTML(cat.emoji || "🍽️")} ${escapeHTML(cat.name)}</span><span>${formatPrice(item.price)}</span><span>${item.available ? "متوفر" : "غير متوفر"}</span></div>
                    <div class="list-actions" style="margin-top:10px">
                        <button class="mini-btn success" data-edit-item="${escapeHTML(item.id)}" type="button">تعديل</button>
                        <button class="mini-btn" data-toggle-item="${escapeHTML(item.id)}" type="button">${item.available ? "إخفاء" : "إظهار"}</button>
                        <button class="mini-btn danger" data-delete-item="${escapeHTML(item.id)}" type="button">حذف</button>
                    </div>
                </div>
            </article>`;
    }).join("");
}
function orderStatusLabel(status) {
    return ({ new: "جديد", preparing: "قيد التحضير", delivered: "تم التسليم", cancelled: "ملغي" })[status] || status || "جديد";
}
function renderAdminOrders() {
    const list = $("#adminOrdersList");
    if (!list) return;
    const orders = Object.entries(state.orders || {}).map(([id, order]) => ({ id, ...order }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 30);
    if (!orders.length) { list.innerHTML = `<div class="order-card"><p>لا توجد طلبات مسجلة بعد. الطلب يتسجل عندما الزبون يرسله من السلة.</p></div>`; return; }
    list.innerHTML = orders.map(order => {
        const itemLines = (order.items || []).map(item => `${item.name} × ${item.qty}`).join("، ");
        const date = order.createdAt ? new Date(order.createdAt).toLocaleString("ar-IQ") : "غير معروف";
        return `
            <div class="order-card">
                <h3>طلب ${escapeHTML(order.customerName || "زبون")} — <span class="status-${escapeHTML(order.status || "new")}">${escapeHTML(orderStatusLabel(order.status))}</span></h3>
                <p>القناة: ${escapeHTML(order.channel || "غير محدد")} — التاريخ: ${escapeHTML(date)}</p>
                <div class="order-lines">${escapeHTML(itemLines || "بدون تفاصيل")}</div>
                <p>العنوان: ${escapeHTML(order.location || "غير مذكور")}</p>
                <p>الهاتف: ${escapeHTML(order.customerPhone || "غير مذكور")}</p>
                <p><b>الإجمالي: ${formatPrice(order.total || 0)}</b></p>
                <div class="list-actions">
                    <button class="mini-btn" data-status="preparing" data-order="${escapeHTML(order.id)}" type="button">قيد التحضير</button>
                    <button class="mini-btn success" data-status="delivered" data-order="${escapeHTML(order.id)}" type="button">تم التسليم</button>
                    <button class="mini-btn danger" data-status="cancelled" data-order="${escapeHTML(order.id)}" type="button">إلغاء</button>
                    <button class="mini-btn danger" data-delete-order="${escapeHTML(order.id)}" type="button">حذف</button>
                </div>
            </div>`;
    }).join("");
}
async function saveConfig() {
    const btn = $("#saveConfigBtn"), logoInput = $("#setRestLogo");
    try {
        if (btn) btn.textContent = "جاري الحفظ...";
        let logo = state.config.restaurantLogo || "";
        if (logoInput && logoInput.files.length) logo = await compressAndConvertImage(logoInput, 700, 0.82);
        const newPassword = safeText($("#setAdminPassword")?.value).trim();
        const config = {
            restaurantName: safeText($("#setRestName")?.value, defaultConfig.restaurantName).trim(),
            restaurantLogo: logo,
            slogan: safeText($("#setSlogan")?.value, defaultConfig.slogan).trim(),
            heroTitle: safeText($("#setHeroTitle")?.value, defaultConfig.heroTitle).trim(),
            heroSubtitle: safeText($("#setHeroSubtitle")?.value, defaultConfig.heroSubtitle).trim(),
            whatsapp: safeText($("#setWhatsApp")?.value).trim(),
            instagram: safeText($("#setInstagram")?.value).trim(),
            address: safeText($("#setAddress")?.value).trim(),
            workingHours: safeText($("#setWorkingHours")?.value, defaultConfig.workingHours).trim(),
            deliveryFee: numberValue($("#setDeliveryFee")?.value),
            minOrder: numberValue($("#setMinOrder")?.value),
            prepTime: safeText($("#setPrepTime")?.value, defaultConfig.prepTime).trim(),
            themeColor: safeText($("#setThemeColor")?.value, defaultConfig.themeColor),
            currency: "د.ع",
            adminPassword: newPassword || state.config.adminPassword || FALLBACK_ADMIN_PASSWORD
        };
        await sendToFirebase("config", config, "PUT");
        if (logoInput) logoInput.value = "";
        if ($("#setAdminPassword")) $("#setAdminPassword").value = "";
        showToast("تم حفظ إعدادات المطعم");
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast("صار خطأ أثناء حفظ الإعدادات");
    } finally {
        if (btn) btn.textContent = "حفظ إعدادات المطعم";
    }
}
function resetCategoryForm() {
    ["editingCategoryId", "categoryName", "categoryEmoji", "categorySort"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    if ($("#addCategoryBtn")) $("#addCategoryBtn").textContent = "إضافة تصنيف";
}
function fillCategoryForm(id) {
    const cat = state.categories[id];
    if (!cat) return;
    $("#editingCategoryId").value = id;
    $("#categoryName").value = cat.name || "";
    $("#categoryEmoji").value = cat.emoji || "🍽️";
    $("#categorySort").value = cat.sort || "";
    $("#addCategoryBtn").textContent = "تحديث التصنيف";
    $("#categoryCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function saveCategory() {
    const name = safeText($("#categoryName")?.value).trim();
    const emoji = safeText($("#categoryEmoji")?.value, "🍽️").trim();
    const sort = numberValue($("#categorySort")?.value) || getCategoriesArray().length + 1;
    const editingId = safeText($("#editingCategoryId")?.value).trim();
    if (!name) { showToast("اكتب اسم التصنيف"); return; }
    const id = editingId || `${slugify(name)}-${Date.now().toString(36)}`;
    try {
        await sendToFirebase(`categories/${id}`, { name, emoji, sort, updatedAt: new Date().toISOString() }, "PUT");
        resetCategoryForm();
        showToast(editingId ? "تم تحديث التصنيف" : "تمت إضافة التصنيف");
        await loadAllData();
    } catch (error) { console.error(error); showToast("تعذر حفظ التصنيف"); }
}
function resetOfferForm() {
    ["editingOfferId", "offerTitle", "offerSubtitle", "offerImage"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    if ($("#offerActive")) $("#offerActive").checked = true;
    if ($("#addOfferBtn")) $("#addOfferBtn").textContent = "إضافة العرض";
}
function fillOfferForm(id) {
    const offer = state.offers[id];
    if (!offer) return;
    $("#editingOfferId").value = id;
    $("#offerTitle").value = offer.title || "";
    $("#offerSubtitle").value = offer.subtitle || "";
    $("#offerActive").checked = offer.active !== false;
    $("#addOfferBtn").textContent = "تحديث العرض";
    $("#offersCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function saveOffer() {
    const title = safeText($("#offerTitle")?.value).trim();
    const subtitle = safeText($("#offerSubtitle")?.value).trim();
    const imageInput = $("#offerImage");
    const active = $("#offerActive")?.checked !== false;
    const editingId = safeText($("#editingOfferId")?.value).trim();
    const existing = editingId ? (state.offers[editingId] || {}) : {};
    if (!title) { showToast("اكتب عنوان العرض"); return; }
    const btn = $("#addOfferBtn");
    let saved = false;
    try {
        if (btn) btn.textContent = editingId ? "جاري تحديث العرض..." : "جاري رفع العرض...";
        let image = existing.image || "";
        if (imageInput && imageInput.files.length) image = await compressAndConvertImage(imageInput, 1000, 0.76);
        const offer = { title, subtitle, image, active, updatedAt: new Date().toISOString() };
        if (editingId) await sendToFirebase(`offers/${editingId}`, offer, "PUT");
        else await sendToFirebase("offers", { ...offer, createdAt: new Date().toISOString() }, "POST");
        saved = true;
        resetOfferForm();
        showToast(editingId ? "تم تحديث العرض" : "تمت إضافة العرض");
        await loadAllData();
    } catch (error) { console.error(error); showToast("تعذر حفظ العرض"); }
    finally { if (btn && !saved) btn.textContent = editingId ? "تحديث العرض" : "إضافة العرض"; }
}
function resetItemForm() {
    ["editingItemId", "itemName", "itemPrice", "itemOldPrice", "itemDescription", "itemCalories", "itemPrepTime", "itemSort", "itemImage"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    ["badgePopular", "badgeNew", "badgeSpicy", "badgeVegetarian"].forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
    if ($("#itemAvailable")) $("#itemAvailable").checked = true;
    if ($("#itemFormTitle")) $("#itemFormTitle").textContent = "إضافة وجبة جديدة";
    if ($("#saveItemBtn")) $("#saveItemBtn").textContent = "حفظ الوجبة";
}
function fillItemForm(id) {
    const item = getItemsArray(false).find(i => i.id === id);
    if (!item) return;
    $("#editingItemId").value = id;
    $("#itemName").value = item.name;
    $("#itemCategory").value = item.category;
    $("#itemPrice").value = item.price || "";
    $("#itemOldPrice").value = item.oldPrice || "";
    $("#itemDescription").value = item.description || "";
    $("#itemCalories").value = item.calories || "";
    $("#itemPrepTime").value = item.prepTime || "";
    $("#itemSort").value = item.sort || "";
    $("#itemAvailable").checked = item.available;
    $("#badgePopular").checked = Boolean(item.badges.popular);
    $("#badgeNew").checked = Boolean(item.badges.new);
    $("#badgeSpicy").checked = Boolean(item.badges.spicy);
    $("#badgeVegetarian").checked = Boolean(item.badges.vegetarian);
    $("#itemFormTitle").textContent = `تعديل: ${item.name}`;
    $("#saveItemBtn").textContent = "تحديث الوجبة";
    $("#itemsCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function saveItem() {
    const name = safeText($("#itemName")?.value).trim();
    const price = numberValue($("#itemPrice")?.value);
    if (!name || !price) { showToast("اكتب اسم الوجبة والسعر"); return; }
    const editingId = safeText($("#editingItemId")?.value).trim();
    const existing = editingId ? (state.menuItems[editingId] || {}) : {};
    const imageInput = $("#itemImage"), btn = $("#saveItemBtn");
    try {
        if (btn) btn.textContent = editingId ? "جاري التحديث..." : "جاري الحفظ...";
        let image = existing.image || "";
        if (imageInput && imageInput.files.length) image = await compressAndConvertImage(imageInput, 1000, 0.78);
        const item = {
            name,
            price,
            oldPrice: numberValue($("#itemOldPrice")?.value),
            category: safeText($("#itemCategory")?.value, "uncategorized"),
            description: safeText($("#itemDescription")?.value).trim(),
            calories: safeText($("#itemCalories")?.value).trim(),
            prepTime: safeText($("#itemPrepTime")?.value).trim(),
            sort: numberValue($("#itemSort")?.value),
            available: $("#itemAvailable")?.checked !== false,
            image,
            badges: {
                popular: Boolean($("#badgePopular")?.checked),
                new: Boolean($("#badgeNew")?.checked),
                spicy: Boolean($("#badgeSpicy")?.checked),
                vegetarian: Boolean($("#badgeVegetarian")?.checked)
            },
            updatedAt: new Date().toISOString()
        };
        if (editingId) await sendToFirebase(`menuItems/${editingId}`, item, "PUT");
        else await sendToFirebase("menuItems", { ...item, createdAt: new Date().toISOString() }, "POST");
        resetItemForm();
        showToast(editingId ? "تم تحديث الوجبة" : "تمت إضافة الوجبة");
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast("تعذر حفظ الوجبة");
    } finally {
        if (btn) btn.textContent = "حفظ الوجبة";
    }
}
async function toggleOffer(id) {
    const offer = state.offers[id];
    if (!offer) return;
    await sendToFirebase(`offers/${id}/active`, offer.active === false, "PUT");
    showToast("تم تحديث حالة العرض");
    await loadAllData();
}
async function toggleItem(id) {
    const item = state.menuItems[id];
    if (!item) return;
    await sendToFirebase(`menuItems/${id}/available`, item.available === false, "PUT");
    showToast("تم تحديث حالة الوجبة");
    await loadAllData();
}
async function updateOrderStatus(id, status) {
    await sendToFirebase(`orders/${id}/status`, status, "PUT");
    showToast("تم تحديث حالة الطلب");
    await loadAllData();
}
async function clearPath(path, label) {
    if (!confirm(`تأكيد نهائي: هل تريد حذف ${label}؟`)) return;
    try {
        await fetch(`${rootURL}${path}.json`, { method: "DELETE" });
        showToast(`تم حذف ${label}`);
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast("تعذر تنفيذ الحذف");
    }
}
function bindAdminEvents() {
    $("#saveConfigBtn")?.addEventListener("click", saveConfig);
    $("#addCategoryBtn")?.addEventListener("click", saveCategory);
    $("#resetCategoryBtn")?.addEventListener("click", resetCategoryForm);
    $("#addOfferBtn")?.addEventListener("click", saveOffer);
    $("#resetOfferBtn")?.addEventListener("click", resetOfferForm);
    $("#saveItemBtn")?.addEventListener("click", saveItem);
    $("#resetItemBtn")?.addEventListener("click", resetItemForm);
    $("#copyMenuUrlBtn")?.addEventListener("click", async () => {
        const url = menuUrl();
        try { await navigator.clipboard.writeText(url); showToast("تم نسخ رابط المنيو"); }
        catch { showToast("رابط المنيو: " + url); }
    });
    $("#setThemeColor")?.addEventListener("input", event => document.documentElement.style.setProperty("--accent", event.target.value));
    $("#adminCategoriesList")?.addEventListener("click", event => {
        const edit = event.target.closest("[data-edit-category]")?.dataset.editCategory;
        const id = event.target.closest("[data-delete-category]")?.dataset.deleteCategory;
        if (edit) fillCategoryForm(edit);
        if (id) deleteData(`categories/${id}`);
    });
    $("#admin-offers-list")?.addEventListener("click", event => {
        const edit = event.target.closest("[data-edit-offer]")?.dataset.editOffer;
        const del = event.target.closest("[data-delete-offer]")?.dataset.deleteOffer;
        const toggle = event.target.closest("[data-toggle-offer]")?.dataset.toggleOffer;
        if (edit) fillOfferForm(edit);
        if (del) deleteData(`offers/${del}`);
        if (toggle) toggleOffer(toggle).catch(() => showToast("تعذر تحديث العرض"));
    });
    $("#admin-menu-container")?.addEventListener("click", event => {
        const edit = event.target.closest("[data-edit-item]")?.dataset.editItem;
        const del = event.target.closest("[data-delete-item]")?.dataset.deleteItem;
        const toggle = event.target.closest("[data-toggle-item]")?.dataset.toggleItem;
        if (edit) fillItemForm(edit);
        if (del) deleteData(`menuItems/${del}`);
        if (toggle) toggleItem(toggle).catch(() => showToast("تعذر تحديث الوجبة"));
    });
    $("#adminOrdersList")?.addEventListener("click", event => {
        const statusBtn = event.target.closest("[data-status]");
        const del = event.target.closest("[data-delete-order]")?.dataset.deleteOrder;
        if (statusBtn) updateOrderStatus(statusBtn.dataset.order, statusBtn.dataset.status).catch(() => showToast("تعذر تحديث الطلب"));
        if (del) deleteData(`orders/${del}`);
    });
    $("#clearItemsBtn")?.addEventListener("click", () => clearPath("menuItems", "كل الوجبات"));
    $("#clearCategoriesBtn")?.addEventListener("click", () => clearPath("categories", "كل التصنيفات"));
    $("#clearOffersBtn")?.addEventListener("click", () => clearPath("offers", "كل العروض"));
    $("#clearOrdersBtn")?.addEventListener("click", () => clearPath("orders", "سجل الطلبات"));
}
async function init() {
    if (isAdminPage) {
        const ok = await guardAdmin();
        if (!ok) return;
        bindAdminEvents();
    } else {
        bindPublicEvents();
    }
    loadAllData();
}
document.addEventListener("DOMContentLoaded", init);
