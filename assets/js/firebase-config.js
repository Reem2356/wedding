/* =========================================================
   firebase-config.js
   - عبّئي هذا الملف ببيانات مشروع Firebase الخاص بك حتى تصبح
     بيانات تجهيزات العرس محفوظة ومتزامنة بين كل من يفتح موقعك
     (على أي جهاز، بدون تسجيل دخول).
   - إذا تركتِه بلا تعبئة (FIREBASE_CONFIG = null) سيستمر
     الموقع بالعمل تمامًا، لكن البيانات تُحفظ على كل جهاز لوحده
     فقط (LocalStorage) بدون مزامنة بين الأجهزة.
   - خطوات الحصول على القيم موثقة في README.md تحت عنوان
     "الربط بـ Firebase".
   - ملاحظة: لا تضيفي هنا سطور import أو initializeApp —
     data.js يتولى تهيئة Firebase تلقائيًا باستخدام هذا الكائن.
   ========================================================= */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB58mVIGBf9eQfuYT3Rby2dIZOfDSOKvas",
  authDomain: "wedding-7c054.firebaseapp.com",
  projectId: "wedding-7c054",
  storageBucket: "wedding-7c054.firebasestorage.app",
  messagingSenderId: "740192936625",
  appId: "1:740192936625:web:8ba32af37519ba77edb890"
};