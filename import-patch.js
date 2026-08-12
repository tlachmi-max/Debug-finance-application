// ============================================================
// import-patch.js — Extends the main "טעינת קובץ" Excel import
// to read back the data added after script.js was written:
//   • plan.debts[]           ("החובות שלנו")
//   • plan.notes[]           ("תובנות והערות אישיות")
//   • profile.monthlyIncome  (was silently skipped on import)
//
// ★ Loaded AFTER script.js, debts.js, notes.js and export-patch.js.
//
// WHY A FULL OVERRIDE (not a wrapper):
// The original importExcel() reads the file asynchronously
// (FileReader.onload) and does all parsing + saveData() +
// re-rendering inside that single callback, with no exposed
// hook to add more sheet-reading logic afterwards without
// re-reading the file a second time. The correct/least-fragile
// fix is to replace window.importExcel with an extended version
// here, in a separate file, per the project's "never edit core
// files directly" convention. All original sheet-import logic
// is reproduced unchanged, with debts/notes import added and
// the monthlyIncome field added to the profile-import loop.
// ============================================================

(function () {
    'use strict';

    function importExcelExtended(event) {
        var file = event.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = new Uint8Array(e.target.result);
                var workbook = XLSX.read(data, { type: 'array' });
                var plan = getCurrentPlan();
                var importedParts = [];

                // ---- Investments (unchanged) ----
                if (workbook.SheetNames.indexOf('מסלולי השקעה') !== -1) {
                    var invSheet = workbook.Sheets['מסלולי השקעה'];
                    var invData = XLSX.utils.sheet_to_json(invSheet);
                    plan.investments = invData.map(function (row) {
                        return {
                            name: row['שם'] || '',
                            type: row['סוג'] || 'אחר',
                            house: row['בית השקעות'] || 'לא מוגדר',
                            amount: parseFloat(row['סכום נוכחי']) || 0,
                            monthly: parseFloat(row['הפקדה חודשית']) || 0,
                            returnRate: parseFloat(row['תשואה %']) || 0,
                            tax: parseFloat(row['מס %']) || 0,
                            feeDeposit: parseFloat(row['דמי ניהול הפקדה %']) || 0,
                            feeAnnual: parseFloat(row['דמי ניהול צבירה %']) || 0,
                            include: row['כלול'] === 'כן',
                            spouse: row['בן/בת זוג'] || '',
                            age: parseInt(row['גיל'], 10) || null,
                            gender: row['מגדר'] || '',
                            subTracks: row['תתי-מסלולים'] ? JSON.parse(row['תתי-מסלולים']) : []
                        };
                    });
                    importedParts.push('השקעות');
                }

                // ---- Profile — NOW ALSO READS monthlyIncome ----
                if (workbook.SheetNames.indexOf('פרופיל') !== -1) {
                    var profileSheet = workbook.Sheets['פרופיל'];
                    var profileData = XLSX.utils.sheet_to_json(profileSheet);

                    profileData.forEach(function (row) {
                        var field = row['שדה'];
                        var value = row['ערך'];
                        if (!field) return;

                        if (field === 'שם משתמש') plan.profile.user.name = value;
                        if (field === 'גיל משתמש') plan.profile.user.age = parseInt(value, 10) || null;
                        if (field === 'שם בן/בת זוג') plan.profile.spouse.name = value;
                        if (field === 'גיל בן/בת זוג') plan.profile.spouse.age = parseInt(value, 10) || null;
                        if (field === 'הכנסה משפחתית חודשית נטו (₪)') {
                            var income = parseFloat(value);
                            plan.profile.monthlyIncome = (income > 0) ? income : null;
                        }

                        if (field.indexOf('ילד ') === 0) {
                            var match = field.match(/ילד (\d+) - (שם|גיל)/);
                            if (match) {
                                var index = parseInt(match[1], 10) - 1;
                                var prop = match[2];
                                if (!plan.profile.children[index]) {
                                    plan.profile.children[index] = { name: '', age: null };
                                }
                                if (prop === 'שם') plan.profile.children[index].name = value;
                                if (prop === 'גיל') plan.profile.children[index].age = parseInt(value, 10) || null;
                            }
                        }
                    });
                    importedParts.push('פרופיל (כולל הכנסה משפחתית)');
                }

                // ---- Retirement goal (unchanged) ----
                if (workbook.SheetNames.indexOf('יעד פרישה') !== -1) {
                    var retSheet = workbook.Sheets['יעד פרישה'];
                    var retData = XLSX.utils.sheet_to_json(retSheet);
                    if (retData.length > 0) {
                        var retRow = retData[0];
                        plan.goals.retirement.userAge = parseInt(retRow['גיל משתמש'], 10) || null;
                        plan.goals.retirement.spouseAge = parseInt(retRow['גיל בן/בת זוג'], 10) || null;
                        plan.goals.retirement.monthlyPension = parseFloat(retRow['קצבה חודשית']) || null;
                        plan.goals.retirement.isRealValue = retRow['ערך ריאלי'] === 'כן';
                    }
                }

                // ---- Equity goal (unchanged) ----
                if (workbook.SheetNames.indexOf('יעד הון') !== -1) {
                    var eqSheet = workbook.Sheets['יעד הון'];
                    var eqData = XLSX.utils.sheet_to_json(eqSheet);
                    if (eqData.length > 0) {
                        var eqRow = eqData[0];
                        plan.goals.equity.targetAmount = parseFloat(eqRow['סכום יעד']) || null;
                        plan.goals.equity.targetYear = parseInt(eqRow['שנת יעד'], 10) || null;
                    }
                }

                // ---- Life goals (unchanged) ----
                if (workbook.SheetNames.indexOf('יעדי חיים') !== -1) {
                    var lgSheet = workbook.Sheets['יעדי חיים'];
                    var lgData = XLSX.utils.sheet_to_json(lgSheet);
                    plan.goals.lifeGoals = lgData.map(function (row) {
                        return {
                            id: row['ID'] || (Date.now() + Math.random()),
                            name: row['שם'] || '',
                            amount: parseFloat(row['סכום']) || 0,
                            year: parseInt(row['שנה'], 10) || (new Date().getFullYear() + 10)
                        };
                    });
                }

                // ---- Roadmap / withdrawals (unchanged) ----
                if (workbook.SheetNames.indexOf('מפת דרכים') !== -1) {
                    var rmSheet = workbook.Sheets['מפת דרכים'];
                    var rmData = XLSX.utils.sheet_to_json(rmSheet);
                    plan.withdrawals = rmData.map(function (row) {
                        return {
                            year: parseInt(row['שנה'], 10) || new Date().getFullYear(),
                            amount: parseFloat(row['סכום']) || 0,
                            goal: row['מטרה'] || '',
                            goalId: row['מקושר ליעד ID'] || null,
                            active: row['פעיל'] !== 'לא'
                        };
                    });
                }

                // ---- NEW: Debts ("החובות שלנו") ----
                if (workbook.SheetNames.indexOf('החובות שלנו') !== -1) {
                    var debtsSheet = workbook.Sheets['החובות שלנו'];
                    var debtsData = XLSX.utils.sheet_to_json(debtsSheet);
                    plan.debts = debtsData
                        .filter(function (row) { return row['סוג הלוואה'] && row['סוג הלוואה'] !== '(אין הלוואות רשומות)'; })
                        .map(function (row) {
                            var typeLabel = row['סוג הלוואה'] || '';
                            var knownTypes = ['משכנתא', 'הלוואה צרכנית'];
                            var type = (knownTypes.indexOf(typeLabel) !== -1) ? typeLabel : 'אחר';
                            return {
                                type: type,
                                typeLabel: typeLabel,
                                amount: parseFloat(row['יתרת הלוואה']) || 0,
                                interestRate: parseFloat(row['ריבית שנתית %']) || 0,
                                monthlyPayment: parseFloat(row['תשלום חודשי']) || 0,
                                endDate: row['מועד סיום'] || ''
                            };
                        });
                    importedParts.push('החובות שלנו');
                }

                // ---- NEW: Notes ("תובנות והערות אישיות") ----
                if (workbook.SheetNames.indexOf('תובנות והערות') !== -1) {
                    var notesSheet = workbook.Sheets['תובנות והערות'];
                    var notesData = XLSX.utils.sheet_to_json(notesSheet);
                    plan.notes = notesData
                        .filter(function (row) { return row['תוכן ההערה'] && row['תוכן ההערה'] !== '(אין הערות)'; })
                        .map(function (row) {
                            var createdRaw = row['תאריך כתיבה'];
                            var updatedRaw = row['תאריך עדכון אחרון'];
                            var createdIso = createdRaw ? parseHeDateToIso(createdRaw) : new Date().toISOString();
                            var updatedIso = updatedRaw ? parseHeDateToIso(updatedRaw) : null;
                            return { text: row['תוכן ההערה'] || '', createdAt: createdIso, updatedAt: updatedIso };
                        });
                    importedParts.push('תובנות והערות');
                }

                saveData();
                syncLifeGoalsToRoadmap();
                renderWithdrawals();
                renderInvestments();
                renderSummary();
                if (typeof renderPensionTab === 'function') renderPensionTab();
                if (typeof renderDebts === 'function') renderDebts();
                if (typeof renderNotes === 'function') renderNotes();
                if (typeof renderIncomeField === 'function') renderIncomeField();
                if (typeof renderDashboard === 'function') renderDashboard();

                alert('✅ כל הנתונים יובאו בהצלחה!\n- ' + importedParts.join('\n- '));
            } catch (err) {
                console.error('Import error:', err);
                alert('❌ שגיאה בייבוא הקובץ: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }

    // Best-effort parser for he-IL locale date/time strings
    // (e.g. "12.8.2026, 14:30:00") back into an ISO string.
    // Falls back to "now" if the format can't be parsed, so a
    // note is never lost even if its exact timestamp can't be
    // recovered perfectly.
    function parseHeDateToIso(str) {
        try {
            var parts = String(str).split(',');
            var datePart = (parts[0] || '').trim();
            var timePart = (parts[1] || '').trim();
            var dateBits = datePart.split('.');
            if (dateBits.length !== 3) return new Date().toISOString();
            var day = parseInt(dateBits[0], 10);
            var month = parseInt(dateBits[1], 10) - 1;
            var year = parseInt(dateBits[2], 10);
            var timeBits = timePart ? timePart.split(':') : ['0', '0', '0'];
            var hours = parseInt(timeBits[0], 10) || 0;
            var minutes = parseInt(timeBits[1], 10) || 0;
            var seconds = parseInt(timeBits[2], 10) || 0;
            var d = new Date(year, month, day, hours, minutes, seconds);
            if (isNaN(d.getTime())) return new Date().toISOString();
            return d.toISOString();
        } catch (e) {
            return new Date().toISOString();
        }
    }

    // Replace the original global function entirely.
    window.importExcel = importExcelExtended;

})();
