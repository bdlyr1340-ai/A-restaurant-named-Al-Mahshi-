// رابط الـ Firebase الخاص بك الموجه للجذر لتنظيم البيانات بشكل احترافي
const rootURL = "https://cd-store-menu-default-rtdb.firebaseio.com/";

// التحقق من لوحة الإدارة وحمايتها بالباسورد الحالي
const isAdminPage = window.location.pathname.includes('admin.html');
if (isAdminPage) {
    let pass = prompt("أدخل كلمة مرور المسؤول للدخول للوحة التحكم:");
    if (pass !== "12345") { 
        alert("كلمة المرور خاطئة!");
        window.location.href = "index.html";
    }
}

// متغيرات عامة لحفظ بيانات التواصل الحالية أثناء تصفح الزبون
let currentConfig = {
    restaurantName: "مطعم المحشي",
    restaurantLogo: "",
    whatsapp: "",
    instagram: ""
};
let selectedItemForOrder = null;

// --- دالة جلب كل البيانات من السيرفر وعرضها بديناميكية ---
function loadAllData() {
    fetch(rootURL + '.json')
        .then(response => response.json())
        .then(data => {
            if (!data) data = {};

            // 1. جلب وتطبيق الإعدادات العامة (الاسم، الشعار، روابط التواصل)
            if (data.config) {
                currentConfig = data.config;
                if (!isAdminPage) {
                    if(data.config.restaurantName) document.getElementById('restName').innerText = data.config.restaurantName;
                    if(data.config.restaurantLogo) document.getElementById('restLogo').src = data.config.restaurantLogo;
                } else {
                    // ملء الخانات داخل لوحة التحكم تلقائياً بالبيانات المخزونة سابقاً
                    document.getElementById('setRestName').value = data.config.restaurantName || '';
                    document.getElementById('setRestLogo').value = data.config.restaurantLogo || '';
                    document.getElementById('setWhatsApp').value = data.config.whatsapp || '';
                    document.getElementById('setInstagram').value = data.config.instagram || '';
                }
            }

            // 2. معالجة وعرض الشريط الإعلاني المتحرك (العروض)
            const offersContainer = document.getElementById('offersContainer');
            const offersWrapper = document.getElementById('offersWrapper');
            const adminOffersList = document.getElementById('admin-offers-list');

            if (offersContainer) offersContainer.innerHTML = '';
            if (adminOffersList) adminOffersList.innerHTML = '';

            if (data.offers && Object.keys(data.offers).length > 0) {
                if (offersWrapper) offersWrapper.style.display = 'block';
                
                // مضاعفة العداد لضمان استمرار دوران حركة الماركي بدون فراغات
                const keys = Object.keys(data.offers);
                const loopKeys = [...keys, ...keys, ...keys]; 

                loopKeys.forEach((key, index) => {
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

                // عرض قائمة الحذف داخل لوحة الإدارة
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

            // 3. معالجة وعرض وجبات قائمة الطعام (المنيو)
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

                        // للزبون: عند الضغط يفتح بوكس تحديد الموقع والطلب
                        if (!isAdminPage) {
                            card.addEventListener('click', () => openOrderModal(item));
                        }

                        menuContainer.appendChild(card);
                    });

                    // تفعيل زر الحذف في لوحة التحكم
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

// --- دوال لوحة الإدارة (إرسال وحفظ وحذف البيانات) ---
if (isAdminPage) {
    // حفظ إعدادات المطعم العامة
    document.getElementById('saveConfigBtn').addEventListener('click', () => {
        const configData = {
            restaurantName: document.getElementById('setRestName').value,
            restaurantLogo: document.getElementById('setRestLogo').value,
            whatsapp: document.getElementById('setWhatsApp').value,
            instagram: document.getElementById('setInstagram').value
        };
        sendToFirebase('config', configData, 'PUT');
    });

    // إضافة إعلان/عرض جديد للشريط
    document.getElementById('addOfferBtn').addEventListener('click', () => {
        const title = document.getElementById('offerTitle').value;
        const image = document.getElementById('offerImage').value;
        if (title) {
            sendToFirebase('offers', { title, image }, 'POST').then(() => {
                document.getElementById('offerTitle').value = '';
                document.getElementById('offerImage').value = '';
            });
        } else { alert('الرجاء كتابة عنوان العرض'); }
    });

    // إضافة وجبة طعام جديدة
    document.getElementById('addItemBtn').addEventListener('click', () => {
        const name = document.getElementById('itemName').value;
        const price = document.getElementById('itemPrice').value;
        const image = document.getElementById('itemImage').value;
        if (name && price) {
            sendToFirebase('menuItems', { name, price, image }, 'POST').then(() => {
                document.getElementById('itemName').value = '';
                document.getElementById('itemPrice').value = '';
                document.getElementById('itemImage').value = '';
            });
        } else { alert('الرجاء إدخال الاسم والسعر للوجبة'); }
    });
}

// دالة وسيطة للرفع للـ Firebase
function sendToFirebase(path, bodyData, method) {
    return fetch(`${rootURL}${path}.json`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    }).then(() => loadAllData());
}

// دالة الحذف المباشر
function deleteData(path) {
    if (confirm('هل أنت متأكد من عملية الحذف؟')) {
        fetch(`${rootURL}${path}.json`, { method: 'DELETE' }).then(() => loadAllData());
    }
}

// --- نظام نوافذ طلبات الزبائن وتوليد الرسائل المباشرة ---
function openOrderModal(item) {
    selectedItemForOrder = item;
    document.getElementById('modalItemName').innerText = item.name;
    document.getElementById('modalItemPrice').innerText = item.price + " د.ع";
    document.getElementById('customerLocation').value = ''; // تصفير خانة الموقع القديمة
    document.getElementById('orderModal').style.display = 'block';
}

// إغلاق النافذة المنبثقة
if (!isAdminPage && document.querySelector('.close-modal')) {
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('orderModal').style.display = 'none';
    });
}

// معالجة ضغط زر الواتساب (توليد رسالة تلقائية بالوجبة والمكان)
if (!isAdminPage && document.getElementById('sendWhatsAppBtn')) {
    document.getElementById('sendWhatsAppBtn').addEventListener('click', () => {
        const location = document.getElementById('customerLocation').value.trim();
        if (!location) {
            alert('الرجاء إدخال عنوان التوصيل أولاً لإكمال الطلب!');
            return;
        }
        
        if (!currentConfig.whatsapp) {
            alert('عذراً، لم يقم المسؤول بإعداد رقم الواتساب بعد.');
            return;
        }

        // صياغة الرسالة التلقائية للواتساب بشكل مرتب واحترافي جداً
        const messageText = `مرحباً ${currentConfig.restaurantName}،\n\nأود طلب وجبة: *${selectedItemForOrder.name}*\nالسعر الحالي: *${selectedItemForOrder.price} د.ع*\n\n📍 عنوان التوصيل الخاص بي:\n${location}`;
        const encodedMessage = encodeURIComponent(messageText);
        
        // تنظيف رقم الهاتف وإزالة أي علامة زائد لتفادي مشاكل التوجيه
        let cleanNumber = currentConfig.whatsapp.replace('+', '').trim();
        
        window.open(`https://wa.me/${cleanNumber}?text=${encodedMessage}`, '_blank');
    });
}

// معالجة ضغط زر الانستقرام (تحويل مباشر لرابط محادثة الانستقرام المفتوح)
if (!isAdminPage && document.getElementById('sendInstagramBtn')) {
    document.getElementById('sendInstagramBtn').addEventListener('click', () => {
        const location = document.getElementById('customerLocation').value.trim();
        if (!location) {
            alert('الرجاء إدخال عنوان التوصيل أولاً لإعلام إدارة المطعم بمكانك عند المراسلة!');
            return;
        }

        if (!currentConfig.instagram) {
            alert('عذراً، لم يقم المسؤول بإضافة رابط الانستقرام للمطعم بعد.');
            return;
        }

        // نسخ تفاصيل الطلب للحافظة لتسهيل لصقها من قبل الزبون في الانستقرام
        const copyText = `طلب: ${selectedItemForOrder.name} | العنوان: ${location}`;
        navigator.clipboard.writeText(copyText).then(() => {
            alert('تم نسخ تفاصيل طلبك وعنوانك تلقائياً! يمكنك الآن لصقها مباشرة في رسائل انستقرام.');
            window.open(currentConfig.instagram, '_blank');
        }).catch(() => {
            window.open(currentConfig.instagram, '_blank');
        });
    });
}

// تشغيل جلب البيانات فور فتح التطبيق
loadAllData();
