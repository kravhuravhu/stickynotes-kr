const ExtensionUtils = imports.misc.extensionUtils;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

var NoteManager = class NoteManager {
    constructor() {
        this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.sticky-notes');
        this._notes = [];
        this._nextNoteId = 1;
    }

    createNewNote(content, x, y, width, height, color, isPinned) {
        content = content || '';
        x = x || -1;
        y = y || -1;
        width = width || this._settings.get_int('default-width');
        height = height || this._settings.get_int('default-height');

        if (color === null && this._settings.get_boolean('use-random-color')) {
            let palette = this._settings.get_strv('default-color-palette');
            color = palette[Math.floor(Math.random() * palette.length)];
        }

        let noteId = this._nextNoteId++;
        let NoteWindow = ExtensionUtils.getCurrentExtension().imports.noteWindow.NoteWindow;
        let note = new NoteWindow(noteId, this, {
            content: content,
            x: x,
            y: y,
            width: width,
            height: height,
            color: color,
            isPinned: isPinned || false
        });

        this._notes.push(note);
        return note;
    }

    loadNotes() {
        let notesData = JSON.parse(this._settings.get_string('notes-data'));

        notesData.forEach(noteData => {
            this.createNewNote(
                noteData.content,
                noteData.x,
                noteData.y,
                noteData.width,
                noteData.height,
                noteData.color,
                noteData.isPinned
            );
        });
    }

    saveNotes() {
        let notesData = this._notes.map(note => ({
            id: note.id,
            content: note.getContent(),
            x: note.getPosition()[0],
            y: note.getPosition()[1],
            width: note.getSize()[0],
            height: note.getSize()[1],
            color: note.getHeaderColor(),
            isPinned: note.isPinned()
        }));

        this._settings.set_string('notes-data', JSON.stringify(notesData));
    }

    destroyNote(note) {
        let index = this._notes.indexOf(note);
        if (index !== -1) {
            this._notes.splice(index, 1);
            note.destroy();
        }
    }

    destroyAllNotes() {
        this._notes.forEach(note => note.destroy());
        this._notes = [];
    }

    getSettings() {
        return this._settings;
    }
};
