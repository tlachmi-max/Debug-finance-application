# 🚀 מדריך פריסה מהיר

## אופציה 1: GitHub Pages (מומלץ!)

### צעדים:
1. צור repository חדש ב-GitHub
2. העלה את כל הקבצים
3. הגדרות → Pages → Source: `main` branch → שמור
4. המתן 2-3 דקות
5. קבל URL: `https://username.github.io/repository-name`

### דוגמה:
```bash
cd financial-planner-v2
git init
git add .
git commit -m "Initial commit - v23"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

---

## אופציה 2: Netlify (קל ביותר!)

### צעדים:
1. היכנס ל-https://app.netlify.com
2. "Add new site" → "Deploy manually"
3. גרור את התיקייה `financial-planner-v2`
4. קבל URL מיד!

### או דרך Git:
1. חבר את ה-repository
2. Build settings: (השאר ריק - זה סטטי)
3. Deploy!

---

## אופציה 3: Vercel

### צעדים:
1. היכנס ל-https://vercel.com
2. "New Project"
3. Import Git Repository
4. Deploy!

---

## אופציה 4: בדיקה מקומית

### Python:
```bash
cd financial-planner-v2
python3 -m http.server 8000
# פתח: http://localhost:8000
```

### Node.js:
```bash
npm install -g serve
cd financial-planner-v2
serve .
# פתח: http://localhost:3000
```

### PHP:
```bash
cd financial-planner-v2
php -S localhost:8000
# פתח: http://localhost:8000
```

---

## ✅ בדיקה אחרי פריסה

1. פתח את ה-URL
2. בדוק שהאפליקציה נטענת
3. עבור לטאב "פרופיל"
4. מלא פרטים ושמור
5. רענן דף - וודא שהנתונים נשמרו
6. נסה להוסיף מסלול השקעה
7. ✅ עובד!

---

## 🐛 פתרון בעיות

### האפליקציה לא נטענת
- וודא ש-index.html נמצא בשורש
- בדוק את ה-Console (F12) לשגיאות

### PWA לא עובד
- צריך HTTPS (GitHub Pages/Netlify יש)
- בדוק ש-service-worker.js קיים

### נתונים לא נשמרים
- בדוק הרשאות cookies/localStorage
- נסה דפדפן אחר

---

## 📱 התקנה כאפליקציה

### אחרי פריסה:
1. פתח את ה-URL בדפדפן
2. Chrome: סמל ➕ → "התקן"
3. Safari: שיתוף → "הוסף למסך הבית"
4. ✅ עכשיו זה אפליקציה!

---

## 🔗 URL מומלץ

השתמש ב-custom domain (אופציונלי):
- GitHub Pages: Settings → Pages → Custom domain
- Netlify: Site settings → Domain management
- Vercel: Project settings → Domains

דוגמה: `financial-planner.yourdomain.com`
