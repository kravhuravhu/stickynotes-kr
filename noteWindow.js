import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

const COLOR_PALETTE = [
    '#F8E2E8', '#F8E8D0', '#F6F0C8', '#D8E8E8', '#E0E8F0'
];

export const NoteWindow = GObject.registerClass({
    GTypeName: 'StickyNoteWindow',
    Signals: {
        'closing': {},
        'deleting': {},
        'minimizing': {},
        'changed': {}
    }
}, class NoteWindow extends St.Widget {
    _init(noteData = {}, settings = null) {
        super._init({
            layout_manager: new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL }),
            reactive: true,
            visible: true,
            style_class: 'note-window'
        });
        this._settings = settings;
        this._id = noteData.id || `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this._isMinimized = false;
        this._color = noteData.color || COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
        this._x = noteData.x ?? 150 + Math.random() * 300;
        this._y = noteData.y ?? 150 + Math.random() * 200;
        this._width = noteData.width ?? 320;
        this._height = noteData.height ?? 280;
        this._lastModified = noteData.lastModified || Date.now();
        this._isFocused = false;

        this._applyBaseStyle();
        this._buildUI(noteData.title || '', noteData.content || '');
        this._setupDrag();
        this._setupResize();
        this._applyGeometry();
        this._updateOpacity();

        this.connect('enter-event', () => { this._isFocused = true; this._updateOpacity(); });
        this.connect('leave-event', () => { this._isFocused = false; this._updateOpacity(); });
    }

    _applyBaseStyle() {
        this.set_style(`
            background-color: ${this._color};
            border-radius: 12px;
            border: 2px solid rgba(0,0,0,0.25);
        `);
    }

    _updateOpacity() {
        const baseOpacity = 0.96;
        const focusedOpacity = 0.99;
        const opacity = this._isFocused ? focusedOpacity : baseOpacity;
        this.set_opacity(Math.round(opacity * 255));
    }

    _buildUI(titleText, contentText) {
        this.set_size(this._width, this._height);
        this.set_position(this._x, this._y);

        // Header
        this._header = new St.Widget({
            layout_manager: new Clutter.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            reactive: true,
            style_class: 'note-header',
            x_expand: true
        });

        this._titleEntry = new St.Entry({
            text: titleText,
            hint_text: 'Enter title...',
            style_class: 'note-title',
            can_focus: true,
            x_expand: true
        });
        this._titleEntry.connect('notify::text', () => {
            this._lastModified = Date.now();
            this._markChanged();
        });

        // Minimize button (-)
        this._minBtn = new St.Button({
            child: new St.Icon({ icon_name: 'window-minimize-symbolic', icon_size: 15 }),
            style_class: 'note-btn',
            reactive: true
        });
        this._minBtn.connect('clicked', () => this._toggleMinimize());

        // Delete bin button
        this._delBtn = new St.Button({
            child: new St.Icon({ icon_name: 'user-trash-symbolic', icon_size: 15 }),
            style_class: 'note-btn delete-btn',
            reactive: true
        });
        this._delBtn.connect('clicked', () => this.emit('deleting'));

        // Close button (X) — hides/minimizes
        this._closeBtn = new St.Button({
            child: new St.Icon({ icon_name: 'window-close-symbolic', icon_size: 15 }),
            style_class: 'note-btn close-btn',
            reactive: true
        });
        this._closeBtn.connect('clicked', () => this.emit('closing'));

        this._header.add_child(this._titleEntry);
        this._header.add_child(this._minBtn);
        this._header.add_child(this._delBtn);
        this._header.add_child(this._closeBtn);
        this.add_child(this._header);

        // Content area
        this._contentView = new St.ScrollView({
            x_expand: true, y_expand: true,
            style_class: 'note-content-view',
            hscrollbar_policy: 0,
            vscrollbar_policy: 2
        });

        this._contentContainer = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true, y_expand: true,
            style_class: 'note-content-container'
        });

        this._contentEntry = new St.Entry({
            text: contentText,
            hint_text: 'Write your note here...',
            style_class: 'note-content',
            can_focus: true,
            x_expand: true, y_expand: true
        });
        this._contentEntry.clutter_text.set_line_wrap(true);
        this._contentEntry.connect('notify::text', () => {
            this._lastModified = Date.now();
            this._markChanged();
        });

        this._contentContainer.add_child(this._contentEntry);
        this._contentView.set_child(this._contentContainer);
        this._bodyContainer = new St.Widget({
            layout_manager: new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL }),
            x_expand: true, y_expand: true
        });
        this._bodyContainer.add_child(this._contentView);
        this.add_child(this._bodyContainer);

        // Status bar
        this._statusBar = new St.Widget({
            layout_manager: new Clutter.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            style_class: 'note-status',
            x_expand: true
        });
        this._timeLabel = new St.Label({
            text: `Edited: ${this._formatTime(this._lastModified)}`,
            x_expand: true,
            style_class: 'note-status-text'
        });
        this._statusBar.add_child(this._timeLabel);
        this.add_child(this._statusBar);

        // Resize handle
        this._resizeHandle = new St.Widget({
            style_class: 'note-resize-handle',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            reactive: true,
            width: 20,
            height: 20
        });
        this.add_child(this._resizeHandle);
    }

    _toggleMinimize() {
        this._isMinimized = !this._isMinimized;
        this._bodyContainer.visible = !this._isMinimized;
        this._statusBar.visible = !this._isMinimized;
        this._resizeHandle.visible = !this._isMinimized;
        if (this._isMinimized) {
            this.set_size(this._width, 50);
        } else {
            this.set_size(this._width, this._height);
        }
        this.emit('minimizing');
    }

    _setupDrag() {
        let dragging = false, startX, startY, origX, origY;
        this._header.connect('button-press-event', (actor, evt) => {
            if (evt.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
            const clickTarget = evt.get_source();
            if (clickTarget && (
                clickTarget === this._minBtn ||
                clickTarget === this._delBtn ||
                clickTarget === this._closeBtn ||
                clickTarget.get_parent() === this._minBtn ||
                clickTarget.get_parent() === this._delBtn ||
                clickTarget.get_parent() === this._closeBtn
            )) return Clutter.EVENT_PROPAGATE;
            dragging = true;
            [startX, startY] = evt.get_coords();
            [origX, origY] = this.get_position();
            return Clutter.EVENT_STOP;
        });
        this._header.connect('motion-event', (_, evt) => {
            if (!dragging) return Clutter.EVENT_PROPAGATE;
            const [x, y] = evt.get_coords();
            this._x = Math.max(0, origX + (x - startX));
            this._y = Math.max(0, origY + (y - startY));
            this.set_position(this._x, this._y);
            return Clutter.EVENT_STOP;
        });
        this._header.connect('button-release-event', () => {
            dragging = false;
            this._markChanged();
            return Clutter.EVENT_STOP;
        });
    }

    _setupResize() {
        let resizing = false, startX, startY, origW, origH;
        this._resizeHandle.connect('button-press-event', (_, evt) => {
            if (evt.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
            resizing = true;
            [startX, startY] = evt.get_coords();
            [origW, origH] = this.get_size();
            return Clutter.EVENT_STOP;
        });
        this._resizeHandle.connect('motion-event', (_, evt) => {
            if (!resizing) return Clutter.EVENT_PROPAGATE;
            const [x, y] = evt.get_coords();
            this._width = Math.max(240, origW + (x - startX));
            this._height = Math.max(180, origH + (y - startY));
            if (!this._isMinimized) this.set_size(this._width, this._height);
            return Clutter.EVENT_STOP;
        });
        this._resizeHandle.connect('button-release-event', () => {
            resizing = false;
            this._markChanged();
            return Clutter.EVENT_STOP;
        });
    }

    _applyGeometry() {
        this.set_position(this._x, this._y);
        this.set_size(this._width, this._height);
    }

    _formatTime(ms) {
        return new Date(ms).toLocaleString();
    }

    _markChanged() {
        this._timeLabel?.set_text(`Edited: ${this._formatTime(this._lastModified)}`);
        this.emit('changed');
    }

    getData() {
        return {
            id: this._id,
            title: this._titleEntry.text,
            content: this._contentEntry.text,
            color: this._color,
            x: this._x,
            y: this._y,
            width: this._width,
            height: this._height,
            lastModified: this._lastModified
        };
    }
});
