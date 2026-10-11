import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

// 5 HIGH-CONTRAST, GLASS-FRIENDLY COLORS
const COLOR_PALETTE = [
    '#F8E2E8',  // soft pink
    '#F8E8D0',  // warm peach
    '#F6F0C8',  // soft yellow
    '#D8E8E8',  // cool mint
    '#E0E8F0'   // light blue
];

export const NoteWindow = GObject.registerClass({
    GTypeName: 'StickyNoteWindow',
    Signals: {
        'closing': {},
        'changed': {},
        'reminder-set': { param_types: [GObject.TYPE_DOUBLE] }
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
        this._isPinned = noteData.isPinned ?? (settings?.get_boolean('always-on-top-by-default') ?? false);
        this._color = noteData.color || COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
        this._x = noteData.x ?? 150 + Math.random() * 300;
        this._y = noteData.y ?? 150 + Math.random() * 200;
        this._width = noteData.width ?? (settings?.get_int('default-width') ?? 300);
        this._height = noteData.height ?? (settings?.get_int('default-height') ?? 260);
        this._lastModified = noteData.lastModified || Date.now();
        this._reminder = noteData.reminder || null;
        this._isFocused = false;

        // CRITICAL: Set background color on the OUTER widget
        this._applyBaseStyle();

        this._buildUI(noteData.title || '', noteData.content || '');
        this._setupDrag();
        this._setupResize();
        this._applyGeometry();
        this._updateOpacity();
        this._updateStacking();

        this.connect('enter-event', () => { this._isFocused = true; this._updateOpacity(); });
        this.connect('leave-event', () => { this._isFocused = false; this._updateOpacity(); });
    }

    _applyBaseStyle() {
        this.set_style(`
            background-color: ${this._color};
            border-radius: 10px;
        `);
    }

    _updateOpacity() {
        // Whole note ~80% transparent, slightly brighter on hover
        const baseOpacity = 0.82;
        const focusedOpacity = 0.92;
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
            hint_text: 'Title...',
            style_class: 'note-title',
            can_focus: true,
            x_expand: true
        });
        this._titleEntry.connect('notify::text', () => this._markChanged());

        this._pinBtn = new St.Button({
            child: new St.Icon({ icon_name: 'pin-symbolic', icon_size: 14 }),
            style_class: 'note-btn',
            reactive: true
        });
        this._pinBtn.connect('clicked', () => {
            this._isPinned = !this._isPinned;
            this._updateStacking();
            this._markChanged();
        });

        this._reminderBtn = new St.Button({
            child: new St.Icon({ icon_name: 'alarm-symbolic', icon_size: 14 }),
            style_class: 'note-btn',
            reactive: true
        });
        this._reminderBtn.connect('clicked', () => this._showReminderDialog());

        const closeBtn = new St.Button({
            child: new St.Icon({ icon_name: 'window-close-symbolic', icon_size: 14 }),
            style_class: 'note-btn',
            reactive: true
        });
        closeBtn.connect('clicked', () => this.emit('closing'));

        this._header.add_child(this._titleEntry);
        this._header.add_child(this._pinBtn);
        this._header.add_child(this._reminderBtn);
        this._header.add_child(closeBtn);
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
        this.add_child(this._contentView);

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
        this._reminderLabel = new St.Label({
            text: this._reminder ? `⏰ ${this._formatTime(this._reminder)}` : '',
            style_class: this._reminder ? 'reminder-set' : 'note-status-text'
        });
        this._statusBar.add_child(this._timeLabel);
        this._statusBar.add_child(this._reminderLabel);
        this.add_child(this._statusBar);

        // Resize handle
        this._resizeHandle = new St.Widget({
            style_class: 'note-resize-handle',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            reactive: true,
            width: 18,
            height: 18
        });
        this.add_child(this._resizeHandle);

        this._updateReminderDisplay();
    }

    _setupDrag() {
        let dragging = false, startX, startY, origX, origY;
        this._header.connect('button-press-event', (actor, evt) => {
            if (evt.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
            const btn = evt.get_event_actor();
            if (btn && btn.has_style_class_name('note-btn')) return Clutter.EVENT_PROPAGATE;
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
            this._width = Math.max(220, origW + (x - startX));
            this._height = Math.max(160, origH + (y - startY));
            this.set_size(this._width, this._height);
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

    _updateStacking() {
        const parent = this.get_parent();
        if (!parent) return;
        if (this._isPinned) {
            parent.set_child_above_sibling(this, null);
        }
        this._pinBtn.set_style(`color: ${this._isPinned ? '#2E7D32' : '#666'};`);
    }

    _showReminderDialog() {
        const now = Date.now();
        const options = [
            { label: 'In 30 minutes', ms: now + 1800000 },
            { label: 'In 1 hour', ms: now + 3600000 },
            { label: 'In 3 hours', ms: now + 10800000 },
            { label: 'Tomorrow', ms: now + 86400000 },
            { label: 'Clear reminder', ms: null }
        ];
        const menu = new St.Menu({ x: 0, y: 0 });
        options.forEach(opt => {
            const item = new St.MenuItem({ label: opt.label });
            item.connect('activate', () => {
                this._reminder = opt.ms;
                this._updateReminderDisplay();
                this._markChanged();
                if (opt.ms) this.emit('reminder-set', opt.ms);
            });
            menu.addMenuItem(item);
        });
        menu.open(St.PopupDirection.DOWN, this._reminderBtn);
    }

    _updateReminderDisplay() {
        if (!this._reminderLabel) return;
        if (this._reminder) {
            this._reminderLabel.set_text(`⏰ ${this._formatTime(this._reminder)}`);
            this._reminderLabel.add_style_class_name('reminder-set');
        } else {
            this._reminderLabel.set_text('');
            this._reminderLabel.remove_style_class_name('reminder-set');
        }
    }

    _formatTime(ms) {
        return new Date(ms).toLocaleString();
    }

    _markChanged() {
        this._lastModified = Date.now();
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
            isPinned: this._isPinned,
            lastModified: this._lastModified,
            reminder: this._reminder
        };
    }
});
