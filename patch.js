// ============================================================
// patch.js v4 - Financial Planner Pro
// Features: per-track table, enhanced report, impact simulator
// Fixes: color contrast (dark mode), roadmap mobile layout,
//        pension tab colors, risk analysis colors
// ============================================================

console.log('✅ patch.js v4 loading...');

// ============================================================
// CSS FIXES - Inject dark-mode color corrections
// ============================================================

(function injectStyleFixes() {
    const style = document.createElement('style');
    style.textContent = `
        /* Risk analysis: force dark text on white cards */
        #riskAnalysis .card div[style*="background: white"],
        #riskAnalysis .card div[style*="background:white"] {
            color: #1f2937 !important;
        }
        #riskAnalysis .card div[style*="background: white"] div,
        #riskAnalysis .card div[style*="background:white"] div,
        #riskAnalysis .card div[style*="background: white"] span,
        #riskAnalysis .card div[style*="background:white"] span {
            color: #1f2937 !important;
        }
        #riskAnalysis .card div[style*="background: #f3f4f6"],
        #riskAnalysis .card div[style*="background:#f3f4f6"] {
            color: #1f2937 !important;
        }
        #riskAnalysis .card div[style*="background: #f3f4f6"] strong {
            color: #1f2937 !important;
        }
        
        /* Risk analysis: colored text overrides */
        #riskAnalysis div[style*="color: #f59e0b"] {
            color: #f59e0b !important;
        }
        #riskAnalysis div[style*="color: #10b981"] {
            color: #10b981 !important;
        }
        #riskAnalysis div[style*="color: #ef4444"] {
            color: #ef4444 !important;
        }
        
        /* Diversification bars */
        #riskAnalysis div[style*="background: #e5e7eb"] {
            background: rgba(229, 231, 235, 0.3) !important;
        }
        
        /* Per-track table: ensure visible text */
        #perTrackBody td {
            color: var(--text, #c9d1d9) !important;
        }
        #perTrackHead th {
            color: white !important;
        }
        
        /* Fix pension item-card colors for dark mode */
        #pensionHusband .item-card,
        #pensionWife .item-card {
            background: rgba(255, 255, 255, 0.06) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        #pensionHusband .item-card div,
        #pensionWife .item-card div {
            color: #c9d1d9 !important;
        }
        #pensionHusband .item-card div[style*="font-weight: bold"],
        #pensionWife .item-card div[style*="font-weight: bold"] {
            color: #f0f6fc !important;
        }
        #pensionHusband .item-card div[style*="color: #3b82f6"],
        #pensionWife .item-card div[style*="color: #3b82f6"] {
            color: #58a6ff !important;
        }
        #pensionHusband .item-card div[style*="color: #10b981"],
        #pensionWife .item-card div[style*="color: #10b981"] {
            color: #3fb950 !important;
        }
        #pensionHusband .item-card div[style*="color: #666"],
        #pensionWife .item-card div[style*="color: #666"] {
            color: #8b949e !important;
        }
        #pensionHusband .item-card div[style*="color: #1f2937"],
        #pensionWife .item-card div[style*="color: #1f2937"] {
            color: #f0f6fc !important;
        }
        
        /* Roadmap: fix nested card narrowing in withdrawal strategies */
        #withdrawalStrategies .card {
            padding: 12px !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
        }
        #withdrawalStrategies .card .card {
            border: none !important;
            padding: 8px !important;
            box-shadow: none !important;
            margin: 0 !important;
        }
        #withdrawalStrategies .card .card .card {
            padding: 4px !important;
        }
        #withdrawalStrategies .card-header {
            padding: 8px 0 !important;
        }
        
        /* Fix the grid inside strategies that overflows on mobile */
        #withdrawalStrategies div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
        }
        #withdrawalStrategies div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
        }
        
        /* Reduce inner padding on all deeply nested divs */
        #withdrawalStrategies div[style*="padding: 20px"] {
            padding: 10px !important;
        }
        #withdrawalStrategies div[style*="padding: 16px"] {
            padding: 8px !important;
        }
        #withdrawalStrategies div[style*="padding: 12px"] {
            padding: 6px !important;
        }
        
        @media (max-width: 768px) {
            #withdrawalStrategies .card {
                padding: 8px !important;
            }
            #withdrawalStrategies div[style*="padding: 20px"] {
                padding: 6px !important;
            }
            #withdrawalStrategies div[style*="padding: 16px"] {
                padding: 6px !important;
            }
        }
    `;
    document.head.appendChild(style);
    console.log('✅ Dark-mode style fixes injected');
})();

// ============================================================
// Override renderTimeline for mobile-friendly layout
// ============================================================

const _origRenderTimeline = renderTimeline;

renderTimeline = function(withdrawals) {
    const container = document.getElementById('withdrawalTimeline');
    
    if (withdrawals.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">אין משיכות מתוכננות</div></div>';
        return;
    }
    
    const currentYear = new Date().getFullYear();
    
    let html = '<div style="padding: 20px;">';
    
    withdrawals.forEach((w, index) => {
        const yearsFromNow = w.year - currentYear;
        const isGoal = !!w.goalId;
        const borderColor = isGoal ? '#3b82f6' : '#f59e0b';
        
        html += `
            <div style="margin-bottom: 16px; padding: 16px; border-radius: 12px; border: 2px solid ${borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 1.8em; font-weight: bold; color: ${borderColor};">${w.year}</div>
                        <div style="font-size: 0.8em; color: #8b949e;">בעוד ${yearsFromNow} שנים</div>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-size: 1.3em; font-weight: bold; color: ${borderColor};">${formatCurrency(w.amount)}</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 1.1em; font-weight: bold; color: #f0f6fc;">
                        ${isGoal ? '🎯 ' : ''}${w.goal}
                    </div>
                    ${isGoal ? '<div style="font-size: 0.8em; color: #58a6ff;">← מקושר ליעד</div>' : ''}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" 
                               id="withdrawal_active_${index}" 
                               ${w.active !== false ? 'checked' : ''} 
                               onchange="toggleWithdrawal(${index})"
                               style="width: 20px; height: 20px; cursor: pointer;">
                        <span style="font-size: 0.85em; color: #8b949e;">כלול בתחזית</span>
                    </label>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" onclick="editWithdrawal(${index})" style="padding: 8px 12px;">✏️ ערוך</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteWithdrawal(${index})" style="padding: 8px 12px;">🗑️ מחק</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
};

// ============================================================
// Override renderPensionList for dark mode colors
// ============================================================

const _origRenderPensionList = renderPensionList;

renderPensionList = function(containerId, pensions, gender) {
    const container = document.getElementById(containerId);
    
    if (pensions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">אין קופות פנסיה</div></div>';
        return;
    }
    
    const years = parseInt(document.getElementById('pensionYears') && document.getElementById('pensionYears').value) || 20;
    const currentYear = new Date().getFullYear();
    
    let html = '';
    pensions.forEach((inv) => {
        const futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                       inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        const monthlyPension = calculateMonthlyPension(futureValue, gender);
        
        html += `
            <div style="padding: 16px; margin-bottom: 12px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-weight: bold; font-size: 1.1em; color: #f0f6fc;">${inv.name}</div>
                <div style="font-size: 0.9em; color: #8b949e; margin-top: 4px;">${inv.house}</div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                    <div>
                        <div style="font-size: 0.85em; color: #8b949e;">יתרה היום</div>
                        <div style="font-weight: bold; color: #58a6ff;">${formatCurrency(inv.amount)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: #8b949e;">הפקדה חודשית</div>
                        <div style="font-weight: bold; color: #3fb950;">${formatCurrency(inv.monthly)}</div>
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 0.85em; color: #8b949e;">צפי ב-${currentYear + years}</div>
                    <div style="font-weight: bold; font-size: 1.2em; color: #3fb950;">${formatCurrency(futureValue)}</div>
                    <div style="font-size: 0.9em; color: #58a6ff; margin-top: 4px;">
                        קצבה חודשית: ${formatCurrency(monthlyPension)}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
};

// ============================================================
// Override renderRiskAnalysis for dark mode colors
// ============================================================

const _origRenderRiskAnalysis = renderRiskAnalysis;

renderRiskAnalysis = function() {
    const container = document.getElementById('riskAnalysis');
    if (!container) return;
    
    const riskAnalysis = analyzeRisk();
    const divAnalysis = analyzeDiversification();
    
    if (!riskAnalysis && !divAnalysis) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="card" style="margin-top: 20px;">';
    html += '<h3 style="margin: 0 0 20px 0;">🎯 ניתוח סיכונים ופיזור</h3>';
    
    if (riskAnalysis) {
        html += '<div style="margin-bottom: 30px;">';
        html += '<h4 style="margin-bottom: 16px;">📊 ניתוח סיכון לפי אופק זמן</h4>';
        html += '<div style="padding: 16px; background: rgba(255,255,255,0.06); border-radius: 8px; margin-bottom: 16px;">';
        html += '<strong>חשיפה נוכחית למניות:</strong> ' + riskAnalysis.currentStockPercentage.toFixed(0) + '%';
        html += '</div>';
        
        html += '<div style="display: grid; gap: 12px;">';
        
        riskAnalysis.goals.forEach(goal => {
            const statusColor = goal.status === 'good' ? '#10b981' : 
                               goal.status === 'too_risky' ? '#ef4444' : '#f59e0b';
            const statusIcon = goal.status === 'good' ? '✅' : 
                              goal.status === 'too_risky' ? '⚠️' : '💡';
            const statusText = goal.status === 'good' ? 'מתאים' : 
                              goal.status === 'too_risky' ? 'סיכון גבוה מדי' : 'שמרני מדי';
            
            html += `
                <div style="padding: 16px; background: rgba(255,255,255,0.06); border: 2px solid ${statusColor}; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-weight: bold; font-size: 1.1em; color: #f0f6fc;">${goal.name}</div>
                            <div style="font-size: 0.9em; color: #8b949e;">${goal.year} (בעוד ${goal.yearsUntil} שנים) • רמת סיכון: ${goal.riskLevel}</div>
                        </div>
                        <div style="font-size: 1.5em;">${statusIcon}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                        <div>
                            <div style="font-size: 0.85em; color: #8b949e;">מניות מומלץ</div>
                            <div style="font-size: 1.2em; font-weight: bold; color: #f0f6fc;">${goal.recommendedStock}%</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85em; color: #8b949e;">סטטוס</div>
                            <div style="font-size: 1.1em; font-weight: bold; color: ${statusColor};">${statusText}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
    }
    
    if (divAnalysis) {
        html += '<div>';
        html += '<h4 style="margin-bottom: 16px;">🏦 ניתוח פיזור בין גופים</h4>';
        
        const scoreColor = divAnalysis.diversificationScore >= 70 ? '#10b981' : 
                          divAnalysis.diversificationScore >= 50 ? '#f59e0b' : '#ef4444';
        
        html += '<div style="padding: 16px; background: rgba(255,255,255,0.06); border-radius: 8px; margin-bottom: 16px; border-right: 4px solid ' + scoreColor + ';">';
        html += '<strong>ציון פיזור:</strong> ' + divAnalysis.diversificationScore + '/100';
        html += (divAnalysis.diversificationScore < 70 ? ' ⚠️ יש מקום לשיפור' : ' ✅ פיזור טוב');
        html += '</div>';
        
        if (divAnalysis.concentrated.length > 0) {
            html += '<div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-right: 4px solid #ef4444; border-radius: 8px; margin-bottom: 16px;">';
            html += '<strong style="color: #ef4444;">⚠️ ריכוזיות מוגזמת:</strong><br>';
            divAnalysis.concentrated.forEach(c => {
                html += '<div style="margin-top: 8px;">• ' + c.house + ': ' + c.percentage.toFixed(0) + '% (' + formatCurrency(c.amount) + ')</div>';
            });
            html += '</div>';
        }
        
        html += '<div style="display: grid; gap: 8px;">';
        divAnalysis.distribution.forEach(d => {
            const barColor = d.risk === 'high' ? '#ef4444' : '#3b82f6';
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-weight: 500;">${d.house}</span>
                        <span>${d.percentage.toFixed(0)}% • ${formatCurrency(d.amount)}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); height: 24px; border-radius: 12px; overflow: hidden;">
                        <div style="background: ${barColor}; height: 100%; width: ${d.percentage}%;"></div>
                    </div>
                </div>
            `;
        });
        html += '</div></div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
};

// ============================================================
// Per-track projections table (fixed colors)
// ============================================================

const _origRenderProjections = renderProjections;

renderProjections = function() {
    _origRenderProjections();
    renderPerTrackProjections();
};

function renderPerTrackProjections() {
    const plan = getCurrentPlan();
    const years = parseInt(document.getElementById('projYears').value) || 20;
    const interval = parseInt(document.getElementById('projInterval')?.value) || 5;
    const currentYear = new Date().getFullYear();
    
    const headEl = document.getElementById('perTrackHead');
    const bodyEl = document.getElementById('perTrackBody');
    if (!headEl || !bodyEl) return;
    
    const activeInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    
    if (activeInvs.length === 0) {
        headEl.innerHTML = '<tr><th>שנה</th><th>סה"כ</th></tr>';
        bodyEl.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 30px;">אין מסלולים להצגה</td></tr>';
        return;
    }
    
    let headerHTML = '<tr><th style="position: sticky; right: 0; z-index: 2;">שנה</th>';
    activeInvs.forEach(inv => {
        const shortName = inv.name.length > 15 ? inv.name.substring(0, 14) + '…' : inv.name;
        headerHTML += '<th title="' + inv.name + '">' + shortName + '</th>';
    });
    headerHTML += '<th style="background: #1e40af;">סה"כ</th></tr>';
    headEl.innerHTML = headerHTML;
    
    let rowsHTML = '';
    for (let y = 0; y <= years; y += interval) {
        const year = currentYear + y;
        let rowTotal = 0;
        
        rowsHTML += '<tr>';
        rowsHTML += '<td style="font-weight: 600;">' + year + '</td>';
        
        activeInvs.forEach(inv => {
            const value = calculateFV(inv.amount, inv.monthly, inv.returnRate, y, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
            rowTotal += value;
            rowsHTML += '<td>' + formatCurrency(value) + '</td>';
        });
        
        rowsHTML += '<td style="font-weight: 700; color: #3fb950;">' + formatCurrency(rowTotal) + '</td>';
        rowsHTML += '</tr>';
    }
    bodyEl.innerHTML = rowsHTML;
}

// ============================================================
// Impact Simulator for Summary tab
// ============================================================

const _origRenderSummary = renderSummary;

renderSummary = function() {
    _origRenderSummary();
    initImpactSimulator();
};

function initImpactSimulator() {
    const plan = getCurrentPlan();
    const activeInvestments = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalAmount = activeInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    if (totalAmount === 0) return;
    
    const avgFeeAnnual = activeInvestments.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeAnnual || 0)), 0) / totalAmount;
    const avgFeeDeposit = activeInvestments.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeDeposit || 0)), 0) / totalAmount;
    const avgReturn = activeInvestments.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.returnRate || 0)), 0) / totalAmount;
    
    const returnInput = document.getElementById('impactReturn');
    const feeAnnualInput = document.getElementById('impactFeeAnnual');
    const feeDepositInput = document.getElementById('impactFeeDeposit');
    if (!returnInput) return;
    
    returnInput.placeholder = avgReturn.toFixed(2);
    feeAnnualInput.placeholder = avgFeeAnnual.toFixed(2);
    feeDepositInput.placeholder = avgFeeDeposit.toFixed(2);
    
    const curReturnEl = document.getElementById('impactCurReturn');
    const curFeeAnnualEl = document.getElementById('impactCurFeeAnnual');
    const curFeeDepositEl = document.getElementById('impactCurFeeDeposit');
    if (curReturnEl) curReturnEl.textContent = avgReturn.toFixed(2) + '%';
    if (curFeeAnnualEl) curFeeAnnualEl.textContent = avgFeeAnnual.toFixed(2) + '%';
    if (curFeeDepositEl) curFeeDepositEl.textContent = avgFeeDeposit.toFixed(2) + '%';
}

function calculateImpact() {
    const plan = getCurrentPlan();
    const years = parseInt(document.getElementById('sumYears')?.value) || 20;
    const activeInvestments = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalAmount = activeInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    if (totalAmount === 0) { alert('אין מסלולי השקעה לחישוב'); return; }
    
    const curAvgReturn = activeInvestments.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.returnRate || 0)), 0) / totalAmount;
    const curAvgFeeAnnual = activeInvestments.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeAnnual || 0)), 0) / totalAmount;
    const curAvgFeeDeposit = activeInvestments.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeDeposit || 0)), 0) / totalAmount;
    
    const newReturn = parseFloat(document.getElementById('impactReturn').value) || curAvgReturn;
    const newFeeAnnual = parseFloat(document.getElementById('impactFeeAnnual').value) || curAvgFeeAnnual;
    const newFeeDeposit = parseFloat(document.getElementById('impactFeeDeposit').value) || curAvgFeeDeposit;
    const totalMonthly = activeInvestments.reduce((sum, inv) => sum + (inv.monthly || 0), 0);
    
    const currentFV = calculateFV(totalAmount, totalMonthly, curAvgReturn, years, curAvgFeeDeposit, curAvgFeeAnnual, null);
    const currentReal = calculateRealValue(currentFV, years);
    const newFV = calculateFV(totalAmount, totalMonthly, newReturn, years, newFeeDeposit, newFeeAnnual, null);
    const newReal = calculateRealValue(newFV, years);
    
    const diffReal = newReal - currentReal;
    const diffPercent = ((diffReal / currentReal) * 100).toFixed(1);
    const isPositive = diffReal >= 0;
    const color = isPositive ? '#3fb950' : '#f85149';
    const sign = isPositive ? '+' : '';
    
    const changes = [];
    if (Math.abs(newReturn - curAvgReturn) > 0.001) changes.push('תשואה ' + (newReturn > curAvgReturn ? '↑' : '↓') + ' ' + Math.abs(newReturn - curAvgReturn).toFixed(2) + '%');
    if (Math.abs(newFeeAnnual - curAvgFeeAnnual) > 0.001) changes.push('דמ"נ צבירה ' + (newFeeAnnual > curAvgFeeAnnual ? '↑' : '↓') + ' ' + Math.abs(newFeeAnnual - curAvgFeeAnnual).toFixed(2) + '%');
    if (Math.abs(newFeeDeposit - curAvgFeeDeposit) > 0.001) changes.push('דמ"נ הפקדה ' + (newFeeDeposit > curAvgFeeDeposit ? '↑' : '↓') + ' ' + Math.abs(newFeeDeposit - curAvgFeeDeposit).toFixed(2) + '%');
    
    document.getElementById('impactResults').innerHTML = `
        <div style="margin-top: 20px; padding: 20px; background: ${isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 2px solid ${color}; border-radius: 12px;">
            ${changes.length > 0 ? '<div style="font-size: 0.9em; color: #8b949e; margin-bottom: 16px;">' + changes.join(' • ') + '</div>' : ''}
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <div style="text-align: center; padding: 14px; background: rgba(255,255,255,0.06); border-radius: 8px;">
                    <div style="font-size: 0.8em; color: #8b949e; margin-bottom: 6px;">מצב נוכחי (ריאלי)</div>
                    <div style="font-size: 1.3em; font-weight: bold;">${formatCurrency(currentReal)}</div>
                    <div style="font-size: 0.7em; color: #8b949e; margin-top: 4px;">נומינלי: ${formatCurrency(currentFV)}</div>
                </div>
                <div style="text-align: center; padding: 14px; background: rgba(255,255,255,0.06); border-radius: 8px;">
                    <div style="font-size: 0.8em; color: #8b949e; margin-bottom: 6px;">מצב חדש (ריאלי)</div>
                    <div style="font-size: 1.3em; font-weight: bold; color: ${color};">${formatCurrency(newReal)}</div>
                    <div style="font-size: 0.7em; color: #8b949e; margin-top: 4px;">נומינלי: ${formatCurrency(newFV)}</div>
                </div>
                <div style="text-align: center; padding: 14px; background: ${isPositive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; border-radius: 8px; border: 2px solid ${color};">
                    <div style="font-size: 0.8em; color: #8b949e; margin-bottom: 6px;">השפעה על ההון</div>
                    <div style="font-size: 1.5em; font-weight: bold; color: ${color};">${sign}${formatCurrency(Math.abs(diffReal))}</div>
                    <div style="font-size: 1em; color: ${color};">${sign}${diffPercent}%</div>
                </div>
            </div>
            <div style="padding: 14px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border-right: 4px solid #f59e0b;">
                <div style="font-weight: bold; color: #f59e0b; margin-bottom: 6px;">💡 פירוש:</div>
                <div style="font-size: 0.95em;">
                    ${isPositive 
                        ? 'השינוי יגדיל את כוח הקנייה שלך בעוד ' + years + ' שנים ב-<strong style="color: #3fb950;">' + formatCurrency(Math.abs(diffReal)) + '</strong> (בערכי היום).'
                        : 'השינוי יקטין את כוח הקנייה שלך בעוד ' + years + ' שנים ב-<strong style="color: #f85149;">' + formatCurrency(Math.abs(diffReal)) + '</strong> (בערכי היום).'
                    }
                </div>
            </div>
        </div>
    `;
}

function resetImpactForm() {
    document.getElementById('impactReturn').value = '';
    document.getElementById('impactFeeAnnual').value = '';
    document.getElementById('impactFeeDeposit').value = '';
    document.getElementById('impactResults').innerHTML = '';
}

// ============================================================
// Enhanced generateReport with integrated withdrawals
// ============================================================

function generateReport() {
    const plan = getCurrentPlan();
    if (!plan || !plan.investments) { alert('שגיאה: לא נמצאה תוכנית או השקעות'); return; }
    if (plan.investments.length === 0) { alert('⚠️ אין מסלולי השקעה להציג בדוח.\nאנא הוסף השקעות תחילה.'); return; }
    
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
        const principal = calculatePrincipal(inv.amount, inv.monthly, years);
        return { name: inv.name, house: inv.house, today: inv.amount, monthly: inv.monthly, future: nominal, profit: nominal - principal };
    });
    
    const activeWithdrawals = (plan.withdrawals || []).filter(w => w.active !== false).sort((a, b) => a.year - b.year);
    const hasW = activeWithdrawals.length > 0;
    
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
    
    let ptH = '<th>שנה</th>', ptR = '';
    equityInvs.forEach(inv => { ptH += '<th>' + inv.name + '</th>'; });
    ptH += '<th style="background:#1e40af;">סה"כ</th>';
    for (let y = 0; y <= years; y += interval) {
        let rt = 0; ptR += '<tr><td style="font-weight:600;">' + (currentYear + y) + '</td>';
        equityInvs.forEach(inv => { const v = calculateFV(inv.amount, inv.monthly, inv.returnRate, y, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks); rt += v; ptR += '<td>' + formatCurrency(v) + '</td>'; });
        ptR += '<td style="font-weight:700;color:#10b981;">' + formatCurrency(rt) + '</td></tr>';
    }
    
    const il = interval === 1 ? 'שנה' : interval === 2 ? 'שנתיים' : interval + ' שנים';
    let h = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>דוח פיננסי</title><style>body{font-family:Arial;padding:40px;background:#f9fafb}.container{max-width:1200px;margin:0 auto;background:white;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}h1{color:#1f2937;font-size:2.5em;border-bottom:4px solid #3b82f6;padding-bottom:16px;margin-bottom:24px}h2{color:#3b82f6;font-size:1.8em;margin:32px 0 16px;padding-right:12px;border-right:4px solid #3b82f6}.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0}.sc{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:12px}.st{font-size:0.9em;opacity:0.9;margin-bottom:8px}.sv{font-size:1.8em;font-weight:bold}table{width:100%;border-collapse:collapse;margin:20px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1)}th{background:#3b82f6;color:white;padding:14px;text-align:right;font-weight:600}td{padding:12px 14px;border-bottom:1px solid #e5e7eb}tr:hover{background:#f3f4f6}.p{color:#10b981;font-weight:bold}.ts{overflow-x:auto;margin:20px 0}.pb{position:fixed;bottom:30px;left:30px;background:#3b82f6;color:white;border:none;padding:16px 24px;border-radius:12px;font-size:1.1em;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.4);z-index:1000}@media print{.pb{display:none}}</style></head><body><div class="container">';
    
    h += '<h1>📊 דוח פיננסי מסכם</h1><p style="color:#6b7280;margin-bottom:32px">תוכנית: ' + plan.name + ' | ' + new Date().toLocaleDateString('he-IL') + '</p>';
    h += '<h2>💰 מצב נוכחי</h2><div class="sg"><div class="sc"><div class="st">הון עצמי היום</div><div class="sv">' + formatCurrency(totalToday) + '</div></div><div class="sc"><div class="st">תחזית בעוד ' + years + ' שנים (נומינלי)</div><div class="sv">' + formatCurrency(projection.finalNominal) + '</div></div><div class="sc"><div class="st">תחזית (ריאלי)</div><div class="sv">' + formatCurrency(totalReal) + '</div></div></div>';
    h += '<h2>📈 ממוצעים משוקללים</h2><div class="sg"><div class="sc"><div class="st">תשואה שנתית</div><div class="sv">' + avgReturn.toFixed(2) + '%</div></div><div class="sc"><div class="st">דמ"נ צבירה</div><div class="sv">' + avgFeeAnnual.toFixed(2) + '%</div></div><div class="sc"><div class="st">דמ"נ הפקדה</div><div class="sv">' + avgFeeDeposit.toFixed(2) + '%</div></div></div>';
    
    h += '<h2>📋 פירוט מסלולי השקעה</h2><table><thead><tr><th>שם</th><th>בית השקעות</th><th>סכום היום</th><th>הפקדה חודשית</th><th>תחזית (' + years + ' שנים)</th><th>רווח צפוי</th></tr></thead><tbody>';
    breakdown.forEach(i => { h += '<tr><td><strong>' + i.name + '</strong></td><td>' + i.house + '</td><td>' + formatCurrency(i.today) + '</td><td>' + formatCurrency(i.monthly) + '/חודש</td><td>' + formatCurrency(i.future) + '</td><td class="p">' + formatCurrency(i.profit) + '</td></tr>'; });
    const tm = equityInvs.reduce((s, i) => s + (i.monthly || 0), 0);
    h += '<tr style="background:#f3f4f6;font-weight:bold"><td colspan="2">סה"כ</td><td>' + formatCurrency(totalToday) + '</td><td>' + formatCurrency(tm) + '/חודש</td><td>' + formatCurrency(projection.finalNominal) + '</td><td class="p">' + formatCurrency(projection.finalNominal - projection.finalPrincipal) + '</td></tr></tbody></table>';
    
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
}

console.log('✅ patch.js v4 loaded');
