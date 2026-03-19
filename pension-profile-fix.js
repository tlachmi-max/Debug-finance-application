// ============================================================
// pension-profile-fix.js v1
// Loaded AFTER glide.js
// 
// Fixes:
// 1. Profile: birth date instead of age, auto-calculate
// 2. Pension goals: save properly, load on tab switch
// 3. Pull gender/age from profile into pension
// 4. Exclude pension from goals tab & gap analysis display
// 5. Show net real (after tax + inflation) in pension tab
// 6. Ensure profile saves correctly
// ============================================================

console.log('✅ pension-profile-fix.js v1 loading...');

// ============================================================
// HELPER: Calculate age from birth date
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

// ============================================================
// OVERRIDE: loadProfile — handle birthDate
// ============================================================

var _ppf_origLoadProfile = (typeof loadProfile === 'function') ? loadProfile : null;

loadProfile = function() {
    var plan = getCurrentPlan();
    var profile = plan.profile;
    
    // Marital status
    var statusRadio = document.querySelector('input[name="maritalStatus"][value="' + profile.maritalStatus + '"]');
    if (statusRadio) statusRadio.checked = true;
    
    // User
    var nameEl = document.getElementById('userName');
    if (nameEl) nameEl.value = profile.user.name || '';
    
    var genderEl = document.getElementById('userGender');
    if (genderEl) genderEl.value = profile.user.gender || 'male';
    
    // Birth date (new) or age (backward compat)
    var birthEl = document.getElementById('userBirthDate');
    var ageEl = document.getElementById('userAge');
    if (birthEl) {
        birthEl.value = profile.user.birthDate || '';
        updateAgeDisplay('user');
    }
    // Backward compat: if no birthDate but age exists, show age
    if (!profile.user.birthDate && profile.user.age && ageEl) {
        ageEl.value = profile.user.age;
        var disp = document.getElementById('userAgeDisplay');
        if (disp) {
            disp.textContent = 'גיל: ' + profile.user.age + ' (ללא תאריך לידה)';
            disp.style.color = 'var(--warning)';
        }
    }
    
    // Spouse
    var spNameEl = document.getElementById('spouseName');
    if (spNameEl) spNameEl.value = profile.spouse.name || '';
    
    var spGenderEl = document.getElementById('spouseGender');
    if (spGenderEl) spGenderEl.value = profile.spouse.gender || 'female';
    
    var spBirthEl = document.getElementById('spouseBirthDate');
    var spAgeEl = document.getElementById('spouseAge');
    if (spBirthEl) {
        spBirthEl.value = profile.spouse.birthDate || '';
        updateAgeDisplay('spouse');
    }
    if (!profile.spouse.birthDate && profile.spouse.age && spAgeEl) {
        spAgeEl.value = profile.spouse.age;
        var spDisp = document.getElementById('spouseAgeDisplay');
        if (spDisp) {
            spDisp.textContent = 'גיל: ' + profile.spouse.age + ' (ללא תאריך לידה)';
            spDisp.style.color = 'var(--warning)';
        }
    }
    
    // Update visibility
    if (typeof updateMaritalStatus === 'function') updateMaritalStatus();
    
    // Children
    if (typeof renderChildren === 'function') renderChildren();
};

// ============================================================
// OVERRIDE: saveProfile — save birthDate, compute age
// ============================================================

saveProfile = function() {
    var plan = getCurrentPlan();
    var profile = plan.profile;
    
    // User
    profile.user.name = (document.getElementById('userName').value || '').trim();
    profile.user.gender = document.getElementById('userGender').value;
    
    // Birth date → age
    var userBirth = document.getElementById('userBirthDate');
    if (userBirth && userBirth.value) {
        profile.user.birthDate = userBirth.value;
        profile.user.age = calculateAgeFromDate(userBirth.value);
    } else {
        // Fallback: manual age if no birth date
        var manualAge = parseInt(document.getElementById('userAge').value);
        if (manualAge && manualAge >= 18 && manualAge <= 120) {
            profile.user.age = manualAge;
        }
    }
    
    // Spouse (if married)
    if (profile.maritalStatus === 'married') {
        profile.spouse.name = (document.getElementById('spouseName').value || '').trim();
        profile.spouse.gender = document.getElementById('spouseGender').value;
        
        var spBirth = document.getElementById('spouseBirthDate');
        if (spBirth && spBirth.value) {
            profile.spouse.birthDate = spBirth.value;
            profile.spouse.age = calculateAgeFromDate(spBirth.value);
        } else {
            var spManualAge = parseInt(document.getElementById('spouseAge').value);
            if (spManualAge && spManualAge >= 18 && spManualAge <= 120) {
                profile.spouse.age = spManualAge;
            }
        }
    }
    
    // Validation
    if (!profile.user.name) {
        alert('נא להזין שם'); return;
    }
    if (!profile.user.age || profile.user.age < 18 || profile.user.age > 120) {
        alert('נא להזין תאריך לידה תקין'); return;
    }
    if (profile.maritalStatus === 'married') {
        if (!profile.spouse.name) {
            alert('נא להזין שם בן/בת הזוג'); return;
        }
        if (!profile.spouse.age || profile.spouse.age < 18 || profile.spouse.age > 120) {
            alert('נא להזין תאריך לידה תקין לבן/בת הזוג'); return;
        }
    }
    
    // Also update age in pension investments that belong to this person
    plan.investments.forEach(function(inv) {
        if (inv.type !== 'פנסיה') return;
        if (inv.spouse === 'husband' || (!inv.spouse && inv.gender === 'male')) {
            inv.age = profile.user.age;
            inv.gender = profile.user.gender;
        } else if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) {
            inv.age = profile.spouse.age;
            inv.gender = profile.spouse.gender;
        }
    });
    
    saveData();
    showSaveNotification('✅ הפרופיל נשמר בהצלחה!');
};

// ============================================================
// OVERRIDE: renderActivePanel — load profile/goals on tab switch
// ============================================================

var _ppf_origRenderActivePanel = renderActivePanel;
renderActivePanel = function(panelId) {
    // Call original
    _ppf_origRenderActivePanel(panelId);
    
    // Also load profile when switching to profile tab
    if (panelId === 'profile') {
        loadProfile();
    }
    
    // Load pension goals when switching to pension tab
    if (panelId === 'pension') {
        loadPensionGoals();
    }
};

// ============================================================
// PENSION GOALS: Load & Save (dedicated for pension tab)
// ============================================================

function loadPensionGoals() {
    var plan = getCurrentPlan();
    var goals = plan.goals;
    var profile = plan.profile;
    
    // Retirement ages
    var retAgeUser = document.getElementById('goalRetirementAgeUser');
    if (retAgeUser) retAgeUser.value = goals.retirement.userAge || '';
    
    var retAgeSpouse = document.getElementById('goalRetirementAgeSpouse');
    if (retAgeSpouse) retAgeSpouse.value = goals.retirement.spouseAge || '';
    
    // Monthly pension target
    var monthlyPension = document.getElementById('goalMonthlyPension');
    if (monthlyPension) monthlyPension.value = goals.retirement.monthlyPension || '';
    
    var isReal = document.getElementById('goalPensionIsReal');
    if (isReal) isReal.checked = goals.retirement.isRealValue !== false;
    
    // Equity goals
    var eqAmount = document.getElementById('goalEquityAmount');
    if (eqAmount) eqAmount.value = goals.equity.targetAmount || '';
    
    var eqYear = document.getElementById('goalEquityYear');
    if (eqYear) eqYear.value = goals.equity.targetYear || '';
    
    var eqIsReal = document.getElementById('goalEquityIsReal');
    if (eqIsReal) eqIsReal.checked = goals.equity.isRealValue !== false;
    
    // Show/hide spouse based on marital status
    var spouseGroup = document.getElementById('goalSpouseRetirementGroup');
    if (spouseGroup) {
        spouseGroup.style.display = (profile.maritalStatus === 'single') ? 'none' : 'block';
    }
    
    // Display profile info summary
    updatePensionProfileInfo();
}

function updatePensionProfileInfo() {
    var plan = getCurrentPlan();
    var profile = plan.profile;
    var infoEl = document.getElementById('pensionProfileInfo');
    if (!infoEl) return;
    
    var parts = [];
    if (profile.user.name) {
        var uAge = profile.user.age || '?';
        var uGender = profile.user.gender === 'female' ? 'נקבה' : 'זכר';
        parts.push('👨 ' + profile.user.name + ' (גיל ' + uAge + ', ' + uGender + ')');
    }
    if (profile.maritalStatus === 'married' && profile.spouse.name) {
        var sAge = profile.spouse.age || '?';
        var sGender = profile.spouse.gender === 'female' ? 'נקבה' : 'זכר';
        parts.push('👩 ' + profile.spouse.name + ' (גיל ' + sAge + ', ' + sGender + ')');
    }
    
    if (parts.length > 0) {
        infoEl.innerHTML = '<div style="font-size:0.85em;color:var(--text-secondary);padding:10px 14px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border);margin-bottom:16px;">' +
            '<strong>נתונים מהפרופיל:</strong> ' + parts.join(' · ') +
            ' <a href="#" onclick="openModule(\'profile\');return false;" style="color:var(--brand-primary);font-weight:600;">עריכה ←</a>' +
            '</div>';
    } else {
        infoEl.innerHTML = '<div class="alert alert-warning" style="margin-bottom:16px;"><span class="alert-icon">⚠️</span><div>נא למלא פרטים אישיים ב<a href="#" onclick="openModule(\'profile\');return false;" style="color:inherit;font-weight:700;">טאב הפרופיל</a> כדי לחשב פנסיה מדויקת.</div></div>';
    }
}

// Override saveGoals to also handle pension-specific save
var _ppf_origSaveGoals = saveGoals;
saveGoals = function() {
    var plan = getCurrentPlan();
    var goals = plan.goals;
    
    // Retirement goals
    var retAgeUser = document.getElementById('goalRetirementAgeUser');
    if (retAgeUser) goals.retirement.userAge = parseInt(retAgeUser.value) || null;
    
    var retAgeSpouse = document.getElementById('goalRetirementAgeSpouse');
    if (retAgeSpouse) goals.retirement.spouseAge = parseInt(retAgeSpouse.value) || null;
    
    var monthlyPension = document.getElementById('goalMonthlyPension');
    if (monthlyPension) goals.retirement.monthlyPension = parseFloat(monthlyPension.value) || null;
    
    var isReal = document.getElementById('goalPensionIsReal');
    if (isReal) goals.retirement.isRealValue = isReal.checked;
    
    // Equity goals
    var eqAmount = document.getElementById('goalEquityAmount');
    if (eqAmount) goals.equity.targetAmount = parseFloat(eqAmount.value) || null;
    
    var eqYear = document.getElementById('goalEquityYear');
    if (eqYear) goals.equity.targetYear = parseInt(eqYear.value) || null;
    
    var eqIsReal = document.getElementById('goalEquityIsReal');
    if (eqIsReal) goals.equity.isRealValue = eqIsReal.checked;
    
    saveData();
    
    // Sync life goals to roadmap
    if (typeof syncLifeGoalsToRoadmap === 'function') syncLifeGoalsToRoadmap();
    if (typeof renderWithdrawals === 'function') renderWithdrawals();
    
    showSaveNotification('✅ היעדים נשמרו בהצלחה!');
};

// ============================================================
// PENSION QUICK-ADD: Auto-fill from profile
// ============================================================

var _ppf_origSelectPenGender = selectPenGender;
selectPenGender = function(el, spouse, gender) {
    // Call original visual selection
    _ppf_origSelectPenGender(el, spouse, gender);
    
    // Auto-fill age from profile
    var plan = getCurrentPlan();
    var profile = plan.profile;
    var ageInput = document.getElementById('penAddAge');
    if (!ageInput) return;
    
    var profileAge = null;
    var profileGender = null;
    
    if (spouse === 'husband') {
        profileAge = profile.user.age || calculateAgeFromDate(profile.user.birthDate);
        profileGender = profile.user.gender;
    } else if (spouse === 'wife') {
        profileAge = profile.spouse.age || calculateAgeFromDate(profile.spouse.birthDate);
        profileGender = profile.spouse.gender;
    }
    
    if (profileAge) {
        ageInput.value = profileAge;
        ageInput.style.backgroundColor = 'var(--success-bg)';
        ageInput.title = 'גיל מחושב מהפרופיל';
    }
    
    // Update hidden gender field
    if (profileGender) {
        document.getElementById('penAddGender').value = profileGender;
    }
};

// ============================================================
// OVERRIDE: renderPensionTab — also pull profile data & load goals
// ============================================================

var _ppf_origRenderPensionTab = renderPensionTab;
renderPensionTab = function() {
    var plan = getCurrentPlan();
    var profile = plan.profile;
    
    // Update pension investment ages from profile before rendering
    plan.investments.forEach(function(inv) {
        if (inv.type !== 'פנסיה') return;
        
        if (inv.spouse === 'husband' || (!inv.spouse && inv.gender === 'male')) {
            var userAge = profile.user.age || calculateAgeFromDate(profile.user.birthDate);
            if (userAge) inv.age = userAge;
            if (profile.user.gender) inv.gender = profile.user.gender;
        } else if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) {
            var spouseAge = profile.spouse.age || calculateAgeFromDate(profile.spouse.birthDate);
            if (spouseAge) inv.age = spouseAge;
            if (profile.spouse.gender) inv.gender = profile.spouse.gender;
        }
    });
    
    // Call original render
    _ppf_origRenderPensionTab();
    
    // Load goals into form
    loadPensionGoals();
};

// ============================================================
// OVERRIDE: calculateMonthlyPensions — add NET REAL display
// ============================================================

var _ppf_origCalcMonthlyPensions = calculateMonthlyPensions;
calculateMonthlyPensions = function(husbandPensions, wifePensions) {
    // Call original (sets nominal, real, net)
    _ppf_origCalcMonthlyPensions(husbandPensions, wifePensions);
    
    // Now add net real calculation
    var years = parseInt(document.getElementById('pensionYears') && document.getElementById('pensionYears').value) || 20;
    var INFLATION = 0.02;
    var inflationFactor = Math.pow(1 + INFLATION, years);
    
    // Calculate husband net real
    var husbandTotalNominal = 0;
    husbandPensions.forEach(function(inv) {
        var futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                      inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        husbandTotalNominal += calculateMonthlyPension(futureValue, 'male');
    });
    var husbandNet = calculateNetPension(husbandTotalNominal);
    var husbandNetReal = husbandNet.net / inflationFactor;
    
    // Calculate wife net real
    var wifeTotalNominal = 0;
    wifePensions.forEach(function(inv) {
        var futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                      inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        wifeTotalNominal += calculateMonthlyPension(futureValue, 'female');
    });
    var wifeNet = calculateNetPension(wifeTotalNominal);
    var wifeNetReal = wifeNet.net / inflationFactor;
    
    // Combined net real
    var combinedNetReal = husbandNetReal + wifeNetReal;
    
    // Update display elements
    var elHNR = document.getElementById('pensionHusbandNetReal');
    var elWNR = document.getElementById('pensionWifeNetReal');
    var elCNR = document.getElementById('pensionCombinedNetReal');
    
    if (elHNR) elHNR.textContent = formatCurrency(husbandNetReal);
    if (elWNR) elWNR.textContent = formatCurrency(wifeNetReal);
    if (elCNR) elCNR.textContent = formatCurrency(combinedNetReal);
};

// ============================================================
// OVERRIDE: renderGoalProgress — EXCLUDE pension
// ============================================================

renderGoalProgress = function() {
    var container = document.getElementById('goalProgress');
    if (!container) return;
    
    var analysis = analyzeGoals();
    if (!analysis) {
        container.innerHTML = '<div class="alert alert-info">השלם את הפרופיל והיעדים כדי לראות התקדמות</div>';
        return;
    }
    
    // Check if there's anything to show (excluding pension)
    var hasEquity = !!analysis.equity;
    var hasLifeGoals = analysis.lifeGoals && analysis.lifeGoals.length > 0;
    
    if (!hasEquity && !hasLifeGoals) {
        container.innerHTML = '<div class="alert alert-info">הגדר יעדי הון או יעדי חיים כדי לראות התקדמות (יעדי פנסיה מוצגים בטאב הפנסיה)</div>';
        return;
    }
    
    var html = '<div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px;">';
    html += '<h3 style="margin: 0 0 16px 0;">🎯 התקדמות ביעדים</h3>';
    html += '<div style="display: grid; gap: 16px;">';
    
    // *** PENSION EXCLUDED — not shown here ***
    
    // Equity
    if (analysis.equity) {
        var e = analysis.equity;
        var color = e.status === 'success' ? '#10b981' : e.status === 'warning' ? '#f59e0b' : '#ef4444';
        var icon = e.status === 'success' ? '✅' : e.status === 'warning' ? '🟡' : '🔴';
        
        html += '<div style="background: rgba(255,255,255,0.25); padding: 16px; border-radius: 8px;">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
        html += '<div style="font-weight: bold; font-size: 1.1em; color: #1f2937;">💎 הון עצמי</div>';
        html += '<div style="font-size: 1.3em;">' + icon + '</div></div>';
        html += '<div style="font-size: 0.9em; color: #374151; margin-bottom: 8px;">יעד: ' + formatCurrency(e.target) + ' | צפי: ' + formatCurrency(e.projected) + '</div>';
        html += '<div style="background: rgba(0,0,0,0.2); height: 24px; border-radius: 12px; overflow: hidden; margin-bottom: 8px;">';
        html += '<div style="background: ' + color + '; height: 100%; width: ' + e.percentage + '%;"></div></div>';
        html += '<div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #4b5563;">';
        html += '<span>' + e.percentage.toFixed(0) + '% צפי</span>';
        html += '<span>' + (e.gap > 0 ? 'חסר' : 'עודף') + ': ' + formatCurrency(Math.abs(e.gap)) + '</span>';
        html += '</div></div>';
    }
    
    // Life Goals
    if (hasLifeGoals) {
        analysis.lifeGoals.forEach(function(lg) {
            var color = lg.status === 'success' ? '#10b981' : lg.status === 'warning' ? '#f59e0b' : '#ef4444';
            var icon = lg.status === 'success' ? '✅' : lg.status === 'warning' ? '🟡' : '🔴';
            
            html += '<div style="background: rgba(255,255,255,0.25); padding: 16px; border-radius: 8px;">';
            html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
            html += '<div style="font-weight: bold; font-size: 1.1em; color: #1f2937;">🎯 ' + lg.name + '</div>';
            html += '<div style="font-size: 1.3em;">' + icon + '</div></div>';
            html += '<div style="font-size: 0.9em; color: #374151; margin-bottom: 8px;">יעד: ' + formatCurrency(lg.target) + ' ב-' + lg.year + ' | צפי: ' + formatCurrency(lg.projected) + '</div>';
            html += '<div style="background: rgba(0,0,0,0.2); height: 24px; border-radius: 12px; overflow: hidden; margin-bottom: 8px;">';
            html += '<div style="background: ' + color + '; height: 100%; width: ' + lg.percentage + '%;"></div></div>';
            html += '<div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #4b5563;">';
            html += '<span>' + lg.percentage.toFixed(0) + '% צפי</span>';
            html += '<span>' + (lg.gap > 0 ? 'חסר' : 'עודף') + ': ' + formatCurrency(Math.abs(lg.gap)) + '</span>';
            html += '</div></div>';
        });
    }
    
    html += '</div></div>';
    container.innerHTML = html;
};

// ============================================================
// OVERRIDE: renderRecommendations — exclude pension recs
// ============================================================

var _ppf_origGenerateRecommendations = generateRecommendations;
generateRecommendations = function(analysis) {
    var recs = _ppf_origGenerateRecommendations(analysis);
    // Filter out pension-specific recommendations (they're in pension tab)
    return recs.filter(function(rec) {
        return rec.type !== 'pension';
    });
};

// ============================================================
// OVERRIDE: renderStrategyGoals — exclude pension from strategy
// ============================================================

var _ppf_origRenderStrategyGoals = (typeof renderStrategyGoals === 'function') ? renderStrategyGoals : null;
if (_ppf_origRenderStrategyGoals) {
    renderStrategyGoals = function() {
        var el = document.getElementById('strategyGoals');
        if (!el) return;
        if (typeof analyzeGoals !== 'function') { el.innerHTML = '<p style="color:var(--text-secondary);">לא ניתן לטעון ניתוח</p>'; return; }
        
        var analysis = analyzeGoals();
        if (!analysis) { el.innerHTML = '<p style="color:var(--text-secondary);">השלם פרופיל ויעדים</p>'; return; }
        
        var html = '';
        
        // *** PENSION EXCLUDED from strategy goals ***
        
        // Equity
        if (analysis.equity) {
            var e = analysis.equity;
            var sC = e.status === 'success' ? 'strat-ok' : e.status === 'warning' ? 'strat-warn' : 'strat-bad';
            var sI = e.status === 'success' ? '✅' : e.status === 'warning' ? '🟡' : '🔴';
            var sT = e.status === 'success' ? 'במסלול' : e.status === 'warning' ? 'דורש תשומת לב' : 'בסיכון';
            html += '<div class="strat-row ' + sC + '"><div class="strat-row-icon">' + sI + '</div><div class="strat-row-body"><div class="strat-row-title">יעד הון עצמי</div><div class="strat-row-detail">יעד: ' + formatCurrency(e.target) + ' → צפי: ' + formatCurrency(e.projected) + '</div><div class="strat-row-status">' + sT + ' · ' + e.percentage.toFixed(0) + '%</div></div></div>';
        }
        
        // Life goals
        if (analysis.lifeGoals) {
            analysis.lifeGoals.forEach(function(lg) {
                var c = lg.status === 'success' ? 'strat-ok' : lg.status === 'warning' ? 'strat-warn' : 'strat-bad';
                var i = lg.status === 'success' ? '✅' : lg.status === 'warning' ? '🟡' : '🔴';
                html += '<div class="strat-row ' + c + '"><div class="strat-row-icon">' + i + '</div><div class="strat-row-body"><div class="strat-row-title">' + lg.name + ' (' + lg.year + ')</div><div class="strat-row-detail">יעד: ' + formatCurrency(lg.target) + ' → צפי: ' + formatCurrency(lg.projected) + '</div><div class="strat-row-status">' + lg.percentage.toFixed(0) + '%</div></div></div>';
            });
        }
        
        // Note about pension
        html += '<div class="strat-row" style="background:var(--brand-bg);border-color:var(--brand-pale);"><div class="strat-row-icon">💰</div><div class="strat-row-body"><div class="strat-row-title">יעדי פנסיה</div><div class="strat-row-detail">ניתוח יעדי הפנסיה זמין <a href="#" onclick="openModule(\'pension\');return false;" style="color:var(--brand-primary);font-weight:700;">בטאב הפנסיה</a></div></div></div>';
        
        el.innerHTML = html || '<p style="color:var(--text-secondary);">לא הוגדרו יעדים</p>';
    };
}

// ============================================================
// PENSION TAB: Render pension-specific goal progress
// ============================================================

var _ppf_origRenderPensionTab2 = renderPensionTab;
renderPensionTab = function() {
    _ppf_origRenderPensionTab2();
    renderPensionGoalProgress();
};

function renderPensionGoalProgress() {
    var container = document.getElementById('pensionGoalProgress');
    if (!container) return;
    
    var analysis = analyzeGoals();
    if (!analysis || !analysis.pension) {
        container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:0.9em;">הגדר יעדי פרישה למעלה כדי לראות ניתוח פערים</div>';
        return;
    }
    
    var p = analysis.pension;
    var color = p.status === 'success' ? 'var(--success)' : p.status === 'warning' ? 'var(--warning)' : 'var(--danger)';
    var icon = p.status === 'success' ? '✅' : p.status === 'warning' ? '🟡' : '🔴';
    var gapText = p.gap > 0 ? 'חסר ' + formatCurrency(p.gap) + '/חודש' : 'עודף ' + formatCurrency(Math.abs(p.gap)) + '/חודש';
    
    var html = '<div class="card" style="border:2px solid ' + color + ';margin-top:20px;">';
    html += '<div class="card-title" style="margin-bottom:16px;">' + icon + ' ניתוח פערים — יעד קצבה</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">';
    html += '<div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">יעד (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;">' + formatCurrency(p.target) + '/חודש</div></div>';
    html += '<div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">צפי (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;color:' + color + ';">' + formatCurrency(p.projected) + '/חודש</div></div>';
    html += '</div>';
    
    // Progress bar
    html += '<div style="background:var(--border);height:28px;border-radius:14px;overflow:hidden;margin-bottom:12px;">';
    html += '<div style="background:' + color + ';height:100%;width:' + Math.min(p.percentage, 100) + '%;transition:width 0.5s;display:flex;align-items:center;justify-content:center;font-size:0.85em;font-weight:700;color:white;">' + p.percentage.toFixed(0) + '%</div></div>';
    
    html += '<div style="text-align:center;font-size:0.95em;font-weight:600;color:' + color + ';">' + gapText + '</div>';
    html += '</div>';
    
    container.innerHTML = html;
}

// ============================================================
// MIGRATION: Add birthDate to existing profiles
// ============================================================

(function migrateProfileBirthDates() {
    try {
        var saved = localStorage.getItem('financialPlannerProV3');
        if (!saved) return;
        var data = JSON.parse(saved);
        var changed = false;
        
        data.plans.forEach(function(plan) {
            if (!plan.profile) return;
            
            // If age exists but no birthDate, estimate birthDate from age
            if (plan.profile.user && plan.profile.user.age && !plan.profile.user.birthDate) {
                var year = new Date().getFullYear() - plan.profile.user.age;
                plan.profile.user.birthDate = year + '-01-01';
                changed = true;
            }
            if (plan.profile.spouse && plan.profile.spouse.age && !plan.profile.spouse.birthDate) {
                var year = new Date().getFullYear() - plan.profile.spouse.age;
                plan.profile.spouse.birthDate = year + '-01-01';
                changed = true;
            }
        });
        
        if (changed) {
            localStorage.setItem('financialPlannerProV3', JSON.stringify(data));
            console.log('✅ Migrated profile: estimated birthDates from ages');
        }
    } catch(e) { console.error('Profile migration error:', e); }
})();

console.log('✅ pension-profile-fix.js v1 loaded');
