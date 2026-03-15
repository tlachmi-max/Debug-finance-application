// ============================================================
// glide.js v4 - Glide Path + Charts + Report + Risk Fix
// ============================================================

console.log('✅ glide.js v4 loading...');

// ============================================================
// 0. FIX: classifyRisk by return rate (not by name)
// 1-4% = low, 5-6% = medium, 7%+ = high
// ============================================================

classifyRisk = function(subTrack) {
    // If manual risk is set, use it
    if (typeof subTrack === 'object' && subTrack.manualRisk) {
        return subTrack.manualRisk;
    }
    
    // Get the return rate
    let returnRate = 0;
    if (typeof subTrack === 'object' && subTrack.returnRate !== undefined) {
        returnRate = subTrack.returnRate;
    } else if (typeof subTrack === 'number') {
        returnRate = subTrack;
    }
    
    // Classify by return rate
    if (returnRate >= 7) return 'high';
    if (returnRate >= 5) return 'medium';
    if (returnRate >= 1) return 'low';
    
    // 0% or undefined
    return 'low';
};

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
    
    const byType = {}, byHouse = {}, bySubTrack = {};
    const subTrackObjects = [];
    let taxExempt = 0, taxable = 0;
    
    plan.investments.forEach(inv => {
        if (!inv.include) return;
        if (!include && inv.type === 'פנסיה') return;
        let value = years === 0 ? (inv.amount || 0) : calculateFV(inv.amount, inv.monthly, inv.returnRate, years, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        byType[inv.type] = (byType[inv.type] || 0) + value;
        byHouse[inv.house] = (byHouse[inv.house] || 0) + value;
        if (inv.subTracks && inv.subTracks.length > 0) {
            inv.subTracks.forEach(st => { const v = value * (st.percent / 100); bySubTrack[st.type] = (bySubTrack[st.type] || 0) + v; subTrackObjects.push({ ...st, value: v }); });
        } else {
            bySubTrack['לא מחולק'] = (bySubTrack['לא מחולק'] || 0) + value;
            subTrackObjects.push({ type: 'לא מחולק', value: value, returnRate: inv.returnRate || 0 });
        }
        if (inv.tax > 0) taxable += value; else taxExempt += value;
    });
    
    renderPieChart('chartBySubTracks', bySubTrack, 'תתי-מסלולים');
    renderPieChart('chartByType', byType, 'סוג מסלול');
    renderPieChartWithUniqueColors('chartByHouse', byHouse, 'בית השקעות');
    renderPieChart('chartByTax', { 'פטור ממס': taxExempt, 'חייב במס': taxable }, 'מיסוי');
    renderRiskPieChart(subTrackObjects);
};

// ============================================================
// 2. REPORT - Distribution tables
// ============================================================

const _origGenerateReport = generateReport;
generateReport = function() {
    const plan = getCurrentPlan();
    if (!plan || !plan.investments || plan.investments.length === 0) { _origGenerateReport(); return; }
    
    const years = parseInt(document.getElementById('sumYears')?.value) || 20;
    const interval = parseInt(document.getElementById('projInterval')?.value) || 5;
    const currentYear = new Date().getFullYear();
    const totalToday = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה').reduce((s, i) => s + (i.amount || 0), 0);
    const projection = calculateProjectionWithWithdrawals(plan.investments, years, plan.withdrawals || []);
    const equityInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalAmount = equityInvs.reduce((s, i) => s + (i.amount || 0), 0);
    const avgFeeAnnual = totalAmount > 0 ? equityInvs.reduce((s, i) => s + ((i.amount || 0) * (i.feeAnnual || 0)), 0) / totalAmount : 0;
    const avgFeeDeposit = totalAmount > 0 ? equityInvs.reduce((s, i) => s + ((i.amount || 0) * (i.feeDeposit || 0)), 0) / totalAmount : 0;
    const avgReturn = totalAmount > 0 ? equityInvs.reduce((s, i) => s + ((i.amount || 0) * (i.returnRate || 0)), 0) / totalAmount : 0;
    const totalReal = calculateRealValue(projection.finalNominal, years);
    
    const breakdown = equityInvs.map(inv => {
        const nominal = calculateFV(inv.amount, inv.monthly, inv.returnRate, years, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        const principal = calculatePrincipal(inv.amount, inv.monthly, years, inv);
        return { name: inv.name, house: inv.house, today: inv.amount, monthly: inv.monthly, future: nominal, profit: nominal - principal };
    });
    
    const activeW = (plan.withdrawals || []).filter(w => w.active !== false).sort((a, b) => a.year - b.year);
    const hasW = activeW.length > 0;
    const yearSet = new Set();
    for (let y = 0; y <= years; y += interval) yearSet.add(currentYear + y);
    activeW.forEach(w => { if (w.year >= currentYear && w.year <= currentYear + years) yearSet.add(w.year); });
    const allYears = Array.from(yearSet).sort((a, b) => a - b);
    
    let projRows = '';
    allYears.forEach(year => {
        const y = year - currentYear;
        const proj = calculateProjectionWithWithdrawals(plan.investments, y, plan.withdrawals);
        const tn = proj.finalNominal, tp = proj.finalPrincipal, tax = calculateTax(tp, tn, 25, y), real = calculateRealValue(tn, y), net = tn - tax;
        const yw = activeW.filter(w => w.year === year), wa = yw.reduce((s, w) => s + w.amount, 0), wg = yw.map(w => w.goal).join(', '), hw = wa > 0;
        projRows += '<tr' + (hw ? ' style="background:#fef2f2;"' : '') + '><td style="font-weight:600;">' + year + '</td><td>' + formatCurrency(tn) + '</td>';
        if (hasW) projRows += '<td style="color:#ef4444;font-weight:' + (hw ? 'bold' : 'normal') + ';">' + (hw ? formatCurrency(wa) : '-') + '</td><td style="font-size:0.85em;">' + (wg || '-') + '</td>';
        projRows += '<td style="color:#3b82f6;">' + formatCurrency(real) + '</td><td style="color:#ef4444;">' + formatCurrency(tax) + '</td><td style="color:#10b981;font-weight:600;">' + formatCurrency(net) + '</td></tr>';
    });
    
    let ptH = '<th>שנה</th>', ptR = '';
    equityInvs.forEach(inv => { ptH += '<th>' + inv.name + '</th>'; });
    ptH += '<th style="background:#1e40af;">סה"כ</th>';
    for (let y = 0; y <= years; y += interval) {
        let rt = 0; ptR += '<tr><td style="font-weight:600;">' + (currentYear + y) + '</td>';
        equityInvs.forEach(inv => { const v = calculateFV(inv.amount, inv.monthly, inv.returnRate, y, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks); rt += v; ptR += '<td>' + formatCurrency(v) + '</td>'; });
        ptR += '<td style="font-weight:700;color:#10b981;">' + formatCurrency(rt) + '</td></tr>';
    }
    
    // Distribution tables - build for BOTH with and without pension
    function buildDistData(invList) {
        const total = invList.reduce((s, i) => s + (i.amount || 0), 0);
        const bt = {}, bh = {}; let te = 0, tt = 0;
        invList.forEach(inv => { bt[inv.type] = (bt[inv.type] || 0) + (inv.amount || 0); bh[inv.house || 'לא מוגדר'] = (bh[inv.house || 'לא מוגדר'] || 0) + (inv.amount || 0); if (inv.tax > 0) tt += (inv.amount || 0); else te += (inv.amount || 0); });
        const rt = { 'סיכון גבוה': 0, 'סיכון בינוני': 0, 'סיכון נמוך': 0 };
        invList.forEach(inv => {
            if (inv.subTracks && inv.subTracks.length > 0) {
                inv.subTracks.forEach(st => { const v = (inv.amount || 0) * (st.percent / 100); const r = classifyRisk(st); if (r === 'high') rt['סיכון גבוה'] += v; else if (r === 'medium') rt['סיכון בינוני'] += v; else if (r === 'low') rt['סיכון נמוך'] += v; });
            } else {
                const v = inv.amount || 0; const r = classifyRisk({ returnRate: inv.returnRate || 0 }); if (r === 'high') rt['סיכון גבוה'] += v; else if (r === 'medium') rt['סיכון בינוני'] += v; else if (r === 'low') rt['סיכון נמוך'] += v;
            }
        });
        return { total, bt, bh, te, tt, rt };
    }
    
    const allInvs = plan.investments.filter(inv => inv.include);
    const noPensionInvs = allInvs.filter(inv => inv.type !== 'פנסיה');
    const distAll = buildDistData(allInvs);
    const distNoPension = buildDistData(noPensionInvs);
    
    function dT(title, data, total) {
        let t = '<h2>' + title + '</h2><table><thead><tr><th>קטגוריה</th><th>סכום</th><th>אחוז</th></tr></thead><tbody>';
        Object.entries(data).sort((a, b) => b[1] - a[1]).forEach(e => { t += '<tr><td>' + e[0] + '</td><td>' + formatCurrency(e[1]) + '</td><td>' + (total > 0 ? ((e[1] / total) * 100).toFixed(1) : '0') + '%</td></tr>'; });
        t += '<tr style="background:#f3f4f6;font-weight:bold"><td>סה"כ</td><td>' + formatCurrency(total) + '</td><td>100%</td></tr></tbody></table>'; return t;
    }
    
    const il = interval === 1 ? 'שנה' : interval === 2 ? 'שנתיים' : interval + ' שנים';
    let h = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>דוח פיננסי</title><style>body{font-family:Arial;padding:40px;background:#f9fafb}.container{max-width:1200px;margin:0 auto;background:white;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}h1{color:#1f2937;font-size:2.5em;border-bottom:4px solid #3b82f6;padding-bottom:16px;margin-bottom:24px}h2{color:#3b82f6;font-size:1.5em;margin:32px 0 16px;padding-right:12px;border-right:4px solid #3b82f6}.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0}.sc{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:12px}.st{font-size:0.9em;opacity:0.9;margin-bottom:8px}.sv{font-size:1.8em;font-weight:bold}table{width:100%;border-collapse:collapse;margin:20px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1)}th{background:#3b82f6;color:white;padding:12px;text-align:right}td{padding:10px 12px;border-bottom:1px solid #e5e7eb}tr:hover{background:#f3f4f6}.p{color:#10b981;font-weight:bold}.ts{overflow-x:auto}.dg{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}.pb{position:fixed;bottom:30px;left:30px;background:#3b82f6;color:white;border:none;padding:16px 24px;border-radius:12px;font-size:1.1em;cursor:pointer;z-index:1000}@media print{.pb{display:none}}@media(max-width:768px){.dg{grid-template-columns:1fr}}</style></head><body><div class="container">';
    h += '<h1>📊 דוח פיננסי מסכם</h1><p style="color:#6b7280;margin-bottom:32px">' + plan.name + ' | ' + new Date().toLocaleDateString('he-IL') + '</p>';
    h += '<h2>💰 מצב נוכחי</h2><div class="sg"><div class="sc"><div class="st">הון עצמי היום</div><div class="sv">' + formatCurrency(totalToday) + '</div></div><div class="sc"><div class="st">תחזית ' + years + ' שנים (נומינלי)</div><div class="sv">' + formatCurrency(projection.finalNominal) + '</div></div><div class="sc"><div class="st">תחזית (ריאלי)</div><div class="sv">' + formatCurrency(totalReal) + '</div></div></div>';
    h += '<h2>📈 ממוצעים</h2><div class="sg"><div class="sc"><div class="st">תשואה</div><div class="sv">' + avgReturn.toFixed(2) + '%</div></div><div class="sc"><div class="st">דמ"נ צבירה</div><div class="sv">' + avgFeeAnnual.toFixed(2) + '%</div></div><div class="sc"><div class="st">דמ"נ הפקדה</div><div class="sv">' + avgFeeDeposit.toFixed(2) + '%</div></div></div>';
    h += '<h2>📋 פירוט מסלולים</h2><table><thead><tr><th>שם</th><th>בית השקעות</th><th>היום</th><th>חודשי</th><th>תחזית</th><th>רווח</th></tr></thead><tbody>';
    breakdown.forEach(i => { h += '<tr><td><strong>' + i.name + '</strong></td><td>' + i.house + '</td><td>' + formatCurrency(i.today) + '</td><td>' + formatCurrency(i.monthly) + '</td><td>' + formatCurrency(i.future) + '</td><td class="p">' + formatCurrency(i.profit) + '</td></tr>'; });
    const tm = equityInvs.reduce((s, i) => s + (i.monthly || 0), 0);
    h += '<tr style="background:#f3f4f6;font-weight:bold"><td colspan="2">סה"כ</td><td>' + formatCurrency(totalToday) + '</td><td>' + formatCurrency(tm) + '</td><td>' + formatCurrency(projection.finalNominal) + '</td><td class="p">' + formatCurrency(projection.finalNominal - projection.finalPrincipal) + '</td></tr></tbody></table>';
    h += '<h2>📊 חלוקת התיק — כולל פנסיה</h2><div class="dg"><div>' + dT('🏷️ סוג מסלול', distAll.bt, distAll.total) + '</div><div>' + dT('🏢 בית השקעות', distAll.bh, distAll.total) + '</div></div><div class="dg"><div>' + dT('💸 מיסוי', { 'פטור': distAll.te, 'חייב': distAll.tt }, distAll.total) + '</div>';
    const rTotalAll = Object.values(distAll.rt).reduce((s, v) => s + v, 0);
    if (rTotalAll > 0) h += '<div>' + dT('⚠️ סיכון', distAll.rt, rTotalAll) + '</div>';
    h += '</div>';
    h += '<h2>📊 חלוקת התיק — ללא פנסיה (הון עצמי)</h2><div class="dg"><div>' + dT('🏷️ סוג מסלול', distNoPension.bt, distNoPension.total) + '</div><div>' + dT('🏢 בית השקעות', distNoPension.bh, distNoPension.total) + '</div></div><div class="dg"><div>' + dT('💸 מיסוי', { 'פטור': distNoPension.te, 'חייב': distNoPension.tt }, distNoPension.total) + '</div>';
    const rTotalNP = Object.values(distNoPension.rt).reduce((s, v) => s + v, 0);
    if (rTotalNP > 0) h += '<div>' + dT('⚠️ סיכון', distNoPension.rt, rTotalNP) + '</div>';
    h += '</div>';
    h += '<h2>📈 תחזית (כל ' + il + ')' + (hasW ? ' ⚠️' : '') + '</h2><table><thead><tr><th>שנה</th><th>נומינלי</th>' + (hasW ? '<th style="background:#dc2626;">משיכה</th><th style="background:#dc2626;">מטרה</th>' : '') + '<th>ריאלי</th><th>מס</th><th>נטו</th></tr></thead><tbody>' + projRows + '</tbody></table>';
    if (equityInvs.length > 1) h += '<h2>📊 לפי מסלול</h2><div class="ts"><table><thead><tr>' + ptH + '</tr></thead><tbody>' + ptR + '</tbody></table></div>';
    if (hasW) { const tw = activeW.reduce((s, w) => s + w.amount, 0); h += '<h2>🗓️ משיכות</h2><p style="color:#666;">סה"כ: <strong style="color:#ef4444;">' + formatCurrency(tw) + '</strong></p><table><thead><tr><th>שנה</th><th>מטרה</th><th>סכום</th></tr></thead><tbody>'; activeW.forEach(w => { h += '<tr><td>' + w.year + '</td><td>' + w.goal + '</td><td style="color:#f59e0b;font-weight:bold">' + formatCurrency(w.amount) + '</td></tr>'; }); h += '</tbody></table>'; }
    h += '<p style="margin-top:40px;border-top:2px solid #e5e7eb;padding-top:20px;color:#6b7280;text-align:center">מתכנן פיננסי | ' + new Date().toLocaleDateString('he-IL') + '</p></div><button class="pb" onclick="window.print()">🖨️ הדפס</button></body></html>';
    const w = window.open('', '_blank'); w.document.write(h); w.document.close();
};

// ============================================================
// 3. GLIDE PATH - Concrete track-level allocation per goal
// ============================================================

const GLIDE_PHASES = [
    { id: 'aggressive', name: 'אגרסיבי', minYears: 5, stocks: 100, bonds: 0, conservative: 0, ret: 7.0, color: '#ef4444', emoji: '🔴' },
    { id: 'mod_high', name: 'בינוני-גבוה', minYears: 2, stocks: 70, bonds: 30, conservative: 0, ret: 6.1, color: '#f59e0b', emoji: '🟡' },
    { id: 'mod_low', name: 'בינוני-נמוך', minYears: 1, stocks: 50, bonds: 50, conservative: 0, ret: 5.5, color: '#3b82f6', emoji: '🔵' },
    { id: 'safe', name: 'סולידי', minYears: 0, stocks: 0, bonds: 0, conservative: 100, ret: 3.0, color: '#10b981', emoji: '🟢' }
];

function getPhase(yrs) {
    if (yrs >= 5) return GLIDE_PHASES[0];
    if (yrs >= 2) return GLIDE_PHASES[1];
    if (yrs >= 1) return GLIDE_PHASES[2];
    return GLIDE_PHASES[3];
}

// Allocate goal amount to specific tracks
// Priority: taxable tracks get moved to conservative FIRST (reduces tax on gains)
function allocateGoalToTracks(goalAmount, phase, plan) {
    const invs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    
    // Split goal into buckets
    const stocksAmount = goalAmount * phase.stocks / 100;
    const bondsAmount = goalAmount * phase.bonds / 100;
    const safeAmount = goalAmount * phase.conservative / 100;
    const nonStocksNeeded = bondsAmount + safeAmount; // Amount that needs to move OUT of stocks
    
    // Sort: taxable first for moving to conservative, tax-exempt stay in stocks
    const taxable = invs.filter(inv => inv.tax > 0).sort((a, b) => b.amount - a.amount);
    const taxExempt = invs.filter(inv => inv.tax === 0).sort((a, b) => b.amount - a.amount);
    
    const actions = [];
    let remainingToMove = nonStocksNeeded;
    
    // Step 1: Move from TAXABLE tracks to conservative/bonds first
    taxable.forEach(inv => {
        if (remainingToMove <= 0) {
            // This taxable track can stay in stocks (if any allocation left)
            return;
        }
        const moveAmount = Math.min(remainingToMove, inv.amount);
        if (moveAmount > 0) {
            const targetType = phase.conservative > 0 ? 'סולידי (פקדון/כספית)' : 'אג״ח';
            actions.push({
                name: inv.name,
                type: inv.type,
                house: inv.house,
                available: inv.amount,
                moveAmount: moveAmount,
                from: 'מנייתי',
                to: targetType,
                reason: 'חייב במס — העבר לסולידי קודם',
                color: phase.conservative > 0 ? '#10b981' : '#3b82f6',
                isTaxable: true
            });
            remainingToMove -= moveAmount;
        }
    });
    
    // Step 2: If still need more, move from tax-exempt (less ideal)
    taxExempt.forEach(inv => {
        if (remainingToMove <= 0) return;
        const moveAmount = Math.min(remainingToMove, inv.amount);
        if (moveAmount > 0) {
            const targetType = phase.conservative > 0 ? 'סולידי (פקדון/כספית)' : 'אג״ח';
            actions.push({
                name: inv.name,
                type: inv.type,
                house: inv.house,
                available: inv.amount,
                moveAmount: moveAmount,
                from: 'מנייתי',
                to: targetType,
                reason: 'פטור ממס — להעביר רק אם חייבים',
                color: '#f59e0b',
                isTaxable: false
            });
            remainingToMove -= moveAmount;
        }
    });
    
    // Step 3: Tax-exempt tracks that STAY in stocks (good!)
    taxExempt.forEach(inv => {
        // Check if this track wasn't already used above
        const alreadyUsed = actions.find(a => a.name === inv.name);
        if (!alreadyUsed && stocksAmount > 0) {
            actions.push({
                name: inv.name,
                type: inv.type,
                house: inv.house,
                available: inv.amount,
                moveAmount: 0,
                from: 'מנייתי',
                to: 'נשאר במנייתי ✅',
                reason: 'פטור ממס — עדיפות להישאר במניות',
                color: '#10b981',
                isTaxable: false,
                staysInStocks: true
            });
        }
    });
    
    return {
        stocksAmount,
        bondsAmount,
        safeAmount,
        nonStocksNeeded,
        actions,
        shortfall: Math.max(0, remainingToMove)
    };
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
    const activeW = (plan.withdrawals || []).filter(w => w.active !== false).sort((a, b) => a.year - b.year);
    
    if (activeW.length === 0) { container.innerHTML = ''; return; }
    
    let html = '<div class="card" style="border: 2px solid #8b5cf6; margin-top: 20px;">';
    html += '<div class="card-title" style="margin-bottom: 4px;"><span>🎯</span> <span>יועץ הקצאה - Glide Path</span></div>';
    html += '<p style="color: #8b949e; font-size: 0.85em; margin-bottom: 8px;">הקצאת כספים לפי מועד משיכה. <strong style="color: #a78bfa;">עיקרון:</strong> מסלולים חייבי מס עוברים לסולידי קודם. מסלולים פטורים נשארים במניות כמה שאפשר.</p>';
    
    // Legend
    html += '<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; padding: 8px; background: rgba(255,255,255,0.04); border-radius: 8px; font-size: 0.8em;">';
    GLIDE_PHASES.forEach(p => { html += '<div style="display:flex;align-items:center;gap:3px;">' + p.emoji + '<span style="color:' + p.color + ';font-weight:600;">' + p.name + '</span>(' + p.stocks + '/' + p.bonds + '/' + p.conservative + ')</div>'; });
    html += '</div>';
    
    activeW.forEach(w => {
        const yrs = w.year - currentYear;
        if (yrs < 0) return;
        
        const phase = getPhase(yrs);
        const allocation = allocateGoalToTracks(w.amount, phase, plan);
        
        html += '<div style="margin-bottom: 16px; padding: 16px; border-radius: 12px; border: 2px solid ' + phase.color + ';">';
        
        // Header
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">';
        html += '<div><div style="font-weight: bold; font-size: 1.1em; color: #f0f6fc;">' + (w.goalId ? '🎯 ' : '') + w.goal + '</div>';
        html += '<div style="font-size: 0.85em; color: #8b949e;">' + w.year + ' • בעוד ' + yrs + ' שנים • ' + formatCurrency(w.amount) + '</div></div>';
        html += '<div style="font-size: 2em;">' + phase.emoji + '</div></div>';
        
        // Allocation split
        html += '<div style="padding: 12px; background: rgba(139,92,246,0.08); border-radius: 8px; margin-bottom: 12px;">';
        html += '<div style="font-weight: bold; color: #a78bfa; margin-bottom: 8px;">חלוקה נדרשת (' + phase.name + '):</div>';
        
        // Bar
        html += '<div style="display: flex; height: 32px; border-radius: 6px; overflow: hidden; margin-bottom: 8px;">';
        if (phase.stocks > 0) html += '<div style="width:' + phase.stocks + '%;background:#ef4444;display:flex;align-items:center;justify-content:center;font-size:0.8em;font-weight:bold;color:white;">' + formatCurrency(allocation.stocksAmount) + '</div>';
        if (phase.bonds > 0) html += '<div style="width:' + phase.bonds + '%;background:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:0.8em;font-weight:bold;color:white;">' + formatCurrency(allocation.bondsAmount) + '</div>';
        if (phase.conservative > 0) html += '<div style="width:' + phase.conservative + '%;background:#10b981;display:flex;align-items:center;justify-content:center;font-size:0.8em;font-weight:bold;color:white;">' + formatCurrency(allocation.safeAmount) + '</div>';
        html += '</div>';
        
        html += '<div style="display: flex; gap: 12px; font-size: 0.85em; color: #c9d1d9;">';
        if (phase.stocks > 0) html += '<span>🔴 מניות: ' + phase.stocks + '% (' + formatCurrency(allocation.stocksAmount) + ')</span>';
        if (phase.bonds > 0) html += '<span>🔵 אג״ח: ' + phase.bonds + '% (' + formatCurrency(allocation.bondsAmount) + ')</span>';
        if (phase.conservative > 0) html += '<span>🟢 סולידי: ' + phase.conservative + '% (' + formatCurrency(allocation.safeAmount) + ')</span>';
        html += '</div></div>';
        
        // Concrete track actions
        if (allocation.actions.length > 0 && allocation.nonStocksNeeded > 0) {
            html += '<div style="margin-bottom: 12px;">';
            html += '<div style="font-size: 0.9em; font-weight: bold; color: #f0f6fc; margin-bottom: 8px;">📋 פעולות נדרשות:</div>';
            
            allocation.actions.forEach(a => {
                if (a.staysInStocks) {
                    // Track stays in stocks - show as info
                    html += '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 4px; border-radius: 6px; background: rgba(16,185,129,0.08); border-right: 3px solid #10b981;">';
                    html += '<div style="flex: 1;"><div style="font-weight: bold; color: #f0f6fc; font-size: 0.9em;">' + a.name + '</div>';
                    html += '<div style="font-size: 0.8em; color: #8b949e;">' + a.type + ' • ' + a.house + ' ✅ פטור ממס</div></div>';
                    html += '<div style="text-align: left; color: #10b981; font-size: 0.85em; font-weight: bold;">נשאר במניות</div></div>';
                } else {
                    // Track needs to move
                    html += '<div style="display: flex; align-items: center; gap: 8px; padding: 10px; margin-bottom: 4px; border-radius: 6px; background: rgba(255,255,255,0.04); border-right: 3px solid ' + a.color + ';">';
                    html += '<div style="flex: 1;">';
                    html += '<div style="font-weight: bold; color: #f0f6fc; font-size: 0.95em;">' + a.name + '</div>';
                    html += '<div style="font-size: 0.8em; color: #8b949e;">' + a.type + ' • ' + a.house + (a.isTaxable ? ' 💸 חייב במס' : ' ✅ פטור') + '</div>';
                    html += '<div style="font-size: 0.8em; color: #8b949e;">יתרה: ' + formatCurrency(a.available) + '</div>';
                    html += '</div>';
                    html += '<div style="text-align: left; min-width: 120px;">';
                    html += '<div style="font-weight: bold; color: ' + a.color + '; font-size: 1.1em;">העבר ' + formatCurrency(a.moveAmount) + '</div>';
                    html += '<div style="font-size: 0.8em; color: #8b949e;">→ ' + a.to + '</div>';
                    html += '</div></div>';
                }
            });
            
            if (allocation.shortfall > 0) {
                html += '<div style="padding: 8px; background: rgba(239,68,68,0.1); border-radius: 6px; margin-top: 4px; color: #f85149; font-size: 0.85em;">⚠️ חסר ' + formatCurrency(allocation.shortfall) + ' — אין מספיק כסף במסלולים הקיימים</div>';
            }
            
            html += '</div>';
        } else if (phase.id === 'aggressive') {
            html += '<div style="padding: 10px; background: rgba(16,185,129,0.08); border-radius: 8px; font-size: 0.9em; color: #3fb950;">✅ כל הכסף נשאר במניות — אין צורך בפעולה כרגע</div>';
        }
        
        // Timeline
        if (yrs > 1) {
            html += '<div style="margin-top: 12px; font-size: 0.85em; color: #8b949e;">📅 לוח זמנים למעברים:</div>';
            html += '<div style="display: flex; flex-direction: column; gap: 3px; margin-top: 6px;">';
            const shifts = [];
            if (yrs >= 5) { shifts.push({ y: currentYear, to: w.year - 5, p: GLIDE_PHASES[0] }); shifts.push({ y: w.year - 5, to: w.year - 2, p: GLIDE_PHASES[1] }); shifts.push({ y: w.year - 2, to: w.year - 1, p: GLIDE_PHASES[2] }); shifts.push({ y: w.year - 1, to: w.year, p: GLIDE_PHASES[3] }); }
            else if (yrs >= 2) { shifts.push({ y: currentYear, to: w.year - 2, p: GLIDE_PHASES[1] }); shifts.push({ y: w.year - 2, to: w.year - 1, p: GLIDE_PHASES[2] }); shifts.push({ y: w.year - 1, to: w.year, p: GLIDE_PHASES[3] }); }
            else { shifts.push({ y: currentYear, to: w.year - 1, p: GLIDE_PHASES[2] }); shifts.push({ y: w.year - 1, to: w.year, p: GLIDE_PHASES[3] }); }
            shifts.forEach(s => {
                const cur = s.y <= currentYear && s.to > currentYear;
                html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:4px;' + (cur ? 'background:rgba(139,92,246,0.15);border:1px solid #8b5cf6;' : '') + '">';
                html += s.p.emoji + ' <span style="color:' + s.p.color + ';font-weight:' + (cur ? 'bold' : 'normal') + ';">' + s.p.name + '</span> <span style="color:#8b949e;font-size:0.85em;">' + s.y + '→' + s.to + '</span>';
                if (cur) html += ' <span style="font-size:0.75em;color:#8b5cf6;font-weight:bold;">◀ עכשיו</span>';
                html += '</div>';
            });
            html += '</div>';
        }
        
        html += '</div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
}

console.log('✅ glide.js v4 loaded');
