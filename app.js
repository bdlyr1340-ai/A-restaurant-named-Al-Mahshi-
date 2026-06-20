const rootURL = "https://cd-store-menu-default-rtdb.firebaseio.com/";

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

// --- السر هنا: دالة ضغط الصور قبل رفعها للفايربيز ---
function compressAndConvertImage(fileInput) {
    return new Promise((resolve) => {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            resolve(""); 
            return;
        }
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; // تصغير العرض لتخفيف الحجم
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;

                // الحفاظ على أبعاد الصورة
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // تحويل الصورة لدقة 70% بحجم خفيف جداً يقبله الفايربيز
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(compressedBase64);
            }
        };
    });
}

function loadAllData() {
    fetch(rootURL + '.json')
        .then(response => response.json())
        .then(data => {
            if (!data) data = {};

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

if (isAdminPage) {
    // 1. حفظ الشعار
    document.getElementById('saveConfigBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveConfigBtn');
        btn.innerText = "جاري الحفظ (لحظات)...";
        
        const logoFile = document.getElementById('setRestLogo');
        let logoBase64 = currentConfig.restaurantLogo; 
        
        if (logoFile.files.length > 0) {
            logoBase64 = await compressAndConvertImage(logoFile);
        }

        const configData = {
            restaurantName: document.getElementById('setRestName').value,
            restaurantLogo: logoBase64,
            whatsapp: document.getElementById('setWhatsApp').value,
            instagram: document.getElementById('setInstagram').value
        };
        
        sendToFirebase('config', configData, 'PUT').then(() => {
            btn.innerText = "حفظ إعدادات المطعم";
            logoFile.value = ""; 
            alert("✅ تم حفظ إعدادات المطعم بنجاح!");
        }).catch(() => { alert("❌ حدث خطأ! تأكد من اتصال الإنترنت."); btn.innerText = "حفظ إعدادات المطعم"; });
    });

    // 2. إضافة عرض
    document.getElementById('addOfferBtn').addEventListener('click', async () => {
        const title = document.getElementById('offerTitle').value;
        const offerFile = document.getElementById('offerImage');
        
        if (title) {
            const btn = document.getElementById('addOfferBtn');
            btn.innerText = "جاري رفع العرض...";
            
            const imageBase64 = await compressAndConvertImage(offerFile);
            
            sendToFirebase('offers', { title, image: imageBase64 }, 'POST').then(() => {
                document.getElementById('offerTitle').value = '';
                offerFile.value = '';
                btn.innerText = "إضافة العرض للشريط";
                alert("✅ تم رفع العرض بنجاح!");
            });
        } else { alert('الرجاء كتابة عنوان العرض'); }
    });

    // 3. إضافة وجبة
    document.getElementById('addItemBtn').addEventListener('click', async () => {
        const name = document.getElementById('itemName').value;
        const price = document.getElementById('itemPrice').value;
        const itemFile = document.getElementById('itemImage');
        
        if (name && price) {
            const btn = document.getElementById('addItemBtn');
            btn.innerText = "جاري رفع الوجبة...";
            
            const imageBase64 = await compressAndConvertImage(itemFile);
            
            sendToFirebase('menuItems', { name, price, image: imageBase64 }, 'POST').then(() => {
                document.getElementById('itemName').value = '';
                document.getElementById('itemPrice').value = '';
                itemFile.value = '';
                btn.innerText = "إضافة الوجبة للمنيو";
                alert("✅ تم إضافة الوجبة بنجاح!");
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

// --- نظام النوافذ المنبثقة ---
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
