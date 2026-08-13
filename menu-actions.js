// ============================================================
// menu-actions.js — Side menu data actions (plan manager,
// export/import to Excel) + "years" popup for generateReport.
// ★ Loaded AFTER sidemenu.js. Does not edit any core file.
// ============================================================

(function () {
    'use strict';

    // ------------------------------------------------------------
    // Plan manager / export / import — moved here from the removed
    // utility bar. Each closes the side menu first (matching the
    // existing sideMenuNavigate animation) then runs the action.
    // ------------------------------------------------------------
    function sideMenuPlanManager() {
        if (typeof closeSideMenu === 'function') closeSideMenu();
        setTimeout(function () {
            if (typeof showPlanManager === 'function') showPlanManager();
        }, 180);
    }
    window.sideMenuPlanManager = sideMenuPlanManager;

    function sideMenuExportPlan() {
        if (typeof closeSideMenu === 'function') closeSideMenu();
        setTimeout(function () {
            if (typeof exportExcel === 'function') exportExcel();
        }, 180);
    }
    window.sideMenuExportPlan = sideMenuExportPlan;

    function sideMenuImportPlan() {
        if (typeof closeSideMenu === 'function') closeSideMenu();
        setTimeout(function () {
            var input = document.getElementById('excelImport');
            if (input) input.click();
        }, 180);
    }
    window.sideMenuImportPlan = sideMenuImportPlan;

    // ------------------------------------------------------------
    // "הפק דו״ח מסכם" now opens a popup asking how many years of
    // progress to show in the report, then runs the existing
    // report generator with that value.
    // ------------------------------------------------------------
    function openReportYearsModal() {
        if (typeof closeSideMenu === 'function') closeSideMenu();
        setTimeout(function () {
            var modal = document.getElementById('reportYearsModal');
            var input = document.getElementById('reportYearsInput');
            if (input) {
                var existing = document.getElementById('sumYears');
                input.value = (existing && existing.value) ? existing.value : 20;
            }
            if (modal) modal.style.display = 'flex';
        }, 180);
    }
    window.openReportYearsModal = openReportYearsModal;

    function closeReportYearsModal() {
        var modal = document.getElementById('reportYearsModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeReportYearsModal = closeReportYearsModal;

    function confirmReportYears() {
        var input = document.getElementById('reportYearsInput');
        var years = parseInt(input && input.value) || 20;
        if (years < 1) years = 1;
        if (years > 50) years = 50;

        // generateReport() reads its horizon from the #sumYears field,
        // so we sync it here before calling the report generator.
        var sumYears = document.getElementById('sumYears');
        if (sumYears) sumYears.value = years;

        closeReportYearsModal();
        if (typeof generateReport === 'function') generateReport();
    }
    window.confirmReportYears = confirmReportYears;

    // Replace the side menu's report handler (defined in sidemenu.js)
    // so it opens the years popup instead of generating immediately.
    window.sideMenuReport = openReportYearsModal;

    // Close the years modal with Escape, mirroring the side menu.
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeReportYearsModal();
    });

})();
