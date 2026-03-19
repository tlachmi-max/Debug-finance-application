// ============================================================
// pension-profile-fix.js v2
// Loaded AFTER glide.js
// ============================================================

console.log('✅ pension-profile-fix.js v2 loading...');

function calculateAgeFromDate(birthDateStr) {
    if (!birthDateStr) return null;
    var birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return null;
    var today = new Date();
    var age = today.getFullYear() - birth.getFullYear();
    var m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
}

function updateAgeDisplay(who) {
    var prefix = who === 'spouse' ? 'spouse' : 'user';
    var dateInput = document.getElementById(prefix + 'BirthDate');
    var ageDisplay = document.getElementById(prefix + 'AgeDisplay');
    var hiddenAge = document.getElementById(prefix + 'Age');
    if (!dateInput || !ageDisplay) return;
    var age = calculateAgeFromDate(dateInput.value);
    if (age !== null && age >= 0 && age <= 120) {
        ageDisplay.textContent = 'גיל: ' + age;
        ageDisplay.style.color = 'var(--success)';
        if (hiddenAge) hiddenAge.value = age;
    } else {
        ageDisplay.textContent = '';
        if (hiddenAge) hiddenAge.value = '';
    }
}

function getProfileAge(who) {
    var plan = getCurrentPlan();
    var profile = plan.profile;
    if (who === 'user' || who === 'husband') {
        return profile.user.age || calculateAgeFromDate(profile.user.birthDate) || null;
    } else {
        return profile.spouse.age || calculateAgeFromDate(profile.spouse.birthDate) || null;
    }
}

// === loadProfile ===
loadProfile = function() {
    var plan = getCurrentPlan();
    var profile = plan.profile;
    var statusRadio = document.querySelector('input[name="maritalStatus"][value="' + profile.maritalStatus + '"]');
    if (statusRadio) statusRadio.checked = true;
    var nameEl = document.getElementById('userName');
    if (nameEl) nameEl.value = profile.user.name || '';
    var genderEl = document.getElementById('userGender');
    if (genderEl) genderEl.value = profile.user.gender || 'male';
    var birthEl = document.getElementById('userBirthDate');
    if (birthEl) { birthEl.value = profile.user.birthDate || ''; updateAgeDisplay('user'); }
    if (!profile.user.birthDate && profile.user.age) {
        var d = document.getElementById('userAgeDisplay');
        if (d) { d.textContent = 'גיל: ' + profile.user.age + ' (הזן תאריך לידה לדיוק)'; d.style.color = 'var(--warning)'; }
        var h = document.getElementById('userAge'); if (h) h.value = profile.user.age;
    }
    var spNameEl = document.getElementById('spouseName');
    if (spNameEl) spNameEl.value = profile.spouse.name || '';
    var spGenderEl = document.getElementById('spouseGender');
    if (spGenderEl) spGenderEl.value = profile.spouse.gender || 'female';
    var spBirthEl = document.getElementById('spouseBirthDate');
    if (spBirthEl) { spBirthEl.value = profile.spouse.birthDate || ''; updateAgeDisplay('spouse'); }
    if (!profile.spouse.birthDate && profile.spouse.age) {
        var sd = document.getElementById('spouseAgeDisplay');
        if (sd) { sd.textContent = 'גיל: ' + profile.spouse.age + ' (הזן תאריך לידה לדיוק)'; sd.style.color = 'var(--warning)'; }
        var sh = document.getElementById('spouseAge'); if (sh) sh.value = profile.spouse.age;
    }
    if (typeof updateMaritalStatus === 'function') updateMaritalStatus();
    if (typeof renderChildren === 'function') renderChildren();
};

// === saveProfile ===
saveProfile = function() {
    var plan = getCurrentPlan();
    var profile = plan.profile;
    profile.user.name = (document.getElementById('userName').value || '').trim();
    profile.user.gender = document.getElementById('userGender').value;
    var userBirth = document.getElementById('userBirthDate');
    if (userBirth && userBirth.value) {
        profile.user.birthDate = userBirth.value;
        profile.user.age = calculateAgeFromDate(userBirth.value);
    } else {
        var ma = parseInt(document.getElementById('userAge').value);
        if (ma && ma >= 18 && ma <= 120) profile.user.age = ma;
    }
    if (profile.maritalStatus === 'married') {
        profile.spouse.name = (document.getElementById('spouseName').value || '').trim();
        profile.spouse.gender = document.getElementById('spouseGender').value;
        var spBirth = document.getElementById('spouseBirthDate');
        if (spBirth && spBirth.value) {
            profile.spouse.birthDate = spBirth.value;
            profile.spouse.age = calculateAgeFromDate(spBirth.value);
        } else {
            var sma = parseInt(document.getElementById('spouseAge').value);
            if (sma && sma >= 18 && sma <= 120) profile.spouse.age = sma;
        }
    }
    if (!profile.user.name) { alert('נא להזין שם'); return; }
    if (!profile.user.age || profile.user.age < 18 || profile.user.age > 120) { alert('נא להזין תאריך לידה תקין'); return; }
    if (profile.maritalStatus === 'married') {
        if (!profile.spouse.name) { alert('נא להזין שם בן/בת הזוג'); return; }
        if (!profile.spouse.age || profile.spouse.age < 18 || profile.spouse.age > 120) { alert('נא להזין תאריך לידה תקין לבן/בת הזוג'); return; }
    }
    plan.investments.forEach(function(inv) {
        if (inv.type !== 'פנסיה') return;
        if (inv.spouse === 'husband' || (!inv.spouse && inv.gender === 'male')) { inv.age = profile.user.age; inv.gender = profile.user.gender; }
        else if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) { inv.age = profile.spouse.age; inv.gender = profile.spouse.gender; }
    });
    saveData();
    showSaveNotification('✅ הפרופיל נשמר בהצלחה!');
};

// === renderActivePanel override ===
var _ppf_origRAP = renderActivePanel;
renderActivePanel = function(panelId) {
    _ppf_origRAP(panelId);
    if (panelId === 'profile') loadProfile();
    if (panelId === 'pension') loadPensionGoals();
};

// === Pension goals ===
function loadPensionGoals() {
    var plan = getCurrentPlan(); var goals = plan.goals; var profile = plan.profile;
    var el;
    el = document.getElementById('goalRetirementAgeUser'); if (el) el.value = goals.retirement.userAge || '';
    el = document.getElementById('goalRetirementAgeSpouse'); if (el) el.value = goals.retirement.spouseAge || '';
    el = document.getElementById('goalMonthlyPension'); if (el) el.value = goals.retirement.monthlyPension || '';
    el = document.getElementById('goalPensionIsReal'); if (el) el.checked = goals.retirement.isRealValue !== false;
    el = document.getElementById('goalEquityAmount'); if (el) el.value = goals.equity.targetAmount || '';
    el = document.getElementById('goalEquityYear'); if (el) el.value = goals.equity.targetYear || '';
    el = document.getElementById('goalEquityIsReal'); if (el) el.checked = goals.equity.isRealValue !== false;
    el = document.getElementById('goalSpouseRetirementGroup');
    if (el) el.style.display = (profile.maritalStatus === 'single') ? 'none' : 'block';
    updateRetirementCalcDisplay();
    updatePensionProfileInfo();
}

function updateRetirementCalcDisplay() {
    var plan = getCurrentPlan(); var currentYear = new Date().getFullYear();
    var uc = document.getElementById('retirementUserCalc');
    if (uc) {
        var uAge = getProfileAge('user');
        var uRet = parseInt((document.getElementById('goalRetirementAgeUser') || {}).value);
        if (uAge && uRet && uRet > uAge) {
            var yrs = uRet - uAge; var yr = currentYear + yrs;
            uc.innerHTML = '<span style="color:var(--success);font-weight:600;">גיל נוכחי: ' + uAge + ' → פרישה בשנת ' + yr + ' (בעוד ' + yrs + ' שנים)</span>';
        } else if (uAge) {
            uc.innerHTML = '<span style="color:var(--text-secondary);">גיל נוכחי: ' + uAge + '</span>';
        } else {
            uc.innerHTML = '<span style="color:var(--warning);">⚠️ הגדר גיל בפרופיל</span>';
        }
    }
    var sc = document.getElementById('retirementSpouseCalc');
    if (sc) {
        var sAge = getProfileAge('spouse');
        var sRet = parseInt((document.getElementById('goalRetirementAgeSpouse') || {}).value);
        if (sAge && sRet && sRet > sAge) {
            var syrs = sRet - sAge; var syr = currentYear + syrs;
            sc.innerHTML = '<span style="color:var(--success);font-weight:600;">גיל נוכחי: ' + sAge + ' → פרישה בשנת ' + syr + ' (בעוד ' + syrs + ' שנים)</span>';
        } else if (sAge) {
            sc.innerHTML = '<span style="color:var(--text-secondary);">גיל נוכחי: ' + sAge + '</span>';
        } else {
            sc.innerHTML = '<span style="color:var(--warning);">⚠️ הגדר גיל בפרופיל</span>';
        }
    }
}

function updatePensionProfileInfo() {
    var plan = getCurrentPlan(); var profile = plan.profile;
    var infoEl = document.getElementById('pensionProfileInfo'); if (!infoEl) return;
    var parts = [];
    if (profile.user.name) { var a = getProfileAge('user') || '?'; var g = profile.user.gender === 'female' ? 'נקבה' : 'זכר'; parts.push('👨 ' + profile.user.name + ' (גיל ' + a + ', ' + g + ')'); }
    if (profile.maritalStatus === 'married' && profile.spouse.name) { var a2 = getProfileAge('spouse') || '?'; var g2 = profile.spouse.gender === 'female' ? 'נקבה' : 'זכר'; parts.push('👩 ' + profile.spouse.name + ' (גיל ' + a2 + ', ' + g2 + ')'); }
    if (parts.length > 0) {
        infoEl.innerHTML = '<div style="font-size:0.85em;color:var(--text-secondary);padding:10px 14px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border);margin-bottom:16px;"><strong>נתונים מהפרופיל:</strong> ' + parts.join(' · ') + ' <a href="#" onclick="openModule(\'profile\');return false;" style="color:var(--brand-primary);font-weight:600;">עריכה ←</a></div>';
    } else {
        infoEl.innerHTML = '<div class="alert alert-warning" style="margin-bottom:16px;"><span class="alert-icon">⚠️</span><div>נא למלא פרטים אישיים ב<a href="#" onclick="openModule(\'profile\');return false;" style="color:inherit;font-weight:700;">טאב הפרופיל</a></div></div>';
    }
}

// === saveGoals override ===
var _ppf_origSG = saveGoals;
saveGoals = function() {
    var plan = getCurrentPlan(); var goals = plan.goals;
    var el;
    el = document.getElementById('goalRetirementAgeUser'); if (el) goals.retirement.userAge = parseInt(el.value) || null;
    el = document.getElementById('goalRetirementAgeSpouse'); if (el) goals.retirement.spouseAge = parseInt(el.value) || null;
    el = document.getElementById('goalMonthlyPension'); if (el) goals.retirement.monthlyPension = parseFloat(el.value) || null;
    el = document.getElementById('goalPensionIsReal'); if (el) goals.retirement.isRealValue = el.checked;
    el = document.getElementById('goalEquityAmount'); if (el) goals.equity.targetAmount = parseFloat(el.value) || null;
    el = document.getElementById('goalEquityYear'); if (el) goals.equity.targetYear = parseInt(el.value) || null;
    el = document.getElementById('goalEquityIsReal'); if (el) goals.equity.isRealValue = el.checked;
    saveData();
    if (typeof syncLifeGoalsToRoadmap === 'function') syncLifeGoalsToRoadmap();
    if (typeof renderWithdrawals === 'function') renderWithdrawals();
    updateRetirementCalcDisplay();
    showSaveNotification('✅ היעדים נשמרו בהצלחה!');
};

// === selectPenGender override — auto-fill age ===
var _ppf_origSPG = selectPenGender;
selectPenGender = function(el, spouse, gender) {
    _ppf_origSPG(el, spouse, gender);
    var ageInput = document.getElementById('penAddAge'); if (!ageInput) return;
    var profileAge = (spouse === 'husband') ? getProfileAge('user') : getProfileAge('spouse');
    if (profileAge) { ageInput.value = profileAge; ageInput.style.backgroundColor = 'var(--success-bg)'; }
    var plan = getCurrentPlan(); var profile = plan.profile;
    if (spouse === 'husband' && profile.user.gender) document.getElementById('penAddGender').value = profile.user.gender;
    else if (spouse === 'wife' && profile.spouse.gender) document.getElementById('penAddGender').value = profile.spouse.gender;
};

// === renderPensionTab override — sync profile + load goals ===
var _ppf_baseRPT = renderPensionTab;
renderPensionTab = function() {
    var plan = getCurrentPlan(); var profile = plan.profile;
    plan.investments.forEach(function(inv) {
        if (inv.type !== 'פנסיה') return;
        if (inv.spouse === 'husband' || (!inv.spouse && inv.gender === 'male')) {
            var uA = getProfileAge('user'); if (uA) inv.age = uA; if (profile.user.gender) inv.gender = profile.user.gender;
        } else if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) {
            var sA = getProfileAge('spouse'); if (sA) inv.age = sA; if (profile.spouse.gender) inv.gender = profile.spouse.gender;
        }
    });
    _ppf_baseRPT();
    loadPensionGoals();
    renderPensionGoalProgress();
};

// === FIX: calculateMonthlyPensions override — add NET REAL ===
var _ppf_origCMP = calculateMonthlyPensions;
calculateMonthlyPensions = function(husbandPensions, wifePensions) {
    _ppf_origCMP(husbandPensions, wifePensions);

    var years = parseInt((document.getElementById('pensionYears') || {}).value) || 20;
    var inflationFactor = Math.pow(1.02, years);

    var hNom = 0;
    husbandPensions.forEach(function(inv) {
        var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, years, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        hNom += calculateMonthlyPension(fv, 'male');
    });
    var wNom = 0;
    wifePensions.forEach(function(inv) {
        var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, years, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        wNom += calculateMonthlyPension(fv, 'female');
    });

    var hNet = calculateNetPension(hNom);
    var wNet = calculateNetPension(wNom);

    var hNetReal = hNet.net / inflationFactor;
    var wNetReal = wNet.net / inflationFactor;
    var cNetReal = hNetReal + wNetReal;

    console.log('NET REAL: husband=' + Math.round(hNetReal) + ' wife=' + Math.round(wNetReal) + ' combined=' + Math.round(cNetReal) + ' (inflation x' + inflationFactor.toFixed(3) + ')');

    var e;
    e = document.getElementById('pensionHusbandNetReal'); if (e) e.textContent = formatCurrency(hNetReal);
    e = document.getElementById('pensionWifeNetReal'); if (e) e.textContent = formatCurrency(wNetReal);
    e = document.getElementById('pensionCombinedNetReal'); if (e) e.textContent = formatCurrency(cNetReal);
};

// === renderGoalProgress — EXCLUDE pension ===
renderGoalProgress = function() {
    var container = document.getElementById('goalProgress'); if (!container) return;
    var analysis = analyzeGoals();
    if (!analysis) { container.innerHTML = '<div class="alert alert-info">השלם את הפרופיל והיעדים כדי לראות התקדמות</div>'; return; }
    var hasEq = !!analysis.equity; var hasLG = analysis.lifeGoals && analysis.lifeGoals.length > 0;
    if (!hasEq && !hasLG) { container.innerHTML = '<div class="alert alert-info">הגדר יעדי הון או יעדי חיים כדי לראות התקדמות<br><span style="font-size:0.85em;">(יעדי פנסיה בטאב הפנסיה)</span></div>'; return; }
    var html = '<div class="card" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;margin-bottom:20px;"><h3 style="margin:0 0 16px;">🎯 התקדמות ביעדים</h3><div style="display:grid;gap:16px;">';
    if (hasEq) { var e = analysis.equity; var c = e.status==='success'?'#10b981':e.status==='warning'?'#f59e0b':'#ef4444'; var i = e.status==='success'?'✅':e.status==='warning'?'🟡':'🔴';
        html += '<div style="background:rgba(255,255,255,0.25);padding:16px;border-radius:8px;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><div style="font-weight:bold;font-size:1.1em;color:#1f2937;">💎 הון עצמי</div><div style="font-size:1.3em;">' + i + '</div></div><div style="font-size:0.9em;color:#374151;margin-bottom:8px;">יעד: ' + formatCurrency(e.target) + ' | צפי: ' + formatCurrency(e.projected) + '</div><div style="background:rgba(0,0,0,0.2);height:24px;border-radius:12px;overflow:hidden;margin-bottom:8px;"><div style="background:' + c + ';height:100%;width:' + e.percentage + '%;"></div></div><div style="display:flex;justify-content:space-between;font-size:0.85em;color:#4b5563;"><span>' + e.percentage.toFixed(0) + '%</span><span>' + (e.gap>0?'חסר':'עודף') + ': ' + formatCurrency(Math.abs(e.gap)) + '</span></div></div>';
    }
    if (hasLG) { analysis.lifeGoals.forEach(function(lg) { var c = lg.status==='success'?'#10b981':lg.status==='warning'?'#f59e0b':'#ef4444'; var i = lg.status==='success'?'✅':lg.status==='warning'?'🟡':'🔴';
        html += '<div style="background:rgba(255,255,255,0.25);padding:16px;border-radius:8px;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><div style="font-weight:bold;font-size:1.1em;color:#1f2937;">🎯 ' + lg.name + '</div><div style="font-size:1.3em;">' + i + '</div></div><div style="font-size:0.9em;color:#374151;margin-bottom:8px;">יעד: ' + formatCurrency(lg.target) + ' ב-' + lg.year + ' | צפי: ' + formatCurrency(lg.projected) + '</div><div style="background:rgba(0,0,0,0.2);height:24px;border-radius:12px;overflow:hidden;margin-bottom:8px;"><div style="background:' + c + ';height:100%;width:' + lg.percentage + '%;"></div></div><div style="display:flex;justify-content:space-between;font-size:0.85em;color:#4b5563;"><span>' + lg.percentage.toFixed(0) + '%</span><span>' + (lg.gap>0?'חסר':'עודף') + ': ' + formatCurrency(Math.abs(lg.gap)) + '</span></div></div>';
    }); }
    html += '</div></div>';
    container.innerHTML = html;
};

// === Exclude pension from recommendations ===
var _ppf_origGR = generateRecommendations;
generateRecommendations = function(analysis) { return _ppf_origGR(analysis).filter(function(r) { return r.type !== 'pension'; }); };

// === Pension goal progress ===
function renderPensionGoalProgress() {
    var ct = document.getElementById('pensionGoalProgress'); if (!ct) return;
    var analysis = analyzeGoals();
    if (!analysis || !analysis.pension) { ct.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:0.9em;">הגדר יעדי פרישה למעלה כדי לראות ניתוח פערים</div>'; return; }
    var p = analysis.pension;
    var color = p.status==='success'?'var(--success)':p.status==='warning'?'var(--warning)':'var(--danger)';
    var icon = p.status==='success'?'✅':p.status==='warning'?'🟡':'🔴';
    var gapText = p.gap > 0 ? 'חסר ' + formatCurrency(p.gap) + '/חודש' : 'עודף ' + formatCurrency(Math.abs(p.gap)) + '/חודש';
    var html = '<div class="card" style="border:2px solid ' + color + ';margin-top:20px;"><div class="card-title" style="margin-bottom:16px;">' + icon + ' ניתוח פערים — יעד קצבה</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;"><div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">יעד (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;">' + formatCurrency(p.target) + '/חודש</div></div><div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">צפי (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;color:' + color + ';">' + formatCurrency(p.projected) + '/חודש</div></div></div>';
    html += '<div style="background:var(--border);height:28px;border-radius:14px;overflow:hidden;margin-bottom:12px;"><div style="background:' + color + ';height:100%;width:' + Math.min(p.percentage, 100) + '%;display:flex;align-items:center;justify-content:center;font-size:0.85em;font-weight:700;color:white;">' + p.percentage.toFixed(0) + '%</div></div>';
    html += '<div style="text-align:center;font-size:0.95em;font-weight:600;color:' + color + ';">' + gapText + '</div></div>';
    ct.innerHTML = html;
}

// === Migration ===
(function() {
    try {
        var saved = localStorage.getItem('financialPlannerProV3'); if (!saved) return;
        var data = JSON.parse(saved); var changed = false;
        data.plans.forEach(function(plan) {
            if (!plan.profile) return;
            if (plan.profile.user && plan.profile.user.age && !plan.profile.user.birthDate) { plan.profile.user.birthDate = (new Date().getFullYear() - plan.profile.user.age) + '-01-01'; changed = true; }
            if (plan.profile.spouse && plan.profile.spouse.age && !plan.profile.spouse.birthDate) { plan.profile.spouse.birthDate = (new Date().getFullYear() - plan.profile.spouse.age) + '-01-01'; changed = true; }
        });
        if (changed) { localStorage.setItem('financialPlannerProV3', JSON.stringify(data)); console.log('✅ Migrated birthDates'); }
    } catch(e) {}
})();

console.log('✅ pension-profile-fix.js v2 loaded');
