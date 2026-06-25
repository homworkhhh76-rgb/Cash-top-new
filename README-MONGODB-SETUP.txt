إعداد MongoDB Atlas للمشروع
===========================

تم تعديل المشروع بحيث يستخدم MongoDB Atlas بدل Firebase Realtime Database، مع الحفاظ على نفس الواجهة والتصميم قدر الإمكان.

المتغيرات المطلوبة في Vercel:

1) MONGODB_URI
القيمة تكون بهذا الشكل:
mongodb+srv://amanwar:PUT_PASSWORD_HERE@cashtop.kp5nplk.mongodb.net/?retryWrites=true&w=majority&appName=Cashtop

ضع كلمة مرور MongoDB مكان PUT_PASSWORD_HERE داخل Vercel فقط.
لا تضع كلمة المرور داخل ملفات المشروع.

2) DB_NAME
cash

3) COLLECTION_NAME
yop

طريقة الإضافة في Vercel:
Project > Settings > Environment Variables
ثم أضف المتغيرات الثلاثة أعلاه، وبعدها اعمل Redeploy.

الملفات التي أضيفت/تعدلت لقاعدة البيانات:
- package.json: لإضافة مكتبة mongodb.
- api/rtdb.js: API وسيط يحاكي طريقة Firebase القديمة لكن يحفظ ويقرأ من MongoDB.
- ملفات HTML: تم تغيير رابط قاعدة البيانات الداخلي من Firebase إلى /api/rtdb فقط.

اختبار سريع بعد النشر:
افتح رابط موقعك على Vercel، ثم سجل دخولك وأنشئ أو عدل بيانات.
بعدها افتح MongoDB Atlas > Data Explorer > Database: cash > Collection: yop
ستجد سجلات محفوظة بمسارات path وقيم value.

ملاحظة:
هذا التعديل لا يضع رابط MongoDB ولا الباسورد في واجهة المستخدم. الاتصال الحقيقي بقاعدة البيانات يتم من api/rtdb.js على السيرفر.
