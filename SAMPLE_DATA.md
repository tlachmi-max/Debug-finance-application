# 📊 נתוני דוגמה לבדיקה

## איך להשתמש:

1. פתח Console בדפדפן (F12)
2. העתק את הקוד למטה
3. הדבק ב-Console
4. לחץ Enter
5. רענן את הדף (F5)

---

## דוגמה 1: משפחה עם 2 ילדים

```javascript
const sampleData = {
  "plans": {
    "plan_1": {
      "name": "תוכנית משפחת כהן",
      "investments": [
        {
          "name": "מיטב דש - מניות",
          "house": "מיטב דש",
          "type": "תיק עצמאי",
          "tax": 25,
          "amount": 150000,
          "monthly": 2000,
          "returnRate": 7,
          "feeDeposit": 0,
          "feeAnnual": 0.8,
          "forDream": false,
          "include": true,
          "subTracks": []
        },
        {
          "name": "מנורה - פנסיה",
          "house": "מנורה מבטחים",
          "type": "פנסיה",
          "tax": 0,
          "amount": 200000,
          "monthly": 1500,
          "returnRate": 5,
          "feeDeposit": 0.5,
          "feeAnnual": 0.5,
          "forDream": false,
          "include": true,
          "gender": "male",
          "age": 35,
          "spouse": "husband",
          "subTracks": []
        },
        {
          "name": "הראל - קרן השתלמות",
          "house": "הראל",
          "type": "קרן השתלמות",
          "tax": 0,
          "amount": 80000,
          "monthly": 800,
          "returnRate": 5,
          "feeDeposit": 0,
          "feeAnnual": 0.5,
          "forDream": false,
          "include": true,
          "subTracks": []
        }
      ],
      "withdrawals": [
        {
          "year": 2035,
          "amount": 300000,
          "goal": "לימודים ליובל",
          "active": true
        },
        {
          "year": 2040,
          "amount": 800000,
          "goal": "דירה ליובל",
          "active": true
        }
      ]
    }
  },
  "currentPlanId": "plan_1",
  "profile": {
    "maritalStatus": "married",
    "user": {
      "name": "צורי",
      "age": 35,
      "gender": "male"
    },
    "spouse": {
      "name": "שרה",
      "age": 33,
      "gender": "female"
    },
    "children": [
      {
        "id": "child_1",
        "name": "יובל",
        "age": 5,
        "birthYear": 2019
      },
      {
        "id": "child_2",
        "name": "תמר",
        "age": 2,
        "birthYear": 2022
      }
    ]
  }
};

localStorage.setItem('financial_planner_data', JSON.stringify(sampleData));
alert('✅ נתוני דוגמה נטענו! רענן את הדף (F5)');
```

---

## דוגמה 2: רווק עם תיק גדול

```javascript
const sampleData = {
  "plans": {
    "plan_1": {
      "name": "תוכנית אישית",
      "investments": [
        {
          "name": "פסגות - S&P 500",
          "house": "פסגות",
          "type": "תיק עצמאי",
          "tax": 25,
          "amount": 500000,
          "monthly": 5000,
          "returnRate": 8,
          "feeDeposit": 0,
          "feeAnnual": 0.4,
          "forDream": false,
          "include": true,
          "subTracks": [
            {
              "type": "S&P 500",
              "percent": 100,
              "returnRate": 8
            }
          ]
        },
        {
          "name": "אלטשולר - אג\"ח",
          "house": "אלטשולר שחם",
          "type": "קרן נאמנות",
          "tax": 25,
          "amount": 200000,
          "monthly": 0,
          "returnRate": 4,
          "feeDeposit": 0,
          "feeAnnual": 0.5,
          "forDream": false,
          "include": true,
          "subTracks": []
        },
        {
          "name": "מיטב דש - פנסיה",
          "house": "מיטב דש",
          "type": "פנסיה",
          "tax": 0,
          "amount": 300000,
          "monthly": 2000,
          "returnRate": 5,
          "feeDeposit": 0.5,
          "feeAnnual": 0.5,
          "forDream": false,
          "include": true,
          "gender": "male",
          "age": 40,
          "spouse": "husband",
          "subTracks": []
        }
      ],
      "withdrawals": []
    }
  },
  "currentPlanId": "plan_1",
  "profile": {
    "maritalStatus": "single",
    "user": {
      "name": "דן",
      "age": 40,
      "gender": "male"
    },
    "spouse": {
      "name": "",
      "age": null,
      "gender": "female"
    },
    "children": []
  }
};

localStorage.setItem('financial_planner_data', JSON.stringify(sampleData));
alert('✅ נתוני דוגמה נטענו! רענן את הדף (F5)');
```

---

## איפוס מלא

אם רוצה להתחיל מאפס:

```javascript
localStorage.removeItem('financial_planner_data');
alert('✅ כל הנתונים נמחקו! רענן את הדף (F5)');
```

---

## גיבוי הנתונים הנוכחיים

לפני שמשחקים עם נתוני דוגמה:

```javascript
const backup = localStorage.getItem('financial_planner_data');
console.log('=== BACKUP - העתק והדבק בקובץ טקסט ===');
console.log(backup);
console.log('=== סוף BACKUP ===');
```

## שחזור גיבוי

```javascript
const backup = `הדבק כאן את הגיבוי`;
localStorage.setItem('financial_planner_data', backup);
alert('✅ גיבוי שוחזר! רענן את הדף (F5)');
```
