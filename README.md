# CONNECTOR

Private Web-App zur Kontaktpflege: Wann habe ich mich zuletzt bei jemandem gemeldet, wer ist fällig, wer hat bald Geburtstag, und woran will ich beim nächsten Gespräch anknüpfen?

Funktionsumfang und Datenschutzregeln: [SPEC.md](SPEC.md).

## Datenschutz

Dieses Repo ist öffentlich, es enthält aber nur Programmcode. Kontaktdaten, Notizen und Chats liegen ausschließlich im Browser des jeweiligen Geräts. Die App hat keinen Server und sendet keine Daten; eine Content Security Policy in `index.html` verbietet Verbindungen zu fremden Servern. Testdaten sind erfunden.

## Nutzung

1. In Chrome öffnen: `https://lars-grahneis.github.io/CONNECTOR/`
2. Installieren: In der App unter „Mehr“ → „App installieren“, oder Chrome-Menü ⋮ → „App installieren“ (Android) bzw. „Streamen, speichern und teilen“ → „Seite als App installieren“ (Windows).
3. Regelmäßig unter „Mehr“ → „Sicherung erstellen“ eine Sicherung anlegen, am besten mit Passwort (AES-GCM, Schlüssel per PBKDF2-SHA-256 mit 600 000 Iterationen).

### Daten auf ein anderes Gerät übertragen

„Mehr“ → „Sicherung erstellen“ → Passwort → „Senden“ (Android: Teilen-Menü, z. B. Quick Share) oder „Auf Gerät speichern“. Auf dem anderen Gerät „Mehr“ → „Sicherung einspielen“ → Passwort → „Zusammenführen“. Alternativ eine empfangene Sicherung (z. B. in „Dateien“, Google Drive oder nach Quick Share) über **Teilen → CONNECTOR** direkt an die installierte App schicken; das gilt ebenso für WhatsApp-Chat-Exporte. Sicherungen sind `.txt`-Dateien mit JSON-Inhalt, weil Chrome auf Android über das Teilen-Menü keine `.json`-Dateien weitergibt.

### App-Sperre

„Mehr“ → „App-Sperre“ → „PIN festlegen“ (4–6 Ziffern). CONNECTOR fragt dann beim Öffnen und nach 5 Minuten im Hintergrund nach der PIN. Die PIN lässt sich nicht wiederherstellen; vorher eine Sicherung anlegen.

### WhatsApp-Chat importieren

In WhatsApp: Chat öffnen → ⋮ → Mehr → Chat exportieren → **Ohne Medien** → Datei auf dem Gerät speichern (bei .zip vorher entpacken). In CONNECTOR: „Mehr“ → „Chat-Export importieren“ oder auf der Kontaktkarte „Chat importieren“. Gespeichert wird nur das Datum der letzten Nachricht, nicht der Chattext.

### Geburtstagserinnerungen

„Mehr“ → „Geburtstage exportieren“ erzeugt eine `.ics`-Datei. In Google Kalender (am PC: calendar.google.com → Einstellungen → Importieren) einlesen; dann erinnert der Kalender auch bei geschlossener App.

## Entwicklung

Reines HTML, CSS und JavaScript ohne Build-Schritt und ohne externe Bibliotheken.

- Lokal starten: `python3 -m http.server` im Repo-Ordner, dann `http://localhost:8000/` öffnen.
- Tests der Logik (Node.js 20+): `npm test`

| Datei | Inhalt |
|---|---|
| `index.html`, `styles.css` | Seite und Gestaltung (hell/dunkel, Handy und Tablet) |
| `js/app.js` | Oberfläche und Abläufe |
| `js/model.js`, `js/dates.js` | Fälligkeit, Geburtstage, Datumsrechnung |
| `js/whatsapp.js`, `js/vcard.js`, `js/ics.js`, `js/phone.js` | Chat-Export lesen, vCard lesen, Kalenderdatei, WhatsApp-Nummer |
| `js/db.js` | Lokaler Speicher (IndexedDB) |
| `js/crypto.js` | Verschlüsselung der Sicherungsdatei |
| `js/backup.js` | Sicherungsdatei tolerant lesen |
| `js/lock.js` | App-Sperre (PIN-Prüfwert, Wartezeiten) |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation |
