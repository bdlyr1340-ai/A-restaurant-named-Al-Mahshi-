// استدعاء مكتبات فايربيز من الإنترنت مباشرة
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// الخطوة القادمة: ضع إعدادات الفايربيز الخاصة بك هنا
const firebaseConfig = {
  apiKey: "ضع_الكود_هنا",
  authDomain: "ضع_الكود_هنا",
  databaseURL: "ضع_رابط_قاعدة_البيانات_هنا",
  projectId: "ضع_الكود_هنا",
  storageBucket: "ضع_الكود_هنا",
  messagingSenderId: "ضع_الكود_هنا",
  appId: "ضع_الكود_هنا"
};

// تهيئة التطبيق وقاعدة البيانات
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const menuRef = ref(db, 'menuItems');

// --- حماية صفحة الإدارة بكلمة مرور بسيطة ---
const isAdminPage = window.location.pathname.includes('admin.html');
if (isAdminPage) {
    let pass = prompt("أدخل كلمة مرور المسؤول:");
    if (pass !== "12345") { // يمكنك تغيير كلمة المرور من هنا
        alert("كلمة المرور خاطئة!");
        window.location.href = "index.html";
    }
}

// --- جلب الوجبات وعرضها ---
onValue(menuRef, (snapshot) => {
    const data = snapshot.val();
    const container = document.getElementById(isAdminPage ? 'admin-menu-container' : 'menu-container');
    
    if (container) {
        container.innerHTML = ''; // تفريغ الحاوية قبل إعادة الرسم
        
        if (data) {
            Object.keys(data).forEach(key => {
                const item = data[key];
                const itemCard = document.createElement('div');
                itemCard.className = 'menu-item';
                
                let cardHTML = `
                    <h3>${item.name}</h3>
                    <div class="price">${item.price} د.ع</div>
                `;
                
                // إضافة زر الحذف إذا كنا في صفحة الإدارة
                if (isAdminPage) {
                    cardHTML += `<button class="delete-btn" data-id="${key}">حذف الوجبة</button>`;
                }
                
                itemCard.innerHTML = cardHTML;
                container.appendChild(itemCard);
            });

            // تفعيل أزرار الحذف في صفحة الإدارة
            if (isAdminPage) {
                document.querySelectorAll('.delete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const itemId = e.target.getAttribute('data-id');
                        remove(ref(db, `menuItems/${itemId}`));
                    });
                });
            }
        } else {
            container.innerHTML = '<p>القائمة فارغة حالياً.</p>';
        }
    }
});

// --- إضافة وجبة جديدة (خاص بصفحة الإدارة) ---
if (isAdminPage) {
    document.getElementById('addItemBtn').addEventListener('click', () => {
        const nameInput = document.getElementById('itemName').value;
        const priceInput = document.getElementById('itemPrice').value;

        if (nameInput && priceInput) {
            push(menuRef, {
                name: nameInput,
                price: priceInput
            }).then(() => {
                document.getElementById('itemName').value = '';
                document.getElementById('itemPrice').value = '';
            });
        } else {
            alert('الرجاء إدخال اسم الوجبة والسعر');
        }
    });
}

