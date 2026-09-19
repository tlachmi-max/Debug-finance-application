// ============================================================
// subtracks-clarity-patch.js v1
// Clear, accessible breakdown of the portfolio by sub-tracks (%),
// with an explicit "with / without pension" toggle.
// Default view: WITHOUT pension.
// ============================================================

console.log('✅ subtracks-clarity-patch.js v1 loading...');

(function () {

    // ------------------------------------------------------------
    // 1. Replace the small "כולל פנסיה" checkbox with two clear,
    //    unmistakable buttons. The original checkbox is kept in the
    //    DOM (hidden) so any existing code that reads its .checked
    //    value keeps working exactly as before.
    // ------------------------------------------------------------
    function setupPensionToggle() {
        const checkbox = document.getElementById('chartsIncludePension');
        if (!checkbox || document.getElementById('pensionToggleGroup')) return;

        const label = checkbox.closest('label');
        if (!label) return;

        label.style.display = 'none';

        const group = document.createElement('div');
        group.id = 'pensionToggleGroup';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'הצגת התיק עם או ללא פנסיה');
        group.style.cssText = 'display:flex;border:1.5px solid var(--brand-light);border-radius:10px;overflow:hidden;';

        const btnWithout = document.createElement('button');
        btnWithout.type = 'button';
        btnWithout.id = 'btnPensionExcluded';
        btnWithout.textContent = 'ללא פנסיה';

        const btnWith = document.createElement('button');
        btnWith.type = 'button';
        btnWith.id = 'btnPensionIncluded';
        btnWith.textContent = 'עם פנסיה';

        [btnWithout, btnWith].forEach(btn => {
            btn.style.cssText = 'padding:8px 16px;font-size:0.9em;font-weight:600;border:none;cursor:pointer;background:#fff;color:var(--brand-primary);transition:background .15s,color .15s;';
        });

        function applyActiveStyles() {
            const included = checkbox.checked;
            btnWithout.style.background = included ? '#fff' : 'var(--brand-primary)';
            btnWithout.style.color = included ? 'var(--brand-primary)' : '#fff';
            btnWith.style.background = included ? 'var(--brand-primary)' : '#fff';
            btnWith.style.color = included ? '#fff' : 'var(--brand-primary)';
            btnWithout.setAttribute('aria-pressed', String(!included));
            btnWith.setAttribute('aria-pressed', String(included));
        }

        btnWithout.addEventListener('click', function () {
            checkbox.checked = false;
            applyActiveStyles();
            renderCharts();
        });
        btnWith.addEventListener('click', function () {
            checkbox.checked = true;
            applyActiveStyles();
            renderCharts();
        });

        group.appendChild(btnWithout);
        group.appendChild(btnWith);
        label.parentElement.insertBefore(group, label);

        // Default: without pension, unless the checkbox was already set elsewhere
        checkbox.checked = false;
        applyActiveStyles();
    }

    // ------------------------------------------------------------
    // 2. Recompute the sub-track breakdown independently (mirrors
    //    the filtering logic in glide.js/script.js) so we can render
    //    a clearer chart + an accessible percentage list.
    // ------------------------------------------------------------
    function computeSubTrackBreakdown() {
        const checkbox = document.getElementById('chartsIncludePension');
        const includePension = checkbox ? checkbox.checked : false;
        const timeframeSelect = document.getElementById('chartsTimeframe');
        const years = timeframeSelect ? parseInt(timeframeSelect.value) : 0;

        const plan = getCurrentPlan();
        const bySubTrack = {};
        let total = 0;

        (plan.investments || []).forEach(inv => {
            if (!inv.include) return;
            if (!includePension && inv.type === 'פנסיה') return;

            const value = years === 0
                ? (inv.amount || 0)
                : calculateFV(inv.amount, inv.monthly, inv.returnRate, years, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);

            if (inv.subTracks && inv.subTracks.length > 0) {
                inv.subTracks.forEach(st => {
                    const v = value * (st.percent / 100);
                    bySubTrack[st.type] = (bySubTrack[st.type] || 0) + v;
                });
            } else {
                bySubTrack['לא מחולק לתתי-מסלולים'] = (bySubTrack['לא מחולק לתתי-מסלולים'] || 0) + value;
            }
            total += value;
        });

        const rows = Object.keys(bySubTrack)
            .map(name => ({ name: name, value: bySubTrack[name] }))
            .filter(r => r.value > 0)
            .sort((a, b) => b.value - a.value);

        return { rows: rows, total: total, includePension: includePension };
    }

    // ------------------------------------------------------------
    // 3. Render: a sorted doughnut with a non-repeating color per
    //    slice, plus a full accessible percentage list underneath.
    // ------------------------------------------------------------
    function renderSubTracksClarity() {
        const canvas = document.getElementById('chartBySubTracks');
        if (!canvas) return;

        const { rows, total, includePension } = computeSubTrackBreakdown();

        let listContainer = document.getElementById('subTracksBreakdownList');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.id = 'subTracksBreakdownList';
            listContainer.style.cssText = 'margin-top:14px;';
            canvas.parentElement.insertBefore(listContainer, canvas.nextSibling);
        }

        let captionEl = document.getElementById('subTracksBreakdownCaption');
        if (!captionEl) {
            captionEl = document.createElement('div');
            captionEl.id = 'subTracksBreakdownCaption';
            captionEl.style.cssText = 'font-size:0.85em;color:var(--text-muted);margin-bottom:10px;';
            canvas.parentElement.insertBefore(captionEl, canvas);
        }
        captionEl.textContent = includePension
            ? 'התצוגה כוללת את הפנסיה'
            : 'התצוגה ללא פנסיה (ברירת מחדל)';

        if (total === 0 || rows.length === 0) {
            listContainer.innerHTML = '';
            return; // renderPieChart already shows the "no data" empty state
        }

        // Re-draw the doughnut sorted, with a color per slice that
        // never repeats (previously capped at 10 fixed colors).
        if (charts['chartBySubTracks']) {
            charts['chartBySubTracks'].destroy();
            delete charts['chartBySubTracks'];
        }
        const colors = generateUniqueColors(rows.length);
        canvas.style.display = 'block';
        const emptyDiv = document.getElementById('chartBySubTracks_empty');
        if (emptyDiv) emptyDiv.style.display = 'none';

        charts['chartBySubTracks'] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: rows.map(r => `${r.name} (${((r.value / total) * 100).toFixed(1)}%)`),
                datasets: [{
                    data: rows.map(r => r.value),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: { duration: 300 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        rtl: true,
                        callbacks: { label: ctx => ' ' + formatCurrency(ctx.parsed) }
                    }
                }
            }
        });

        // Accessible percentage list — every sub-track, sorted large
        // to small, with its exact share and amount spelled out.
        const rowsHtml = rows.map((r, i) => {
            const pct = ((r.value / total) * 100).toFixed(1);
            return `
                <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bg-surface);">
                    <span style="width:14px;height:14px;border-radius:4px;flex-shrink:0;background:${colors[i]};"></span>
                    <span style="flex:1;font-size:0.92em;color:var(--text-primary);">${r.name}</span>
                    <span style="font-weight:700;color:var(--brand-primary);min-width:52px;text-align:left;">${pct}%</span>
                    <span style="font-size:0.82em;color:var(--text-muted);min-width:90px;text-align:left;">${formatCurrency(r.value)}</span>
                </div>`;
        }).join('');

        listContainer.innerHTML = `
            <div style="font-weight:700;font-size:0.88em;color:var(--text-secondary);margin-bottom:4px;">פירוט מלא לפי אחוזים:</div>
            ${rowsHtml}
            <div style="display:flex;justify-content:space-between;padding-top:10px;font-weight:700;color:var(--text-primary);">
                <span>סה"כ</span><span>${formatCurrency(total)}</span>
            </div>`;
    }

    // ------------------------------------------------------------
    // 4. Chain onto whatever renderCharts is currently defined
    //    (glide.js's version), so the other charts keep working
    //    exactly as before; we only take over the sub-tracks card.
    // ------------------------------------------------------------
    const _prevRenderCharts = renderCharts;
    renderCharts = function () {
        _prevRenderCharts.apply(this, arguments);
        renderSubTracksClarity();
    };

    document.addEventListener('DOMContentLoaded', function () {
        setupPensionToggle();
    });
    // In case this script runs after DOMContentLoaded already fired
    if (document.readyState !== 'loading') {
        setupPensionToggle();
    }

})();
