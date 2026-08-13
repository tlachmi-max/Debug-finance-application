// ============================================================
// notes.js — "תובנות והערות אישיות" (Personal Insights & Notes)
// ★ Loaded AFTER script.js, patch.js, glide.js, pension-profile-fix.js, debts.js
// ★ Adds: plan.notes[] CRUD — free-text notes, each stamped with the
//         date/time it was written (and updated, if edited).
// ============================================================

(function () {
    'use strict';

    var editingNoteIndex = -1;

    // ------------------------------------------------------------
    // Data model helper — ensure plan.notes[] always exists
    // ------------------------------------------------------------
    function ensureNotesArray(plan) {
        if (!plan.notes) plan.notes = [];
        return plan.notes;
    }

    // ------------------------------------------------------------
    // Save (create/update) a note
    // ------------------------------------------------------------
    function saveNote() {
        var plan = getCurrentPlan();
        var notes = ensureNotesArray(plan);
        var textEl = document.getElementById('noteText');
        if (!textEl) return;
        var text = (textEl.value || '').trim();

        if (!text) {
            alert('נא לכתוב תוכן להערה');
            return;
        }

        if (editingNoteIndex >= 0 && notes[editingNoteIndex]) {
            notes[editingNoteIndex].text = text;
            notes[editingNoteIndex].updatedAt = new Date().toISOString();
            editingNoteIndex = -1;
        } else {
            notes.unshift({
                text: text,
                createdAt: new Date().toISOString(),
                updatedAt: null
            });
        }

        saveData();
        resetNoteForm();
        renderNotes();
        if (typeof showSaveNotification === 'function') showSaveNotification('✅ ההערה נשמרה בהצלחה!');
    }
    window.saveNote = saveNote;

    function editNote(index) {
        var plan = getCurrentPlan();
        var note = ensureNotesArray(plan)[index];
        if (!note) return;

        var textEl = document.getElementById('noteText');
        if (textEl) textEl.value = note.text;

        editingNoteIndex = index;
        var saveText = document.getElementById('btnSaveNoteText');
        if (saveText) saveText.textContent = 'עדכן הערה';
        var cancelBtn = document.getElementById('btnCancelNoteEdit');
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';

        if (textEl) {
            textEl.focus();
            textEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    window.editNote = editNote;

    function deleteNote(index) {
        if (!confirm('האם למחוק את ההערה?')) return;
        var plan = getCurrentPlan();
        ensureNotesArray(plan).splice(index, 1);
        saveData();
        if (editingNoteIndex === index) { editingNoteIndex = -1; resetNoteForm(); }
        renderNotes();
    }
    window.deleteNote = deleteNote;

    function cancelEditNote() {
        editingNoteIndex = -1;
        resetNoteForm();
    }
    window.cancelEditNote = cancelEditNote;

    function resetNoteForm() {
        var textEl = document.getElementById('noteText');
        if (textEl) textEl.value = '';
        var saveText = document.getElementById('btnSaveNoteText');
        if (saveText) saveText.textContent = 'שמור הערה';
        var cancelBtn = document.getElementById('btnCancelNoteEdit');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    // ------------------------------------------------------------
    // Render notes list, newest first
    // ------------------------------------------------------------
    function formatNoteTimestamp(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            var datePart = d.toLocaleDateString('he-IL');
            var timePart = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            return datePart + ' · ' + timePart;
        } catch (e) {
            return '';
        }
    }

    function escapeHtml(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderNotes() {
        var plan = getCurrentPlan();
        var notes = ensureNotesArray(plan);
        var container = document.getElementById('notesList');
        if (!container) return;

        if (notes.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">אין הערות עדיין</div><div class="empty-text">רשמו כאן את התובנה או ההחלטה הראשונה שלכם</div></div>';
            return;
        }

        container.innerHTML = notes.map(function (n, i) {
            var stamp = formatNoteTimestamp(n.updatedAt || n.createdAt);
            var editedTag = n.updatedAt ? ' <span style="color:var(--text-muted);">(נערך)</span>' : '';
            var safeText = escapeHtml(n.text).replace(/\n/g, '<br>');
            return '' +
                '<div class="item note-card">' +
                    '<div class="item-header">' +
                        '<div class="note-date">🕒 ' + stamp + editedTag + '</div>' +
                        '<div class="item-actions">' +
                            '<button class="btn btn-primary btn-sm" onclick="editNote(' + i + ')"><span>✏️</span><span>ערוך</span></button>' +
                            '<button class="btn btn-danger btn-sm" onclick="deleteNote(' + i + ')"><span>🗑️</span><span>מחק</span></button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="note-text">' + safeText + '</div>' +
                '</div>';
        }).join('');
    }
    window.renderNotes = renderNotes;

})();
