// pension-profile-fix.js v7 — PROGRESSIVE TAX + UNIFIED PROJECTION
// Architecture:
// - calculateNetIsraeliPension(gross, gender): progressive Israeli tax with brackets & credits
// - calculateFullPensionProjection(): SINGLE SOURCE OF TRUTH for both tabs
// - calculateMonthlyPensions override: uses unified projection
// - analyzeGoals override: uses SAME unified projection
// - Accordion UI for pension fund cards
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

function getPersonRetirementYears(who) {
    var info = getFinalRetirementInfo();
    if (who === 'husband' || who === 'user') return info.uYrs || info.fYrs || 20;
    if (who === 'wife' || who === 'spouse') return info.sYrs || info.fYrs || 20;
    return info.fYrs || 20;
}

// ============================================================
// ★ PROGRESSIVE ISRAELI PENSION TAX ENGINE
// ============================================================
// Model (2024 rates, monthly):
//   1. Pension exempt amount (קצבה מזכה + קיבוע זכויות): ~₪5,000/mo
//   2. Taxable income = gross - exempt
//   3. Progressive tax brackets on taxable portion
//   4. Subtract credit points value
//   5. Net = gross - max(0, tax_after_credits)
//
// Credit points: male 2.25, female 2.75
// Credit point value: ₪242/month (₪2,904/year)
//
// Monthly tax brackets (on total taxable income):
//   0 – 7,010:       10%
//   7,011 – 10,060:  14%
//   10,061 – 16,150: 20%
//   16,151 – 22,440: 31%
//   22,441 – 46,690: 35%
//   46,691+:         47%
// ============================================================

var IL_TAX_BRACKETS_MONTHLY = [
    { upto: 7010,  rate: 0.10 },
    { upto: 10060, rate: 0.14 },
    { upto: 16150, rate: 0.20 },
    { upto: 22440, rate: 0.31 },
    { upto: 46690, rate: 0.35 },
    { upto: Infinity, rate: 0.47 }
];

var IL_CREDIT_POINT_MONTHLY = 242;  // ₪ per credit point per month
var IL_CREDIT_POINTS_MALE = 2.25;
var IL_CREDIT_POINTS_FEMALE = 2.75;
var IL_PENSION_EXEMPT_MONTHLY = 5000;  // קצבה מזכה (exempt pension income)

function calculateProgressiveTax(taxableMonthly) {
    if (taxableMonthly <= 0) return 0;
    var tax = 0, prev = 0;
    for (var i = 0; i < IL_TAX_BRACKETS_MONTHLY.length; i++) {
        var b = IL_TAX_BRACKETS_MONTHLY[i];
        var slice = Math.min(taxableMonthly, b.upto) - prev;
        if (slice <= 0) break;
        tax += slice * b.rate;
        prev = b.upto;
        if (taxableMonthly <= b.upto) break;
    }
    return tax;
}

// ★ THE SINGLE SOURCE OF TRUTH for pension net calculation
function calculateNetIsraeliPension(grossMonthly, gender) {
    if (!grossMonthly || grossMonthly <= 0) {
        return { gross: 0, net: 0, tax: 0, effectiveRate: 0, exempt: IL_PENSION_EXEMPT_MONTHLY,
                 taxBeforeCredits: 0, creditValue: 0, creditPoints: 0, taxableIncome: 0, brackets: [] };
    }

    // Step 1: Exempt pension amount
    var taxableIncome = Math.max(0, grossMonthly - IL_PENSION_EXEMPT_MONTHLY);

    // Step 2: Progressive tax on taxable portion
    var taxBeforeCredits = calculateProgressiveTax(taxableIncome);

    // Step 3: Credit points reduce tax
    var creditPoints = (gender === 'female') ? IL_CREDIT_POINTS_FEMALE : IL_CREDIT_POINTS_MALE;
    var creditValue = creditPoints * IL_CREDIT_POINT_MONTHLY;

    // Step 4: Net tax (never negative)
    var tax = Math.max(0, taxBeforeCredits - creditValue);
    var net = grossMonthly - tax;
    var effectiveRate = grossMonthly > 0 ? (tax / grossMonthly) * 100 : 0;

    // Build bracket breakdown for UI
    var bracketInfo = [];
    if (taxableIncome > 0) {
        var prev = 0;
        for (var i = 0; i < IL_TAX_BRACKETS_MONTHLY.length; i++) {
            var b = IL_TAX_BRACKETS_MONTHLY[i];
            var slice = Math.min(taxableIncome, b.upto) - prev;
            if (slice <= 0) break;
            bracketInfo.push({
                from: prev, to: Math.min(taxableIncome, b.upto),
                rate: b.rate, tax: slice * b.rate, slice: slice
            });
            prev = b.upto;
            if (taxableIncome <= b.upto) break;
        }
    }

    return {
        gross: grossMonthly,
        net: net,
        tax: tax,
        effectiveRate: effectiveRate,
        exempt: IL_PENSION_EXEMPT_MONTHLY,
        taxBeforeCredits: taxBeforeCredits,
        creditValue: creditValue,
        creditPoints: creditPoints,
        taxableIncome: taxableIncome,
        brackets: bracketInfo
    };
}

// Override the old calculateNetPension so ANY code calling it gets the new engine
calculateNetPension = function(grossMonthly, gender) {
    return calculateNetIsraeliPension(grossMonthly, gender || 'male');
};

// ============================================================
// ★ UNIFIED PENSION PROJECTION — used by BOTH tabs
// ============================================================

function calculateFullPensionProjection() {
    var plan = getCurrentPlan();
    var info = getFinalRetirementInfo();
    var hYears = getPersonRetirementYears('husband');
    var wYears = getPersonRetirementYears('wife');
    var hInfl = Math.pow(1.02, hYears);
    var wInfl = Math.pow(1.02, wYears);

    // Separate pension investments by person
    var husbandPensions = [], wifePensions = [];
    plan.investments.forEach(function(inv) {
        if (!inv.include || inv.type !== 'פנסיה') return;
        if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) {
            wifePensions.push(inv);
        } else {
            husbandPensions.push(inv);
        }
    });

    // Husband nominal
    var hNom = 0, hFVs = [];
    husbandPensions.forEach(function(inv) {
        var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, hYears,
                            inv.feeDeposit||0, inv.feeAnnual||0, inv.subTracks);
        var mp = calculateMonthlyPension(fv, inv.gender || 'male');
        hNom += mp;
        hFVs.push({ inv: inv, fv: fv, monthlyPension: mp });
    });

    // Wife nominal
    var wNom = 0, wFVs = [];
    wifePensions.forEach(function(inv) {
        var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, wYears,
                            inv.feeDeposit||0, inv.feeAnnual||0, inv.subTracks);
        var mp = calculateMonthlyPension(fv, inv.gender || 'female');
        wNom += mp;
        wFVs.push({ inv: inv, fv: fv, monthlyPension: mp });
    });

    // Real values
    var hReal = hNom / hInfl;
    var wReal = wNom / wInfl;

    // ★ NET via progressive Israeli tax engine
    var hNet = calculateNetIsraeliPension(hNom, 'male');
    var wNet = calculateNetIsraeliPension(wNom, 'female');

    // Net real
    var hNR = hNet.net / hInfl;
    var wNR = wNet.net / wInfl;

    // Combined
    var cNom = hNom + wNom;
    var cReal = hReal + wReal;
    var cNetVal = hNet.net + wNet.net;
    var cTax = hNet.tax + wNet.tax;
    var cNR = hNR + wNR;
    var cEffRate = cNom > 0 ? ((cTax / cNom) * 100) : 0;

    return {
        husband: {
            nominal: hNom, real: hReal,
            net: hNet.net, tax: hNet.tax, effectiveRate: hNet.effectiveRate,
            netReal: hNR, years: hYears, inflation: hInfl,
            pensions: husbandPensions, details: hFVs,
            taxInfo: hNet
        },
        wife: {
            nominal: wNom, real: wReal,
            net: wNet.net, tax: wNet.tax, effectiveRate: wNet.effectiveRate,
            netReal: wNR, years: wYears, inflation: wInfl,
            pensions: wifePensions, details: wFVs,
            taxInfo: wNet
        },
        combined: {
            nominal: cNom, real: cReal,
            net: cNetVal, tax: cTax, effectiveRate: cEffRate,
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
    // Save pensionYears before original may modify it
    var pyEl = document.getElementById('pensionYears');
    var savedPY = pyEl ? pyEl.value : null;

    // Call original for base side effects
    _v7_origCMP(husbandPensions, wifePensions);

    // Restore pensionYears
    if (pyEl && savedPY) pyEl.value = savedPY;

    try {
        var proj = calculateFullPensionProjection();
        var h = proj.husband, w = proj.wife, c = proj.combined;

        console.log('★ v7 UNIFIED: H=' + h.years + 'yrs W=' + w.years + 'yrs');
        console.log('  H: nom=' + Math.round(h.nominal) + ' net=' + Math.round(h.net) + ' netReal=' + Math.round(h.netReal) + ' tax=' + Math.round(h.tax) + ' eff=' + h.effectiveRate.toFixed(1) + '%');
        console.log('  W: nom=' + Math.round(w.nominal) + ' net=' + Math.round(w.net) + ' netReal=' + Math.round(w.netReal) + ' tax=' + Math.round(w.tax) + ' eff=' + w.effectiveRate.toFixed(1) + '%');
        console.log('  C: netReal=' + Math.round(c.netReal));

        // Override all display values
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

        // Tax display with bracket info
        function taxLabel(info) {
            if (info.tax <= 0) return '✅ פטור מלא (נקודות זיכוי מכסות)';
            var label = 'מס: ' + formatCurrency(info.tax) + ' (' + info.effectiveRate.toFixed(1) + '%)';
            if (info.brackets && info.brackets.length > 0) {
                var top = info.brackets[info.brackets.length - 1];
                label += ' | מדרגה עליונה: ' + (top.rate * 100).toFixed(0) + '%';
            }
            return label;
        }
        var hTaxEl = document.getElementById('pensionHusbandTax');
        if (hTaxEl) hTaxEl.textContent = taxLabel(h.taxInfo);
        var wTaxEl = document.getElementById('pensionWifeTax');
        if (wTaxEl) wTaxEl.textContent = taxLabel(w.taxInfo);
        var cTaxEl = document.getElementById('pensionCombinedTax');
        if (cTaxEl) {
            if (c.tax > 0) cTaxEl.textContent = 'מס: ' + formatCurrency(c.tax) + '/חודש (' + c.effectiveRate.toFixed(1) + '%)';
            else cTaxEl.textContent = '✅ פטור מלא';
        }

    } catch(err) {
        console.error('v7 calculateMonthlyPensions error:', err);
    }
};

// ============================================================
// Override renderPensionList: ACCORDION UI + per-person years
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
    var acId = 'ppfAcc_' + containerId;

    var html = '';
    pensions.forEach(function(inv, idx) {
        var futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                     inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        var monthlyPension = calculateMonthlyPension(futureValue, gender);
        var netInfo = calculateNetIsraeliPension(monthlyPension, gender);
        var itemId = acId + '_' + idx;

        // Accordion header (always visible)
        html += '<div style="margin-bottom:8px;">';
        html += '<div onclick="ppfToggleAccordion(\'' + itemId + '\')" style="padding:14px 16px;border-radius:12px;background:var(--bg-surface);border:1px solid var(--border);cursor:pointer;transition:all 0.2s;display:flex;justify-content:space-between;align-items:center;" onmouseover="this.style.borderColor=\'var(--brand-primary)\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
        html += '<div style="flex:1;">';
        html += '<div style="font-weight:bold;font-size:1.05em;color:var(--text-primary);">' + inv.name + '</div>';
        html += '<div style="font-size:0.82em;color:var(--text-secondary);margin-top:2px;">' + inv.house + ' · ' + formatCurrency(inv.amount) + ' · ' + formatCurrency(inv.monthly) + '/חודש</div>';
        html += '</div>';
        html += '<div style="text-align:left;min-width:100px;">';
        html += '<div style="font-weight:bold;font-size:1.1em;color:var(--success);">' + formatCurrency(monthlyPension) + '</div>';
        html += '<div style="font-size:0.75em;color:var(--text-secondary);">קצבה/חודש</div>';
        html += '</div>';
        html += '<div id="' + itemId + '_arrow" style="margin-right:8px;transition:transform 0.3s;font-size:1.2em;color:var(--text-secondary);">◀</div>';
        html += '</div>';

        // Accordion body (collapsed by default)
        html += '<div id="' + itemId + '" style="display:none;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;margin-top:-4px;">';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
        html += '<div><div style="font-size:0.82em;color:var(--text-secondary);">יתרה היום</div><div style="font-weight:bold;color:var(--brand-primary);">' + formatCurrency(inv.amount) + '</div></div>';
        html += '<div><div style="font-size:0.82em;color:var(--text-secondary);">הפקדה חודשית</div><div style="font-weight:bold;color:var(--success);">' + formatCurrency(inv.monthly) + '</div></div>';
        html += '<div><div style="font-size:0.82em;color:var(--text-secondary);">תשואה</div><div style="font-weight:bold;">' + inv.returnRate + '%</div></div>';
        var feeStr = (inv.feeAnnual || 0) + '%';
        if (inv.feeDeposit > 0) feeStr += ' + ' + inv.feeDeposit + '% הפקדה';
        html += '<div><div style="font-size:0.82em;color:var(--text-secondary);">דמ"נ</div><div style="font-weight:bold;">' + feeStr + '</div></div>';
        html += '</div>';

        html += '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">';
        html += '<div style="font-size:0.82em;color:var(--text-secondary);margin-bottom:6px;">📅 צפי ב-' + (retYear || (currentYear + years)) + ' (בעוד ' + years + ' שנים)</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">';
        html += '<div style="padding:10px;background:var(--brand-bg);border-radius:8px;text-align:center;"><div style="font-size:0.75em;color:var(--text-secondary);">צבירה עתידית</div><div style="font-weight:bold;color:var(--brand-primary);font-size:1.1em;">' + formatCurrency(futureValue) + '</div></div>';
        html += '<div style="padding:10px;background:var(--success-bg,#f0fdf4);border-radius:8px;text-align:center;"><div style="font-size:0.75em;color:var(--text-secondary);">קצבה ברוטו</div><div style="font-weight:bold;color:var(--success);font-size:1.1em;">' + formatCurrency(monthlyPension) + '</div></div>';
        html += '<div style="padding:10px;background:#F5F3FF;border-radius:8px;text-align:center;"><div style="font-size:0.75em;color:var(--text-secondary);">קצבה נטו</div><div style="font-weight:bold;color:#7C3AED;font-size:1.1em;">' + formatCurrency(netInfo.net) + '</div></div>';
        html += '</div>';

        // Tax breakdown mini
        if (netInfo.tax > 0) {
            html += '<div style="margin-top:10px;padding:10px;background:var(--danger-bg,#fef2f2);border-radius:8px;font-size:0.82em;">';
            html += '<span style="color:var(--danger);font-weight:600;">מס: ' + formatCurrency(netInfo.tax) + ' (' + netInfo.effectiveRate.toFixed(1) + '%)</span>';
            html += ' · פטור: ' + formatCurrency(netInfo.exempt) + ' · נ.ז: ' + netInfo.creditPoints + ' (' + formatCurrency(netInfo.creditValue) + ')';
            html += '</div>';
        } else {
            html += '<div style="margin-top:10px;padding:10px;background:var(--success-bg,#f0fdf4);border-radius:8px;font-size:0.82em;color:var(--success);font-weight:600;">✅ פטור מלא — נקודות הזיכוי מכסות את המס</div>';
        }

        html += '</div>';
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;
};

// Accordion toggle helper
window.ppfToggleAccordion = function(id) {
    var el = document.getElementById(id);
    var arrow = document.getElementById(id + '_arrow');
    if (!el) return;
    if (el.style.display === 'none') {
        el.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(-90deg)';
    } else {
        el.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
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
            if (pyEl) { pyEl.value = info.fYrs; console.log('★ ppfBEFORE: pensionYears=' + info.fYrs); }
        }

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
    } catch(err) { console.error('ppfBeforePensionRender error:', err); }
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
        renderTaxBreakdownCard();
    } catch(err) { console.error('ppfAfterPensionRender error:', err); }
}

// ============================================================
// TAX BREAKDOWN CARD — shows progressive bracket details
// ============================================================

function renderTaxBreakdownCard() {
    var el = document.getElementById('ppfTaxBreakdown');
    if (!el) {
        // Create container dynamically after the pension combined card
        var pensionPanel = document.getElementById('pension');
        if (!pensionPanel) return;
        var cards = pensionPanel.querySelectorAll('.card.mb-4');
        var targetCard = null;
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].querySelector('#pensionCombinedNominal')) { targetCard = cards[i]; break; }
        }
        if (!targetCard) return;
        el = document.createElement('div');
        el.id = 'ppfTaxBreakdown';
        targetCard.parentNode.insertBefore(el, targetCard.nextSibling);
    }

    var proj = calculateFullPensionProjection();
    if (proj.combined.nominal <= 0) { el.innerHTML = ''; return; }

    var hTax = proj.husband.taxInfo, wTax = proj.wife.taxInfo;

    function bracketRows(info, label) {
        if (!info || info.gross <= 0) return '';
        var html = '<div style="margin-bottom:16px;">';
        html += '<div style="font-weight:700;margin-bottom:8px;font-size:0.95em;">' + label + ' — ברוטו ' + formatCurrency(info.gross) + '/חודש</div>';
        html += '<div style="display:grid;grid-template-columns:auto auto auto auto;gap:4px 16px;font-size:0.82em;padding:0 8px;">';
        html += '<div style="font-weight:600;color:var(--text-secondary);">מדרגה</div><div style="font-weight:600;color:var(--text-secondary);">שיעור</div><div style="font-weight:600;color:var(--text-secondary);">סכום</div><div style="font-weight:600;color:var(--text-secondary);">מס</div>';

        // Exempt row
        html += '<div>₪0–' + formatCurrency(info.exempt) + '</div><div style="color:var(--success);font-weight:600;">פטור</div><div>' + formatCurrency(Math.min(info.gross, info.exempt)) + '</div><div style="color:var(--success);">₪0</div>';

        // Bracket rows
        if (info.brackets && info.brackets.length > 0) {
            info.brackets.forEach(function(b) {
                html += '<div>₪' + formatCurrency(info.exempt + b.from) + '–' + formatCurrency(info.exempt + b.to) + '</div>';
                html += '<div style="font-weight:600;">' + (b.rate * 100).toFixed(0) + '%</div>';
                html += '<div>' + formatCurrency(b.slice) + '</div>';
                html += '<div style="color:var(--danger);">' + formatCurrency(Math.round(b.tax)) + '</div>';
            });
        }
        html += '</div>';

        // Summary
        html += '<div style="display:flex;justify-content:space-between;margin-top:10px;padding:10px 8px;border-top:1px solid var(--border);font-size:0.85em;flex-wrap:wrap;gap:6px;">';
        html += '<div>מס לפני נ.ז: ' + formatCurrency(Math.round(info.taxBeforeCredits)) + '</div>';
        html += '<div>נ.ז (' + info.creditPoints + '): -' + formatCurrency(Math.round(info.creditValue)) + '</div>';
        html += '<div style="font-weight:700;color:' + (info.tax > 0 ? 'var(--danger)' : 'var(--success)') + ';">מס סופי: ' + formatCurrency(Math.round(info.tax)) + '</div>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    var html = '<div class="card mb-4" style="border:1px solid var(--border);">';
    html += '<div class="card-title" style="margin-bottom:16px;cursor:pointer;" onclick="ppfToggleAccordion(\'ppfTaxDetails\')">';
    html += '🧮 פירוט מדרגות מס פנסיוני <span id="ppfTaxDetails_arrow" style="font-size:0.8em;transition:transform 0.3s;display:inline-block;">◀</span>';
    html += '</div>';
    html += '<div id="ppfTaxDetails" style="display:none;">';
    html += '<p style="font-size:0.82em;color:var(--text-secondary);margin-bottom:16px;">חישוב לפי מדרגות מס הכנסה 2024. פטור קצבה מזכה: ' + formatCurrency(IL_PENSION_EXEMPT_MONTHLY) + '/חודש.</p>';
    if (hTax && hTax.gross > 0) html += bracketRows(hTax, '👨 בעל');
    if (wTax && wTax.gross > 0) html += bracketRows(wTax, '👩 אשה');

    // Combined summary
    html += '<div style="padding:14px;background:linear-gradient(135deg,var(--brand-bg),#F5F3FF);border-radius:10px;margin-top:12px;">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;">';
    html += '<div><div style="font-size:0.78em;color:var(--text-secondary);">ברוטו משפחתי</div><div style="font-weight:700;font-size:1.1em;">' + formatCurrency(proj.combined.nominal) + '</div></div>';
    html += '<div><div style="font-size:0.78em;color:var(--text-secondary);">נטו אחרי מס</div><div style="font-weight:700;font-size:1.1em;color:var(--brand-primary);">' + formatCurrency(proj.combined.net) + '</div></div>';
    html += '<div><div style="font-size:0.78em;color:var(--text-secondary);">💎 נטו ריאלי</div><div style="font-weight:700;font-size:1.1em;color:#7C3AED;">' + formatCurrency(proj.combined.netReal) + '</div></div>';
    html += '</div></div>';
    html += '</div></div>';

    el.innerHTML = html;
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
    renderTaxBreakdownCard();
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

    // Get unified projection for net real display in hero
    var proj = calculateFullPensionProjection();
    var netRealStr = proj.combined.netReal > 0 ? formatCurrency(proj.combined.netReal) + '/חודש נטו ריאלי' : '';

    var parts=[];
    if(info.uYr)parts.push('<div>👨 בעל: '+info.uYr+' (גיל '+info.uRA+')</div>');
    if(info.sYr)parts.push('<div>👩 אשה: '+info.sYr+' (גיל '+info.sRA+')</div>');
    el.innerHTML='<div style="background:linear-gradient(135deg,var(--brand-deep),var(--brand-primary));color:white;border-radius:var(--radius-xl);padding:28px;margin-bottom:20px;text-align:center;">'+
        '<div style="font-size:0.9em;opacity:0.85;margin-bottom:8px;">שנת פרישה סופית (המאוחרת מבין בני הזוג)</div>'+
        '<div style="font-size:3em;font-weight:800;letter-spacing:-0.02em;">'+info.fY+'</div>'+
        '<div style="font-size:1.1em;margin-top:6px;opacity:0.9;">בעוד '+info.fYrs+' שנים</div>'+
        (netRealStr ? '<div style="font-size:1em;margin-top:10px;opacity:0.95;font-weight:600;">💎 ' + netRealStr + '</div>' : '') +
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
    // Save pensionYears before original may modify it
    var pyEl = document.getElementById('pensionYears');
    var savedPY = pyEl ? pyEl.value : null;

    var results = _v7_origAG();
    if (!results) return results;

    // Restore pensionYears in case original changed it
    if (pyEl && savedPY) pyEl.value = savedPY;

    var info = getFinalRetirementInfo();
    var pl = getCurrentPlan(), g = pl.goals;

    if (results.pension && info.fYrs && info.fYrs > 0) {
        // ★ SINGLE SOURCE OF TRUTH — same as pension tab
        var proj = calculateFullPensionProjection();
        var projNetReal = proj.combined.netReal;

        console.log('★ v7 analyzeGoals: unified netReal=' + Math.round(projNetReal) +
                    ' (H=' + Math.round(proj.husband.netReal) + ' + W=' + Math.round(proj.wife.netReal) + ')');

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
// Pension goal progress (in pension tab) — with unified breakdown
// ============================================================

function renderPensionGoalProgress() {
    var ct = document.getElementById('pensionGoalProgress'); if (!ct) return;
    var pl = getCurrentPlan(), g = pl.goals;
    var info = getFinalRetirementInfo();
    var target = g.retirement.monthlyPension || 0;

    if (!target || !info.fYrs || info.fYrs <= 0) {
        ct.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);">הגדר יעדי פרישה למעלה</div>';
        return;
    }

    // ★ SINGLE CALL — one projection drives EVERYTHING: cards, bar, AND breakdown
    var proj = calculateFullPensionProjection();
    var projNetReal = proj.combined.netReal;

    console.log('★ v7 renderPensionGoalProgress: SINGLE proj.combined.netReal=' + Math.round(projNetReal) +
                ' (H=' + Math.round(proj.husband.netReal) + ' + W=' + Math.round(proj.wife.netReal) + ')');

    var gap = target - projNetReal;
    var pct = target > 0 ? (projNetReal / target) * 100 : 100;
    pct = Math.min(pct, 100);
    var status = pct >= 100 ? 'success' : pct >= 80 ? 'warning' : 'danger';

    var cl = status==='success'?'var(--success)':status==='warning'?'var(--warning)':'var(--danger)';
    var ic = status==='success'?'✅':status==='warning'?'🟡':'🔴';
    var gt = gap>0?'חסר '+formatCurrency(gap)+'/חודש':'עודף '+formatCurrency(Math.abs(gap))+'/חודש';
    var yn = info.fY?' (שנת '+info.fY+')':'';

    // Breakdown — uses SAME proj object, zero chance of mismatch
    var breakdownHtml = '';
    if (proj.husband.nominal > 0 || proj.wife.nominal > 0) {
        breakdownHtml = '<div style="margin-top:16px;padding:14px;background:var(--bg-surface);border-radius:8px;font-size:0.85em;">';
        breakdownHtml += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-primary);">פירוט החישוב (מס פרוגרסיבי):</div>';
        if (proj.husband.nominal > 0) {
            breakdownHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:4px;">';
            breakdownHtml += '<span>👨 בעל: ברוטו ' + formatCurrency(proj.husband.nominal) + ' → נטו ' + formatCurrency(proj.husband.net);
            if (proj.husband.tax > 0) breakdownHtml += ' <span style="color:var(--danger);font-size:0.85em;">(מס ' + proj.husband.effectiveRate.toFixed(1) + '%)</span>';
            else breakdownHtml += ' <span style="color:var(--success);">(פטור)</span>';
            breakdownHtml += '</span>';
            breakdownHtml += '<span style="font-weight:600;">' + formatCurrency(proj.husband.netReal) + ' ריאלי</span></div>';
        }
        if (proj.wife.nominal > 0) {
            breakdownHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:4px;">';
            breakdownHtml += '<span>👩 אשה: ברוטו ' + formatCurrency(proj.wife.nominal) + ' → נטו ' + formatCurrency(proj.wife.net);
            if (proj.wife.tax > 0) breakdownHtml += ' <span style="color:var(--danger);font-size:0.85em;">(מס ' + proj.wife.effectiveRate.toFixed(1) + '%)</span>';
            else breakdownHtml += ' <span style="color:var(--success);">(פטור)</span>';
            breakdownHtml += '</span>';
            breakdownHtml += '<span style="font-weight:600;">' + formatCurrency(proj.wife.netReal) + ' ריאלי</span></div>';
        }
        breakdownHtml += '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px;margin-top:6px;">';
        breakdownHtml += '<span style="font-weight:700;">סה״כ נטו ריאלי</span>';
        breakdownHtml += '<span style="font-weight:700;color:' + cl + ';">' + formatCurrency(projNetReal) + '</span></div>';
        breakdownHtml += '</div>';
    }

    ct.innerHTML='<div class="card" style="border:2px solid '+cl+';margin-top:20px;"><div class="card-title" style="margin-bottom:16px;">'+ic+' ניתוח פערים — יעד קצבה'+yn+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;"><div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">יעד (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;">'+formatCurrency(target)+'/חודש</div></div><div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">צפי (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;color:'+cl+';">'+formatCurrency(projNetReal)+'/חודש</div></div></div><div style="background:var(--border);height:28px;border-radius:14px;overflow:hidden;margin-bottom:12px;"><div style="background:'+cl+';height:100%;width:'+Math.min(pct,100)+'%;display:flex;align-items:center;justify-content:center;font-size:0.85em;font-weight:700;color:white;">'+pct.toFixed(0)+'%</div></div><div style="text-align:center;font-size:0.95em;font-weight:600;color:'+cl+';">'+gt+'</div>' + breakdownHtml + '</div>';
}

// ============================================================
// Migration
// ============================================================

(function(){try{var s=localStorage.getItem('financialPlannerProV3');if(!s)return;var d=JSON.parse(s),c=false;d.plans.forEach(function(p){if(!p.profile)return;if(p.profile.user&&p.profile.user.age&&!p.profile.user.birthDate){p.profile.user.birthDate=(new Date().getFullYear()-p.profile.user.age)+'-01-01';c=true;}if(p.profile.spouse&&p.profile.spouse.age&&!p.profile.spouse.birthDate){p.profile.spouse.birthDate=(new Date().getFullYear()-p.profile.spouse.age)+'-01-01';c=true;}});if(c)localStorage.setItem('financialPlannerProV3',JSON.stringify(d));}catch(e){}})();

console.log('✅ pension-profile-fix.js v7 loaded — progressive tax engine active');
