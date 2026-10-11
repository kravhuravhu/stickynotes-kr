import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class Storage {
    constructor(uuid, customDir = null) {
        this._uuid = uuid;
        this._customDir = customDir;
        this._dataDir = this._resolveDataDir();
        this._file = this._dataDir.get_child('notes.json');
    }

    _resolveDataDir() {
        if (this._customDir && this._customDir.trim() !== '') {
            return Gio.File.new_for_path(this._customDir.trim());
        }
        return Gio.File.new_for_path(
            `${GLib.get_user_data_dir()}/gnome-shell/extensions/${this._uuid}`
        );
    }

    setCustomDirectory(path) {
        this._customDir = path;
        this._dataDir = this._resolveDataDir();
        this._file = this._dataDir.get_child('notes.json');
    }

    load() {
        try {
            if (!this._file.query_exists(null)) return [];
            const [, contents] = this._file.load_contents(null);
            return JSON.parse(new TextDecoder().decode(contents));
        } catch (e) {
            console.warn(`[StickyNotes] Load failed: ${e}`);
            return [];
        }
    }

    save(notes) {
        try {
            // FIX: Only create if NOT exists
            if (!this._dataDir.query_exists(null)) {
                this._dataDir.make_directory_with_parents(null);
            }
            const data = JSON.stringify(notes, null, 2);
            this._file.replace_contents(
                data, null, false, Gio.FileCreateFlags.NONE, null
            );
        } catch (e) {
            console.error(`[StickyNotes] Save failed: ${e}`);
        }
    }
}
