// ============================================================
// pension-profile-fix.js v3
// Loaded AFTER glide.js
// 
// v3 fixes:
// - Net real: calculate DIRECTLY in renderPensionTab (not via
//   override chain which broke). Sets values after all rendering.
// - Pension years: auto-synced from retirement age, no manual input.
// - Equity target year: auto-synced from retirement age.
// ============================================================

console.log('✅ pension-profile-fix.js v3 loading...');

// ============================================================
// HELPERS
// ============================================================

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
    var p = plan.profile;
    if (who === 'user' || who === 'husband') return p.user.age || calculateAgeFromDate(p.user.birthDate) || null;
    return p.spouse.age || calculateAgeFromDate(p.spouse.birthDate) || null;
}

// Get years until retirement (from user's retirement age goal)
function getYearsUntilRetirement() {
    var plan = getCurrentPlan();
    var goals = plan.goals;
    var userAge = getProfileAge('user');
    var retAge = goals.retirement.userAge;
    if (userAge && retAge && retAge > userAge) return retAge - userAge;
    // Fallback: manual pensionYears field
    var el = document.getElementById('pensionYears');
    return parseInt((el || {}).value) || 20;
}

// ============================================================
// PROFILE: loadProfile / saveProfile
// ============================================================

loadProfile = function() {
    var plan = getCurrentPlan(); var profile = plan.profile;
    var r = document.querySelector('input[name="maritalStatus"][value="' + profile.maritalStatus + '"]');
    if (r) r.checked = true;
    var el;
    el = document.getElementById('userName'); if (el) el.value = profile.user.name || '';
    el = document.getElementById('userGender'); if (el) el.value = profile.user.gender || 'male';
    el = document.getElementById('userBirthDate');
    if (el) { el.value = profile.user.birthDate || ''; updateAgeDisplay('user'); }
    if (!profile.user.birthDate && profile.user.age) {
        var d = document.getElementById('userAgeDisplay');
        if (d) { d.textContent = 'גיל: ' + profile.user.age + ' (הזן תאריך לידה)'; d.style.color = 'var(--warning)'; }
        var h = document.getElementById('userAge'); if (h) h.value = profile.user.age;
    }
    el = document.getElementById('spouseName'); if (el) el.value = profile.spouse.name || '';
    el = document.getElementById('spouseGender'); if (el) el.value = profile.spouse.gender || 'female';
    el = document.getElementById('spouseBirthDate');
    if (el) { el.value = profile.spouse.birthDate || ''; updateAgeDisplay('spouse'); }
    if (!profile.spouse.birthDate && profile.spouse.age) {
        var sd = document.getElementById('spouseAgeDisplay');
        if (sd) { sd.textContent = 'גיל: ' + profile.spouse.age + ' (הזן תאריך לידה)'; sd.style.color = 'var(--warning)'; }
        var sh = document.getElementById('spouseAge'); if (sh) sh.value = profile.spouse.age;
    }
    if (typeof updateMaritalStatus === 'function') updateMaritalStatus();
    if (typeof renderChildren === 'function') renderChildren();
};

saveProfile = function() {
    var plan = getCurrentPlan(); var profile = plan.profile;
    profile.user.name = (document.getElementById('userName').value || '').trim();
    profile.user.gender = document.getElementById('userGender').value;
    var ub = document.getElementById('userBirthDate');
    if (ub && ub.value) { profile.user.birthDate = ub.value; profile.user.age = calculateAgeFromDate(ub.value); }
    else { var ma = parseInt(document.getElementById('userAge').value); if (ma >= 18 && ma <= 120) profile.user.age = ma; }
    if (profile.maritalStatus === 'married') {
        profile.spouse.name = (document.getElementById('spouseName').value || '').trim();
        profile.spouse.gender = document.getElementById('spouseGender').value;
        var sb = document.getElementById('spouseBirthDate');
        if (sb && sb.value) { profile.spouse.birthDate = sb.value; profile.spouse.age = calculateAgeFromDate(sb.value); }
        else { var sma = parseInt(document.getElementById('spouseAge').value); if (sma >= 18 && sma <= 120) profile.spouse.age = sma; }
    }
    if (!profile.user.name) { alert('נא להזין שם'); return; }
    if (!profile.user.age || profile.user.age < 18) { alert('נא להזין תאריך לידה תקין'); return; }
    if (profile.maritalStatus === 'married') {
        if (!profile.spouse.name) { alert('נא להזין שם בן/בת הזוג'); return; }
        if (!profile.spouse.age || profile.spouse.age < 18) { alert('נא להזין תאריך לידה תקין לבן/בת הזוג'); return; }
    }
    // Sync to pension investments
    plan.investments.forEach(function(inv) {
        if (inv.type !== 'פנסיה') return;
        if (inv.spouse === 'husband' || (!inv.spouse && inv.gender === 'male')) { inv.age = profile.user.age; inv.gender = profile.user.gender; }
        else if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) { inv.age = profile.spouse.age; inv.gender = profile.spouse.gender; }
    });
    saveData();
    showSaveNotification('✅ הפרופיל נשמר בהצלחה!');
};

// ============================================================
// renderActivePanel override — load profile/pension on switch
// ============================================================

var _ppf_origRAP = renderActivePanel;
renderActivePanel = function(panelId) {
    _ppf_origRAP(panelId);
    if (panelId === 'profile') loadProfile();
    if (panelId === 'pension') loadPensionGoals();
};

// ============================================================
// PENSION GOALS: Load, Save, Display
// ============================================================

function loadPensionGoals() {
    var plan = getCurrentPlan(); var goals = plan.goals; var profile = plan.profile;
    var el;
    el = document.getElementById('goalRetirementAgeUser'); if (el) el.value = goals.retirement.userAge || '';
    el = document.getElementById('goalRetirementAgeSpouse'); if (el) el.value = goals.retirement.spouseAge || '';
    el = document.getElementById('goalMonthlyPension'); if (el) el.value = goals.retirement.monthlyPension || '';
    el = document.getElementById('goalPensionIsReal'); if (el) el.checked = goals.retirement.isRealValue !== false;
    el = document.getElementById('goalEquityAmount'); if (el) el.value = goals.equity.targetAmount || '';
    el = document.getElementById('goalEquityIsReal'); if (el) el.checked = goals.equity.isRealValue !== false;
    el = document.getElementById('goalSpouseRetirementGroup');
    if (el) el.style.display = (profile.maritalStatus === 'single') ? 'none' : 'block';
    
    // Sync pension years from retirement age
    syncPensionYearsFromRetirement();
    updateRetirementCalcDisplay();
    updatePensionProfileInfo();
}

function syncPensionYearsFromRetirement() {
    var years = getYearsUntilRetirement();
    var el = document.getElementById('pensionYears');
    if (el) el.value = years;
    
    // Also show the auto-calc info
    var infoEl = document.getElementById('pensionYearsAutoInfo');
    var userAge = getProfileAge('user');
    var plan = getCurrentPlan();
    var retAge = plan.goals.retirement.userAge;
    if (infoEl) {
        if (userAge && retAge) {
            infoEl.innerHTML = '<span style="color:var(--success);font-size:0.82em;">מחושב אוטומטית: גיל ' + userAge + ' → פרישה בגיל ' + retAge + ' = ' + years + ' שנים</span>';
        } else {
            infoEl.innerHTML = '<span style="color:var(--warning);font-size:0.82em;">הגדר גיל פרישה ביעדים למטה</span>';
        }
    }
}

function updateRetirementCalcDisplay() {
    var currentYear = new Date().getFullYear();
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
            uc.innerHTML = '<span style="color:var(--warning);">⚠️ הגדר תאריך לידה בפרופיל</span>';
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
            sc.innerHTML = '';
        }
    }
}

function updatePensionProfileInfo() {
    var plan = getCurrentPlan(); var profile = plan.profile;
    var infoEl = document.getElementById('pensionProfileInfo'); if (!infoEl) return;
    var parts = [];
    if (profile.user.name) { parts.push('👨 ' + profile.user.name + ' (גיל ' + (getProfileAge('user') || '?') + ', ' + (profile.user.gender === 'female' ? 'נקבה' : 'זכר') + ')'); }
    if (profile.maritalStatus === 'married' && profile.spouse.name) { parts.push('👩 ' + profile.spouse.name + ' (גיל ' + (getProfileAge('spouse') || '?') + ', ' + (profile.spouse.gender === 'female' ? 'נקבה' : 'זכר') + ')'); }
    if (parts.length > 0) {
        infoEl.innerHTML = '<div style="font-size:0.85em;color:var(--text-secondary);padding:10px 14px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border);margin-bottom:16px;"><strong>מהפרופיל:</strong> ' + parts.join(' · ') + ' <a href="#" onclick="openModule(\'profile\');return false;" style="color:var(--brand-primary);font-weight:600;">עריכה ←</a></div>';
    } else {
        infoEl.innerHTML = '<div class="alert alert-warning" style="margin-bottom:16px;"><span class="alert-icon">⚠️</span><div>נא למלא פרטים ב<a href="#" onclick="openModule(\'profile\');return false;" style="color:inherit;font-weight:700;">טאב הפרופיל</a></div></div>';
    }
}

// === saveGoals ===
saveGoals = function() {
    var plan = getCurrentPlan(); var goals = plan.goals; var el;
    el = document.getElementById('goalRetirementAgeUser'); if (el) goals.retirement.userAge = parseInt(el.value) || null;
    el = document.getElementById('goalRetirementAgeSpouse'); if (el) goals.retirement.spouseAge = parseInt(el.value) || null;
    el = document.getElementById('goalMonthlyPension'); if (el) goals.retirement.monthlyPension = parseFloat(el.value) || null;
    el = document.getElementById('goalPensionIsReal'); if (el) goals.retirement.isRealValue = el.checked;
    el = document.getElementById('goalEquityAmount'); if (el) goals.equity.targetAmount = parseFloat(el.value) || null;
    el = document.getElementById('goalEquityIsReal'); if (el) goals.equity.isRealValue = el.checked;
    
    // Auto-calc equity target year from retirement age
    var userAge = getProfileAge('user');
    var retAge = goals.retirement.userAge;
    if (userAge && retAge && retAge > userAge) {
        goals.equity.targetYear = new Date().getFullYear() + (retAge - userAge);
    }
    
    saveData();
    if (typeof syncLifeGoalsToRoadmap === 'function') syncLifeGoalsToRoadmap();
    if (typeof renderWithdrawals === 'function') renderWithdrawals();
    syncPensionYearsFromRetirement();
    updateRetirementCalcDisplay();
    
    // Re-render pension tab to reflect new years
    if (typeof renderPensionTab === 'function') renderPensionTab();
    
    showSaveNotification('✅ היעדים נשמרו בהצלחה!');
};

// ============================================================
// selectPenGender — auto-fill age from profile
// ============================================================

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

// ============================================================
// KEY FIX: renderPensionTab — sync profile, then DIRECTLY
// compute and set net real values AFTER all rendering is done.
// This avoids the override chain issue with calculateMonthlyPensions.
// ============================================================

var _ppf_baseRPT = renderPensionTab;
renderPensionTab = function() {
    var plan = getCurrentPlan(); var profile = plan.profile;
    
    // Sync pension years from retirement goal
    syncPensionYearsFromRetirement();
    
    // Sync ages from profile into pension investments
    plan.investments.forEach(function(inv) {
        if (inv.type !== 'פנסיה') return;
        if (inv.spouse === 'husband' || (!inv.spouse && inv.gender === 'male')) {
            var uA = getProfileAge('user'); if (uA) inv.age = uA;
            if (profile.user.gender) inv.gender = profile.user.gender;
        } else if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) {
            var sA = getProfileAge('spouse'); if (sA) inv.age = sA;
            if (profile.spouse.gender) inv.gender = profile.spouse.gender;
        }
    });
    
    // Call original chain (script.js → renderPensionTab)
    // This renders pension lists, calculates nominal/real/net, etc.
    _ppf_baseRPT();
    
    // Load goals form
    loadPensionGoals();
    
    // Render pension goal progress
    renderPensionGoalProgress();
    
    // *** DIRECT NET REAL CALCULATION ***
    // Do this AFTER everything else, reading from already-rendered values
    computeAndSetNetReal();
};

function computeAndSetNetReal() {
    var plan = getCurrentPlan();
    var years = parseInt((document.getElementById('pensionYears') || {}).value) || 20;
    var inflationFactor = Math.pow(1.02, years);
    
    // Separate pensions by spouse
    var husbandPensions = [];
    var wifePensions = [];
    plan.investments.forEach(function(inv) {
        if (!inv.include || inv.type !== 'פנסיה') return;
        if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) wifePensions.push(inv);
        else husbandPensions.push(inv);
    });
    
    // Calculate husband nominal monthly pension
    var hNom = 0;
    husbandPensions.forEach(function(inv) {
        var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                            inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        hNom += calculateMonthlyPension(fv, inv.gender || 'male');
    });
    
    // Calculate wife nominal monthly pension
    var wNom = 0;
    wifePensions.forEach(function(inv) {
        var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                            inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        wNom += calculateMonthlyPension(fv, inv.gender || 'female');
    });
    
    // Calculate net (after tax)
    var hNetObj = calculateNetPension(hNom);
    var wNetObj = calculateNetPension(wNom);
    
    // Net real = net / inflation
    var hNetReal = hNetObj.net / inflationFactor;
    var wNetReal = wNetObj.net / inflationFactor;
    var cNetReal = hNetReal + wNetReal;
    
    console.log('=== NET REAL (v3 direct) ===');
    console.log('Years:', years, 'Inflation:', inflationFactor.toFixed(4));
    console.log('H nom:', Math.round(hNom), 'H net:', Math.round(hNetObj.net), 'H netReal:', Math.round(hNetReal));
    console.log('W nom:', Math.round(wNom), 'W net:', Math.round(wNetObj.net), 'W netReal:', Math.round(wNetReal));
    console.log('Combined netReal:', Math.round(cNetReal));
    
    // Set DOM elements directly
    var e;
    e = document.getElementById('pensionHusbandNetReal');
    if (e) { e.textContent = formatCurrency(hNetReal); console.log('✅ Set pensionHusbandNetReal:', formatCurrency(hNetReal)); }
    else { console.log('❌ Element pensionHusbandNetReal NOT FOUND'); }
    
    e = document.getElementById('pensionWifeNetReal');
    if (e) { e.textContent = formatCurrency(wNetReal); console.log('✅ Set pensionWifeNetReal:', formatCurrency(wNetReal)); }
    else { console.log('❌ Element pensionWifeNetReal NOT FOUND'); }
    
    e = document.getElementById('pensionCombinedNetReal');
    if (e) { e.textContent = formatCurrency(cNetReal); console.log('✅ Set pensionCombinedNetReal:', formatCurrency(cNetReal)); }
    else { console.log('❌ Element pensionCombinedNetReal NOT FOUND'); }
}

// ============================================================
// renderGoalProgress — EXCLUDE pension (shown in pension tab)
// ============================================================

renderGoalProgress = function() {
    var container = document.getElementById('goalProgress'); if (!container) return;
    var analysis = analyzeGoals();
    if (!analysis) { container.innerHTML = '<div class="alert alert-info">השלם פרופיל ויעדים</div>'; return; }
    var hasEq = !!analysis.equity; var hasLG = analysis.lifeGoals && analysis.lifeGoals.length > 0;
    if (!hasEq && !hasLG) { container.innerHTML = '<div class="alert alert-info">הגדר יעדי הון או יעדי חיים<br><small>(יעדי פנסיה בטאב הפנסיה)</small></div>'; return; }
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

// Exclude pension from recommendations
var _ppf_origGR = generateRecommendations;
generateRecommendations = function(analysis) { return _ppf_origGR(analysis).filter(function(r) { return r.type !== 'pension'; }); };

// ============================================================
// Pension goal progress (shown in pension tab only)
// ============================================================

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

// ============================================================
// Migration
// ============================================================

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

console.log('✅ pension-profile-fix.js v3 loaded');
