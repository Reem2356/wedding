/* =========================================================
   data.js
   - Storage Adapter (Interface) + مصدر البيانات الافتراضي
   - كل التعامل مع مصدر البيانات يمر من هنا فقط (DataStore)
     حتى يسهل لاحقًا استبدال LocalStorage بـ Firebase/Supabase
     دون تغيير أي كود آخر في المشروع.
   - إذا كانت الصفحة تعمل كـ Artifact ومتاحة لديها قدرة "db"
     المشتركة، تُستخدم كمصدر رئيسي متزامن بين كل من يفتح
     نفس الرابط، وتبقى LocalStorage كنسخة احتياطية محلية
     (Offline Cache) وكحل بديل عند عدم توفر db.
   ========================================================= */

const STORAGE_KEY = 'weddingPlannerData_v1';

/* ---------- 1) Storage Adapter Interface ----------
   أي Adapter (محلي أو مشترك) يجب أن يوفر:
   getAll() -> Promise<Object|null>
   setAll(data) -> Promise<void>
   subscribe(onRemoteChange)?  -> Unsubscribe   (اختياري، للمزامنة الحية)
------------------------------------------------------ */
const LocalStorageAdapter = {
  async getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('تعذر قراءة البيانات المحفوظة', e);
      return null;
    }
  },
  async setAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('تعذر حفظ البيانات', e);
    }
  }
};

/* ---------- 2) Shared Realtime Adapter (Artifact db) ----------
   يُبنى فقط عند توفر claude.use('db') لهذا العارض (Viewer)؛
   في حال عدم التوفر (صفحة خارج بيئة Artifact، أو عارض بدون صلاحية)
   يعود التطبيق تلقائيًا لـ LocalStorageAdapter (بيانات محلية فقط).
------------------------------------------------------ */
async function createSharedDbAdapter() {
  if (typeof window === 'undefined' || !window.claude || typeof window.claude.use !== 'function') {
    return null;
  }
  let db;
  try {
    db = await window.claude.use('db');
  } catch (e) {
    db = null;
  }
  if (!db) return null;

  const ref = db.doc('app/state');
  return {
    ref,
    async getAll() {
      try {
        const snap = await ref.get();
        return snap.exists ? snap.data() : null;
      } catch (e) {
        console.error('تعذر قراءة البيانات المشتركة', e);
        return null;
      }
    },
    async setAll(data) {
      await ref.set(data);
    },
    subscribe(onRemoteChange) {
      return ref.onSnapshot(
        (snap) => {
          if (snap.metadata && snap.metadata.hasPendingWrites) return;
          if (snap.exists) onRemoteChange(snap.data());
        },
        (err) => console.error('تعذر متابعة التحديثات المباشرة', err)
      );
    }
  };
}

/* ---------- 3) Shared Realtime Adapter (Firebase Firestore) ----------
   يُبنى فقط عند تعبئة assets/js/firebase-config.js ببيانات مشروع
   Firebase حقيقية، وعند نجاح تحميل مكتبة Firebase من CDN. هذا هو
   الخيار المناسب عند نشر الموقع على GitHub Pages / Cloudflare Pages
   (خارج بيئة Claude Artifact) للحصول على بيانات محفوظة ومتزامنة بين
   كل من يفتح الموقع. راجعي README.md لخطوات الإعداد.
------------------------------------------------------ */
async function createFirebaseAdapter() {
  if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG) return null;
  if (typeof firebase === 'undefined') return null;

  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const firestore = firebase.firestore();
    const ref = firestore.collection('weddingPlanner').doc('sharedState');

    return {
      ref,
      async getAll() {
        try {
          const snap = await ref.get();
          return snap.exists ? snap.data() : null;
        } catch (e) {
          console.error('تعذر قراءة البيانات من Firebase', e);
          return null;
        }
      },
      async setAll(data) {
        await ref.set(data);
      },
      subscribe(onRemoteChange) {
        return ref.onSnapshot(
          (snap) => {
            if (snap.metadata && snap.metadata.hasPendingWrites) return;
            if (snap.exists) onRemoteChange(snap.data());
          },
          (err) => console.error('تعذر متابعة تحديثات Firebase', err)
        );
      }
    };
  } catch (e) {
    console.error('تعذر تهيئة Firebase', e);
    return null;
  }
}

/* ---------- 2) الأقسام الافتراضية ---------- */
const DEFAULT_SECTIONS = [
  { id: 'venue', icon: '🏛️', name: 'القاعة والتنظيم' },
  { id: 'catering', icon: '☕', name: 'الضيافة والعشاء' },
  { id: 'photography', icon: '📸', name: 'التصوير والتوثيق' },
  { id: 'invitations', icon: '💌', name: 'الدعوات والضيوف' },
  { id: 'details', icon: '✨', name: 'التفاصيل' },
  { id: 'personal', icon: '👗', name: 'تجهيزي الشخصي' },
  { id: 'before', icon: '⏰', name: 'قبل العرس' }
];

/* ---------- 3) المهام الافتراضية ---------- */
const DEFAULT_TASK_TITLES = {
  venue: [
    'حجز القاعة', 'تجهيز وتنسيق القاعة', 'تنسيق المدخل', 'تنسيق الطاولات',
    'الورد والديكور', 'الدي جي', 'حارسة الجوالات', 'تنظيم الاستقبال',
    'تحديد المسؤولين عن التنظيم يوم العرس'
  ],
  catering: [
    'الحلويات', 'القهوة', 'الشاي', 'ركن القهوة', 'الذبائح', 'العشاء',
    'الضيافات', 'المياه والعصائر', 'كيكة الزواج', 'توزيعات وهدايا الضيوف'
  ],
  photography: [
    'المصورة', 'تصوير الفيديو', 'تحديد اللقطات المهمة',
    'مكان تصوير العائلة والعروسين'
  ],
  invitations: [
    'تصميم الدعوة', 'إرسال الدعوات', 'تأكيد الحضور', 'إعداد قائمة الضيوف',
    'ترتيب طاولات العائلة وكبار السن', 'تحديد المسؤولين عن استقبال الضيوف'
  ],
  details: [
    'تنسيق العطور', 'البخور والمباخر', 'مستلزمات دورات المياه',
    'تجهيز شنطة الطوارئ', 'شواحن وباور بانك',
    'مستلزمات الخياطة الطارئة', 'مستلزمات الإسعافات البسيطة'
  ],
  personal: [
    'الفستان', 'الحذاء', 'الشنطة', 'الإكسسوارات', 'المجوهرات', 'المكياج',
    'تسريحة الشعر', 'الأظافر', 'العطر', 'تجربة اللوك كامل', 'كي وتجهيز الفستان'
  ],
  before: [
    'التأكد من جميع الحجوزات', 'التأكد من موعد وصول العشاء',
    'التأكد من الحلويات', 'التواصل مع المصورة', 'التواصل مع الدي جي',
    'تجهيز المبالغ المتبقية للموردين', 'إعداد الجدول الزمني ليوم العرس',
    'توزيع المهام بين أفراد العائلة', 'تجهيز الأشياء التي ستُنقل إلى القاعة'
  ]
};

const DEFAULT_PEOPLE = ['ريم', 'مشاعل', 'جواهر', 'ملاك', 'الأم', 'سامر'];

const DEFAULT_TIMELINE = [
  { id: 't1', time: '10:00', title: 'استلام القاعة' },
  { id: 't2', time: '12:00', title: 'وصول التنسيق' },
  { id: 't3', time: '14:00', title: 'وصول الحلويات' },
  { id: 't4', time: '16:00', title: 'تجهيز القهوة' },
  { id: 't5', time: '17:00', title: 'وصول المصورة' },
  { id: 't6', time: '19:00', title: 'استقبال الضيوف' },
  { id: 't7', time: '21:00', title: 'دخول العروسين' }
];

const DEFAULT_EMERGENCY_KIT = [
  'إبر وخيط', 'دبابيس', 'لاصق ملابس', 'مناديل', 'عطر', 'مزيل عرق',
  'مسكن', 'لاصقات جروح', 'شاحن', 'Power Bank', 'مكياج للتعديل',
  'مثبت شعر', 'مشط', 'مناديل إزالة المكياج'
].map((name, i) => ({ id: 'kit' + (i + 1), name, checked: false }));

function genId(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function buildDefaultTasks() {
  const tasks = [];
  Object.entries(DEFAULT_TASK_TITLES).forEach(([sectionId, titles]) => {
    titles.forEach(title => {
      tasks.push({
        id: genId('task'),
        sectionId,
        title,
        assignee: '',
        phone: '',
        vendor: '',
        date: '',
        budgetExpected: 0,
        actualAmount: 0,
        paidAmount: 0,
        notes: '',
        status: 'not_started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  });
  return tasks;
}

function getDefaultData() {
  return {
    settings: {
      groomName: 'سامر',
      weddingDate: '',
      totalBudget: 0
    },
    sections: DEFAULT_SECTIONS,
    tasks: buildDefaultTasks(),
    people: DEFAULT_PEOPLE.slice(),
    timeline: DEFAULT_TIMELINE.map(t => ({ ...t })),
    emergencyKit: DEFAULT_EMERGENCY_KIT.map(k => ({ ...k }))
  };
}
