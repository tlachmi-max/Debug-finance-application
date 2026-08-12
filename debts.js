// ============================================================
// debts.js — "החובות שלנו" (Our Debts) module + Monthly Income field
// ★ Loaded AFTER script.js, patch.js, glide.js, pension-profile-fix.js
// ★ Adds: plan.debts[] CRUD, profile.monthlyIncome field + warning,
//         and getTotalDebts() used by the dashboard net-worth card.
// ============================================================

(function () {
    'use strict';

    var editingDebtIndex = -1;

    // ------------------------------------------------------------
    // Data model helpers — ensure plan.debts[] always exists
    // ------------------------------------------------------------
    function ensureDebtsArray(plan) {
        if (!plan.debts) plan.debts = [];
        return plan.debts;
    }

    // Total outstanding debt amount for a plan (used to compute net worth)
    function getTotalDebts(plan) {
        var p = plan || (typeof getCurrentPlan === 'function' ? getCurrentPlan() : null);
        if (!p) return 0;
        var debts = ensureDebtsArray(p);
        var total = 0;
        debts.forEach(function (d) { total += (d.amount || 0); });
        return total;
    }
    window.getTotalDebts = getTotalDebts;

    // ------------------------------------------------------------
    // Debt type select — show/hide custom name field
    // ------------------------------------------------------------
    function onDebtTypeChange() {
        var sel = document.getElementById('debtType');
        var customGroup = document.getElementById('debtCustomTypeGroup');
        if (!sel || !customGroup) return;
        customGroup.style.display = (sel.value === 'אחר') ? 'block' : 'none';
        if (sel.value !== 'אחר') {
            var custom = document.getElementById('debtCustomType');
            if (custom) custom.value = '';
        }
    }
    window.onDebtTypeChange = onDebtTypeChange;

    // ------------------------------------------------------------
    // Save (create/update) a debt
    // ------------------------------------------------------------
    function saveDebt(event) {
        if (event) event.preventDefault();
        var plan = getCurrentPlan();
        var debts = ensureDebtsArray(plan);

        var type = document.getElementById('debtType').value;
        var customType = (document.getElementById('debtCustomType').value || '').trim();
        var amount = sanitizeNumber(document.getElementById('debtAmount').value);
        var interest = parseFloat(document.getElementById('debtInterest').value);
        var endDate = document.getElementById('debtEndDate').value;
        var monthlyPayment = sanitizeNumber(document.getElementById('debtMonthlyPayment').value);

        if (type === 'אחר' && !customType) {
            alert('נא להזין שם לסוג ההלוואה');
            return;
        }
        if (!amount || amount <= 0) {
            alert('נא להזין סכום הלוואה תקין');
            return;
        }
        if (isNaN(interest) || interest < 0) {
            alert('נא להזין ריבית שנתית תקינה');
            return;
        }
        if (!endDate) {
            alert('נא להזין מועד סיום להלוואה');
            return;
        }
        if (!monthlyPayment || monthlyPayment <= 0) {
            alert('נא להזין תשלום חודשי תקין');
            return;
        }

        var debt = {
            type: type,
            typeLabel: type === 'אחר' ? customType : type,
            amount: amount,
            interestRate: interest,
            endDate: endDate,
            monthlyPayment: monthlyPayment
        };

        if (editingDebtIndex >= 0) {
            debts[editingDebtIndex] = debt;
            editingDebtIndex = -1;
        } else {
            debts.push(debt);
        }

        saveData();
        resetDebtForm();
        renderDebts();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof showSaveNotification === 'function') showSaveNotification('✅ ההלוואה נשמרה בהצלחה!');
    }
    window.saveDebt = saveDebt;

    function editDebt(index) {
        var plan = getCurrentPlan();
        var debt = ensureDebtsArray(plan)[index];
        if (!debt) return;

        document.getElementById('debtType').value = debt.type;
        onDebtTypeChange();
        if (debt.type === 'אחר') document.getElementById('debtCustomType').value = debt.typeLabel || '';
        document.getElementById('debtAmount').value = debt.amount;
        document.getElementById('debtInterest').value = debt.interestRate;
        document.getElementById('debtEndDate').value = debt.endDate;
        document.getElementById('debtMonthlyPayment').value = debt.monthlyPayment;

        editingDebtIndex = index;
        var titleEl = document.getElementById('debtFormTitle');
        if (titleEl) titleEl.textContent = 'עריכת הלוואה';
        var saveText = document.getElementById('btnSaveDebtText');
        if (saveText) saveText.textContent = 'עדכן הלוואה';
        var cancelBtn = document.getElementById('btnCancelDebtEdit');
        if (cancelBtn) cancelBtn.style.display = 'block';

        var form = document.getElementById('debtForm');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.editDebt = editDebt;

    function deleteDebt(index) {
        if (!confirm('האם למחוק את ההלוואה?')) return;
        var plan = getCurrentPlan();
        ensureDebtsArray(plan).splice(index, 1);
        saveData();
        renderDebts();
        if (typeof renderDashboard === 'function') renderDashboard();
    }
    window.deleteDebt = deleteDebt;

    function cancelEditDebt() {
        editingDebtIndex = -1;
        resetDebtForm();
    }
    window.cancelEditDebt = cancelEditDebt;

    function resetDebtForm() {
        var form = document.getElementById('debtForm');
        if (form) form.reset();
        onDebtTypeChange();
        var titleEl = document.getElementById('debtFormTitle');
        if (titleEl) titleEl.textContent = 'הוסף הלוואה';
        var saveText = document.getElementById('btnSaveDebtText');
        if (saveText) saveText.textContent = 'שמור הלוואה';
        var cancelBtn = document.getElementById('btnCancelDebtEdit');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    // ------------------------------------------------------------
    // Render debts list + summary
    // ------------------------------------------------------------
    function renderDebts() {
        var plan = getCurrentPlan();
        var debts = ensureDebtsArray(plan);
        var container = document.getElementById('debtsList');
        var summary = document.getElementById('debtsSummary');
        if (!container) return;

        if (debts.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">אין הלוואות רשומות</div><div class="empty-text">הוסף את ההלוואה הראשונה שלך</div></div>';
            if (summary) summary.innerHTML = '<div class="item-detail"><span>💳</span><span>אין התחייבויות רשומות</span></div>';
            return;
        }

        container.innerHTML = debts.map(function (d, i) {
            var endDateDisplay = d.endDate ? new Date(d.endDate).toLocaleDateString('he-IL') : '—';
            return '' +
                '<div class="item">' +
                    '<div class="item-header">' +
                        '<div>' +
                            '<div class="item-title">' + d.typeLabel + '</div>' +
                            '<div class="item-subtitle">ריבית שנתית ' + d.interestRate + '%</div>' +
                        '</div>' +
                        '<div class="item-actions">' +
                            '<button class="btn btn-primary btn-sm" onclick="editDebt(' + i + ')"><span>✏️</span><span>ערוך</span></button>' +
                            '<button class="btn btn-danger btn-sm" onclick="deleteDebt(' + i + ')"><span>🗑️</span><span>מחק</span></button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="item-details">' +
                        '<div class="item-detail"><span>💰</span><span>יתרת הלוואה: ' + formatCurrency(d.amount) + '</span></div>' +
                        '<div class="item-detail"><span>📅</span><span>תשלום חודשי: ' + formatCurrency(d.monthlyPayment) + '</span></div>' +
                        '<div class="item-detail"><span>⏳</span><span>סיום: ' + endDateDisplay + '</span></div>' +
                    '</div>' +
                '</div>';
        }).join('');

        if (summary) {
            var totalDebt = getTotalDebts(plan);
            var totalMonthly = 0;
            debts.forEach(function (d) { totalMonthly += (d.monthlyPayment || 0); });
            summary.innerHTML =
                '<div class="item-details">' +
                    '<div class="item-detail"><span>💳</span><span>סה״כ יתרת הלוואות: ' + formatCurrency(totalDebt) + '</span></div>' +
                    '<div class="item-detail"><span>📅</span><span>סה״כ תשלום חודשי: ' + formatCurrency(totalMonthly) + '</span></div>' +
                    '<div class="item-detail"><span>📋</span><span>מספר הלוואות: ' + debts.length + '</span></div>' +
                '</div>';
        }
    }
    window.renderDebts = renderDebts;

    // ------------------------------------------------------------
    // Monthly family income field (profile tab)
    // ------------------------------------------------------------
    function renderIncomeField() {
        var plan = getCurrentPlan();
        if (!plan.profile) return;
        var input = document.getElementById('monthlyIncome');
        var warning = document.getElementById('incomeWarning');
        if (!input) return;
        input.value = plan.profile.monthlyIncome || '';
        if (warning) warning.style.display = plan.profile.monthlyIncome ? 'none' : 'block';
    }
    window.renderIncomeField = renderIncomeField;

    function onMonthlyIncomeInput() {
        var input = document.getElementById('monthlyIncome');
        var warning = document.getElementById('incomeWarning');
        if (!input) return;
        var value = sanitizeNumber(input.value);
        var plan = getCurrentPlan();
        if (!plan.profile) return;
        plan.profile.monthlyIncome = value > 0 ? value : null;
        if (warning) warning.style.display = value > 0 ? 'none' : 'block';
        saveData();
    }
    window.onMonthlyIncomeInput = onMonthlyIncomeInput;

    // ------------------------------------------------------------
    // Recommended net worth — Thomas Stanley's rule of thumb:
    // Recommended Net Worth = Age × Annual Household Income ÷ 10
    // (from "The Millionaire Next Door"). Requires monthly income
    // to be filled in; otherwise the card stays hidden, matching
    // the warning shown on the profile tab.
    // ------------------------------------------------------------
    function calculateRecommendedNetWorth(plan) {
        var profile = plan.profile;
        if (!profile || !profile.monthlyIncome || profile.monthlyIncome <= 0) return null;

        var userAge = profile.user && profile.user.age;
        var spouseAge = profile.maritalStatus === 'married' && profile.spouse ? profile.spouse.age : null;
        if (!userAge) return null;

        var age = (spouseAge) ? Math.round((userAge + spouseAge) / 2) : userAge;
        var annualIncome = profile.monthlyIncome * 12;
        var recommended = (age * annualIncome) / 10;
        return { recommended: recommended, age: age, annualIncome: annualIncome };
    }
    window.calculateRecommendedNetWorth = calculateRecommendedNetWorth;

    function renderRecommendedNetWorth(plan, actualNetWorth) {
        var card = document.getElementById('dashRecommendedCard');
        var valueEl = document.getElementById('dashRecommended');
        var subEl = document.getElementById('dashRecommendedSub');
        if (!card || !valueEl || !subEl) return;

        var result = calculateRecommendedNetWorth(plan);
        if (!result) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';
        valueEl.textContent = formatCurrency(result.recommended);

        var actual = actualNetWorth || 0;
        if (result.recommended > 0) {
            var pct = Math.round((actual / result.recommended) * 100);
            if (actual >= result.recommended) {
                subEl.textContent = 'השווי הנקי בפועל גבוה מהמומלץ (' + pct + '%) ✅';
            } else {
                subEl.textContent = 'השווי הנקי בפועל הוא ' + pct + '% מהמומלץ לגיל ולהכנסה';
            }
        } else {
            subEl.textContent = '';
        }
    }
    window.renderRecommendedNetWorth = renderRecommendedNetWorth;

})();
