// ============================================================
// glide.js v2 - Glide Path + Charts Toggle + Report Tables
// ============================================================

console.log('✅ glide.js v2 loading...');

// ============================================================
// 1. CHARTS - Toggle pension inclusion
// ============================================================

const _origRenderCharts = renderCharts;
renderCharts = function() {
    const includePension = document.getElementById('chartsIncludePension');
    const include = includePension ? includePension.checked : false;
    
    const plan = getCurrentPlan();
    const timeframeSelect = document.getElementById('chartsTimeframe');
    const years = timeframeSelect ? parseInt(timeframeSelect.value) : 0;
    
    const byType = {};
    const byHouse = {};
    const bySubTrack = {};
    const subTrackObjects = [];
    let taxExempt = 0;
    let taxable = 0;
    
    plan.investments.forEach(inv => {
        if (!inv.include) return;
        if (!include && inv.type === 'פנסיה') return;
        
        let value;
        if (years === 0) {
            value = inv.amount || 0;
        } else {
            value = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                              inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        }
        
        byType[inv.type] = (byType[inv.type] || 0) + value;
        byHouse[inv.house] = (byHouse[inv.house] || 0) + value;
        
        if (inv.subTracks && inv.subTracks.length > 0) {
            inv.subTracks.forEach(st => {
                const stVal = value * (st.percent / 100);
                bySubTrack[st.type] = (bySubTrack[st.type] || 0) + stVal;
                subTrackObjects.push({ ...st, value: stVal });
            });
        } else {
            bySubTrack['לא מחולק לתתי-מסלולים'] = (bySubTrack['לא מחולק לתתי-מסלולים'] || 0) + value;
            subTrackObjects.push({ type: 'לא מחולק לתתי-מסלולים', value: value });
        }
        
        if (inv.tax > 0) { taxable += value; } else { taxExempt += value; }
    });
    
    renderPieChart('chartBySubTracks', bySubTrack, 'תתי-מסלולים');
    renderPieChart('chartByType', byType, 'סוג מסלול');
    renderPieChartWithUniqueColors('chartByHouse', byHouse, 'בית השקעות');
    renderPieChart('chartByTax', { 'פטור ממס': taxExempt, 'חייב במס': taxable }, 'מיסוי');
    renderRiskPieChart(subTrackObjects);
};

// ============================================================
// 2. REPORT - Distribution tables from chart data
// ============================================================

const _origGenerateReport = generateReport;
generateReport = function() {
    const plan = getCurrentPlan();
    if (!plan || !plan.investments || plan.investments.length === 0) {
        _origGenerateReport();
        return;
    }
    
    const years = parseInt(document.getElementById('sumYears')?.value) || 20;
    const interval = parseInt(document.getElementById('projInterval')?.value) || 5;
    const currentYear = new Date().getFullYear();
    
    const totalToday = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה').reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const projection = calculateProjectionWithWithdrawals(plan.investments, years, plan.withdrawals || []);
    const equityInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalAmount = equityInvs.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const avgFeeAnnual = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeAnnual || 0)), 0) / totalAmount : 0;
    const avgFeeDeposit = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeDeposit || 0)), 0) / totalAmount : 0;
    const avgReturn = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.returnRate || 0)), 0) / totalAmount : 0;
    const totalReal = calculateRealValue(projection.finalNominal, years);
    
    const breakdown = equityInvs.map(inv => {
        const nominal = calculateFV(inv.amount, inv.monthly, inv.returnRate, years, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        const principal = calculatePrincipal(inv.amount, inv.monthly, years, inv);
        return { name: inv.name, house: inv.house, today: inv.amount, monthly: inv.monthly, future: nominal, profit: nominal - principal };
    });
    
    const activeWithdrawals = (plan.withdrawals || []).filter(w => w.active !== false).sort((a, b) => a.year - b.year);
    const hasW = activeWithdrawals.length > 0;
    
    // Build projection years
    const yearSet = new Set();
    for (let y = 0; y <= years; y += interval) yearSet.add(currentYear + y);
    activeWithdrawals.forEach(w => { if (w.year >= currentYear && w.year <= currentYear + years) yearSet.add(w.year); });
    const allYears = Array.from(yearSet).sort((a, b) => a - b);
    
    let projRows = '';
    allYears.forEach(year => {
        const y = year - currentYear;
        const proj = calculateProjectionWithWithdrawals(plan.investments, y, plan.withdrawals);
        const tn = proj.finalNominal, tp = proj.finalPrincipal;
        const tax = calculateTax(tp, tn, 25, y), real = calculateRealValue(tn, y), net = tn - tax;
        const yw = activeWithdrawals.filter(w => w.year === year);
        const wa = yw.reduce((s, w) => s + w.amount, 0), wg = yw.map(w => w.goal).join(', ');
        const hw = wa > 0;
        projRows += '<tr' + (hw ? ' style="background:#fef2f2;"' : '') + '><td style="font-weight:600;">' + year + '</td><td>' + formatCurrency(tn) + '</td>';
        if (hasW) { projRows += '<td style="color:#ef4444;font-weight:' + (hw ? 'bold' : 'normal') + ';">' + (hw ? formatCurrency(wa) : '-') + '</td><td style="font-size:0.85em;">' + (wg || '-') + '</td>'; }
        projRows += '<td style="color:#3b82f6;">' + formatCurrency(real) + '</td><td style="color:#ef4444;">' + formatCurrency(tax) + '</td><td style="color:#10b981;font-weight:600;">' + formatCurrency(net) + '</td></tr>';
    });
    
    // Per-track table
    let ptH = '<th>שנה</th>', ptR = '';
    equityInvs.forEach(inv => { ptH += '<th>' + inv.name + '</th>'; });
    ptH += '<th style="background:#1e40af;">סה"כ</th>';
    for (let y = 0; y <= years; y += interval) {
        let rt = 0; ptR += '<tr><td style="font-weight:600;">' + (currentYear + y) + '</td>';
        equityInvs.forEach(inv => { const v = calculateFV(inv.amount, inv.monthly, inv.returnRate, y, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks); rt += v; ptR += '<td>' + formatCurrency(v) + '</td>'; });
        ptR += '<td style="font-weight:700;color:#10b981;">' + formatCurrency(rt) + '</td></tr>';
    }
    
    // === NEW: Distribution tables ===
    const allInvs = plan.investments.filter(inv => inv.include);
    const allTotal = allInvs.reduce((s, i) => s + (i.amount || 0), 0);
    
    // By Type
    const byType = {};
    allInvs.forEach(inv => { byType[inv.type] = (byType[inv.type] || 0) + (inv.amount || 0); });
    
    // By House
    const byHouse = {};
    allInvs.forEach(inv => { byHouse[inv.house || 'לא מוגדר'] = (byHouse[inv.house || 'לא מוגדר'] || 0) + (inv.amount || 0); });
    
    // By Tax
    let taxExempt = 0, taxable = 0;
    allInvs.forEach(inv => { if (inv.tax > 0) taxable += (inv.amount || 0); else taxExempt += (inv.amount || 0); });
    
    // By Risk
    const riskTotals = { 'סיכון גבוה': 0, 'סיכון בינוני': 0, 'סיכון נמוך': 0 };
    allInvs.forEach(inv => {
        if (inv.subTracks && inv.subTracks.length > 0) {
            inv.subTracks.forEach(st => {
                const val = (inv.amount || 0) * (st.percent / 100);
                const risk = classifyRisk(st);
                if (risk === 'high') riskTotals['סיכון גבוה'] += val;
                else if (risk === 'medium') riskTotals['סיכון בינוני'] += val;
                else if (risk === 'low') riskTotals['סיכון נמוך'] += val;
            });
        }
    });
    
    function buildDistTable(title, data, total) {
        let t = '<h2>' + title + '</h2><table><thead><tr><th>קטגוריה</th><th>סכום</th><th>אחוז</th></tr></thead><tbody>';
        Object.entries(data).sort((a, b) => b[1] - a[1]).forEach(function(entry) {
            const pct = total > 0 ? ((entry[1] / total) * 100).toFixed(1) : '0';
            t += '<tr><td>' + entry[0] + '</td><td>' + formatCurrency(entry[1]) + '</td><td>' + pct + '%</td></tr>';
        });
        t += '<tr style="background:#f3f4f6;font-weight:bold"><td>סה"כ</td><td>' + formatCurrency(total) + '</td><td>100%</td></tr>';
        t += '</tbody></table>';
        return t;
    }
    
    // Build HTML
    const il = interval === 1 ? 'שנה' : interval === 2 ? 'שנתיים' : interval + ' שנים';
    let h = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>דוח פיננסי</title><style>body{font-family:Arial;padding:40px;background:#f9fafb}.container{max-width:1200px;margin:0 auto;background:white;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}h1{color:#1f2937;font-size:2.5em;border-bottom:4px solid #3b82f6;padding-bottom:16px;margin-bottom:24px}h2{color:#3b82f6;font-size:1.5em;margin:32px 0 16px;padding-right:12px;border-right:4px solid #3b82f6}.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0}.sc{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:12px}.st{font-size:0.9em;opacity:0.9;margin-bottom:8px}.sv{font-size:1.8em;font-weight:bold}table{width:100%;border-collapse:collapse;margin:20px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1)}th{background:#3b82f6;color:white;padding:12px;text-align:right;font-weight:600}td{padding:10px 12px;border-bottom:1px solid #e5e7eb}tr:hover{background:#f3f4f6}.p{color:#10b981;font-weight:bold}.ts{overflow-x:auto;margin:20px 0}.dg{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}.pb{position:fixed;bottom:30px;left:30px;background:#3b82f6;color:white;border:none;padding:16px 24px;border-radius:12px;font-size:1.1em;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.4);z-index:1000}@media print{.pb{display:none}}@media(max-width:768px){.dg{grid-template-columns:1fr}}</style></head><body><div class="container">';
    
    h += '<h1>📊 דוח פיננסי מסכם</h1><p style="color:#6b7280;margin-bottom:32px">תוכנית: ' + plan.name + ' | ' + new Date().toLocaleDateString('he-IL') + '</p>';
    h += '<h2>💰 מצב נוכחי</h2><div class="sg"><div class="sc"><div class="st">הון עצמי היום</div><div class="sv">' + formatCurrency(totalToday) + '</div></div><div class="sc"><div class="st">תחזית בעוד ' + years + ' שנים (נומינלי)</div><div class="sv">' + formatCurrency(projection.finalNominal) + '</div></div><div class="sc"><div class="st">תחזית (ריאלי)</div><div class="sv">' + formatCurrency(totalReal) + '</div></div></div>';
    h += '<h2>📈 ממוצעים משוקללים</h2><div class="sg"><div class="sc"><div class="st">תשואה שנתית</div><div class="sv">' + avgReturn.toFixed(2) + '%</div></div><div class="sc"><div class="st">דמ"נ צבירה</div><div class="sv">' + avgFeeAnnual.toFixed(2) + '%</div></div><div class="sc"><div class="st">דמ"נ הפקדה</div><div class="sv">' + avgFeeDeposit.toFixed(2) + '%</div></div></div>';
    
    // Investment breakdown
    h += '<h2>📋 פירוט מסלולי השקעה</h2><table><thead><tr><th>שם</th><th>בית השקעות</th><th>סכום היום</th><th>הפקדה חודשית</th><th>תחזית (' + years + ' שנים)</th><th>רווח צפוי</th></tr></thead><tbody>';
    breakdown.forEach(i => { h += '<tr><td><strong>' + i.name + '</strong></td><td>' + i.house + '</td><td>' + formatCurrency(i.today) + '</td><td>' + formatCurrency(i.monthly) + '/חודש</td><td>' + formatCurrency(i.future) + '</td><td class="p">' + formatCurrency(i.profit) + '</td></tr>'; });
    const tm = equityInvs.reduce((s, i) => s + (i.monthly || 0), 0);
    h += '<tr style="background:#f3f4f6;font-weight:bold"><td colspan="2">סה"כ</td><td>' + formatCurrency(totalToday) + '</td><td>' + formatCurrency(tm) + '/חודש</td><td>' + formatCurrency(projection.finalNominal) + '</td><td class="p">' + formatCurrency(projection.finalNominal - projection.finalPrincipal) + '</td></tr></tbody></table>';
    
    // Distribution tables (NEW)
    h += '<h2>📊 חלוקת התיק (סכומים נוכחיים)</h2><div class="dg">';
    h += '<div>' + buildDistTable('🏷️ לפי סוג מסלול', byType, allTotal) + '</div>';
    h += '<div>' + buildDistTable('🏢 לפי בית השקעות', byHouse, allTotal) + '</div>';
    h += '</div><div class="dg">';
    h += '<div>' + buildDistTable('💸 לפי מיסוי', { 'פטור ממס': taxExempt, 'חייב במס': taxable }, allTotal) + '</div>';
    const riskTotal = Object.values(riskTotals).reduce((s, v) => s + v, 0);
    if (riskTotal > 0) { h += '<div>' + buildDistTable('⚠️ לפי רמת סיכון', riskTotals, riskTotal) + '</div>'; }
    h += '</div>';
    
    // Projections
    h += '<h2>📈 תחזית צמיחה (כל ' + il + ')' + (hasW ? ' <span style="font-size:0.6em;color:#f59e0b;">⚠️ כולל משיכות</span>' : '') + '</h2>';
    h += '<table><thead><tr><th>שנה</th><th>ערך נומינלי</th>' + (hasW ? '<th style="background:#dc2626;">משיכה</th><th style="background:#dc2626;">מטרה</th>' : '') + '<th>ערך ריאלי</th><th>מס במשיכה</th><th>נטו לאחר מס</th></tr></thead><tbody>' + projRows + '</tbody></table>';
    
    if (equityInvs.length > 1) { h += '<h2>📊 התקדמות לפי מסלול (כל ' + il + ')</h2><div class="ts"><table><thead><tr>' + ptH + '</tr></thead><tbody>' + ptR + '</tbody></table></div>'; }
    
    if (hasW) {
        const tw = activeWithdrawals.reduce((s, w) => s + w.amount, 0);
        h += '<h2>🗓️ סיכום משיכות מתוכננות</h2><p style="margin-bottom:16px;color:#666;">סה"כ: <strong style="color:#ef4444;">' + formatCurrency(tw) + '</strong></p>';
        h += '<table><thead><tr><th>שנה</th><th>מטרה</th><th>סכום</th><th>סטטוס</th></tr></thead><tbody>';
        activeWithdrawals.forEach(w => { h += '<tr><td><strong>' + w.year + '</strong></td><td>' + (w.goalId ? '🎯 ' : '') + w.goal + '</td><td style="color:#f59e0b;font-weight:bold">' + formatCurrency(w.amount) + '</td><td>' + (w.goalId ? 'מקושר ליעד' : 'ידנית') + '</td></tr>'; });
        h += '</tbody></table>';
    }
    
    h += '<p style="margin-top:40px;padding-top:20px;border-top:2px solid #e5e7eb;color:#6b7280;text-align:center">נוצר באמצעות מתכנן פיננסי | ' + new Date().toLocaleDateString('he-IL') + '</p></div><button class="pb" onclick="window.print()">🖨️ הדפס / שמור PDF</button></body></html>';
    
    const w = window.open('', '_blank'); w.document.write(h); w.document.close();
};

// ============================================================
// 3. GLIDE PATH - Enhanced with track-specific recommendations
// ============================================================

const GLIDE_PATH_PHASES = [
    { id: 'aggressive', name: 'אגרסיבי', minYears: 5, stocks: 100, bonds: 0, conservative: 0, expectedReturn: 7.0, color: '#ef4444', emoji: '🔴', description: '100% מנייתי — אופק ארוך מאפשר סיכון גבוה' },
    { id: 'moderate_high', name: 'בינוני-גבוה', minYears: 2, stocks: 70, bonds: 30, conservative: 0, expectedReturn: 6.1, color: '#f59e0b', emoji: '🟡', description: '70% מניות + 30% אג״ח' },
    { id: 'moderate_low', name: 'בינוני-נמוך', minYears: 1, stocks: 50, bonds: 50, conservative: 0, expectedReturn: 5.5, color: '#3b82f6', emoji: '🔵', description: '50% מניות + 50% אג״ח' },
    { id: 'conservative', name: 'סולידי', minYears: 0, stocks: 0, bonds: 0, conservative: 100, expectedReturn: 3.0, color: '#10b981', emoji: '🟢', description: '100% פקדון/קרן כספית' }
];

// Tax-exempt types that should be prioritized for stock allocation
const STOCK_PRIORITY_TYPES = ['קרן השתלמות', 'פנסיה'];
const TAXABLE_TYPES = ['תיק עצמאי', 'גמל להשקעה', 'פוליסת חסכון', 'פקדון'];

function getGlidePathPhase(yearsUntilWithdrawal) {
    if (yearsUntilWithdrawal >= 5) return GLIDE_PATH_PHASES[0];
    if (yearsUntilWithdrawal >= 2) return GLIDE_PATH_PHASES[1];
    if (yearsUntilWithdrawal >= 1) return GLIDE_PATH_PHASES[2];
    return GLIDE_PATH_PHASES[3];
}

function calculateFVWithGlidePath(amount, monthly, yearsUntilWithdrawal, feeDeposit, feeAnnual) {
    let balance = amount;
    const m = monthly * (1 - (feeDeposit || 0) / 100);
    for (let y = 0; y < yearsUntilWithdrawal; y++) {
        const remaining = yearsUntilWithdrawal - y;
        const phase = getGlidePathPhase(remaining);
        const yearlyRate = (phase.expectedReturn - (feeAnnual || 0)) / 100;
        const monthlyRate = yearlyRate / 12;
        for (let month = 0; month < 12; month++) {
            balance = balance * (1 + monthlyRate) + m;
        }
    }
    return balance;
}

function getTrackRecommendations(plan, phase) {
    // Sort investments: tax-exempt first (should stay in stocks longer), then taxable
    const invs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    
    const taxExempt = invs.filter(inv => STOCK_PRIORITY_TYPES.includes(inv.type));
    const taxableInvs = invs.filter(inv => !STOCK_PRIORITY_TYPES.includes(inv.type));
    
    const recommendations = [];
    
    if (phase.id === 'aggressive') {
        // All in stocks - tax-exempt first
        taxExempt.forEach(inv => {
            recommendations.push({ name: inv.name, type: inv.type, amount: inv.amount, action: 'מניות', reason: 'פטור ממס — עדיפות למנייתי', color: '#ef4444', priority: 'מנייתי' });
        });
        taxableInvs.forEach(inv => {
            recommendations.push({ name: inv.name, type: inv.type, amount: inv.amount, action: 'מניות', reason: 'אופק ארוך — מנייתי', color: '#ef4444', priority: 'מנייתי' });
        });
    } else if (phase.id === 'moderate_high' || phase.id === 'moderate_low') {
        const stockPct = phase.stocks;
        const bondPct = phase.bonds;
        
        // Tax-exempt → keep in stocks (they don't pay tax on gains)
        taxExempt.forEach(inv => {
            recommendations.push({ name: inv.name, type: inv.type, amount: inv.amount, action: 'מניות', reason: 'פטור ממס — להשאיר במנייתי', color: '#ef4444', priority: 'מנייתי' });
        });
        
        // Taxable → move to bonds/conservative (reduces future tax liability)
        taxableInvs.forEach(inv => {
            recommendations.push({ name: inv.name, type: inv.type, amount: inv.amount, action: 'אג״ח / סולידי', reason: 'חייב במס — להעביר לסולידי', color: '#3b82f6', priority: 'אג״ח' });
        });
    } else {
        // Conservative - everything to safe
        taxExempt.forEach(inv => {
            recommendations.push({ name: inv.name, type: inv.type, amount: inv.amount, action: 'סולידי', reason: 'קרוב למשיכה — לשמור קרן', color: '#10b981', priority: 'סולידי' });
        });
        taxableInvs.forEach(inv => {
            recommendations.push({ name: inv.name, type: inv.type, amount: inv.amount, action: 'סולידי / פקדון', reason: 'קרוב למשיכה — לפדות לפקדון', color: '#10b981', priority: 'סולידי' });
        });
    }
    
    return recommendations;
}

const _origRenderWithdrawals = renderWithdrawals;
renderWithdrawals = function() {
    _origRenderWithdrawals();
    renderGlidePathAdvisor();
};

function renderGlidePathAdvisor() {
    const container = document.getElementById('glidePathAdvisor');
    if (!container) return;
    
    const plan = getCurrentPlan();
    const currentYear = new Date().getFullYear();
    const activeWithdrawals = (plan.withdrawals || []).filter(w => w.active !== false).sort((a, b) => a.year - b.year);
    
    if (activeWithdrawals.length === 0) { container.innerHTML = ''; return; }
    
    const equityInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalEquity = equityInvs.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalMonthly = equityInvs.reduce((sum, inv) => sum + (inv.monthly || 0), 0);
    const avgFeeAnnual = totalEquity > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeAnnual || 0)), 0) / totalEquity : 0;
    const avgFeeDeposit = totalEquity > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeDeposit || 0)), 0) / totalEquity : 0;
    const avgReturn = totalEquity > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.returnRate || 0)), 0) / totalEquity : 0;
    
    let html = '<div class="card" style="border: 2px solid #8b5cf6; margin-top: 20px;">';
    html += '<div class="card-title" style="margin-bottom: 4px;"><span>🎯</span> <span>יועץ הקצאה - Glide Path</span></div>';
    html += '<p style="color: #8b949e; font-size: 0.85em; margin-bottom: 16px;">התאמת רמת הסיכון לפי מועד המשיכה. <strong style="color: #a78bfa;">עיקרון מפתח:</strong> מסלולים פטורים ממס (קרן השתלמות) נשארים במניות כי הרווח פטור ממס. מסלולים חייבי מס עוברים לסולידי קודם.</p>';
    
    // Legend
    html += '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; padding: 10px; background: rgba(255,255,255,0.04); border-radius: 8px;">';
    GLIDE_PATH_PHASES.forEach(p => {
        html += '<div style="display: flex; align-items: center; gap: 4px; font-size: 0.8em;">' + p.emoji + ' <span style="color: ' + p.color + '; font-weight: 600;">' + p.name + '</span> <span style="color: #8b949e;">(' + p.expectedReturn + '%)</span></div>';
    });
    html += '</div>';
    
    activeWithdrawals.forEach((w, idx) => {
        const yearsUntil = w.year - currentYear;
        if (yearsUntil < 0) return;
        
        const phase = getGlidePathPhase(yearsUntil);
        const recs = getTrackRecommendations(plan, phase);
        
        const flatFV = calculateFV(w.amount, 0, avgReturn, yearsUntil, avgFeeDeposit, avgFeeAnnual, null);
        const glideFV = calculateFVWithGlidePath(w.amount, 0, yearsUntil, avgFeeDeposit, avgFeeAnnual);
        const diff = flatFV - glideFV;
        
        html += '<div style="margin-bottom: 16px; padding: 16px; border-radius: 12px; border: 2px solid ' + phase.color + '; background: rgba(255,255,255,0.03);">';
        
        // Header
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">';
        html += '<div><div style="font-weight: bold; font-size: 1.1em; color: #f0f6fc;">' + (w.goalId ? '🎯 ' : '') + w.goal + '</div>';
        html += '<div style="font-size: 0.85em; color: #8b949e;">' + w.year + ' (בעוד ' + yearsUntil + ' שנים) • ' + formatCurrency(w.amount) + '</div></div>';
        html += '<div style="font-size: 2em;">' + phase.emoji + '</div></div>';
        
        // Current recommendation
        html += '<div style="padding: 12px; background: rgba(139,92,246,0.1); border-radius: 8px; margin-bottom: 12px;">';
        html += '<div style="font-weight: bold; color: ' + phase.color + '; margin-bottom: 6px;">הקצאה מומלצת: ' + phase.name + '</div>';
        html += '<div style="font-size: 0.9em; color: #c9d1d9;">' + phase.description + '</div>';
        
        // Allocation bar
        html += '<div style="display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin-top: 10px;">';
        if (phase.stocks > 0) html += '<div style="width:' + phase.stocks + '%;background:#ef4444;display:flex;align-items:center;justify-content:center;font-size:0.75em;font-weight:bold;color:white;">' + phase.stocks + '% מניות</div>';
        if (phase.bonds > 0) html += '<div style="width:' + phase.bonds + '%;background:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:0.75em;font-weight:bold;color:white;">' + phase.bonds + '% אג״ח</div>';
        if (phase.conservative > 0) html += '<div style="width:' + phase.conservative + '%;background:#10b981;display:flex;align-items:center;justify-content:center;font-size:0.75em;font-weight:bold;color:white;">100% סולידי</div>';
        html += '</div></div>';
        
        // Track-specific recommendations (NEW)
        if (recs.length > 0) {
            html += '<div style="margin-bottom: 12px;">';
            html += '<div style="font-size: 0.9em; font-weight: bold; color: #a78bfa; margin-bottom: 8px;">📋 המלצה לפי מסלול:</div>';
            recs.forEach(rec => {
                const isTaxExempt = STOCK_PRIORITY_TYPES.includes(rec.type);
                html += '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 4px; border-radius: 6px; background: rgba(255,255,255,0.04); border-right: 3px solid ' + rec.color + ';">';
                html += '<div style="flex: 1;">';
                html += '<div style="font-weight: bold; color: #f0f6fc; font-size: 0.9em;">' + rec.name + '</div>';
                html += '<div style="font-size: 0.8em; color: #8b949e;">' + rec.type + (isTaxExempt ? ' ✅ פטור ממס' : ' 💸 חייב במס') + '</div>';
                html += '</div>';
                html += '<div style="text-align: left;">';
                html += '<div style="font-weight: bold; color: ' + rec.color + '; font-size: 0.9em;">→ ' + rec.action + '</div>';
                html += '<div style="font-size: 0.75em; color: #8b949e;">' + rec.reason + '</div>';
                html += '</div></div>';
            });
            html += '</div>';
        }
        
        // Timeline
        if (yearsUntil > 1) {
            html += '<div style="font-size: 0.85em; color: #8b949e; margin-bottom: 8px;">📅 לוח זמנים:</div>';
            html += '<div style="display: flex; flex-direction: column; gap: 4px;">';
            const shifts = [];
            if (yearsUntil >= 5) {
                shifts.push({ year: currentYear, toYear: w.year - 5, phase: GLIDE_PATH_PHASES[0] });
                shifts.push({ year: w.year - 5, toYear: w.year - 2, phase: GLIDE_PATH_PHASES[1] });
                shifts.push({ year: w.year - 2, toYear: w.year - 1, phase: GLIDE_PATH_PHASES[2] });
                shifts.push({ year: w.year - 1, toYear: w.year, phase: GLIDE_PATH_PHASES[3] });
            } else if (yearsUntil >= 2) {
                shifts.push({ year: currentYear, toYear: w.year - 2, phase: GLIDE_PATH_PHASES[1] });
                shifts.push({ year: w.year - 2, toYear: w.year - 1, phase: GLIDE_PATH_PHASES[2] });
                shifts.push({ year: w.year - 1, toYear: w.year, phase: GLIDE_PATH_PHASES[3] });
            } else {
                shifts.push({ year: currentYear, toYear: w.year - 1, phase: GLIDE_PATH_PHASES[2] });
                shifts.push({ year: w.year - 1, toYear: w.year, phase: GLIDE_PATH_PHASES[3] });
            }
            shifts.forEach(s => {
                const isCur = s.year <= currentYear && s.toYear > currentYear;
                html += '<div style="display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; ' + (isCur ? 'background: rgba(139,92,246,0.15); border: 1px solid #8b5cf6;' : '') + '">';
                html += s.phase.emoji + ' <span style="color:' + s.phase.color + ';font-weight:' + (isCur ? 'bold' : 'normal') + ';">' + s.phase.name + '</span>';
                html += ' <span style="color:#8b949e;font-size:0.85em;">' + s.year + '→' + s.toYear + '</span>';
                if (isCur) html += ' <span style="font-size:0.75em;color:#8b5cf6;font-weight:bold;">◀ עכשיו</span>';
                html += '</div>';
            });
            html += '</div>';
        }
        
        // Impact note
        if (yearsUntil >= 2 && diff > 0) {
            html += '<div style="margin-top: 10px; padding: 8px; background: rgba(245,158,11,0.08); border-radius: 8px; border-right: 3px solid #f59e0b; font-size: 0.85em;">';
            html += '<span style="color:#f59e0b;font-weight:bold;">💡 </span><span style="color:#c9d1d9;">עלות ההגנה: ~' + formatCurrency(Math.round(diff)) + ' פחות תשואה, תמורת הגנה על הקרן לקראת המשיכה.</span></div>';
        }
        
        html += '</div>';
    });
    
    // Overall impact
    if (totalEquity > 0) {
        const maxYears = Math.max(...activeWithdrawals.map(w => w.year - currentYear).filter(y => y > 0));
        if (maxYears > 0) {
            const flatTotal = calculateFV(totalEquity, totalMonthly, avgReturn, maxYears, avgFeeDeposit, avgFeeAnnual, null);
            const flatReal = calculateRealValue(flatTotal, maxYears);
            let gpTotal = 0;
            const totalWAmount = activeWithdrawals.reduce((s, w) => s + w.amount, 0);
            activeWithdrawals.forEach(w => {
                const yrs = w.year - currentYear;
                if (yrs > 0) gpTotal += calculateFVWithGlidePath(Math.min(w.amount, totalEquity * (w.amount / Math.max(totalWAmount, 1))), 0, yrs, avgFeeDeposit, avgFeeAnnual);
            });
            const remain = Math.max(0, totalEquity - totalWAmount);
            if (remain > 0) gpTotal += calculateFV(remain, totalMonthly, avgReturn, maxYears, avgFeeDeposit, avgFeeAnnual, null);
            const gpReal = calculateRealValue(gpTotal, maxYears);
            const totalDiff = flatReal - gpReal;
            
            html += '<div style="margin-top: 16px; padding: 16px; background: rgba(139,92,246,0.08); border: 2px solid #8b5cf6; border-radius: 12px;">';
            html += '<div style="font-weight: bold; margin-bottom: 12px; color: #a78bfa;">📊 השפעה כוללת (ריאלי, בעוד ' + maxYears + ' שנים)</div>';
            html += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">';
            html += '<div style="text-align:center;padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;"><div style="font-size:0.8em;color:#8b949e;">ללא Glide Path</div><div style="font-size:1.2em;font-weight:bold;">' + formatCurrency(flatReal) + '</div></div>';
            html += '<div style="text-align:center;padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;"><div style="font-size:0.8em;color:#8b949e;">עם Glide Path</div><div style="font-size:1.2em;font-weight:bold;color:#a78bfa;">' + formatCurrency(gpReal) + '</div></div>';
            html += '<div style="text-align:center;padding:12px;background:rgba(245,158,11,0.1);border-radius:8px;"><div style="font-size:0.8em;color:#8b949e;">עלות ההגנה</div><div style="font-size:1.2em;font-weight:bold;color:#f59e0b;">' + formatCurrency(Math.round(totalDiff)) + '</div></div>';
            html += '</div></div>';
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

console.log('✅ glide.js v2 loaded');
