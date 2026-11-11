# Jonas-Proxy

Ein sicherer Web-Proxy mit Domain-Filterung, bestehend aus einem modernen Frontend (GitHub Pages) und einem Cloudflare-Worker-Backend.

## Überblick

Jonas-Proxy ermöglicht den kontrollierten Zugriff auf freigegebene Websites über einen sicheren Proxy. Nur explizit erlaubte Domains können über den Proxy aufgerufen werden.

### Funktionen

- ✅ Sichere Domain-Filterung (Allowlist)
- ✅ HTTPS als einzig erlaubtes Protokoll
- ✅ Blockierung privater IP-Adressen
- ✅ Blockierung von Cloud-Metadaten-Endpunkten
- ✅ Redirect-Validierung
- ✅ CORS-Konfiguration
- ✅ Health-Check-Endpunkt
- ✅ Responsive Design (Desktop, Tablet, Smartphone)
- ✅ Modernes Schwarz-Weiß-Design mit blauen Highlights

## Projektstruktur

```
jonas-proxy/
├── index.html                 # Frontend Entry Point
├── src/
│   ├── App.tsx               # Hauptkomponente
│   ├── main.tsx              # React Entry
│   ├── index.css             # Styles
│   └── vite-env.d.ts         # TypeScript Types
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Pages Deployment
├── worker/
│   ├── src/
│   │   └── index.js          # Cloudflare Worker Code
│   ├── wrangler.toml         # Worker Konfiguration
│   ├── package.json          # Worker Dependencies
│   └── .dev.vars.example     # Beispiel Umgebungsvariablen
├── .gitignore
├── README.md
├── package.json              # Frontend Dependencies
├── vite.config.js            # Vite Konfiguration
└── tsconfig.json             # TypeScript Konfiguration
```

## Einrichtung

### Voraussetzungen

- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- [npm](https://www.npmjs.com/) (wird mit Node.js installiert)
- [Cloudflare-Konto](https://dash.cloudflare.com/sign-up) (kostenlos)
- [GitHub-Konto](https://github.com/) (kostenlos)

---

### 1. Projekt lokal klonen und starten

```bash
# Repository klonen
git clone https://github.com/IHR-BENUTZERNAME/jonas-proxy.git
cd jonas-proxy

# Abhängigkeiten installieren
npm install

# Frontend im Entwicklungsmodus starten
npm run dev
```

Das Frontend ist dann unter `http://localhost:5173` erreichbar.

---

### 2. GitHub-Repository einrichten

1. Erstellen Sie ein neues Repository auf GitHub mit dem Namen `jonas-proxy`.
2. Verbinden Sie Ihr lokales Projekt mit dem Repository:

```bash
git init
git add .
git commit -m "Initial commit: Jonas-Proxy"
git branch -M main
git remote add origin https://github.com/IHR-BENUTZERNAME/jonas-proxy.git
git push -u origin main
```

---

### 3. GitHub Pages aktivieren

1. Gehen Sie zu Ihrem Repository auf GitHub.
2. Navigieren Sie zu **Settings** → **Pages**.
3. Wählen Sie unter "Source" die Option **GitHub Actions**.
4. Der Workflow wird bei jedem Push auf `main` automatisch ausgeführt.
5. Nach dem ersten erfolgreichen Build ist die Seite unter `https://IHR-BENUTZERNAME.github.io/jonas-proxy/` erreichbar.

**Wichtig:** Setzen Sie die Variable `WORKER_BASE_URL` in den Repository-Einstellungen:
- Gehen Sie zu **Settings** → **Secrets and variables** → **Actions** → **Variables**
- Erstellen Sie eine neue Variable: `WORKER_BASE_URL` mit der URL Ihres Cloudflare Workers.

---

### 4. Cloudflare-Konto einrichten

1. Registrieren Sie sich unter [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. Installieren Sie Wrangler (Cloudflare CLI):

```bash
npm install -g wrangler
```

3. Melden Sie sich bei Wrangler an:

```bash
wrangler login
```

---

### 5. Cloudflare Worker deployen

```bash
# In das Worker-Verzeichnis wechseln
cd worker

# Abhängigkeiten installieren
npm install

# Worker lokal testen
npm run dev

# Worker deployen
npm run deploy
```

Nach dem Deployment erhalten Sie eine URL wie:
`https://jonas-proxy-worker.IHR-ACCOUNT.workers.dev`

---

### 6. ALLOWED_HOSTS konfigurieren

Die erlaubten Domains werden als Worker-Variable konfiguriert:

**Über Wrangler CLI:**
```bash
cd worker
wrangler secret put ALLOWED_HOSTS_ENV
# Eingabe: "example.com,github.com,developer.mozilla.org"
```

**Über die Cloudflare Dashboard:**
1. Gehen Sie zu **Workers & Pages** → Ihr Worker → **Settings** → **Variables**
2. Fügen Sie eine neue Environment Variable hinzu:
   - Name: `ALLOWED_HOSTS_ENV`
   - Value: `example.com,github.com,developer.mozilla.org`
   - Encrypt: Ja

**Für lokale Entwicklung:**
```bash
cd worker
cp .dev.vars.example .dev.vars
# Bearbeiten Sie .dev.vars mit Ihren Test-Domains
```

---

### 7. WORKER_BASE_URL im Frontend konfigurieren

**Für die Produktion (GitHub Actions):**
- Setzen Sie die Variable `WORKER_BASE_URL` in GitHub Repository Settings → Variables

**Für die lokale Entwicklung:**
Erstellen Sie eine `.env.local` Datei im Projekt-Root:
```
VITE_WORKER_BASE_URL=https://jonas-proxy-worker.IHR-ACCOUNT.workers.dev
```

---

### 8. Anwendung testen

1. Starten Sie das Frontend: `npm run dev`
2. Der Status-Indikator oben rechts sollte "Verbunden" anzeigen.
3. Geben Sie eine freigegebene URL ein (z.B. `https://example.com`).
4. Klicken Sie auf "Öffnen" oder drücken Sie Enter.
5. Der Inhalt der Website wird als Text angezeigt.

---

### 9. Änderungen veröffentlichen

```bash
# Änderungen committen
git add .
git commit -m "Beschreibung der Änderungen"
git push

# GitHub Pages wird automatisch aktualisiert
# Worker muss manuell neu deployed werden:
cd worker
npm run deploy
```

---

## API-Endpunkte

### GET /health
Gibt den Status des Workers zurück.

**Antwort:**
```json
{
  "status": "ok",
  "service": "jonas-proxy",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "allowed_hosts_count": 3
}
```

### POST /proxy
Fordert eine URL über den Proxy an.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Antwort (erfolgreich):**
```json
{
  "url": "https://example.com",
  "statusCode": 200,
  "contentType": "text/html",
  "title": "Example Domain",
  "content": "Extracted text content...",
  "headers": { ... }
}
```

**Fehler-Antworten:**
- `400` - Ungültige Anfrage
- `403` - Domain nicht freigegeben
- `404` - Nicht gefunden
- `408` - Zeitüberschreitung
- `413` - Antwort zu groß
- `415` - Content-Type nicht unterstützt
- `502` - Website nicht erreichbar

---

## Sicherheit

### Implementierte Sicherheitsmaßnahmen

| Maßnahme | Beschreibung |
|----------|-------------|
| Allowlist | Nur explizit freigegebene Domains sind erreichbar |
| HTTPS only | Nur HTTPS-Verbindungen werden erlaubt |
| Exakte Hostnamen-Prüfung | `example.com` erlaubt nicht `example.com.attacker.test` |
| Private IPs blockiert | 127.x, 10.x, 172.16-31.x, 192.168.x werden blockiert |
| Cloud-Metadaten blockiert | 169.254.169.254, metadata.google.internal etc. |
| Redirect-Validierung | Weiterleitungen werden erneut gegen die Allowlist geprüft |
| CORS | Nur konfigurierte Origins dürfen den Worker aufrufen |
| Header-Filterung | Cookies und Auth-Header werden nicht weitergeleitet |
| Größenbegrenzung | Max. 5 MB Antwortgröße |
| Content-Type-Filter | Nur Text-basierte Content-Types |

### Was der Proxy NICHT kann

- Kein vollständiger Browser (kein JavaScript-Rendering)
- Keine Cookie-Weitergabe
- Keine WebSocket-Verbindungen
- Keine binären Downloads
- Viele Websites blockieren das Embedding in fremde Frames

---

## Fehlerbehebung

### "Backend nicht erreichbar"
- Prüfen Sie, ob der Worker deployed ist: `wrangler tail`
- Prüfen Sie die `WORKER_BASE_URL` Konfiguration
- Prüfen Sie die CORS-Einstellungen im Worker

### "Domain nicht freigegeben"
- Prüfen Sie die `ALLOWED_HOSTS_ENV` Variable
- Stellen Sie sicher, dass der Domainname exakt übereinstimmt (ohne Protokoll, ohne Pfad)

### "Website unterstützt die angeforderte Darstellung nicht"
- Die Website liefert einen nicht unterstützten Content-Type
- Der Proxy zeigt nur Text-Inhalte an

---

## Lizenz

Dieses Projekt ist für den persönlichen Gebrauch bestimmt.

---

## Hinweise

- Voice: −6 dB
- Musik: −22
