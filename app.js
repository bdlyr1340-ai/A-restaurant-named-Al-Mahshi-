// رابط الـ Firebase الخاص بك
const rootURL = "https://cd-store-menu-default-rtdb.firebaseio.com/";

// التحقق من لوحة الإدارة وحمايتها بالباسورد
const isAdminPage = window.location.pathname.includes('admin.html');
if (isAdminPage) {
    let pass = prompt("أدخل كلمة مرور المسؤول للدخول للوحة التحكم:");
    if (pass !== "12345") { 
        alert("كلمة المرور خاطئة!");
        window.location.href = "index.html";
    }
}

let currentConfig = { restaurantName: "مطعم المحشي", restaurantLogo: "", whatsapp: "", instagram: "" };
let selectedItemForOrder = null;

// دالة سحرية لتحويل ملف الصورة المرفوع من الجهاز إلى نص يعشق الفايربيز (Base64)
function convertFileToBase64(fileInput) {
    return new Promise((resolve) => {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            resolve(""); // إذا لم يقم باختيار صورة يرجع نص فارغ
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}

// --- دالة جلب البيانات وعرضها ---
function loadAllData() {
    fetch(rootURL + '.json')
        .then(response => response.json())
        .then(data => {
            if (!data) data = {};

            // 1. تطبيق الإعدادات العامة
            if (data.config) {
                currentConfig = data.config;
                if (!isAdminPage) {
                    if(data.config.restaurantName) document.getElementById('restName').innerText = data.config.restaurantName;
                    if(data.config.restaurantLogo) document.getElementById('restLogo').src = data.config.restaurantLogo;
                } else {
                    document.getElementById('setRestName').value = data.config.restaurantName || '';
                    document.getElementById('setWhatsApp').value = data.config.whatsapp || '';
                    document.getElementById('setInstagram').value = data.config.instagram || '';
                }
            }

            // 2. عرض الشريط الإعلاني
            const offersContainer = document.getElementById('offersContainer');
            const offersWrapper = document.getElementById('offersWrapper');
            const adminOffersList = document.getElementById('admin-offers-list');

            if (offersContainer) offersContainer.innerHTML = '';
            if (adminOffersList) adminOffersList.innerHTML = '';

            if (data.offers && Object.keys(data.offers).length > 0) {
                if (offersWrapper) offersWrapper.style.display = 'block';
                const keys = Object.keys(data.offers);
                const loopKeys = [...keys, ...keys, ...keys]; 

                loopKeys.forEach((key) => {
                    const offer = data.offers[key];
                    if (offersContainer) {
                        const offerDiv = document.createElement('div');
                        offerDiv.className = 'offer-banner';
                        offerDiv.innerHTML = `
                            ${offer.image ? `<img src="${offer.image}" alt="عرض">` : ''}
                            <span>${offer.title}</span>
                        `;
                        offersContainer.appendChild(offerDiv);
                    }
                });

                if (isAdminPage) {
                    Object.keys(data.offers).forEach(key => {
                        const offer = data.offers[key];
                        const li = document.createElement('div');
                        li.className = 'admin-list-item';
                        li.innerHTML = `❌ ${offer.title} (اضغط لحذفه)`;
                        li.addEventListener('click', () => deleteData(`offers/${key}`));
                        adminOffersList.appendChild(li);
                    });
                }
            } else {
                if (offersWrapper) offersWrapper.style.display = 'none';
            }

            // 3. عرض المنيو للزبائن أو الإدارة
            const menuContainer = document.getElementById(isAdminPage ? 'admin-menu-container' : 'menu-container');
            if (menuContainer) {
                menuContainer.innerHTML = '';
                if (data.menuItems && Object.keys(data.menuItems).length > 0) {
                    Object.keys(data.menuItems).forEach(key => {
                        const item = data.menuItems[key];
                        const card = document.createElement('div');
                        card.className = 'menu-item';
                        
                        card.innerHTML = `
                            <img src="${item.image || 'https://placeholder.co/150'}" class="item-img" alt="${item.name}">
                            <h3>${item.name}</h3>
                            <div class="price">${item.price} د.ع</div>
                            ${isAdminPage ? `<button class="delete-btn" data-id="${key}">حذف هذه الوجبة</button>` : ''}
                        `;

                        if (!isAdminPage) {
                            card.addEventListener('click', () => openOrderModal(item));
                        }

                        menuContainer.appendChild(card);
                    });

                    if (isAdminPage) {
                        document.querySelectorAll('.delete-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const id = e.target.getAttribute('data-id');
                                deleteData(`menuItems/${id}`);
                            });
                        });
                    }
                } else {
                    menuContainer.innerHTML = '<p class="status-msg">القائمة فارغة حالياً.</p>';
                }
            }
        });
}

// --- أحداث لوحة التحكم بالأزرار الجديدة ---
if (isAdminPage) {
    // حفظ إعدادات المطعم والشعار المرفوع كملف
    document.getElementById('saveConfigBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveConfigBtn');
        btn.innerText = "جاري الحفظ والتحويل...";
        
        const logoFile = document.getElementById('setRestLogo');
        let logoBase64 = currentConfig.restaurantLogo; // الافتراضي القديم إذا لم يغير الصورة
        
        if (logoFile.files.length > 0) {
            logoBase64 = await convertFileToBase64(logoFile);
        }

        const configData = {
            restaurantName: document.getElementById('setRestName').value,
            restaurantLogo: logoBase64,
            whatsapp: document.getElementById('setWhatsApp').value,
            instagram: document.getElementById('setInstagram').value
        };
        
        sendToFirebase('config', configData, 'PUT').then(() => {
            btn.innerText = "حفظ إعدادات المطعم";
            logoFile.value = ""; // تصفير زر الرفع
            alert("تم حفظ البيانات والشعار بنجاح!");
        });
    });

    // إضافة عرض متحرك مع صورته من الملفات
    document.getElementById('addOfferBtn').addEventListener('click', async () => {
        const title = document.getElementById('offerTitle').value;
        const offerFile = document.getElementById('offerImage');
        
        if (title) {
            const btn = document.getElementById('addOfferBtn');
            btn.innerText = "جاري المعالجة...";
            
            const imageBase64 = await convertFileToBase64(offerFile);
            
            sendToFirebase('offers', { title, image: imageBase64 }, 'POST').then(() => {
                document.getElementById('offerTitle').value = '';
                offerFile.value = '';
                btn.innerText = "إضافة العرض للشريط";
            });
        } else { alert('الرجاء كتابة عنوان العرض'); }
    });

    // إضافة وجبة جديدة مع صورتها من الاستوديو مباشرة
    document.getElementById('addItemBtn').addEventListener('click', async () => {
        const name = document.getElementById('itemName').value;
        const price = document.getElementById('itemPrice').value;
        const itemFile = document.getElementById('itemImage');
        
        if (name && price) {
            const btn = document.getElementById('addItemBtn');
            btn.innerText = "جاري رفع الوجبة...";
            
            const imageBase64 = await convertFileToBase64(itemFile);
            
            sendToFirebase('menuItems', { name, price, image: imageBase64 }, 'POST').then(() => {
                document.getElementById('itemName').value = '';
                document.getElementById('itemPrice').value = '';
                itemFile.value = '';
                btn.innerText = "إضافة الوجبة للمنيو";
            });
        } else { alert('الرجاء إدخال الاسم والسعر للوجبة'); }
    });
}

function sendToFirebase(path, bodyData, method) {
    return fetch(`${rootURL}${path}.json`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    }).then(() => loadAllData());
}

function deleteData(path) {
    if (confirm('هل أنت متأكد من عملية الحذف؟')) {
        fetch(`${rootURL}${path}.json`, { method: 'DELETE' }).then(() => loadAllData());
    }
}

// --- نظام النوافذ المنبثقة للزبائن والتوصيل ---
function openOrderModal(item) {
    selectedItemForOrder = item;
    document.getElementById('modalItemName').innerText = item.name;
    document.getElementById('modalItemPrice').innerText = item.price + " د.ع";
    document.getElementById('customerLocation').value = '';
    document.getElementById('orderModal').style.display = 'block';
}

if (!isAdminPage && document.querySelector('.close-modal')) {
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('orderModal').style.display = 'none';
    });
}

if (!isAdminPage && document.getElementById('sendWhatsAppBtn')) {
    document.getElementById('sendWhatsAppBtn').addEventListener('click', () => {
        const location = document.getElementById('customerLocation').value.trim();
        if (!location) { alert('الرجاء إدخال عنوان التوصيل أولاً!'); return; }
        if (!currentConfig.whatsapp) { alert('لم يتم إعداد رقم الواتساب بعد.'); return; }

        const messageText = `مرحباً ${currentConfig.restaurantName}،\n\nأود طلب وجبة: *${selectedItemForOrder.name}*\nالسعر: *${selectedItemForOrder.price} د.ع*\n\n📍 عنوان التوصيل الخاص بي:\n${location}`;
        const encodedMessage = encodeURIComponent(messageText);
        let cleanNumber = currentConfig.whatsapp.replace('+', '').trim();
        window.open(`https://wa.me/${cleanNumber}?text=${encodedMessage}`, '_blank');
    });
}

if (!isAdminPage && document.getElementById('sendInstagramBtn')) {
    document.getElementById('sendInstagramBtn').addEventListener('click', () => {
        const location = document.getElementById('customerLocation').value.trim();
        if (!location) { alert('الرجاء إدخال عنوان التوصيل أولاً!'); return; }
        if (!currentConfig.instagram) { alert('لم يتم إضافة رابط انستقرام بعد.'); return; }

        const copyText = `طلب: ${selectedItemForOrder.name} | العنوان: ${location}`;
        navigator.clipboard.writeText(copyText).then(() => {
            alert('تم نسخ تفاصيل طلبك وعنوانك تلقائياً! يمكنك الآن لصقها في رسائل انستقرام.');
            window.open(currentConfig.instagram, '_blank');
        }).catch(() => { window.open(currentConfig.instagram, '_blank'); });
    });
}

loadAllData();
