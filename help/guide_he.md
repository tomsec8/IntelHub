
<div dir="rtl">

# מדריך למשתמש - IntelHub 🕵️

ברוכים הבאים ל-IntelHub. תוסף זה מרכז כלי מודיעין גלוי (OSINT) מתקדמים בממשק אחד נוח, ומאפשר לחוקרים ואנליסטים לבצע פעולות במהירות וביעילות.

---

## 🏠 מבט על - הממשק הראשי
[cite_start]בחלקו העליון של התוסף מצד שמאל, קיים כפתור **Refresh** לרענון רשימת הכלים והגדרות התוסף[cite: 3].
[cite_start]מתחתיו מופיעה **שורת חיפוש** המאפשרת איתור מהיר של קטגוריות או כלים ספציפיים[cite: 3].
[cite_start]בצד ימין קיימת **גלילה** (Scroll) למעבר בין הקטגוריות השונות, ובפינה הימנית העליונה כפתור לשינוי **עיצוב התוסף** (Theme)[cite: 3].

![תפריט ראשי](../images/1.png)
![תפריט ראשי](../images/2.png)

---

## ⭐ Favorites - ניהול מועדפים
[cite_start]קטגוריה זו מרכזת את הכלים שסימנתם כ"מועדפים" מתוך מאגר הכלים הכללי, ומאפשרת הוספת כלים אישיים[cite: 6].

![מסך מועדפים](../images/favorites_menu.png)

### פעולות עיקריות:
* [cite_start]**New Category:** יצירת תיקיות/קטגוריות חדשות לסידור הכלים[cite: 7].
* **Add Custom Tool:** הוספת כלי חיצוני (שאינו קיים בתוסף) על ידי הזנת שם, כתובת URL ותיאור קצר. [cite_start]ניתן לשייך את הכלי לקטגוריה ספציפית לפני השמירה[cite: 8, 9].
* [cite_start]**Export/Import:** ייצוא וייבוא של רשימת המועדפים וההגדרות כקובץ גיבוי, או לצורך העברה למשתמש אחר[cite: 10].

![הוספת כלי מותאם אישית](../images/add_custom_tool.png)

**ניהול שוטף:**
למחיקת קטגוריה, לחצו על אייקון הפח בצד ימין. [cite_start]להסרת כלי מהמועדפים, לחצו על אייקון הכוכב (Unstar)[cite: 12].

---

## 🛠️ OSINT Tools - מאגר הכלים
קטגוריה זו מכילה את ליבת התוסף - רשימה מקיפה של כלי מודיעין המחולקת לנושאים. [cite_start]הרשימה מסונכרנת אוטומטית עם המאגר ב-GitHub ומתעדכנת כל 24 שעות[cite: 14, 15].

![רשימת כלי OSINT](../images/osint_tools_list.png)

* [cite_start]לחיצה על כלי תפתח אותו בכרטיסייה חדשה[cite: 17].
* [cite_start]לחיצה על הכוכב ליד שם הכלי תוסיף אותו ל"מועדפים"[cite: 17].
* [cite_start]ריחוף עם העכבר מעל כלי יציג תיאור קצר (Tooltip) של מהותו[cite: 18].

---

## 🖼️ Reverse Image Search - חיפוש תמונות הפוך
[cite_start]כלי זה מאפשר לבצע חיפוש על בסיס תמונה במגוון מנועי חיפוש במקביל (Google, Yandex, Bing, TinEye ועוד)[cite: 20].

![חיפוש תמונות](../images/reverse_image_search.png)

**אפשרויות הזנה:**
1.  [cite_start]**Upload:** העלאת קובץ תמונה מהמחשב[cite: 21].
2.  [cite_start]**Paste:** הדבקת תמונה ישירות מהלוח (Clipboard)[cite: 22].

*יש לסמן בתיבות הסימון באילו מנועים תרצו לחפש. [cite_start]הבחירה נשמרת לפעם הבאה[cite: 22, 23].*

---

## 📄 Metadata Analyzer - ניתוח מטא-דאטה
[cite_start]כלי לחילוץ מידע נסתר (Metadata/EXIF) מתוך קבצים[cite: 25].
[cite_start]יש לבחור את סוג הקובץ הרצוי (תמונה, PDF או מסמך Office) ולהעלות אותו[cite: 26]. [cite_start]דו"ח הנתונים יופיע מיד בתחתית החלון[cite: 27].

![תוצאות מטא-דאטה](../images/metadata_result.png)

---

## 🔍 Google Dorks - מחולל שאילתות
[cite_start]ממשק לבניית שאילתות חיפוש מתקדמות בגוגל בקלות[cite: 29].

![Google Dorks](../images/dorks_menu.png)

הזינו את הפרמטרים הרצויים בשדות השונים:
* [cite_start]**Site:** חיפוש בתוך אתר ספציפי[cite: 29].
* [cite_start]**Filetype:** חיפוש סוג קובץ מסוים (למשל pdf)[cite: 30].
* [cite_start]**In URL/Title/Text:** מילות מפתח בכתובת, בכותרת או בתוכן הדף[cite: 31, 32, 33].

[cite_start]בסיום, ניתן ללחוץ על **Search on Google** לביצוע החיפוש מיד, או **Copy Dork** להעתקת השאילתה ללוח[cite: 35].

---

## ✈️ Telegram Tools - כלי טלגרם
[cite_start]סט כלים לחקירה בטלגרם[cite: 36, 37]:

![כלי טלגרם](../images/telegram_tools.png)

* **User & Group Profiler:** הזנת שם משתמש (או לינק) לקבלת פרטים, תמונת פרופיל וסטטוס.
* **Fetch Numeric ID:** חילוץ המזהה החד-ערכי (Numeric ID) של המשתמש או הקבוצה (דורש חיבור ל-Telegram Web בדפדפן).
* **Phone Number Lookup:** ניסיון לאיתור פרופיל לפי מספר טלפון.

---

## 🌐 Site, Link & Archive
[cite_start]ריכוז כלים לניתוח הדף הנוכחי או כתובת URL[cite: 39]:

![ניתוח אתרים](../images/site_analysis.png)

1.  [cite_start]**Website Fingerprint:** זיהוי טכנולוגיות, Cookies ו-User Agents[cite: 40].
2.  [cite_start]**WHOIS & DNS:** בדיקת בעלות ורשומות DNS[cite: 41].
3.  [cite_start]**Subdomain Finder:** איתור תתי-דומיינים[cite: 43].
4.  [cite_start]**Save Page Offline:** שמירת הדף כקובץ HTML מקומי לתיעוד[cite: 44].
5.  [cite_start]**Link Analysis:** בדיקת קישורים מקוצרים (Unshorten) וסריקת וירוסים[cite: 51].
6.  [cite_start]**Archive Search:** חיפוש היסטוריית האתר בארכיונים[cite: 45].

---

## 🆔 Social ID Extractor
[cite_start]כלי לחילוץ ה-User ID (המזהה המספרי) מפרופילים ברשתות חברתיות, או למעבר לפרופיל על בסיס ID קיים[cite: 47, 48].

![חילוץ ID](../images/social_id.png)

---

## 📝 Text Profiler - ניתוח טקסט
כלי לסריקה וחילוץ ישויות (Entities) מתוך טקסט. [cite_start]המערכת מזהה מיילים, ארנקי קריפטו, טלפונים ועוד[cite: 53].
ניתן להדביק טקסט, להעלות קובץ, או לנתח את העמוד הנוכחי.

![פרופיילר טקסט](../images/text_profiler.png)

---

## 📊 Investigation Graph - גרף חקירות
כלי ויזואליזציה המאפשר ליצור מפה של החקירה. [cite_start]ניתן להוסיף ישויות, לקשר ביניהן באמצעות חיצים, ולראות את תמונת המודיעין בצורה גרפית[cite: 56].

![גרף חקירות](../images/graph_view.png)

</div>
