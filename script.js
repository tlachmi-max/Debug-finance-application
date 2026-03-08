// ==========================================
// Financial Planner Pro v3.6 - Impact Simulator
// Last Updated: 2026-03-05
// Version: 3.6.0 - Impact simulator + yearly intervals
// ==========================================

console.log('🚀 VERSION 60.0 - IMPACT SIMULATOR');

console.log('🚀 Financial Planner Pro v3.6.0 Loading...');

// ==========================================
// AGGRESSIVE CACHE CLEAR FOR v3.6.0
// ==========================================
const APP_VERSION = '3.6.0';
const STORED_VERSION = localStorage.getItem('app_version');

if (STORED_VERSION !== APP_VERSION) {
    console.log('🔥 Version mismatch! Upgrading to v3.6.0 - Clearing all caches...');
    
    // Clear all caches
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => {
                console.log('Deleting cache:', name);
                caches.delete(name);
            });
        });
    }
    
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
                console.log('Unregistering SW:', registration);
                registration.unregister();
            });
        });
    }
    
    // Update version
    localStorage.setItem('app_version', APP_VERSION);
    
    // Force reload after 1 second
    setTimeout(() => {
        console.log('🔄 Reloading for fresh start...');
        window.location.reload(true);
    }, 1000);
}

console.log('✅ App version:', APP_VERSION);
console.log('✅ Impact simulator added');
console.log('✅ Yearly intervals for projections');
console.log('✅ All bugs fixed');

// Constants
const INFLATION_RATE = 2;
const PENSION_COEFFICIENT = { male: 0.005, female: 0.006 };
const TAX_RATES = {
    'פנסיה': 0,
    'קרן השתלמות': 0,
    'פקדון': 15,
    'גמל להשקעה': 25,
    'תיק עצמאי': 25,
    'פוליסת חסכון': 25,
    'אחר': 0
};
const SUB_TRACK_DEFAULTS = {
    'מדדי מניות חו״ל': 7, 'מדדי מניות בארץ': 7,
    'מניות סחיר חו״ל': 7, 'מניות סחיר בארץ': 7,
    'אג״ח': 4, 'S&P 500': 7, 'נדל״ן': 6,
    'עו״ש': 0, 'קרן כספית': 3, 'כללי': 5, 'אחר': 5
};

// ==========================================
// RISK CLASSIFICATION & HELPERS
// ==========================================

function classifyRisk(subTrack) {
    // If it's an object with manualRisk, use that
    if (typeof subTrack === 'object' && subTrack.manualRisk) {
        return subTrack.manualRisk;
    }
    
    // Otherwise get the type string
    const subTrackType = typeof subTrack === 'object' ? subTrack.type : subTrack;
    
    // New classification according to requirements:
    // גבוה: מדדי מניות חו״ל, מדדי מניות בארץ, מניות סחיר חו״ל, מניות סחיר בארץ, S&P500
    const highRisk = ['S&P 500', 'מדדי מניות חו"ל', 'מדדי מניות בארץ', 'מניות סחיר חו"ל', 'מניות סחיר בארץ'];
    
    // בינוני: כללי, אג״ח קונצרני
    const mediumRisk = ['כללי', 'אג"ח קונצרני'];
    
    // נמוך: נדל״ן, אג״ח ממשלתי, קרן כספית, עו״ש
    const lowRisk = ['נדל"ן', 'אג"ח ממשלתי', 'קרן כספית', 'עו"ש', 'פיקדון'];
    
    // Check each category
    if (highRisk.some(type => subTrackType.includes(type))) return 'high';
    if (mediumRisk.some(type => subTrackType.includes(type))) return 'medium';
    if (lowRisk.some(type => subTrackType.includes(type))) return 'low';
    
    // For "אחר" - use manual risk (required)
    // If no manual risk set, it won't show up (handled by manualRisk check above)
    return 'undefined';
}

function getRiskColor(risk) {
    const colors = {
        'low': '#10b981',      // Green
        'medium': '#f59e0b',   // Yellow
        'high': '#ef4444',     // Red
        'undefined': '#9ca3af' // Gray
    };
    return colors[risk] || colors.undefined;
}

function generateUniqueColors(count) {
    const hues = [];
    for (let i = 0; i < count; i++) {
        hues.push((i * 360 / count) % 360);
    }
    return hues.map(h => `hsl(${h}, 70%, 55%)`);
}

// ==========================================
// SNAPSHOT FEATURE
// ==========================================

function saveSnapshot() {
    const plan = getCurrentPlan();
    
    // Calculate CURRENT total (today), not future projection
    let totalToday = 0;
    plan.investments.forEach(inv => {
        if (!inv.include) return;
        totalToday += inv.amount || 0;
    });
    
    localStorage.setItem('initial_reference', totalToday.toString());
    alert(`✅ נקודת ייחוס נשמרה: ₪${totalToday.toLocaleString()}\n(סכום נוכחי - היום)`);
}

function getSnapshot() {
    const ref = localStorage.getItem('initial_reference');
    return ref ? parseFloat(ref) : null;
}

// ==========================================
// CHART DOWNLOAD
// ==========================================

function downloadChart(canvasId, chartName) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        alert('❌ גרף לא נמצא');
        return;
    }
    
    try {
        // Convert canvas to image
        const link = document.createElement('a');
        link.download = `גרף-${chartName}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Optional: Show success message
        console.log(`✅ גרף ${chartName} הורד בהצלחה`);
    } catch (error) {
        console.error('Chart download error:', error);
        alert('❌ שגיאה בהורדת הגרף');
    }
}

// Global State
let appData = { 
    plans: [], 
    currentPlanId: null, 
    editingInvestmentIndex: -1,
    profile: {
        maritalStatus: 'married',
        user: { name: '', age: null, gender: 'male' },
        spouse: { name: '', age: null, gender: 'female' },
        children: []
    },
    goals: {
        retirement: {
            userAge: null,
            spouseAge: null,
            monthlyPension: null,
            isRealValue: true
        },
        equity: {
            targetAmount: null,
            targetYear: null,
            isRealValue: true
        },
        lifeGoals: []
    }
};
let currentSubTracks = [];
let currentDreamSources = [];
let charts = {};

// ==========================================
// INITIALIZATION
// ==========================================

function init() {
    console.log('🚀 Financial Planner Pro v3.0 Initializing...');
    loadData();
    if (appData.plans.length === 0) createDefaultPlan();
    setupEventListeners();
    updatePlanSelector();
    updateTaxRate(); // Show pension fields if pension is default
    render();
    console.log('✅ Ready!');
}
function createDefaultPlan() {
    const plan = {
        id: Date.now().toString(),
        name: 'תוכנית ראשית',
        investments: [],
        withdrawals: [],
        profile: {
            maritalStatus: 'married',
            user: { name: '', age: null, gender: 'male' },
            spouse: { name: '', age: null, gender: 'female' },
            children: []
        },
        goals: {
            retirement: {
                userAge: null,
                spouseAge: null,
                monthlyPension: null,
                isRealValue: true
            },
            equity: {
                targetAmount: null,
                targetYear: null,
                isRealValue: true
            },
            lifeGoals: []
        },
        createdAt: new Date().toISOString()
    };
    appData.plans.push(plan);
    appData.currentPlanId = plan.id;
    saveData();

}


function getCurrentPlan() {
    const plan = appData.plans.find(p => p.id === appData.currentPlanId) || appData.plans[0];
    // וידוא שהמבנה החדש קיים גם בתוכניות ישנות
    if (!plan.profile) plan.profile = createDefaultPlan().profile;
    if (!plan.goals) plan.goals = createDefaultPlan().goals;
    if (!plan.withdrawals) plan.withdrawals = plan.dreams || [];
    return plan;
}

// ==========================================
// STORAGE
// ==========================================

function saveData() {
    try {
        localStorage.setItem('financialPlannerProV3', JSON.stringify(appData));
    } catch (e) {
        console.error('Save error:', e);
        alert('שגיאה בשמירת הנתונים');
    }
}

function loadData() {
    try {
        const saved = localStorage.getItem('financialPlannerProV3');
        if (saved) {
            const loadedData = JSON.parse(saved);
            
            // Preserve profile if it doesn't exist in loaded data
            if (!loadedData.profile && getCurrentPlan().profile) {
                loadedData.profile = getCurrentPlan().profile;
            }
            
            // Ensure profile structure exists
            if (!loadedData.profile) {
                loadedData.profile = {
                    maritalStatus: 'married',
                    user: { name: '', age: null, gender: 'male' },
                    spouse: { name: '', age: null, gender: 'female' },
                    children: []
                };
            }
            
            // Ensure children array exists
            if (!loadedData.profile.children) {
                loadedData.profile.children = [];
            }
            
            // Preserve goals if it doesn't exist in loaded data
            if (!loadedData.goals && getCurrentPlan().goals) {
                loadedData.goals = getCurrentPlan().goals;
            }
            
            // Ensure goals structure exists
            if (!loadedData.goals) {
                loadedData.goals = {
                    retirement: {
                        userAge: null,
                        spouseAge: null,
                        monthlyPension: null,
                        isRealValue: true
                    },
                    equity: {
                        targetAmount: null,
                        targetYear: null,
                        isRealValue: true
                    },
                    lifeGoals: []
                };
            }
            
            // Ensure goals sub-structures exist
            if (!loadedData.goals.retirement) {
                loadedData.goals.retirement = {
                    userAge: null,
                    spouseAge: null,
                    monthlyPension: null,
                    isRealValue: true
                };
            }
            if (!loadedData.goals.equity) {
                loadedData.goals.equity = {
                    targetAmount: null,
                    targetYear: null,
                    isRealValue: true
                };
            }
            if (!loadedData.goals.lifeGoals) {
                loadedData.goals.lifeGoals = [];
            }
            
            appData = loadedData;
        }
    } catch (e) {
        console.error('Load error:', e);
    }
}

// ==========================================
// CALCULATIONS
// ==========================================

function calculateFV(principal, monthly, rate, years, feeDeposit, feeAnnual, subTracks) {
    if (subTracks && subTracks.length > 0) {
        return calculateFVWithSubTracks(principal, monthly, years, feeDeposit, feeAnnual, subTracks);
    }
    
    const r = (rate - feeAnnual) / 100 / 12;
    const m = monthly * (1 - feeDeposit / 100);
    const n = years * 12;
    
    if (r <= 0) return principal + (m * n);
    
    const fvPrincipal = principal * Math.pow(1 + r, n);
    const fvPayments = m * ((Math.pow(1 + r, n) - 1) / r);
    
    return fvPrincipal + fvPayments;
}

function calculateFVWithSubTracks(principal, monthly, years, feeDeposit, feeAnnual, subTracks) {
    let total = 0;
    subTracks.forEach(st => {
        const stPrincipal = principal * (st.percent / 100);
        const stMonthly = monthly * (st.percent / 100);
        const r = (st.returnRate - feeAnnual) / 100 / 12;
        const m = stMonthly * (1 - feeDeposit / 100);
        const n = years * 12;
        
        if (r <= 0) {
            total += stPrincipal + (m * n);
        } else {
            total += stPrincipal * Math.pow(1 + r, n) + m * ((Math.pow(1 + r, n) - 1) / r);
        }
    });
    return total;
}

function calculateRealValue(nominal, years) {
    return nominal / Math.pow(1 + INFLATION_RATE / 100, years);
}

function calculateTax(principal, futureValue, taxRate, years = 30) {
    const INFLATION_RATE = 0.02; // 2% annual inflation
    
    const nominalProfit = futureValue - principal;
    if (nominalProfit <= 0) return 0;
    
    // Adjust profit for inflation to get REAL profit
    const inflationFactor = Math.pow(1 + INFLATION_RATE, years);
    const realProfit = nominalProfit / inflationFactor;
    
    // Tax on REAL profit only
    return realProfit * taxRate / 100;
}

// Calculate pension tax based on age and gender
function calculatePensionTax(principal, futureValue, gender, currentAge, years) {
    const profit = futureValue - principal;
    if (profit <= 0) return 0;
    
    // Determine retirement age
    const retirementAge = gender === 'female' ? 62 : 67;
    const ageAtWithdrawal = currentAge + years;
    
    // Before retirement age - full tax on profit (25%)
    if (ageAtWithdrawal < retirementAge) {
        return profit * 0.25;
    }
    
    // After retirement age - monthly pension taxation (like salary)
    const monthlyPension = futureValue * (gender === 'female' ? 0.006 : 0.005);
    const annualPension = monthlyPension * 12;
    
    // 2025+ Tax calculation with "Ptor Mazke" (67% exemption)
    const PTOR_MAZKE_RATE = 0.67; // 67% exemption rate from 2025
    const PTOR_MAZKE_CEILING = 9430 * 12; // Monthly ceiling × 12 months = ₪113,160/year
    
    // Calculate exemption amount (67% of pension, up to ceiling)
    const exemptionBase = Math.min(annualPension, PTOR_MAZKE_CEILING);
    const exemptionAmount = exemptionBase * PTOR_MAZKE_RATE; // Max ~₪75,817/year exempt
    
    // Taxable income after exemption
    let taxableIncome = Math.max(0, annualPension - exemptionAmount);
    
    // Credit points (minimum 2.25 for everyone)
    const CREDIT_POINTS = 2.25;
    const CREDIT_VALUE_PER_POINT = 2736; // 2024 value per credit point (monthly)
    const annualCreditValue = CREDIT_POINTS * CREDIT_VALUE_PER_POINT * 12; // ₪73,872/year
    
    // Apply credit points (reduces taxable income)
    taxableIncome = Math.max(0, taxableIncome - annualCreditValue);
    
    if (taxableIncome <= 0) {
        return 0; // No tax after exemptions and credits
    }
    
    // Israeli tax brackets (2024/2025)
    const TAX_BRACKETS = [
        { max: 84120, rate: 0.10 },    // Up to ₪7,010/month → 10%
        { max: 120720, rate: 0.14 },   // ₪7,011-10,060/month → 14%
        { max: 174360, rate: 0.20 },   // ₪10,061-14,530/month → 20%
        { max: 242400, rate: 0.31 },   // ₪14,531-20,200/month → 31%
        { max: 504360, rate: 0.35 },   // ₪20,201-42,030/month → 35%
        { max: 663240, rate: 0.47 },   // ₪42,031-55,270/month → 47%
        { max: Infinity, rate: 0.50 }  // Above ₪55,270/month → 50%
    ];
    
    // Calculate tax by brackets
    let annualTax = 0;
    let remainingIncome = taxableIncome;
    let previousMax = 0;
    
    for (const bracket of TAX_BRACKETS) {
        const bracketSize = bracket.max - previousMax;
        const amountInBracket = Math.min(remainingIncome, bracketSize);
        
        if (amountInBracket <= 0) break;
        
        annualTax += amountInBracket * bracket.rate;
        remainingIncome -= amountInBracket;
        previousMax = bracket.max;
        
        if (remainingIncome <= 0) break;
    }
    
    // Total tax over 20 years (typical pension payout period)
    return annualTax * 20;
}

function calculatePrincipal(amount, monthly, years) {
    return amount + (monthly * 12 * years);
}

function calculateMonthlyPension(balance, gender) {
    return balance * (PENSION_COEFFICIENT[gender] || PENSION_COEFFICIENT.male);
}

// Clean number input - remove commas, extra dots, spaces
function sanitizeNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Convert to string and remove spaces
    let cleaned = String(value).trim();
    
    // Remove all commas
    cleaned = cleaned.replace(/,/g, '');
    
    // Handle multiple dots - keep only the last one as decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
        // Multiple dots - join all but last, then add last with dot
        cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
    
    // Parse as float
    const num = parseFloat(cleaned);
    
    return isNaN(num) ? 0 : num;
}

function formatCurrency(amount) {
    return '₪' + Math.round(amount).toLocaleString('he-IL');
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    // Gender selection for pension
    document.getElementById('invType').addEventListener('change', function() {
        document.getElementById('genderSection').style.display = this.value === 'פנסיה' ? 'block' : 'none';
    });
    
    // Charts timeframe selector
    const timeframeSelect = document.getElementById('chartsTimeframe');
    if (timeframeSelect) {
        timeframeSelect.addEventListener('change', function() {
            renderCharts();
        });
    }
    
    // Show/hide sub-tracks based on whether we're editing an investment
    document.getElementById('invAmount').addEventListener('input', function() {
        const section = document.getElementById('subTracksSection');
        // ALWAYS show sub-tracks section when amount field has focus (even if empty)
        section.style.display = 'block';
        
        // Render current sub-tracks (will show empty list if currentSubTracks is [])
        renderSubTracks();
        
        // Initialize listeners
        initSubTrackListeners();
        console.log('✅ initSubTrackListeners called'); // DEBUG
        
        // Reset return rate when showing sub-tracks for first time
        if (currentSubTracks.length === 0) {
            const returnInput = document.getElementById('invReturn');
            returnInput.value = '';
            returnInput.placeholder = 'יחושב אוטומטית מתתי-מסלולים';
        }
    });
}

function initSubTrackListeners() {
    const typeSelect = document.getElementById('subTrackType');
    const returnInput = document.getElementById('subTrackReturn');
    const customNameField = document.getElementById('customNameField');
    const manualRiskField = document.getElementById('manualRiskField');
    
    if (!typeSelect || !returnInput) return;
    
    // Remove old listeners by cloning (prevents duplicates)
    const newTypeSelect = typeSelect.cloneNode(true);
    typeSelect.parentNode.replaceChild(newTypeSelect, typeSelect);
    
    // Auto-fill return rate from dropdown text + show/hide fields
    document.getElementById('subTrackType').addEventListener('change', function() {
        const selectedValue = this.value;
        const selectedText = this.options[this.selectedIndex].text;
        
        // Show/hide custom name field for "אחר"
        if (selectedValue === 'אחר') {
            customNameField.style.display = 'block';
            document.getElementById('subTrackReturn').value = '5';
        } else {
            customNameField.style.display = 'none';
            document.getElementById('subTrackCustomName').value = '';
            
            // Auto-fill return rate from dropdown
            const match = selectedText.match(/\((\d+)%\)/);
            if (match) {
                document.getElementById('subTrackReturn').value = match[1];
            }
        }
        
        // Show/hide manual risk field for נדל"ן and אחר
        if (selectedValue === 'נדל"ן' || selectedValue === 'אחר') {
            manualRiskField.style.display = 'block';
        } else {
            manualRiskField.style.display = 'none';
            document.getElementById('subTrackRiskLevel').value = ''; // Clear selection
        }
    });
    
    // Initialize first value
    const firstOption = document.getElementById('subTrackType').options[0];
    if (firstOption.value === 'אחר') {
        customNameField.style.display = 'block';
        document.getElementById('subTrackReturn').value = '5';
    } else {
        const firstMatch = firstOption.text.match(/\((\d+)%\)/);
        if (firstMatch) {
            document.getElementById('subTrackReturn').value = firstMatch[1];
        }
    }
}

function updateTaxRate() {
    const type = document.getElementById('invType').value;
    document.getElementById('invTax').value = TAX_RATES[type] || 0;
    document.getElementById('genderSection').style.display = type === 'פנסיה' ? 'block' : 'none';
}

// ==========================================
// UI NAVIGATION
// ==========================================

let lastTabSwitch = 0;

function switchPanel(panelId) {
    console.log('--- Switching to:', panelId);
    
    // 1. הסרת מחלקת active מכל הכפתורים והפאנלים
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    // 2. הפעלת הפאנל הנבחר
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // 3. סימון הכפתור הנבחר כפעיל
    const targetBtn = document.querySelector(`.nav-item[onclick*="${panelId}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    // 4. הרצת עדכונים ספציפיים לכל טאב
    if (panelId === 'profile') renderChildren();
    if (panelId === 'goals') renderLifeGoals();
    if (panelId === 'summary') renderSummary();
    if (panelId === 'projections') renderProjections();
    if (panelId === 'charts') {
        // setTimeout נדרש ל-iPhone כדי שה-canvas יהיה מוכן
        setTimeout(() => renderCharts(), 100);
    }
    if (panelId === 'pension') {
        if (typeof renderPensionTab === 'function') renderPensionTab();
    }

    // 5. סגירת תפריט מובייל אם פתוח
    const navLinks = document.getElementById('navLinks');
    if (navLinks) navLinks.classList.remove('active');
}
// ==========================================
// SUB-TRACKS
// ==========================================

function addSubTrack() {
    const typeSelect = document.getElementById('subTrackType');
    const typeValue = typeSelect.value;
    let type = typeSelect.options[typeSelect.selectedIndex].text.split('(')[0].trim();
    
    // If "אחר" is selected, use custom name
    if (typeValue === 'אחר') {
        const customName = document.getElementById('subTrackCustomName').value.trim();
        if (!customName) {
            document.getElementById('subTrackError').textContent = '❌ יש להזין שם לתת-מסלול מותאם';
            return;
        }
        type = customName;
    }
    
    const percentInput = document.getElementById('subTrackPercent');
    const returnInput = document.getElementById('subTrackReturn');
    const riskLevelSelect = document.getElementById('subTrackRiskLevel');
    
    const percent = sanitizeNumber(percentInput.value);
    const returnRate = sanitizeNumber(returnInput.value);
    
    // Validation
    if (isNaN(percent) || percent <= 0 || percent > 100) {
        document.getElementById('subTrackError').textContent = '❌ אחוז חייב להיות בין 0.1-100';
        return;
    }
    
    if (isNaN(returnRate)) {
        document.getElementById('subTrackError').textContent = '❌ יש להזין תשואה צפויה';
        return;
    }
    
    // Validate manual risk level for נדל"ן and אחר
    let manualRisk = null;
    if (typeValue === 'נדל"ן' || typeValue === 'אחר') {
        manualRisk = riskLevelSelect.value;
        if (!manualRisk) {
            document.getElementById('subTrackError').textContent = '❌ יש לבחור רמת סיכון עבור נדל"ן ו"אחר"';
            return;
        }
    }
    
    const currentTotal = currentSubTracks.reduce((sum, st) => sum + st.percent, 0);
    const newTotal = currentTotal + percent;
    
    if (newTotal > 100.01) {
        document.getElementById('subTrackError').textContent = `❌ סה"כ יעבור 100%! (כרגע: ${currentTotal.toFixed(1)}%, מנסה להוסיף: ${percent}%)`;
        return;
    }
    
    const subTrack = { 
        type, 
        percent: parseFloat(percent.toFixed(2)), 
        returnRate: parseFloat(returnRate.toFixed(2))
    };
    
    // Add manual risk if applicable
    if (manualRisk) {
        subTrack.manualRisk = manualRisk;
    }
    
    currentSubTracks.push(subTrack);
    
    // Clear inputs
    percentInput.value = '';
    returnInput.value = SUB_TRACK_DEFAULTS[type] || 5;
    document.getElementById('subTrackCustomName').value = '';
    riskLevelSelect.value = '';
    document.getElementById('customNameField').style.display = 'none';
    document.getElementById('manualRiskField').style.display = 'none';
    document.getElementById('subTrackError').textContent = '';
    
    renderSubTracks();
    updateWeightedReturn();
}

function removeSubTrack(index) {
    currentSubTracks.splice(index, 1);
    renderSubTracks();
    updateWeightedReturn();
}

function editSubTrack(index) {
    const st = currentSubTracks[index];
    if (!st) return;
    
    // Populate the form fields
    document.getElementById('subTrackType').value = st.type || '';
    document.getElementById('subTrackPercent').value = st.percent;
    document.getElementById('subTrackReturn').value = st.returnRate;
    
    // Remove from array so user can re-add with changes
    currentSubTracks.splice(index, 1);
    renderSubTracks();
    updateWeightedReturn();
}

function renderSubTracks() {
    const container = document.getElementById('subTracksList');
    const totalPercent = currentSubTracks.reduce((sum, st) => sum + st.percent, 0);
    
    container.innerHTML = currentSubTracks.map((st, i) => `
        <div class="sub-track-item">
            <span><strong>${st.type}</strong></span>
            <span>${st.percent}%</span>
            <span>תשואה: ${st.returnRate}%</span>
            <div style="display: flex; gap: 5px;">
                <button type="button" class="btn btn-primary btn-sm" onclick="editSubTrack(${i})">✏️</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeSubTrack(${i})">✕</button>
            </div>
        </div>
    `).join('');
    
    const totalDiv = document.getElementById('subTrackTotal');
    totalDiv.textContent = `סה"כ: ${totalPercent.toFixed(1)}%`;
    totalDiv.style.color = totalPercent === 100 ? '#10b981' : (totalPercent < 100 ? '#3b82f6' : '#ef4444');
    
    updateWeightedReturn();
}

function updateWeightedReturn() {
    const returnInput = document.getElementById('invReturn');
    
    if (currentSubTracks.length === 0) {
        // No sub-tracks - keep field empty and editable
        returnInput.disabled = false;
        returnInput.style.backgroundColor = '';
        returnInput.style.color = '';
        returnInput.style.fontWeight = '';
        returnInput.style.borderColor = '';
        returnInput.placeholder = 'תיקבע אוטומטית מתתי-מסלולים';
        returnInput.value = '';
        returnInput.title = '';
        return;
    }
    
    // Calculate weighted average return
    const weightedReturn = currentSubTracks.reduce((sum, st) => {
        return sum + (st.returnRate * st.percent / 100);
    }, 0);
    
    // Set the weighted return and disable editing
    returnInput.value = weightedReturn.toFixed(2);
    returnInput.disabled = true;
    returnInput.style.backgroundColor = 'rgba(88, 166, 255, 0.15)';
    returnInput.style.color = '#58a6ff';
    returnInput.style.fontWeight = '700';
    returnInput.style.borderColor = '#58a6ff';
    returnInput.placeholder = 'מחושב אוטומטית';
    
    const calculation = currentSubTracks.map(st => 
        `${st.type}: ${st.percent}% × ${st.returnRate}% = ${(st.percent * st.returnRate / 100).toFixed(2)}%`
    ).join('\n');
    
    returnInput.title = `תשואה משוקללת:\n${calculation}\nסה"כ: ${weightedReturn.toFixed(2)}%`;
}

// ==========================================
// INVESTMENT CRUD
// ==========================================

function saveInvestment(event) {
    event.preventDefault();
    const plan = getCurrentPlan();
    const name = document.getElementById('invName').value.trim();
    
    if (!name) {
        alert('אנא הזן שם למסלול');
        return;
    }
    
    const amount = sanitizeNumber(document.getElementById('invAmount').value);
    const invType = document.getElementById('invType').value;
    
    // Validate pension fields
    if (invType === 'פנסיה') {
        const age = parseInt(document.getElementById('invAge').value);
        if (!age || age < 18 || age > 120) {
            alert('❌ עבור פנסיה, נדרש להזין גיל תקין (18-120)');
            return;
        }
    }
    
    // Validate sub-tracks if amount > 0 and tracks exist
    if (amount > 0 && currentSubTracks.length > 0) {
        const totalPercent = currentSubTracks.reduce((sum, st) => sum + st.percent, 0);
        if (Math.abs(totalPercent - 100) > 0.01) {
            alert(`❌ סך תתי-המסלולים חייב להיות 100%!\nכרגע: ${totalPercent.toFixed(1)}%`);
            return;
        }
    }
    
    const inv = {
        name,
        house: document.getElementById('invHouse').value.trim() || 'לא מוגדר',
        type: document.getElementById('invType').value,
        tax: sanitizeNumber(document.getElementById('invTax').value),
        amount,
        monthly: sanitizeNumber(document.getElementById('invMonthly').value),
        returnRate: sanitizeNumber(document.getElementById('invReturn').value),
        feeDeposit: sanitizeNumber(document.getElementById('invFeeDeposit').value),
        feeAnnual: sanitizeNumber(document.getElementById('invFeeAnnual').value),
        forDream: document.getElementById('invForDream').checked,
        include: document.getElementById('invInclude').checked,
        gender: document.getElementById('invGender').value,
        age: parseInt(document.getElementById('invAge').value) || null,
        spouse: document.getElementById('invSpouse') && document.getElementById('invSpouse').value || 'husband', // Default to husband
        subTracks: [...currentSubTracks]
    };
    
    if (appData.editingInvestmentIndex >= 0) {
        plan.investments[appData.editingInvestmentIndex] = inv;
        appData.editingInvestmentIndex = -1;
        cancelEditInvestment();
    } else {
        plan.investments.push(inv);
    }
    
    clearInvestmentForm();
    saveData();
    renderInvestments();
    updateDreamSources();
}

function clearInvestmentForm() {
    document.getElementById('investmentForm').reset();
    document.getElementById('invInclude').checked = true;
    currentSubTracks = [];
    renderSubTracks();
    document.getElementById('subTracksSection').style.display = 'none';
    document.getElementById('genderSection').style.display = 'none';
    
    // Re-enable return rate input and reset styling
    const returnInput = document.getElementById('invReturn');
    returnInput.disabled = false;
    returnInput.style.backgroundColor = '';
    returnInput.style.color = '';
    returnInput.style.fontWeight = '';
    returnInput.placeholder = '';
    returnInput.title = '';
    returnInput.value = '6';
}

function editInvestment(index) {
    const plan = getCurrentPlan();
    const inv = plan.investments[index];
    
    appData.editingInvestmentIndex = index;
    
    document.getElementById('invName').value = inv.name;
    document.getElementById('invHouse').value = inv.house || '';
    document.getElementById('invType').value = inv.type;
    document.getElementById('invTax').value = inv.tax || 0;
    document.getElementById('invAmount').value = inv.amount;
    document.getElementById('invMonthly').value = inv.monthly;
    document.getElementById('invReturn').value = inv.returnRate;
    document.getElementById('invFeeDeposit').value = inv.feeDeposit || 0;
    document.getElementById('invFeeAnnual').value = inv.feeAnnual || 0;
    document.getElementById('invForDream').checked = inv.forDream || false;
    document.getElementById('invInclude').checked = inv.include !== false;
    document.getElementById('invGender').value = inv.gender || 'male';
    document.getElementById('invAge').value = inv.age || '';
    if (document.getElementById('invSpouse')) {
        document.getElementById('invSpouse').value = inv.spouse || 'husband';
    }
    
    currentSubTracks = inv.subTracks ? JSON.parse(JSON.stringify(inv.subTracks)) : [];
    
    if (inv.amount > 0) {
        document.getElementById('subTracksSection').style.display = 'block';
        initSubTrackListeners(); // Initialize listeners for sub-track inputs
        renderSubTracks();
        updateWeightedReturn(); // This will disable return input if sub-tracks exist
    }
    
    if (inv.type === 'פנסיה') {
        document.getElementById('genderSection').style.display = 'block';
    }
    
    document.getElementById('investmentFormTitle').textContent = 'ערוך מסלול השקעה';
    document.getElementById('btnSaveText').textContent = 'עדכן מסלול';
    document.getElementById('btnCancelEdit').style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditInvestment() {
    appData.editingInvestmentIndex = -1;
    clearInvestmentForm();
    document.getElementById('investmentFormTitle').textContent = 'הוסף מסלול השקעה';
    document.getElementById('btnSaveText').textContent = 'שמור מסלול';
    document.getElementById('btnCancelEdit').style.display = 'none';
}

function deleteInvestment(index) {
    if (!confirm('למחוק מסלול זה?')) return;
    const plan = getCurrentPlan();
    plan.investments.splice(index, 1);
    saveData();
    renderInvestments();
    updateDreamSources();
}

function renderInvestments() {
    const plan = getCurrentPlan();
    const container = document.getElementById('investmentsList');
    document.getElementById('invCount').textContent = plan.investments.length;
    
    if (plan.investments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div class="empty-title">אין מסלולי השקעה</div>
                <div class="empty-text">התחל בהוספת המסלול הראשון שלך</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = plan.investments.map((inv, i) => {
        let badges = '';
        if (inv.forDream) badges += '<span class="badge badge-warning">💫 לחלומות</span>';
        if (!inv.include) badges += '<span class="badge badge-danger">🚫 לא בהון</span>';
        const taxBadge = inv.tax > 0 ? `<span class="badge badge-primary">מס ${inv.tax}%</span>` : '<span class="badge badge-success">פטור ממס</span>';
        
        let subTracksHTML = '';
        if (inv.subTracks && inv.subTracks.length > 0) {
            subTracksHTML = `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
                    <strong>פיצול תתי-מסלולים:</strong><br>
                    ${inv.subTracks.map(st => `${st.type} (${st.percent}%, תשואה ${st.returnRate}%)`).join(' • ')}
                </div>
            `;
        }
        
        let genderHTML = '';
        if (inv.type === 'פנסיה' && inv.gender) {
            const genderText = inv.gender === 'male' ? 'זכר (0.005)' : 'נקבה (0.006)';
            genderHTML = `<div class="item-detail"><span>👤</span><span>מגדר: ${genderText}</span></div>`;
        }
        
        return `
            <div class="item">
                <div class="item-header">
                    <div>
                        <div class="item-title">${inv.name} ${badges}</div>
                        <div class="item-subtitle">${inv.type} • ${inv.house} ${taxBadge}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-primary btn-sm" onclick="editInvestment(${i})">
                            <span>✏️</span>
                            <span>ערוך</span>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteInvestment(${i})">
                            <span>🗑️</span>
                            <span>מחק</span>
                        </button>
                    </div>
                </div>
                <div class="item-details">
                    <div class="item-detail"><span>💵</span><span>סכום: ${formatCurrency(inv.amount)}</span></div>
                    <div class="item-detail"><span>📅</span><span>חודשי: ${formatCurrency(inv.monthly)}</span></div>
                    <div class="item-detail"><span>📈</span><span>תשואה: ${inv.returnRate}%</span></div>
                    <div class="item-detail"><span>💼</span><span>דמי ניהול: ${inv.feeDeposit}% + ${inv.feeAnnual}%</span></div>
                    ${genderHTML}
                </div>
                ${subTracksHTML}
            </div>
        `;
    }).join('');
    
    // Update pension tab if it exists
    if (typeof renderPensionTab === 'function') {
        renderPensionTab();
    }
    
    // Update charts if charts panel is active
    const chartsPanel = document.getElementById('charts');
    if (chartsPanel && chartsPanel.classList.contains('active')) {
        renderCharts();
    }
}

// ==========================================
// DREAM CRUD
// ==========================================

function updateDreamSources() {
    const plan = getCurrentPlan();
    const select = document.getElementById('dreamSources');
    if (!select) return; // Field doesn't exist yet
    
    const dreamInvs = plan.investments.filter(inv => inv.forDream);
    
    select.innerHTML = '<option value="">לא מוגדר</option>' + 
        dreamInvs.map((inv, i) => {
            const actualIndex = plan.investments.indexOf(inv);
            return `<option value="${actualIndex}">${inv.name}</option>`;
        }).join('');
}

function saveDream(event) {
    event.preventDefault();
    const plan = getCurrentPlan();
    const name = document.getElementById('dreamName').value.trim();
    const cost = sanitizeNumber(document.getElementById('dreamCost').value);
    
    if (!name || cost <= 0) {
        alert('אנא הזן שם ועלות');
        return;
    }
    
    // Get selected sources (multiple)
    const sourcesSelect = document.getElementById('dreamSources');
    const selectedSources = Array.from(sourcesSelect.selectedOptions)
        .map(opt => opt.value)
        .filter(v => v !== '')
        .map(v => parseInt(v));
    
    const dream = {
        name,
        cost,
        year: parseInt(document.getElementById('dreamYear').value),
        sourceIndices: selectedSources.length > 0 ? selectedSources : null
    };
    
    plan.dreams.push(dream);
    document.getElementById('dreamForm').reset();
    saveData();
}

function deleteDream(index) {
    if (!confirm('למחוק חלום זה?')) return;
    const plan = getCurrentPlan();
    plan.dreams.splice(index, 1);
    saveData();
}

function calculateDreamGap(dream) {
    // Handle both old format (sourceIndex) and new format (sourceIndices)
    const sourceIndices = dream.sourceIndices || 
                         (dream.sourceIndex !== null && dream.sourceIndex !== undefined ? [dream.sourceIndex] : []);
    
    if (sourceIndices.length === 0) return null;
    
    const plan = getCurrentPlan();
    const currentYear = new Date().getFullYear();
    const yearsUntilDream = dream.year - currentYear;
    
    if (yearsUntilDream <= 0) return { gap: dream.cost, message: '⏰ החלום כבר עבר!', status: 'past' };
    
    const futureCost = dream.cost * Math.pow(1 + INFLATION_RATE / 100, yearsUntilDream);
    const costPerSource = dream.cost / sourceIndices.length;
    
    // Calculate total future value from all sources
    let totalFutureValue = 0;
    const validSources = [];
    
    for (const idx of sourceIndices) {
        const inv = plan.investments[idx];
        if (!inv) continue;
        
        const futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, yearsUntilDream, 
                                        inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        
        // Each source should cover costPerSource, but we count their total
        totalFutureValue += futureValue;
        validSources.push(inv.name);
    }
    
    if (validSources.length === 0) return null;
    
    const gap = futureCost - totalFutureValue;
    
    if (gap <= 0) {
        return { 
            gap: 0, 
            message: `✅ מצוין! ${validSources.length} מקורות יכסו את החלום + ${formatCurrency(Math.abs(gap))} נוסף!`,
            status: 'success'
        };
    } else {
        const monthlyNeededTotal = gap / (yearsUntilDream * 12);
        const monthlyNeededPerSource = monthlyNeededTotal / validSources.length;
        return { 
            gap, 
            message: `⚠️ חסר ${formatCurrency(gap)}. צריך ${formatCurrency(monthlyNeededPerSource)}/חודש לכל מקור (${validSources.length} מקורות)`,
            status: 'warning'
        };
    }
}

function renderProjections() {
    const plan = getCurrentPlan();
    const years = parseInt(document.getElementById('projYears').value) || 20;
    const interval = parseInt(document.getElementById('projInterval')?.value) || 5;
    const currentYear = new Date().getFullYear();
    const tbody = document.getElementById('projectionsBody');
    
    let rows = '';
    for (let y = 0; y <= years; y += interval) {
        const year = currentYear + y;
        
        // Use projection with withdrawals
        const projection = calculateProjectionWithWithdrawals(
            plan.investments,
            y,
            plan.withdrawals
        );
        
        const totalNominal = projection.finalNominal;
        const totalPrincipal = projection.finalPrincipal;
        const totalTax = calculateTax(totalPrincipal, totalNominal, 25, y); // Use actual years
        
        const real = calculateRealValue(totalNominal, y);
        const netAfterTax = totalNominal - totalTax;
        
        rows += `
            <tr>
                <td style="font-weight: 600;">${year}</td>
                <td>${formatCurrency(totalNominal)}</td>
                <td style="color: var(--primary);">${formatCurrency(real)}</td>
                <td style="color: var(--danger);">${formatCurrency(totalTax)}</td>
                <td style="color: var(--success); font-weight: 600;">${formatCurrency(netAfterTax)}</td>
            </tr>
        `;
    }
    
    tbody.innerHTML = rows;
}

function showYearDetails() {
    const plan = getCurrentPlan();
    const targetYear = parseInt(document.getElementById('specificYear').value);
    const currentYear = new Date().getFullYear();
    
    if (!targetYear || targetYear < currentYear) {
        alert('אנא הזן שנה תקינה');
        return;
    }
    
    const years = targetYear - currentYear;
    const container = document.getElementById('yearDetailsContainer');
    
    let html = `<div class="card" style="background: #f0f9ff; border: 2px solid var(--primary);">
        <h3 style="color: var(--primary); margin-bottom: 20px;">📊 פירוט מפורט לשנת ${targetYear}</h3>
        <div class="items-list">`;
    
    plan.investments.forEach((inv, i) => {
        if (!inv.include) return;
        
        const nominal = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                    inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        const principal = calculatePrincipal(inv.amount, inv.monthly, years);
        const profit = nominal - principal;
        const tax = calculateTax(principal, nominal, inv.tax, years); // Pass years
        const netAfterTax = nominal - tax;
        const real = calculateRealValue(nominal, years);
        
        let pensionHTML = '';
        if (inv.type === 'פנסיה' && inv.gender) {
            const monthlyPension = calculateMonthlyPension(nominal, inv.gender);
            pensionHTML = `
                <div class="alert alert-info" style="margin-top: 12px;">
                    <span class="alert-icon">💰</span>
                    <div>
                        <strong>קצבה חודשית משוערת:</strong> ${formatCurrency(monthlyPension)}<br>
                        <small>מחושב לפי מקדם ${inv.gender === 'male' ? '0.005' : '0.006'}</small>
                    </div>
                </div>
            `;
        }
        
        html += `
            <div class="item">
                <div class="item-title" style="margin-bottom: 16px;">${inv.name}</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                    <div><strong>ערך נומינלי:</strong> ${formatCurrency(nominal)}</div>
                    <div><strong>ערך ריאלי:</strong> ${formatCurrency(real)}</div>
                    <div><strong>קרן שהופקדה:</strong> ${formatCurrency(principal)}</div>
                    <div style="color: var(--success);"><strong>רווח:</strong> ${formatCurrency(profit)}</div>
                    <div style="color: var(--danger);"><strong>מס על רווח:</strong> ${formatCurrency(tax)}</div>
                    <div style="color: var(--primary); font-weight: 700;"><strong>נטו לאחר מס:</strong> ${formatCurrency(netAfterTax)}</div>
                </div>
                ${pensionHTML}
            </div>
        `;
    });
    
    html += `</div></div>`;
    container.innerHTML = html;
    container.style.display = 'block';
}

// ==========================================
// SUMMARY
// ==========================================

function renderSummary() {
    const plan = getCurrentPlan();
    const years = parseInt(document.getElementById('sumYears').value) || 20;
    
    let totalToday = 0; // Total today WITHOUT pension
    let pensionToday = 0; // Pension today
    
    // Separate pension from other investments for today's calculation
    plan.investments.forEach(inv => {
        if (!inv.include) return;
        
        // Only count NON-pension in today's total
        if (inv.type !== 'פנסיה') {
            totalToday += inv.amount || 0;
        }
    });
    
    // Calculate projection WITH withdrawals
    const projection = calculateProjectionWithWithdrawals(
        plan.investments, 
        years, 
        plan.withdrawals
    );
    
    const totalNominal = projection.finalNominal;
    const totalPrincipal = projection.finalPrincipal;
    
    // Calculate pension separately (no withdrawals from pension)
    let pensionNominal = 0;
    let pensionPrincipal = 0;
    let pensionTax = 0;
    let totalFees = 0;
    
    const breakdown = plan.investments.map(inv => {
        if (!inv.include) return null;
        if (inv.type === 'פנסיה') return null; // Skip pension - shown in separate tab
        
        const nominal = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                    inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        const nominalNoFees = calculateFV(inv.amount, inv.monthly, inv.returnRate, years, 0, 0, 
                                          inv.subTracks ? inv.subTracks.map(st => ({...st, returnRate: st.returnRate})) : null);
        const principal = calculatePrincipal(inv.amount, inv.monthly, years);
        
        // Calculate tax (no pension here)
        const tax = calculateTax(principal, nominal, inv.tax, years);
        
        const fees = nominalNoFees - nominal;
        const real = calculateRealValue(nominal, years);
        
        totalFees += fees;
        
        return { inv, nominal, real, tax, principal, fees };
    }).filter(Boolean);
    
    const totalReal = calculateRealValue(totalNominal, years);
    const pensionReal = calculateRealValue(pensionNominal, years);
    
    // Update displays
    const todayElement = document.getElementById('sumToday');
    
    // Simple display - equity only
    todayElement.textContent = formatCurrency(totalToday);
    
    // Calculate tax on final portfolio
    const totalTax = calculateTax(totalPrincipal, totalNominal, 25, years); // Use actual years
    
    document.getElementById('sumNominal').textContent = formatCurrency(totalNominal);
    document.getElementById('sumReal').textContent = formatCurrency(totalReal);
    document.getElementById('sumFees').textContent = formatCurrency(totalFees);
    document.getElementById('sumTax').textContent = formatCurrency(totalTax);
    
    // Calculate weighted averages for non-pension investments
    const activeInvestments = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalAmount = activeInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    if (totalAmount > 0) {
        // Weighted average fees
        const avgFeeAnnual = activeInvestments.reduce((sum, inv) => 
            sum + ((inv.amount || 0) * (inv.feeAnnual || 0)), 0) / totalAmount;
        const avgFeeDeposit = activeInvestments.reduce((sum, inv) => 
            sum + ((inv.amount || 0) * (inv.feeDeposit || 0)), 0) / totalAmount;
        
        // Weighted average return
        const avgReturn = activeInvestments.reduce((sum, inv) => 
            sum + ((inv.amount || 0) * (inv.returnRate || 0)), 0) / totalAmount;
        
        document.getElementById('sumAvgFees').textContent = avgFeeAnnual.toFixed(2) + '%';
        document.getElementById('sumAvgFeeAnnual').textContent = avgFeeAnnual.toFixed(2) + '%';
        document.getElementById('sumAvgFeeDeposit').textContent = avgFeeDeposit.toFixed(2) + '%';
        document.getElementById('sumAvgReturn').textContent = avgReturn.toFixed(2) + '%';
    } else {
        document.getElementById('sumAvgFees').textContent = '-';
        document.getElementById('sumAvgFeeAnnual').textContent = '-';
        document.getElementById('sumAvgFeeDeposit').textContent = '-';
        document.getElementById('sumAvgReturn').textContent = '-';
    }
    
    // Show years with withdrawal note if applicable
    const yearsLabel = document.getElementById('sumYearsLabel');
    const activeWithdrawals = plan.withdrawals?.filter(w => w.active !== false).length || 0;
    
    if (projection.totalWithdrawn > 0 && activeWithdrawals > 0) {
        yearsLabel.innerHTML = `
            בעוד ${years} שנה${years > 1 ? 'ים' : ''}
            <div style="font-size: 0.75em; margin-top: 4px; color: rgba(255, 255, 255, 0.9);">
                ⚠️ כולל ${activeWithdrawals} משיכות (${formatCurrency(projection.netWithdrawn)} נטו)
            </div>
        `;
    } else {
        yearsLabel.textContent = `בעוד ${years} שנה${years > 1 ? 'ים' : ''}`;
    }
    
    const container = document.getElementById('summaryBreakdown');
    
    container.innerHTML = breakdown.map(item => {
        return `
            <div class="item">
                <div class="item-header">
                    <div>
                        <div class="item-title" style="color: #f0f6fc;">${item.inv.name}</div>
                        <div class="item-subtitle" style="color: #8b949e;">${item.inv.type}</div>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-size: 1.5em; font-weight: 700; color: #3fb950;">
                            ${formatCurrency(item.nominal)}
                        </div>
                        <div style="color: #58a6ff; font-size: 0.95em;">
                            ${formatCurrency(item.real)} ריאלי
                        </div>
                    </div>
                </div>
                <div class="item-details" style="color: #8b949e;">
                    <div class="item-detail"><span>💵</span><span style="color: #f0f6fc;">קרן: ${formatCurrency(item.principal)}</span></div>
                    <div class="item-detail"><span>📈</span><span style="color: #3fb950;">רווח: ${formatCurrency(item.nominal - item.principal)}</span></div>
                    <div class="item-detail"><span>💸</span><span style="color: #f85149;">מס: ${formatCurrency(item.tax)}</span></div>
                    <div class="item-detail"><span>💼</span><span style="color: #d29922;">דמי ניהול: ${formatCurrency(item.fees)}</span></div>
                    <div class="item-detail"><span>✅</span><span style="color: #3fb950; font-weight: 700;">נטו: ${formatCurrency(item.nominal - item.tax)}</span></div>
                </div>
            </div>
        `;
    }).join('');
    
    // Render goal progress
    renderGoalProgress();
    renderRecommendations();
    renderRiskAnalysis();
}

// ==========================================
// IMPACT SIMULATOR
// ==========================================

function simulateImpact() {
    const plan = getCurrentPlan();
    
    // Get current averages
    let totalCurrent = 0;
    let totalWeightedReturn = 0;
    let totalWeightedFeeAnnual = 0;
    let totalWeightedFeeDeposit = 0;
    
    plan.investments.forEach(inv => {
        if (!inv.include) return;
        const amount = inv.amount || 0;
        totalCurrent += amount;
        totalWeightedReturn += amount * (inv.returnRate || 0);
        totalWeightedFeeAnnual += amount * (inv.feeAnnual || 0);
        totalWeightedFeeDeposit += amount * (inv.feeDeposit || 0);
    });
    
    if (totalCurrent === 0) {
        alert('אין מסלולי השקעה לסימולציה');
        return;
    }
    
    const currentAvgReturn = totalWeightedReturn / totalCurrent;
    const currentAvgFeeAnnual = totalWeightedFeeAnnual / totalCurrent;
    const currentAvgFeeDeposit = totalWeightedFeeDeposit / totalCurrent;
    
    // Get simulated values from inputs
    const newReturn = parseFloat(document.getElementById('simReturn').value);
    const newFeeAnnual = parseFloat(document.getElementById('simFeeAnnual').value);
    const newFeeDeposit = parseFloat(document.getElementById('simFeeDeposit').value);
    const years = parseInt(document.getElementById('simYears').value) || 20;
    
    // Calculate total monthly deposits
    let totalMonthly = 0;
    plan.investments.forEach(inv => {
        if (!inv.include) return;
        totalMonthly += inv.monthly || 0;
    });
    
    // Calculate current scenario
    const currentFV = calculateFV(
        totalCurrent,
        totalMonthly,
        currentAvgReturn,
        years,
        currentAvgFeeDeposit,
        currentAvgFeeAnnual,
        null // no subTracks for aggregate
    );
    
    // Calculate simulated scenario
    const simulatedFV = calculateFV(
        totalCurrent,
        totalMonthly,
        newReturn,
        years,
        newFeeDeposit,
        newFeeAnnual,
        null
    );
    
    // Calculate difference
    const difference = simulatedFV - currentFV;
    const percentChange = ((difference / currentFV) * 100).toFixed(2);
    
    // Display results
    const container = document.getElementById('simResults');
    const color = difference >= 0 ? '#10b981' : '#ef4444';
    const sign = difference >= 0 ? '+' : '';
    
    container.innerHTML = `
        <div class="card" style="background: rgba(59, 130, 246, 0.1); border: 2px solid #3b82f6; margin-top: 20px;">
            <div class="card-title">📊 תוצאות הסימולציה</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 20px;">
                <div style="text-align: center; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="font-size: 0.9em; color: #8b949e; margin-bottom: 8px;">מצב נוכחי</div>
                    <div style="font-size: 1.5em; font-weight: bold; color: #f0f6fc;">
                        ${formatCurrency(currentFV)}
                    </div>
                    <div style="font-size: 0.8em; color: #8b949e; margin-top: 4px;">
                        תשואה: ${currentAvgReturn.toFixed(2)}%<br>
                        דמ"נ: ${currentAvgFeeAnnual.toFixed(2)}% / ${currentAvgFeeDeposit.toFixed(2)}%
                    </div>
                </div>
                
                <div style="text-align: center; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="font-size: 0.9em; color: #8b949e; margin-bottom: 8px;">מצב משופר</div>
                    <div style="font-size: 1.5em; font-weight: bold; color: ${color};">
                        ${formatCurrency(simulatedFV)}
                    </div>
                    <div style="font-size: 0.8em; color: #8b949e; margin-top: 4px;">
                        תשואה: ${newReturn.toFixed(2)}%<br>
                        דמ"נ: ${newFeeAnnual.toFixed(2)}% / ${newFeeDeposit.toFixed(2)}%
                    </div>
                </div>
                
                <div style="text-align: center; padding: 16px; background: ${difference >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-radius: 8px; border: 2px solid ${color};">
                    <div style="font-size: 0.9em; color: #8b949e; margin-bottom: 8px;">הבדל</div>
                    <div style="font-size: 1.8em; font-weight: bold; color: ${color};">
                        ${sign}${formatCurrency(Math.abs(difference))}
                    </div>
                    <div style="font-size: 1.2em; color: ${color}; margin-top: 4px;">
                        ${sign}${percentChange}%
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 20px; padding: 16px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border-left: 4px solid #f59e0b;">
                <div style="font-weight: bold; color: #f59e0b; margin-bottom: 8px;">💡 פירוש התוצאה:</div>
                <div style="color: #f0f6fc;">
                    ${difference >= 0 
                        ? `שיפור בתשואה או הקטנת דמי ניהול יגדילו את ההון שלך ב-<strong style="color: #10b981;">${formatCurrency(Math.abs(difference))}</strong> בעוד ${years} שנים.`
                        : `הידרדרות בתשואה או הגדלת דמי ניהול יקטינו את ההון שלך ב-<strong style="color: #ef4444;">${formatCurrency(Math.abs(difference))}</strong> בעוד ${years} שנים.`
                    }
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// CHARTS
// ==========================================

function renderCharts() {
    const plan = getCurrentPlan();
    
    // Get timeframe from selector (default to 0 = today)
    const timeframeSelect = document.getElementById('chartsTimeframe');
    const years = timeframeSelect ? parseInt(timeframeSelect.value) : 0;
    
    // Calculate totals
    const byType = {};
    const byHouse = {};
    const bySubTrack = {};
    const subTrackObjects = []; // For risk classification
    let taxExempt = 0;
    let taxable = 0;
    let total = 0;
    
    plan.investments.forEach(inv => {
        if (!inv.include) return;
        
        // If years = 0, use current amount only (no projection)
        let value;
        if (years === 0) {
            value = inv.amount || 0;
        } else {
            value = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                              inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        }
        
        byType[inv.type] = (byType[inv.type] || 0) + value;
        byHouse[inv.house] = (byHouse[inv.house] || 0) + value;
        
        // Calculate sub-tracks
        if (inv.subTracks && inv.subTracks.length > 0) {
            inv.subTracks.forEach(st => {
                const subTrackValue = value * (st.percent / 100);
                bySubTrack[st.type] = (bySubTrack[st.type] || 0) + subTrackValue;
                
                // Keep full object for risk classification
                subTrackObjects.push({
                    ...st,
                    value: subTrackValue
                });
            });
        } else {
            // If no sub-tracks, count as "לא מחולק"
            bySubTrack['לא מחולק לתתי-מסלולים'] = (bySubTrack['לא מחולק לתתי-מסלולים'] || 0) + value;
            subTrackObjects.push({
                type: 'לא מחולק לתתי-מסלולים',
                value: value
            });
        }
        
        if (inv.tax > 0) {
            taxable += value;
        } else {
            taxExempt += value;
        }
        
        total += value;
    });
    
    // Render charts
    renderPieChart('chartBySubTracks', bySubTrack, 'תתי-מסלולים');
    renderPieChart('chartByType', byType, 'סוג מסלול');
    renderPieChartWithUniqueColors('chartByHouse', byHouse, 'בית השקעות');
    renderPieChart('chartByTax', { 'פטור ממס': taxExempt, 'חייב במס': taxable }, 'מיסוי');
    renderRiskPieChart(subTrackObjects); // Pass objects, not dictionary
}

function renderPieChart(canvasId, data, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Destroy existing chart if exists
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
    }
    
    const labels = Object.keys(data);
    const values = Object.values(data);
    const total = values.reduce((sum, v) => sum + v, 0);
    
    if (total === 0) {
        // Hide canvas, show empty message - DON'T replace canvas with innerHTML!
        ctx.style.display = 'none';
        let emptyDiv = document.getElementById(canvasId + '_empty');
        if (!emptyDiv) {
            emptyDiv = document.createElement('div');
            emptyDiv.id = canvasId + '_empty';
            emptyDiv.className = 'empty-state';
            emptyDiv.innerHTML = '<div class="empty-text">אין נתונים להצגה</div>';
            ctx.parentElement.appendChild(emptyDiv);
        }
        emptyDiv.style.display = 'block';
        return;
    }
    
    // Show canvas, hide empty message
    ctx.style.display = 'block';
    const emptyDiv = document.getElementById(canvasId + '_empty');
    if (emptyDiv) emptyDiv.style.display = 'none';
    
    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map((l, i) => `${l} (${((values[i]/total)*100).toFixed(1)}%)`),
            datasets: [{
                data: values,
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: { duration: 300 },
            plugins: {
                legend: {
                    position: 'bottom',
                    rtl: true,
                    labels: {
                        font: { size: 12, family: 'Heebo' },
                        padding: 15
                    }
                },
                tooltip: {
                    rtl: true,
                    callbacks: {
                        label: function(context) {
                            return ' ' + formatCurrency(context.parsed);
                        }
                    }
                }
            }
        }
    });
}

function renderPieChartWithUniqueColors(canvasId, data, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
    }
    
    const labels = Object.keys(data);
    const values = Object.values(data);
    const total = values.reduce((sum, v) => sum + v, 0);
    
    if (total === 0) {
        ctx.style.display = 'none';
        let emptyDiv = document.getElementById(canvasId + '_empty');
        if (!emptyDiv) {
            emptyDiv = document.createElement('div');
            emptyDiv.id = canvasId + '_empty';
            emptyDiv.className = 'empty-state';
            emptyDiv.innerHTML = '<div class="empty-text">אין נתונים להצגה</div>';
            ctx.parentElement.appendChild(emptyDiv);
        }
        emptyDiv.style.display = 'block';
        return;
    }
    
    ctx.style.display = 'block';
    const emptyDiv = document.getElementById(canvasId + '_empty');
    if (emptyDiv) emptyDiv.style.display = 'none';
    
    const colors = generateUniqueColors(labels.length);
    
    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map((l, i) => `${l} (${((values[i]/total)*100).toFixed(1)}%)`),
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    rtl: true,
                    labels: {
                        font: { size: 12, family: 'Heebo' },
                        padding: 15,
                        boxWidth: 15,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            return data.labels.map((label, i) => ({
                                text: label,
                                fillStyle: data.datasets[0].backgroundColor[i],
                                hidden: false,
                                index: i
                            }));
                        }
                    }
                },
                tooltip: {
                    rtl: true,
                    callbacks: {
                        label: function(context) {
                            return ' ' + formatCurrency(context.parsed);
                        }
                    }
                }
            }
        }
    });
}

function renderRiskPieChart(subTrackObjects) {
    const riskCategories = {
        'סיכון נמוך': 0,
        'סיכון בינוני': 0,
        'סיכון גבוה': 0
    };
    
    // Classify each subTrack object (skip undefined)
    subTrackObjects.forEach(st => {
        const risk = classifyRisk(st);  // Pass full object
        if (risk === 'low') riskCategories['סיכון נמוך'] += st.value;
        else if (risk === 'medium') riskCategories['סיכון בינוני'] += st.value;
        else if (risk === 'high') riskCategories['סיכון גבוה'] += st.value;
        // Skip undefined - don't add to chart
    });
    
    const ctx = document.getElementById('chartByRisk');
    if (!ctx) return;
    
    if (charts.chartByRisk) {
        charts.chartByRisk.destroy();
        delete charts.chartByRisk;
    }
    
    const labels = Object.keys(riskCategories);
    const values = Object.values(riskCategories);
    const total = values.reduce((sum, v) => sum + v, 0);
    
    if (total === 0) {
        ctx.style.display = 'none';
        let emptyDiv = document.getElementById('chartByRisk_empty');
        if (!emptyDiv) {
            emptyDiv = document.createElement('div');
            emptyDiv.id = 'chartByRisk_empty';
            emptyDiv.className = 'empty-state';
            emptyDiv.innerHTML = '<div class="empty-text">אין נתונים להצגה</div>';
            ctx.parentElement.appendChild(emptyDiv);
        }
        emptyDiv.style.display = 'block';
        return;
    }
    
    ctx.style.display = 'block';
    const emptyDivR = document.getElementById('chartByRisk_empty');
    if (emptyDivR) emptyDivR.style.display = 'none';
    
    charts.chartByRisk = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map((l, i) => `${l} (${((values[i]/total)*100).toFixed(1)}%)`),
            datasets: [{
                data: values,
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#9ca3af'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    rtl: true,
                    labels: {
                        font: { size: 12, family: 'Heebo' },
                        padding: 15
                    }
                },
                tooltip: {
                    rtl: true,
                    callbacks: {
                        label: function(context) {
                            return ' ' + formatCurrency(context.parsed);
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// PLAN MANAGEMENT
// ==========================================

function updatePlanSelector() {
    const select = document.getElementById('planSelector');
    select.innerHTML = '<option value="">בחר תוכנית...</option>' +
        appData.plans.map(p => 
            `<option value="${p.id}" ${p.id === appData.currentPlanId ? 'selected' : ''}>${p.name}</option>`
        ).join('');
}

function switchPlan(planId) {
    if (!planId) return;
    appData.currentPlanId = planId;
    saveData();
    render();
}

function showPlanManager() {
    const modal = document.getElementById('planModal');
    const list = document.getElementById('plansList');
    
    list.innerHTML = appData.plans.map((p, i) => `
        <div class="item" style="margin-bottom: 12px;">
            <div class="item-header">
                <div>
                    <div class="item-title">${p.name}</div>
                   <div class="item-subtitle">${p.investments.length} מסלולים</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-primary btn-sm" onclick="selectPlan('${p.id}')">בחר</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePlan('${p.id}')" ${appData.plans.length === 1 ? 'disabled' : ''}>מחק</button>
                </div>
            </div>
        </div>
    `).join('');
    
    modal.style.display = 'flex';
}

function closePlanManager() {
    document.getElementById('planModal').style.display = 'none';
}

function createNewPlan() {
    const name = prompt('שם התוכנית החדשה:', `תוכנית ${appData.plans.length + 1}`);
    if (!name) return;
    
    const plan = {
        id: Date.now().toString(),
        name,
        investments: [],
        withdrawals: [],
profile: {
    maritalStatus: 'married',
    user: { name: '', age: null, gender: 'male' },
    spouse: { name: '', age: null, gender: 'female' },
    children: []
},
goals: {
    retirement: {
        userAge: null,
        spouseAge: null,
        monthlyPension: null,
        isRealValue: true
    },
    equity: {
        targetAmount: null,
        targetYear: null,
        isRealValue: true
    },
    lifeGoals: []
},


        createdAt: new Date().toISOString()
    };
    
    appData.plans.push(plan);
    appData.currentPlanId = plan.id;
    saveData();
    updatePlanSelector();
    closePlanManager();
    render();
}

function selectPlan(planId) {
    appData.currentPlanId = planId;
    saveData();
    updatePlanSelector();
    closePlanManager();
    render();
}

function deletePlan(planId) {
    if (appData.plans.length === 1) {
        alert('לא ניתן למחוק את התוכנית היחידה');
        return;
    }
    
    if (!confirm('למחוק תוכנית זו?')) return;
    
    appData.plans = appData.plans.filter(p => p.id !== planId);
    if (appData.currentPlanId === planId) {
        appData.currentPlanId = appData.plans[0].id;
    }
    saveData();
    updatePlanSelector();
    showPlanManager();
    render();
}

// ==========================================
// EXPORT/IMPORT PLACEHOLDERS
// ==========================================

function exportToPDF() {
    alert('📄 ייצוא PDF - תכונה זו תתווסף בקרוב!\n\nכרגע תוכל:\n1. להדפיס את הדף (Ctrl+P)\n2. לבחור "שמור כ-PDF"\n3. לקבל דוח מלא');
}

function exportToExcel() {
    const plan = getCurrentPlan();
    const profile = plan.profile;
    const goals = plan.goals;
    
    try {
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Investments
        const invData = plan.investments.map(inv => ({
            'שם': inv.name,
            'סוג': inv.type,
            'בית השקעות': inv.house,
            'סכום נוכחי': inv.amount,
            'הפקדה חודשית': inv.monthly,
            'תשואה %': inv.returnRate,
            'מס %': inv.tax || 0,
            'דמי ניהול הפקדה %': inv.feeDeposit || 0,
            'דמי ניהול צבירה %': inv.feeAnnual || 0,
            'כלול': inv.include ? 'כן' : 'לא',
            'בן/בת זוג': inv.spouse || '',
            'גיל': inv.age || '',
            'מגדר': inv.gender || '',
            'תתי-מסלולים': inv.subTracks ? JSON.stringify(inv.subTracks) : ''
        }));
        const ws1 = XLSX.utils.json_to_sheet(invData);
        XLSX.utils.book_append_sheet(wb, ws1, 'מסלולי השקעה');
        
        // Sheet 2: Profile
        const profileData = [
            { 'שדה': 'שם משתמש', 'ערך': profile.user.name || '' },
            { 'שדה': 'גיל משתמש', 'ערך': profile.user.age || '' },
            { 'שדה': 'שם בן/בת זוג', 'ערך': profile.spouse.name || '' },
            { 'שדה': 'גיל בן/בת זוג', 'ערך': profile.spouse.age || '' },
            { 'שדה': 'מספר ילדים', 'ערך': profile.children.length }
        ];
        profile.children.forEach((child, i) => {
            profileData.push({ 'שדה': `ילד ${i+1} - שם`, 'ערך': child.name });
            profileData.push({ 'שדה': `ילד ${i+1} - גיל`, 'ערך': child.age });
        });
        const ws2 = XLSX.utils.json_to_sheet(profileData);
        XLSX.utils.book_append_sheet(wb, ws2, 'פרופיל');
        
        // Sheet 3: Goals - Retirement
        const retirementData = [{
            'סוג יעד': 'פרישה',
            'גיל משתמש': goals.retirement.userAge || '',
            'גיל בן/בת זוג': goals.retirement.spouseAge || '',
            'קצבה חודשית': goals.retirement.monthlyPension || '',
            'ערך ריאלי': goals.retirement.isRealValue ? 'כן' : 'לא'
        }];
        const ws3 = XLSX.utils.json_to_sheet(retirementData);
        XLSX.utils.book_append_sheet(wb, ws3, 'יעד פרישה');
        
        // Sheet 4: Goals - Equity
        const equityData = [{
            'סוג יעד': 'הון עצמי',
            'סכום יעד': goals.equity.targetAmount || '',
            'שנת יעד': goals.equity.targetYear || ''
        }];
        const ws4 = XLSX.utils.json_to_sheet(equityData);
        XLSX.utils.book_append_sheet(wb, ws4, 'יעד הון');
        
        // Sheet 5: Life Goals
        if (goals.lifeGoals && goals.lifeGoals.length > 0) {
            const lifeGoalsData = goals.lifeGoals.map(g => ({
                'שם': g.name,
                'סכום': g.amount,
                'שנה': g.year,
                'ID': g.id || ''
            }));
            const ws5 = XLSX.utils.json_to_sheet(lifeGoalsData);
            XLSX.utils.book_append_sheet(wb, ws5, 'יעדי חיים');
        }
        
        // Sheet 6: Roadmap (Withdrawals)
        if (plan.withdrawals && plan.withdrawals.length > 0) {
            const withdrawalsData = plan.withdrawals.map(w => ({
                'שנה': w.year,
                'סכום': w.amount,
                'מטרה': w.goal || '',
                'מקושר ליעד ID': w.goalId || '',
                'פעיל': w.active === false ? 'לא' : 'כן'
            }));
            const ws6 = XLSX.utils.json_to_sheet(withdrawalsData);
            XLSX.utils.book_append_sheet(wb, ws6, 'מפת דרכים');
        }
        
        // Generate filename with date
        const now = new Date();
        const filename = `${plan.name}_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.xlsx`;
        
        XLSX.writeFile(wb, filename);
    } catch (e) {
        console.error('Excel export error:', e);
        alert('שגיאה בייצוא ל-Excel: ' + e.message);
    }
}

function exportExcel() {
    const plan = getCurrentPlan();
    const profile = plan.profile;
    const goals = plan.goals;
    
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Investments
    const invData = plan.investments.map(inv => ({
        'שם': inv.name,
        'סוג': inv.type,
        'בית השקעות': inv.house,
        'סכום נוכחי': inv.amount,
        'הפקדה חודשית': inv.monthly,
        'תשואה %': inv.returnRate,
        'מס %': inv.tax || 0,
        'דמי ניהול הפקדה %': inv.feeDeposit || 0,
        'דמי ניהול צבירה %': inv.feeAnnual || 0,
        'כלול': inv.include ? 'כן' : 'לא',
        'בן/בת זוג': inv.spouse || '',
        'גיל': inv.age || '',
        'מגדר': inv.gender || '',
        'תתי-מסלולים': inv.subTracks ? JSON.stringify(inv.subTracks) : ''
    }));
    const ws1 = XLSX.utils.json_to_sheet(invData);
    XLSX.utils.book_append_sheet(wb, ws1, 'מסלולי השקעה');
    
    // Sheet 2: Profile
    const profileData = [
        { 'שדה': 'שם משתמש', 'ערך': profile.user.name || '' },
        { 'שדה': 'גיל משתמש', 'ערך': profile.user.age || '' },
        { 'שדה': 'שם בן/בת זוג', 'ערך': profile.spouse.name || '' },
        { 'שדה': 'גיל בן/בת זוג', 'ערך': profile.spouse.age || '' },
        { 'שדה': 'מספר ילדים', 'ערך': profile.children.length }
    ];
    profile.children.forEach((child, i) => {
        profileData.push({ 'שדה': `ילד ${i+1} - שם`, 'ערך': child.name });
        profileData.push({ 'שדה': `ילד ${i+1} - גיל`, 'ערך': child.age });
    });
    const ws2 = XLSX.utils.json_to_sheet(profileData);
    XLSX.utils.book_append_sheet(wb, ws2, 'פרופיל');
    
    // Sheet 3: Goals - Retirement
    const retirementData = [{
        'סוג יעד': 'פרישה',
        'גיל משתמש': goals.retirement.userAge || '',
        'גיל בן/בת זוג': goals.retirement.spouseAge || '',
        'קצבה חודשית': goals.retirement.monthlyPension || '',
        'ערך ריאלי': goals.retirement.isRealValue ? 'כן' : 'לא'
    }];
    const ws3 = XLSX.utils.json_to_sheet(retirementData);
    XLSX.utils.book_append_sheet(wb, ws3, 'יעד פרישה');
    
    // Sheet 4: Goals - Equity
    const equityData = [{
        'סוג יעד': 'הון עצמי',
        'סכום יעד': goals.equity.targetAmount || '',
        'שנת יעד': goals.equity.targetYear || ''
    }];
    const ws4 = XLSX.utils.json_to_sheet(equityData);
    XLSX.utils.book_append_sheet(wb, ws4, 'יעד הון');
    
    // Sheet 5: Life Goals
    if (goals.lifeGoals && goals.lifeGoals.length > 0) {
        const lifeGoalsData = goals.lifeGoals.map(g => ({
            'שם': g.name,
            'סכום': g.amount,
            'שנה': g.year,
            'ID': g.id || ''
        }));
        const ws5 = XLSX.utils.json_to_sheet(lifeGoalsData);
        XLSX.utils.book_append_sheet(wb, ws5, 'יעדי חיים');
    }
    
    // Sheet 6: Roadmap (Withdrawals)
    if (plan.withdrawals && plan.withdrawals.length > 0) {
        const withdrawalsData = plan.withdrawals.map(w => ({
            'שנה': w.year,
            'סכום': w.amount,
            'מטרה': w.goal || '',
            'מקושר ליעד ID': w.goalId || '',
            'פעיל': w.active === false ? 'לא' : 'כן'
        }));
        const ws6 = XLSX.utils.json_to_sheet(withdrawalsData);
        XLSX.utils.book_append_sheet(wb, ws6, 'מפת דרכים');
    }
    
    // Generate filename with date
    const now = new Date();
    const filename = `תוכנית_פיננסית_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    showSaveNotification('✅ הקובץ יוצא בהצלחה!');
}

function importExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const plan = getCurrentPlan();
            
            // Import investments
            if (workbook.SheetNames.includes('מסלולי השקעה')) {
                const invSheet = workbook.Sheets['מסלולי השקעה'];
                const invData = XLSX.utils.sheet_to_json(invSheet);
                plan.investments = invData.map(row => ({
                    name: row['שם'] || '',
                    type: row['סוג'] || 'אחר',
                    house: row['בית השקעות'] || 'לא מוגדר',
                    amount: parseFloat(row['סכום נוכחי']) || 0,
                    monthly: parseFloat(row['הפקדה חודשית']) || 0,
                    returnRate: parseFloat(row['תשואה %']) || 0,
                    tax: parseFloat(row['מס %']) || 0,
                    feeDeposit: parseFloat(row['דמי ניהול הפקדה %']) || 0,
                    feeAnnual: parseFloat(row['דמי ניהול צבירה %']) || 0,
                    include: row['כלול'] === 'כן',
                    spouse: row['בן/בת זוג'] || '',
                    age: parseInt(row['גיל']) || null,
                    gender: row['מגדר'] || '',
                    subTracks: row['תתי-מסלולים'] ? JSON.parse(row['תתי-מסלולים']) : []
                }));
            }
            
            // Import profile
            if (workbook.SheetNames.includes('פרופיל')) {
                const profileSheet = workbook.Sheets['פרופיל'];
                const profileData = XLSX.utils.sheet_to_json(profileSheet);
                
                profileData.forEach(row => {
                    const field = row['שדה'];
                    const value = row['ערך'];
                    
                    if (field === 'שם משתמש') getCurrentPlan().profile.user.name = value;
                    if (field === 'גיל משתמש') getCurrentPlan().profile.user.age = parseInt(value) || null;
                    if (field === 'שם בן/בת זוג') getCurrentPlan().profile.spouse.name = value;
                    if (field === 'גיל בן/בת זוג') getCurrentPlan().profile.spouse.age = parseInt(value) || null;
                    
                    if (field.startsWith('ילד ')) {
                        const match = field.match(/ילד (\d+) - (שם|גיל)/);
                        if (match) {
                            const index = parseInt(match[1]) - 1;
                            const prop = match[2];
                            
                            if (!getCurrentPlan().profile.children[index]) {
                               getCurrentPlan().profile.children[index] = { name: '', age: null };
                            }
                            
                            if (prop === 'שם') getCurrentPlan().profile.children[index].name = value;
                            if (prop === 'גיל') getCurrentPlan().profile.children[index].age = parseInt(value) || null;
                        }
                    }
                });
            }
            
            // Import retirement goal
            if (workbook.SheetNames.includes('יעד פרישה')) {
                const retSheet = workbook.Sheets['יעד פרישה'];
                const retData = XLSX.utils.sheet_to_json(retSheet);
                if (retData.length > 0) {
                    const row = retData[0];
                    getCurrentPlan().goals.retirement.userAge = parseInt(row['גיל משתמש']) || null;
                    getCurrentPlan().goals.retirement.spouseAge = parseInt(row['גיל בן/בת זוג']) || null;
                    getCurrentPlan().goals.retirement.monthlyPension = parseFloat(row['קצבה חודשית']) || null;
                    getCurrentPlan().goals.retirement.isRealValue = row['ערך ריאלי'] === 'כן';
                }
            }
            
            // Import equity goal
            if (workbook.SheetNames.includes('יעד הון')) {
                const eqSheet = workbook.Sheets['יעד הון'];
                const eqData = XLSX.utils.sheet_to_json(eqSheet);
                if (eqData.length > 0) {
                    const row = eqData[0];
                    getCurrentPlan().goals.equity.targetAmount = parseFloat(row['סכום יעד']) || null;
                    getCurrentPlan().goals.equity.targetYear = parseInt(row['שנת יעד']) || null;
                }
            }
            
            // Import life goals
            if (workbook.SheetNames.includes('יעדי חיים')) {
                const lgSheet = workbook.Sheets['יעדי חיים'];
                const lgData = XLSX.utils.sheet_to_json(lgSheet);
                getCurrentPlan().goals.lifeGoals = lgData.map(row => ({
                    id: row['ID'] || Date.now() + Math.random(),
                    name: row['שם'] || '',
                    amount: parseFloat(row['סכום']) || 0,
                    year: parseInt(row['שנה']) || new Date().getFullYear() + 10
                }));
            }
            
            // Import roadmap
            if (workbook.SheetNames.includes('מפת דרכים')) {
                const rmSheet = workbook.Sheets['מפת דרכים'];
                const rmData = XLSX.utils.sheet_to_json(rmSheet);
                plan.withdrawals = rmData.map(row => ({
                    year: parseInt(row['שנה']) || new Date().getFullYear(),
                    amount: parseFloat(row['סכום']) || 0,
                    goal: row['מטרה'] || '',
                    goalId: row['מקושר ליעד ID'] || null,
                    active: row['פעיל'] !== 'לא'
                }));
            }
            
            saveData();
            syncLifeGoalsToRoadmap();
            renderWithdrawals();
            renderInvestments();
            renderSummary();
            if (typeof renderPensionTab === 'function') renderPensionTab();  // ← הוספתי!
            
            alert('✅ כל הנתונים יובאו בהצלחה!\n- השקעות\n- פרופיל\n- יעדים\n- מפת דרכים');
        } catch (e) {
            console.error('Import error:', e);
            alert('❌ שגיאה בייבוא הקובץ: ' + e.message);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

// ==========================================
// RENDER ALL
// ==========================================

function render() {
    renderInvestments();
    updateDreamSources();
    renderWithdrawals();  // ← הוספתי!
}

// ==========================================
// INITIALIZE ON LOAD
// ==========================================

document.addEventListener('DOMContentLoaded', init);

// ==========================================
// TASKS MANAGEMENT
// ==========================================

let tasks = [];

function loadTasks() {
    const saved = localStorage.getItem('financialPlannerTasks');
    if (saved) {
        try {
            tasks = JSON.parse(saved);
        } catch (e) {
            tasks = [];
        }
    }
}

function saveTasks() {
    localStorage.setItem('financialPlannerTasks', JSON.stringify(tasks));
}

function addTask() {
    const input = document.getElementById('newTask');
    const text = input.value.trim();
    
    if (!text) {
        alert('אנא הזן טקסט למשימה');
        return;
    }
    
    tasks.push({
        id: Date.now(),
        text,
        done: false,
        createdAt: new Date().toISOString()
    });
    
    input.value = '';
    saveTasks();
    renderTasks();
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.done = !task.done;
        saveTasks();
        renderTasks();
    }
}

function deleteTask(id) {
    if (!confirm('למחוק משימה זו?')) return;
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
}

function renderTasks() {
    const container = document.getElementById('tasksList');
    if (!container) return;
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <div class="empty-title">אין משימות</div>
                <div class="empty-text">הוסף את המשימה הראשונה שלך</div>
            </div>
        `;
        document.getElementById('taskProgress').textContent = '0% הושלמו';
        return;
    }
    
    const completedCount = tasks.filter(t => t.done).length;
    const progress = Math.round((completedCount / tasks.length) * 100);
    
    container.innerHTML = tasks.map(task => `
        <div class="task-item ${task.done ? 'task-done' : ''}">
            <input type="checkbox" 
                   ${task.done ? 'checked' : ''} 
                   onchange="toggleTask(${task.id})"
                   class="task-checkbox">
            <span class="task-text ${task.done ? 'task-text-done' : ''}">${escapeHtml(task.text)}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteTask(${task.id})">
                <span>🗑️</span>
            </button>
        </div>
    `).join('');
    
    document.getElementById('taskProgress').textContent = `${progress}% הושלמו (${completedCount}/${tasks.length})`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load tasks on init
// ==========================================
// SERVICE WORKER UPDATE CHECKER
// ==========================================

if ('serviceWorker' in navigator) {
    let refreshing = false;
    
    // Check for updates every 60 seconds
    setInterval(() => {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) reg.update();
        });
    }, 60000);
    
    // Listen for new service worker
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        
        console.log('🔄 New version detected! Reloading...');
        
        // Show update message
        const updateMsg = document.createElement('div');
        updateMsg.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            font-weight: bold;
            text-align: center;
        `;
        updateMsg.textContent = '🔄 מעדכן לגרסה חדשה...';
        document.body.appendChild(updateMsg);
        
        setTimeout(() => window.location.reload(), 500);
    });
    
    // Force update on load
    navigator.serviceWorker.ready.then(registration => {
        registration.update();
    });
}

// ==========================================
// INITIALIZE ON LOAD
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    if (document.getElementById('tasksList')) {
        renderTasks();
    }
});

// ==========================================
// AUTO IMPORT FROM BANKS/INSURANCE
// ==========================================

// Check if extension is installed
function checkExtensionInstalled() {
    return new Promise((resolve) => {
        window.postMessage({ type: 'PING_EXTENSION' }, '*');
        
        const timeout = setTimeout(() => {
            resolve(false);
        }, 1000);
        
        window.addEventListener('message', function handler(event) {
            if (event.data.type === 'EXTENSION_PONG') {
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                resolve(true);
            }
        });
    });
}

// Initialize auto import
async function initAutoImport() {
    const statusEl = document.getElementById('extensionStatus');
    
    // Check if extension is installed
    const isInstalled = await checkExtensionInstalled();
    
    if (!isInstalled) {
        statusEl.innerHTML = `
            <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-top: 12px;">
                <p style="margin: 0 0 8px 0; font-weight: bold;">❌ התוסף לא מותקן</p>
                <p style="margin: 0 0 12px 0; font-size: 0.9em;">
                    כדי להשתמש בייבוא אוטומטי, התקן את תוסף Chrome
                </p>
                <a href="#install-extension" style="color: white; text-decoration: underline; font-weight: bold;">
                    📥 הוראות התקנה
                </a>
            </div>
        `;
        return;
    }
    
    // Extension is installed - trigger import
    statusEl.innerHTML = '<p style="margin: 8px 0 0 0;">✅ התוסף מותקן! פותח חלון ייבוא...</p>';
    
    // Send message to extension to start import
    window.postMessage({ 
        type: 'START_AUTO_IMPORT',
        source: 'financial-planner'
    }, '*');
}

// Listen for imported data from extension
window.addEventListener('message', function(event) {
    // Ignore messages from other sources
    if (event.source !== window) return;
    
    if (event.data.type === 'IMPORT_COMPLETE') {
        handleImportedData(event.data.accounts);
    }
});

// Handle imported data
function handleImportedData(accounts) {
    if (!accounts || accounts.length === 0) {
        alert('לא נמצאו חשבונות לייבוא');
        return;
    }
    
    const plan = getCurrentPlan();
    let importedCount = 0;
    
    accounts.forEach(account => {
        // Map account type to our system
        const invType = mapAccountType(account.type);
        
        // Auto-detect sub-tracks from account name
        const subTracks = detectSubTracks(account.name, account.balance);
        
        // Calculate weighted return rate
        const returnRate = subTracks.length > 0 
            ? calculateWeightedReturnFromSubTracks(subTracks)
            : 6; // default
        
        const investment = {
            name: account.name,
            house: account.provider || 'לא מוגדר',
            type: invType,
            tax: TAX_RATES[invType] || 0,
            amount: account.balance || 0,
            monthly: 0, // User can update manually
            returnRate: returnRate,
            feeDeposit: 0,
            feeAnnual: account.managementFee || 0,
            forDream: false,
            include: true,
            gender: 'male', // User can update manually
            subTracks: subTracks
        };
        
        plan.investments.push(investment);
        importedCount++;
    });
    
    saveData();
    renderInvestments();
    
    alert(`✅ יובאו בהצלחה ${importedCount} מסלולים!\n\nבדוק ועדכן את הפרטים במידת הצורך.`);
    
    // Update status
    document.getElementById('extensionStatus').innerHTML = 
        `<p style="margin: 8px 0 0 0;">✅ יובאו ${importedCount} מסלולים בהצלחה!</p>`;
}

// Map account type from scraper to our system
function mapAccountType(scraperType) {
    const mapping = {
        'pension': 'פנסיה',
        'provident': 'קרן השתלמות',
        'investment': 'גמל להשקעה',
        'savings': 'פוליסת חסכון'
    };
    return mapping[scraperType] || 'אחר';
}

// Detect sub-tracks from account name
function detectSubTracks(accountName, totalBalance) {
    const name = accountName.toLowerCase();
    const detectedTracks = [];
    
    // Common investment tracks in Israel
    const trackPatterns = [
        { pattern: 's&p 500', type: 'S&P 500', defaultPercent: 30 },
        { pattern: 'מניות חו"ל', type: 'מדדי מניות חו״ל', defaultPercent: 30 },
        { pattern: 'מניות בארץ', type: 'מדדי מניות בארץ', defaultPercent: 20 },
        { pattern: 'אג"ח', type: 'אג״ח', defaultPercent: 30 },
        { pattern: 'כספית', type: 'קרן כספית', defaultPercent: 10 },
        { pattern: 'נדל"ן', type: 'נדל״ן', defaultPercent: 10 }
    ];
    
    trackPatterns.forEach(track => {
        if (name.includes(track.pattern)) {
            detectedTracks.push({
                type: track.type,
                percent: track.defaultPercent,
                returnRate: SUB_TRACK_DEFAULTS[track.type] || 5
            });
        }
    });
    
    // If nothing detected, return empty (user will set manually)
    return detectedTracks;
}

// Calculate weighted return from sub-tracks
function calculateWeightedReturnFromSubTracks(subTracks) {
    if (!subTracks || subTracks.length === 0) return 6;
    
    const totalPercent = subTracks.reduce((sum, st) => sum + st.percent, 0);
    if (totalPercent === 0) return 6;
    
    const weightedReturn = subTracks.reduce((sum, st) => {
        return sum + (st.returnRate * st.percent / 100);
    }, 0);
    
    return parseFloat(weightedReturn.toFixed(2));
}

// ==========================================
// ROADMAP - PLANNED WITHDRAWALS
// ==========================================

// Withdrawal hierarchy (High tax first, then low, then tax-free)
const WITHDRAWAL_HIERARCHY = [
    { type: 'תיק עצמאי', tax: 25, priority: 1, name: 'תיק עצמאי', blockPension: false },
    { type: 'גמל להשקעה', tax: 25, priority: 2, name: 'גמל להשקעה', blockPension: false },
    { type: 'פוליסת חסכון', tax: 25, priority: 3, name: 'פוליסת חסכון', blockPension: false },
    { type: 'קרן השתלמות', tax: 15, priority: 4, name: 'קרן השתלמות (<6 שנים)', checkYears: true, blockPension: false },
    { type: 'פקדון', tax: 15, priority: 5, name: 'פקדון', blockPension: false },
    { type: 'קרן השתלמות', tax: 0, priority: 6, name: 'קרן השתלמות (6+ שנים)', requireYears: 6, blockPension: false },
    { type: 'קרן כספית', tax: 0, priority: 7, name: 'קרן כספית', blockPension: false },
    { type: 'עו"ש', tax: 0, priority: 8, name: 'עו״ש', blockPension: false },
    { type: 'פנסיה', tax: 999, priority: 999, name: 'פנסיה', blockPension: true } // Blocked!
];

function saveWithdrawal(event) {
    event.preventDefault();
    const plan = getCurrentPlan();
    
    const year = parseInt(document.getElementById('wYear').value);
    const amount = parseFloat(document.getElementById('wAmount').value);
    const goal = document.getElementById('wGoal').value.trim();
    
    if (!plan.withdrawals) {
        plan.withdrawals = [];
    }
    
    const withdrawal = { year, amount, goal };
    
    if (appData.editingWithdrawalIndex >= 0) {
        // Preserve active state when editing
        const existingActive = plan.withdrawals[appData.editingWithdrawalIndex].active;
        withdrawal.active = existingActive;
        
        plan.withdrawals[appData.editingWithdrawalIndex] = withdrawal;
        appData.editingWithdrawalIndex = -1;
        cancelEditWithdrawal();
    } else {
        // New withdrawal - default to active
        withdrawal.active = true;
        plan.withdrawals.push(withdrawal);
    }
    
    clearWithdrawalForm();
    saveData();
    renderWithdrawals();
}

function clearWithdrawalForm() {
    document.getElementById('withdrawalForm').reset();
}

function cancelEditWithdrawal() {
    clearWithdrawalForm();
    appData.editingWithdrawalIndex = -1;
    document.getElementById('btnSaveWithdrawalText').textContent = '➕ הוסף משיכה';
    document.getElementById('btnCancelWithdrawalEdit').style.display = 'none';
}

function editWithdrawal(index) {
    const plan = getCurrentPlan();
    const w = plan.withdrawals[index];
    
    appData.editingWithdrawalIndex = index;
    
    document.getElementById('wYear').value = w.year;
    document.getElementById('wAmount').value = w.amount;
    document.getElementById('wGoal').value = w.goal;
    
    document.getElementById('btnSaveWithdrawalText').textContent = 'עדכן משיכה';
    document.getElementById('btnCancelWithdrawalEdit').style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteWithdrawal(index) {
    if (!confirm('האם למחוק משיכה זו?')) return;
    
    const plan = getCurrentPlan();
    plan.withdrawals.splice(index, 1);
    saveData();
    renderWithdrawals();
}

function renderWithdrawals() {
    const plan = getCurrentPlan();
    if (!plan.withdrawals) plan.withdrawals = [];
    
    // Sort by year
    const sorted = [...plan.withdrawals].sort((a, b) => a.year - b.year);
    
    // Render timeline
    renderTimeline(sorted);
    
    // Render strategies
    renderWithdrawalStrategies(sorted);
}

function renderTimeline(withdrawals) {
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
        const bgColor = isGoal ? 'rgba(59, 130, 246, 0.05)' : 'white';
        
        html += `
            <div style="display: grid; grid-template-columns: 80px 1fr 120px 140px; gap: 12px; align-items: center; margin-bottom: 16px; padding: 16px; background: ${bgColor}; border-radius: 12px; border: 2px solid ${borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="text-align: center;">
                    <div style="font-size: 1.8em; font-weight: bold; color: ${borderColor};">${w.year}</div>
                    <div style="font-size: 0.75em; color: #374151;">בעוד ${yearsFromNow} שנים</div>
                </div>
                <div>
                    <div style="font-size: 1.1em; font-weight: bold; color: #1f2937; margin-bottom: 4px;">
                        ${isGoal ? '🎯 ' : ''}${w.goal}
                    </div>
                    ${isGoal ? '<div style="font-size: 0.8em; color: #3b82f6; margin-bottom: 4px;">← מקושר ליעד</div>' : ''}
                    <div style="font-size: 1.3em; color: ${borderColor}; font-weight: bold;">
                        ${formatCurrency(w.amount)}
                    </div>
                </div>
                <div style="text-align: center;">
                    <label style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; user-select: none;">
                        <input type="checkbox" 
                               id="withdrawal_active_${index}" 
                               ${w.active !== false ? 'checked' : ''} 
                               onchange="toggleWithdrawal(${index})"
                               style="width: 20px; height: 20px; cursor: pointer;">
                        <span style="font-size: 0.8em; color: #374151; white-space: nowrap;">כלול בתחזית</span>
                    </label>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-secondary" onclick="editWithdrawal(${index})" style="padding: 8px 12px; font-size: 0.9em; white-space: nowrap;">
                        ✏️ ערוך
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteWithdrawal(${index})" style="padding: 8px 12px; font-size: 0.9em; white-space: nowrap;">
                        🗑️ מחק
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function renderWithdrawalStrategies(withdrawals) {
    const container = document.getElementById('withdrawalStrategies');
    
    // Filter only active withdrawals
    const activeWithdrawals = withdrawals.filter(w => w.active !== false);
    
    if (activeWithdrawals.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #4b5563;">
                <div style="font-size: 3em; margin-bottom: 16px;">📊</div>
                <div style="font-size: 1.1em;">לא נבחרו משיכות לחישוב</div>
                <div style="font-size: 0.9em; margin-top: 8px; color: #6b7280;">סמן את התיבה "כלול בתחזית" כדי לראות אסטרטגיה</div>
            </div>
        `;
        return;
    }
    
    const plan = getCurrentPlan();
    const currentYear = new Date().getFullYear();
    
    let html = '';
    
    activeWithdrawals.forEach((w, wIndex) => {
        const index = withdrawals.indexOf(w);
        const yearsFromNow = w.year - currentYear;
        const strategy = calculateWithdrawalStrategy(w.amount, yearsFromNow, plan);
        
        html += `
            <div class="card" style="margin-top: 20px; border: 2px solid #f59e0b;">
                <div class="card-header" style="background: rgba(245, 158, 11, 0.1);">
                    <div class="card-title" style="color: #92400e;">
                        <span>🎯</span>
                        <span>${w.year} - ${w.goal} (${formatCurrency(w.amount)})</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" onclick="editWithdrawal(${index})">
                            ✏️ ערוך
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteWithdrawal(${index})">
                            🗑️ מחק
                        </button>
                    </div>
                </div>
                
                <div style="padding: 20px;">
                    <h3 style="margin-bottom: 16px; color: #f59e0b;">📋 אסטרטגיית משיכה מומלצת:</h3>
                    
                    ${strategy.feasible ? `
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                            <strong style="color: #10b981;">✅ ניתן למשוך!</strong>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            ${strategy.steps.map((step, i) => `
                                <div style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px; background: white; border-radius: 8px; border-left: 4px solid ${step.tax > 0 ? '#ef4444' : '#10b981'};">
                                    <div style="width: 30px; font-weight: bold; color: #1f2937;">${i + 1}️⃣</div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: bold; color: #1f2937;">${step.investmentNames || step.source}</div>
                                        <div style="font-size: 0.8em; color: #6b7280; margin-top: 2px;">${step.source}</div>
                                        <div style="font-size: 0.9em; color: #374151; margin-top: 4px;">
                                            משיכה ברוטו: ${formatCurrency(step.amount)}
                                        </div>
                                        <div style="font-size: 0.85em; color: #6b7280; margin-top: 4px;">
                                            קרן: ${formatCurrency(step.principal || 0)} | 
                                            רווח: ${formatCurrency(step.profit || 0)} (${(step.profitRatio || 0).toFixed(1)}%)
                                            ${step.tax > 0 ? ` → מס: ${formatCurrency(step.taxAmount)}` : ' → פטור ממס ✅'}
                                        </div>
                                        ${step.netAmount ? `
                                        <div style="font-size: 0.9em; color: #10b981; margin-top: 4px; font-weight: bold;">
                                            💎 נטו בידך: ${formatCurrency(step.netAmount)}
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                                <div>
                                    <strong style="color: #1f2937;">💵 ברוטו:</strong> 
                                    <div style="color: #3b82f6; font-size: 1.2em; font-weight: bold;">
                                        ${formatCurrency(strategy.totalGross)}
                                    </div>
                                </div>
                                <div>
                                    <strong style="color: #1f2937;">💰 מס:</strong> 
                                    <div style="color: #ef4444; font-size: 1.2em; font-weight: bold;">
                                        ${formatCurrency(strategy.totalTax)}
                                    </div>
                                </div>
                                <div>
                                    <strong style="color: #1f2937;">💎 נטו:</strong> 
                                    <div style="color: #10b981; font-size: 1.2em; font-weight: bold;">
                                        ${formatCurrency(strategy.totalNet)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <h3 style="margin-top: 24px; margin-bottom: 12px; color: #3b82f6;">📊 השפעה על התחזית:</h3>
                        <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                            <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; margin-bottom: 12px;">
                                <strong style="color: #dc2626;">⚠️ השפעה מיידית:</strong>
                                <div style="margin-top: 8px; color: #1f2937;">
                                    לקבל <strong>${formatCurrency(w.amount)} נטו</strong> צריך למשוך <strong>${formatCurrency(strategy.totalGross)} ברוטו</strong>
                                    <div style="margin-top: 4px; font-size: 0.9em; color: #666;">
                                        (קיטון של ${((strategy.totalGross / strategy.availableTotal) * 100).toFixed(1)}% מהתיק)
                                    </div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.95em;">
                                <div style="padding: 12px; background: #f0fdf4; border-radius: 6px;">
                                    <div style="color: #15803d; font-weight: bold; margin-bottom: 4px;">ללא משיכה:</div>
                                    <div style="font-size: 1.3em; color: #10b981; font-weight: bold;">${formatCurrency(strategy.availableTotal)}</div>
                                </div>
                                <div style="padding: 12px; background: #eff6ff; border-radius: 6px;">
                                    <div style="color: #1e40af; font-weight: bold; margin-bottom: 4px;">עם משיכה:</div>
                                    <div style="font-size: 1.3em; color: #3b82f6; font-weight: bold;">${formatCurrency(strategy.availableTotal - strategy.totalGross)}</div>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div style="background: rgba(239, 68, 68, 0.1); padding: 16px; border-radius: 8px;">
                            <strong style="color: #ef4444;">❌ אין מספיק כסף!</strong>
                            <p style="margin-top: 8px;">
                                ב-${w.year} יהיה לך רק ${formatCurrency(strategy.availableTotal)} במקום ${formatCurrency(w.amount)}
                            </p>
                        </div>
                    `}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function calculateWithdrawalStrategy(desiredNetAmount, yearsFromNow, plan) {
    // Get available funds by source WITH principal tracking AND names
    const availableFunds = {};
    const principalByType = {};
    const namesByType = {}; // Track investment names
    
    plan.investments.forEach(inv => {
        if (!inv.include) return;
        if (inv.type === 'פנסיה') return; // Block pension
        
        const futureValue = calculateFV(
            inv.amount, 
            inv.monthly, 
            inv.returnRate, 
            yearsFromNow,
            inv.feeDeposit || 0,
            inv.feeAnnual || 0,
            inv.subTracks
        );
        
        const principal = calculatePrincipal(inv.amount, inv.monthly, yearsFromNow);
        
        if (!availableFunds[inv.type]) {
            availableFunds[inv.type] = 0;
            principalByType[inv.type] = 0;
            namesByType[inv.type] = [];
        }
        availableFunds[inv.type] += futureValue;
        principalByType[inv.type] += principal;
        namesByType[inv.type].push(inv.name);
    });
    
    // Calculate total available
    const availableTotal = Object.values(availableFunds).reduce((sum, v) => sum + v, 0);
    
    // Build withdrawal strategy to reach desired NET amount
    const steps = [];
    let remainingNet = desiredNetAmount;
    let totalGross = 0;
    let totalTax = 0;
    
    // Sort hierarchy by priority (high tax first)
    const sorted = [...WITHDRAWAL_HIERARCHY].sort((a, b) => a.priority - b.priority);
    
    for (const source of sorted) {
        if (remainingNet <= 0.01) break; // Small threshold for floating point
        if (source.blockPension) continue; // Skip pension
        
        const available = availableFunds[source.type] || 0;
        if (available <= 0) continue;
        
        // Calculate profit ratio (Average method)
        const totalValue = availableFunds[source.type];
        const totalPrincipal = principalByType[source.type];
        const totalProfit = totalValue - totalPrincipal;
        const profitRatio = totalProfit / totalValue;
        
        // Calculate effective tax rate (only on profit portion)
        const effectiveTaxRate = profitRatio * (source.tax / 100);
        
        // Special case: Tax-free sources (gross = net)
        let toWithdraw;
        if (source.tax === 0) {
            // No tax - withdraw exact amount needed
            toWithdraw = Math.min(remainingNet, available);
        } else {
            // With tax - calculate gross needed to reach net
            const grossNeeded = remainingNet / (1 - effectiveTaxRate);
            toWithdraw = Math.min(grossNeeded, available);
        }
        
        // Calculate actual amounts
        const profitInWithdrawal = toWithdraw * profitRatio;
        const taxAmount = profitInWithdrawal * (source.tax / 100);
        const netAmount = toWithdraw - taxAmount;
        
        // Get specific investment names for this type
        const investmentNames = namesByType[source.type] || [];
        const namesDisplay = investmentNames.length > 0 
            ? investmentNames.join(', ') 
            : source.name;
        
        steps.push({
            source: source.name,
            investmentNames: namesDisplay, // Specific investment names
            amount: toWithdraw,
            principal: toWithdraw * (1 - profitRatio),
            profit: profitInWithdrawal,
            profitRatio: profitRatio * 100,
            tax: source.tax,
            taxAmount: taxAmount,
            netAmount: netAmount
        });
        
        totalGross += toWithdraw;
        totalTax += taxAmount;
        remainingNet -= netAmount;
    }
    
    // Check if we can reach the desired net amount
    const achievedNet = totalGross - totalTax;
    const feasible = achievedNet >= desiredNetAmount * 0.999; // 0.1% tolerance
    
    if (!feasible || totalGross > availableTotal) {
        return { 
            feasible: false, 
            availableTotal,
            desiredNet: desiredNetAmount,
            achievedNet: achievedNet
        };
    }
    
    return {
        feasible: true,
        steps,
        totalGross: totalGross,
        totalTax: totalTax,
        totalNet: achievedNet,
        desiredNet: desiredNetAmount,
        availableTotal
    };
}

// Initialize editing index
if (!appData.editingWithdrawalIndex) {
    appData.editingWithdrawalIndex = -1;
}


function toggleWithdrawal(index) {
    const plan = getCurrentPlan();
    if (!plan.withdrawals[index]) return;
    
    plan.withdrawals[index].active = document.getElementById(`withdrawal_active_${index}`).checked;
    saveData();
    renderWithdrawals();
}

// ==========================================
// CALCULATE PROJECTIONS WITH WITHDRAWALS
// ==========================================

function calculateProjectionWithWithdrawals(investments, targetYears, withdrawals) {
    const currentYear = new Date().getFullYear();
    
    // Get active withdrawals sorted by year
    const activeWithdrawals = (withdrawals || [])
        .filter(w => w.active !== false && w.year >= currentYear && w.year <= currentYear + targetYears)
        .sort((a, b) => a.year - b.year);
    
    // Initialize portfolio state
    let portfolioByType = {};
    let principalByType = {};
    
    investments.forEach(inv => {
        if (!inv.include) return;
        if (inv.type === 'פנסיה') return; // Don't include pension in withdrawable portfolio
        
        if (!portfolioByType[inv.type]) {
            portfolioByType[inv.type] = [];
            principalByType[inv.type] = 0;
        }
        
        portfolioByType[inv.type].push({
            amount: inv.amount,
            monthly: inv.monthly,
            returnRate: inv.returnRate,
            feeDeposit: inv.feeDeposit || 0,
            feeAnnual: inv.feeAnnual || 0,
            subTracks: inv.subTracks
        });
        
        principalByType[inv.type] += inv.amount;
    });
    
    // Simulate year by year
    let totalWithdrawn = 0;
    let totalTaxPaid = 0;
    
    for (let year = 0; year <= targetYears; year++) {
        const currentYearNum = currentYear + year;
        
        // Check if there's a withdrawal this year
        const withdrawal = activeWithdrawals.find(w => w.year === currentYearNum);
        
        if (withdrawal) {
            // Calculate withdrawal strategy
            const strategy = calculateWithdrawalStrategyFromState(
                withdrawal.amount, 
                portfolioByType, 
                principalByType
            );
            
            if (strategy.feasible) {
                // Execute withdrawal
                strategy.steps.forEach(step => {
                    // Find the type and reduce it
                    const typeKey = WITHDRAWAL_HIERARCHY.find(h => h.name === step.source)?.type;
                    if (typeKey && portfolioByType[typeKey]) {
                        // Reduce proportionally from all investments of this type
                        const totalInType = portfolioByType[typeKey].reduce((sum, inv) => {
                            return sum + inv.amount; // inv.amount is already current value
                        }, 0);
                        
                        portfolioByType[typeKey].forEach(inv => {
                            const currentValue = inv.amount; // Use direct amount
                            const proportion = totalInType > 0 ? currentValue / totalInType : 0;
                            const amountToReduce = step.amount * proportion;
                            
                            // Reduce by the withdrawal amount
                            inv.amount = Math.max(0, currentValue - amountToReduce);
                            inv.monthly = 0; // Stop monthly deposits after withdrawal
                        });
                        
                        principalByType[typeKey] = Math.max(0, principalByType[typeKey] - step.principal);
                    }
                });
                
                totalWithdrawn += strategy.totalGross;
                totalTaxPaid += strategy.totalTax;
            }
        }
        
        // Grow portfolio for one year (if not at target)
        if (year < targetYears) {
            Object.keys(portfolioByType).forEach(type => {
                portfolioByType[type].forEach(inv => {
                    // inv.amount is already the current value (after any withdrawals)
                    // Just grow it for 1 year
                    inv.amount = calculateFV(inv.amount, inv.monthly, inv.returnRate, 1,
                                            inv.feeDeposit, inv.feeAnnual, inv.subTracks);
                    principalByType[type] += inv.monthly * 12;
                });
            });
        }
    }
    
    // Calculate final values
    let finalNominal = 0;
    let finalPrincipal = 0;
    
    Object.keys(portfolioByType).forEach(type => {
        portfolioByType[type].forEach(inv => {
            // inv.amount is already the final value after all years and withdrawals
            finalNominal += inv.amount;
        });
        finalPrincipal += principalByType[type];
    });
    
    return {
        finalNominal,
        finalPrincipal,
        totalWithdrawn,
        totalTaxPaid,
        netWithdrawn: totalWithdrawn - totalTaxPaid
    };
}

function calculateCurrentValue(inv, yearsElapsed) {
    return calculateFV(inv.amount, inv.monthly, inv.returnRate, yearsElapsed,
                      inv.feeDeposit, inv.feeAnnual, inv.subTracks);
}

function calculateWithdrawalStrategyFromState(desiredNet, portfolioByType, principalByType) {
    // Similar to calculateWithdrawalStrategy but works with portfolio state
    const availableFunds = {};
    
    Object.keys(portfolioByType).forEach(type => {
        availableFunds[type] = portfolioByType[type].reduce((sum, inv) => {
            return sum + calculateCurrentValue(inv, 0);
        }, 0);
    });
    
    const availableTotal = Object.values(availableFunds).reduce((sum, v) => sum + v, 0);
    
    // Build withdrawal strategy
    const steps = [];
    let remainingNet = desiredNet;
    let totalGross = 0;
    let totalTax = 0;
    
    const sorted = [...WITHDRAWAL_HIERARCHY].sort((a, b) => a.priority - b.priority);
    
    for (const source of sorted) {
        if (remainingNet <= 0.01) break;
        if (source.blockPension) continue;
        
        const available = availableFunds[source.type] || 0;
        if (available <= 0) continue;
        
        const totalValue = availableFunds[source.type];
        const totalPrincipal = principalByType[source.type] || 0;
        const totalProfit = Math.max(0, totalValue - totalPrincipal);
        const profitRatio = totalValue > 0 ? totalProfit / totalValue : 0;
        
        const effectiveTaxRate = profitRatio * (source.tax / 100);
        const grossNeeded = remainingNet / (1 - effectiveTaxRate);
        const toWithdraw = Math.min(grossNeeded, available);
        
        const profitInWithdrawal = toWithdraw * profitRatio;
        const taxAmount = profitInWithdrawal * (source.tax / 100);
        const netAmount = toWithdraw - taxAmount;
        
        steps.push({
            source: source.name,
            amount: toWithdraw,
            principal: toWithdraw * (1 - profitRatio),
            profit: profitInWithdrawal,
            tax: source.tax,
            taxAmount: taxAmount,
            netAmount: netAmount
        });
        
        totalGross += toWithdraw;
        totalTax += taxAmount;
        remainingNet -= netAmount;
    }
    
    const achievedNet = totalGross - totalTax;
    const feasible = achievedNet >= desiredNet * 0.999;
    
    return {
        feasible,
        steps,
        totalGross,
        totalTax,
        totalNet: achievedNet
    };
}


// ==========================================
// PENSION TAB FUNCTIONS
// ==========================================

function renderPensionTab() {
    const plan = getCurrentPlan();
    
    // Separate pensions by spouse
    const husbandPensions = [];
    const wifePensions = [];
    const unknownPensions = [];
    
    plan.investments.forEach(inv => {
        if (!inv.include || inv.type !== 'פנסיה') return;
        
        if (inv.spouse === 'husband') {
            husbandPensions.push(inv);
        } else if (inv.spouse === 'wife') {
            wifePensions.push(inv);
        } else {
            // Backward compatibility - use gender if spouse not set
            if (inv.gender === 'male') {
                husbandPensions.push(inv);
            } else if (inv.gender === 'female') {
                wifePensions.push(inv);
            } else {
                unknownPensions.push(inv);
            }
        }
    });
    
    // Render husband's pensions
    renderPensionList('pensionHusband', husbandPensions, 'male');
    
    // Render wife's pensions
    renderPensionList('pensionWife', wifePensions, 'female');
    
    // Calculate monthly pensions
    calculateMonthlyPensions(husbandPensions, wifePensions);
    
    // Populate simulator dropdown
    populatePensionSimulator([...husbandPensions, ...wifePensions, ...unknownPensions]);
}

function renderPensionList(containerId, pensions, gender) {
    const container = document.getElementById(containerId);
    
    if (pensions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">אין קופות פנסיה</div></div>';
        return;
    }
    
    const years = parseInt(document.getElementById('pensionYears') && document.getElementById('pensionYears').value) || 20;
    const currentYear = new Date().getFullYear();
    
    let html = '';
    pensions.forEach((inv, index) => {
        const futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                       inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        const monthlyPension = calculateMonthlyPension(futureValue, gender);
        
        html += `
            <div class="item-card">
                <div style="display: flex; justify-content: between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 1.1em; color: #1f2937;">${inv.name}</div>
                        <div style="font-size: 0.9em; color: #666; margin-top: 4px;">${inv.house}</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                    <div>
                        <div style="font-size: 0.85em; color: #666;">יתרה היום</div>
                        <div style="font-weight: bold; color: #3b82f6;">${formatCurrency(inv.amount)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85em; color: #666;">הפקדה חודשית</div>
                        <div style="font-weight: bold; color: #10b981;">${formatCurrency(inv.monthly)}</div>
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                    <div style="font-size: 0.85em; color: #666;">צפי ב-${currentYear + years}</div>
                    <div style="font-weight: bold; font-size: 1.2em; color: #10b981;">${formatCurrency(futureValue)}</div>
                    <div style="font-size: 0.9em; color: #3b82f6; margin-top: 4px;">
                        קצבה חודשית: ${formatCurrency(monthlyPension)}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function calculateMonthlyPensions(husbandPensions, wifePensions) {
    const years = parseInt(document.getElementById('pensionYears') && document.getElementById('pensionYears').value) || 20;
    
    let husbandTotalNominal = 0;
    let wifeTotalNominal = 0;
    
    husbandPensions.forEach(inv => {
        const futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                       inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        husbandTotalNominal += calculateMonthlyPension(futureValue, 'male');
    });
    
    wifePensions.forEach(inv => {
        const futureValue = calculateFV(inv.amount, inv.monthly, inv.returnRate, years,
                                       inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        wifeTotalNominal += calculateMonthlyPension(futureValue, 'female');
    });
    
    // Calculate real values (purchasing power in today's terms)
    const INFLATION_RATE = 0.02;
    const inflationFactor = Math.pow(1 + INFLATION_RATE, years);
    const husbandTotalReal = husbandTotalNominal / inflationFactor;
    const wifeTotalReal = wifeTotalNominal / inflationFactor;
    
    // Calculate net amounts (from nominal)
    const husbandNet = calculateNetPension(husbandTotalNominal);
    const wifeNet = calculateNetPension(wifeTotalNominal);
    const combinedNominal = husbandTotalNominal + wifeTotalNominal;
    const combinedReal = husbandTotalReal + wifeTotalReal;
    const combinedNet = calculateNetPension(combinedNominal);
    
    // Display nominal
    document.getElementById('pensionHusbandNominal').textContent = formatCurrency(husbandTotalNominal);
    document.getElementById('pensionWifeNominal').textContent = formatCurrency(wifeTotalNominal);
    document.getElementById('pensionCombinedNominal').textContent = formatCurrency(combinedNominal);
    
    // Display real
    document.getElementById('pensionHusbandReal').textContent = formatCurrency(husbandTotalReal);
    document.getElementById('pensionWifeReal').textContent = formatCurrency(wifeTotalReal);
    document.getElementById('pensionCombinedReal').textContent = formatCurrency(combinedReal);
    
    // Display net
    document.getElementById('pensionHusbandNet').textContent = formatCurrency(husbandNet.net);
    document.getElementById('pensionWifeNet').textContent = formatCurrency(wifeNet.net);
    document.getElementById('pensionCombinedNet').textContent = formatCurrency(combinedNet.net);
    
    // Display tax info
    if (husbandNet.tax > 0) {
        document.getElementById('pensionHusbandTax').textContent = `מס: ${formatCurrency(husbandNet.tax)} (${husbandNet.effectiveRate.toFixed(1)}%)`;
    } else {
        document.getElementById('pensionHusbandTax').textContent = '✅ פטור ממס';
    }
    
    if (wifeNet.tax > 0) {
        document.getElementById('pensionWifeTax').textContent = `מס: ${formatCurrency(wifeNet.tax)} (${wifeNet.effectiveRate.toFixed(1)}%)`;
    } else {
        document.getElementById('pensionWifeTax').textContent = '✅ פטור ממס';
    }
    
    if (combinedNet.tax > 0) {
        document.getElementById('pensionCombinedTax').textContent = `מס: ${formatCurrency(combinedNet.tax)}/חודש (${combinedNet.effectiveRate.toFixed(1)}%)`;
    } else {
        document.getElementById('pensionCombinedTax').textContent = '✅ פטור מלא ממס - פטור מזכה + נקודות זיכוי';
    }
}

function populatePensionSimulator(pensions) {
    const plan = getCurrentPlan();
    const select = document.getElementById('pensionSimSelect');
    
    let html = '<option value="">בחר קופה...</option>';
    pensions.forEach((inv) => {
        // Find the ACTUAL index in plan.investments
        const actualIndex = plan.investments.findIndex(i => 
            i.type === 'פנסיה' && 
            i.name === inv.name && 
            i.house === inv.house &&
            i.amount === inv.amount
        );
        
        // Use spouse field, fallback to gender for backward compatibility
        let label = '👤';
        if (inv.spouse === 'husband' || (!inv.spouse && inv.gender === 'male')) {
            label = '👨 בעל';
        } else if (inv.spouse === 'wife' || (!inv.spouse && inv.gender === 'female')) {
            label = '👩 אשה';
        }
        
        html += `<option value="${actualIndex}">${label}: ${inv.name} - ${inv.house}</option>`;
    });
    
    select.innerHTML = html;
}

function simulatePensionWithdrawal() {
    const plan = getCurrentPlan();
    const investmentIndex = parseInt(document.getElementById('pensionSimSelect').value);
    const withdrawalAge = parseInt(document.getElementById('pensionSimAge').value);
    const resultDiv = document.getElementById('pensionSimResult');
    
    if (isNaN(investmentIndex) || isNaN(withdrawalAge)) {
        resultDiv.innerHTML = '<div class="alert alert-danger">נא למלא את כל השדות</div>';
        return;
    }
    
    // Get pension directly from plan.investments using the actual index
    const pension = plan.investments[investmentIndex];
    
    if (!pension || pension.type !== 'פנסיה' || !pension.age) {
        resultDiv.innerHTML = '<div class="alert alert-danger">לא נמצאה קופה או חסר גיל נוכחי</div>';
        return;
    }
    
    const years = withdrawalAge - pension.age;
    if (years < 0) {
        resultDiv.innerHTML = '<div class="alert alert-danger">גיל המשיכה חייב להיות גדול מהגיל הנוכחי</div>';
        return;
    }
    
    const futureValue = calculateFV(pension.amount, pension.monthly, pension.returnRate, years,
                                    pension.feeDeposit || 0, pension.feeAnnual || 0, pension.subTracks);
    const monthlyPension = calculateMonthlyPension(futureValue, pension.gender);
    const retirementAge = pension.gender === 'female' ? 62 : 67;
    const isEarly = withdrawalAge < retirementAge;
    
    resultDiv.innerHTML = `
        <div class="card" style="background: ${isEarly ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; border: 2px solid ${isEarly ? '#ef4444' : '#10b981'};">
            <h4 style="margin-top: 0; color: ${isEarly ? '#dc2626' : '#059669'};">
                ${isEarly ? '⚠️ משיכה מוקדמת' : '✅ משיכה בגיל פרישה'}
            </h4>
            
            <div style="display: grid; gap: 12px;">
                <div>
                    <div style="font-size: 0.9em; color: #666;">יתרה צפויה בגיל ${withdrawalAge}</div>
                    <div style="font-size: 1.5em; font-weight: bold; color: #1f2937;">${formatCurrency(futureValue)}</div>
                </div>
                
                <div>
                    <div style="font-size: 0.9em; color: #666;">קצבה חודשית</div>
                    <div style="font-size: 1.3em; font-weight: bold; color: #3b82f6;">${formatCurrency(monthlyPension)}</div>
                </div>
                
                ${isEarly ? `
                <div style="padding: 12px; background: white; border-radius: 8px; border-right: 4px solid #ef4444;">
                    <strong style="color: #dc2626;">שים לב:</strong>
                    <div style="font-size: 0.9em; color: #666; margin-top: 4px;">
                        משיכה לפני גיל ${retirementAge} עלולה לכלול קנסות ומיסוי מוגבר
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}


// Calculate net monthly pension after tax
function calculateNetPension(grossMonthly) {
    // Pension tax with 67% exemption (Ptor Mazke)
    const PTOR_MAZKE_RATE = 0.67;
    const PTOR_MAZKE_CEILING = 9430; // Monthly ceiling
    const CREDIT_POINTS = 2.25;
    const CREDIT_VALUE_PER_POINT = 2736; // 2024 value
    
    // 1. Apply Ptor Mazke (67% exemption)
    const exemptionBase = Math.min(grossMonthly, PTOR_MAZKE_CEILING);
    const exemptionAmount = exemptionBase * PTOR_MAZKE_RATE;
    
    // 2. Taxable income after exemption
    let taxableIncome = Math.max(0, grossMonthly - exemptionAmount);
    
    // 3. Apply credit points
    const creditAmount = CREDIT_POINTS * CREDIT_VALUE_PER_POINT;
    taxableIncome = Math.max(0, taxableIncome - creditAmount);
    
    if (taxableIncome <= 0) {
        return {
            gross: grossMonthly,
            tax: 0,
            net: grossMonthly,
            exemption: exemptionAmount,
            creditPoints: creditAmount,
            effectiveRate: 0
        };
    }
    
    // 4. Calculate tax by brackets
    const TAX_BRACKETS = [
        { max: 7010, rate: 0.10 },
        { max: 10060, rate: 0.14 },
        { max: 14530, rate: 0.20 },
        { max: 20200, rate: 0.31 },
        { max: 42030, rate: 0.35 },
        { max: 55270, rate: 0.47 },
        { max: Infinity, rate: 0.50 }
    ];
    
    let tax = 0;
    let remainingIncome = taxableIncome;
    let previousMax = 0;
    
    for (const bracket of TAX_BRACKETS) {
        const bracketSize = bracket.max - previousMax;
        const amountInBracket = Math.min(remainingIncome, bracketSize);
        
        if (amountInBracket <= 0) break;
        
        tax += amountInBracket * bracket.rate;
        remainingIncome -= amountInBracket;
        previousMax = bracket.max;
        
        if (remainingIncome <= 0) break;
    }
    
    const net = grossMonthly - tax;
    const effectiveRate = (tax / grossMonthly) * 100;
    
    return {
        gross: grossMonthly,
        tax,
        net,
        exemption: exemptionAmount,
        creditPoints: creditAmount,
        effectiveRate
    };
}


function renamePlan() {
    const currentPlanId = appData.currentPlanId;
    const plan = appData.plans.find(p => p.id === currentPlanId);
    
    if (!plan) {
        alert('אנא בחר תוכנית תחילה');
        return;
    }
    
    const newName = prompt('שם חדש לתוכנית:', plan.name);
    if (!newName || newName.trim() === '') return;
    
    plan.name = newName.trim();
    saveData();
    updatePlanSelector();
}


function generateReport() {
    const plan = getCurrentPlan();
    
    if (!plan || !plan.investments) {
        alert('שגיאה: לא נמצאה תוכנית או השקעות');
        return;
    }
    
    if (plan.investments.length === 0) {
        alert('⚠️ אין מסלולי השקעה להציג בדוח.\nאנא הוסף השקעות תחילה.');
        return;
    }
    
    const years = parseInt(document.getElementById('sumYears') && document.getElementById('sumYears').value) || 20;
    
    // Calculate totals
    const totalToday = plan.investments
        .filter(inv => inv.include && inv.type !== 'פנסיה')
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    const projection = calculateProjectionWithWithdrawals(plan.investments, years, plan.withdrawals || []);
    
    // Calculate averages
    const equityInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalAmount = equityInvs.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const avgFeeAnnual = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeAnnual || 0)), 0) / totalAmount : 0;
    const avgFeeDeposit = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeDeposit || 0)), 0) / totalAmount : 0;
    const avgReturn = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.returnRate || 0)), 0) / totalAmount : 0;
    
    const totalReal = calculateRealValue(projection.finalNominal, years);
    
    // Breakdown
    const breakdown = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה').map(inv => {
        const nominal = calculateFV(inv.amount, inv.monthly, inv.returnRate, years, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        const principal = calculatePrincipal(inv.amount, inv.monthly, years);
        return {
            name: inv.name,
            house: inv.house,
            today: inv.amount,
            monthly: inv.monthly,
            future: nominal,
            profit: nominal - principal
        };
    });
    
    // Build HTML
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>דוח פיננסי</title>');
    reportWindow.document.write('<style>body{font-family:Arial;padding:40px;background:#f9fafb}');
    reportWindow.document.write('.container{max-width:1200px;margin:0 auto;background:white;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}');
    reportWindow.document.write('h1{color:#1f2937;font-size:2.5em;border-bottom:4px solid #3b82f6;padding-bottom:16px;margin-bottom:24px}');
    reportWindow.document.write('h2{color:#3b82f6;font-size:1.8em;margin:32px 0 16px;padding-right:12px;border-right:4px solid #3b82f6}');
    reportWindow.document.write('.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0}');
    reportWindow.document.write('.summary-card{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:12px}');
    reportWindow.document.write('.summary-card-title{font-size:0.9em;opacity:0.9;margin-bottom:8px}');
    reportWindow.document.write('.summary-card-value{font-size:1.8em;font-weight:bold}');
    reportWindow.document.write('table{width:100%;border-collapse:collapse;margin:20px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1)}');
    reportWindow.document.write('th{background:#3b82f6;color:white;padding:14px;text-align:right;font-weight:600}');
    reportWindow.document.write('td{padding:12px 14px;border-bottom:1px solid #e5e7eb}');
    reportWindow.document.write('tr:hover{background:#f3f4f6}.profit{color:#10b981;font-weight:bold}');
    reportWindow.document.write('.print-btn{position:fixed;bottom:30px;left:30px;background:#3b82f6;color:white;border:none;padding:16px 24px;border-radius:12px;font-size:1.1em;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.4);z-index:1000}');
    reportWindow.document.write('.print-btn:hover{background:#2563eb}@media print{.print-btn{display:none}}</style></head><body>');
    
    reportWindow.document.write('<div class="container">');
    reportWindow.document.write('<h1>📊 דוח פיננסי מסכם</h1>');
    reportWindow.document.write('<p style="color:#6b7280;margin-bottom:32px">תוכנית: ' + plan.name + ' | תאריך: ' + new Date().toLocaleDateString('he-IL') + '</p>');
    
    reportWindow.document.write('<h2>💰 מצב נוכחי</h2>');
    reportWindow.document.write('<div class="summary-grid">');
    reportWindow.document.write('<div class="summary-card"><div class="summary-card-title">הון עצמי היום</div><div class="summary-card-value">' + formatCurrency(totalToday) + '</div></div>');
    reportWindow.document.write('<div class="summary-card"><div class="summary-card-title">תחזית בעוד ' + years + ' שנים (נומינלי)</div><div class="summary-card-value">' + formatCurrency(projection.finalNominal) + '</div></div>');
    reportWindow.document.write('<div class="summary-card"><div class="summary-card-title">תחזית (ריאלי - כוח קנייה)</div><div class="summary-card-value">' + formatCurrency(totalReal) + '</div></div>');
    reportWindow.document.write('</div>');
    
    reportWindow.document.write('<h2>📈 ממוצעים משוקללים</h2>');
    reportWindow.document.write('<div class="summary-grid">');
    reportWindow.document.write('<div class="summary-card"><div class="summary-card-title">ממוצע תשואה שנתית</div><div class="summary-card-value">' + avgReturn.toFixed(2) + '%</div></div>');
    reportWindow.document.write('<div class="summary-card"><div class="summary-card-title">ממוצע דמי ניהול - צבירה</div><div class="summary-card-value">' + avgFeeAnnual.toFixed(2) + '%</div></div>');
    reportWindow.document.write('<div class="summary-card"><div class="summary-card-title">ממוצע דמי ניהול - הפקדה</div><div class="summary-card-value">' + avgFeeDeposit.toFixed(2) + '%</div></div>');
    reportWindow.document.write('</div>');
    
    reportWindow.document.write('<h2>📋 פירוט מסלולי השקעה</h2>');
    reportWindow.document.write('<table><thead><tr><th>שם</th><th>בית השקעות</th><th>סכום היום</th><th>הפקדה חודשית</th><th>תחזית (' + years + ' שנים)</th><th>רווח צפוי</th></tr></thead><tbody>');
    
    breakdown.forEach(item => {
        reportWindow.document.write('<tr>');
        reportWindow.document.write('<td><strong>' + item.name + '</strong></td>');
        reportWindow.document.write('<td>' + item.house + '</td>');
        reportWindow.document.write('<td>' + formatCurrency(item.today) + '</td>');
        reportWindow.document.write('<td>' + formatCurrency(item.monthly) + '/חודש</td>');
        reportWindow.document.write('<td>' + formatCurrency(item.future) + '</td>');
        reportWindow.document.write('<td class="profit">' + formatCurrency(item.profit) + '</td>');
        reportWindow.document.write('</tr>');
    });
    
    const totalMonthly = equityInvs.reduce((s, i) => s + (i.monthly || 0), 0);
    reportWindow.document.write('<tr style="background:#f3f4f6;font-weight:bold">');
    reportWindow.document.write('<td colspan="2">סה"כ</td>');
    reportWindow.document.write('<td>' + formatCurrency(totalToday) + '</td>');
    reportWindow.document.write('<td>' + formatCurrency(totalMonthly) + '/חודש</td>');
    reportWindow.document.write('<td>' + formatCurrency(projection.finalNominal) + '</td>');
    reportWindow.document.write('<td class="profit">' + formatCurrency(projection.finalNominal - projection.finalPrincipal) + '</td>');
    reportWindow.document.write('</tr></tbody></table>');
    
    if (plan.withdrawals && plan.withdrawals.length > 0) {
        const activeWithdrawals = plan.withdrawals.filter(w => w.active !== false).sort((a, b) => a.year - b.year);
        if (activeWithdrawals.length > 0) {
            reportWindow.document.write('<h2>🗓️ מפת דרכים - משיכות מתוכננות</h2>');
            reportWindow.document.write('<table><thead><tr><th>שנה</th><th>מטרה</th><th>סכום</th><th>סטטוס</th></tr></thead><tbody>');
            activeWithdrawals.forEach(w => {
                reportWindow.document.write('<tr>');
                reportWindow.document.write('<td><strong>' + w.year + '</strong></td>');
                reportWindow.document.write('<td>' + (w.goalId ? '🎯 ' : '') + w.goal + '</td>');
                reportWindow.document.write('<td style="color:#f59e0b;font-weight:bold">' + formatCurrency(w.amount) + '</td>');
                reportWindow.document.write('<td>' + (w.goalId ? 'מקושר ליעד' : 'משיכה ידנית') + '</td>');
                reportWindow.document.write('</tr>');
            });
            reportWindow.document.write('</tbody></table>');
        }
    }
    
    reportWindow.document.write('<p style="margin-top:40px;padding-top:20px;border-top:2px solid #e5e7eb;color:#6b7280;text-align:center">');
    reportWindow.document.write('נוצר באמצעות מתכנן פיננסי v40 | ' + new Date().toLocaleDateString('he-IL') + ' ' + new Date().toLocaleTimeString('he-IL'));
    reportWindow.document.write('</p></div>');
    reportWindow.document.write('<button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור PDF</button>');
    reportWindow.document.write('</body></html>');
    reportWindow.document.close();
}
function updateMaritalStatus() {
    const status = document.querySelector('input[name="maritalStatus"]:checked').value;
    getCurrentPlan().profile.maritalStatus = status;
    
    // Show/hide spouse section
    document.getElementById('spouseSection').style.display = 
        status === 'married' ? 'block' : 'none';
    
    saveData();
}

function addChild() {
    const name = prompt('שם הילד/ה:');
    if (!name || name.trim() === '') return;
    
    const ageStr = prompt('גיל הילד/ה:');
    const age = parseInt(ageStr);
    if (isNaN(age) || age < 0 || age > 30) {
        alert('גיל לא תקין');
        return;
    }
    
    const currentYear = new Date().getFullYear();
    const child = {
        id: `child_${Date.now()}`,
        name: name.trim(),
        age,
        birthYear: currentYear - age
    };
    
   getCurrentPlan().profile.children.push(child);
    saveData();
    renderChildren();
}

function deleteChild(index) {
    if (!confirm('האם למחוק את הילד/ה?')) return;
    
    getCurrentPlan().profile.children.splice(index, 1);
    saveData();
    renderChildren();
}

function editChild(index) {
    const child = getCurrentPlan().profile.children[index];
    
    const name = prompt('שם הילד/ה:', child.name);
    if (!name || name.trim() === '') return;
    
    const ageStr = prompt('גיל הילד/ה:', child.age);
    const age = parseInt(ageStr);
    if (isNaN(age) || age < 0 || age > 30) {
        alert('גיל לא תקין');
        return;
    }
    
    const currentYear = new Date().getFullYear();
    child.name = name.trim();
    child.age = age;
    child.birthYear = currentYear - age;
    
    saveData();
    renderChildren();
}

function renderChildren() {
    const container = document.getElementById('childrenList');
    if (!container) return; // Container not loaded yet
    
    const children = getCurrentPlan().profile.children;
    
    if (children.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">לא הוגדרו ילדים</div></div>';
        return;
    }
    
    let html = '<div style="display: grid; gap: 12px;">';
    children.forEach((child, index) => {
        html += `
            <div class="item-card" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: bold; font-size: 1.1em;">${child.name}</div>
                    <div style="font-size: 0.9em; color: #666;">גיל ${child.age} (נולד ב-${child.birthYear})</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-primary" onclick="editChild(${index})">
                        ✏️ ערוך
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteChild(${index})">
                        🗑️ מחק
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function loadProfile() {
    const profile = getCurrentPlan().profile;
    
    // Marital status
    const statusRadio = document.querySelector(`input[name="maritalStatus"][value="${profile.maritalStatus}"]`);
    if (statusRadio) statusRadio.checked = true;
    
    // User
    document.getElementById('userName').value = profile.user.name || '';
    document.getElementById('userAge').value = profile.user.age || '';
    document.getElementById('userGender').value = profile.user.gender || 'male';
    
    // Spouse
    document.getElementById('spouseName').value = profile.spouse.name || '';
    document.getElementById('spouseAge').value = profile.spouse.age || '';
    document.getElementById('spouseGender').value = profile.spouse.gender || 'female';
    
    // Update visibility
    updateMaritalStatus();
    
    // Children
    renderChildren();
}

function saveProfile() {
    const profile = getCurrentPlan().profile;
    
    // User
    profile.user.name = document.getElementById('userName').value.trim();
    profile.user.age = parseInt(document.getElementById('userAge').value) || null;
    profile.user.gender = document.getElementById('userGender').value;
    
    // Spouse (if married)
    if (profile.maritalStatus === 'married') {
        profile.spouse.name = document.getElementById('spouseName').value.trim();
        profile.spouse.age = parseInt(document.getElementById('spouseAge').value) || null;
        profile.spouse.gender = document.getElementById('spouseGender').value;
    }
    
    // Validate
    if (!profile.user.name) {
        alert('נא להזין שם');
        return;
    }
    
    if (!profile.user.age || profile.user.age < 18 || profile.user.age > 120) {
        alert('נא להזין גיל תקין (18-120)');
        return;
    }
    
    if (profile.maritalStatus === 'married') {
        if (!profile.spouse.name) {
            alert('נא להזין שם בן/בת הזוג');
            return;
        }
        if (!profile.spouse.age || profile.spouse.age < 18 || profile.spouse.age > 120) {
            alert('נא להזין גיל תקין לבן/בת הזוג (18-120)');
            return;
        }
    }
    
    saveData();
    showSaveNotification('✅ הפרופיל נשמר בהצלחה!');
};




// ==========================================
// GOALS MANAGEMENT
// ==========================================

// Goals initialized in appData declaration above

function loadGoals() {
     goals = getCurrentPlan().goals;
    const profile = getCurrentPlan().profile;
    
    // Retirement
    document.getElementById('goalRetirementAgeUser').value = goals.retirement.userAge || '';
    document.getElementById('goalRetirementAgeSpouse').value = goals.retirement.spouseAge || '';
    document.getElementById('goalMonthlyPension').value = goals.retirement.monthlyPension || '';
    document.getElementById('goalPensionIsReal').checked = goals.retirement.isRealValue !== false;
    
    // Show/hide spouse retirement based on marital status
    if (profile.maritalStatus === 'single') {
        document.getElementById('goalSpouseRetirementGroup').style.display = 'none';
    } else {
        document.getElementById('goalSpouseRetirementGroup').style.display = 'block';
    }
    
    // Equity
    document.getElementById('goalEquityAmount').value = goals.equity.targetAmount || '';
    document.getElementById('goalEquityYear').value = goals.equity.targetYear || '';
    document.getElementById('goalEquityIsReal').checked = goals.equity.isRealValue !== false;
    
    // Life goals
}

function addLifeGoal() {
    const name = prompt('שם היעד:');
    if (!name || name.trim() === '') return;
    
    const amountStr = prompt('סכום (₪):');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert('סכום לא תקין');
        return;
    }
    
    const yearStr = prompt('שנת יעד:');
    const year = parseInt(yearStr);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < currentYear || year > 2100) {
        alert('שנה לא תקינה');
        return;
    }
    
    const goal = {
        id: `goal_${Date.now()}`,
        name: name.trim(),
        amount,
        year,
        isRealValue: true,
        priority: 'medium'
    };
    
    getCurrentPlan().goals.lifeGoals.push(goal);
    saveData();
    syncLifeGoalsToRoadmap();
    renderLifeGoals();
    renderWithdrawals();  // ← הוספתי!
    showSaveNotification('✅ היעד נוסף ונשמר במפת דרכים!');
}

function removeLifeGoal(index) {
    if (!confirm('האם למחוק יעד זה?')) return;
    
    getCurrentPlan().goals.lifeGoals.splice(index, 1);
    saveData();
    syncLifeGoalsToRoadmap();
    renderLifeGoals();
    renderWithdrawals();  // ← הוספתי!
    showSaveNotification('✅ היעד נמחק מהיעדים ומהמפת דרכים');
}

function renderLifeGoals() {
    const container = document.getElementById('lifeGoalsList');
    if (!container) return;
    
    const goals = getCurrentPlan().goals.lifeGoals;
    
    if (goals.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">לא הוגדרו יעדים</div></div>';
        return;
    }
    
    let html = '<div style="display: grid; gap: 12px;">';
    goals.forEach((goal, index) => {
        const yearsUntil = goal.year - new Date().getFullYear();
        html += `
            <div class="item-card" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 1.1em;">${goal.name}</div>
                    <div style="font-size: 0.9em; color: #666;">
                        ${formatCurrency(goal.amount)} ב-${goal.year} (בעוד ${yearsUntil} שנים)
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-primary" onclick="editLifeGoal(${index})">
                        ✏️ ערוך
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="removeLifeGoal(${index})">
                        🗑️ מחק
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function editLifeGoal(index) {
    const goal = getCurrentPlan().goals.lifeGoals[index];
    
    const name = prompt('שם היעד:', goal.name);
    if (!name || name.trim() === '') return;
    
    const amountStr = prompt('סכום (₪):', goal.amount);
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert('סכום לא תקין');
        return;
    }
    
    const yearStr = prompt('שנת יעד:', goal.year);
    const year = parseInt(yearStr);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < currentYear || year > 2100) {
        alert('שנה לא תקינה');
        return;
    }
    
    // Update goal
    goal.name = name.trim();
    goal.amount = amount;
    goal.year = year;
    
    saveData();
    syncLifeGoalsToRoadmap();
    renderLifeGoals();
    renderWithdrawals();  // ← הוספתי!
    showSaveNotification('✅ היעד עודכן בהצלחה!');
}

function saveGoals() {
     goals = getCurrentPlan().goals;
    
    // Retirement
    goals.retirement.userAge = parseInt(document.getElementById('goalRetirementAgeUser').value) || null;
    goals.retirement.spouseAge = parseInt(document.getElementById('goalRetirementAgeSpouse').value) || null;
    goals.retirement.monthlyPension = parseFloat(document.getElementById('goalMonthlyPension').value) || null;
    goals.retirement.isRealValue = document.getElementById('goalPensionIsReal').checked;
    
    // Equity
    goals.equity.targetAmount = parseFloat(document.getElementById('goalEquityAmount').value) || null;
    goals.equity.targetYear = parseInt(document.getElementById('goalEquityYear').value) || null;
    goals.equity.isRealValue = document.getElementById('goalEquityIsReal').checked;
    
    saveData();
    syncLifeGoalsToRoadmap();
    renderWithdrawals();  // ← הוספתי!
    
    // Visual feedback
    showSaveNotification('✅ היעדים נשמרו ומסונכרנו עם מפת דרכים!');
};




// ==========================================
// GAP ANALYSIS
// ==========================================

function analyzeGoals() {
    const profile = getCurrentPlan().profile;
    goals = getCurrentPlan().goals;
    const plan = getCurrentPlan();
    
    if (!profile.user.age || !goals) {
        return null;
    }
    
    const currentYear = new Date().getFullYear();
    const results = {
        pension: null,
        equity: null,
        lifeGoals: []
    };
    
    // 1. Analyze Pension Goal
    if (goals.retirement.monthlyPension && goals.retirement.userAge) {
        const yearsUntilRetirement = goals.retirement.userAge - profile.user.age;
        if (yearsUntilRetirement > 0) {
            // Calculate projected pension
            const pensions = plan.investments.filter(inv => inv.include && inv.type === 'פנסיה');
            let projectedPensionNominal = 0;
            
            pensions.forEach(inv => {
                const futureValue = calculateFV(
                    inv.amount, 
                    inv.monthly, 
                    inv.returnRate, 
                    yearsUntilRetirement,
                    inv.feeDeposit || 0, 
                    inv.feeAnnual || 0, 
                    inv.subTracks
                );
                const monthlyPension = calculateMonthlyPension(futureValue, inv.gender || 'male');
                projectedPensionNominal += monthlyPension;
            });
            
            // Convert to real terms (purchasing power in today's money)
            const INFLATION = 0.02;
            const inflationFactor = Math.pow(1 + INFLATION, yearsUntilRetirement);
            const projectedPensionReal = projectedPensionNominal / inflationFactor;
            
            // Calculate net after tax (from real value)
            const netAfterTax = calculateNetPension(projectedPensionReal);
            const projectedPensionRealNet = netAfterTax.net;
            
            // Target is already in real terms
            const targetPension = goals.retirement.monthlyPension;
            
            const gap = targetPension - projectedPensionRealNet;
            const percentage = targetPension > 0 ? (projectedPensionRealNet / targetPension) * 100 : 100;
            
            results.pension = {
                target: goals.retirement.monthlyPension,
                projected: projectedPensionRealNet,
                gap,
                percentage: Math.min(percentage, 100),
                yearsUntil: yearsUntilRetirement,
                status: percentage >= 100 ? 'success' : percentage >= 80 ? 'warning' : 'danger'
            };
        }
    }
    
    // 2. Analyze Equity Goal
    if (goals.equity.targetAmount && goals.equity.targetYear) {
        const yearsUntilTarget = goals.equity.targetYear - currentYear;
        if (yearsUntilTarget > 0) {
            // Calculate projected equity (non-pension)
            const projection = calculateProjectionWithWithdrawals(
                plan.investments,
                yearsUntilTarget,
                plan.withdrawals
            );
            
            let projectedEquity = projection.finalNominal;
            
            // Adjust for inflation if goal is in real terms
            let targetEquity = goals.equity.targetAmount;
            if (goals.equity.isRealValue) {
                // Target is in real terms, convert projected to real
                const INFLATION = 0.02;
                projectedEquity = projectedEquity / Math.pow(1 + INFLATION, yearsUntilTarget);
            }
            
            const gap = targetEquity - projectedEquity;
            const percentage = targetEquity > 0 ? (projectedEquity / targetEquity) * 100 : 100;
            
            results.equity = {
                target: goals.equity.targetAmount,
                projected: projectedEquity,
                gap,
                percentage: Math.min(percentage, 100),
                yearsUntil: yearsUntilTarget,
                status: percentage >= 100 ? 'success' : percentage >= 80 ? 'warning' : 'danger'
            };
        }
    }
    
    // 3. Analyze Life Goals
    goals.lifeGoals.forEach(goal => {
        const yearsUntil = goal.year - currentYear;
        if (yearsUntil > 0) {
            const projection = calculateProjectionWithWithdrawals(
                plan.investments,
                yearsUntil,
                plan.withdrawals
            );
            
            let projectedAmount = projection.finalNominal;
            let targetAmount = goal.amount;
            
            if (goal.isRealValue) {
                const INFLATION = 0.02;
                projectedAmount = projectedAmount / Math.pow(1 + INFLATION, yearsUntil);
            }
            
            const gap = targetAmount - projectedAmount;
            const percentage = targetAmount > 0 ? (projectedAmount / targetAmount) * 100 : 100;
            
            results.lifeGoals.push({
                name: goal.name,
                target: goal.amount,
                projected: projectedAmount,
                gap,
                percentage: Math.min(percentage, 100),
                yearsUntil,
                year: goal.year,
                status: percentage >= 100 ? 'success' : percentage >= 70 ? 'warning' : 'danger'
            });
        }
    });
    
    return results;
}

function renderGoalProgress() {
    const container = document.getElementById('goalProgress');
    if (!container) return;
    
    const analysis = analyzeGoals();
    if (!analysis) {
        container.innerHTML = '<div class="alert alert-info">השלם את הפרופיל והיעדים כדי לראות התקדמות</div>';
        return;
    }
    
    let html = '<div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px;">';
    html += '<h3 style="margin: 0 0 16px 0;">🎯 התקדמות ביעדים</h3>';
    html += '<div style="display: grid; gap: 16px;">';
    
    // Pension
    if (analysis.pension) {
        const p = analysis.pension;
        const color = p.status === 'success' ? '#10b981' : p.status === 'warning' ? '#f59e0b' : '#ef4444';
        const icon = p.status === 'success' ? '✅' : p.status === 'warning' ? '🟡' : '🔴';
        
        html += `
            <div style="background: rgba(255,255,255,0.25); padding: 16px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: bold; font-size: 1.1em; color: #1f2937;">💰 קצבה חודשית (ריאלי אחרי מס)</div>
                    <div style="font-size: 1.3em;">${icon}</div>
                </div>
                <div style="font-size: 0.9em; color: #374151; margin-bottom: 8px;">
                    יעד: ${formatCurrency(p.target)}/חודש | צפי: ${formatCurrency(p.projected)}/חודש
                </div>
                <div style="background: rgba(0,0,0,0.2); height: 24px; border-radius: 12px; overflow: hidden; margin-bottom: 8px;">
                    <div style="background: ${color}; height: 100%; width: ${p.percentage}%; transition: width 0.3s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #4b5563;">
                    <span>צפי: ${p.percentage.toFixed(0)}%</span>
                    <span>${p.gap > 0 ? 'חסר' : 'עודף'}: ${formatCurrency(Math.abs(p.gap))}/חודש</span>
                </div>
            </div>
        `;
    }
    
    // Equity
    if (analysis.equity) {
        const e = analysis.equity;
        const color = e.status === 'success' ? '#10b981' : e.status === 'warning' ? '#f59e0b' : '#ef4444';
        const icon = e.status === 'success' ? '✅' : e.status === 'warning' ? '🟡' : '🔴';
        
        html += `
            <div style="background: rgba(255,255,255,0.25); padding: 16px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: bold; font-size: 1.1em; color: #1f2937;">💎 הון עצמי</div>
                    <div style="font-size: 1.3em;">${icon}</div>
                </div>
                <div style="font-size: 0.9em; color: #374151; margin-bottom: 8px;">
                    יעד: ${formatCurrency(e.target)} | צפי: ${formatCurrency(e.projected)}
                </div>
                <div style="background: rgba(0,0,0,0.2); height: 24px; border-radius: 12px; overflow: hidden; margin-bottom: 8px;">
                    <div style="background: ${color}; height: 100%; width: ${e.percentage}%; transition: width 0.3s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #4b5563;">
                    <span>${e.percentage.toFixed(0)}% צפי</span>
                    <span>${e.gap > 0 ? 'חסר' : 'עודף'}: ${formatCurrency(Math.abs(e.gap))}</span>
                </div>
            </div>
        `;
    }
    
    // Life Goals
    if (analysis.lifeGoals.length > 0) {
        analysis.lifeGoals.forEach(lg => {
            const color = lg.status === 'success' ? '#10b981' : lg.status === 'warning' ? '#f59e0b' : '#ef4444';
            const icon = lg.status === 'success' ? '✅' : lg.status === 'warning' ? '🟡' : '🔴';
            
            html += `
                <div style="background: rgba(255,255,255,0.25); padding: 16px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="font-weight: bold; font-size: 1.1em; color: #1f2937;">🎯 ${lg.name}</div>
                        <div style="font-size: 1.3em;">${icon}</div>
                    </div>
                    <div style="font-size: 0.9em; color: #374151; margin-bottom: 8px;">
                        יעד: ${formatCurrency(lg.target)} ב-${lg.year} | צפי: ${formatCurrency(lg.projected)}
                    </div>
                    <div style="background: rgba(0,0,0,0.2); height: 24px; border-radius: 12px; overflow: hidden; margin-bottom: 8px;">
                        <div style="background: ${color}; height: 100%; width: ${lg.percentage}%; transition: width 0.3s;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #4b5563;">
                        <span>${lg.percentage.toFixed(0)}% צפי</span>
                        <span>${lg.gap > 0 ? 'חסר' : 'עודף'}: ${formatCurrency(Math.abs(lg.gap))}</span>
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div></div>';
    container.innerHTML = html;
}


// ==========================================
// UI NOTIFICATIONS
// ==========================================

function showSaveNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 1.1em;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}


// ==========================================
// GOALS ↔ ROADMAP SYNC
// ==========================================

function syncLifeGoalsToRoadmap() {
    const plan = getCurrentPlan();
    if (!plan.withdrawals) {
        plan.withdrawals = [];
    }
    
    goals = getCurrentPlan().goals.lifeGoals;
    
    // Mark existing goal-based withdrawals
    const goalWithdrawalIds = new Set();
    
    goals.forEach(goal => {
        // Find if this goal already has a withdrawal
        const existingIndex = plan.withdrawals.findIndex(w => 
            w.goalId === goal.id
        );
        
        if (existingIndex >= 0) {
            // Update existing withdrawal
            plan.withdrawals[existingIndex] = {
                year: goal.year,
                amount: goal.amount,
                goal: goal.name,
                goalId: goal.id,
                active: plan.withdrawals[existingIndex].active !== false
            };
            goalWithdrawalIds.add(goal.id);
        } else {
            // Create new withdrawal for this goal
            plan.withdrawals.push({
                year: goal.year,
                amount: goal.amount,
                goal: goal.name,
                goalId: goal.id,
                active: true
            });
            goalWithdrawalIds.add(goal.id);
        }
    });
    
    // Remove withdrawals for deleted goals
    plan.withdrawals = plan.withdrawals.filter(w => {
        // Keep if not a goal-based withdrawal
        if (!w.goalId) return true;
        // Keep if goal still exists
        return goalWithdrawalIds.has(w.goalId);
    });
    
    saveData();
}


// ==========================================
// RECOMMENDATIONS ENGINE
// ==========================================

function generateRecommendations(analysis) {
    if (!analysis) return [];
    
    const recommendations = [];
    const profile = getCurrentPlan().profile;
    const plan = getCurrentPlan();
    
    // 1. Pension recommendations
    if (analysis.pension && analysis.pension.gap > 0) {
        const gap = analysis.pension.gap; // Gap in monthly pension (real after tax)
        const yearsUntil = analysis.pension.yearsUntil;
        
        if (yearsUntil > 0) {
            // Get current pension deposits
            const pensions = plan.investments.filter(inv => inv.include && inv.type === 'פנסיה');
            const currentMonthly = pensions.reduce((sum, inv) => sum + (inv.monthly || 0), 0);
            const currentPrincipal = pensions.reduce((sum, inv) => sum + (inv.amount || 0), 0);
            
            // We need to find how much ADDITIONAL monthly deposit will close the gap
            // Gap is in monthly pension (real after tax)
            // Need to reverse engineer: monthly pension → future value needed → additional PMT
            
            const RETURN_RATE = 0.05;
            const monthlyRate = RETURN_RATE / 12;
            const months = yearsUntil * 12;
            const INFLATION = 0.02;
            const inflationFactor = Math.pow(1 + INFLATION, yearsUntil);
            
            // Convert gap (real) to nominal
            const gapNominal = gap * inflationFactor;
            
            // Future value needed for this gap (using pension coefficient)
            // Reverse of: monthlyPension = balance * 0.005
            const futureValueNeeded = gapNominal / 0.005; // Assuming male coefficient
            
            // Current trajectory (what we'll have)
            const currentTrajectory = calculateFV(currentPrincipal, currentMonthly, RETURN_RATE, yearsUntil, 0, 0, null);
            
            // Total FV needed
            const totalFVNeeded = currentTrajectory + futureValueNeeded;
            
            // Calculate total monthly needed to reach totalFVNeeded
            // FV = Principal*(1+r)^n + PMT*((1+r)^n - 1)/r
            // Solve for PMT: PMT = (FV - Principal*(1+r)^n) * r / ((1+r)^n - 1)
            const principalGrowth = currentPrincipal * Math.pow(1 + monthlyRate, months);
            const totalMonthlyNeeded = (totalFVNeeded - principalGrowth) * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
            
            // Additional needed
            const additionalMonthly = Math.max(0, totalMonthlyNeeded - currentMonthly);
            
            if (additionalMonthly > 100 && additionalMonthly < 50000) {
                recommendations.push({
                    type: 'pension',
                    icon: '💰',
                    title: 'הגדל הפקדה לפנסיה',
                    message: `כדי להגיע ליעד הקצבה, הפקד ${formatCurrency(Math.round(additionalMonthly / 100) * 100)} נוספים לחודש (סה"כ ${formatCurrency(Math.round((currentMonthly + additionalMonthly) / 100) * 100)}/חודש)`,
                    priority: 'high'
                });
            } else if (additionalMonthly > 100 && analysis.pension.percentage < 70) {
                recommendations.push({
                    type: 'pension',
                    icon: '⚠️',
                    title: 'יעד קצבה דורש מאמץ משמעותי',
                    message: `כדי להגיע ליעד תצטרך להפקיד ${formatCurrency(Math.round(additionalMonthly / 100) * 100)} נוספים לחודש. שקול להקטין יעד או לדחות`,
                    priority: 'high'
                });
            }
        }
    }
    
    // 2. Equity recommendations
    if (analysis.equity && analysis.equity.gap > 0) {
        const gap = analysis.equity.gap; // Gap in final equity (real)
        const yearsUntil = analysis.equity.yearsUntil;
        
        if (yearsUntil > 0) {
            // Get current equity deposits
            const equityInvestments = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
            const currentMonthly = equityInvestments.reduce((sum, inv) => sum + (inv.monthly || 0), 0);
            const currentEquity = equityInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
            
            const RETURN_RATE = 0.06;
            const monthlyRate = RETURN_RATE / 12;
            const months = yearsUntil * 12;
            const INFLATION = 0.02;
            const inflationFactor = Math.pow(1 + INFLATION, yearsUntil);
            
            // Gap is in real terms, convert to nominal for calculation
            const gapNominal = gap * inflationFactor;
            
            // Current trajectory
            const currentTrajectory = calculateFV(currentEquity, currentMonthly, RETURN_RATE, yearsUntil, 0, 0, null);
            
            // Total needed
            const totalNeeded = currentTrajectory + gapNominal;
            
            // Calculate total monthly needed
            // FV = Principal*(1+r)^n + PMT*((1+r)^n - 1)/r
            const principalGrowth = currentEquity * Math.pow(1 + monthlyRate, months);
            const totalMonthlyNeeded = (totalNeeded - principalGrowth) * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
            
            // Additional needed
            const additionalMonthly = Math.max(0, totalMonthlyNeeded - currentMonthly);
            
            if (additionalMonthly > 100 && additionalMonthly < 100000) {
                recommendations.push({
                    type: 'equity',
                    icon: '💎',
                    title: 'הגדל הפקדה להון עצמי',
                    message: `כדי להגיע ליעד ההון, הפקד ${formatCurrency(Math.round(additionalMonthly / 100) * 100)} נוספים לחודש (סה"כ ${formatCurrency(Math.round((currentMonthly + additionalMonthly) / 100) * 100)}/חודש)`,
                    priority: 'high'
                });
            } else if (additionalMonthly > 100 && analysis.equity.percentage < 70) {
                // Even if unrealistic, give a practical number
                const requiredMonthly = Math.round(additionalMonthly / 100) * 100;
                recommendations.push({
                    type: 'equity',
                    icon: '⚠️',
                    title: 'יעד הון דורש מאמץ משמעותי',
                    message: `כדי להגיע ליעד תצטרך להפקיד ${formatCurrency(requiredMonthly)} נוספים לחודש. שקול להקטין יעד או לדחות שנת יעד`,
                    priority: 'high'
                });
            }
            
            // Return rate recommendation
            const avgReturn = calculateAvgReturn(plan);
            if (avgReturn < 6 && analysis.equity.percentage < 90) {
                recommendations.push({
                    type: 'return',
                    icon: '📈',
                    title: 'שקול להגדיל תשואה',
                    message: `התשואה הממוצעת שלך ${avgReturn.toFixed(1)}%. שקול להגדיל חשיפה למניות להשגת תשואה גבוהה יותר`,
                    priority: 'medium'
                });
            }
        }
    }
    
    // 3. Life goals recommendations
    if (analysis.lifeGoals && analysis.lifeGoals.length > 0) {
        const urgentGoals = analysis.lifeGoals.filter(lg => lg.yearsUntil <= 5 && lg.percentage < 100);
        
        if (urgentGoals.length > 0) {
            urgentGoals.forEach(lg => {
                if (lg.gap > 0) {
                    const monthlyNeeded = lg.gap / (lg.yearsUntil * 12);
                    if (monthlyNeeded < 50000) {
                        recommendations.push({
                            type: 'lifegoal',
                            icon: '🎯',
                            title: `יעד דחוף: ${lg.name}`,
                            message: `בעוד ${lg.yearsUntil} שנים! הפקד ${formatCurrency(Math.round(monthlyNeeded / 100) * 100)} לחודש`,
                            priority: lg.yearsUntil <= 3 ? 'high' : 'medium'
                        });
                    }
                }
            });
        }
    }
    
    // 4. General recommendations
    if (recommendations.length === 0) {
        recommendations.push({
            type: 'success',
            icon: '✅',
            title: 'אתה בדרך הנכונה!',
            message: 'כל היעדים שלך בטווח הישיג. המשך כך!',
            priority: 'low'
        });
    }
    
    // Add general advice
    recommendations.push({
        type: 'general',
        icon: '💡',
        title: 'עצות כלליות',
        message: 'בדוק דמי ניהול, פזר השקעות בין גופים, עדכן תוכנית שנתית',
        priority: 'low'
    });
    
    return recommendations;
}

function calculateAvgReturn(plan) {
    const investments = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    if (investments.length === 0) return 0;
    
    const totalAmount = investments.reduce((sum, inv) => sum + inv.amount, 0);
    if (totalAmount === 0) return 0;
    
    const weightedReturn = investments.reduce((sum, inv) => 
        sum + (inv.amount * inv.returnRate), 0
    );
    
    return weightedReturn / totalAmount;
}

function renderRecommendations() {
    const container = document.getElementById('recommendations');
    if (!container) return;
    
    const analysis = analyzeGoals();
    const recommendations = generateRecommendations(analysis);
    
    if (recommendations.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="card" style="margin-top: 20px;">';
    html += '<h3 style="margin: 0 0 16px 0;">💡 המלצות אישיות</h3>';
    html += '<div style="display: grid; gap: 12px;">';
    
    recommendations.forEach(rec => {
        const bgColor = rec.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : 
                       rec.priority === 'medium' ? 'rgba(245, 158, 11, 0.1)' : 
                       'rgba(16, 185, 129, 0.1)';
        const borderColor = rec.priority === 'high' ? '#ef4444' : 
                           rec.priority === 'medium' ? '#f59e0b' : 
                           '#10b981';
        
        html += `
            <div style="padding: 16px; background: ${bgColor}; border-right: 4px solid ${borderColor}; border-radius: 8px;">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <div style="font-size: 1.5em;">${rec.icon}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 4px;">${rec.title}</div>
                        <div style="font-size: 0.95em; color: #666;">${rec.message}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div></div>';
    container.innerHTML = html;
}


// ==========================================
// VISUAL ANALYSIS REPORT
// ==========================================

function generateAnalysisReport() {
    const plan = getCurrentPlan();
    const profile = getCurrentPlan().profile;
   goals = getCurrentPlan().goals;
    
    if (!plan) {
        alert('שגיאה: לא נמצאה תוכנית פעילה');
        return;
    }
    
    if (!plan.investments) {
        alert('שגיאה: אין השקעות בתוכנית');
        return;
    }
    
    if (!profile.user.age) {
        alert('אנא השלם את הפרופיל תחילה');
        return;
    }
    
    // Calculate projection for each year
    const currentYear = new Date().getFullYear();
    const maxYear = Math.max(
        goals.equity.targetYear || currentYear + 30,
        goals.retirement.userAge ? currentYear + (goals.retirement.userAge - profile.user.age) : currentYear + 30,
        ...(goals.lifeGoals.map(g => g.year) || [])
    );
    
    const yearlyData = [];
    
    // Calculate current equity (year 0)
    const allInvestments = plan.investments || [];
    const nonPension = allInvestments.filter(inv => inv.type !== 'פנסיה');
    const currentEquity = nonPension.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    
    console.log('=== EQUITY DEBUG ===');
    console.log('Total investments:', allInvestments.length);
    console.log('Non-pension:', nonPension.length);
    console.log('Non-pension details:', nonPension.map(i => ({name: i.name, amount: i.amount})));
    console.log('Current equity:', currentEquity);
    console.log('==================');
    
    for (let year = currentYear; year <= maxYear; year++) {
        const yearsFromNow = year - currentYear;
        
        let equityBeforeWithdrawals;
        
        if (yearsFromNow === 0) {
            // Current year - use actual current equity
            equityBeforeWithdrawals = currentEquity;
        } else {
            // Future years - calculate with withdrawals UP TO this year
            const withdrawalsUpToThisYear = plan.withdrawals.filter(w => 
                w.active !== false && w.year < year
            );
            
            const projection = calculateProjectionWithWithdrawals(
                plan.investments.filter(inv => inv.type !== 'פנסיה'),
                yearsFromNow,
                withdrawalsUpToThisYear
            );
            
            equityBeforeWithdrawals = projection.finalNominal;
        }
        
        // Find withdrawals in this specific year
        const withdrawalsThisYear = plan.withdrawals.filter(w => 
            w.active !== false && w.year === year
        );
        const totalWithdrawals = withdrawalsThisYear.reduce((sum, w) => sum + w.amount, 0);
        
        // Calculate equity after withdrawals for this specific year
        const equityAfter = equityBeforeWithdrawals - totalWithdrawals;
        
        // Check if this is a goal year
        const isGoalYear = goals.equity.targetYear === year;
        const goalTarget = isGoalYear ? goals.equity.targetAmount : null;
        
        yearlyData.push({
            year,
            equityBefore: equityBeforeWithdrawals,
            withdrawals: totalWithdrawals,
            withdrawalsList: withdrawalsThisYear,
            equityAfter,
            isGoalYear,
            goalTarget,
            gap: isGoalYear ? (equityAfter - goalTarget) : null
        });
    }
    
    // Get selected interval from projections tab (default 5)
    const interval = parseInt(document.getElementById('projInterval')?.value) || 5;
    
    // Generate HTML
    const html = generateAnalysisHTML(yearlyData, goals, profile, interval);
    
    // Open in new window
    const reportWindow = window.open('', '_blank', 'width=1200,height=800');
    reportWindow.document.write(html);
    reportWindow.document.close();
}

function generateAnalysisHTML(yearlyData, goals, profile, interval = 5) {
    const analysis = analyzeGoals();
    const recommendations = generateRecommendations(analysis);
    const plan = getCurrentPlan();
    
    // Calculate current equity directly (safety fallback)
    const currentEquityDirect = plan.investments
        .filter(inv => inv.type !== 'פנסיה')
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    // Calculate average fees (weighted by amount)
    const allInvestments = plan.investments.filter(inv => inv.type !== 'פנסיה');
    const totalAmount = allInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const avgFeeAnnual = totalAmount > 0 
        ? allInvestments.reduce((sum, inv) => sum + (inv.amount * (inv.feeAnnual || 0)), 0) / totalAmount
        : 0;
    const avgFeeDeposit = totalAmount > 0
        ? allInvestments.reduce((sum, inv) => sum + (inv.amount * (inv.feeDeposit || 0)), 0) / totalAmount
        : 0;
    
    // Use yearlyData[0] ONLY if it's actually valid (not 0)
    const currentEquityDisplay = (yearlyData && yearlyData.length > 0 && yearlyData[0].equityBefore > 0) 
        ? yearlyData[0].equityBefore 
        : currentEquityDirect;
    
    console.log('HTML Generation - yearlyData[0]:', yearlyData[0]);
    console.log('HTML Generation - currentEquityDirect:', currentEquityDirect);
    console.log('HTML Generation - currentEquityDisplay:', currentEquityDisplay);
    
    // Find max value for chart scaling
    const maxValue = Math.max(...yearlyData.map(d => d.equityBefore));
    const chartHeight = 400;
    
    // Generate chart points
    const points = yearlyData.map((d, i) => {
        const x = (i / (yearlyData.length - 1)) * 100;
        const y = chartHeight - (d.equityBefore / maxValue * (chartHeight - 40)) - 20;
        return `${x},${y}`;
    }).join(' ');
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח ניתוח פיננסי מפורט</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            color: #1f2937;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 2.5em;
            color: #667eea;
            margin-bottom: 10px;
            text-align: center;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 40px;
            font-size: 1.1em;
        }
        .section {
            margin-bottom: 40px;
            padding: 30px;
            background: #f9fafb;
            border-radius: 12px;
            border: 2px solid #e5e7eb;
        }
        .section-title {
            font-size: 1.8em;
            color: #1f2937;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            position: relative;
        }
        svg { width: 100%; height: 450px; }
        .grid-line { stroke: #e5e7eb; stroke-width: 1; }
        .chart-line { fill: none; stroke: #667eea; stroke-width: 3; }
        .goal-line { stroke: #10b981; stroke-width: 2; stroke-dasharray: 5,5; }
        .withdrawal-marker { fill: #ef4444; }
        .axis-label { font-size: 12px; fill: #666; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: right;
            border-bottom: 1px solid #e5e7eb;
        }
        th {
            background: #667eea;
            color: white;
            font-weight: bold;
        }
        tr:hover { background: #f9fafb; }
        .positive { color: #10b981; font-weight: bold; }
        .negative { color: #ef4444; font-weight: bold; }
        .withdrawal-row { background: #fef2f2; }
        .goal-row { background: #f0fdf4; border: 2px solid #10b981; }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .summary-card {
            padding: 20px;
            background: white;
            border-radius: 12px;
            border-right: 4px solid #667eea;
        }
        .summary-card-title {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 8px;
        }
        .summary-card-value {
            font-size: 2em;
            font-weight: bold;
            color: #1f2937;
        }
        .recommendation {
            padding: 16px;
            margin: 12px 0;
            border-radius: 8px;
            border-right: 4px solid #f59e0b;
            background: rgba(245, 158, 11, 0.1);
        }
        .recommendation.high { border-right-color: #ef4444; background: rgba(239, 68, 68, 0.1); }
        .recommendation.low { border-right-color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .rec-title { font-weight: bold; margin-bottom: 8px; }
        @media print {
            body { background: white; padding: 0; }
            .no-print { display: none; }
        }
        .print-button {
            position: fixed;
            bottom: 30px;
            left: 30px;
            background: #667eea;
            color: white;
            border: none;
            padding: 16px 32px;
            border-radius: 50px;
            font-size: 1.1em;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            z-index: 1000;
        }
        .print-button:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 דוח ניתוח פיננסי מפורט</h1>
        <div class="subtitle">
            ${profile.user.name} | ${new Date().toLocaleDateString('he-IL')}
        </div>
        
        <!-- Summary Cards -->
        <div class="section">
            <div class="section-title">💎 סיכום מצב נוכחי</div>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-card-title">הון עצמי היום</div>
                    <div class="summary-card-value">${formatCurrency(currentEquityDisplay)}</div>
                </div>
                ${goals.equity.targetYear ? `
                <div class="summary-card">
                    <div class="summary-card-title">יעד ב-${goals.equity.targetYear}</div>
                    <div class="summary-card-value">${formatCurrency(goals.equity.targetAmount)}</div>
                </div>
                ` : ''}
                ${analysis && analysis.equity ? `
                <div class="summary-card">
                    <div class="summary-card-title">צפי ב-${goals.equity.targetYear}</div>
                    <div class="summary-card-value ${analysis.equity.gap < 0 ? 'positive' : 'negative'}">
                        ${formatCurrency(analysis.equity.projected)}
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">פער</div>
                    <div class="summary-card-value ${analysis.equity.gap < 0 ? 'positive' : 'negative'}">
                        ${analysis.equity.gap < 0 ? 'עודף' : 'חסר'} ${formatCurrency(Math.abs(analysis.equity.gap))}
                    </div>
                </div>
                ` : ''}
                <div class="summary-card">
                    <div class="summary-card-title">ממוצע דמי ניהול</div>
                    <div class="summary-card-value" style="font-size: 1.5em;">
                        <div>צבירה: ${avgFeeAnnual.toFixed(2)}%</div>
                        <div style="font-size: 0.7em; margin-top: 4px;">הפקדה: ${avgFeeDeposit.toFixed(2)}%</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Timeline Chart -->
        <div class="section">
            <div class="section-title">📈 גרף צמיחת הון לאורך זמן</div>
            <div class="chart-container">
                <svg viewBox="0 0 100 ${chartHeight}" preserveAspectRatio="none">
                    <!-- Grid lines -->
                    ${[0, 25, 50, 75, 100].map(y => `
                        <line x1="0" y1="${y * chartHeight / 100}" x2="100" y2="${y * chartHeight / 100}" class="grid-line"/>
                        <text x="2" y="${y * chartHeight / 100 - 5}" class="axis-label">${formatCurrency(maxValue * (1 - y/100))}</text>
                    `).join('')}
                    
                    <!-- Main equity line -->
                    <polyline points="${points}" class="chart-line"/>
                    
                    <!-- Goal line -->
                    ${goals.equity.targetYear ? `
                        <line x1="0" y1="${chartHeight - (goals.equity.targetAmount / maxValue * (chartHeight - 40)) - 20}" 
                              x2="100" y2="${chartHeight - (goals.equity.targetAmount / maxValue * (chartHeight - 40)) - 20}" 
                              class="goal-line"/>
                    ` : ''}
                    
                    <!-- Withdrawal markers -->
                    ${yearlyData.map((d, i) => {
                        if (d.withdrawals > 0) {
                            const x = (i / (yearlyData.length - 1)) * 100;
                            const y = chartHeight - (d.equityBefore / maxValue * (chartHeight - 40)) - 20;
                            return `
                                <circle cx="${x}" cy="${y}" r="1.5" class="withdrawal-marker"/>
                                <text x="${x}" y="${y - 8}" class="axis-label" text-anchor="middle">${d.year}</text>
                            `;
                        }
                        return '';
                    }).join('')}
                </svg>
                <div style="margin-top: 20px; display: flex; gap: 30px; justify-content: center; font-size: 0.9em;">
                    <div><span style="color: #667eea;">━━</span> הון עצמי צפוי</div>
                    <div><span style="color: #10b981;">- - -</span> יעד הון</div>
                    <div><span style="color: #ef4444;">●</span> משיכות</div>
                </div>
            </div>
        </div>
        
        <!-- Yearly Table -->
        <div class="section">
            <div class="section-title">📋 פירוט שנתי</div>
            <p style="color: #666; margin-bottom: 16px; font-size: 0.95em;">
                מרווח: כל ${interval === 1 ? 'שנה' : interval === 2 ? 'שנתיים' : `${interval} שנים`} 
                (+ שנים עם משיכות ושנות יעד)
            </p>
            <table>
                <thead>
                    <tr>
                        <th>שנה</th>
                        <th>הון לפני משיכות</th>
                        <th>משיכות</th>
                        <th>מטרה</th>
                        <th>הון אחרי משיכות</th>
                        <th>יעד</th>
                        <th>פער</th>
                    </tr>
                </thead>
                <tbody>
                    ${yearlyData.filter((d, i) => {
                        // Show if: it's at the interval, OR has withdrawals, OR is a goal year
                        const yearsSinceStart = d.year - yearlyData[0].year;
                        return yearsSinceStart % interval === 0 || d.withdrawals > 0 || d.isGoalYear;
                    }).map(d => {
                        const purposes = d.withdrawalsList && d.withdrawalsList.length > 0 
                            ? d.withdrawalsList.map(w => w.goal).join(', ')
                            : '-';
                        return `
                        <tr class="${d.withdrawals > 0 ? 'withdrawal-row' : ''} ${d.isGoalYear ? 'goal-row' : ''}">
                            <td><strong>${d.year}</strong></td>
                            <td>${formatCurrency(d.equityBefore)}</td>
                            <td class="${d.withdrawals > 0 ? 'negative' : ''}">${d.withdrawals > 0 ? formatCurrency(d.withdrawals) : '-'}</td>
                            <td style="font-size: 0.9em;">${purposes}</td>
                            <td>${formatCurrency(d.equityAfter)}</td>
                            <td>${d.isGoalYear ? formatCurrency(d.goalTarget) : '-'}</td>
                            <td class="${d.gap !== null ? (d.gap > 0 ? 'positive' : 'negative') : ''}">
                                ${d.gap !== null ? (d.gap > 0 ? 'עודף ' : 'חסר ') + formatCurrency(Math.abs(d.gap)) : '-'}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Charts Section -->
        <div class="section">
            <div class="section-title">📊 גרפים</div>
            <p style="text-align: center; padding: 40px; background: #f9fafb; border-radius: 12px; color: #666;">
                הגרפים זמינים בטאב "גרפים" באפליקציה<br>
                (Chart.js נדרש להצגה אינטראקטיבית)
            </p>
        </div>
        
        <!-- Recommendations -->
        ${recommendations.length > 0 ? `
        <div class="section">
            <div class="section-title">💡 המלצות אישיות</div>
            ${recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <div class="rec-title">${rec.icon} ${rec.title}</div>
                    <div>${rec.message}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}
    </div>
    
    <button class="print-button no-print" onclick="window.print()">🖨️ הדפס/שמור PDF</button>
</body>
</html>
    `;
}


// ==========================================
// RISK ANALYSIS
// ==========================================

function analyzeRisk() {
    const plan = getCurrentPlan();
     goals = getCurrentPlan().goals;
    const currentYear = new Date().getFullYear();
    
    // Calculate current equity allocation
    const equityInvestments = plan.investments.filter(inv => 
        inv.include && inv.type !== 'פנסיה' && inv.type !== 'עו"ש' && inv.type !== 'פיקדון'
    );
    
    const totalEquity = equityInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    if (totalEquity === 0) return null;
    
    // Calculate stock percentage (high risk)
    const highRiskTypes = ['מניות סחיר', 'תיק עצמאי'];
    const highRiskAmount = equityInvestments
        .filter(inv => highRiskTypes.includes(inv.type))
        .reduce((sum, inv) => sum + inv.amount, 0);
    
    const currentStockPercentage = (highRiskAmount / totalEquity) * 100;
    
    // Analyze each goal
    const goalRiskAnalysis = [];
    
    // Equity goal
    if (goals.equity.targetYear) {
        const yearsUntil = goals.equity.targetYear - currentYear;
        const recommendedStock = calculateRecommendedStock(yearsUntil);
        
        goalRiskAnalysis.push({
            name: 'הון עצמי',
            year: goals.equity.targetYear,
            yearsUntil,
            currentStock: currentStockPercentage,
            recommendedStock,
            riskLevel: getRiskLevel(yearsUntil),
            status: getStockStatus(currentStockPercentage, recommendedStock)
        });
    }
    
    // Life goals
    goals.lifeGoals.forEach(goal => {
        const yearsUntil = goal.year - currentYear;
        if (yearsUntil > 0) {
            const recommendedStock = calculateRecommendedStock(yearsUntil);
            
            goalRiskAnalysis.push({
                name: goal.name,
                year: goal.year,
                yearsUntil,
                currentStock: currentStockPercentage,
                recommendedStock,
                riskLevel: getRiskLevel(yearsUntil),
                status: getStockStatus(currentStockPercentage, recommendedStock)
            });
        }
    });
    
    return {
        currentStockPercentage,
        goals: goalRiskAnalysis,
        overallRisk: currentStockPercentage > 60 ? 'high' : currentStockPercentage > 40 ? 'medium' : 'low'
    };
}

function calculateRecommendedStock(yearsUntil) {
    // Rule of thumb: 100 - years until goal = % stocks
    // But with floors and ceilings
    if (yearsUntil <= 3) return 20;       // Very conservative
    if (yearsUntil <= 5) return 30;       // Conservative
    if (yearsUntil <= 10) return 50;      // Balanced
    if (yearsUntil <= 15) return 60;      // Moderate
    return 70;                             // Aggressive
}

function getRiskLevel(yearsUntil) {
    if (yearsUntil <= 5) return 'שמרני';
    if (yearsUntil <= 10) return 'מאוזן';
    return 'אגרסיבי';
}

function getStockStatus(current, recommended) {
    const diff = current - recommended;
    if (Math.abs(diff) <= 10) return 'good';      // Within 10%
    if (diff > 10) return 'too_risky';             // Too much stock
    return 'too_conservative';                     // Too little stock
}

// ==========================================
// DIVERSIFICATION ANALYSIS
// ==========================================

function analyzeDiversification() {
    const plan = getCurrentPlan();
    
    // Group by investment house
    const byHouse = {};
    const totalAmount = plan.investments
        .filter(inv => inv.include)
        .reduce((sum, inv) => sum + inv.amount, 0);
    
    if (totalAmount === 0) return null;
    
    plan.investments
        .filter(inv => inv.include)
        .forEach(inv => {
            const house = inv.house || 'לא מוגדר';
            if (!byHouse[house]) {
                byHouse[house] = { amount: 0, investments: [] };
            }
            byHouse[house].amount += inv.amount;
            byHouse[house].investments.push(inv);
        });
    
    // Calculate percentages and identify concentration risk
    const distribution = Object.entries(byHouse).map(([house, data]) => ({
        house,
        amount: data.amount,
        percentage: (data.amount / totalAmount) * 100,
        investments: data.investments.length,
        risk: data.amount / totalAmount > 0.3 ? 'high' : 'medium'
    })).sort((a, b) => b.amount - a.amount);
    
    // Find concentrated houses (>30%)
    const concentrated = distribution.filter(d => d.percentage > 30);
    
    return {
        distribution,
        concentrated,
        totalHouses: distribution.length,
        diversificationScore: calculateDiversificationScore(distribution)
    };
}

function calculateDiversificationScore(distribution) {
    // Simple score: 100 - (concentration penalty)
    let score = 100;
    
    distribution.forEach(d => {
        if (d.percentage > 40) score -= 30;        // Major concentration
        else if (d.percentage > 30) score -= 15;   // Moderate concentration
    });
    
    // Bonus for having multiple houses
    if (distribution.length >= 4) score += 10;
    else if (distribution.length <= 2) score -= 20;
    
    return Math.max(0, Math.min(100, score));
}

function renderRiskAnalysis() {
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
    
    // Risk Analysis
    if (riskAnalysis) {
        html += '<div style="margin-bottom: 30px;">';
        html += '<h4 style="margin-bottom: 16px;">📊 ניתוח סיכון לפי אופק זמן</h4>';
        html += `<div style="padding: 16px; background: #f3f4f6; border-radius: 8px; margin-bottom: 16px;">
            <strong>חשיפה נוכחית למניות:</strong> ${riskAnalysis.currentStockPercentage.toFixed(0)}%
        </div>`;
        
        html += '<div style="display: grid; gap: 12px;">';
        
        riskAnalysis.goals.forEach(goal => {
            const statusColor = goal.status === 'good' ? '#10b981' : 
                               goal.status === 'too_risky' ? '#ef4444' : '#f59e0b';
            const statusIcon = goal.status === 'good' ? '✅' : 
                              goal.status === 'too_risky' ? '⚠️' : '💡';
            const statusText = goal.status === 'good' ? 'מתאים' : 
                              goal.status === 'too_risky' ? 'סיכון גבוה מדי' : 'שמרני מדי';
            
            html += `
                <div style="padding: 16px; background: white; border: 2px solid ${statusColor}; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-weight: bold; font-size: 1.1em;">${goal.name}</div>
                            <div style="font-size: 0.9em; color: #666;">${goal.year} (בעוד ${goal.yearsUntil} שנים) • רמת סיכון: ${goal.riskLevel}</div>
                        </div>
                        <div style="font-size: 1.5em;">${statusIcon}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                        <div>
                            <div style="font-size: 0.85em; color: #666;">מניות מומלץ</div>
                            <div style="font-size: 1.2em; font-weight: bold; color: #1f2937;">${goal.recommendedStock}%</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85em; color: #666;">סטטוס</div>
                            <div style="font-size: 1.1em; font-weight: bold; color: ${statusColor};">${statusText}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
    }
    
    // Diversification Analysis
    if (divAnalysis) {
        html += '<div>';
        html += '<h4 style="margin-bottom: 16px;">🏦 ניתוח פיזור בין גופים</h4>';
        
        const scoreColor = divAnalysis.diversificationScore >= 70 ? '#10b981' : 
                          divAnalysis.diversificationScore >= 50 ? '#f59e0b' : '#ef4444';
        
        html += `<div style="padding: 16px; background: rgba(${divAnalysis.diversificationScore >= 70 ? '16, 185, 129' : divAnalysis.diversificationScore >= 50 ? '245, 158, 11' : '239, 68, 68'}, 0.1); border-radius: 8px; margin-bottom: 16px; border-right: 4px solid ${scoreColor};">
            <strong>ציון פיזור:</strong> ${divAnalysis.diversificationScore}/100
            ${divAnalysis.diversificationScore < 70 ? ' ⚠️ יש מקום לשיפור' : ' ✅ פיזור טוב'}
        </div>`;
        
        if (divAnalysis.concentrated.length > 0) {
            html += '<div style="padding: 12px; background: #fef2f2; border-right: 4px solid #ef4444; border-radius: 8px; margin-bottom: 16px;">';
            html += '<strong style="color: #ef4444;">⚠️ ריכוזיות מוגזמת:</strong><br>';
            divAnalysis.concentrated.forEach(c => {
                html += `<div style="margin-top: 8px;">• ${c.house}: ${c.percentage.toFixed(0)}% (${formatCurrency(c.amount)})</div>`;
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
                    <div style="background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden;">
                        <div style="background: ${barColor}; height: 100%; width: ${d.percentage}%; transition: width 0.3s;"></div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        html += '</div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

