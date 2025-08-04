const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

function init() {
    return new StickyNotesExtension();
}

var StickyNotesExtension = class {
    constructor() {
        this._noteManager = null;
        this._indicator = null;
    }

    enable() {
        const NoteManager = ExtensionUtils.getCurrentExtension().imports.noteManager.NoteManager;
        this._noteManager = new NoteManager();
        this._noteManager.loadNotes();

        // Add panel indicator
        this._indicator = new PanelMenu.Button(0.0, 'Sticky Notes', false);

        let icon = new St.Icon({
            icon_name: 'accessories-text-editor-symbolic',
            style_class: 'system-status-icon'
        });

        this._indicator.add_child(icon);

        let menu = new PopupMenu.PopupMenu(this._indicator, 0.0, St.Side.BOTTOM);
        this._indicator.menu = menu;

        // Add menu items
        let newNoteItem = new PopupMenu.PopupMenuItem('New Note');
        newNoteItem.connect('activate', function() {
            this._noteManager.createNewNote();
        }.bind(this));
        menu.addMenuItem(newNoteItem);

        let settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', function() {
            ExtensionUtils.openPrefs();
        });
        menu.addMenuItem(settingsItem);

        Main.panel.addToStatusArea('sticky-notes-indicator', this._indicator);
    }

    disable() {
        if (this._noteManager) {
            this._noteManager.saveNotes();
            this._noteManager.destroyAllNotes();
            this._noteManager = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
};
