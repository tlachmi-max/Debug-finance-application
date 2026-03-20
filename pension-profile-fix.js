// pension-profile-fix.js v7 — SINGLE SOURCE OF TRUTH for net pension
// Architecture: 
// - ppfAfterPensionRender() called DIRECTLY from inline script
// - calculateNetPension: UNIFIED gender-aware tax function (replaces script.js version)
// - calculateMonthlyPensions overridden to use unified net calc
// - analyzeGoals overridden to call the SAME pension calc path
// - NO renderPensionTab override (that's what kept breaking)
console.log('✅ pension-profile-fix.js v7 loading...');

// === HELPERS ===
function calculateAgeFromDate(bd){if(!bd)return null;var b=new Date(bd);if(isNaN(b))return null;var t=new Date(),a=t.getFullYear()-b.getFullYear(),m=t.getMonth()-b.getMonth();if(m<0||(m===0&&t.getDate()<b.getDate()))a--;return a>=0?a:null;}
function updateAgeDisplay(w){var p=w==='spouse'?'spouse':'user',d=document.getElementById(p+'BirthDate'),s=document.getElementById(p+'AgeDisplay'),h=document.getElementById(p+'Age');if(!d||!s)return;var a=calculateAgeFromDate(d.value);if(a!==null&&a>=0&&a<=120){s.textContent='גיל: '+a;s.style.color='var(--success)';if(h)h.value=a;}else{s.textContent='';if(h)h.value='';}}
function getProfileAge(w){var pl=getCurrentPlan(),p=pl.profile;if(w==='user'||w==='husband')return p.user.age||calculateAgeFromDate(p.user.birthDate)||null;return p.spouse.age||calculateAgeFromDate(p.spouse.birthDate)||null;}

function getFinalRetirementInfo(){
    var pl=getCurrentPlan(),g=pl.goals,cy=new Date().getFullYear();
    var uAge=getProfileAge('user'),sAge=getProfileAge('spouse');
    var uRA=g.retirement.userAge,sRA=g.retirement.spouseAge;
    var uYrs=null,sYrs=null,uYr=null,sYr=null;
    if(uAge&&uRA&&uRA>uAge){uYrs=uRA-uAge;uYr=cy+uYrs;}
    if(sAge&&sRA&&sRA>sAge){sYrs=sRA-sAge;sYr=cy+sYrs;}
    var fY=null,fYrs=null;
    if(uYr&&sYr){fY=Math.max(uYr,sYr);fYrs=fY-cy;}
    else if(uYr){fY=uYr;fYrs=uYrs;}
    else if(sYr){fY=sYr;fYrs=sYrs;}
    return{uAge:uAge,sAge:sAge,uRA:uRA,sRA:sRA,uYr:uYr,sYr:sYr,uYrs:uYrs,sYrs:sYrs,fY:fY,fYrs:fYrs};
}

// Per-person retirement years (husband uses his age, wife uses hers)
function getPersonRetirementYears(who) {
    var info = getFinalRetirementInfo();
    if (who === 'husband' || who === 'user') return info.uYrs || info.fYrs || 20;
    if (who === 'wife' || who === 'spouse') return info.sYrs || info.fYrs || 20;
    return info.fYrs || 20;
}

// ============================================================
// ★ UNIFIED NET PENSION CALCULATOR — Single Source of Truth
// ============================================================
// Israeli pension tax rules (simplified but consistent):
//   - Credit points: male 2.25, female 2.75
//   - Credit point value: ~2,904 NIS/year → ~242 NIS/month
//   - Exempt ceiling: male ~5,480/mo, female ~6,655/mo (from credit points alone)
//   - Above ceiling: marginal rate 10%-15% depending on bracket
//   - Simplified model: exempt up to ceiling, 15% on remainder
//   - This replaces the old script.js calculateNetPension to avoid double-dipping
// ============================================================

var PPF_TAX_CREDIT_MONTHLY_MALE = 242;   // ₪ per credit point per month
var PPF_TAX_CREDIT_MONTHLY_FEMALE = 242;
var PPF_CREDIT_POINTS_MALE = 2.25;
var PPF_CREDIT_POINTS_FEMALE = 2.75;
var PPF_PENSION_TAX_RATE = 0.15;  // effective marginal rate above exempt ceiling

// Central function — EVERY pension net calculation goes through here
function calculateNetPension(grossMonthly, gender) {
    if (!grossMonthly || grossMonthly <= 0) {
        return { gross: 0, net: 0, tax: 0, effectiveRate: 0, exempt: 0 };
    }
    
    var creditPoints = (gender === 'female') ? PPF_CREDIT_POINTS_FEMALE : PPF_CREDIT_POINTS_MALE;
    var creditValue = (gender === 'female') ? PPF_TAX_CREDIT_MONTHLY_FEMALE : PPF_TAX_CREDIT_MONTHLY_MALE;
    
    // Monthly tax credit = credit points × value per point
    var monthlyCredit = creditPoints * creditValue;  // male: ~545, female: ~666
    
    // Exempt ceiling: the gross amount where tax = credit (i.e. net tax = 0)
    // tax_before_credit = gross × rate
    // net_tax = max(0, tax_before_credit - credit)
    // exempt ceiling = credit / rate
    var exemptCeiling = monthlyCredit / PPF_PENSION_TAX_RATE;  // male: ~3,630, female: ~4,440
    
    // But Israel also has a partial pension exemption (35% of pension up to a ceiling is exempt)
    // Simplified: we model a higher effective exempt ceiling
    // Realistic exempt zone for pension income ≈ male ~8,000, female ~9,000
    // We use a blended model: 
    //   - First 8,000 (male) / 9,000 (female): exempt
    //   - Above that: 15% tax
    var BLENDED_EXEMPT_MALE = 8000;
    var BLENDED_EXEMPT_FEMALE = 9000;
    var exemptAmount = (gender === 'female') ? BLENDED_EXEMPT_FEMALE : BLENDED_EXEMPT_MALE;
    
    var taxableAmount = Math.max(0, grossMonthly - exemptAmount);
    var tax = taxableAmount * PPF_PENSION_TAX_RATE;
    var net = grossMonthly - tax;
    var effectiveRate = grossMonthly > 0 ? (tax / grossMonthly) * 100 : 0;
    
    return {
        gross: grossMonthly,
        net: net,
        tax: tax,
        effectiveRate: effectiveRate,
        exempt: exemptAmount
    };
}

// ============================================================
// ★ UNIFIED PENSION PROJECTION — calculates everything per-person
//   Returns a complete result object used by BOTH tabs
// ============================================================

function calculateFullPensionProjection() {
    var plan = getCurrentPlan();
    var info = getFinalRetirementInfo();
    var hYears = getPersonRetirementYears('husband');
    var wYears = getPersonRetirementYears('wife');
    var hInfl = Math.pow(1.02, hYears);
    var wInfl = Math.pow(1.02, wYears);
    
    // Separate pension investments by person
    var husbandPensions = [];
    var wifePensions = [];
    plan.investments.forEach(function(inv) {
        if (!inv.include || inv.type !== 'פנסיה') return;
        if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) {
            wifePensions.push(inv);
        } else {
            husbandPensions.push(inv);
        }
    });
    
    // Husband: calculate with HIS years
    var hNom = 0;
    husbandPensions.forEach(function(inv) {
        var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, hYears,
                            inv.feeDeposit||0, inv.feeAnnual||0, inv.subTracks);
        hNom += calculateMonthlyPension(fv, inv.gender || 'male');
    });
    
    // Wife: calculate with HER years
    var wNom = 0;
    wifePensions.forEach(function(inv) {
        var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, wYears,
                            inv.feeDeposit||0, inv.feeAnnual||0, inv.subTracks);
        wNom += calculateMonthlyPension(fv, inv.gender || 'female');
    });
    
    // Real values (per-person inflation)
    var hReal = hNom / hInfl;
    var wReal = wNom / wInfl;
    
    // Net per person — UNIFIED calculateNetPension
    var hNet = calculateNetPension(hNom, 'male');
    var wNet = calculateNetPension(wNom, 'female');
    
    // Net real per person (each with own inflation)
    var hNR = hNet.net / hInfl;
    var wNR = wNet.net / wInfl;
    
    // Combined
    var cNom = hNom + wNom;
    var cReal = hReal + wReal;
    var cNet = hNet.net + wNet.net;
    var cTax = hNet.tax + wNet.tax;
    var cNR = hNR + wNR;
    var cEffRate = cNom > 0 ? ((cTax / cNom) * 100) : 0;
    
    return {
        husband: {
            nominal: hNom, real: hReal,
            net: hNet.net, tax: hNet.tax, effectiveRate: hNet.effectiveRate,
            netReal: hNR, years: hYears, inflation: hInfl,
            pensions: husbandPensions
        },
        wife: {
            nominal: wNom, real: wReal,
            net: wNet.net, tax: wNet.tax, effectiveRate: wNet.effectiveRate,
            netReal: wNR, years: wYears, inflation: wInfl,
            pensions: wifePensions
        },
        combined: {
            nominal: cNom, real: cReal,
            net: cNet, tax: cTax, effectiveRate: cEffRate,
            netReal: cNR
        },
        info: info
    };
}

// ============================================================
// ★ Override calculateMonthlyPensions — uses unified projection
// ============================================================

var _v7_origCMP = calculateMonthlyPensions;
calculateMonthlyPensions = function(husbandPensions, wifePensions) {
    // Call original first (for any side effects / DOM it sets up)
    _v7_origCMP(husbandPensions, wifePensions);
    
    // Now RECALCULATE with unified projection
    try {
        var proj = calculateFullPensionProjection();
        var h = proj.husband, w = proj.wife, c = proj.combined;
        
        console.log('★ v7 UNIFIED CALC: H=' + h.years + 'yrs W=' + w.years + 'yrs');
        console.log('  H: nom=' + Math.round(h.nominal) + ' real=' + Math.round(h.real) + ' net=' + Math.round(h.net) + ' netReal=' + Math.round(h.netReal));
        console.log('  W: nom=' + Math.round(w.nominal) + ' real=' + Math.round(w.real) + ' net=' + Math.round(w.net) + ' netReal=' + Math.round(w.netReal));
        console.log('  C: nom=' + Math.round(c.nominal) + ' real=' + Math.round(c.real) + ' net=' + Math.round(c.net) + ' netReal=' + Math.round(c.netReal));
        
        // Override ALL display values
        var sets = {
            'pensionHusbandNominal': h.nominal, 'pensionHusbandReal': h.real,
            'pensionHusbandNet': h.net, 'pensionWifeNominal': w.nominal,
            'pensionWifeReal': w.real, 'pensionWifeNet': w.net,
            'pensionCombinedNominal': c.nominal, 'pensionCombinedReal': c.real,
            'pensionCombinedNet': c.net,
            'ppfHusbandNetReal': h.netReal, 'ppfWifeNetReal': w.netReal, 'ppfCombinedNetReal': c.netReal,
            'pensionHusbandNetReal': h.netReal, 'pensionWifeNetReal': w.netReal, 'pensionCombinedNetReal': c.netReal
        };
        Object.keys(sets).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = formatCurrency(sets[id]);
        });
        
        // Tax display
        var hTaxEl = document.getElementById('pensionHusbandTax');
        if (hTaxEl) hTaxEl.textContent = h.tax > 0 ? 'מס: ' + formatCurrency(h.tax) + ' (' + h.effectiveRate.toFixed(1) + '%)' : '✅ פטור';
        var wTaxEl = document.getElementById('pensionWifeTax');
        if (wTaxEl) wTaxEl.textContent = w.tax > 0 ? 'מס: ' + formatCurrency(w.tax) + ' (' + w.effectiveRate.toFixed(1) + '%)' : '✅ פטור';
        var cTaxEl = document.getElementById('pensionCombinedTax');
        if (cTaxEl) cTaxEl.textContent = c.tax > 0 ? 'מס: ' + formatCurrency(c.tax) + '/חודש (' + c.effectiveRate.toFixed(1) + '%)' : '✅ פטור מלא';
        
    } catch(err) {
        console.error('v7 calculateMonthlyPensions error:', err);
    }
};

// ============================================================
// Override renderPensionList: use per-person retirement years
// ============================================================

var _v7_origRPL = renderPensionList;
renderPensionList = function(containerId, pensions, gender) {
    var container = document.getElementById(containerId);
    if (pensions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">אין קופות פנסיה</div></div>';
        return;
    }
    var who = (gender === 'female') ? 'wife' : 'husband';
    var years = getPersonRetirementYears(who);
    var info = getFinalRetirementInfo();
    var retYear = (who === 'wife') ? info.sYr : info.uYr;
    var currentYear = new Date().getFullYear();
    
    var html = '';
    pensions.forEach(function(inv) {
        var futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                     inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        var monthlyPension = calculateMonthlyPension(futureValue, gender);
        
        html += '<div style="padding:16px;margin-bottom:12px;border-radius:12px;background:var(--bg-surface);border:1px solid var(--border);">';
        html += '<div style="font-weight:bold;font-size:1.1em;color:var(--text-primary);">' + inv.name + '</div>';
        html += '<div style="font-size:0.9em;color:var(--text-secondary);margin-top:4px;">' + inv.house + '</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">';
        html += '<div><div style="font-size:0.85em;color:var(--text-secondary);">יתרה היום</div><div style="font-weight:bold;color:var(--brand-primary);">' + formatCurrency(inv.amount) + '</div></div>';
        html += '<div><div style="font-size:0.85em;color:var(--text-secondary);">הפקדה חודשית</div><div style="font-weight:bold;color:var(--success);">' + formatCurrency(inv.monthly) + '</div></div></div>';
        html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">';
        html += '<div style="font-size:0.85em;color:var(--text-secondary);">צפי ב-' + (retYear || (currentYear + years)) + ' (בעוד ' + years + ' שנים)</div>';
        html += '<div style="font-weight:bold;font-size:1.2em;color:var(--success);">' + formatCurrency(futureValue) + '</div>';
        html += '<div style="font-size:0.9em;color:var(--brand-primary);margin-top:4px;">קצבה חודשית: ' + formatCurrency(monthlyPension) + '</div>';
        html += '</div></div>';
    });
    
    container.innerHTML = html;
};

// ============================================================
// ★ ppfBeforePensionRender — sets pensionYears BEFORE render
// ============================================================

function ppfBeforePensionRender() {
    try {
        var plan = getCurrentPlan(), pr = plan.profile, g = plan.goals;
        
        if (!g.retirement.userAge && pr.user.gender) {
            g.retirement.userAge = pr.user.gender === 'female' ? 62 : 67;
        }
        if (!g.retirement.spouseAge && pr.spouse.gender && pr.maritalStatus === 'married') {
            g.retirement.spouseAge = pr.spouse.gender === 'female' ? 62 : 67;
        }
        
        var info = getFinalRetirementInfo();
        
        if (info.fYrs && info.fYrs > 0) {
            var pyEl = document.getElementById('pensionYears');
            if (pyEl) {
                pyEl.value = info.fYrs;
                console.log('★ ppfBEFORE: pensionYears set to ' + info.fYrs);
            }
        }
        
        // Sync ages from profile into pension investments
        plan.investments.forEach(function(inv) {
            if (inv.type !== 'פנסיה') return;
            if (inv.spouse === 'husband' || (!inv.spouse && inv.gender === 'male')) {
                var a = getProfileAge('user'); if (a) inv.age = a;
                if (pr.user.gender) inv.gender = pr.user.gender;
            } else if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) {
                var a2 = getProfileAge('spouse'); if (a2) inv.age = a2;
                if (pr.spouse.gender) inv.gender = pr.spouse.gender;
            }
        });
    } catch(err) {
        console.error('ppfBeforePensionRender error:', err);
    }
}

// ============================================================
// ★ ppfAfterPensionRender — called from inline script
// ============================================================

function ppfAfterPensionRender() {
    try {
        console.log('★ ppfAfterPensionRender running');
        
        var plan = getCurrentPlan(), pr = plan.profile;
        var info = getFinalRetirementInfo();
        
        if (info.fYrs && info.fYrs > 0) {
            var pyEl = document.getElementById('pensionYears');
            if (pyEl) pyEl.value = info.fYrs;
        }
        
        // Sync ages from profile into pension investments
        plan.investments.forEach(function(inv) {
            if (inv.type !== 'פנסיה') return;
            if (inv.spouse==='husband'||(!inv.spouse&&inv.gender==='male')) {
                var a=getProfileAge('user'); if(a)inv.age=a;
                if(pr.user.gender)inv.gender=pr.user.gender;
            } else if(inv.spouse==='wife'||(!inv.spouse&&inv.gender==='female')) {
                var a2=getProfileAge('spouse'); if(a2)inv.age=a2;
                if(pr.spouse.gender)inv.gender=pr.spouse.gender;
            }
        });
        
        loadPensionGoals();
        renderRetirementYearHero();
        renderPensionGoalProgress();
        
    } catch(err) {
        console.error('ppfAfterPensionRender error:', err);
    }
}

// ============================================================
// PROFILE
// ============================================================

loadProfile=function(){var pl=getCurrentPlan(),pr=pl.profile;var r=document.querySelector('input[name="maritalStatus"][value="'+pr.maritalStatus+'"]');if(r)r.checked=true;var e;e=document.getElementById('userName');if(e)e.value=pr.user.name||'';e=document.getElementById('userGender');if(e)e.value=pr.user.gender||'male';e=document.getElementById('userBirthDate');if(e){e.value=pr.user.birthDate||'';updateAgeDisplay('user');}if(!pr.user.birthDate&&pr.user.age){var d=document.getElementById('userAgeDisplay');if(d){d.textContent='גיל: '+pr.user.age+' (הזן תאריך לידה)';d.style.color='var(--warning)';}var h=document.getElementById('userAge');if(h)h.value=pr.user.age;}e=document.getElementById('spouseName');if(e)e.value=pr.spouse.name||'';e=document.getElementById('spouseGender');if(e)e.value=pr.spouse.gender||'female';e=document.getElementById('spouseBirthDate');if(e){e.value=pr.spouse.birthDate||'';updateAgeDisplay('spouse');}if(!pr.spouse.birthDate&&pr.spouse.age){var sd=document.getElementById('spouseAgeDisplay');if(sd){sd.textContent='גיל: '+pr.spouse.age;sd.style.color='var(--warning)';}var sh=document.getElementById('spouseAge');if(sh)sh.value=pr.spouse.age;}if(typeof updateMaritalStatus==='function')updateMaritalStatus();if(typeof renderChildren==='function')renderChildren();};

saveProfile=function(){var pl=getCurrentPlan(),pr=pl.profile;pr.user.name=(document.getElementById('userName').value||'').trim();pr.user.gender=document.getElementById('userGender').value;var ub=document.getElementById('userBirthDate');if(ub&&ub.value){pr.user.birthDate=ub.value;pr.user.age=calculateAgeFromDate(ub.value);}else{var ma=parseInt(document.getElementById('userAge').value);if(ma>=18&&ma<=120)pr.user.age=ma;}if(pr.maritalStatus==='married'){pr.spouse.name=(document.getElementById('spouseName').value||'').trim();pr.spouse.gender=document.getElementById('spouseGender').value;var sb=document.getElementById('spouseBirthDate');if(sb&&sb.value){pr.spouse.birthDate=sb.value;pr.spouse.age=calculateAgeFromDate(sb.value);}else{var sma=parseInt(document.getElementById('spouseAge').value);if(sma>=18&&sma<=120)pr.spouse.age=sma;}}if(!pr.user.name){alert('נא להזין שם');return;}if(!pr.user.age||pr.user.age<18){alert('נא להזין תאריך לידה תקין');return;}if(pr.maritalStatus==='married'){if(!pr.spouse.name){alert('נא להזין שם בן/בת הזוג');return;}if(!pr.spouse.age||pr.spouse.age<18){alert('נא להזין תאריך לידה תקין');return;}}pl.investments.forEach(function(inv){if(inv.type!=='פנסיה')return;if(inv.spouse==='husband'||(!inv.spouse&&inv.gender==='male')){inv.age=pr.user.age;inv.gender=pr.user.gender;}else if(inv.spouse==='wife'||(!inv.spouse&&inv.gender==='female')){inv.age=pr.spouse.age;inv.gender=pr.spouse.gender;}});saveData();showSaveNotification('✅ הפרופיל נשמר!');};

// ============================================================
// PENSION GOALS
// ============================================================

function loadPensionGoals(){
    var pl=getCurrentPlan(),g=pl.goals,pr=pl.profile;var el;
    if(!g.retirement.userAge && pr.user.gender){
        g.retirement.userAge = pr.user.gender === 'female' ? 62 : 67;
        saveData();
    }
    if(!g.retirement.spouseAge && pr.spouse.gender && pr.maritalStatus === 'married'){
        g.retirement.spouseAge = pr.spouse.gender === 'female' ? 62 : 67;
        saveData();
    }
    el=document.getElementById('goalRetirementAgeUser');if(el)el.value=g.retirement.userAge||'';
    el=document.getElementById('goalRetirementAgeSpouse');if(el)el.value=g.retirement.spouseAge||'';
    el=document.getElementById('goalMonthlyPension');if(el)el.value=g.retirement.monthlyPension||'';
    el=document.getElementById('goalPensionIsReal');if(el)el.checked=g.retirement.isRealValue!==false;
    el=document.getElementById('goalEquityAmount');if(el)el.value=g.equity.targetAmount||'';
    el=document.getElementById('goalSpouseRetirementGroup');if(el)el.style.display=(pr.maritalStatus==='single')?'none':'block';
    updateRetirementCalcDisplay();
    updatePensionProfileInfo();
}

function onRetirementAgeChange(){
    var pl=getCurrentPlan(),g=pl.goals;var el;
    el=document.getElementById('goalRetirementAgeUser');if(el)g.retirement.userAge=parseInt(el.value)||null;
    el=document.getElementById('goalRetirementAgeSpouse');if(el)g.retirement.spouseAge=parseInt(el.value)||null;
    var info=getFinalRetirementInfo();
    if(info.fY)g.equity.targetYear=info.fY;
    if(info.fYrs){var pyEl=document.getElementById('pensionYears');if(pyEl)pyEl.value=info.fYrs;}
    saveData();
    updateRetirementCalcDisplay();
    renderRetirementYearHero();
    if(typeof renderPensionTab==='function')renderPensionTab();
    if(typeof renderPensionTracksList==='function')renderPensionTracksList();
    renderPensionGoalProgress();
}

saveGoals=function(){
    var pl=getCurrentPlan(),g=pl.goals;var el;
    el=document.getElementById('goalRetirementAgeUser');if(el)g.retirement.userAge=parseInt(el.value)||null;
    el=document.getElementById('goalRetirementAgeSpouse');if(el)g.retirement.spouseAge=parseInt(el.value)||null;
    el=document.getElementById('goalMonthlyPension');if(el)g.retirement.monthlyPension=parseFloat(el.value)||null;
    el=document.getElementById('goalPensionIsReal');if(el)g.retirement.isRealValue=el.checked;
    el=document.getElementById('goalEquityAmount');if(el)g.equity.targetAmount=parseFloat(el.value)||null;
    var info=getFinalRetirementInfo();if(info.fY)g.equity.targetYear=info.fY;
    g.equity.isRealValue=true;
    saveData();
    if(typeof syncLifeGoalsToRoadmap==='function')syncLifeGoalsToRoadmap();
    if(typeof renderWithdrawals==='function')renderWithdrawals();
    onRetirementAgeChange();
    showSaveNotification('✅ היעדים נשמרו!');
};

// ============================================================
// UI HELPERS
// ============================================================

function updateRetirementCalcDisplay(){
    var info=getFinalRetirementInfo();
    var uc=document.getElementById('retirementUserCalc');
    if(uc){if(info.uAge&&info.uYr)uc.innerHTML='<span style="color:var(--success);font-weight:600;">גיל '+info.uAge+' → שנת '+info.uYr+' (בעוד '+info.uYrs+' שנים)</span>';else if(info.uAge)uc.innerHTML='<span style="color:var(--text-secondary);">גיל: '+info.uAge+'</span>';else uc.innerHTML='<span style="color:var(--warning);">⚠️ הגדר תאריך לידה</span>';}
    var sc=document.getElementById('retirementSpouseCalc');
    if(sc){if(info.sAge&&info.sYr)sc.innerHTML='<span style="color:var(--success);font-weight:600;">גיל '+info.sAge+' → שנת '+info.sYr+' (בעוד '+info.sYrs+' שנים)</span>';else if(info.sAge)sc.innerHTML='<span style="color:var(--text-secondary);">גיל: '+info.sAge+'</span>';else sc.innerHTML='';}
}

function renderRetirementYearHero(){
    var el=document.getElementById('retirementYearHero');if(!el)return;
    var info=getFinalRetirementInfo();
    if(!info.fY){el.innerHTML='';return;}
    var parts=[];
    if(info.uYr)parts.push('<div>👨 בעל: '+info.uYr+' (גיל '+info.uRA+')</div>');
    if(info.sYr)parts.push('<div>👩 אשה: '+info.sYr+' (גיל '+info.sRA+')</div>');
    el.innerHTML='<div style="background:linear-gradient(135deg,var(--brand-deep),var(--brand-primary));color:white;border-radius:var(--radius-xl);padding:28px;margin-bottom:20px;text-align:center;">'+
        '<div style="font-size:0.9em;opacity:0.85;margin-bottom:8px;">שנת פרישה סופית (המאוחרת מבין בני הזוג)</div>'+
        '<div style="font-size:3em;font-weight:800;letter-spacing:-0.02em;">'+info.fY+'</div>'+
        '<div style="font-size:1.1em;margin-top:6px;opacity:0.9;">בעוד '+info.fYrs+' שנים</div>'+
        '<div style="display:flex;justify-content:center;gap:24px;margin-top:16px;font-size:0.88em;opacity:0.85;">'+parts.join('')+'</div>'+
        '</div>';
    var basis=document.getElementById('pensionCalcBasis');
    if(basis) {
        var bParts = [];
        if(info.uYr) bParts.push('👨 בעל: ' + info.uYr + ' (בעוד ' + info.uYrs + ' שנים)');
        if(info.sYr) bParts.push('👩 אשה: ' + info.sYr + ' (בעוד ' + info.sYrs + ' שנים)');
        basis.innerHTML = '📅 הקצבה מחושבת לכל אחד לפי שנת הפרישה שלו: ' + bParts.join(' · ');
    }
}

function updatePensionProfileInfo(){
    var pl=getCurrentPlan(),pr=pl.profile;
    var el=document.getElementById('pensionProfileInfo');if(!el)return;
    var parts=[];
    if(pr.user.name)parts.push('👨 '+pr.user.name+' (גיל '+(getProfileAge('user')||'?')+')');
    if(pr.maritalStatus==='married'&&pr.spouse.name)parts.push('👩 '+pr.spouse.name+' (גיל '+(getProfileAge('spouse')||'?')+')');
    if(parts.length>0)el.innerHTML='<div style="font-size:0.85em;color:var(--text-secondary);padding:10px 14px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border);margin-bottom:16px;"><strong>מהפרופיל:</strong> '+parts.join(' · ')+' <a href="#" onclick="openModule(\'profile\');return false;" style="color:var(--brand-primary);font-weight:600;">עריכה</a></div>';
    else el.innerHTML='<div class="alert alert-warning" style="margin-bottom:16px;"><span class="alert-icon">⚠️</span><div>נא למלא ב<a href="#" onclick="openModule(\'profile\');return false;" style="font-weight:700;">טאב הפרופיל</a></div></div>';
}

// ============================================================
// selectPenGender — auto-fill age
// ============================================================

var _v7_origSPG = selectPenGender;
selectPenGender = function(el,sp,gn) {
    _v7_origSPG(el,sp,gn);
    var ai = document.getElementById('penAddAge'); if(!ai) return;
    var pa = (sp==='husband') ? getProfileAge('user') : getProfileAge('spouse');
    if(pa) { ai.value = pa; ai.style.backgroundColor = 'var(--success-bg)'; }
    var pl = getCurrentPlan(), pr = pl.profile;
    if(sp==='husband'&&pr.user.gender) document.getElementById('penAddGender').value = pr.user.gender;
    else if(sp==='wife'&&pr.spouse.gender) document.getElementById('penAddGender').value = pr.spouse.gender;
};

// ============================================================
// ★ KEY FIX: Override analyzeGoals — uses SAME unified projection
// ============================================================

var _v7_origAG = analyzeGoals;
analyzeGoals = function() {
    var results = _v7_origAG();
    if (!results) return results;
    
    var info = getFinalRetirementInfo();
    var pl = getCurrentPlan(), g = pl.goals;
    
    if (results.pension && info.fYrs && info.fYrs > 0) {
        // ★ USE THE SAME unified projection as pension tab
        var proj = calculateFullPensionProjection();
        var projNetReal = proj.combined.netReal;
        
        console.log('★ v7 analyzeGoals: using unified projection, netReal=' + Math.round(projNetReal));
        
        var target = g.retirement.monthlyPension || 0;
        var gap = target - projNetReal;
        var pct = target > 0 ? (projNetReal / target) * 100 : 100;
        
        results.pension = {
            target: target,
            projected: projNetReal,
            gap: gap,
            percentage: Math.min(pct, 100),
            yearsUntil: info.fYrs,
            retirementYear: info.fY,
            status: pct >= 100 ? 'success' : pct >= 80 ? 'warning' : 'danger'
        };
    }
    
    return results;
};

// ============================================================
// EXCLUDE pension from summary goals + recommendations
// ============================================================

renderGoalProgress = function() {
    var ct = document.getElementById('goalProgress'); if (!ct) return;
    var an = analyzeGoals();
    if (!an) { ct.innerHTML = '<div class="alert alert-info">השלם פרופיל ויעדים</div>'; return; }
    var hE = !!an.equity, hL = an.lifeGoals && an.lifeGoals.length > 0;
    if (!hE && !hL) { ct.innerHTML = '<div class="alert alert-info">הגדר יעדי הון או יעדי חיים<br><small>(פנסיה בטאב הפנסיה)</small></div>'; return; }
    function mkBar(name, ic, tgt, proj, pct, gap, st) {
        var c=st==='success'?'#10b981':st==='warning'?'#f59e0b':'#ef4444',si=st==='success'?'✅':st==='warning'?'🟡':'🔴';
        return '<div style="background:rgba(255,255,255,0.25);padding:16px;border-radius:8px;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><div style="font-weight:bold;font-size:1.1em;color:#1f2937;">'+ic+' '+name+'</div><div style="font-size:1.3em;">'+si+'</div></div><div style="font-size:0.9em;color:#374151;margin-bottom:8px;">יעד: '+formatCurrency(tgt)+' | צפי: '+formatCurrency(proj)+'</div><div style="background:rgba(0,0,0,0.2);height:24px;border-radius:12px;overflow:hidden;margin-bottom:8px;"><div style="background:'+c+';height:100%;width:'+pct+'%;"></div></div><div style="display:flex;justify-content:space-between;font-size:0.85em;color:#4b5563;"><span>'+pct.toFixed(0)+'%</span><span>'+(gap>0?'חסר':'עודף')+': '+formatCurrency(Math.abs(gap))+'</span></div></div>';
    }
    var h='<div class="card" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;margin-bottom:20px;"><h3 style="margin:0 0 16px;">🎯 התקדמות ביעדים</h3><div style="display:grid;gap:16px;">';
    if(hE){var e=an.equity;h+=mkBar('הון עצמי','💎',e.target,e.projected,e.percentage,e.gap,e.status);}
    if(hL){an.lifeGoals.forEach(function(lg){h+=mkBar(lg.name+' ('+lg.year+')','🎯',lg.target,lg.projected,lg.percentage,lg.gap,lg.status);});}
    h+='</div></div>';ct.innerHTML=h;
};

var _v7_origGR = generateRecommendations;
generateRecommendations = function(a) { return _v7_origGR(a).filter(function(r) { return r.type !== 'pension'; }); };

// ============================================================
// Pension goal progress (in pension tab) — uses unified projection
// ============================================================

function renderPensionGoalProgress() {
    var ct = document.getElementById('pensionGoalProgress'); if (!ct) return;
    var an = analyzeGoals();
    if (!an || !an.pension) { ct.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);">הגדר יעדי פרישה למעלה</div>'; return; }
    var p = an.pension;
    var cl = p.status==='success'?'var(--success)':p.status==='warning'?'var(--warning)':'var(--danger)';
    var ic = p.status==='success'?'✅':p.status==='warning'?'🟡':'🔴';
    var gt = p.gap>0?'חסר '+formatCurrency(p.gap)+'/חודש':'עודף '+formatCurrency(Math.abs(p.gap))+'/חודש';
    var yn = p.retirementYear?' (שנת '+p.retirementYear+')':'';
    
    // Show breakdown of the unified calculation for transparency
    var proj = calculateFullPensionProjection();
    var breakdownHtml = '';
    if (proj.husband.nominal > 0 || proj.wife.nominal > 0) {
        breakdownHtml = '<div style="margin-top:16px;padding:14px;background:var(--bg-surface);border-radius:8px;font-size:0.85em;">' +
            '<div style="font-weight:600;margin-bottom:8px;color:var(--text-primary);">פירוט החישוב:</div>';
        if (proj.husband.nominal > 0) {
            breakdownHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
                '<span>👨 בעל: נטו ריאלי</span>' +
                '<span style="font-weight:600;">' + formatCurrency(proj.husband.netReal) + '</span></div>';
        }
        if (proj.wife.nominal > 0) {
            breakdownHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
                '<span>👩 אשה: נטו ריאלי</span>' +
                '<span style="font-weight:600;">' + formatCurrency(proj.wife.netReal) + '</span></div>';
        }
        breakdownHtml += '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px;margin-top:6px;">' +
            '<span style="font-weight:700;">סה״כ נטו ריאלי</span>' +
            '<span style="font-weight:700;color:' + cl + ';">' + formatCurrency(proj.combined.netReal) + '</span></div>';
        breakdownHtml += '</div>';
    }
    
    ct.innerHTML='<div class="card" style="border:2px solid '+cl+';margin-top:20px;"><div class="card-title" style="margin-bottom:16px;">'+ic+' ניתוח פערים — יעד קצבה'+yn+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;"><div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">יעד (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;">'+formatCurrency(p.target)+'/חודש</div></div><div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">צפי (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;color:'+cl+';">'+formatCurrency(p.projected)+'/חודש</div></div></div><div style="background:var(--border);height:28px;border-radius:14px;overflow:hidden;margin-bottom:12px;"><div style="background:'+cl+';height:100%;width:'+Math.min(p.percentage,100)+'%;display:flex;align-items:center;justify-content:center;font-size:0.85em;font-weight:700;color:white;">'+p.percentage.toFixed(0)+'%</div></div><div style="text-align:center;font-size:0.95em;font-weight:600;color:'+cl+';">'+gt+'</div>' + breakdownHtml + '</div>';
}

// ============================================================
// Migration
// ============================================================

(function(){try{var s=localStorage.getItem('financialPlannerProV3');if(!s)return;var d=JSON.parse(s),c=false;d.plans.forEach(function(p){if(!p.profile)return;if(p.profile.user&&p.profile.user.age&&!p.profile.user.birthDate){p.profile.user.birthDate=(new Date().getFullYear()-p.profile.user.age)+'-01-01';c=true;}if(p.profile.spouse&&p.profile.spouse.age&&!p.profile.spouse.birthDate){p.profile.spouse.birthDate=(new Date().getFullYear()-p.profile.spouse.age)+'-01-01';c=true;}});if(c)localStorage.setItem('financialPlannerProV3',JSON.stringify(d));}catch(e){}})();

console.log('✅ pension-profile-fix.js v7 loaded');
