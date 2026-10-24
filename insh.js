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

// تهيئة Firebase
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
let isSyncingProcess = false;

let storeCategories = JSON.parse(localStorage.getItem('insh_categories') || '["السباكة", "الكهربائيات"]');
let storeProducts = JSON.parse(localStorage.getItem('insh_cached_products') || '[]');
let currentCart = [];
let pendingCarts = JSON.parse(localStorage.getItem('insh_pending_carts') || '[]');
let salesHistory = JSON.parse(localStorage.getItem('insh_sales_history') || '[]');
let debtsList = JSON.parse(localStorage.getItem('insh_debts') || '[]');
let expensesList = JSON.parse(localStorage.getItem('insh_expenses') || '[]');

let pendingDeleteProdKey = null;
let currentActiveCat = 'all';

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

function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const inputs = document.querySelectorAll('#login-section input');
    const identifier = inputs[0].value.trim();
    const password = inputs[1].value.trim();

    if (!identifier || !password) {
        showModal("تنبيه", "يرجى إدخال اسم المستخدم وكلمة المرور.");
        return false;
    }

    if (identifier === "ahmd" && password === "0") {
        showModal("أهلاً بك يا مدير المنصة", "جاري فتح لوحة التحكم لمالك المنصة...");
        toggleView('admin');
        return false;
    }

    // التحقق من حالة الاتصال بالإنترنت
    if (!navigator.onLine) {
        const localUser = JSON.parse(localStorage.getItem('active_insh_user'));
        if (localUser && (localUser.username === identifier || localUser.email === identifier) && localUser.password === password) {
            currentUser = localUser;
            showDashboardView(currentUser);
            showModal("وضع بدون إنترنت 📡", "تم تسجيل الدخول محلياً بنجاح في وضع عدم الاتصال.");
            return false;
        } else {
            showModal("بدون إنترنت", "يتطلب تسجيل الدخول لأول مرة الاتصال بالإنترنت.");
            return false;
        }
    }

    showModal("جاري التحقق...", "جاري الاتصال بقاعدة البيانات السحابية...");

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
                showDashboardView(user);
            } else {
                showModal("فشل الدخول", "كلمة المرور غير صحيحة.");
            }
        } else {
            showModal("فشل الدخول", "بيانات الدخول غير صحيحة، أو الحساب غير مسجل في المحلات الإنشائية.");
        }
    }).catch((error) => {
        closeModal();
        const localUser = JSON.parse(localStorage.getItem('active_insh_user'));
        if (localUser && localUser.password === password) {
            currentUser = localUser;
            showDashboardView(currentUser);
            showModal("وضع بدون إنترنت 📡", "تم التبديل لوضع العمل محلياً بنجاح.");
        } else {
            showModal("خطأ اتصال", "فشل الاتصال بقاعدة البيانات: " + error.message);
        }
    });

    return false;
}

function showDashboardView(user) {
    document.getElementById('auth-card').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'block';
    document.getElementById('disp-store-name').innerText = user.storeName;
    document.getElementById('disp-owner-name').innerText = "صاحب المحل: " + (user.ownerName || 'مالك المحل');
    
    loadCloudProducts();
    switchTab('pos');
}

// دالة جلب البيانات الذكية (ترفع التعديلات المحلية أولاً ثم تجلب المحدث)
function loadCloudProducts() {
    if (!currentUser) return;

    if (!navigator.onLine) {
        storeProducts = JSON.parse(localStorage.getItem('insh_cached_products') || '[]');
        if (document.getElementById('items-grid')) filterPOS(currentActiveCat);
        return;
    }

    if (isSyncingProcess) return;

    syncLocalProductsToCloud().then(() => {
        db.ref('products/' + currentUser.username).once('value').then((snapshot) => {
            storeProducts = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(key => {
                    storeProducts.push({ key: key, ...data[key] });
                });
            }
            localStorage.setItem('insh_cached_products', JSON.stringify(storeProducts));
            if (document.getElementById('items-grid')) {
                filterPOS(currentActiveCat);
            }
        }).catch((error) => {
            storeProducts = JSON.parse(localStorage.getItem('insh_cached_products') || '[]');
            if (document.getElementById('items-grid')) filterPOS(currentActiveCat);
        });
    });
}

// دالة رفع وتزامن التعديلات المحلية وإجبار السيرفر على الأرقام الحالية
async function syncLocalProductsToCloud() {
    if (!currentUser || !navigator.onLine) return;
    isSyncingProcess = true;
    
    const localProducts = JSON.parse(localStorage.getItem('insh_cached_products') || '[]');
    
    for (let p of localProducts) {
        if (p.key && !p.key.startsWith('local_')) {
            // تحديث كميات المواد بالسيرفر بالرقم المحلي المتبقي
            await db.ref(`products/${currentUser.username}/${p.key}/qty`).set(p.qty);
        } else if (p.key && p.key.startsWith('local_')) {
            // رفع المواد الجديدة المعلقة
            const newRef = db.ref(`products/${currentUser.username}`).push();
            const tempKey = p.key;
            delete p.key;
            await newRef.set(p);
            p.key = newRef.key;
        }
    }
    localStorage.setItem('insh_cached_products', JSON.stringify(localProducts));
    isSyncingProcess = false;
}

function handleRegister(e) {
    if (e && e.preventDefault) e.preventDefault();
    const inputs = document.querySelectorAll('#register-section input');
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
    return false;
}

function verifyOTP(e) {
    if (e && e.preventDefault) e.preventDefault();
    const enteredOTP = document.getElementById('otp-input').value.trim();

    if (enteredOTP === generatedOTP && pendingUserData) {
        showModal("جاري الحفظ...", "جاري تسجيل الحساب سحابياً في قاعدة البيانات...");
        
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
    return false;
}

function backToPOS() {
    switchTab('pos');
}

function switchTab(tab) {
    const area = document.getElementById('tab-content-area');
    if (document.getElementById('app-sidebar').classList.contains('active')) toggleSidebar();

    const backBtnHeader = (tab !== 'pos' && tab !== 'qr') ? `
        <div style="margin-bottom: 15px; text-align: left;">
            <button class="btn-submit" style="width: auto; padding: 8px 18px; background: #00d2ff; font-size: 13px;" onclick="backToPOS()">
                <i class="fa-solid fa-arrow-right"></i> الرجوع لشاشة البيع الفورية
            </button>
        </div>
    ` : '';

    if (tab === 'add-items') {
        area.innerHTML = `
            ${backBtnHeader}
            <div class="form-card" style="max-width:700px; margin:0 auto; text-align:right;">
                <h2>إدارة المواد والأقسام</h2>
                <div style="display:flex; gap:10px; margin: 15px 0;">
                    <button class="btn-submit" onclick="document.getElementById('box-cat').style.display='block'; document.getElementById('box-prod').style.display='none'; renderCategoryManagement();">إدارة الأقسام</button>
                    <button class="btn-submit" style="background:#00d2ff;" onclick="document.getElementById('box-cat').style.display='none'; document.getElementById('box-prod').style.display='block'; renderCatOptions();">إضافة مواد</button>
                </div>

                <div id="box-cat">
                    <div class="input-group"><label>اسم القسم الجديد (مثال: السباكة)</label><input type="text" id="cat-name-in"></div>
                    <button class="btn-submit" onclick="addCategory()">حفظ القسم الجديد</button>
                    <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">
                    <h3>الأقسام الحالية (تعديل / حذف)</h3>
                    <div id="categories-manage-list" style="margin-top: 10px;"></div>
                </div>

                <div id="box-prod" style="display:none;">
                    <div class="input-group"><label>اختر القسم</label><select id="prod-cat-select"></select></div>
                    <div class="input-group"><label>اسم المادة</label><input type="text" id="prod-name-in"></div>
                    <div class="input-group">
                        <label>وحدة البيع</label>
                        <select id="prod-unit-select">
                            <option value="قطعة">قطعة</option>
                            <option value="متر">متر</option>
                            <option value="كيس">كيس</option>
                            <option value="كارتون">كارتون</option>
                            <option value="طن">طن</option>
                            <option value="كغم">كغم</option>
                        </select>
                    </div>
                    <div class="input-group"><label>العدد المتوفر</label><input type="number" id="prod-qty-in"></div>
                    <div class="input-group"><label>السعر (د.ع)</label><input type="number" id="prod-price-in"></div>
                    <div class="input-group"><label>رقم الباركود (يدوي أو عبر القارئ)</label><input type="text" id="prod-barcode-in"></div>
                    <button class="btn-submit" onclick="saveProduct()">حفظ المادة واستمرار الإضافة</button>
                </div>
            </div>
        `;
        renderCategoryManagement();
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
    else if (tab === 'shortage') {
        area.innerHTML = `
            ${backBtnHeader}
            <div class="form-card" style="max-width:850px; margin:0 auto; text-align:right;">
                <h2><i class="fa-solid fa-boxes-packing" style="color:#f59e0b;"></i> قسم النقص والمواد المنتهية</h2>
                <p>قائمة بالمواد المنتهية والقليلة في المخزن لتزويد الكميات فوراً:</p>
                <div id="shortage-items-list" style="margin-top: 15px;"></div>
            </div>
        `;
        renderShortageDashboard();
    }
    else if (tab === 'pending') {
        let html = `${backBtnHeader}<div class="form-card" style="max-width:750px; margin:0 auto; text-align:right;"><h2>الفواتير المعلقة</h2>`;
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
            ${backBtnHeader}
            <div class="form-card" style="max-width:700px; margin:0 auto; text-align:right;">
                <h2>إدارة المرتجعات</h2>
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
            ${backBtnHeader}
            <div class="form-card" style="max-width:800px; margin:0 auto; text-align:right;">
                <h2>نظام التقسيط والديون</h2>
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
            ${backBtnHeader}
            <div class="form-card" style="max-width:700px; margin:0 auto; text-align:right;">
                <h2>تسديد الديون</h2>
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
            ${backBtnHeader}
            <div class="form-card" style="max-width:500px; margin:0 auto;">
                <h2>راديو أكد</h2>
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
            ${backBtnHeader}
            <div class="form-card" style="max-width:600px; margin:0 auto; text-align:right;">
                <h2>المصروفات</h2>
                <div class="input-group"><label>المبلغ المصروف (د.ع)</label><input type="number" id="exp-amount"></div>
                <div class="input-group"><label>على ماذا صرف (بيان المصروف)</label><input type="text" id="exp-note"></div>
                <button class="btn-submit" onclick="saveExpense()">حفظ المصروف</button>
            </div>
        `;
    }
    else if (tab === 'reports') {
        area.innerHTML = `
            ${backBtnHeader}
            <div class="form-card" style="max-width:750px; margin:0 auto; text-align:right;">
                <h2>نهاية العمل والتقارير</h2>
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
            ${backBtnHeader}
            <div class="form-card" style="max-width:650px; margin:0 auto; text-align:right;">
                <h2>إعدادات الحساب والبيانات</h2>
                <div class="input-group"><label>اسم المحل أو الشركة</label><input type="text" id="set-store-name" value="${currentUser ? currentUser.storeName : ''}"></div>
                <div class="input-group"><label>اسم مالك المحل</label><input type="text" id="set-owner-name" value="${currentUser ? currentUser.ownerName : ''}"></div>
                <div class="input-group"><label>البريد الإلكتروني</label><input type="email" id="set-email" value="${currentUser ? (currentUser.email || '') : ''}"></div>
                <div class="input-group"><label>اسم المستخدم (اليوزر)</label><input type="text" id="set-username" value="${currentUser ? currentUser.username : ''}" readonly style="opacity:0.6;"></div>
                
                <hr style="border-color: rgba(255,255,255,0.1); margin:15px 0;">
                
                <h3>النسخ الاحتياطي (JSON)</h3>
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <button type="button" class="btn-submit" style="background:#10b981;" onclick="exportDataJSON()"><i class="fa-solid fa-download"></i> تصدير نسخة احتياطية</button>
                    <button type="button" class="btn-submit" style="background:#8b5cf6;" onclick="document.getElementById('import-file-input').click()"><i class="fa-solid fa-upload"></i> استعادة نسخة</button>
                    <input type="file" id="import-file-input" accept=".json" style="display:none;" onchange="importDataJSON(event)">
                </div>

                <hr style="border-color: rgba(255,255,255,0.1); margin:15px 0;">
                <p style="font-size:12px; color:#f59e0b; margin-bottom:10px;">* تأكيد الهوية: يلزم كتابة كلمة المرور الحالية لتطبيق أي تغييرات على البيانات.</p>
                <div class="input-group"><label>كلمة المرور الحالية (مطلوبة للتحقق)</label><input type="password" id="set-old-pass" placeholder="••••••••"></div>
                <div class="input-group"><label>كلمة المرور الجديدة (اختياري)</label><input type="password" id="set-new-pass" placeholder="اتركه فارغاً إذا لا تريد تغييرها"></div>

                <button class="btn-submit" onclick="updateAccountSettings()">حفظ التعديلات السحابية</button>
            </div>
        `;
    }
    else if (tab === 'support') {
        area.innerHTML = `
            ${backBtnHeader}
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

function exportDataJSON() {
    const backupData = {
        categories: storeCategories,
        products: storeProducts,
        salesHistory: salesHistory,
        debts: debtsList,
        expenses: expensesList
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `insh_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.categories) localStorage.setItem('insh_categories', JSON.stringify(data.categories));
            if (data.salesHistory) localStorage.setItem('insh_sales_history', JSON.stringify(data.salesHistory));
            if (data.debts) localStorage.setItem('insh_debts', JSON.stringify(data.debts));
            if (data.expenses) localStorage.setItem('insh_expenses', JSON.stringify(data.expenses));
            showModal("تم الاسترجاع", "تم استعادة البيانات الاحتياطية بنجاح!");
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            showModal("خطأ", "فشل قراءة ملف النسخة الاحتياطية.");
        }
    };
    reader.readAsText(file);
}

function addCategory() {
    const val = document.getElementById('cat-name-in').value.trim();
    if (val && !storeCategories.includes(val)) {
        storeCategories.push(val);
        localStorage.setItem('insh_categories', JSON.stringify(storeCategories));
        showModal("تم الحفظ", `تم إضافة قسم (${val}) بنجاح.`);
        document.getElementById('cat-name-in').value = '';
        renderCategoryManagement();
    }
}

function renderCategoryManagement() {
    const container = document.getElementById('categories-manage-list');
    if (!container) return;
    container.innerHTML = "";

    storeCategories.forEach((cat, index) => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:8px;">
                <span style="font-weight:bold;">${cat}</span>
                <div style="display:flex; gap:8px;">
                    <button class="btn-qty" style="background:#00d2ff; color:#fff; padding:4px 10px;" onclick="editCategory(${index})"><i class="fa-solid fa-pen"></i> تعديل</button>
                    <button class="btn-qty" style="background:#ef4444; color:#fff; padding:4px 10px;" onclick="deleteCategory(${index})"><i class="fa-solid fa-trash"></i> حذف</button>
                </div>
            </div>
        `;
    });
}

function editCategory(index) {
    const oldName = storeCategories[index];
    const newName = prompt("أدخل الاسم الجديد للقسم:", oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        const cleanNewName = newName.trim();
        storeCategories[index] = cleanNewName;
        localStorage.setItem('insh_categories', JSON.stringify(storeCategories));

        if (currentUser && navigator.onLine) {
            storeProducts.forEach(p => {
                if (p.cat === oldName && p.key) {
                    db.ref(`products/${currentUser.username}/${p.key}/cat`).set(cleanNewName);
                }
            });
        }

        showModal("تم التعديل", `تم تغيير اسم القسم إلى (${cleanNewName}) بنجاح!`);
        renderCategoryManagement();
    }
}

function deleteCategory(index) {
    const catName = storeCategories[index];
    if (confirm(`هل أنت متأكد من رغبتك في حذف القسم (${catName})؟`)) {
        storeCategories.splice(index, 1);
        localStorage.setItem('insh_categories', JSON.stringify(storeCategories));
        showModal("تم الحذف", `تم حذف قسم (${catName}) بنجاح.`);
        renderCategoryManagement();
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
    const unit = document.getElementById('prod-unit-select') ? document.getElementById('prod-unit-select').value : 'قطعة';
    const qty = parseInt(document.getElementById('prod-qty-in').value || 0);
    const price = parseFloat(document.getElementById('prod-price-in').value || 0);
    const barcode = document.getElementById('prod-barcode-in').value.trim();

    if(!name || !price) {
        showModal("تنبيه", "يرجى ملء كافة البيانات الحيوية.");
        return;
    }

    const newProd = { key: 'local_' + Date.now(), cat, name, unit, qty, price, barcode };
    storeProducts.push(newProd);
    localStorage.setItem('insh_cached_products', JSON.stringify(storeProducts));

    if (currentUser && navigator.onLine) {
        db.ref('products/' + currentUser.username).push({ cat, name, unit, qty, price, barcode }).then(() => {
            showModal("تم الحفظ", `تم حفظ المادة (${name}) سحابياً ومحلياً!`);
        });
    } else {
        showModal("حفظ محلي", `تم حفظ المادة (${name}) محلياً في وضع عدم الاتصال.`);
    }

    document.getElementById('prod-name-in').value = '';
    document.getElementById('prod-qty-in').value = '';
    document.getElementById('prod-price-in').value = '';
    document.getElementById('prod-barcode-in').value = '';
}

function renderPOS() {
    const bar = document.getElementById('cats-bar');
    if (!bar) return;
    
    let html = `<button class="cat-btn ${currentActiveCat === 'all' ? 'active' : ''}" onclick="filterPOS('all')">الكل</button>`;
    storeCategories.forEach(c => {
        html += `<button class="cat-btn ${currentActiveCat === c ? 'active' : ''}" onclick="filterPOS('${c}')">${c}</button>`;
    });
    bar.innerHTML = html;
    filterPOS(currentActiveCat);
}

function renderItems(items) {
    const grid = document.getElementById('items-grid');
    if(!grid) return;
    grid.innerHTML = "";
    items.forEach(p => {
        const isLow = p.qty > 0 && p.qty < 5;
        grid.innerHTML += `
            <div class="item-card ${isLow ? 'low-stock-card' : ''}" style="position:relative;" onclick="addToCart('${p.name}', ${p.price})">
                <button class="delete-prod-btn" onclick="event.stopPropagation(); openDeleteProductModal('${p.key}', '${p.name}')" title="حذف المادة">✕</button>
                ${isLow ? '<span title="كمية منخفضة" style="position:absolute; top:5px; right:5px; color:#f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i></span>' : ''}
                <h4>${p.name}</h4>
                <p style="color:#f59e0b; font-weight:bold;">${p.price} د.ع</p>
                <span style="font-size:11px; color:${p.qty === 0 ? '#ef4444' : isLow ? '#f59e0b' : '#94a3b8'}; font-weight:${p.qty <= 5 ? 'bold' : 'normal'};">المتوفر: ${p.qty} ${p.unit || 'قطعة'}</span>
            </div>
        `;
    });
}

function filterPOS(cat) {
    currentActiveCat = cat;
    
    const bar = document.getElementById('cats-bar');
    if (bar) {
        const btns = bar.querySelectorAll('.cat-btn');
        btns.forEach(btn => {
            if ((cat === 'all' && btn.innerText === 'الكل') || btn.innerText === cat) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    if(cat === 'all') renderItems(storeProducts);
    else renderItems(storeProducts.filter(p => p.cat === cat));
}

function filterProductsByGlobalSearch() {
    const query = document.getElementById('global-search-input').value.trim().toLowerCase();
    if (!query) {
        filterPOS(currentActiveCat);
        return;
    }
    const filtered = storeProducts.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.barcode && p.barcode.toLowerCase().includes(query))
    );
    renderItems(filtered);
}

function openDeleteProductModal(prodKey, prodName) {
    pendingDeleteProdKey = prodKey;
    document.getElementById('delete-product-message').innerText = `هل أنت تأكد من رغبتك في حذف المادة (${prodName})؟`;
    document.getElementById('delete-product-modal').style.display = 'flex';

    document.getElementById('confirm-delete-prod-btn').onclick = function() {
        confirmDeleteProduct();
    };
}

function closeDeleteProductModal() {
    document.getElementById('delete-product-modal').style.display = 'none';
    pendingDeleteProdKey = null;
}

function confirmDeleteProduct() {
    if (pendingDeleteProdKey) {
        storeProducts = storeProducts.filter(p => p.key !== pendingDeleteProdKey);
        localStorage.setItem('insh_cached_products', JSON.stringify(storeProducts));

        if (currentUser && navigator.onLine && !pendingDeleteProdKey.startsWith('local_')) {
            db.ref(`products/${currentUser.username}/${pendingDeleteProdKey}`).remove();
        }
        
        closeDeleteProductModal();
        showModal("تم الحذف", "تم حذف المادة بنجاح.");
        filterPOS(currentActiveCat);
    }
}

function addToCart(name, price) {
    const prodMatch = storeProducts.find(p => p.name === name);
    if (!prodMatch) return;

    if (prodMatch.qty <= 0) {
        showModal("نفدت الكمية", `المادة (${name}) منتهية كلياً من المخزن ولا يمكن إضافتها للفاتورة.`);
        return;
    }

    const exist = currentCart.find(i => i.name === name);
    if(exist) {
        if (exist.qty + 1 > prodMatch.qty) {
            showModal("الكمية المتاحة فقط", `وصلت للحد الأقصى المتوفر لهذه المادة في المخزن (${prodMatch.qty} ${prodMatch.unit || 'قطعة'}).`);
            return;
        }
        exist.qty++;
    } else {
        currentCart.push({ name, price, qty: 1, unit: prodMatch.unit || 'قطعة', maxQty: prodMatch.qty });
    }
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
                <td>${item.name} (${item.unit})</td>
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
    const item = currentCart[idx];
    if (delta > 0 && item.qty + delta > item.maxQty) {
        showModal("الكمية المتاحة فقط", `الكمية المتوفرة في المخزن هي (${item.maxQty} ${item.unit}) فقط.`);
        return;
    }

    item.qty += delta;
    if(item.qty <= 0) currentCart.splice(idx, 1);
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

function confirmCheckoutAndPrintPDF(type = 'standard') {
    const cashier = document.getElementById('cashier-name-modal').value.trim() || "عام";
    const cust = document.getElementById('cust-name-in').value.trim() || "زبون عام";
    const total = document.getElementById('cart-total-val').innerText;
    const store = currentUser ? currentUser.storeName : "شركة المحلات الإنشائية";
    const owner = currentUser ? currentUser.ownerName : "المالك";

    currentCart.forEach(cartItem => {
        const prodMatch = storeProducts.find(p => p.name === cartItem.name);
        if (prodMatch) {
            prodMatch.qty = Math.max(0, prodMatch.qty - cartItem.qty);
            if (currentUser && navigator.onLine && prodMatch.key && !prodMatch.key.startsWith('local_')) {
                db.ref(`products/${currentUser.username}/${prodMatch.key}/qty`).set(prodMatch.qty);
            }
        }
    });

    localStorage.setItem('insh_cached_products', JSON.stringify(storeProducts));

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

    if (type === 'thermal') {
        let itemsHtml = saleObj.items.map(i => `
            <tr>
                <td style="text-align:right;">${i.name}</td>
                <td>${i.qty} ${i.unit}</td>
                <td>${i.price * i.qty}</td>
            </tr>
        `).join('');

        printWin.document.write(`
            <html dir="rtl" lang="ar">
            <head>
                <title>وصل كاشير - ${saleObj.id}</title>
                <style>
                    body { font-family: monospace; width: 78mm; margin: 0 auto; padding: 5px; direction: rtl; font-size: 12px; }
                    .center { text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
                    th, td { border-bottom: 1px dashed #000; padding: 4px 0; text-align: center; font-size: 11px; }
                    .total { font-weight: bold; font-size: 14px; margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; }
                    @media print { body { width: 100%; } }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="center">
                    <h3 style="margin:2px 0;">${store}</h3>
                    <p style="margin:2px 0; font-size:10px;">وصل تسليم مواد</p>
                    <p style="margin:2px 0; font-size:10px;">التاريخ: ${saleObj.date}</p>
                    <p style="margin:2px 0; font-size:10px;">الزبون: ${cust}</p>
                </div>
                <table>
                    <thead><tr><th style="text-align:right;">المادة</th><th>الكمية</th><th>المجموع</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div class="total center">المجموع: ${total} د.ع</div>
                <div class="center" style="margin-top:10px; font-size:10px;">شكراً لزيارتكم!</div>
            </body>
            </html>
        `);
    } else {
        let itemsHtml = saleObj.items.map(i => `<tr><td>${i.name}</td><td>${i.qty} ${i.unit}</td><td>${i.price} د.ع</td><td>${i.price * i.qty} د.ع</td></tr>`).join('');

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
                        <thead><tr><th>المادة</th><th>الكمية والوحدة</th><th>سعر المفرد</th><th>المجموع</th></tr></thead>
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
    }

    currentCart = [];
    renderCart();
    filterPOS(currentActiveCat);
}

function renderShortageDashboard() {
    const container = document.getElementById('shortage-items-list');
    if (!container) return;
    
    const shortageList = storeProducts.filter(p => p.qty <= 5);

    if (shortageList.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#34d399; font-weight:bold; margin:30px 0;">جميع المواد متوفرة حالياً في المخزن بأعداد جيدة!</p>`;
        return;
    }

    let html = `<table class="cart-table" style="width:100%; border-collapse:collapse;">
        <thead>
            <tr style="background:rgba(255,255,255,0.1);">
                <th style="padding:10px;">القسم</th>
                <th style="padding:10px;">المادة</th>
                <th style="padding:10px;">الكمية الحالية</th>
                <th style="padding:10px;">إضافة كمية جديدة</th>
            </tr>
        </thead>
        <tbody>`;

    shortageList.forEach(p => {
        const isZero = p.qty <= 0;
        html += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05); text-align:center;">
                <td style="padding:10px;"><span style="background:#d97706; padding:3px 8px; border-radius:5px; font-size:12px;">${p.cat}</span></td>
                <td style="padding:10px; font-weight:bold;">${p.name}</td>
                <td style="padding:10px; color:${isZero ? '#ef4444' : '#f59e0b'}; font-weight:bold;">${p.qty} ${p.unit || 'قطعة'} ${isZero ? '(منتهية)' : '(قليلة)'}</td>
                <td style="padding:10px; display:flex; gap:5px; justify-content:center;">
                    <input type="number" id="restock-qty-${p.key}" min="1" placeholder="العدد" style="width:70px; padding:5px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:#fff; text-align:center;">
                    <button class="btn-qty" style="background:#10b981; padding:5px 12px;" onclick="restockProductQuantity('${p.key}')">إضافة للمخزن</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function restockProductQuantity(prodKey) {
    const input = document.getElementById(`restock-qty-${prodKey}`);
    const addedQty = parseInt(input.value || 0);

    if (addedQty <= 0) {
        showModal("تنبيه", "يرجى كتابة عدد صحيح أكبر من الصفر.");
        return;
    }

    const prodMatch = storeProducts.find(p => p.key === prodKey);
    if (prodMatch) {
        prodMatch.qty += addedQty;
        localStorage.setItem('insh_cached_products', JSON.stringify(storeProducts));

        if (currentUser && navigator.onLine && !prodKey.startsWith('local_')) {
            db.ref(`products/${currentUser.username}/${prodKey}/qty`).set(prodMatch.qty);
        }

        showModal("تم التحديث", `تمت إضافة ${addedQty} ليكون المجموع الجديد (${prodMatch.qty})!`);
        renderShortageDashboard();
    }
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

function updateAccountSettings() {
    const name = document.getElementById('set-store-name').value.trim();
    const owner = document.getElementById('set-owner-name').value.trim();
    const email = document.getElementById('set-email').value.trim();
    const oldPass = document.getElementById('set-old-pass').value.trim();
    const newPass = document.getElementById('set-new-pass').value.trim();

    if (!oldPass) {
        showModal("التحقق مطلوب", "يرجى كتابة كلمة المرور الحالية لتأكيد حفظ التعديلات.");
        return;
    }

    if (currentUser && oldPass !== currentUser.password) {
        showModal("خطأ", "كلمة المرور الحالية غير صحيحة.");
        return;
    }

    currentUser.storeName = name;
    currentUser.ownerName = owner;
    currentUser.email = email;
    if (newPass) currentUser.password = newPass;

    localStorage.setItem('active_insh_user', JSON.stringify(currentUser));
    document.getElementById('disp-store-name').innerText = name;
    document.getElementById('disp-owner-name').innerText = "صاحب المحل: " + owner;

    if (navigator.onLine) {
        showModal("جاري الحفظ...", "جاري تحديث البيانات سحابياً ومحلياً...");
        db.ref('insh_users/' + currentUser.username).update(currentUser).then(() => {
            closeModal();
            document.getElementById('set-old-pass').value = '';
            document.getElementById('set-new-pass').value = '';
            showModal("تم التحديث السحابي", "تم تحديث بيانات الحساب والبريد وكلمة المرور بنجاح.");
        });
    } else {
        document.getElementById('set-old-pass').value = '';
        document.getElementById('set-new-pass').value = '';
        showModal("تحديث محلي", "تم تحديث بيانات الحساب محلياً في وضع عدم الاتصال.");
    }
}

function logoutSystem() {
    localStorage.removeItem('active_insh_user');
    currentUser = null;
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('auth-card').style.display = 'block';
    toggleView('login');
}

// المزامنة التلقائية الصارمة عند عودة الإنترنت
window.addEventListener('online', function() {
    showModal("عادت الشبكة 📡", "جاري تأكيد وتحديث أرقام المخزون سحابياً بآخر التعديلات...");
    if (currentUser) {
        loadCloudProducts();
    }
});

window.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('active_insh_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboardView(currentUser);
    }
});