
// ============================================================
// GLIDE PATH - Investment Strategy Advisor
// Adjusts allocation based on time to withdrawal
// ============================================================

const GLIDE_PATH_PHASES = [
    {
        id: 'aggressive',
        name: 'אגרסיבי',
        minYears: 5,
        stocks: 100,
        bonds: 0,
        conservative: 0,
        expectedReturn: 7.0,
        color: '#ef4444',
        emoji: '🔴',
        description: '100% מנייתי — אופק ארוך מאפשר סיכון גבוה לתשואה מקסימלית'
    },
    {
        id: 'moderate_high',
        name: 'בינוני-גבוה',
        minYears: 2,
        stocks: 70,
        bonds: 30,
        conservative: 0,
        expectedReturn: 6.1,
        color: '#f59e0b',
        emoji: '🟡',
        description: '70% מניות + 30% אג״ח — מתחילים להוריד סיכון'
    },
    {
        id: 'moderate_low',
        name: 'בינוני-נמוך',
        minYears: 1,
        stocks: 50,
        bonds: 50,
        conservative: 0,
        expectedReturn: 5.5,
        color: '#3b82f6',
        emoji: '🔵',
        description: '50% מניות + 50% אג״ח — חצי שנתיים לפני המועד'
    },
    {
        id: 'conservative',
        name: 'סולידי',
        minYears: 0,
        stocks: 0,
        bonds: 0,
        conservative: 100,
        expectedReturn: 3.0,
        color: '#10b981',
        emoji: '🟢',
        description: '100% פקדון/קרן כספית — שמירה על הקרן לפני משיכה'
    }
];

function getGlidePathPhase(yearsUntilWithdrawal) {
    if (yearsUntilWithdrawal >= 5) return GLIDE_PATH_PHASES[0]; // aggressive
    if (yearsUntilWithdrawal >= 2) return GLIDE_PATH_PHASES[1]; // moderate high
    if (yearsUntilWithdrawal >= 1) return GLIDE_PATH_PHASES[2]; // moderate low
    return GLIDE_PATH_PHASES[3]; // conservative
}

function getGlidePathReturn(yearsFromNow, yearsUntilWithdrawal) {
    // For a given point in time, what return should we expect?
    const remaining = yearsUntilWithdrawal - yearsFromNow;
    return getGlidePathPhase(remaining).expectedReturn;
}

// Calculate FV using glide path (year-by-year with changing returns)
function calculateFVWithGlidePath(amount, monthly, yearsUntilWithdrawal, feeDeposit, feeAnnual) {
    let balance = amount;
    const m = monthly * (1 - (feeDeposit || 0) / 100);
    
    for (let y = 0; y < yearsUntilWithdrawal; y++) {
        const remaining = yearsUntilWithdrawal - y;
        const phase = getGlidePathPhase(remaining);
        const yearlyRate = (phase.expectedReturn - (feeAnnual || 0)) / 100;
        
        // Monthly compounding for this year
        const monthlyRate = yearlyRate / 12;
        for (let month = 0; month < 12; month++) {
            balance = balance * (1 + monthlyRate) + m;
        }
    }
    
    return balance;
}

// ============================================================
// Render Glide Path Advisor in Roadmap
// ============================================================

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
    const activeWithdrawals = (plan.withdrawals || [])
        .filter(w => w.active !== false)
        .sort((a, b) => a.year - b.year);
    
    if (activeWithdrawals.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    // Calculate total equity and average fees
    const equityInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalEquity = equityInvs.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalMonthly = equityInvs.reduce((sum, inv) => sum + (inv.monthly || 0), 0);
    const avgFeeAnnual = totalEquity > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeAnnual || 0)), 0) / totalEquity : 0;
    const avgFeeDeposit = totalEquity > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeDeposit || 0)), 0) / totalEquity : 0;
    const avgReturn = totalEquity > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.returnRate || 0)), 0) / totalEquity : 0;
    
    let html = '';
    html += '<div class="card" style="border: 2px solid #8b5cf6; margin-top: 20px;">';
    html += '<div class="card-title" style="margin-bottom: 4px;"><span>🎯</span> <span>יועץ הקצאה - Glide Path</span></div>';
    html += '<p style="color: #8b949e; font-size: 0.85em; margin-bottom: 20px;">התאמת רמת הסיכון אוטומטית ככל שמתקרבים למועד המשיכה. הכסף שמיועד לכל משיכה צריך לעבור בין מסלולים לפי לוח הזמנים.</p>';
    
    // Phase legend
    html += '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px;">';
    GLIDE_PATH_PHASES.forEach(phase => {
        html += '<div style="display: flex; align-items: center; gap: 4px; font-size: 0.8em;">';
        html += '<span>' + phase.emoji + '</span>';
        html += '<span style="color: ' + phase.color + '; font-weight: 600;">' + phase.name + '</span>';
        html += '<span style="color: #8b949e;">(' + phase.expectedReturn + '%)</span>';
        html += '</div>';
    });
    html += '</div>';
    
    // Per-withdrawal advisor cards
    activeWithdrawals.forEach((w, idx) => {
        const yearsUntil = w.year - currentYear;
        if (yearsUntil < 0) return;
        
        const currentPhase = getGlidePathPhase(yearsUntil);
        
        // Calculate proportional amount for this withdrawal
        const totalWithdrawals = activeWithdrawals.reduce((s, wd) => s + wd.amount, 0);
        
        // Calculate with flat return vs glide path
        const flatFV = calculateFV(w.amount, 0, avgReturn, yearsUntil, avgFeeDeposit, avgFeeAnnual, null);
        const glideFV = calculateFVWithGlidePath(w.amount, 0, yearsUntil, avgFeeDeposit, avgFeeAnnual);
        const diff = flatFV - glideFV;
        
        html += '<div style="margin-bottom: 16px; padding: 16px; border-radius: 12px; border: 2px solid ' + currentPhase.color + '; background: rgba(255,255,255,0.03);">';
        
        // Header: goal name + year
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">';
        html += '<div>';
        html += '<div style="font-weight: bold; font-size: 1.1em; color: #f0f6fc;">' + (w.goalId ? '🎯 ' : '') + w.goal + '</div>';
        html += '<div style="font-size: 0.85em; color: #8b949e;">' + w.year + ' (בעוד ' + yearsUntil + ' שנים) • ' + formatCurrency(w.amount) + '</div>';
        html += '</div>';
        html += '<div style="font-size: 2em;">' + currentPhase.emoji + '</div>';
        html += '</div>';
        
        // Current recommendation
        html += '<div style="padding: 12px; background: rgba(' + (currentPhase.id === 'aggressive' ? '239,68,68' : currentPhase.id === 'moderate_high' ? '245,158,11' : currentPhase.id === 'moderate_low' ? '59,130,246' : '16,185,129') + ',0.12); border-radius: 8px; margin-bottom: 12px;">';
        html += '<div style="font-weight: bold; color: ' + currentPhase.color + '; margin-bottom: 6px;">הקצאה מומלצת עכשיו: ' + currentPhase.name + '</div>';
        html += '<div style="font-size: 0.9em; color: #c9d1d9;">' + currentPhase.description + '</div>';
        
        // Allocation bar
        if (currentPhase.stocks > 0 || currentPhase.bonds > 0) {
            html += '<div style="display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin-top: 10px;">';
            if (currentPhase.stocks > 0) {
                html += '<div style="width: ' + currentPhase.stocks + '%; background: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 0.75em; font-weight: bold; color: white;">' + currentPhase.stocks + '% מניות</div>';
            }
            if (currentPhase.bonds > 0) {
                html += '<div style="width: ' + currentPhase.bonds + '%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 0.75em; font-weight: bold; color: white;">' + currentPhase.bonds + '% אג״ח</div>';
            }
            if (currentPhase.conservative > 0) {
                html += '<div style="width: ' + currentPhase.conservative + '%; background: #10b981; display: flex; align-items: center; justify-content: center; font-size: 0.75em; font-weight: bold; color: white;">100% סולידי</div>';
            }
            html += '</div>';
        } else {
            html += '<div style="height: 28px; border-radius: 6px; overflow: hidden; margin-top: 10px; background: #10b981; display: flex; align-items: center; justify-content: center; font-size: 0.75em; font-weight: bold; color: white;">100% סולידי (פקדון / קרן כספית)</div>';
        }
        
        html += '</div>';
        
        // Timeline: when to shift
        if (yearsUntil > 1) {
            html += '<div style="font-size: 0.85em; color: #8b949e; margin-bottom: 8px;">📅 לוח זמנים למעבר בין מסלולים:</div>';
            html += '<div style="display: flex; flex-direction: column; gap: 6px;">';
            
            const shifts = [];
            if (yearsUntil >= 5) {
                const shiftYear1 = w.year - 5;
                if (shiftYear1 > currentYear) {
                    shifts.push({ year: currentYear, toYear: shiftYear1, phase: GLIDE_PATH_PHASES[0] });
                }
                shifts.push({ year: Math.max(w.year - 5, currentYear), toYear: w.year - 2, phase: GLIDE_PATH_PHASES[1] });
                shifts.push({ year: w.year - 2, toYear: w.year - 1, phase: GLIDE_PATH_PHASES[2] });
                shifts.push({ year: w.year - 1, toYear: w.year, phase: GLIDE_PATH_PHASES[3] });
            } else if (yearsUntil >= 2) {
                shifts.push({ year: currentYear, toYear: w.year - 2, phase: GLIDE_PATH_PHASES[1] });
                shifts.push({ year: w.year - 2, toYear: w.year - 1, phase: GLIDE_PATH_PHASES[2] });
                shifts.push({ year: w.year - 1, toYear: w.year, phase: GLIDE_PATH_PHASES[3] });
            } else if (yearsUntil >= 1) {
                shifts.push({ year: currentYear, toYear: w.year - 1, phase: GLIDE_PATH_PHASES[2] });
                shifts.push({ year: w.year - 1, toYear: w.year, phase: GLIDE_PATH_PHASES[3] });
            }
            
            shifts.forEach((shift, si) => {
                const isCurrent = shift.year <= currentYear && shift.toYear > currentYear;
                html += '<div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; ' + (isCurrent ? 'background: rgba(139, 92, 246, 0.15); border: 1px solid #8b5cf6;' : '') + '">';
                html += '<span>' + shift.phase.emoji + '</span>';
                html += '<span style="font-weight: ' + (isCurrent ? 'bold' : 'normal') + '; color: ' + shift.phase.color + ';">' + shift.phase.name + '</span>';
                html += '<span style="color: #8b949e; font-size: 0.85em;">' + shift.year + ' → ' + shift.toYear + '</span>';
                html += '<span style="color: #8b949e; font-size: 0.8em;">(' + shift.phase.expectedReturn + '%)</span>';
                if (isCurrent) html += '<span style="font-size: 0.75em; color: #8b5cf6; font-weight: bold;">◀ עכשיו</span>';
                html += '</div>';
            });
            
            html += '</div>';
        }
        
        // Impact comparison
        if (yearsUntil >= 2 && diff > 0) {
            html += '<div style="margin-top: 12px; padding: 10px; background: rgba(245, 158, 11, 0.08); border-radius: 8px; border-right: 3px solid #f59e0b; font-size: 0.85em;">';
            html += '<span style="color: #f59e0b; font-weight: bold;">💡 השפעה על התשואה: </span>';
            html += '<span style="color: #c9d1d9;">אסטרטגיית Glide Path תניב פחות ב-' + formatCurrency(Math.round(diff)) + ' לעומת השקעה מנייתית רציפה, אבל מגנה על הכסף לקראת מועד המשיכה.</span>';
            html += '</div>';
        }
        
        html += '</div>';
    });
    
    // Overall portfolio impact section
    if (activeWithdrawals.length > 0 && totalEquity > 0) {
        // Calculate total portfolio with and without glide path
        const maxYears = Math.max(...activeWithdrawals.map(w => w.year - currentYear));
        if (maxYears > 0) {
            const flatTotal = calculateFV(totalEquity, totalMonthly, avgReturn, maxYears, avgFeeDeposit, avgFeeAnnual, null);
            const flatReal = calculateRealValue(flatTotal, maxYears);
            
            // Glide path: weighted average based on withdrawal proportions
            let gpTotal = 0;
            const totalWAmount = activeWithdrawals.reduce((s, w) => s + w.amount, 0);
            const remainingEquity = Math.max(0, totalEquity - totalWAmount);
            
            // Money earmarked for withdrawals follows glide path
            activeWithdrawals.forEach(w => {
                const yrs = w.year - currentYear;
                if (yrs > 0) {
                    const portion = Math.min(w.amount, totalEquity * (w.amount / totalWAmount));
                    gpTotal += calculateFVWithGlidePath(portion, 0, yrs, avgFeeDeposit, avgFeeAnnual);
                }
            });
            
            // Remaining money stays at current allocation
            if (remainingEquity > 0) {
                gpTotal += calculateFV(remainingEquity, totalMonthly, avgReturn, maxYears, avgFeeDeposit, avgFeeAnnual, null);
            }
            
            const gpReal = calculateRealValue(gpTotal, maxYears);
            const totalDiff = flatReal - gpReal;
            
            html += '<div style="margin-top: 16px; padding: 16px; background: rgba(139, 92, 246, 0.08); border: 2px solid #8b5cf6; border-radius: 12px;">';
            html += '<div style="font-weight: bold; margin-bottom: 12px; color: #a78bfa;">📊 השפעה כוללת על ההון (ריאלי, בעוד ' + maxYears + ' שנים)</div>';
            html += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">';
            
            html += '<div style="text-align: center; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px;">';
            html += '<div style="font-size: 0.8em; color: #8b949e;">ללא Glide Path</div>';
            html += '<div style="font-size: 1.2em; font-weight: bold; color: #f0f6fc;">' + formatCurrency(flatReal) + '</div>';
            html += '<div style="font-size: 0.75em; color: #8b949e;">תשואה קבועה ' + avgReturn.toFixed(1) + '%</div>';
            html += '</div>';
            
            html += '<div style="text-align: center; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px;">';
            html += '<div style="font-size: 0.8em; color: #8b949e;">עם Glide Path</div>';
            html += '<div style="font-size: 1.2em; font-weight: bold; color: #a78bfa;">' + formatCurrency(gpReal) + '</div>';
            html += '<div style="font-size: 0.75em; color: #8b949e;">תשואה משתנה לפי שלב</div>';
            html += '</div>';
            
            html += '<div style="text-align: center; padding: 12px; background: rgba(245, 158, 11, 0.1); border-radius: 8px;">';
            html += '<div style="font-size: 0.8em; color: #8b949e;">עלות ההגנה</div>';
            html += '<div style="font-size: 1.2em; font-weight: bold; color: #f59e0b;">' + formatCurrency(Math.round(totalDiff)) + '</div>';
            html += '<div style="font-size: 0.75em; color: #8b949e;">מחיר הוודאות</div>';
            html += '</div>';
            
            html += '</div>';
            html += '<div style="margin-top: 10px; font-size: 0.8em; color: #8b949e; text-align: center;">* "עלות ההגנה" = ההפרש בתשואה פוטנציאלית מול הביטחון שהכסף יהיה שם כשצריך אותו</div>';
            html += '</div>';
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

console.log('✅ Glide Path advisor loaded');
