// ============================================================
// dashboard-v8.js — Quick-Access Cards + Profile FAB
// ★ MUST be loaded AFTER the inline <script> block in index.html
// ★ Add: <script src="dashboard-v8.js?v=8"></script> right before </body>
// ============================================================

(function() {
    'use strict';
    console.log('✅ dashboard-v8.js v8 loading...');

    // ============================================================
    // 1. INJECT PROFILE FAB into hero-actions
    // ============================================================
    function injectProfileFab() {
        var actions = document.querySelector('.hero-actions');
        if (!actions || document.getElementById('profileFabBtn')) return;
        var fab = document.createElement('button');
        fab.id = 'profileFabBtn';
        fab.className = 'profile-fab';
        fab.title = 'הפרופיל שלנו';
        fab.setAttribute('onclick', "openModule('profile')");
        fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        actions.insertBefore(fab, actions.firstChild);
        console.log('  ✅ Profile FAB injected');
    }

    // ============================================================
    // 2. INJECT QA CARDS into launchpad
    // ============================================================
    function injectQASection() {
        var launchpad = document.getElementById('launchpad');
        if (!launchpad || document.getElementById('qaSection')) return;

        var qaHTML = '' +
        '<div class="qa-section" id="qaSection">' +
            '<div class="qa-section-title">גישה מהירה</div>' +
            '<div class="qa-grid">' +
                // Card 1: Pension
                '<div class="qa-card" data-accent="blue" onclick="openModule(\'pension\')">' +
                    '<div class="qa-metric" id="qam-pension" style="display:none;"></div>' +
                    '<div class="qa-icon qa-icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>' +
                    '<div class="qa-title">הפנסיה שלי</div>' +
                    '<div class="qa-desc">צפי קצבה, מס פרוגרסיבי ונטו ריאלי</div>' +
                    '<div class="qa-arrow">← כניסה</div>' +
                '</div>' +
                // Card 2: Investments
                '<div class="qa-card" data-accent="green" onclick="openModule(\'investments\')">' +
                    '<div class="qa-metric" id="qam-investments" style="display:none;"></div>' +
                    '<div class="qa-icon qa-icon-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>' +
                    '<div class="qa-title">תיק הנכסים שלי</div>' +
                    '<div class="qa-desc">ניהול קרנות, גמל, השתלמות ותיקים עצמאיים</div>' +
                    '<div class="qa-arrow">← כניסה</div>' +
                '</div>' +
                // Card 3: Goals
                '<div class="qa-card" data-accent="amber" onclick="openModule(\'goals\')">' +
                    '<div class="qa-metric" id="qam-goals" style="display:none;"></div>' +
                    '<div class="qa-icon qa-icon-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>' +
                    '<div class="qa-title">החלומות והיעדים שלי</div>' +
                    '<div class="qa-desc">תכנון דירה, לימודים, רכב וטיולים</div>' +
                    '<div class="qa-arrow">← כניסה</div>' +
                '</div>' +
                // Card 4: Summary
                '<div class="qa-card" data-accent="purple" onclick="openModule(\'summary\')">' +
                    '<div class="qa-metric" id="qam-summary" style="display:none;"></div>' +
                    '<div class="qa-icon qa-icon-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>' +
                    '<div class="qa-title">העתיד שלנו</div>' +
                    '<div class="qa-desc">תמונת מצב כוללת, עלויות והמלצות</div>' +
                    '<div class="qa-arrow">← כניסה</div>' +
                '</div>' +
            '</div>' +
        '</div>';

        // Find insertion point: after dcard-report-row, before dash-snap-row
        var snapRow = launchpad.querySelector('.dash-snap-row');
        var temp = document.createElement('div');
        temp.innerHTML = qaHTML;
        var section = temp.firstChild;

        if (snapRow) {
            launchpad.insertBefore(section, snapRow);
        } else {
            var grid = launchpad.querySelector('.launchpad-grid');
            if (grid) {
                launchpad.insertBefore(section, grid);
            } else {
                launchpad.appendChild(section);
            }
        }
        console.log('  ✅ QA cards injected');
    }

    // ============================================================
    // 3. ADD "כל המודולים" label + hide profile card
    // ============================================================
    function markSecondaryGrid() {
        var grid = document.querySelector('.launchpad-grid');
        if (!grid || document.getElementById('qaSecondaryLabel')) return;

        // Add label before the grid
        var label = document.createElement('div');
        label.id = 'qaSecondaryLabel';
        label.className = 'qa-secondary-label';
        label.textContent = 'כל המודולים';
        grid.parentNode.insertBefore(label, grid);

        // Mark profile card for hiding via CSS
        var cards = grid.querySelectorAll('.launch-card');
        cards.forEach(function(card) {
            var onclick = card.getAttribute('onclick') || '';
            if (onclick.indexOf("'profile'") !== -1) {
                card.setAttribute('data-module', 'profile');
            }
        });
        console.log('  ✅ Secondary grid labeled, profile card hidden');
    }

    // ============================================================
    // 4. UPDATE QA METRICS
    // ============================================================
    function updateQAMetrics() {
        try {
            var plan = getCurrentPlan();
            if (!plan) return;

            // Pension
            var qamP = document.getElementById('qam-pension');
            if (qamP) {
                try {
                    var proj = (typeof calculateFullPensionProjection === 'function') ? calculateFullPensionProjection() : null;
                    if (proj && proj.combined && proj.combined.netReal > 0) {
                        qamP.textContent = formatCurrency(proj.combined.netReal) + '/חודש';
                        qamP.style.display = '';
                    } else { qamP.style.display = 'none'; }
                } catch(e) { qamP.style.display = 'none'; }
            }

            // Investments count
            var qamI = document.getElementById('qam-investments');
            if (qamI) {
                var cnt = plan.investments.filter(function(i) { return i.include && i.type !== 'פנסיה'; }).length;
                if (cnt > 0) { qamI.textContent = cnt + ' מסלולים'; qamI.style.display = ''; }
                else { qamI.style.display = 'none'; }
            }

            // Goals
            var qamG = document.getElementById('qam-goals');
            if (qamG) {
                var goals = plan.goals && plan.goals.lifeGoals;
                if (goals && goals.length > 0) {
                    var now = new Date().getFullYear(), nearest = null;
                    goals.forEach(function(g) { if (!nearest || (g.year && g.year >= now && g.year < (nearest.year || 9999))) nearest = g; });
                    if (nearest) { qamG.textContent = nearest.name + ' ' + nearest.year; qamG.style.display = ''; }
                    else { qamG.style.display = 'none'; }
                } else { qamG.style.display = 'none'; }
            }

            // Total assets
            var qamS = document.getElementById('qam-summary');
            if (qamS) {
                var total = 0;
                plan.investments.forEach(function(inv) { if (inv.include) total += (inv.amount || 0); });
                if (total > 0) { qamS.textContent = formatCurrency(total); qamS.style.display = ''; }
                else { qamS.style.display = 'none'; }
            }
        } catch(e) { console.error('updateQAMetrics:', e); }
    }

    // ============================================================
    // 5. HOOK renderDashboard — add metric updates
    // ============================================================
    function hookRenderDashboard() {
        if (typeof window.renderDashboard !== 'function') {
            console.warn('  ⚠️ renderDashboard not found, retrying...');
            return false;
        }

        var _orig = window.renderDashboard;
        window.renderDashboard = function() {
            _orig.apply(this, arguments);
            // Ensure DOM elements exist
            injectProfileFab();
            injectQASection();
            markSecondaryGrid();
            // Update metrics
            updateQAMetrics();
        };
        console.log('  ✅ renderDashboard hooked');
        return true;
    }

    // ============================================================
    // 6. HOOK showLaunchpad — ensure elements persist
    // ============================================================
    function hookShowLaunchpad() {
        if (typeof window.showLaunchpad !== 'function') return false;

        var _orig = window.showLaunchpad;
        window.showLaunchpad = function() {
            _orig.apply(this, arguments);
            injectProfileFab();
            injectQASection();
            markSecondaryGrid();
            updateQAMetrics();
        };
        console.log('  ✅ showLaunchpad hooked');
        return true;
    }

    // ============================================================
    // 7. INIT — Run immediately (since this loads after inline script)
    // ============================================================
    function initV8() {
        console.log('  dashboard-v8 initializing...');

        // Inject DOM elements now
        injectProfileFab();
        injectQASection();
        markSecondaryGrid();

        // Hook functions
        hookRenderDashboard();
        hookShowLaunchpad();

        // Update metrics after a short delay
        setTimeout(updateQAMetrics, 300);

        console.log('✅ dashboard-v8.js v8 ready');
    }

    // Run immediately — this script loads AFTER everything else
    initV8();

})();
