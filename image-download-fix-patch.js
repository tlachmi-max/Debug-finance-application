// ============================================================
// image-download-fix-patch.js v1
// FIX: "💾 שמור כתמונה" buttons did nothing on iPhone/Safari.
//
// ROOT CAUSE: the original downloadChart() (script.js) builds an
// <a download> link pointing at a data: URI (canvas.toDataURL).
// iOS Safari does not support triggering downloads from data: URIs
// via the download attribute — the click is silently ignored.
//
// FIX: use canvas.toBlob() + a Blob object URL instead. Safari on
// iOS DOES support download-from-blob-URL, so the same button now
// actually saves the PNG (or opens the iOS share/save sheet).
// ============================================================

console.log('✅ image-download-fix-patch.js v1 loading...');

(function () {

    // ------------------------------------------------------------
    // 1. Fix the charts-tab "שמור כתמונה" buttons.
    // ------------------------------------------------------------
    window.downloadChart = function (canvasId, chartName) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            alert('❌ גרף לא נמצא');
            return;
        }

        try {
            // Chart.js canvases have a transparent background. Some
            // iPhone viewers (Photos, dark mode) render transparency
            // as solid black, making the exported chart look empty.
            // Composite the chart onto a plain white canvas first.
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;
            const exportCtx = exportCanvas.getContext('2d');
            exportCtx.fillStyle = '#ffffff';
            exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            exportCtx.drawImage(canvas, 0, 0);

            exportCanvas.toBlob(function (blob) {
                if (!blob) {
                    alert('❌ שגיאה בהורדת הגרף');
                    return;
                }
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `גרף-${chartName}-${new Date().toISOString().split('T')[0]}.png`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
                console.log(`✅ גרף ${chartName} הורד בהצלחה`);
            }, 'image/png');
        } catch (error) {
            console.error('Chart download error:', error);
            alert('❌ שגיאה בהורדת הגרף');
        }
    };

    // ------------------------------------------------------------
    // 2. The generated financial report (opened in a new tab from
    //    "הפק דוח מסכם") only had a print button. Add a matching
    //    "שמור כתמונה" button there too, using the same Blob
    //    approach, powered by html2canvas (already loaded via CDN
    //    in index.html, and re-loaded inside the report's own tab).
    // ------------------------------------------------------------
    const _origGenerateReportForImage = window.generateReport;
    if (typeof _origGenerateReportForImage === 'function') {
        window.generateReport = function () {
            const originalOpen = window.open;
            let reportWindowRef = null;
            window.open = function () {
                reportWindowRef = originalOpen.apply(window, arguments);
                return reportWindowRef;
            };
            try {
                _origGenerateReportForImage.apply(this, arguments);
            } finally {
                window.open = originalOpen;
            }
            if (reportWindowRef) {
                injectSaveImageButton(reportWindowRef);
            }
        };
    }

    function injectSaveImageButton(reportWindow) {
        // Wait for document.write() inside generateReport to finish.
        const tryInject = function (attemptsLeft) {
            if (!reportWindow || reportWindow.closed) return;
            const doc = reportWindow.document;
            if (!doc || !doc.body || !doc.querySelector('.container')) {
                if (attemptsLeft > 0) setTimeout(function () { tryInject(attemptsLeft - 1); }, 100);
                return;
            }
            if (doc.getElementById('saveReportImageBtn')) return; // already injected

            const script = doc.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = function () {
                const btn = doc.createElement('button');
                btn.id = 'saveReportImageBtn';
                btn.className = 'pb'; // reuses the report's "@media print { .pb { display:none } }" rule
                btn.textContent = '💾 שמור כתמונה';
                btn.style.cssText = 'position:fixed;bottom:100px;left:30px;background:#10b981;color:#fff;border:none;padding:16px 24px;border-radius:12px;font-size:1.1em;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,0.4);z-index:1000;font-family:Arial;';

                btn.addEventListener('click', function () {
                    const original = btn.textContent;
                    btn.textContent = '⏳ מכין תמונה...';
                    btn.disabled = true;

                    doc.body.style.paddingBottom = ''; // no-op, keeps layout stable
                    reportWindow.html2canvas(doc.querySelector('.container'), {
                        backgroundColor: '#f9fafb',
                        scale: 2,
                        onclone: function (clonedDoc) {
                            const pb = clonedDoc.querySelectorAll('.pb, #saveReportImageBtn');
                            pb.forEach(function (el) { el.style.display = 'none'; });
                        }
                    }).then(function (canvas) {
                        canvas.toBlob(function (blob) {
                            const url = URL.createObjectURL(blob);
                            const a = doc.createElement('a');
                            a.href = url;
                            a.download = 'דוח-פיננסי-' + new Date().toISOString().split('T')[0] + '.png';
                            doc.body.appendChild(a);
                            a.click();
                            doc.body.removeChild(a);
                            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
                            btn.textContent = original;
                            btn.disabled = false;
                        }, 'image/png');
                    }).catch(function (err) {
                        console.error('Report image error:', err);
                        reportWindow.alert('❌ שגיאה בשמירת התמונה');
                        btn.textContent = original;
                        btn.disabled = false;
                    });
                });

                doc.body.appendChild(btn);
            };
            doc.head.appendChild(script);
        };
        tryInject(20);
    }

})();
