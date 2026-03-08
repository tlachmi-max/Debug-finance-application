# 💰 Financial Planner v2 - הגרסה היציבה

מתכנן פיננסי מתקדם עם Excel מלא, גרפים ו-PWA.

## ✨ תכונות מלאות

### 💼 ניהול השקעות
- מסלולים מרובים עם תתי-מסלולים
- חישוב תשואה משוקללת
- דמי ניהול (הפקדה + צבירה)
- מיסוי וניכויים

### 🎯 יעדים
- יעד פרישה (קצבה חודשית)
- יעד הון עצמי
- יעדי חיים מרובים
- מפת דרכים למשיכות

### 📊 דוחות וגרפים
- דוח מסכם עם ממוצעים
- גרפים אינטראקטיביים
- תחזית לטווח ארוך
- ניתוח פערים

### 📥 Excel מלא
- **ייצוא:** 6 גליונות (השקעות, פרופיל, יעדים, מפת דרכים)
- **ייבוא:** טעינה מלאה של כל הנתונים
- תואם Excel וGoogle Sheets

### 📱 PWA
- עובד אופליין
- התקנה כאפליקציה
- עדכון אוטומטי

## 🚀 פריסה

### GitHub Pages

```bash
git clone [YOUR-REPO]
cd [REPO-NAME]

# העלה את כל הקבצים
git add .
git commit -m "v2 - Excel working"
git push

# הפעל Pages
Settings → Pages → main branch
```

### מקומי

```bash
python3 -m http.server 8000
# או פשוט פתח index.html
```

## 📋 קבצים

- `index.html` - ממשק המשתמש
- `script.js` - כל הלוגיקה
- `style.css` - עיצוב
- `service-worker.js` - PWA
- `manifest.json` - הגדרות PWA

## 🔧 תלויות

- **Chart.js** - גרפים (CDN)
- **SheetJS (XLSX)** - Excel (CDN)

שתיהן נטענות אוטומטית מה-HTML.

## ⚠️ דרישות

- דפדפן מודרני (Chrome, Firefox, Safari, Edge)
- JavaScript מופעל
- אינטרנט (לטעינת CDN בפעם הראשונה)

## 💾 שמירת נתונים

- **LocalStorage** - שמירה אוטומטית בדפדפן
- **Excel** - גיבוי ידני (ייצוא/ייבוא)

## 🐛 פתרון בעיות

### ייבוא Excel לא עובד
1. בדוק Console (F12)
2. ודא ש-XLSX נטען (חפש "xlsx" ב-Network)
3. נסה קובץ Excel פשוט קודם

### PWA לא מתעדכן
1. Settings → Application → Clear Storage
2. רענן (Ctrl+Shift+R)
3. התקן מחדש

## 📊 גרסה

**v2.0** - הגרסה היציבה הראשית

## 📄 רישיון

MIT License

---

🇮🇱 Made in Israel
