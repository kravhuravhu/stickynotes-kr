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
        if (!data.title.trim()) {
            console.log('[StickyNotes] Skipping save — title empty');
            return;
        }
        const titleKey = data.title.trim();
        if (!noteWindow._titleTimestamp || noteWindow._prevTitle !== titleKey) {
            if (noteWindow._prevTitle) {
                this._deleteFile(noteWindow._prevTitle, noteWindow._titleTimestamp);
            }
            noteWindow._prevTitle = titleKey;
            noteWindow._titleTimestamp = data.lastModified;
        }
        const filename = this._getFilename(titleKey, noteWindow._titleTimestamp);
        const file = this._notesDir.get_child(filename);
        try {
            file.replace_contents(JSON.stringify(data, null, 2), null, false, Gio.FileCreateFlags.NONE, null);
            console.log(`[StickyNotes] Saved: ${filename}`);
        } catch (e) {
            console.error(`[StickyNotes] Save failed: ${e}`);
        }
    }

    _deleteFile(title, timestamp) {
        if (!title?.trim()) return;
        const fn = this._getFilename(title, timestamp);
        const f = this._notesDir.get_child(fn);
        if (f.query_exists(null)) {
            try {
                f.delete(null);
                console.log(`[StickyNotes] Deleted file: ${fn}`);
            } catch (e) {
                console.warn(`[StickyNotes] Delete failed: ${e}`);
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
                        console.warn(`[StickyNotes] Skip ${name}: ${e}`);
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
        if (noteData.title?.trim()) {
            note._prevTitle = noteData.title.trim();
            note._titleTimestamp = noteData.lastModified;
        }
        Main.layoutManager.uiGroup.add_child(note);

        note.connect('changed', () => this._saveNote(note));

        note.connect('minimizing', () => {
            // Minimizing toggles the collapsed state — handled in NoteWindow
        });

        note.connect('deleting', () => {
            // Trash = DELETE file + remove from UI
            if (note._prevTitle) {
                this._deleteFile(note._prevTitle, note._titleTimestamp);
            }
            this._notes = this._notes.filter(n => n !== note);
            try { Main.layoutManager.uiGroup.remove_child(note); } catch {}
            note.destroy();
        });

        this._notes.push(note);
        if (saveInstantly && noteData.title?.trim()) this._saveNote(note);
    }

    createNew() {
        this._createNoteFromData({
            x: 150 + Math.random() * 200,
            y: 150 + Math.random() * 150
        }, false);
    }

    destroy() {
        this._notes.forEach(n => { try { Main.layoutManager.uiGroup.remove_child(n); } catch {}; n.destroy(); });
        this._notes = [];
    }
}
