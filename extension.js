import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { NoteManager } from './noteManager.js';

export default class StickyNotesExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._manager = new NoteManager(this.uuid, this._settings);

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

        // Hide notes when Overview opens
        this._overviewShownId = Main.overview.connect('shown', () => {
            this._manager._notes.forEach(n => n.setVisible(false));
        });
        this._overviewHiddenId = Main.overview.connect('hidden', () => {
            this._manager._notes.forEach(n => n.setVisible(true));
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
