# my_contribution

Simple Bun project that serves a static page to showcase contributions from the GitHub API.

## Install

```bash
bun install
```

## Run

```bash
bun run dev
```

Open `http://localhost:5000`.

## GitHub API notes

- The page calls your Bun backend at `/api/contributions?username=<name>`.
- The backend fetches `https://api.github.com/users/<name>/events/public`.
- Optional: set `GITHUB_TOKEN` to increase rate limits.

PowerShell example:

```powershell
$env:GITHUB_TOKEN="your_token_here"
bun run dev
```
