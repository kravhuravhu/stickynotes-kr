# Sticky Notes (KR Edition)

**UUID:** `stickynotes-kr@kravhuravhu.github.io`  
A GNOME Shell extension that gives you floating, always-on-top sticky notes.  
Fully customizable: color, size, font, transparency — and supports multiple notes with persistence across sessions.

---

## ✨ Features

- Create unlimited sticky notes
- Random or custom color palette
- Transparent note body with solid header
- Font size, dimensions, and header height are adjustable
- Notes stay on top of all windows
- Pin/unpin notes individually
- Fully movable and resizable
- Persistent storage using JSON (restores notes on reboot)
- GTK4-powered UI
- GSettings preferences for user control

---

## 📦 Installation

1. Clone or download this repository into your local GNOME Shell extensions folder:

```bash
git clone https://github.com/kravhuravhu/stickynotes-kr.git
```

2. Move it to the GNOME extensions directory:

```bash
mv stickynotes-kr ~/.local/share/gnome-shell/extensions/stickynotes-kr@kravhuravhu.github.io
```

3. Restart GNOME Shell:

**X11:**

```bash
Alt + F2
```

```text
type → r → press Enter
```

Or from terminal:

```bash
gnome-shell --replace &
```

**Wayland:**

```bash
Log out and log back in
```

4. Enable the extension:

```bash
gnome-extensions enable stickynotes-kr@kravhuravhu.github.io
```

---

## 📁 File Structure

```bash
stickynotes-kr@kravhuravhu.github.io/
├── extension.js
├── noteWindow.js
├── noteManager.js
├── storage.js
├── prefs.js
├── style.css
├── metadata.json
├── schemas/
│   └── org.gnome.shell.extensions.sticky-notes.gschema.xml
└── README.md
```

---

## 🧾 metadata.json

```json
{
  "uuid": "stickynotes-kr@kravhuravhu.github.io",
  "name": "Sticky Notes KR",
  "description": "Sticky notes that float on top, support transparency, and multiple customization settings.",
  "version": 1,
  "shell-version": ["46"],
  "url": "https://github.com/kravhuravhu/stickynotes-kr"
}
```

---

## 🧪 Tested On

```bash
GNOME Shell 46
Ubuntu 24.04.2 LTS
Dell Latitude 7410
```

Compatible with both X11 and Wayland (note: persistent stacking is more consistent on X11).

---

## 🛠 Author

##### Made by Khuliso J. Ravhuravhu  
This is part of a growing collection of custom GNOME Shell extensions.
