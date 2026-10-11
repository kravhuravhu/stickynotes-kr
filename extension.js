import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { NoteManager } from './noteManager.js';

export default class StickyNotesExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // Auto-create ~/mystickynotes folder on enable
        this._notesDir = Gio.File.new_for_path(GLib.get_home_dir() + '/mystickynotes');
        if (!this._notesDir.query_exists(null)) {
            try {
                this._notesDir.make_directory(null);
                console.log('[StickyNotes] Created folder: ~/mystickynotes');
            } catch (e) {
                console.error(`[StickyNotes] Failed to create folder: ${e}`);
            }
        }

        this._manager = new NoteManager(this._notesDir.get_path(), this._settings);

        // Panel icon
        this._button = new St.Button({
            child: new St.Icon({
                icon_name: 'note-edit-symbolic',
                icon_size: 16,
                style_class: 'system-status-icon'
            }),
            style_class: 'panel-button'
        });
        this._button.connect('clicked', () => this._manager.createNew());
        Main.panel._rightBox.insert_child_at_index(this._button, 0);

        // Hide notes in Overview, show when back
        this._overviewShownId = Main.overview.connect('shown', () => {
            this._manager._notes.forEach(n => { n.visible = false; });
        });
        this._overviewHiddenId = Main.overview.connect('hidden', () => {
            this._manager._notes.forEach(n => { n.visible = true; });
        });
    }

    disable() {
        Main.overview.disconnect(this._overviewShownId);
        Main.overview.disconnect(this._overviewHiddenId);
        this._manager.destroy();
        this._manager = null;
        this._button.destroy();
        this._button = null;
        this._settings = null;
    }
}
