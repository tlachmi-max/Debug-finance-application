// ============================================================
// cashflow.js — "תזרים חודשי" (Monthly Cash Flow) module
// ★ Loaded AFTER script.js, patch.js, glide.js,
//   pension-profile-fix.js, debts.js, notes.js
// ★ Adds: plan.cashflow.months[YYYY-MM] = {
//            income, variable, semiFixed, fixed, nonCashSavings
//          }  each an array of { id, name, planned, actual, linked }
// ============================================================
//
// DATA STRUCTURE
// ------------------------------------------------------------
// plan.cashflow = {
//   months: {
//     "2026-08": {
//       income:          [ { id, name, planned, actual, linked } ],
//       variable:        [ ... ],   // הוצאות משתנות
//       semiFixed:       [ ... ],   // הוצאות קבועות-משתנות
//       fixed:           [ ... ],   // הוצאות קבועות
//       nonCashSavings:  [ ... ]    // הוצאות לא תזרימיות / הפקדות
//     }
//   }
// }
//
// Each row: { id: string, name: string, planned: number,
//             actual: number, linked: string|null }
// "linked" holds a stable key (e.g. "debt:2", "inv:0") when the
// row was auto-imported from plan.debts[] / plan.investments[],
// so re-syncing never creates duplicates.
//
// Month keys are "YYYY-MM" strings, which sort correctly with a
// plain string comparison — used for history / "previous month".
// ============================================================

(function () {
    'use strict';

    // ------------------------------------------------------------
    // Category metadata
    // ------------------------------------------------------------
    var CF_ALL_CATS = ['income', 'variable', 'semiFixed', 'fixed', 'nonCashSavings'];
    var CF_EXPENSE_CATS = ['variable', 'semiFixed', 'fixed', 'nonCashSavings'];

    var CF_META = {
        income:         { label: 'הכנסות חודשיות',             icon: '💰', kind: 'income',  placeholder: 'לדוגמה: משכורת נטו' },
        variable:       { label: 'הוצאות משתנות',               icon: '🛒', kind: 'expense', placeholder: 'לדוגמה: מזון, פנאי, קניות' },
        semiFixed:      { label: 'הוצאות קבועות-משתנות',        icon: '⚡', kind: 'expense', placeholder: 'לדוגמה: חשמל, דלק/טעינה, מים' },
        fixed:          { label: 'הוצאות קבועות',               icon: '🏠', kind: 'expense', placeholder: 'לדוגמה: שכר דירה, הוראת קבע, מנוי' },
        nonCashSavings: { label: 'הוצאות לא תזרימיות / הפקדות', icon: '🏦', kind: 'expense', placeholder: 'לדוגמה: הפקדה לקרן השתלמות' }
    };

    var HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

    // ------------------------------------------------------------
    // Module state
    // ------------------------------------------------------------
    var cfCurrentMonth = null;   // 'YYYY-MM'
    var cfActiveTab = 'income';
    var cfEditingIndex = { income: -1, variable: -1, semiFixed: -1, fixed: -1, nonCashSavings: -1 };

    // ------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------
    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function genId() {
        return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function defaultMonthKey() {
        var d = new Date();
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    }

    function shiftMonthKey(key, delta) {
        var parts = key.split('-');
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) + delta;
        while (m < 1) { m += 12; y -= 1; }
        while (m > 12) { m -= 12; y += 1; }
        return y + '-' + pad2(m);
    }

    function formatMonthLabel(key) {
        var parts = key.split('-');
        var y = parts[0];
        var m = parseInt(parts[1], 10);
        return (HE_MONTHS[m - 1] || '') + ' ' + y;
    }

    function toast(msg) {
        if (typeof showSaveNotification === 'function') showSaveNotification(msg);
        else alert(msg);
    }

    function getCfCurrentMonthKey() {
        if (!cfCurrentMonth) cfCurrentMonth = defaultMonthKey();
        return cfCurrentMonth;
    }

    // ------------------------------------------------------------
    // Data model helpers
    // ------------------------------------------------------------
    function ensureCashflowRoot(plan) {
        if (!plan.cashflow) plan.cashflow = { months: {} };
        if (!plan.cashflow.months) plan.cashflow.months = {};
        return plan.cashflow;
    }

    function ensureCashflowMonth(plan, key) {
        var root = ensureCashflowRoot(plan);
        if (!root.months[key]) {
            root.months[key] = { income: [], variable: [], semiFixed: [], fixed: [], nonCashSavings: [] };
        }
        // Backfill any category missing on older saved months
        CF_ALL_CATS.forEach(function (c) {
            if (!root.months[key][c]) root.months[key][c] = [];
        });
        return root.months[key];
    }

    function monthHasAnyData(monthObj) {
        if (!monthObj) return false;
        return CF_ALL_CATS.some(function (c) { return (monthObj[c] || []).length > 0; });
    }

    function findLatestPriorMonthWithData(root, beforeKey) {
        var keys = Object.keys(root.months).filter(function (k) {
            return k < beforeKey && monthHasAnyData(root.months[k]);
        });
        if (keys.length === 0) return null;
        keys.sort();
        return keys[keys.length - 1];
    }

    // ------------------------------------------------------------
    // Totals
    // ------------------------------------------------------------
    function sumField(items, field) {
        var total = 0;
        (items || []).forEach(function (it) { total += (it[field] || 0); });
        return total;
    }

    function computeCategoryTotals(monthObj, cat) {
        var items = monthObj[cat] || [];
        return { planned: sumField(items, 'planned'), actual: sumField(items, 'actual') };
    }

    function computeMonthSummary(monthObj) {
        var incomeTotals = computeCategoryTotals(monthObj, 'income');
        var expensePlanned = 0, expenseActual = 0;
        var perCategory = {};
        CF_EXPENSE_CATS.forEach(function (cat) {
            var t = computeCategoryTotals(monthObj, cat);
            perCategory[cat] = t;
            expensePlanned += t.planned;
            expenseActual += t.actual;
        });
        return {
            income: incomeTotals,
            expensePlanned: expensePlanned,
            expenseActual: expenseActual,
            perCategory: perCategory,
            netPlanned: incomeTotals.planned - expensePlanned,
            netActual: incomeTotals.actual - expenseActual
        };
    }

    // ============================================================
    // RENDERING
    // ============================================================
    function renderCashflow() {
        var key = getCfCurrentMonthKey();
        var plan = getCurrentPlan();
        ensureCashflowMonth(plan, key);

        var labelEl = document.getElementById('cfMonthLabel');
        if (labelEl) labelEl.textContent = formatMonthLabel(key);
        var pickerEl = document.getElementById('cfMonthPicker');
        if (pickerEl) pickerEl.value = key;

        renderCfTabs();
        renderCfSummary();
        renderCfCategoryPanel();
    }
    window.renderCashflow = renderCashflow;

    function renderCfTabs() {
        var container = document.getElementById('cfTabs');
        if (!container) return;
        container.innerHTML = CF_ALL_CATS.map(function (cat) {
            var meta = CF_META[cat];
            var activeClass = (cat === cfActiveTab) ? ' active' : '';
            return '<button type="button" class="cf-tab' + activeClass + '" onclick="cfSwitchTab(\'' + cat + '\')">' + meta.icon + ' ' + meta.label + '</button>';
        }).join('');
    }

    function renderCfSummary() {
        var container = document.getElementById('cfSummaryCard');
        if (!container) return;
        var plan = getCurrentPlan();
        var monthObj = ensureCashflowMonth(plan, getCfCurrentMonthKey());
        var s = computeMonthSummary(monthObj);

        var netIsPositive = s.netActual >= 0;
        var netClass = netIsPositive ? 'positive' : 'negative';
        var netSub = 'צפי לחיסכון פנוי: ' + formatCurrency(s.netPlanned);

        var html = '';
        html += '<div class="cf-net-card ' + netClass + '">';
        html += '<div class="cf-net-label">💵 תזרים פנוי לחיסכון (בפועל)</div>';
        html += '<div class="cf-net-value">' + formatCurrency(s.netActual) + '</div>';
        html += '<div class="cf-net-sub">' + netSub + '</div>';
        html += '</div>';

        html += '<div class="cf-summary-grid">';
        html += '<div class="cf-stat-card"><div class="cf-stat-label">💰 הכנסות</div>';
        html += '<div class="cf-stat-row"><span>צפי</span><span>' + formatCurrency(s.income.planned) + '</span></div>';
        html += '<div class="cf-stat-row"><span>פועל</span><span>' + formatCurrency(s.income.actual) + '</span></div></div>';

        CF_EXPENSE_CATS.forEach(function (cat) {
            var meta = CF_META[cat];
            var t = s.perCategory[cat];
            html += '<div class="cf-stat-card"><div class="cf-stat-label">' + meta.icon + ' ' + meta.label + '</div>';
            html += '<div class="cf-stat-row"><span>צפי</span><span>' + formatCurrency(t.planned) + '</span></div>';
            html += '<div class="cf-stat-row"><span>פועל</span><span>' + formatCurrency(t.actual) + '</span></div></div>';
        });
        html += '</div>';

        container.innerHTML = html;
    }

    function cfDiffCellHtml(item, kind) {
        var planned = item.planned || 0;
        var actual = item.actual || 0;
        if (actual === 0 && planned !== 0) {
            return '<span style="color:var(--text-muted);">—</span>';
        }
        var diff = actual - planned;
        var isGood = (kind === 'income') ? (actual >= planned) : (actual <= planned);
        var color = isGood ? 'var(--success)' : 'var(--danger)';
        var sign = diff > 0 ? '+' : '';
        return '<span style="color:' + color + ';font-weight:700;">' + sign + formatCurrency(diff) + '</span>';
    }

    function renderCfCategoryPanel() {
        var container = document.getElementById('cfCategoryPanel');
        if (!container) return;
        var cat = cfActiveTab;
        var meta = CF_META[cat];
        var plan = getCurrentPlan();
        var monthObj = ensureCashflowMonth(plan, getCfCurrentMonthKey());
        var items = monthObj[cat] || [];

        // Update the add/edit form title + placeholder for this category
        var formTitle = document.getElementById('cfFormTitle');
        if (formTitle) formTitle.textContent = meta.icon + ' ' + meta.label;
        var nameInput = document.getElementById('cfItemName');
        if (nameInput && cfEditingIndex[cat] < 0) nameInput.placeholder = meta.placeholder;

        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">' + meta.icon + '</div><div class="empty-title">אין שורות ב"' + meta.label + '"</div><div class="empty-text">הוסיפו שורה ראשונה למעלה</div></div>';
            return;
        }

        var totals = computeCategoryTotals(monthObj, cat);

        var rowsHtml = items.map(function (item, i) {
            var linkedBadge = item.linked ? '<span class="cf-linked-badge">🔗 מסונכרן</span>' : '';
            return '' +
                '<tr>' +
                    '<td class="cf-item-name">' + linkedBadge + escapeHtmlCf(item.name) + '</td>' +
                    '<td>' + formatCurrency(item.planned || 0) + '</td>' +
                    '<td>' + formatCurrency(item.actual || 0) + '</td>' +
                    '<td>' + cfDiffCellHtml(item, meta.kind) + '</td>' +
                    '<td><div class="cf-row-actions">' +
                        '<button onclick="cfEditItem(\'' + cat + '\', ' + i + ')" title="ערוך">✏️</button>' +
                        '<button onclick="cfDeleteItem(\'' + cat + '\', ' + i + ')" title="מחק">🗑️</button>' +
                    '</div></td>' +
                '</tr>';
        }).join('');

        var html = '';
        html += '<div class="cf-table-wrap"><table class="cf-table">';
        html += '<thead><tr><th>שם</th><th>צפי</th><th>פועל</th><th>הפרש</th><th></th></tr></thead>';
        html += '<tbody>' + rowsHtml + '</tbody>';
        html += '<tfoot><tr><td>סה״כ</td><td>' + formatCurrency(totals.planned) + '</td><td>' + formatCurrency(totals.actual) + '</td><td colspan="2"></td></tr></tfoot>';
        html += '</table></div>';

        container.innerHTML = html;
    }

    function escapeHtmlCf(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ============================================================
    // TAB SWITCHING
    // ============================================================
    function cfSwitchTab(cat) {
        cfActiveTab = cat;
        cfCancelEdit();
        renderCfTabs();
        renderCfCategoryPanel();
    }
    window.cfSwitchTab = cfSwitchTab;

    // ============================================================
    // MONTH NAVIGATION
    // ============================================================
    function cfPrevMonth() {
        cfCurrentMonth = shiftMonthKey(getCfCurrentMonthKey(), -1);
        cfCancelEdit();
        renderCashflow();
    }
    window.cfPrevMonth = cfPrevMonth;

    function cfNextMonth() {
        cfCurrentMonth = shiftMonthKey(getCfCurrentMonthKey(), 1);
        cfCancelEdit();
        renderCashflow();
    }
    window.cfNextMonth = cfNextMonth;

    function cfSelectMonth(value) {
        if (!value) return;
        cfCurrentMonth = value;
        cfCancelEdit();
        renderCashflow();
    }
    window.cfSelectMonth = cfSelectMonth;

    // ============================================================
    // ROW CRUD
    // ============================================================
    function cfSaveItem() {
        var cat = cfActiveTab;
        var plan = getCurrentPlan();
        var monthObj = ensureCashflowMonth(plan, getCfCurrentMonthKey());
        var items = monthObj[cat];

        var nameEl = document.getElementById('cfItemName');
        var plannedEl = document.getElementById('cfItemPlanned');
        var actualEl = document.getElementById('cfItemActual');

        var name = (nameEl.value || '').trim();
        var planned = sanitizeNumber(plannedEl.value);
        var actual = sanitizeNumber(actualEl.value);

        if (!name) {
            alert('נא להזין שם לסעיף');
            return;
        }
        if (!planned && !actual) {
            alert('נא להזין סכום צפי ו/או פועל');
            return;
        }

        var editIndex = cfEditingIndex[cat];
        if (editIndex >= 0 && items[editIndex]) {
            items[editIndex].name = name;
            items[editIndex].planned = planned;
            items[editIndex].actual = actual;
            cfEditingIndex[cat] = -1;
        } else {
            items.push({ id: genId(), name: name, planned: planned, actual: actual, linked: null });
        }

        saveData();
        cfResetForm();
        renderCfSummary();
        renderCfCategoryPanel();
        toast('✅ הסעיף נשמר בהצלחה!');
    }
    window.cfSaveItem = cfSaveItem;

    function cfEditItem(cat, index) {
        var plan = getCurrentPlan();
        var monthObj = ensureCashflowMonth(plan, getCfCurrentMonthKey());
        var item = (monthObj[cat] || [])[index];
        if (!item) return;

        cfActiveTab = cat;
        renderCfTabs();

        var nameEl = document.getElementById('cfItemName');
        var plannedEl = document.getElementById('cfItemPlanned');
        var actualEl = document.getElementById('cfItemActual');
        if (nameEl) nameEl.value = item.name;
        if (plannedEl) plannedEl.value = item.planned || '';
        if (actualEl) actualEl.value = item.actual || '';

        cfEditingIndex[cat] = index;
        var saveText = document.getElementById('btnSaveCfText');
        if (saveText) saveText.textContent = 'עדכן שורה';
        var cancelBtn = document.getElementById('btnCancelCfEdit');
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';

        renderCfCategoryPanel();
        if (nameEl) { nameEl.focus(); nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
    window.cfEditItem = cfEditItem;

    function cfDeleteItem(cat, index) {
        if (!confirm('האם למחוק את הסעיף?')) return;
        var plan = getCurrentPlan();
        var monthObj = ensureCashflowMonth(plan, getCfCurrentMonthKey());
        (monthObj[cat] || []).splice(index, 1);
        if (cfEditingIndex[cat] === index) { cfEditingIndex[cat] = -1; cfResetForm(); }
        saveData();
        renderCfSummary();
        renderCfCategoryPanel();
    }
    window.cfDeleteItem = cfDeleteItem;

    function cfCancelEdit() {
        cfEditingIndex[cfActiveTab] = -1;
        cfResetForm();
    }
    window.cfCancelEdit = cfCancelEdit;

    function cfResetForm() {
        var nameEl = document.getElementById('cfItemName');
        var plannedEl = document.getElementById('cfItemPlanned');
        var actualEl = document.getElementById('cfItemActual');
        if (nameEl) nameEl.value = '';
        if (plannedEl) plannedEl.value = '';
        if (actualEl) actualEl.value = '';
        var saveText = document.getElementById('btnSaveCfText');
        if (saveText) saveText.textContent = 'שמור שורה';
        var cancelBtn = document.getElementById('btnCancelCfEdit');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    // ============================================================
    // COPY STRUCTURE FROM PREVIOUS MONTH
    // ============================================================
    function cfCopyFromPrevMonth() {
        var plan = getCurrentPlan();
        var root = ensureCashflowRoot(plan);
        var curKey = getCfCurrentMonthKey();
        var srcKey = findLatestPriorMonthWithData(root, curKey);

        if (!srcKey) {
            alert('לא נמצאו נתוני תזרים בחודשים קודמים לטעינה.');
            return;
        }

        var curMonthObj = ensureCashflowMonth(plan, curKey);
        if (monthHasAnyData(curMonthObj)) {
            var confirmMsg = 'קיימים נתונים בחודש הנוכחי (' + formatMonthLabel(curKey) + ').\nלטעון את מבנה הצפי מ' + formatMonthLabel(srcKey) + ' ולהחליף את הקיים?';
            if (!confirm(confirmMsg)) return;
        }

        var src = root.months[srcKey];
        var cloned = {};
        CF_ALL_CATS.forEach(function (cat) {
            cloned[cat] = (src[cat] || []).map(function (item) {
                return { id: genId(), name: item.name, planned: item.planned || 0, actual: 0, linked: item.linked || null };
            });
        });
        root.months[curKey] = cloned;

        saveData();
        cfCancelEdit();
        renderCashflow();
        toast('✅ מבנה התזרים הועתק מ' + formatMonthLabel(srcKey) + ' (הצפי הועתק, הפועל אופס)');
    }
    window.cfCopyFromPrevMonth = cfCopyFromPrevMonth;

    // ============================================================
    // SYNC FROM FIXED PLAN ITEMS (debts, recurring investments)
    // Avoids duplicates via the "linked" key on each row.
    // ============================================================
    function cfSyncFixedItems() {
        var plan = getCurrentPlan();
        var monthObj = ensureCashflowMonth(plan, getCfCurrentMonthKey());
        var addedCount = 0;

        // Loans / mortgages -> "הוצאות קבועות"
        var debts = plan.debts || [];
        debts.forEach(function (d, i) {
            if (!(d.monthlyPayment > 0)) return;
            var key = 'debt:' + i;
            var exists = monthObj.fixed.some(function (r) { return r.linked === key; });
            if (!exists) {
                monthObj.fixed.push({ id: genId(), name: '💳 ' + (d.typeLabel || 'הלוואה'), planned: d.monthlyPayment, actual: 0, linked: key });
                addedCount++;
            }
        });

        // Recurring investment deposits (non-pension) -> "הפקדות"
        var invs = plan.investments || [];
        invs.forEach(function (inv, i) {
            if (!inv.include || inv.type === 'פנסיה' || !(inv.monthly > 0)) return;
            var key = 'inv:' + i;
            var exists = monthObj.nonCashSavings.some(function (r) { return r.linked === key; });
            if (!exists) {
                monthObj.nonCashSavings.push({ id: genId(), name: '📈 ' + inv.name, planned: inv.monthly, actual: 0, linked: key });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            saveData();
            renderCfSummary();
            renderCfCategoryPanel();
            toast('✅ יובאו ' + addedCount + ' סעיפים מנתוני התוכנית');
        } else {
            toast('ℹ️ אין סעיפים חדשים לסנכרון — הכל כבר מעודכן');
        }
    }
    window.cfSyncFixedItems = cfSyncFixedItems;

    // ============================================================
    // EXPORT — HTML REPORT
    // ============================================================
    function cfExportHTML() {
        var plan = getCurrentPlan();
        var key = getCfCurrentMonthKey();
        var monthObj = ensureCashflowMonth(plan, key);
        var s = computeMonthSummary(monthObj);
        var monthLabel = formatMonthLabel(key);

        var w = window.open('', '_blank');
        if (!w) { alert('נא לאפשר חלונות קופצים כדי להפיק את הדוח'); return; }

        w.document.write('<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>תזרים חודשי - ' + monthLabel + ' — בנחת</title>');
        w.document.write('<style>');
        w.document.write('body{font-family:Arial,Heebo,sans-serif;padding:40px;background:#F3FAF5;color:#1f2937}');
        w.document.write('.container{max-width:1100px;margin:0 auto;background:#fff;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}');
        w.document.write('.report-brand{display:flex;align-items:center;gap:8px;margin-bottom:6px;color:#0C3D22;font-weight:800;font-size:1.05em}');
        w.document.write('h1{font-size:2.2em;border-bottom:4px solid #0C3D22;padding-bottom:16px;margin-bottom:8px}');
        w.document.write('.sub{color:#6b7280;margin-bottom:28px}');
        w.document.write('h2{color:#0C3D22;font-size:1.4em;margin:30px 0 12px;padding-right:12px;border-right:4px solid #A3E64B}');
        w.document.write('.net-card{border-radius:14px;padding:22px 26px;color:#fff;margin-bottom:24px}');
        w.document.write('.net-pos{background:linear-gradient(135deg,#059669,#10b981)}.net-neg{background:linear-gradient(135deg,#dc2626,#ef4444)}');
        w.document.write('.net-label{font-size:0.9em;opacity:0.9;margin-bottom:6px}.net-val{font-size:2em;font-weight:800}');
        w.document.write('table{width:100%;border-collapse:collapse;margin:14px 0 26px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}');
        w.document.write('th{background:#0C3D22;color:#fff;padding:12px 14px;text-align:right;font-weight:600;font-size:0.9em}');
        w.document.write('td{padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:0.92em}');
        w.document.write('tfoot td{font-weight:800;background:#F3FAF5}');
        w.document.write('.good{color:#059669;font-weight:700}.bad{color:#dc2626;font-weight:700}');
        w.document.write('.print-btn{position:fixed;bottom:30px;left:30px;background:#0C3D22;color:#fff;border:none;padding:16px 24px;border-radius:12px;font-size:1.05em;cursor:pointer;box-shadow:0 4px 12px rgba(12, 61, 34,0.4)}');
        w.document.write('@media print{.print-btn{display:none}}');
        w.document.write('</style></head><body><div class="container">');

        w.document.write('<div class="report-brand">🌿 בנחת — זוגיות, כסף וערכים</div>');
        w.document.write('<h1>💵 דוח תזרים חודשי</h1>');
        w.document.write('<div class="sub">תוכנית: ' + escapeHtmlCf(plan.name || '') + ' &nbsp;|&nbsp; חודש: ' + monthLabel + ' &nbsp;|&nbsp; הופק בתאריך: ' + new Date().toLocaleDateString('he-IL') + '</div>');

        var netClass = s.netActual >= 0 ? 'net-pos' : 'net-neg';
        w.document.write('<div class="net-card ' + netClass + '"><div class="net-label">תזרים פנוי לחיסכון (בפועל)</div><div class="net-val">' + formatCurrency(s.netActual) + '</div><div style="margin-top:6px;font-size:0.85em;opacity:0.9">צפי: ' + formatCurrency(s.netPlanned) + '</div></div>');

        w.document.write('<h2>סיכום כללי</h2>');
        w.document.write('<table><thead><tr><th>קטגוריה</th><th>צפי</th><th>פועל</th><th>הפרש</th></tr></thead><tbody>');
        w.document.write(cfReportSummaryRow('💰 הכנסות', s.income.planned, s.income.actual, true));
        CF_EXPENSE_CATS.forEach(function (cat) {
            var meta = CF_META[cat];
            var t = s.perCategory[cat];
            w.document.write(cfReportSummaryRow(meta.icon + ' ' + meta.label, t.planned, t.actual, false));
        });
        w.document.write('</tbody><tfoot><tr><td>סה״כ הוצאות</td><td>' + formatCurrency(s.expensePlanned) + '</td><td>' + formatCurrency(s.expenseActual) + '</td><td></td></tr></tfoot></table>');

        CF_ALL_CATS.forEach(function (cat) {
            var meta = CF_META[cat];
            var items = monthObj[cat] || [];
            if (items.length === 0) return;
            w.document.write('<h2>' + meta.icon + ' ' + meta.label + '</h2>');
            w.document.write('<table><thead><tr><th>שם</th><th>צפי</th><th>פועל</th><th>הפרש</th></tr></thead><tbody>');
            items.forEach(function (it) {
                var planned = it.planned || 0, actual = it.actual || 0;
                var diff = actual - planned;
                var isGood = (meta.kind === 'income') ? (actual >= planned) : (actual <= planned);
                var diffClass = (actual === 0 && planned !== 0) ? '' : (isGood ? 'good' : 'bad');
                var diffText = (actual === 0 && planned !== 0) ? '—' : (diff > 0 ? '+' : '') + formatCurrency(diff);
                w.document.write('<tr><td>' + escapeHtmlCf(it.name) + '</td><td>' + formatCurrency(planned) + '</td><td>' + formatCurrency(actual) + '</td><td class="' + diffClass + '">' + diffText + '</td></tr>');
            });
            var catTotals = computeCategoryTotals(monthObj, cat);
            w.document.write('</tbody><tfoot><tr><td>סה״כ</td><td>' + formatCurrency(catTotals.planned) + '</td><td>' + formatCurrency(catTotals.actual) + '</td><td></td></tr></tfoot></table>');
        });

        w.document.write('<button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button>');
        w.document.write('</div></body></html>');
        w.document.close();
    }
    window.cfExportHTML = cfExportHTML;

    function cfReportSummaryRow(label, planned, actual, isIncome) {
        var diff = actual - planned;
        var isGood = isIncome ? (actual >= planned) : (actual <= planned);
        var diffClass = (actual === 0 && planned !== 0) ? '' : (isGood ? 'good' : 'bad');
        var diffText = (actual === 0 && planned !== 0) ? '—' : (diff > 0 ? '+' : '') + formatCurrency(diff);
        return '<tr><td>' + label + '</td><td>' + formatCurrency(planned) + '</td><td>' + formatCurrency(actual) + '</td><td class="' + diffClass + '">' + diffText + '</td></tr>';
    }

    // ============================================================
    // EXPORT — EXCEL (XLSX)
    // ============================================================
    function cfExportExcel() {
        if (typeof XLSX === 'undefined') {
            alert('שגיאה: ספריית האקסל לא נטענה');
            return;
        }
        var plan = getCurrentPlan();
        var key = getCfCurrentMonthKey();
        var monthObj = ensureCashflowMonth(plan, key);
        var s = computeMonthSummary(monthObj);

        var wb = XLSX.utils.book_new();

        // Summary sheet
        var summaryRows = [
            { 'קטגוריה': 'הכנסות', 'צפי': s.income.planned, 'פועל': s.income.actual, 'הפרש': s.income.actual - s.income.planned }
        ];
        CF_EXPENSE_CATS.forEach(function (cat) {
            var meta = CF_META[cat];
            var t = s.perCategory[cat];
            summaryRows.push({ 'קטגוריה': meta.label, 'צפי': t.planned, 'פועל': t.actual, 'הפרש': t.actual - t.planned });
        });
        summaryRows.push({ 'קטגוריה': 'סה״כ הוצאות', 'צפי': s.expensePlanned, 'פועל': s.expenseActual, 'הפרש': s.expenseActual - s.expensePlanned });
        summaryRows.push({ 'קטגוריה': 'תזרים פנוי לחיסכון', 'צפי': s.netPlanned, 'פועל': s.netActual, 'הפרש': s.netActual - s.netPlanned });
        var wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום');

        // One sheet per category
        CF_ALL_CATS.forEach(function (cat) {
            var meta = CF_META[cat];
            var items = monthObj[cat] || [];
            var rows = items.map(function (it) {
                return { 'שם': it.name, 'צפי': it.planned || 0, 'פועל': it.actual || 0, 'הפרש': (it.actual || 0) - (it.planned || 0), 'מסונכרן': it.linked ? 'כן' : '' };
            });
            if (rows.length === 0) rows = [{ 'שם': '(אין נתונים)', 'צפי': '', 'פועל': '', 'הפרש': '', 'מסונכרן': '' }];
            var ws = XLSX.utils.json_to_sheet(rows);
            var sheetName = meta.label.length > 28 ? meta.label.substring(0, 28) : meta.label;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        var filename = 'תזרים-' + key + '.xlsx';
        XLSX.writeFile(wb, filename);
    }
    window.cfExportExcel = cfExportExcel;

})();
