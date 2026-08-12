// ============================================================
// sidemenu.js — Right-side sliding navigation menu
// ★ Loaded AFTER script.js and the openModule/showLaunchpad
//   functions defined inline in index.html.
// ★ Consolidates access to all module tabs that used to sit in
//   the launchpad-grid at the bottom of the home screen.
// ============================================================

(function () {
    'use strict';

    function getMenuEls() {
        return {
            overlay: document.getElementById('sideMenuOverlay'),
            menu: document.getElementById('sideMenu')
        };
    }

    function openSideMenu() {
        var els = getMenuEls();
        if (!els.overlay || !els.menu) return;
        els.overlay.classList.add('open');
        els.menu.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    window.openSideMenu = openSideMenu;

    function closeSideMenu() {
        var els = getMenuEls();
        if (!els.overlay || !els.menu) return;
        els.overlay.classList.remove('open');
        els.menu.classList.remove('open');
        document.body.style.overflow = '';
    }
    window.closeSideMenu = closeSideMenu;

    function toggleSideMenu() {
        var els = getMenuEls();
        if (!els.menu) return;
        if (els.menu.classList.contains('open')) {
            closeSideMenu();
        } else {
            openSideMenu();
        }
    }
    window.toggleSideMenu = toggleSideMenu;

    // Navigate to a module tab from the menu
    function sideMenuNavigate(panelId) {
        closeSideMenu();
        setTimeout(function () {
            if (typeof openModule === 'function') openModule(panelId);
        }, 180);
    }
    window.sideMenuNavigate = sideMenuNavigate;

    // "הפק דו״ח מסכם" — runs the existing report generator instead of opening a panel
    function sideMenuReport() {
        closeSideMenu();
        setTimeout(function () {
            if (typeof generateReport === 'function') generateReport();
        }, 180);
    }
    window.sideMenuReport = sideMenuReport;

    // "תזרים חודשי" — reserved slot, not yet implemented
    function sideMenuComingSoon() {
        if (typeof showSaveNotification === 'function') {
            showSaveNotification('🚧 תזרים חודשי — בקרוב!');
        } else {
            alert('🚧 תזרים חודשי — בקרוב!');
        }
    }
    window.sideMenuComingSoon = sideMenuComingSoon;

    // Footer "חזרה לדף הבית" button
    function sideMenuGoHome() {
        closeSideMenu();
        setTimeout(function () {
            if (typeof showLaunchpad === 'function') showLaunchpad();
        }, 180);
    }
    window.sideMenuGoHome = sideMenuGoHome;

    // Close the menu with the Escape key, for desktop/keyboard users
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSideMenu();
    });

})();
