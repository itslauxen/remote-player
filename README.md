# YouTube Music Remote

Control the music playing on your PC from your phone. The server runs on your
machine and your phone opens a web page on the same network — play/pause,
previous and next track, volume, progress bar, album art and search across the
YouTube Music catalog.

Works on Windows, macOS and Linux.

## How it works

The server runs **on the PC that plays the music** and talks to the player in two
different ways:

**Full mode (recommended)** — the [pear-desktop](https://github.com/pear-devs/pear-desktop)
desktop app (formerly `th-ch/youtube-music`) exposes a local API. You get exact
volume, a draggable progress bar, album art, and the track you pick goes straight
into the queue.

**Basic mode** — YouTube Music open in the browser, driven by the system media
keys. Play/pause, previous and next work; volume becomes the system volume, there
is no progress bar or album art, and picking a track opens a new tab.

The server detects on its own which one is available and shows the active mode on
the phone screen.

---

## Installing on Windows

### 1. Install Node.js

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

Close and reopen the terminal so PATH updates. Check with `node -v`.

### 2. Install the YouTube Music desktop app

```powershell
winget install --id th-ch.YouTubeMusic -e
```

Open the app once and sign in to your account.

### 3. Turn on the API Server plugin

In the app, go to **Plugins → API Server** and enable it. Under **Auth Strategy**,
pick **None** (without this the remote gets a 401 and falls back to basic mode).

If you would rather edit the file, it lives at `%APPDATA%\YouTube Music\config.json`:

```json
"plugins": {
  "api-server": {
    "enabled": true,
    "hostname": "127.0.0.1",
    "port": 26538,
    "authStrategy": "NONE"
  }
}
```

Close the app completely before editing — it rewrites the file on exit.

### 4. Run the project

```powershell
npm install
npm run build
npm start
```

The server comes up on `0.0.0.0:8765`. On the first run Windows may ask you to
allow it through the firewall — accept for **private networks**.

If your network is classified as public, open the port manually in an
**administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "YTM Remote 8765" -Direction Inbound `
  -Protocol TCP -LocalPort 8765 -Action Allow -RemoteAddress LocalSubnet
```

### 5. Open it on your phone

```powershell
npm run endereco
```

Prints the address, something like `http://192.168.1.47:8765`. Type it into your
phone's browser — the phone has to be on the same network.

To avoid repeating the commands, double-click `iniciar.cmd` — it prints the
address and starts the server.

---

## Installing on macOS

### Quick path

```bash
./instalar-mac.sh
```

The script installs the dependencies, builds the project, downloads and installs
the desktop app, turns on the API Server plugin, and prints the address for your
phone. Pass `-y` to skip the confirmation prompt. Everything below is the same
thing done by hand.

### 1. Install Node.js

```bash
brew install node
```

### 2. Install the YouTube Music desktop app

The app is not on Homebrew — it is unsigned, and the project's own tap
(`th-ch/youtube-music`) is gone since the rename to `pear-desktop`. Download the
`.dmg` from the [releases page](https://github.com/pear-devs/pear-desktop/releases):
`YouTube-Music-<version>-arm64.dmg` for Apple Silicon, `YouTube-Music-<version>.dmg`
for Intel. Open it and drag the app to Applications.

Open the app once and sign in. Since Apple has not signed it, macOS may block the
first attempt: go to **System Settings → Privacy & Security** and click
**Open Anyway**.

### 3. Turn on the API Server plugin

In the app, **Plugins → API Server**, and under **Auth Strategy** pick **None**.

The config file lives at
`~/Library/Application Support/YouTube Music/config.json`.

### 4. Run the project

```bash
npm install
npm run build
npm start
```

On the first run macOS asks whether Node may accept incoming connections — accept.

### 5. Open it on your phone

```bash
npm run endereco
```

### Basic mode on macOS

If you would rather use YouTube Music in the browser instead of the desktop app,
install:

```bash
brew install nowplaying-cli
```

Without it the track name does not show up and the controls do not work in that
mode. On Linux the equivalent is `sudo apt install playerctl`.

---

## Installing as an app on your phone

**iPhone** — in Safari, Share → Add to Home Screen.

**Android** — Chrome only installs a PWA from a secure context, and this is HTTP
on a local IP. Two ways out:

- Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure` on the phone,
  register the server address, and restart the browser.
- Or put it behind a tunnel with valid HTTPS (see below).

## Access from outside your home

The server has to keep running on your PC. **Hosting it on Vercel, Netlify or any
cloud will not work**: the API routes talk to the player on `127.0.0.1`, which in
the cloud is the provider's machine, not yours. Only search would work there.

The answer is a tunnel, which keeps the server on your machine and exposes a
public address. The agent opens an outbound connection, so there is no need to
open ports on your router.

### Cloudflare Tunnel

Requires a domain with DNS on Cloudflare. You get valid HTTPS, which also unlocks
installing the PWA on Android.

Download `cloudflared` ([releases](https://github.com/cloudflare/cloudflared/releases)),
or on Windows:

```powershell
winget install --id Cloudflare.cloudflared -e
```

On macOS:

```bash
brew install cloudflared
```

Authorize and create the tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create remoteplayer
```

Create `config.yml` in `~/.cloudflared/` (on Windows, `C:\Users\YOUR_USER\.cloudflared\`),
replacing the ID with the one the previous command printed:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /path/to/YOUR_TUNNEL_ID.json

ingress:
  - hostname: your-subdomain.your-domain.com
    service: http://localhost:8765
  - service: http_status:404
```

Point the DNS and bring the tunnel up:

```bash
cloudflared tunnel route dns remoteplayer your-subdomain.your-domain.com
cloudflared tunnel run remoteplayer
```

Use `--overwrite-dns` on the route command if the subdomain already points
somewhere else.

**Protect the access.** Without authentication, anyone who finds the address
controls your PC's sound. Cloudflare Access solves this for free: in the Zero
Trust dashboard, create a self-hosted application for the subdomain and a policy
that only accepts your e-mail.

### Tailscale

An alternative with no domain of your own: `tailscale serve --bg 8765` creates a
private network between your devices, without exposing anything on the internet.

## Starting with the system

### Windows

The scripts `iniciar.cmd` (with a window) and `iniciar-silencioso.vbs` (no window)
bring up the server and the tunnel together. Both use the tunnel name
`remoteplayer` — change it if you used another one.

To start it at login, put a shortcut to `iniciar-silencioso.vbs` in the Startup
folder:

```powershell
explorer shell:startup
```

### macOS

Use `iniciar.sh`, passing the tunnel name if you have one:

```bash
chmod +x iniciar.sh
TUNEL=mac ./iniciar.sh
```

To start it at login, install the tunnel as a service and create a LaunchAgent for
the server:

```bash
sudo cloudflared service install
```

## Running on more than one computer

Each machine runs its own server and needs its own tunnel, because one tunnel
delivers to a single machine. Use one subdomain per computer:

```bash
cloudflared tunnel create mac
cloudflared tunnel route dns mac mac.your-domain.com
```

Point the Mac's `config.yml` at its own `http://localhost:8765` and that is it:
each address controls the player on the matching machine, and both can be up at
the same time.

### One address for every machine

Remembering one subdomain per computer gets old, and a PWA installed on your phone
is pinned to a single address. `worker/` is a Cloudflare Worker that sits in front
of all of them: it proxies to whichever machine a cookie names, and `?pc=<name>`
switches. Add `?pc=mac` once on your phone and it stays on the Mac until you
switch back.

Give each machine its own hostname (`win.lauxen.dev`, `mac.lauxen.dev`), keep the
pretty address for the Worker, and list them in `worker/wrangler.toml`:

```toml
[vars]
ALVO_WIN = "https://win.example.com"
ALVO_MAC = "https://mac.example.com"
PADRAO = "win"

[[routes]]
pattern = "remote.example.com/*"
zone_name = "example.com"
```

Every `ALVO_<NAME>` var becomes a machine, and the lowercased name is what goes in
the URL. Deploy with:

```bash
cd worker
npx wrangler deploy
```

If the selected machine is off, the Worker answers with a page offering the other
ones instead of a Cloudflare error.

**Protect it.** The Worker is now the only door, so put Cloudflare Access on the
pretty hostname. If you also put Access on the per-machine hostnames — worth doing,
since otherwise they stay reachable directly — create a service token and give it
to the Worker so it can get through:

```bash
npx wrangler secret put ACCESS_ID
npx wrangler secret put ACCESS_SECRET
```

## Environment variables

| Variable | What for |
|---|---|
| `PORT` | Server port (default `8765`) |
| `YTMD_TOKEN` | API Server token, if you kept authentication on |

## Structure

```
app/
  page.jsx              interface
  pagina.module.css     styles
  api/now/              current track and active mode
  api/cmd/[acao]/       playpause, next, prev, volup, voldown, mute
  api/volume/           absolute volume (full mode)
  api/seek/             position within the track (full mode)
  api/fila/             queue: read, reorder, skip to, remove (full mode)
  api/search/           catalog search
  api/play/             play the chosen track
lib/
  media.js              detection and implementation of both modes
  search.js             search via ytmusic-api, with cache
public/                 manifest, service worker and icons
```

## Common problems

**The phone will not open the address** — check that it is on the home Wi-Fi and
not on mobile data. Guest networks isolate devices and will not work. On Windows,
check the firewall (step 4).

**It says "Media keys" instead of "Desktop app"** — the API Server plugin is not
responding. Check that the desktop app is open and that Auth Strategy is **None**.

**The slider volume does not match the number** — YouTube Music applies its own
response curve, so the value read back differs from the one sent. The slider shows
what you set.

**The address changed** — the IP is assigned by the router and can change on
reboot. Run `npm run endereco` again, or reserve the IP in your router settings.
