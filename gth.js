(function() {
    if (typeof emailjs !== 'undefined') emailjs.init("uTgm68bwdFaw8TWDL");
})();

let generatedOTP = "";
let pendingUserData = null;
const APP_KEY = "akd_gth_users";

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
    const card = document.getElementById('main-card');

    if (loginSec) loginSec.style.display = (view === 'login') ? 'block' : 'none';
    if (regSec) regSec.style.display = (view === 'register') ? 'block' : 'none';
    if (otpSec) otpSec.style.display = (view === 'otp') ? 'block' : 'none';

    if (adminSec) {
        adminSec.style.display = (view === 'admin') ? 'block' : 'none';
        if (view === 'admin') {
            card.classList.add('admin-card-wide');
            loadAdminPanel();
        } else {
            card.classList.remove('admin-card-wide');
        }
    }
}

function handleRegister(e) {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('input');
    const storeName = inputs[0].value;
    const ownerName = inputs[1].value;
    const email = document.getElementById('reg-email').value;
    const username = inputs[3].value;
    const password = inputs[4].value;

    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    pendingUserData = { storeName, ownerName, email, username, password, isBlocked: false, type: 'gth' };

    showModal("جاري الإرسال...", "جاري إرسال رمز التحقق إلى بريدك الإلكتروني...");

    const templateParams = {
        to_email: email,
        to_name: ownerName || storeName,
        otp_code: generatedOTP,
        service_name: "المحلات الغذائية - شبكة أكد",
        message: `رمز التحقق الخاص بك هو: ${generatedOTP}`
    };

    if (typeof emailjs !== 'undefined') {
        emailjs.send("service_b7hb4ac", "template_d8uu2gs", templateParams)
            .then(function() {
                showModal("تم الإرسال!", `تم إرسال رمز التحقق OTP بنجاح إلى بريدك الإلكتروني (${email}).`);
                toggleView('otp');
            }, function(error) {
                showModal("رمز التحقق", `رمز OTP التجريبي هو: ${generatedOTP}`);
                toggleView('otp');
            });
    } else {
        showModal("رمز التحقق", `رمز OTP التجريبي هو: ${generatedOTP}`);
        toggleView('otp');
    }
}

function verifyOTP(e) {
    e.preventDefault();
    const enteredOTP = document.getElementById('otp-input').value.trim();

    if (enteredOTP === generatedOTP && pendingUserData) {
        let users = JSON.parse(localStorage.getItem(APP_KEY) || "[]");
        const exists = users.some(u => u.username === pendingUserData.username || u.email === pendingUserData.email);

        if (exists) {
            showModal("حساب موجود", "هذا الحساب مسجل بالفعل في المحلات الغذائية.");
            return;
        }

        users.push(pendingUserData);
        localStorage.setItem(APP_KEY, JSON.stringify(users));

        showModal("تم التفعيل", "تم تفعيل حسابك بنجاح في بوابة المحلات الغذائية!");
        pendingUserData = null;
        toggleView('login');
    } else {
        showModal("رمز خاطئ", "رمز التحقق غير صحيح.");
    }
}

function handleLogin(e) {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('input');
    const identifier = inputs[0].value.trim();
    const password = inputs[1].value.trim();

    // حساب المالك الرئيسي للمنصة (ahmd / 0)
    if (identifier === "ahmd" && password === "0") {
        showModal("أهلاً بك يا مدير المنصة", "تم التعرف على مالك المنصة! جاري فتح لوحة التحكم الشاملة...");
        toggleView('admin');
        return;
    }

    let users = JSON.parse(localStorage.getItem(APP_KEY) || "[]");
    const user = users.find(u => (u.username === identifier || u.email === identifier) && u.password === password);

    if (user) {
        if (user.isBlocked) {
            showModal("حساب محظور 🚫", "نأسف، تم حظر هذا الحساب من قبل إدارة المنصة.");
            return;
        }
        showModal("أهلاً بك!", `تم تسجيل الدخول بنجاح للمحل الغذائي: (${user.storeName})`);
    } else {
        showModal("فشل الدخول", "بيانات الدخول غير صحيحة، أو الحساب غير مسجل في المحلات الغذائية.");
    }
}

function loadAdminPanel() {
    const listBody = document.getElementById('admin-users-list');
    let users = JSON.parse(localStorage.getItem(APP_KEY) || "[]");

    if (users.length === 0) {
        listBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">لا توجد حسابات مسجلة في المحلات الغذائية حالياً</td></tr>`;
        return;
    }

    listBody.innerHTML = "";
    users.forEach((u, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${u.storeName}</strong></td>
            <td>${u.ownerName || 'غير محدد'}</td>
            <td><code class="code-tag">${u.username}</code></td>
            <td><code class="code-tag pass">${u.password}</code></td>
            <td>
                <span class="badge ${u.isBlocked ? 'badge-danger' : 'badge-success'}">
                    ${u.isBlocked ? 'محظور 🚫' : 'نشط  نشط '}
                </span>
            </td>
            <td>
                <button class="btn-action ${u.isBlocked ? 'btn-unblock' : 'btn-block'}" onclick="toggleBlockUser(${index})">
                    ${u.isBlocked ? 'رفع الحظر' : 'حظر الحساب'}
                </button>
            </td>
        `;
        listBody.appendChild(row);
    });
}

function toggleBlockUser(index) {
    let users = JSON.parse(localStorage.getItem(APP_KEY) || "[]");
    users[index].isBlocked = !users[index].isBlocked;
    localStorage.setItem(APP_KEY, JSON.stringify(users));
    loadAdminPanel();
    showModal("تم التحديث", users[index].isBlocked ? "تم حظر الحساب بنجاح." : "تم رفع الحظر عن الحساب بنجاح.");
}