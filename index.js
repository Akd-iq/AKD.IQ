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
  
  // تهيئة Firebase والوصول لقاعدة البيانات
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  
  // --- وظيفة إنشاء حساب جديد ورَفعه سحابياً ---
  function registerUser(username, password) {
    const userRef = db.ref('users/' + username);
    
    userRef.set({
      username: username,
      password: password,
      createdAt: new Date().toISOString()
    }).then(() => {
      alert("تم إنشاء الحساب بنجاح وهو متاح الآن من أي جهاز!");
    }).catch((error) => {
      alert("حدث خطأ في الحفظ: " + error.message);
    });
  }
  
  // --- وظيفة تسجيل الدخول بفحص قاعدة البيانات السحابية ---
  function loginUser(username, password) {
    const userRef = db.ref('users/' + username);
    
    userRef.once('value', (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.password === password) {
          alert("تم تسجيل الدخول بنجاح!");
          // تحويل المستخدم لصفحة النظام الرئيسي
          window.location.href = "dashboard.html"; 
        } else {
          alert("كلمة المرور غير صحيحة!");
        }
      } else {
        alert("اسم المستخدم غير موجود!");
      }
    });
  }




console.log("تم تحميل الصفحة الرئيسية لشبكة أكد بنجاح");