// رابط قاعدة البيانات الخاص بك
const dbURL = "https://cd-store-menu-default-rtdb.firebaseio.com/menuItems";

// --- حماية صفحة الإدارة بكلمة مرور بسيطة ---
const isAdminPage = window.location.pathname.includes('admin.html');
if (isAdminPage) {
    let pass = prompt("أدخل كلمة مرور المسؤول:");
    if (pass !== "12345") { // الباسورد الحالي 12345
        alert("كلمة المرور خاطئة!");
        window.location.href = "index.html";
    }
}

// --- جلب الوجبات وعرضها ---
function loadMenuItems() {
    const container = document.getElementById(isAdminPage ? 'admin-menu-container' : 'menu-container');
    if (!container) return;

    container.innerHTML = '<p>جاري تحميل القائمة...</p>';

    fetch(dbURL + '.json')
        .then(response => response.json())
        .then(data => {
            container.innerHTML = ''; // تفريغ الشاشة قبل عرض الوجبات
            
            if (data && Object.keys(data).length > 0) {
                Object.keys(data).forEach(key => {
                    const item = data[key];
                    const itemCard = document.createElement('div');
                    itemCard.className = 'menu-item';
                    
                    let cardHTML = `
                        <h3>${item.name}</h3>
                        <div class="price">${item.price} د.ع</div>
                    `;
                    
                    // إضافة زر الحذف فقط في لوحة التحكم
                    if (isAdminPage) {
                        cardHTML += `<button class="delete-btn" data-id="${key}">حذف الوجبة</button>`;
                    }
                    
                    itemCard.innerHTML = cardHTML;
                    container.appendChild(itemCard);
                });

                // تفعيل أزرار الحذف
                if (isAdminPage) {
                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const itemId = e.target.getAttribute('data-id');
                            if(confirm('هل أنت متأكد من حذف هذه الوجبة؟')) {
                                fetch(`${dbURL}/${itemId}.json`, {
                                    method: 'DELETE'
                                }).then(() => loadMenuItems()); // تحديث الشاشة بعد الحذف
                            }
                        });
                    });
                }

            } else {
                container.innerHTML = '<p>القائمة فارغة حالياً.</p>';
            }
        })
        .catch(error => console.error("Error:", error));
}

// --- إضافة وجبة جديدة (خاص بلوحة الإدارة) ---
if (isAdminPage) {
    document.getElementById('addItemBtn').addEventListener('click', () => {
        const nameInput = document.getElementById('itemName').value;
        const priceInput = document.getElementById('itemPrice').value;

        if (nameInput && priceInput) {
            const btn = document.getElementById('addItemBtn');
            btn.innerText = 'جاري الإضافة...';
            
            fetch(dbURL + '.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameInput, price: priceInput })
            })
            .then(() => {
                document.getElementById('itemName').value = '';
                document.getElementById('itemPrice').value = '';
                btn.innerText = 'إضافة للقائمة';
                loadMenuItems(); // تحديث الشاشة لعرض الوجبة الجديدة
            });
        } else {
            alert('الرجاء إدخال اسم الوجبة والسعر');
        }
    });
}

// تشغيل عرض المنيو عند فتح الصفحة
loadMenuItems();
