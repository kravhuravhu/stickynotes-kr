import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class StickyNotesPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        page.set_title('General');

        // Save Directory
        const pathGroup = new Adw.PreferencesGroup({ title: 'Storage' });
        const pathRow = new Adw.ActionRow({ title: 'Save Directory' });
        const pathInput = new Gtk.Entry({
            text: settings.get_string('save-directory'),
            hexpand: true,
            margin_start: 12,
            margin_end: 12
        });
        pathInput.connect('changed', e => settings.set_string('save-directory', e.text));
        pathRow.add_suffix(pathInput);
        pathGroup.add(pathRow);
        page.add(pathGroup);

        // Appearance
        const appearGroup = new Adw.PreferencesGroup({ title: 'Appearance' });
        const transp = new Adw.SpinRow({
            title: 'Transparency',
            subtitle: '0 = fully transparent, 1 = opaque',
            adjustment: new Gtk.Adjustment({ lower: 0.3, upper: 1.0, step_increment: 0.05 })
        });
        settings.bind('transparency', transp, 'value', 0);
        appearGroup.add(transp);

        const pinDefault = new Adw.SwitchRow({
            title: 'Always on Top by Default'
        });
        settings.bind('always-on-top-by-default', pinDefault, 'active', 0);
        appearGroup.add(pinDefault);
        page.add(appearGroup);

        // Default Sizes
        const sizeGroup = new Adw.PreferencesGroup({ title: 'Defaults' });
        const defW = new Adw.SpinRow({
            title: 'Default Width',
            adjustment: new Gtk.Adjustment({ lower: 180, upper: 600, step_increment: 10 })
        });
        settings.bind('default-width', defW, 'value', 0);
        sizeGroup.add(defW);

        const defH = new Adw.SpinRow({
            title: 'Default Height',
            adjustment: new Gtk.Adjustment({ lower: 150, upper: 800, step_increment: 10 })
        });
        settings.bind('default-height', defH, 'value', 0);
        sizeGroup.add(defH);
        page.add(sizeGroup);

        window.add(page);
    }
}
