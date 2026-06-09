# notes-poke

A local MCP server that lets Poke work with Apple Notes on macOS.

The server runs on your Mac, talks to Apple Notes through its documented AppleScript automation surface, and exposes a Streamable HTTP MCP endpoint at `/mcp` for Poke.

## Quick Start

For normal users:

```bash
npm install -g notes-poke && notes-poke install
```

That installs the official Apple Notes Poke connector, checks Notes, asks macOS for Automation permission if needed, starts the local MCP server, and connects it to Poke.

Then ask Poke:

```text
Use my Apple Notes integration and search my recent notes.
```

For local development from this repository:

```bash
npm install
npm run build
npm run start
```

In another terminal:

```bash
npm run connect
```

Normal users should use `notes-poke install` instead of running tunnel commands manually.

## How It Works

Apple Notes stores its data locally on each user's Mac, so every user runs their own connector and gets their own Poke tunnel.

```text
User's Poke account
  -> user's Poke tunnel
    -> notes-poke running on the user's Mac
      -> Apple Notes
```

The recipe should tell users to run:

```bash
npm install -g notes-poke && notes-poke install
```

That command signs in to Poke if needed, starts the local MCP server, creates the user's own tunnel, and keeps both running with macOS LaunchAgents.

## CLI

```bash
notes-poke install
notes-poke setup
notes-poke start
notes-poke connect
notes-poke connect --recipe
notes-poke status
notes-poke uninstall
```

`notes-poke install` creates user LaunchAgents so the server and tunnel keep running in the background after the terminal exits. Logs are written to `~/.notes-poke/logs`.

If you only want the local MCP server without starting a Poke tunnel:

```bash
notes-poke install --no-tunnel
```

To create a shareable Poke recipe while installing:

```bash
notes-poke install --recipe
```

## Optional Auth

For localhost-only development, auth is off by default. To require a bearer token:

```bash
export NOTES_POKE_API_TOKEN="your-secret"
notes-poke start
```

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `NOTES_POKE_HOST` | `127.0.0.1` | HTTP bind host |
| `NOTES_POKE_PORT` | `8766` | HTTP port |
| `NOTES_POKE_API_TOKEN` | empty | Optional bearer token |

## Scope

This project exposes Apple Notes concepts available through AppleScript: accounts, folders, notes, attachments, selection, HTML body, plaintext search, create/update/append/delete/move, and reveal in Notes.

Apple Notes hashtags are not exposed as native scriptable tag objects. The connector can search/extract hashtag-like text, but cannot manage Apple Notes tags as first-class objects.
