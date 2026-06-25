كاش توب - نسخة MongoDB مباشرة

تم تغيير طبقة قاعدة البيانات فقط من Firebase Realtime Database إلى MongoDB عبر API جاهز:
https://cash-top-api-2026.vercel.app/api/rtdb

لا تحتاج GitHub ولا Vercel جديد لهذه النسخة.
افتح index.html أو login.html من الملفات مباشرة أو ارفع الملفات على أي استضافة عادية.

مهم:
- لا يوجد أي باسورد MongoDB داخل هذه الملفات.
- الاتصال يتم عبر API الموجود بالفعل والذي نجح في تجربة الأسماء.
- تم الحفاظ على الواجهة والمهام كما هي قدر الإمكان، والتعديل كان على طبقة القراءة/الكتابة فقط.

مسارات البيانات في MongoDB تتبع نفس بنية Firebase السابقة، مثل:
companies/COMPANY001/branchesData/main/data/products
companies/COMPANY001/branchesData/main/data/invoices
