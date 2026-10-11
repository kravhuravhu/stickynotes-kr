import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { NoteWindow } from './noteWindow.js';

export class NoteManager {
    constructor(notesDirPath, settings) {
        this._notesDirPath = notesDirPath;
        this._settings = settings;
        this._notes = [];
        this._notesDir = Gio.File.new_for_path(notesDirPath);
        this._loadExistingNotes();
    }

    get _notes() { return this.__notes; }
    set _notes(val) { this.__notes = val; }

    _sanitizeFilename(name) {
        return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'Untitled';
    }

    _getFilename(title, timestamp) {
        const safeTitle = this._sanitizeFilename(title || 'Untitled');
        return `${safeTitle}_${timestamp}.json`;
    }

    _saveNote(noteWindow) {
        const data = noteWindow.getData();
        // Only save if title is NOT empty
        if (!data.title.trim()) {
            console.log('[StickyNotes] Skipping save — title is empty');
            return;
        }
        const timestamp = data.lastModified;
        const filename = this._getFilename(data.title, timestamp);
        const file = this._notesDir.get_child(filename);
        try {
            const json = JSON.stringify(data, null, 2);
            file.replace_contents(json, null, false, Gio.FileCreateFlags.NONE, null);
            console.log(`[StickyNotes] Saved: ${filename}`);
        } catch (e) {
            console.error(`[StickyNotes] Save failed ${filename}: ${e}`);
        }
    }

    _deleteOldNote(oldData) {
        if (!oldData.title.trim()) return;
        const oldFilename = this._getFilename(oldData.title, oldData.lastModified);
        const oldFile = this._notesDir.get_child(oldFilename);
        if (oldFile.query_exists(null)) {
            try {
                oldFile.delete(null);
                console.log(`[StickyNotes] Deleted old: ${oldFilename}`);
            } catch (e) {
                console.warn(`[StickyNotes] Could not remove old file: ${e}`);
            }
        }
    }

    _loadExistingNotes() {
        if (!this._notesDir.query_exists(null)) return;
        try {
            const iter = this._notesDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = iter.next_file(null))) {
                const name = info.get_name();
                if (name.endsWith('.json')) {
                    const file = this._notesDir.get_child(name);
                    try {
                        const [, contents] = file.load_contents(null);
                        const data = JSON.parse(new TextDecoder().decode(contents));
                        this._createNoteFromData(data, false);
                    } catch (e) {
                        console.warn(`[StickyNotes] Could not load ${name}: ${e}`);
                    }
                }
            }
            iter.close(null);
        } catch (e) {
            console.error(`[StickyNotes] Load error: ${e}`);
        }
    }

    _createNoteFromData(noteData, saveInstantly = false) {
        const note = new NoteWindow(noteData, this._settings);

        // ✅ CRITICAL: Add note to the UI so it's visible!
        Main.layoutManager.uiGroup.add_child(note);

        // Save logic: only save when title changes & is non-empty
        note.connect('changed', () => {
            const currentData = note.getData();
            // Delete old file if title changed
            if (note._prevData && note._prevData.title !== currentData.title) {
                this._deleteOldNote(note._prevData);
            }
            note._prevData = currentData;
            this._saveNote(note);
        });

        note.connect('closing', () => {
            this._notes = this._notes.filter(n => n !== note);
            Main.layoutManager.uiGroup.remove_child(note);
            note.destroy();
        });

        this._notes.push(note);

        // Don't auto-save blank new notes — wait for user to type a title
        if (saveInstantly && noteData.title?.trim()) {
            note._prevData = note.getData();
            this._saveNote(note);
        }
    }

    createNew() {
        this._createNoteFromData({
            x: 150 + Math.random() * 200,
            y: 150 + Math.random() * 150
        }, false); // false = don't save until user enters title
    }

    destroy() {
        this._notes.forEach(n => {
            try { Main.layoutManager.uiGroup.remove_child(n); } catch {}
            n.destroy();
        });
        this._notes = [];
    }
}
