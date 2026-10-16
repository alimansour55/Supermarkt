# MarketPlus shop agent

A small program for the shop's cashier PC. It keeps the website's stock (and optionally
prices) in step with a desktop cashier program that cannot connect to the internet itself,
and drops new online orders into a folder for the cashier program.

## Install (Windows)

1. Install Node.js LTS from https://nodejs.org (version 18 or newer).
2. In the store admin: **Settings → Connected systems → Add → Shop PC agent**. Copy the key.
3. Put `shop-agent.mjs`, `config.example.json` and `install-windows.ps1` in a folder, e.g. `C:\MarketPlusAgent`.
4. Right-click **PowerShell → Run as administrator**, then:
   ```
   cd C:\MarketPlusAgent
   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
   ```
   The first run creates `config.json` and opens it. Fill it in, save, and run the same command again.
   It tests everything and then starts the agent with Windows.

Uninstall: `.\install-windows.ps1 -Uninstall`. Log: `agent-data\agent.log`.

## Where it reads from (`source`)

| type     | For                                                    | Extra install           |
|----------|--------------------------------------------------------|-------------------------|
| `folder` | Cashier saves CSV/Excel exports into a folder          | none                    |
| `mssql`  | SQL Server database (most desktop POS systems)         | `npm install mssql`     |
| `odbc`   | Access `.mdb/.accdb` or any ODBC driver                | `npm install odbc`      |

- **folder**: every new or changed file matching `pattern` is sent once. Set the column
  mapping (which column is the barcode, quantity…) on the connection page in the admin.
- **mssql / odbc**: `stockQuery` must return a barcode/SKU column (`code`, `barcode` or `sku`)
  and a quantity column (`quantity`, `qty` or `stock`), optionally `location`/`branch`.
  `priceQuery` returns `code` + `price` (+ `cost`). Use a read-only database user.
  Only changed results are sent.

## Online orders (`orders`)

With `exportFolder` set, each new online order (status in `statuses`) is saved once as
`order-<number>.csv` (Arabic-safe UTF-8, opens in Excel) or `.json`. With `"acknowledge": true`
the agent tells the store the order was taken — only use that if your cashier program
imports these files and takes the stock out.

## Behaviour

- Runs every `intervalSeconds` (minimum 30).
- No internet? Updates wait in `agent-data\queue` and are sent, in order, when it is back.
- Updates itself from the store when a new version is published (`"autoUpdate": false` to stop that).
- `node shop-agent.mjs --test` checks the key, the folder/database and prints the first row.
