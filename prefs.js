const ExtensionUtils = imports.misc.extensionUtils;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

function init() {
    return new StickyNotesPrefsWidget();
}

var StickyNotesPrefsWidget = GObject.registerClass({
    GTypeName: 'StickyNotesPrefsWidget'
}, class StickyNotesPrefsWidget extends Gtk.Box {
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10
        });

        this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.sticky-notes');
        this._buildUI();
    }

    _buildUI() {
        // Transparency setting
        this._addScaleSetting('Note Body Transparency:', 'default-body-transparency', 0.0, 1.0, 0.1);

        // Font size setting
        this._addSpinSetting('Font Size:', 'note-font-size', 8, 72, 1);

        // Header height setting
        this._addSpinSetting('Header Height:', 'header-height', 20, 100, 1);

        // Default width setting
        this._addSpinSetting('Default Width:', 'default-width', 100, 800, 10);

        // Default height setting
        this._addSpinSetting('Default Height:', 'default-height', 100, 800, 10);

        // Random colors setting
        this._addSwitchSetting('Use Random Colors:', 'use-random-color');

        // Color palette setting
        this._addColorPaletteSetting();
    }

    _addScaleSetting(labelText, settingKey, min, max, step) {
        let row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        let label = new Gtk.Label({ label: labelText, hexpand: true, xalign: 0 });
        row.append(label);

        let scale = new Gtk.Scale({
            adjustment: new Gtk.Adjustment({
                value: this._settings.get_double(settingKey),
                lower: min,
                upper: max,
                step_increment: step
            }),
            digits: 1,
            hexpand: true
        });
        scale.connect('value-changed', function(scale) {
            this._settings.set_double(settingKey, scale.get_value());
        }.bind(this));
        row.append(scale);
        this.append(row);
    }

    _addSpinSetting(labelText, settingKey, min, max, step) {
        let row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        let label = new Gtk.Label({ label: labelText, hexpand: true, xalign: 0 });
        row.append(label);

        let spin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                value: this._settings.get_int(settingKey),
                lower: min,
                upper: max,
                step_increment: step
            })
        });
        spin.connect('value-changed', function(spin) {
            this._settings.set_int(settingKey, spin.get_value_as_int());
        }.bind(this));
        row.append(spin);
        this.append(row);
    }

    _addSwitchSetting(labelText, settingKey) {
        let row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        let label = new Gtk.Label({ label: labelText, hexpand: true, xalign: 0 });
        row.append(label);

        let switch_ = new Gtk.Switch({
            active: this._settings.get_boolean(settingKey)
        });
        switch_.connect('notify::active', function(switch_) {
            this._settings.set_boolean(settingKey, switch_.active);
        }.bind(this));
        row.append(switch_);
        this.append(row);
    }

    _addColorPaletteSetting() {
        let colorPaletteRow = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 5 });
        let colorPaletteLabel = new Gtk.Label({
            label: 'Color Palette (hex values, one per line):',
            xalign: 0
        });
        colorPaletteRow.append(colorPaletteLabel);

        let colorPaletteText = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD,
            height_request: 100
        });

        let currentColors = this._settings.get_strv('default-color-palette');
        let buffer = colorPaletteText.get_buffer();
        buffer.set_text(currentColors.join('\n'), -1);

        let scrolledWindow = new Gtk.ScrolledWindow({
            child: colorPaletteText
        });
        colorPaletteRow.append(scrolledWindow);

        let saveColorsButton = new Gtk.Button({
            label: 'Save Colors',
            halign: Gtk.Align.END
        });
        saveColorsButton.connect('clicked', function() {
            let [start, end] = buffer.get_bounds();
            let text = buffer.get_text(start, end, false);
            let colors = text.split('\n').filter(function(color) {
                return /^#[0-9A-Fa-f]{6}$/.test(color);
            });
            if (colors.length > 0) {
                this._settings.set_strv('default-color-palette', colors);
            }
        }.bind(this));
        colorPaletteRow.append(saveColorsButton);
        this.append(colorPaletteRow);
    }
});
