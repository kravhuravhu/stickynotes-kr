import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { NoteWindow } from './noteWindow.js';
import { Storage } from './storage.js';

export const NoteManager = GObject.registerClass(class NoteManager extends GObject.Object {
    _init(extensionUuid, settings) {
        super._init();
        this._uuid = extensionUuid;
        this._settings = settings;
        this._notes = [];
        this._reminderSources = new Map();

        // Safe get for settings
        const saveDir = this._getSafe('save-directory', '');
        this._storage = new Storage(this._uuid, saveDir);

        this._settings.connect('changed::save-directory', () => {
            this._storage.setCustomDirectory(this._getSafe('save-directory', ''));
        });

        this._loadNotes();
    }

    _getSafe(key, fallback) {
        try { return this._settings.get_string(key); }
        catch { return fallback; }
    }

    _loadNotes() {
        const saved = this._storage.load();
        saved.forEach(data => this._createNoteFromData(data));
    }

    _createNoteFromData(data) {
        const note = new NoteWindow(data, this._settings);
        note.connect('closing', () => this._removeNote(note));
        note.connect('changed', () => this._scheduleSave());
        note.connect('reminder-set', (_, timeMs) => this._scheduleReminder(note, timeMs));

        Main.layoutManager.uiGroup.add_child(note);
        this._notes.push(note);

        if (data.reminder && data.reminder > Date.now()) {
            this._scheduleReminder(note, data.reminder);
        }
        return note;
    }

    createNew() {
        return this._createNoteFromData({});
    }

    _scheduleReminder(note, triggerTimeMs) {
        if (this._reminderSources.has(note._id)) {
            this._reminderSources.get(note._id).destroy();
        }

        const now = Date.now();
        if (triggerTimeMs <= now) return;

        const delay = triggerTimeMs - now;
        const source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._showReminderNotification(note);
            this._reminderSources.delete(note._id);
            return false;
        });
        this._reminderSources.set(note._id, source);
    }

    _showReminderNotification(note) {
        const title = note._titleEntry.text || 'Sticky Note Reminder';
        const body = note._contentEntry.text.substring(0, 80) +
            (note._contentEntry.text.length > 80 ? '...' : '') || 'Your reminder is due.';

        const notif = new Gio.Notification();
        notif.set_title(`⏰ ${title}`);
        notif.set_body(body);
        notif.set_priority(Gio.NotificationPriority.HIGH);

        const app = Gio.Application.get_default();
        if (app) app.send_notification(`reminder-${note._id}`, notif);
    }

    _removeNote(note) {
        if (this._reminderSources.has(note._id)) {
            GLib.Source.remove(this._reminderSources.get(note._id));
            this._reminderSources.delete(note._id);
        }
        note.destroy();
        this._notes = this._notes.filter(n => n !== note);
        this._scheduleSave();
    }

    _scheduleSave() {
        if (this._saveTimeout) GLib.Source.remove(this._saveTimeout);
        this._saveTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._storage.save(this._notes.map(n => n.getData()));
            this._saveTimeout = null;
            return false;
        });
    }

    destroy() {
        this._reminderSources.forEach(src => GLib.Source.remove(src));
        this._reminderSources.clear();
        if (this._saveTimeout) GLib.Source.remove(this._saveTimeout);
        this._storage.save(this._notes.map(n => n.getData()));
        this._notes.forEach(n => n.destroy());
        this._notes = [];
    }
});
