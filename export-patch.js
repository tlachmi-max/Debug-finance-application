// ============================================================
// export-patch.js — Extends the main "הורדת נתונים" Excel export
// to include the data added after script.js was written:
//   • plan.debts[]           ("החובות שלנו")
//   • plan.notes[]           ("תובנות והערות אישיות")
//   • profile.monthlyIncome  (missing from the Profile sheet)
//
// ★ Loaded AFTER script.js, debts.js and notes.js.
//
// WHY A FULL OVERRIDE (not a wrapper):
// The original exportExcel() in script.js builds its workbook
// AND calls XLSX.writeFile() in one synchronous block — the
// workbook object is a local variable with no exposed hook to
// append sheets to before the file is written. Wrapping it
// (calling the original, then trying to add sheets afterwards)
// is therefore not possible; the file would already be saved.
// The correct/least-fragile fix is to replace window.exportExcel
// with an extended version here, in a separate file, per the
// project's "never edit core files directly" convention. The 6
// original sheets are reproduced unchanged, with 2 new sheets
// appended and 1 field added to the existing Profile sheet.
// ============================================================

(function () {
    'use strict';

    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function exportExcelExtended() {
        var plan = getCurrentPlan();
        var profile = plan.profile;
        var goals = plan.goals;

        var wb = XLSX.utils.book_new();

        // ---- Sheet 1: Investments (unchanged from original) ----
        var invData = (plan.investments || []).map(function (inv) {
            return {
                'שם': inv.name,
                'סוג': inv.type,
                'בית השקעות': inv.house,
                'סכום נוכחי': inv.amount,
                'הפקדה חודשית': inv.monthly,
                'תשואה %': inv.returnRate,
                'מס %': inv.tax || 0,
                'דמי ניהול הפקדה %': inv.feeDeposit || 0,
                'דמי ניהול צבירה %': inv.feeAnnual || 0,
                'כלול': inv.include ? 'כן' : 'לא',
                'בן/בת זוג': inv.spouse || '',
                'גיל': inv.age || '',
                'מגדר': inv.gender || '',
                'תתי-מסלולים': inv.subTracks ? JSON.stringify(inv.subTracks) : ''
            };
        });
        var ws1 = XLSX.utils.json_to_sheet(invData);
        XLSX.utils.book_append_sheet(wb, ws1, 'מסלולי השקעה');

        // ---- Sheet 2: Profile — NOW INCLUDES monthlyIncome ----
        var profileData = [
            { 'שדה': 'שם משתמש', 'ערך': profile.user.name || '' },
            { 'שדה': 'גיל משתמש', 'ערך': profile.user.age || '' },
            { 'שדה': 'שם בן/בת זוג', 'ערך': profile.spouse.name || '' },
            { 'שדה': 'גיל בן/בת זוג', 'ערך': profile.spouse.age || '' },
            { 'שדה': 'הכנסה משפחתית חודשית נטו (₪)', 'ערך': profile.monthlyIncome || '' },
            { 'שדה': 'מספר ילדים', 'ערך': profile.children.length }
        ];
        (profile.children || []).forEach(function (child, i) {
            profileData.push({ 'שדה': 'ילד ' + (i + 1) + ' - שם', 'ערך': child.name });
            profileData.push({ 'שדה': 'ילד ' + (i + 1) + ' - גיל', 'ערך': child.age });
        });
        var ws2 = XLSX.utils.json_to_sheet(profileData);
        XLSX.utils.book_append_sheet(wb, ws2, 'פרופיל');

        // ---- Sheet 3: Goals - Retirement (unchanged) ----
        var retirementData = [{
            'סוג יעד': 'פרישה',
            'גיל משתמש': goals.retirement.userAge || '',
            'גיל בן/בת זוג': goals.retirement.spouseAge || '',
            'קצבה חודשית': goals.retirement.monthlyPension || '',
            'ערך ריאלי': goals.retirement.isRealValue ? 'כן' : 'לא'
        }];
        var ws3 = XLSX.utils.json_to_sheet(retirementData);
        XLSX.utils.book_append_sheet(wb, ws3, 'יעד פרישה');

        // ---- Sheet 4: Goals - Equity (unchanged) ----
        var equityData = [{
            'סוג יעד': 'הון עצמי',
            'סכום יעד': goals.equity.targetAmount || '',
            'שנת יעד': goals.equity.targetYear || ''
        }];
        var ws4 = XLSX.utils.json_to_sheet(equityData);
        XLSX.utils.book_append_sheet(wb, ws4, 'יעד הון');

        // ---- Sheet 5: Life Goals (unchanged) ----
        if (goals.lifeGoals && goals.lifeGoals.length > 0) {
            var lifeGoalsData = goals.lifeGoals.map(function (g) {
                return { 'שם': g.name, 'סכום': g.amount, 'שנה': g.year, 'ID': g.id || '' };
            });
            var ws5 = XLSX.utils.json_to_sheet(lifeGoalsData);
            XLSX.utils.book_append_sheet(wb, ws5, 'יעדי חיים');
        }

        // ---- Sheet 6: Roadmap / Withdrawals (unchanged) ----
        if (plan.withdrawals && plan.withdrawals.length > 0) {
            var withdrawalsData = plan.withdrawals.map(function (w) {
                return {
                    'שנה': w.year,
                    'סכום': w.amount,
                    'מטרה': w.goal || '',
                    'מקושר ליעד ID': w.goalId || '',
                    'פעיל': w.active === false ? 'לא' : 'כן'
                };
            });
            var ws6 = XLSX.utils.json_to_sheet(withdrawalsData);
            XLSX.utils.book_append_sheet(wb, ws6, 'מפת דרכים');
        }

        // ---- Sheet 7: NEW — Debts ("החובות שלנו") ----
        var debts = plan.debts || [];
        var debtsData = debts.map(function (d) {
            return {
                'סוג הלוואה': d.typeLabel || d.type || '',
                'יתרת הלוואה': d.amount || 0,
                'ריבית שנתית %': d.interestRate || 0,
                'תשלום חודשי': d.monthlyPayment || 0,
                'מועד סיום': d.endDate || ''
            };
        });
        if (debtsData.length === 0) {
            debtsData = [{ 'סוג הלוואה': '(אין הלוואות רשומות)', 'יתרת הלוואה': '', 'ריבית שנתית %': '', 'תשלום חודשי': '', 'מועד סיום': '' }];
        }
        var ws7 = XLSX.utils.json_to_sheet(debtsData);
        XLSX.utils.book_append_sheet(wb, ws7, 'החובות שלנו');

        // ---- Sheet 8: NEW — Notes ("תובנות והערות אישיות") ----
        var notes = plan.notes || [];
        var notesData = notes.map(function (n) {
            var created = n.createdAt ? new Date(n.createdAt).toLocaleString('he-IL') : '';
            var updated = n.updatedAt ? new Date(n.updatedAt).toLocaleString('he-IL') : '';
            return { 'תאריך כתיבה': created, 'תאריך עדכון אחרון': updated, 'תוכן ההערה': n.text || '' };
        });
        if (notesData.length === 0) {
            notesData = [{ 'תאריך כתיבה': '', 'תאריך עדכון אחרון': '', 'תוכן ההערה': '(אין הערות)' }];
        }
        var ws8 = XLSX.utils.json_to_sheet(notesData);
        XLSX.utils.book_append_sheet(wb, ws8, 'תובנות והערות');

        // ---- Filename (same convention as the original) ----
        var now = new Date();
        var filename = 'תוכנית_פיננסית_' + now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()) + '.xlsx';

        XLSX.writeFile(wb, filename);
        if (typeof showSaveNotification === 'function') {
            showSaveNotification('✅ הקובץ יוצא בהצלחה (כולל חובות, הערות והכנסה משפחתית)!');
        }
    }

    // Replace the original global function entirely.
    window.exportExcel = exportExcelExtended;

})();
