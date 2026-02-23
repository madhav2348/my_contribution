# my_contribution

Static Bun site that shows only merged pull requests made by `madhav2348` to other people's repositories.

## Install

```bash
bun install
```

## Generate static data (local)

```powershell
$env:GITHUB_TOKEN="your_token_here"
bun run generate:data
```

This writes `public/data/contributions.json`.

## Run site

```bash
bun run dev
```

Open `http://localhost:3000`.

## Update modes

- Local manual update: run `bun run generate:data`.
- GitHub manual update: run the `Refresh Contributions JSON` workflow (`workflow_dispatch`).

The website does not fetch GitHub data at runtime. It reads only the pre-generated JSON file.
