// إعدادات مفاتيح الاتصال الخاصة بمشروعك
const firebaseConfig = {
    apiKey: "AIzaSyBXYSWTdnmXUuFUs6QRHFmv1LVA9la_ITM",
    authDomain: "akdiq-3e5ed.firebaseapp.com",
    databaseURL: "https://akdiq-3e5ed-default-rtdb.firebaseio.com",
    projectId: "akdiq-3e5ed",
    storageBucket: "akdiq-3e5ed.firebasestorage.app",
    messagingSenderId: "1079649876802",
    appId: "1:1079649876802:web:64703c2de2503a587e26db",
    measurementId: "G-W7KFZ38LL8"
};

// تهيئة Firebase والوصول لقاعدة البيانات السحابية
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

(function() {
    if (typeof emailjs !== 'undefined') emailjs.init("uTgm68bwdFaw8TWDL");
})();

let generatedOTP = "";
let pendingUserData = null;
let currentUser = null;

// Kuusaa naannoo (LocalStorage) الخاصة بالبضائع والفواتير المحلية
let storeCategories = JSON.parse(localStorage.getItem('insh_categories') || '["السباكة", "الكهربائيات"]');
let storeProducts = JSON.parse(localStorage.getItem('insh_products') || '[]');
let currentCart = [];
let pendingCarts = JSON.parse(localStorage.getItem('insh_pending_carts') || '[]');
let salesHistory = JSON.parse(localStorage.getItem('insh_sales_history') || '[]');
let debtsList = JSON.parse(localStorage.getItem('insh_debts') || '[]');
let expensesList = JSON.parse(localStorage.getItem('insh_expenses') || '[]');

function showModal(title, message) {
    const modal = document.getElementById('custom-modal');
    if (modal) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-message').innerText = message;
        modal.style.display = 'flex';
    } else {
        alert(`${title}\n${message}`);
    }
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    if (modal) modal.style.display = 'none';
}

function toggleView(view) {
    const loginSec = document.getElementById('login-section');
    const regSec = document.getElementById('register-section');
    const otpSec = document.getElementById('otp-section');
    const adminSec = document.getElementById('admin-section');

    if (loginSec) loginSec.style.display = (view === 'login') ? 'block' : 'none';
    if (regSec) regSec.style.display = (view === 'register') ? 'block' : 'none';
    if (otpSec) otpSec.style.display = (view === 'otp') ? 'block' : 'none';

    if (adminSec) {
        adminSec.style.display = (view === 'admin') ? 'block' : 'none';
        if (view === 'admin') loadAdminPanel();
    }
}

function toggleSidebar() {
    document.getElementById('app-sidebar').classList.toggle('active');
}

function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', curr === 'light' ? 'dark' : 'light');
}

// 1. تسجيل الدخول بالسيرفر السحابي (Firebase)
function handleLogin(e) {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('input');
    const identifier = inputs[0].value.trim();
    const password = inputs[1].value.trim();

    if (identifier === "ahmd" && password === "0") {
        showModal("أهلاً بك يا مدير المنصة", "جاري فتح لوحة التحكم لمالك المنصة...");
        toggleView('admin');
        return;
    }

    showModal("جاري التحقق...", "جاري الاتصال بقاعدة البيانات السحابية...");

    // فحص الحساب في السحاب بأجهزة متعددة
    db.ref('insh_users/' + identifier).once('value').then((snapshot) => {
        closeModal();
        if (snapshot.exists()) {
            const user = snapshot.val();
            if (user.password === password) {
                if (user.isBlocked) {
                    showModal("حساب محظور 🚫", "تم حظر هذا الحساب من قبل مالك المنصة.");
                    return;
                }
                
                currentUser = user;
                localStorage.setItem('active_insh_user', JSON.stringify(user));

                if (!window.opener && window.name !== 'AkdAppWindow') {
                    const appWin = window.open(window.location.href, 'AkdAppWindow', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
                    if (appWin) {
                        window.close();
                        return;
                    }
                }
                
                showDashboardView(user);
            } else {
                showModal("فشل الدخول", "كلمة المرور غير صحيحة.");
            }
        } else {
            showModal("فشل الدخول", "بيانات الدخول غير صحيحة، أو الحساب غير مسجل في المحلات الإنشائية.");
        }
    }).catch((error) => {
        closeModal();
        showModal("خطأ اتصال", "فشل الاتصال بقاعدة البيانات: " + error.message);
    });
}

function showDashboardView(user) {
    document.getElementById('auth-card').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'block';
    document.getElementById('disp-store-name').innerText = user.storeName;
    document.getElementById('disp-owner-name').innerText = "صاحب المحل: " + (user.ownerName || 'مالك المحل');
    switchTab('pos');
    loadCloudProducts();
}

function handleRegister(e) {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('input');
    const storeName = inputs[0].value;
    const ownerName = inputs[1].value;
    const email = document.getElementById('reg-email').value;
    const username = inputs[3].value.trim();
    const password = inputs[4].value;

    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    pendingUserData = { storeName, ownerName, email, username, password, isBlocked: false, type: 'insh' };

    showModal("جاري الإرسال...", "جاري إرسال رمز التحقق إلى بريدك الإلكتروني...");

    const templateParams = {
        to_email: email,
        to_name: ownerName || storeName,
        otp_code: generatedOTP,
        service_name: "المحلات الإنشائية - شبكة أكد",
        message: `رمز التحقق الخاص بك هو: ${generatedOTP}`
    };

    if (typeof emailjs !== 'undefined') {
        emailjs.send("service_b7hb4ac", "template_d8uu2gs", templateParams)
            .then(function() {
                showModal("تم الإرسال!", `تم إرسال رمز التحقق OTP بنجاح إلى بريدك الإلكتروني (${email}).`);
                toggleView('otp');
            }, function() {
                showModal("رمز التحقق", `رمز OTP التجريبي لتفعيل الحساب هو: ${generatedOTP}`);
                toggleView('otp');
            });
    } else {
        showModal("رمز التحقق", `رمز OTP التجريبي هو: ${generatedOTP}`);
        toggleView('otp');
    }
}

// 2. تفعيل رمز OTP والحفظ المباشر في السحاب (Firebase)
function verifyOTP(e) {
    e.preventDefault();
    const enteredOTP = document.getElementById('otp-input').value.trim();

    if (enteredOTP === generatedOTP && pendingUserData) {
        showModal("جاري الحفظ...", "جاري تسجيل الحساب سحابياً في قاعدة البيانات...");
        
        // الحفظ المباشر في قاعدة البيانات السحابية (Firebase)
        db.ref('insh_users/' + pendingUserData.username).set(pendingUserData).then(() => {
            closeModal();
            showModal("تم التفعيل السحابي", "تم إنشاء وحفظ حسابك سحابياً بنجاح! يمكنك الآن تسجيل الدخول به من أي جهاز بآمان.");
            pendingUserData = null;
            toggleView('login');
        }).catch((error) => {
            closeModal();
            showModal("خطأ في الحفظ السحابي", error.message);
        });
    } else {
        showModal("رمز خاطئ", "رمز التحقق غير صحيح.");
    }
}

// Jigirraa fuulota 11
function switchTab(tab) {
    const area = document.getElementById('tab-content-area');
    if (document.getElementById('app-sidebar').classList.contains('active')) toggleSidebar();

    if (tab === 'add-items') {
        area.innerHTML = `
            <div class="form-card" style="max-width:650px; margin:0 auto; text-align:right;">
                <h2>1. إضافة مواد وأقسام</h2>
                <div style="display:flex; gap:10px; margin: 15px 0;">
                    <button class="btn-submit" onclick="document.getElementById('box-cat').style.display='block'; document.getElementById('box-prod').style.display='none';">إضافة قسم</button>
                    <button class="btn-submit" style="background:#00d2ff;" onclick="document.getElementById('box-cat').style.display='none'; document.getElementById('box-prod').style.display='block'; renderCatOptions();">إضافة مواد</button>
                </div>

                <div id="box-cat">
                    <div class="input-group"><label>اسم القسم الجديد (مثال: السباكة)</label><input type="text" id="cat-name-in"></div>
                    <button class="btn-submit" onclick="addCategory()">حفظ القسم</button>
                </div>

                <div id="box-prod" style="display:none;">
                    <div class="input-group"><label>اختر القسم</label><select id="prod-cat-select"></select></div>
                    <div class="input-group"><label>اسم المادة</label><input type="text" id="prod-name-in"></div>
                    <div class="input-group"><label>العدد المتوفر</label><input type="number" id="prod-qty-in"></div>
                    <div class="input-group"><label>السعر (د.ع)</label><input type="number" id="prod-price-in"></div>
                    <div class="input-group"><label>رقم الباركود (يدوي أو عبر القارئ)</label><input type="text" id="prod-barcode-in"></div>
                    <button class="btn-submit" onclick="saveProduct()">حفظ المادة واستمرار الإضافة</button>
                </div>
            </div>
        `;
    } 
    else if (tab === 'pos' || tab === 'qr') {
        area.innerHTML = `
            <div class="pos-container">
                <div class="pos-products">
                    <h3>الأقسام التفاعلية</h3>
                    <div class="categories-bar" id="cats-bar"></div>
                    <div class="items-grid" id="items-grid"></div>
                </div>
                <div class="cart-panel">
                    <h3>الفاتورة الحالية</h3>
                    <div class="input-group"><label>اسم الزبون</label><input type="text" id="cust-name-in" placeholder="اسم الزبون (اختياري)"></div>
                    <table class="cart-table">
                        <thead><tr><th>المادة</th><th>العدد</th><th>السعر</th><th>حذف</th></tr></thead>
                        <tbody id="cart-rows"></tbody>
                    </table>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                        <div class="input-group">
                            <label>نوع التعديل</label>
                            <select id="adj-type" onchange="renderCart()">
                                <option value="none">بدون تعديل (0%)</option>
                                <option value="discount">تخفيض (خصم %)</option>
                                <option value="markup">تحميل (زيادة %)</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label>النسبة المئوية (%)</label>
                            <input type="number" id="adj-rate" value="0" min="0" max="100" onkeyup="renderCart()" onchange="renderCart()">
                        </div>
                    </div>

                    <h4 style="margin: 15px 0;">الإجمالي النهائى: <span id="cart-total-val">0</span> د.ع</h4>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-submit" style="background:#64748b;" onclick="holdCart()">تعليق السلة</button>
                        <button class="btn-submit" onclick="openCashierModal()">حفظ وإتمام البيع</button>
                    </div>
                </div>
            </div>
        `;
        renderPOS();
    }
    else if (tab === 'pending') {
        let html = `<div class="form-card" style="max-width:750px; margin:0 auto; text-align:right;"><h2>5. الفواتير المعلقة</h2>`;
        if (pendingCarts.length === 0) {
            html += `<p style="text-align:center; margin:20px 0;">لا توجد فواتير معلقة حالياً.</p>`;
        } else {
            pendingCarts.forEach((c, idx) => {
                html += `
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong>الزبون: ${c.customer}</strong> - عدد المواد: ${c.items.length}
                        </div>
                        <button class="btn-submit" style="width:auto; padding:6px 15px;" onclick="restoreCart(${idx})">استرجاع الفاتورة</button>
                    </div>
                `;
            });
        }
        html += `</div>`;
        area.innerHTML = html;
    }
    else if (tab === 'returns') {
        area.innerHTML = `
            <div class="form-card" style="max-width:700px; margin:0 auto; text-align:right;">
                <h2>6. إدارة المرتجعات</h2>
                <div class="input-group">
                    <label>اكتب اسم الزبون للبحث عن فاتورته:</label>
                    <input type="text" id="search-cust-return" onkeyup="searchReturnInvoice()" placeholder="اسم الزبون...">
                </div>
                <div id="returns-result-box"></div>
            </div>
        `;
    }
    else if (tab === 'debts') {
        area.innerHTML = `
            <div class="form-card" style="max-width:800px; margin:0 auto; text-align:right;">
                <h2>7. نظام التقسيط والديون</h2>
                <button class="btn-submit" onclick="document.getElementById('add-debt-form').style.display='block'">+ إضافة مدين جديد</button>
                
                <div id="add-debt-form" style="display:none; margin-top:15px; background:rgba(0,0,0,0.3); padding:15px; border-radius:12px;">
                    <div class="input-group"><label>اسم المدين</label><input type="text" id="debtor-name"></div>
                    <div class="input-group"><label>المبلغ البذمة (د.ع)</label><input type="number" id="debtor-amount"></div>
                    <div class="input-group"><label>تاريخ الشراء</label><input type="date" id="debtor-date"></div>
                    <button class="btn-submit" onclick="saveNewDebtor()">حفظ المدين</button>
                </div>

                <h3 style="margin-top:20px;">قائمة المدينين</h3>
                <div id="debtors-list-box" style="margin-top:10px;"></div>
            </div>
        `;
        renderDebtors();
    }
    else if (tab === 'pay-debts') {
        area.innerHTML = `
            <div class="form-card" style="max-width:700px; margin:0 auto; text-align:right;">
                <h2>8. تسديد الديون</h2>
                <div class="input-group">
                    <label>اسم المدين للتسديد</label>
                    <input type="text" id="search-pay-debtor" onkeyup="searchPayDebtor()" placeholder="ابحث باسم المدين...">
                </div>
                <div id="pay-debtors-box"></div>
            </div>
        `;
    }
    else if (tab === 'radio') {
        area.innerHTML = `
            <div class="form-card" style="max-width:500px; margin:0 auto;">
                <h2>9. راديو أكد</h2>
                <p>اختر الخدمة الصوتية لتشغيلها أثناء العمل:</p>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top: 15px;">
                    <a href="https://m.soundcloud.com" target="_blank" class="btn-submit" style="background:#ff5500; text-decoration:none;">SoundCloud</a>
                    <a href="https://www.deezer.com/ar/" target="_blank" class="btn-submit" style="background:#a238ff; text-decoration:none;">Deezer</a>
                    <a href="https://www.youtube.com" target="_blank" class="btn-submit" style="background:#ff0000; text-decoration:none;">YouTube</a>
                </div>
            </div>
        `;
    }
    else if (tab === 'expenses') {
        area.innerHTML = `
            <div class="form-card" style="max-width:600px; margin:0 auto; text-align:right;">
                <h2>10. المصروفات</h2>
                <div class="input-group"><label>المبلغ المصروف (د.ع)</label><input type="number" id="exp-amount"></div>
                <div class="input-group"><label>على ماذا صرف (بيان المصروف)</label><input type="text" id="exp-note"></div>
                <button class="btn-submit" onclick="saveExpense()">حفظ المصروف</button>
            </div>
        `;
    }
    else if (tab === 'reports') {
        area.innerHTML = `
            <div class="form-card" style="max-width:750px; margin:0 auto; text-align:right;">
                <h2>11. نهاية العمل والتقارير</h2>
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <button class="btn-submit" onclick="generateReport('daily')">تقرير يومي</button>
                    <button class="btn-submit" style="background:#00d2ff;" onclick="generateReport('monthly')">تقرير شهري</button>
                    <button class="btn-submit" style="background:#8b5cf6;" onclick="generateReport('yearly')">تقرير سنوي</button>
                </div>
                <div class="input-group"><label>تحديد تاريخ معين (اختياري)</label><input type="date" id="report-custom-date" onchange="generateReport('custom')"></div>
                <div id="report-view-box" style="margin-top:20px; background:rgba(0,0,0,0.3); padding:15px; border-radius:12px;"></div>
            </div>
        `;
    }
    else if (tab === 'settings') {
        area.innerHTML = `
            <div class="form-card" style="max-width:600px; margin:0 auto; text-align:right;">
                <h2>إعدادات الحساب</h2>
                <div class="input-group"><label>اسم المحل أو الشركة</label><input type="text" id="set-store-name" value="${currentUser ? currentUser.storeName : ''}"></div>
                <div class="input-group"><label>اسم مالك المحل</label><input type="text" id="set-owner-name" value="${currentUser ? currentUser.ownerName : ''}"></div>
                <div class="input-group"><label>اسم المستخدم (اليوزر)</label><input type="text" id="set-username" value="${currentUser ? currentUser.username : ''}" readonly style="opacity:0.6;"></div>
                <div class="input-group"><label>كلمة السر القديمة</label><input type="password" id="set-old-pass"></div>
                <div class="input-group"><label>كلمة السر الجديدة</label><input type="password" id="set-new-pass"></div>

                <button class="btn-submit" onclick="updateAccountSettings()">حفظ التعديلات السحابية</button>
            </div>
        `;
    }
    else if (tab === 'support') {
        area.innerHTML = `
            <div class="form-card" style="max-width:500px; margin: 0 auto;">
                <h2>الدعم الفني والخدمات</h2>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top: 15px;">
                    <a href="https://www.facebook.com/share/18gFhoGmVm/" target="_blank" class="btn-submit" style="text-decoration:none;">الفيسبوك</a>
                    <a href="https://t.me/ac19y" target="_blank" class="btn-submit" style="background:#0088cc; text-decoration:none;">التليجرام (ac19y)</a>
                    <a href="https://www.instagram.com/25r.iq?obrf=Z2Z1cXcwZzd0YXoy" target="_blank" class="btn-submit" style="background:#e1306c; text-decoration:none;">الانستجرام</a>
                    <a href="https://wa.me/9647817711454" target="_blank" class="btn-submit" style="background:#25d366; text-decoration:none;">الواتساب (07817711454)</a>
                    <a href="https://akd-iq.github.io/Akd-iq/" target="_blank" class="btn-submit" style="background:#8b5cf6; text-decoration:none;">موقع أكد ستور</a>
                </div>
            </div>
        `;
    }
}

function addCategory() {
    const val = document.getElementById('cat-name-in').value.trim();
    if (val && !storeCategories.includes(val)) {
        storeCategories.push(val);
        localStorage.setItem('insh_categories', JSON.stringify(storeCategories));
        showModal("تم الحفظ", `تم إضافة قسم (${val}) بنجاح.`);
        document.getElementById('cat-name-in').value = '';
    }
}

function renderCatOptions() {
    const sel = document.getElementById('prod-cat-select');
    if(sel) {
        sel.innerHTML = "";
        storeCategories.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
    }
}

function saveProduct() {
    const cat = document.getElementById('prod-cat-select').value;
    const name = document.getElementById('prod-name-in').value.trim();
    const qty = parseInt(document.getElementById('prod-qty-in').value || 0);
    const price = parseFloat(document.getElementById('prod-price-in').value || 0);
    const barcode = document.getElementById('prod-barcode-in').value.trim();

    if(!name || !price) {
        showModal("تنبيه", "يرجى ملء كافة البيانات الحيوية.");
        return;
    }

    const newProd = { cat, name, qty, price, barcode };
    
    // حفظ المادة سحابياً تحت حساب المستخدم الحالي
    db.ref('products/' + currentUser.username).push(newProd).then(() => {
        showModal("تم الحفظ السحابي", تم حفظ المادة (${name}) سحابياً وستظهر في كافة الأجهزة!);
        document.getElementById('prod-name-in').value = '';
        document.getElementById('prod-qty-in').value = '';
        document.getElementById('prod-price-in').value = '';
        document.getElementById('prod-barcode-in').value = '';
        loadCloudProducts(); // إعادة تحصيل المنتجات
    });
}

function renderPOS() {
    const bar = document.getElementById('cats-bar');
    if (!bar) return;
    bar.innerHTML = `<button class="cat-btn active" onclick="filterPOS('all')">الكل</button>`;
    storeCategories.forEach(c => {
        bar.innerHTML += `<button class="cat-btn" onclick="filterPOS('${c}')">${c}</button>`;
    });
    renderItems(storeProducts);
}

function renderItems(items) {
    const grid = document.getElementById('items-grid');
    if(!grid) return;
    grid.innerHTML = "";
    items.forEach(p => {
        grid.innerHTML += `
            <div class="item-card" onclick="addToCart('${p.name}', ${p.price})">
                <h4>${p.name}</h4>
                <p style="color:#f59e0b; font-weight:bold;">${p.price} د.ع</p>
                <span style="font-size:11px; color:#94a3b8;">المتوفر: ${p.qty}</span>
            </div>
        `;
    });
}

function filterPOS(cat) {
    if(cat === 'all') renderItems(storeProducts);
    else renderItems(storeProducts.filter(p => p.cat === cat));
}

function addToCart(name, price) {
    const exist = currentCart.find(i => i.name === name);
    if(exist) exist.qty++;
    else currentCart.push({ name, price, qty: 1 });
    renderCart();
}

function renderCart() {
    const rows = document.getElementById('cart-rows');
    if(!rows) return;
    rows.innerHTML = "";
    let subtotal = 0;

    currentCart.forEach((item, idx) => {
        subtotal += item.price * item.qty;
        rows.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>
                    <button class="btn-qty" onclick="changeQty(${idx}, -1)">-</button>
                    ${item.qty}
                    <button class="btn-qty" onclick="changeQty(${idx}, 1)">+</button>
                </td>
                <td>${item.price * item.qty}</td>
                <td><button class="btn-qty" style="color:#f87171;" onclick="changeQty(${idx}, -${item.qty})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    });

    const adjType = document.getElementById('adj-type') ? document.getElementById('adj-type').value : 'none';
    const rate = parseFloat(document.getElementById('adj-rate') ? document.getElementById('adj-rate').value : 0) / 100;

    let grandTotal = subtotal;
    if (adjType === 'discount') grandTotal -= (subtotal * rate);
    else if (adjType === 'markup') grandTotal += (subtotal * rate);

    document.getElementById('cart-total-val').innerText = grandTotal.toFixed(0);
}

function changeQty(idx, delta) {
    currentCart[idx].qty += delta;
    if(currentCart[idx].qty <= 0) currentCart.splice(idx, 1);
    renderCart();
}

function openCashierModal() {
    if(currentCart.length === 0) {
        showModal("سلة فارغة", "يرجى إضافة مواد للفاتورة أولاً.");
        return;
    }
    document.getElementById('cashier-modal').style.display = 'flex';
}

function closeCashierModal() {
    document.getElementById('cashier-modal').style.display = 'none';
}

let currentSelectedDebtorId = null;

function confirmCheckoutAndPrintPDF() {
    const cashier = document.getElementById('cashier-name-modal').value.trim() || "عام";
    const cust = document.getElementById('cust-name-in').value.trim() || "زبون عام";
    const total = document.getElementById('cart-total-val').innerText;
    const store = currentUser ? currentUser.storeName : "شركة المحلات الإنشائية";
    const owner = currentUser ? currentUser.ownerName : "المالك";

    const saleObj = {
        id: Date.now(),
        customer: cust,
        total: parseFloat(total),
        items: [...currentCart],
        cashier: cashier,
        date: new Date().toLocaleString('ar-IQ')
    };

    salesHistory.push(saleObj);
    localStorage.setItem('insh_sales_history', JSON.stringify(salesHistory));
    closeCashierModal();

    let printWin = window.open('', '_blank');
    let itemsHtml = saleObj.items.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>${i.price} د.ع</td><td>${i.price * i.qty} د.ع</td></tr>`).join('');

    printWin.document.write(`
        <html dir="rtl" lang="ar">
        <head>
            <title>فاتورة وصل ضمان - شبكة أكد</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; color: #1e293b; background: #f8fafc; }
                .action-bar { max-width: 650px; margin: 0 auto 20px auto; display: flex; gap: 10px; justify-content: space-between; }
                .btn-print { background: #d97706; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
                .btn-close { background: #64748b; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
                .invoice-card { background: white; border: 2px solid #0f172a; border-radius: 12px; padding: 25px; max-width: 650px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 15px; }
                .header h1 { color: #d97706; margin: 0; font-size: 24px; }
                .header h3 { margin: 5px 0 0 0; color: #1e293b; }
                .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; margin-bottom: 15px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 13px; }
                th { background: #f1f5f9; }
                .total-box { text-align: left; font-size: 16px; font-weight: bold; margin-top: 15px; }
                .footer-seal { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; text-align: center; }
                @media print {
                    .action-bar { display: none !important; }
                    body { background: white; padding: 0; }
                    .invoice-card { border: 1px solid #000; box-shadow: none; }
                }
            </style>
        </head>
        <body>
            <div class="action-bar">
                <button class="btn-print" onclick="window.print()">🖨 طباعة / حفظ كـ PDF</button>
                <button class="btn-close" onclick="window.close()">إغلاق الصفحة</button>
            </div>
            <div class="invoice-card">
                <div class="header">
                    <h1>منصة شبكة أكد الموحدة</h1>
                    <h3>${store}</h3>
                    <p style="font-size:12px; color:#64748b;">إدارة المالك: ${owner}</p>
                </div>
                <div class="meta-grid">
                    <div><strong>رقم الفاتورة:</strong> ${saleObj.id}</div>
                    <div><strong>تاريخ البيع:</strong> ${saleObj.date}</div>
                    <div><strong>اسم الزبون:</strong> ${cust}</div>
                    <div><strong>المحاسب المسؤول:</strong> ${cashier}</div>
                </div>
                <table>
                    <thead><tr><th>المادة</th><th>الكمية</th><th>سعر المفرد</th><th>المجموع</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div class="total-box">المبلغ الإجمالي الكلي: ${total} دينار عراقي</div>
                <div class="footer-seal">
                    <div>توقيع الزبون/المشتري<br><br>...........................</div>
                    <div>توقيع وختم المحاسب<br><br>...........................</div>
                </div>
            </div>
        </body>
        </html>
    `);

    currentCart = [];
    renderCart();
}

function holdCart() {
    if(currentCart.length === 0) return;
    const cust = document.getElementById('cust-name-in').value || "زبون عام";
    pendingCarts.push({ id: Date.now(), customer: cust, items: [...currentCart] });
    localStorage.setItem('insh_pending_carts', JSON.stringify(pendingCarts));
    currentCart = [];
    renderCart();
    showModal("تعليق السلة", "تم تعليق الفاتورة بنجاح ويمكنك إكمالها من شاشة الفواتير المعلقة.");
}

function restoreCart(idx) {
    currentCart = [...pendingCarts[idx].items];
    pendingCarts.splice(idx, 1);
    localStorage.setItem('insh_pending_carts', JSON.stringify(pendingCarts));
    switchTab('pos');
    renderCart();
}

function searchReturnInvoice() {
    const query = document.getElementById('search-cust-return').value.trim().toLowerCase();
    const box = document.getElementById('returns-result-box');
    box.innerHTML = "";

    if (!query) return;

    const matched = salesHistory.filter(s => s.customer.toLowerCase().includes(query));
    if (matched.length === 0) {
        box.innerHTML = `<p style="margin-top:15px;">لا توجد فواتير مطابقة لاسم الزبون.</p>`;
        return;
    }

    matched.forEach((sale) => {
        box.innerHTML += `
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; margin-top:10px;">
                <h4>فاتورة رقم: ${sale.id} - الزبون: ${sale.customer}</h4>
                <p style="font-size:12px;">المجموع: ${sale.total} د.ع | التاريخ: ${sale.date}</p>
                <button class="btn-submit" style="width:auto; padding:6px 12px; margin-top:8px;" onclick="editReturnInvoice(${sale.id})">تعديل المرتجع</button>
            </div>
        `;
    });
}

function editReturnInvoice(saleId) {
    const sale = salesHistory.find(s => s.id === saleId);
    if (!sale) return;
    currentCart = [...sale.items];
    switchTab('pos');
    renderCart();
    showModal("مرتجع", "تم تحميل مواد الفاتورة إلى شاشة البيع للتعديل عليها وإصدار الاسترجاع.");
}

function saveNewDebtor() {
    const name = document.getElementById('debtor-name').value.trim();
    const amount = parseFloat(document.getElementById('debtor-amount').value || 0);
    const date = document.getElementById('debtor-date').value;

    if(!name || !amount) return;

    debtsList.push({ id: Date.now(), name, amount, date });
    localStorage.setItem('insh_debts', JSON.stringify(debtsList));
    showModal("تم الحفظ", `تم إضافة المدين (${name}) بالمبلغ (${amount} د.ع).`);
    renderDebtors();
}

function renderDebtors() {
    const box = document.getElementById('debtors-list-box');
    if(!box) return;
    box.innerHTML = "";

    debtsList.forEach(d => {
        box.innerHTML += `
            <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between;">
                <span><strong>${d.name}</strong> (تاريخ: ${d.date})</span>
                <span style="color:#f87171; font-weight:bold;">${d.amount} د.ع</span>
            </div>
        `;
    });
}

function searchPayDebtor() {
    const query = document.getElementById('search-pay-debtor').value.trim().toLowerCase();
    const box = document.getElementById('pay-debtors-box');
    box.innerHTML = "";

    if(!query) return;

    const matched = debtsList.filter(d => d.name.toLowerCase().includes(query));
    matched.forEach((d) => {
        box.innerHTML += `
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; margin-top:10px;">
                <h4>المدين: ${d.name}</h4>
                <p>المبلغ المتبقي: ${d.amount} د.ع</p>
                <button class="btn-submit" style="width:auto; padding:6px 15px; margin-top:8px;" onclick="payDebtorAmount('${d.id}')">تسديد دفعة وطباعة وصل PDF</button>
            </div>
        `;
    });
}

function payDebtorAmount(id) {
    const debtor = debtsList.find(d => d.id == id);
    if (!debtor) return;

    currentSelectedDebtorId = id;
    document.getElementById('pay-debt-info').innerText = `اسم المدين: (${debtor.name})\nالمبلغ المتبقي الأصلي: (${debtor.amount} د.ع)`;
    document.getElementById('pay-amount-input').value = '';
    document.getElementById('pay-debt-modal').style.display = 'flex';
}

function closePayDebtModal() {
    document.getElementById('pay-debt-modal').style.display = 'none';
    currentSelectedDebtorId = null;
}

function confirmPayDebtorAmount() {
    const debtor = debtsList.find(d => d.id == currentSelectedDebtorId);
    const pay = parseFloat(document.getElementById('pay-amount-input').value || 0);

    if (!debtor || pay <= 0) {
        showModal("تنبيه", "يرجى إدخال مبلغ تسديد صحيح.");
        return;
    }

    const prevAmount = debtor.amount;
    debtor.amount -= pay;
    if (debtor.amount <= 0) debtor.amount = 0;
    localStorage.setItem('insh_debts', JSON.stringify(debtsList));
    closePayDebtModal();

    let printWin = window.open('', '_blank');
    printWin.document.write(`
        <html dir="rtl" lang="ar">
        <head>
            <title>وصل تسديد دين رسمي - شبكة أكد</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; background: #f8fafc; color: #1e293b; }
                .action-bar { max-width: 550px; margin: 0 auto 20px auto; display: flex; gap: 10px; justify-content: space-between; }
                .btn-print { background: #d97706; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
                .btn-close { background: #64748b; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
                .card { background: white; border: 2px dashed #0f172a; padding: 25px; border-radius: 12px; max-width: 550px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                .header { text-align: center; border-bottom: 2px solid #d97706; padding-bottom: 10px; margin-bottom: 15px; }
                .row { margin: 10px 0; font-size: 15px; }
                .seal { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; }
                @media print {
                    .action-bar { display: none !important; }
                    body { background: white; padding: 0; }
                    .card { border: 1px dashed #000; box-shadow: none; }
                }
            </style>
        </head>
        <body>
            <div class="action-bar">
                <button class="btn-print" onclick="window.print()">🖨 طباعة / حفظ كـ PDF</button>
                <button class="btn-close" onclick="window.close()">إغلاق الصفحة</button>
            </div>
            <div class="card">
                <div class="header">
                    <h2>منصة أكد الموحدة - وصل قبض وتسديد</h2>
                    <p>${currentUser ? currentUser.storeName : "المركز الإنشائي"}</p>
                </div>
                <div class="row"><strong>اسم المسدد (الزبون):</strong> ${debtor.name}</div>
                <div class="row"><strong>المبلغ قبل التسديد:</strong> ${prevAmount} دينار عراقي</div>
                <div class="row"><strong>المبلغ المسدد الحالي:</strong> <span style="color:#16a34a; font-weight:bold;">${pay} دينار عراقي</span></div>
                <div class="row"><strong>المبلغ المتبقي بذمته:</strong> <span style="color:#dc2626; font-weight:bold;">${debtor.amount} دينار عراقي</span></div>
                <div class="row"><strong>تاريخ وساعة القبض:</strong> ${new Date().toLocaleString('ar-IQ')}</div>
                <div class="seal">
                    <div>توقيع الزبون/المسدد<br><br>.........................</div>
                    <div>توقيع وقبض المحاسب<br><br>.........................</div>
                </div>
            </div>
        </body>
        </html>
    `);

    searchPayDebtor();
}

function saveExpense() {
    const amount = parseFloat(document.getElementById('exp-amount').value || 0);
    const note = document.getElementById('exp-note').value.trim();

    if(!amount || !note) return;

    expensesList.push({ id: Date.now(), amount, note, date: new Date().toISOString() });
    localStorage.setItem('insh_expenses', JSON.stringify(expensesList));
    showModal("تم الحفظ", "تم تسجيل المصروف بنجاح.");
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-note').value = '';
}

function generateReport(type) {
    const box = document.getElementById('report-view-box');
    let totalSales = 0;
    let totalExpenses = 0;

    const now = new Date();
    let filterFn = () => true;

    if(type === 'daily') {
        filterFn = (d) => new Date(d).toDateString() === now.toDateString();
    } else if(type === 'monthly') {
        filterFn = (d) => new Date(d).getMonth() === now.getMonth() && new Date(d).getFullYear() === now.getFullYear();
    } else if(type === 'yearly') {
        filterFn = (d) => new Date(d).getFullYear() === now.getFullYear();
    } else if(type === 'custom') {
        const val = document.getElementById('report-custom-date').value;
        if(val) filterFn = (d) => new Date(d).toISOString().split('T')[0] === val;
    }

    salesHistory.filter(s => filterFn(s.date)).forEach(s => totalSales += s.total);
    expensesList.filter(e => filterFn(e.date)).forEach(e => totalExpenses += e.amount);

    box.innerHTML = `
        <h3>نتيجة التقرير (${type})</h3>
        <p>إجمالي المبيعات: <strong style="color:#34d399;">${totalSales} د.ع</strong></p>
        <p>إجمالي المصروفات: <strong style="color:#f87171;">${totalExpenses} د.ع</strong></p>
        <p>صافي الأرباح/الدخل: <strong>${totalSales - totalExpenses} د.ع</strong></p>
        <button class="btn-submit" style="margin-top:10px; background:#10b981;" onclick="printReportPDF('${type}', ${totalSales}, ${totalExpenses})">طباعة التقرير PDF</button>
    `;
}

function printReportPDF(type, sales, expenses) {
    let printWin = window.open('', '_blank');
    printWin.document.write(`
        <html dir="rtl" lang="ar">
        <head>
            <title>تقرير نهاية العمل - شبكة أكد</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 25px; background: #f8fafc; color: #1e293b; }
                .action-bar { max-width: 600px; margin: 0 auto 20px auto; display: flex; gap: 10px; justify-content: space-between; }
                .btn-print { background: #d97706; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
                .btn-close { background: #64748b; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
                .card { background: white; border: 2px solid #00d2ff; border-radius: 12px; padding: 25px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
                .row { margin: 12px 0; font-size: 15px; }
                @media print {
                    .action-bar { display: none !important; }
                    body { background: white; padding: 0; }
                    .card { border: 1px solid #000; box-shadow: none; }
                }
            </style>
        </head>
        <body>
            <div class="action-bar">
                <button class="btn-print" onclick="window.print()">🖨 طباعة / حفظ كـ PDF</button>
                <button class="btn-close" onclick="window.close()">إغلاق الصفحة</button>
            </div>
            <div class="card">
                <div class="header">
                    <h2>تقرير نظام أكد - (${type})</h2>
                    <p>${currentUser ? currentUser.storeName : 'المحل الإنشائي'}</p>
                </div>
                <div class="row"><strong>تاريخ التقرير:</strong> ${new Date().toLocaleString('ar-IQ')}</div>
                <div class="row"><strong>إجمالي مبيعات القطاع:</strong> <span style="color:#16a34a; font-weight:bold;">${sales} دينار عراقي</span></div>
                <div class="row"><strong>إجمالي المصروفات والنفقات:</strong> <span style="color:#dc2626; font-weight:bold;">${expenses} دينار عراقي</span></div>
                <div class="row"><strong>صافي الدخل الإجمالي:</strong> <strong>${sales - expenses} دينار عراقي</strong></div>
            </div>
        </body>
        </html>
    `);
}

// 3. تحديث بيانات الحساب سحابياً
function updateAccountSettings() {
    const name = document.getElementById('set-store-name').value;
    const owner = document.getElementById('set-owner-name').value;
    const oldPass = document.getElementById('set-old-pass').value;
    const newPass = document.getElementById('set-new-pass').value;

    if (currentUser && oldPass !== currentUser.password) {
        showModal("خطأ", "كلمة السر القديمة غير صحيحة.");
        return;
    }

    currentUser.storeName = name;
    currentUser.ownerName = owner;
    if(newPass) currentUser.password = newPass;

    showModal("جاري الحفظ...", "جاري تحديث البيانات سحابياً...");

    db.ref('insh_users/' + currentUser.username).update(currentUser).then(() => {
        closeModal();
        localStorage.setItem('active_insh_user', JSON.stringify(currentUser));
        document.getElementById('disp-store-name').innerText = name;
        document.getElementById('disp-owner-name').innerText = "صاحب المحل: " + owner;
        showModal("تم التحديث السحابي", "تم تحديث بيانات الحساب وكلمة المرور سحابياً بنجاح.");
    }).catch((err) => {
        closeModal();
        showModal("خطأ", err.message);
    });
}

function logoutSystem() {
    localStorage.removeItem('active_insh_user');
    currentUser = null;
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('auth-card').style.display = 'block';
    toggleView('login');
}

window.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('active_insh_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboardView(currentUser);
    }
});


function loadCloudProducts() {
    if (!currentUser) return;
    db.ref('products/' + currentUser.username).on('value', (snapshot) => {
        storeProducts = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                storeProducts.push(data[key]);
            });
        }
        if (document.getElementById('items-grid')) {
            renderPOS();
        }
    });
}