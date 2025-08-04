const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const ExtensionUtils = imports.misc.extensionUtils;

var NoteWindow = GObject.registerClass({
    Signals: {
        'closed': { param_types: [GObject.TYPE_INT] }
    }
}, class NoteWindow extends Gtk.Window {
    _init(noteId, noteManager, params) {
        super._init({
            title: 'Sticky Note ' + noteId,
            default_width: params.width || 250,
            default_height: params.height || 300,
            decorated: false,
            resizable: true,
            type: Gtk.WindowType.TOPLEVEL
        });

        this.id = noteId;
        this._noteManager = noteManager;
        this._settings = noteManager.getSettings();
        this._isPinned = params.isPinned || false;
        this._headerColor = params.color || '#f9e2af';
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
        this._isDragging = false;

        this._buildUI(params.content || '');
        this._setupEventHandlers();

        if (params.x !== -1 && params.y !== -1) {
            this.move(params.x, params.y);
        }

        this.set_keep_above(this._isPinned);
    }

    _buildUI(content) {
        // Main box
        this._mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        this.set_child(this._mainBox);

        // Header
        this._headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            height_request: this._settings.get_int('header-height')
        });
        this._headerBox.get_style_context().add_class('note-header');
        this._headerBox.set_css(
            'background-color: ' + this._headerColor + ';' +
            'border-radius: 8px 8px 0 0;'
        );
        this._mainBox.append(this._headerBox);

        // Header drag area
        this._dragArea = new Gtk.Box({ hexpand: true });
        this._headerBox.append(this._dragArea);

        // Pin button
        this._pinButton = new Gtk.Button({
            icon_name: this._isPinned ? 'view-pin-symbolic' : 'view-unpin-symbolic',
            tooltip_text: this._isPinned ? 'Unpin note' : 'Pin note',
            css_classes: ['flat']
        });
        this._headerBox.append(this._pinButton);

        // Close button
        this._closeButton = new Gtk.Button({
            icon_name: 'window-close-symbolic',
            tooltip_text: 'Close note',
            css_classes: ['flat']
        });
        this._headerBox.append(this._closeButton);

        // Body
        this._bodyBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });
        this._bodyBox.get_style_context().add_class('note-body');
        this._mainBox.append(this._bodyBox);

        // Text view
        this._textView = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD,
            hexpand: true,
            vexpand: true,
            margin_start: 8,
            margin_end: 8,
            margin_top: 8,
            margin_bottom: 8
        });

        let buffer = this._textView.get_buffer();
        buffer.set_text(content, -1);

        let scrolledWindow = new Gtk.ScrolledWindow({
            child: this._textView
        });
        this._bodyBox.append(scrolledWindow);

        this._updateStyle();
    }

    _setupEventHandlers() {
        // Drag area events
        this._dragArea.connect('button-press-event', (_, event) => {
            if (event.button === 1) { // Left mouse button
                this._dragStartX = event.x_root;
                this._dragStartY = event.y_root;
                let [x, y] = this.get_position();
                this._dragOffsetX = x - this._dragStartX;
                this._dragOffsetY = y - this._dragStartY;
                this._isDragging = true;
                return true;
            }
            return false;
        });

        this._dragArea.connect('button-release-event', () => {
            this._isDragging = false;
        });

        this._dragArea.connect('motion-notify-event', (_, event) => {
            if (this._isDragging) {
                let newX = event.x_root + this._dragOffsetX;
                let newY = event.y_root + this._dragOffsetY;
                this.move(newX, newY);
            }
        });

        // Pin button
        this._pinButton.connect('clicked', () => {
            this._isPinned = !this._isPinned;
            this.set_keep_above(this._isPinned);
            this._pinButton.set_icon_name(this._isPinned ? 'view-pin-symbolic' : 'view-unpin-symbolic');
            this._pinButton.set_tooltip_text(this._isPinned ? 'Unpin note' : 'Pin note');
        });

        // Close button
        this._closeButton.connect('clicked', () => {
            this.emit('closed', this.id);
            this._noteManager.destroyNote(this);
        });

        // Settings changes
        this._settings.connect('changed', (_, key) => {
            if (key === 'note-font-size' || key === 'default-body-transparency') {
                this._updateStyle();
            } else if (key === 'header-height') {
                this._headerBox.set_height_request(this._settings.get_int('header-height'));
            }
        });
    }

    _updateStyle() {
        let fontSize = this._settings.get_int('note-font-size');
        let transparency = this._settings.get_double('default-body-transparency');

        let css = `
            .note-body {
                background-color: rgba(255, 255, 255, ${transparency});
                border-radius: 0 0 8px 8px;
            }

            textview {
                font-size: ${fontSize}px;
                background-color: transparent;
            }

            textview text {
                background-color: transparent;
            }
        `;

        let provider = new Gtk.CssProvider();
        provider.load_from_data(css, -1);

        let display = Gdk.Display.get_default();
        Gtk.StyleContext.add_provider_for_display(
            display,
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    }

    getContent() {
        let buffer = this._textView.get_buffer();
        let [start, end] = buffer.get_bounds();
        return buffer.get_text(start, end, false);
    }

    getPosition() {
        return this.get_position();
    }

    getSize() {
        return [this.get_width(), this.get_height()];
    }

    getHeaderColor() {
        return this._headerColor;
    }

    isPinned() {
        return this._isPinned;
    }
});
