# CONNECTOR – Spezifikation Version 1

Stand: 2026-10-09 · Status: Entwurf zur Freigabe

## Ziel

Eine private Web-App (PWA) zur Pflege persönlicher Kontakte. Sie zeigt, wann ich mich zuletzt bei einer Person gemeldet habe, wer fällig ist, wann Geburtstage anstehen und woran ich beim nächsten Gespräch anknüpfen will.

Nutzung nur privat, auf Android-Handy, Android-Tablet und PC (Chrome). Keine Veröffentlichung in einem App Store.

## Datenschutz (verbindlich)

Das Repo ist öffentlich. Öffentlich ist nur der Programmcode, niemals Kontaktdaten.

1. Alle Kontaktdaten, Notizen und Gesprächsdaten liegen ausschließlich im Browser des jeweiligen Geräts (IndexedDB).
2. Die App hat keinen Server, kein Konto, keine Synchronisation, keine Analyse- oder Tracking-Dienste und lädt keine Skripte von fremden Servern nach.
3. Die App sendet keine Daten ins Netz. Einzige Ausnahme ist der Knopf „WhatsApp öffnen“, der einen `wa.me`-Link mit der Telefonnummer der Person öffnet; den löse ich selbst aus.
4. Ein WhatsApp-Chat-Export wird nur im Arbeitsspeicher gelesen. Gespeichert wird daraus nur das Datum des letzten Kontakts. Der Chattext selbst wird nicht gespeichert.
5. Keine echten Kontaktdaten im Repo, auch nicht als Testdaten. Testdaten sind erfunden (z. B. „Erika Mustermann“).
6. `.gitignore` schließt typische Datendateien aus (`*.vcf`, WhatsApp-Exporte, Sicherungsdateien), damit sie nicht versehentlich hochgeladen werden.
7. Sicherungsdateien (Export) speichert die App nur lokal auf dem Gerät. Wo sie danach landen, entscheide ich.

## Funktionen Version 1

### 1. Startseite „Heute“
- Überfällige Kontakte: letzter Kontakt länger her als der gewünschte Rhythmus, am längsten überfällig zuerst.
- Bald fällig: innerhalb der nächsten 7 Tage.
- Geburtstage der nächsten 14 Tage, mit Alter, falls das Geburtsjahr bekannt ist.

### 2. Kontaktliste
- Alle Kontakte, Suche nach Name.
- Sortierung: nach Fälligkeit (Standard) oder alphabetisch.
- Farbmarkierung: überfällig / bald fällig / in Ordnung.

### 3. Kontaktkarte
| Feld | Pflicht | Hinweis |
|---|---|---|
| Name | ja | |
| Telefonnummer | nein | für „WhatsApp öffnen“ |
| Geburtstag | nein | Tag und Monat, Jahr optional |
| Rhythmus | ja | Standard 28 Tage; wählbar 7, 14, 28 Tage oder frei |
| Letzter Kontakt | nein | Datum |
| Anknüpfen beim nächsten Mal | nein | Freitext, gut sichtbar oben auf der Karte |
| Gesprächshistorie | nein | Liste aus Datum + kurzer Notiz |

### 4. Schnellaktion „Gemeldet“
- Setzt den letzten Kontakt auf heute (Datum änderbar).
- Öffnet ein Feld für eine kurze Notiz und für „Anknüpfen beim nächsten Mal“.
- Die Notiz wird an die Gesprächshistorie angehängt.

### 5. Kontakte anlegen
- Von Hand.
- Auf Android in Chrome: Auswahl aus dem Telefonbuch über die Contact Picker API (Name, Telefonnummer). Funktioniert laut MDN nur in Chrome auf Android und ist experimentell; auf anderen Geräten wird der Knopf ausgeblendet.
- Import einer vCard-Datei (`.vcf`, z. B. Export aus Google Kontakte) mit Name, Telefonnummer und Geburtstag. Vor dem Import zeigt die App eine Liste, in der ich auswähle, welche Kontakte übernommen werden.

### 6. WhatsApp-Chat-Import (testweise)
- Eingabe: die `.txt`-Datei aus „Chat exportieren“ → „Ohne Medien“.
- Die App liest die Datei lokal, erkennt Datum und Uhrzeit jeder Nachricht und ermittelt das Datum der letzten Nachricht.
- Sie zeigt die letzten 20 Nachrichten zur Ansicht an, damit ich daraus die Notiz „Anknüpfen beim nächsten Mal“ schreiben kann. Diese Anzeige wird nicht gespeichert.
- Ich bestätige, welchem Kontakt der Chat zugeordnet wird; danach wird „Letzter Kontakt“ gesetzt.
- Unterstützte Formate: Android-Export auf Deutsch (`TT.MM.JJ, HH:MM - Name: Text`). Weitere Formate (12-Stunden-Uhr, iOS, Englisch) erst, wenn ein echter Test zeigt, dass sie gebraucht werden.
- Annahme, vor dem Bau am echten Export zu prüfen: Das genaue Zeilenformat stammt aus Drittquellen und kann je nach WhatsApp-Version abweichen.

### 7. Erinnerungen
- Eine Web-App ohne Server kann keine zeitgesteuerten Benachrichtigungen schicken, solange sie geschlossen ist. Version 1 verlässt sich daher nicht darauf.
- Erinnerung durch die Startseite „Heute“ beim Öffnen der App.
- Geburtstage als Kalenderdatei (`.ics`, jährlich wiederkehrend) exportieren, zum Import in Google Kalender. Dann erinnert der Kalender zuverlässig.

### 8. Datensicherung
- Export aller Daten als JSON-Datei auf das Gerät.
- Import einer solchen Datei (ersetzen oder zusammenführen).
- Hinweis in der App, wenn die letzte Sicherung älter als 30 Tage ist.

### 9. Installation und Offline-Betrieb
- Installierbar auf dem Startbildschirm (Web App Manifest, Service Worker).
- Funktioniert vollständig offline.
- Bedienung für Handy optimiert, nutzt auf Tablet und PC die Breite (Liste und Karte nebeneinander).

## Technik

- Reines HTML, CSS und JavaScript ohne Framework, ohne Build-Schritt, ohne externe Bibliotheken.
- Speicher: IndexedDB.
- Bereitstellung: GitHub Pages aus diesem Repo, Adresse `https://lars-grahneis.github.io/CONNECTOR/`.
- Sprache der Oberfläche: Deutsch.

## Nicht in Version 1

- Synchronisation zwischen Geräten
- Push-Benachrichtigungen
- Automatisches Auslesen von WhatsApp (WhatsApp bietet dafür keine Schnittstelle für private Konten)
- Import von `.zip`-Exporten (nur `.txt`)
- KI-Zusammenfassung von Chats

## Test

- Ich teste in Chrome auf dem Android-Handy und am PC und gebe Rückmeldung.
- Testfälle: Kontakt von Hand anlegen, aus Telefonbuch wählen, vCard importieren, „Gemeldet“, Fälligkeit nach Rhythmus, Geburtstag in 14 Tagen, Chat-Import mit einem echten Kontakt, Sicherung exportieren und auf einem anderen Gerät importieren, Offline-Start.
