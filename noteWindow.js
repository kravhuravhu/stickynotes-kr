import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';

const COLOR_PALETTE = [
    { name: 'Yellow',   bg: '#FEF3C7', header: '#FDE68A', text: '#422006', accent: '#D97706' },
    { name: 'Pink',     bg: '#FCE7F3', header: '#FBCFE8', text: '#500724', accent: '#DB2777' },
    { name: 'Green',    bg: '#DCFCE7', header: '#BBF7D0', text: '#052E16', accent: '#16A34A' },
    { name: 'Purple',   bg: '#EDE9FE', header: '#DDD6FE', text: '#2E1065', accent: '#7C3AED' },
    { name: 'Blue',     bg: '#DBEAFE', header: '#BFDBFE', text: '#172554', accent: '#2563EB' },
    { name: 'Gray',     bg: '#F3F4F6', header: '#E5E7EB', text: '#111827', accent: '#4B5563' },
    { name: 'Charcoal', bg: '#374151', header: '#1F2937', text: '#F9FAFB', accent: '#9CA3AF' },
    { name: 'Orange',   bg: '#FFEDD5', header: '#FED7AA', text: '#78350F', accent: '#EA580C' },
];

export const NoteWindow = GObject.registerClass({
    GTypeName: 'StickyNoteWindow',
    Signals: {
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
            style_class: 'note-window',
            clip_to_allocation: true
        });
        this._settings = settings;
        this._id = noteData.id || `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this._isMinimized = false;
        this._dragging = false;
        this._resizing = false;
        this._palette = this._resolvePalette(noteData.color);

        const count = (global._stickyNoteCount = (global._stickyNoteCount || 0) + 1);
        this._x = noteData.x ?? 120 + (count % 5) * 40;
        this._y = noteData.y ?? 120 + (count % 5) * 40;
        this._width = noteData.width ?? 280;
        this._height = noteData.height ?? 280;
        this._lastModified = noteData.lastModified || Date.now();

        this._applyBaseStyle();
        this._buildUI(noteData.title || '', noteData.content || '');
        this._setupDrag();
        this._setupResize();
        this._applyGeometry();
    }

    _resolvePalette(colorValue) {
        if (!colorValue) return this._pickRandomPalette();
        if (typeof colorValue === 'object' && colorValue.name) {
            return COLOR_PALETTE.find(p => p.name === colorValue.name) || this._pickRandomPalette();
        }
        if (typeof colorValue === 'string') {
            return COLOR_PALETTE.find(p => p.name === colorValue || p.bg === colorValue) || this._pickRandomPalette();
        }
        return this._pickRandomPalette();
    }

    _pickRandomPalette() {
        const now = Date.now();
        const index = Math.floor((Math.random() * now) % COLOR_PALETTE.length);
        return COLOR_PALETTE[Math.max(0, index)];
    }

    _applyBaseStyle() {
        const p = this._palette;
        this.set_style(`
            background-color: ${p.bg};
            border-radius: 14px;
            border: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.08);
        `);
    }

    _buildUI(titleText, contentText) {
        this.set_size(this._width, this._height);
        this.set_position(this._x, this._y);
        const p = this._palette;

        // ─── HEADER ────────────────────────────────────────────
        this._header = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            reactive: true,
            x_expand: true,
            style: `
                background-color: ${p.header};
                padding: 6px 8px 6px 10px;
                border-top-left-radius: 14px;
                border-top-right-radius: 14px;
            `
        });

        // ✅ DRAG HANDLE — ONLY this icon triggers drag (no conflicts)
        this._dragHandle = new St.Button({
            reactive: true,
            can_focus: false,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: `
                background: transparent;
                border-radius: 6px;
                padding: 4px 6px;
                margin-right: 6px;
                cursor: grab;
            `
        });
        this._dragHandle.set_child(new St.Icon({
            icon_name: 'open-menu-symbolic',
            icon_size: 16,
            style: `color: ${p.text};`
        }));

        this._titleEntry = new St.Entry({
            text: titleText,
            hint_text: 'Title',
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: `
                color: ${p.text};
                font-weight: 600;
                font-size: 14px;
                background: transparent;
                border: none;
                padding: 4px 0;
                caret-color: ${p.accent};
            `
        });
        this._titleEntry.clutter_text.set_single_line_mode(true);
        this._titleEntry.clutter_text.connect('text-changed', () => {
            this._lastModified = Date.now();
            this._markChanged();
        });

        this._minBtn = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: `
                background: transparent;
                border-radius: 6px;
                padding: 6px;
                margin-left: 4px;
                color: ${p.text};
            `
        });
        this._minBtn.set_child(new St.Icon({
            icon_name: 'window-minimize-symbolic',
            icon_size: 14,
            style: `color: ${p.text};`
        }));

        this._delBtn = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: `
                background: transparent;
                border-radius: 6px;
                padding: 6px;
                margin-left: 2px;
                color: ${p.text};
            `
        });
        this._delBtn.set_child(new St.Icon({
            icon_name: 'user-trash-symbolic',
            icon_size: 14,
            style: `color: ${p.text};`
        }));

        this._minBtn.connect('clicked', () => this._toggleMinimize());
        this._delBtn.connect('clicked', () => this.emit('deleting'));

        this._minBtn.connect('enter-event', () => {
            this._minBtn.set_style(`background: rgba(0,0,0,0.1); border-radius: 6px; padding: 6px; margin-left: 4px; color: ${p.text};`);
        });
        this._minBtn.connect('leave-event', () => {
            this._minBtn.set_style(`background: transparent; border-radius: 6px; padding: 6px; margin-left: 4px; color: ${p.text};`);
        });
        this._delBtn.connect('enter-event', () => {
            this._delBtn.set_style(`background: rgba(0,0,0,0.1); border-radius: 6px; padding: 6px; margin-left: 2px; color: ${p.text};`);
        });
        this._delBtn.connect('leave-event', () => {
            this._delBtn.set_style(`background: transparent; border-radius: 6px; padding: 6px; margin-left: 2px; color: ${p.text};`);
        });

        this._header.add_child(this._dragHandle);
        this._header.add_child(this._titleEntry);
        this._header.add_child(this._minBtn);
        this._header.add_child(this._delBtn);
        this.add_child(this._header);

        // ─── BODY / MULTI-LINE EDITOR ──────────────────────────
        this._bodyContainer = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style: `
                background-color: ${p.bg};
                padding: 12px 14px;
                border-bottom-left-radius: 14px;
                border-bottom-right-radius: 14px;
            `
        });

        // ✅ Proper multi-line setup — Enter = new line
        this._contentEntry = new St.Entry({
            text: contentText,
            hint_text: 'Write something…',
            can_focus: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START
        });

        const ct = this._contentEntry.clutter_text;
        ct.set_single_line_mode(false);       // Multi-line ✅
        ct.set_line_wrap(true);                // Auto-wrap ✅
        ct.set_activatable(false);             // Enter = new line, NOT submit ✅
        ct.set_editable(true);
        ct.set_selectable(true);
        ct.y_align = Clutter.ActorAlign.START; // Text starts at top ✅

        this._contentEntry.set_style(`
            color: ${p.text};
            font-size: 13px;
            font-weight: 400;
            background: transparent;
            border: none;
            padding: 0;
            caret-color: ${p.accent};
        `);

        // ✅ Ensure new notes get focus + click anywhere to edit
        this._contentEntry.connect('notify::mapped', () => {
            if (!contentText) this._contentEntry.grab_key_focus();
        });
        this._bodyContainer.connect('button-press-event', () => {
            if (!this._isMinimized) this._contentEntry.grab_key_focus();
            return Clutter.EVENT_PROPAGATE;
        });

        ct.connect('text-changed', () => {
            this._lastModified = Date.now();
            this._markChanged();
        });

        this._bodyContainer.add_child(this._contentEntry);
        this.add_child(this._bodyContainer);

        // ─── RESIZE HANDLE ─────────────────────────────────────
        this._resizeHandle = new St.Widget({
            style: `
                background: linear-gradient(135deg,
                    transparent 0%, transparent 55%,
                    ${p.text} 55%, ${p.text} 65%,
                    transparent 65%, transparent 78%,
                    ${p.text} 78%, ${p.text} 88%,
                    transparent 88%);
                border-bottom-right-radius: 14px;
                width: 18px;
                height: 18px;
                opacity: 0.35;
            `,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            reactive: true,
            width: 18,
            height: 18
        });
        this.add_child(this._resizeHandle);
    }

    _toggleMinimize() {
        this._isMinimized = !this._isMinimized;
        if (this._dragging) {
            this._dragging = false;
            this._dragStart = null;
        }
        this._dragHandle.reactive = !this._isMinimized;
        this._bodyContainer.visible = !this._isMinimized;
        this._resizeHandle.visible = !this._isMinimized;
        this.set_size(this._width, this._isMinimized ? 44 : this._height);
        this.emit('minimizing');
    }

    // ✅ DRAG — ONLY from the dedicated handle icon
    _setupDrag() {
        this._dragHandle.connect('button-press-event', (_, evt) => {
            if (this._isMinimized) return Clutter.EVENT_PROPAGATE;
            if (evt.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;

            this._dragging = true;
            const [sx, sy] = evt.get_coords();
            const [ox, oy] = this.get_position();
            this._dragStart = { sx, sy, ox, oy };
            this._dragHandle.set_style(`background: rgba(0,0,0,0.15); border-radius: 6px; padding: 4px 6px; margin-right: 6px; cursor: grabbing;`);
            return Clutter.EVENT_STOP;
        });

        this._dragHandle.connect('motion-event', (_, evt) => {
            if (!this._dragging || this._isMinimized) return Clutter.EVENT_PROPAGATE;
            const [x, y] = evt.get_coords();
            const d = this._dragStart;
            this._x = Math.max(0, d.ox + (x - d.sx));
            this._y = Math.max(0, d.oy + (y - d.sy));
            this.set_position(this._x, this._y);
            return Clutter.EVENT_STOP;
        });

        this._dragHandle.connect('button-release-event', () => {
            if (this._dragging) {
                this._dragging = false;
                this._dragStart = null;
                this._dragHandle.set_style(`background: transparent; border-radius: 6px; padding: 4px 6px; margin-right: 6px; cursor: grab;`);
                this._markChanged();
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _setupResize() {
        this._resizeHandle.connect('button-press-event', (_, evt) => {
            if (this._isMinimized) return Clutter.EVENT_PROPAGATE;
            if (evt.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
            this._resizing = true;
            const [sx, sy] = evt.get_coords();
            const [ow, oh] = this.get_size();
            this._resizeStart = { sx, sy, ow, oh };
            return Clutter.EVENT_STOP;
        });

        this._resizeHandle.connect('motion-event', (_, evt) => {
            if (!this._resizing || this._isMinimized) return Clutter.EVENT_PROPAGATE;
            const [x, y] = evt.get_coords();
            const d = this._resizeStart;
            this._width = Math.max(220, d.ow + (x - d.sx));
            this._height = Math.max(160, d.oh + (y - d.sy));
            this.set_size(this._width, this._height);
            return Clutter.EVENT_STOP;
        });

        this._resizeHandle.connect('button-release-event', () => {
            if (this._resizing) {
                this._resizing = false;
                this._resizeStart = null;
                this._markChanged();
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _applyGeometry() {
        this.set_position(this._x, this._y);
        this.set_size(this._width, this._height);
    }

    _markChanged() {
        this.emit('changed');
    }

    getData() {
        return {
            id: this._id,
            title: this._titleEntry.get_text(),
            content: this._contentEntry.get_text(),
            color: this._palette,
            x: this._x,
            y: this._y,
            width: this._width,
            height: this._height,
            lastModified: this._lastModified
        };
    }
});
