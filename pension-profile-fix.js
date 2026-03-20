// pension-profile-fix.js v6 — NO OVERRIDE CHAINS
// Architecture: 
// - ppfAfterPensionRender() called DIRECTLY from inline script
// - calculateMonthlyPensions overridden to add net real
// - analyzeGoals overridden to use final retirement year
// - NO renderPensionTab override (that's what kept breaking)
console.log('✅ pension-profile-fix.js v6 loading...');

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

// ============================================================
// ★ KEY FIX 1: Override calculateMonthlyPensions to add net real
// This function IS called successfully (proven by screenshots).
// So we piggyback on it.
// ============================================================

var _v6_origCMP = calculateMonthlyPensions;
calculateMonthlyPensions = function(husbandPensions, wifePensions) {
    // Call original — this sets nominal, real, net for all
    _v6_origCMP(husbandPensions, wifePensions);
    
    // Now calculate NET REAL
    try {
        var info = getFinalRetirementInfo();
        var years = (info.fYrs && info.fYrs > 0) ? info.fYrs : 
                    parseInt((document.getElementById('pensionYears')||{}).value) || 20;
        var inflFactor = Math.pow(1.02, years);
        
        // Husband nominal pension
        var hNom = 0;
        husbandPensions.forEach(function(inv) {
            var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                inv.feeDeposit||0, inv.feeAnnual||0, inv.subTracks);
            hNom += calculateMonthlyPension(fv, inv.gender || 'male');
        });
        // Wife nominal pension
        var wNom = 0;
        wifePensions.forEach(function(inv) {
            var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                inv.feeDeposit||0, inv.feeAnnual||0, inv.subTracks);
            wNom += calculateMonthlyPension(fv, inv.gender || 'female');
        });
        
        var hNet = calculateNetPension(hNom);
        var wNet = calculateNetPension(wNom);
        var hNR = hNet.net / inflFactor;
        var wNR = wNet.net / inflFactor;
        var cNR = hNR + wNR;
        
        console.log('★ v6 NET REAL: yrs='+years+' infl='+inflFactor.toFixed(3)+
                    ' H='+Math.round(hNR)+' W='+Math.round(wNR)+' C='+Math.round(cNR));
        
        // Write to BOTH sets of IDs
        var ids = [
            ['ppfHusbandNetReal', hNR],
            ['ppfWifeNetReal', wNR],
            ['ppfCombinedNetReal', cNR],
            ['pensionHusbandNetReal', hNR],
            ['pensionWifeNetReal', wNR],
            ['pensionCombinedNetReal', cNR]
        ];
        ids.forEach(function(pair) {
            var el = document.getElementById(pair[0]);
            if (el) el.textContent = formatCurrency(pair[1]);
        });
        
    } catch(err) {
        console.error('v6 NET REAL error:', err);
    }
};

// ============================================================
// ★ KEY FIX 2: ppfAfterPensionRender — called from inline script
// This runs AFTER renderPensionTab + renderPensionTracksList
// ============================================================

function ppfAfterPensionRender() {
    try {
        console.log('★ ppfAfterPensionRender running');
        
        var plan = getCurrentPlan(), pr = plan.profile;
        var info = getFinalRetirementInfo();
        
        // Sync pensionYears from retirement age
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
        
        // Load goals form
        loadPensionGoals();
        
        // Retirement year hero
        renderRetirementYearHero();
        
        // Pension goal progress
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
    // Re-render pension tab with new years
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
    // Also set calc basis text
    var basis=document.getElementById('pensionCalcBasis');
    if(basis)basis.textContent='📅 הקצבה מחושבת לשנת הפרישה הסופית: '+info.fY+' (בעוד '+info.fYrs+' שנים)';
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

var _v6_origSPG = selectPenGender;
selectPenGender = function(el,sp,gn) {
    _v6_origSPG(el,sp,gn);
    var ai = document.getElementById('penAddAge'); if(!ai) return;
    var pa = (sp==='husband') ? getProfileAge('user') : getProfileAge('spouse');
    if(pa) { ai.value = pa; ai.style.backgroundColor = 'var(--success-bg)'; }
    var pl = getCurrentPlan(), pr = pl.profile;
    if(sp==='husband'&&pr.user.gender) document.getElementById('penAddGender').value = pr.user.gender;
    else if(sp==='wife'&&pr.spouse.gender) document.getElementById('penAddGender').value = pr.spouse.gender;
};

// ============================================================
// ★ KEY FIX 3: Override analyzeGoals for consistent numbers
// ============================================================

var _v6_origAG = analyzeGoals;
analyzeGoals = function() {
    var results = _v6_origAG();
    if (!results) return results;
    
    var info = getFinalRetirementInfo();
    var pl = getCurrentPlan(), g = pl.goals;
    
    if (results.pension && info.fYrs && info.fYrs > 0) {
        var years = info.fYrs;
        var inflFactor = Math.pow(1.02, years);
        
        var pensions = pl.investments.filter(function(inv) { return inv.include && inv.type === 'פנסיה'; });
        var projNom = 0;
        pensions.forEach(function(inv) {
            var fv = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                inv.feeDeposit||0, inv.feeAnnual||0, inv.subTracks);
            projNom += calculateMonthlyPension(fv, inv.gender || 'male');
        });
        
        var netObj = calculateNetPension(projNom);
        var projNetReal = netObj.net / inflFactor;
        var target = g.retirement.monthlyPension || 0;
        var gap = target - projNetReal;
        var pct = target > 0 ? (projNetReal / target) * 100 : 100;
        
        results.pension = {
            target: target,
            projected: projNetReal,
            gap: gap,
            percentage: Math.min(pct, 100),
            yearsUntil: years,
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

var _v6_origGR = generateRecommendations;
generateRecommendations = function(a) { return _v6_origGR(a).filter(function(r) { return r.type !== 'pension'; }); };

// ============================================================
// Pension goal progress (in pension tab)
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
    ct.innerHTML='<div class="card" style="border:2px solid '+cl+';margin-top:20px;"><div class="card-title" style="margin-bottom:16px;">'+ic+' ניתוח פערים — יעד קצבה'+yn+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;"><div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">יעד (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;">'+formatCurrency(p.target)+'/חודש</div></div><div style="padding:14px;background:var(--bg-surface);border-radius:8px;text-align:center;"><div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:4px;">צפי (ריאלי אחרי מס)</div><div style="font-size:1.4em;font-weight:700;color:'+cl+';">'+formatCurrency(p.projected)+'/חודש</div></div></div><div style="background:var(--border);height:28px;border-radius:14px;overflow:hidden;margin-bottom:12px;"><div style="background:'+cl+';height:100%;width:'+Math.min(p.percentage,100)+'%;display:flex;align-items:center;justify-content:center;font-size:0.85em;font-weight:700;color:white;">'+p.percentage.toFixed(0)+'%</div></div><div style="text-align:center;font-size:0.95em;font-weight:600;color:'+cl+';">'+gt+'</div></div>';
}

// ============================================================
// Migration
// ============================================================

(function(){try{var s=localStorage.getItem('financialPlannerProV3');if(!s)return;var d=JSON.parse(s),c=false;d.plans.forEach(function(p){if(!p.profile)return;if(p.profile.user&&p.profile.user.age&&!p.profile.user.birthDate){p.profile.user.birthDate=(new Date().getFullYear()-p.profile.user.age)+'-01-01';c=true;}if(p.profile.spouse&&p.profile.spouse.age&&!p.profile.spouse.birthDate){p.profile.spouse.birthDate=(new Date().getFullYear()-p.profile.spouse.age)+'-01-01';c=true;}});if(c)localStorage.setItem('financialPlannerProV3',JSON.stringify(d));}catch(e){}})();

console.log('✅ pension-profile-fix.js v6 loaded');
