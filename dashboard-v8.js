// ============================================================
// dashboard-v8.js — Quick-Access Dashboard + Profile FAB
// Load AFTER all other scripts (script.js, patch.js, glide.js, pension-profile-fix.js)
// ============================================================

console.log('✅ dashboard-v8.js loading...');

(function() {
    'use strict';

    // ============================================================
    // 1. PROFILE FAB — Inject into hero-actions
    // ============================================================

    function injectProfileFab() {
        var actions = document.querySelector('.hero-actions');
        if (!actions || document.getElementById('profileFabBtn')) return;

        var fab = document.createElement('button');
        fab.id = 'profileFabBtn';
        fab.className = 'profile-fab';
        fab.title = 'הפרופיל שלנו';
        fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        fab.onclick = function() { openModule('profile'); };

        // Insert as FIRST child so it's on the right in RTL
        actions.insertBefore(fab, actions.firstChild);
    }

    // ============================================================
    // 2. QUICK-ACCESS CARDS — Build the 4 main cards
    // ============================================================

    var QA_CARDS = [
        {
            id: 'qa-pension',
            module: 'pension',
            accent: 'blue',
            iconClass: 'qa-icon-blue',
            icon: '<svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
            title: 'הפנסיה שלי',
            desc: 'צפי קצבה, מס פרוגרסיבי ונטו ריאלי',
            metricFn: function() {
                try {
                    var proj = (typeof calculateFullPensionProjection === 'function') ? calculateFullPensionProjection() : null;
                    if (proj && proj.combined.netReal > 0) return formatCurrency(proj.combined.netReal) + '/חודש';
                } catch(e) {}
                return null;
            }
        },
        {
            id: 'qa-investments',
            module: 'investments',
            accent: 'green',
            iconClass: 'qa-icon-green',
            icon: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
            title: 'תיק הנכסים שלי',
            desc: 'ניהול קרנות, גמל, השתלמות ותיקים עצמאיים',
            metricFn: function() {
                try {
                    var plan = getCurrentPlan();
                    var count = plan.investments.filter(function(i) { return i.include && i.type !== 'פנסיה'; }).length;
                    if (count > 0) return count + ' מסלולים';
                } catch(e) {}
                return null;
            }
        },
        {
            id: 'qa-goals',
            module: 'goals',
            accent: 'amber',
            iconClass: 'qa-icon-amber',
            icon: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
            title: 'החלומות והיעדים שלי',
            desc: 'תכנון דירה, לימודים, רכב וטיולים',
            metricFn: function() {
                try {
                    var plan = getCurrentPlan();
                    var goals = plan.goals.lifeGoals;
                    if (goals && goals.length > 0) {
                        var now = new Date().getFullYear();
                        var nearest = null;
                        goals.forEach(function(g) { if (!nearest || (g.year >= now && g.year < (nearest.year || 9999))) nearest = g; });
                        if (nearest) return nearest.name + ' ' + nearest.year;
                    }
                } catch(e) {}
                return null;
            }
        },
        {
            id: 'qa-summary',
            module: 'summary',
            accent: 'purple',
            iconClass: 'qa-icon-purple',
            icon: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            title: 'העתיד שלנו',
            desc: 'תמונת מצב כוללת, עלויות והמלצות',
            metricFn: function() {
                try {
                    var plan = getCurrentPlan();
                    var total = 0;
                    plan.investments.forEach(function(inv) { if (inv.include) total += (inv.amount || 0); });
                    if (total > 0) return formatCurrency(total);
                } catch(e) {}
                return null;
            }
        }
    ];

    function buildCardHTML(cfg) {
        var metric = '';
        try {
            var val = cfg.metricFn();
            if (val) metric = '<div class="qa-metric">' + val + '</div>';
        } catch(e) {}

        return '<div class="qa-card" id="' + cfg.id + '" data-accent="' + cfg.accent + '" onclick="openModule(\'' + cfg.module + '\')">' +
            metric +
            '<div class="qa-icon ' + cfg.iconClass + '">' + cfg.icon + '</div>' +
            '<div class="qa-title">' + cfg.title + '</div>' +
            '<div class="qa-desc">' + cfg.desc + '</div>' +
            '<div class="qa-arrow">← כניסה</div>' +
        '</div>';
    }

    function injectQuickAccessCards() {
        var launchpad = document.getElementById('launchpad');
        if (!launchpad || document.getElementById('qaSection')) return;

        // Find the insertion point: after dcard-report-row, before dash-snap-row
        var reportRow = launchpad.querySelector('.dcard-report-row');
        var snapRow = launchpad.querySelector('.dash-snap-row');
        var insertBefore = snapRow || launchpad.querySelector('.launchpad-grid');

        // Build section
        var section = document.createElement('div');
        section.id = 'qaSection';
        section.className = 'qa-section';

        var html = '<div class="qa-section-title">גישה מהירה</div>';
        html += '<div class="qa-grid">';
        QA_CARDS.forEach(function(cfg) {
            html += buildCardHTML(cfg);
        });
        html += '</div>';

        section.innerHTML = html;

        // Insert
        if (insertBefore) {
            launchpad.insertBefore(section, insertBefore);
        } else {
            launchpad.appendChild(section);
        }
    }

    // ============================================================
    // 3. MARK SECONDARY GRID + HIDE PROFILE CARD
    // ============================================================

    function markSecondaryGrid() {
        var grid = document.querySelector('.launchpad-grid');
        if (!grid || grid.classList.contains('secondary-grid')) return;

        grid.classList.add('secondary-grid');

        // Add section title before grid
        var title = document.createElement('div');
        title.className = 'launchpad-grid-secondary-title';
        title.textContent = 'כל המודולים';
        grid.parentNode.insertBefore(title, grid);

        // Mark profile card for hiding
        var cards = grid.querySelectorAll('.launch-card');
        cards.forEach(function(card) {
            var onclick = card.getAttribute('onclick') || '';
            if (onclick.indexOf("'profile'") !== -1) {
                card.setAttribute('data-module', 'profile');
            }
        });
    }

    // ============================================================
    // 4. UPDATE METRICS — Refresh card badges on dashboard render
    // ============================================================

    function updateQuickAccessMetrics() {
        QA_CARDS.forEach(function(cfg) {
            var card = document.getElementById(cfg.id);
            if (!card) return;

            try {
                var val = cfg.metricFn();
                var existing = card.querySelector('.qa-metric');

                if (val) {
                    if (existing) {
                        existing.textContent = val;
                    } else {
                        var badge = document.createElement('div');
                        badge.className = 'qa-metric';
                        badge.textContent = val;
                        card.insertBefore(badge, card.firstChild);
                    }
                } else if (existing) {
                    existing.remove();
                }
            } catch(e) {}
        });
    }

    // ============================================================
    // 5. HOOK INTO renderDashboard
    // ============================================================

    var _origRenderDashboard = (typeof renderDashboard === 'function') ? renderDashboard : null;

    window.renderDashboard = function() {
        if (_origRenderDashboard) _origRenderDashboard();

        // Inject elements if not yet present
        injectProfileFab();
        injectQuickAccessCards();
        markSecondaryGrid();

        // Update live metrics
        updateQuickAccessMetrics();
    };

    // ============================================================
    // 6. HOOK INTO showLaunchpad — ensure cards exist
    // ============================================================

    var _origShowLaunchpad = (typeof showLaunchpad === 'function') ? showLaunchpad : null;

    window.showLaunchpad = function() {
        if (_origShowLaunchpad) _origShowLaunchpad();

        // Re-inject if DOM was cleared
        injectProfileFab();
        injectQuickAccessCards();
        markSecondaryGrid();
        updateQuickAccessMetrics();
    };

    // ============================================================
    // 7. INITIAL INJECTION on DOMContentLoaded
    // ============================================================

    function initDashboardV8() {
        injectProfileFab();
        injectQuickAccessCards();
        markSecondaryGrid();

        // Delay metric update to let other scripts finish
        setTimeout(updateQuickAccessMetrics, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initDashboardV8, 150);
        });
    } else {
        setTimeout(initDashboardV8, 150);
    }

    console.log('✅ dashboard-v8.js loaded');
})();
