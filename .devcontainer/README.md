# Working from your phone (Codespaces)

The site starts by itself in the terminal below (`npm run dev`).

- **See the website:** open the **PORTS** tab → port **5173 (Website)** → globe icon.
  The link looks like `https://<name>-5173.app.github.dev`. Sign in to GitHub in that browser.
- **Run commands:** use the terminal (≡ menu → Terminal → New Terminal if hidden).
- **Claude Code:** run `claude` in a terminal (first time: it asks you to log in).
- **Demo logins:** admin password `admin123` (`/admin/login`); demo seller
  `demo-seller@marketplus.test` / `DemoSeller#2026` (`/seller-center/login`).
  SMS OTP codes are printed in the backend log.
- **Save your work:** `git add -A && git commit -m "..." && git push`.
- **Stop billing:** github.com/codespaces → … → Stop codespace (it also auto-stops after 30 min idle).
