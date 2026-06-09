import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import {
  appendToNote,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  getAccounts,
  getAttachments,
  getFolders,
  getHashtags,
  getNote,
  getNotes,
  getSelection,
  getVersion,
  moveNote,
  searchNotes,
  showItem,
  updateNote,
} from "./notes.js";

function asContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function createNotesPokeMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "notes-poke",
      version: "0.1.0",
    },
    {
      capabilities: { logging: {} },
      instructions:
        "Use these tools to operate the user's local Apple Notes app on macOS. Prefer search and small reads before broad reads. Use note and folder IDs for updates, moves, deletes, and reveals. Do not call destructive tools unless the user explicitly asks. Apple Notes exposes note bodies as HTML and plaintext; preserve user content carefully.",
    },
  );

  server.registerTool(
    "get_notes_info",
    {
      title: "Get Notes Info",
      description: "Check that Apple Notes is reachable and return its version.",
      inputSchema: {},
    },
    async () => asContent({ version: await getVersion() }),
  );

  server.registerTool(
    "get_accounts",
    {
      title: "Get Accounts",
      description: "List Apple Notes accounts and their default folders.",
      inputSchema: {},
    },
    async () => asContent(await getAccounts()),
  );

  server.registerTool(
    "get_folders",
    {
      title: "Get Folders",
      description: "List Apple Notes folders, optionally for a specific account.",
      inputSchema: {
        account: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      },
    },
    async (args) => asContent(await getFolders(args)),
  );

  server.registerTool(
    "get_notes",
    {
      title: "Get Notes",
      description: "List Apple Notes notes, optionally by folder or account. Use includeBody only when needed.",
      inputSchema: {
        folder: z.string().optional(),
        account: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(30),
        includeBody: z.boolean().default(false),
      },
    },
    async (args) => asContent(await getNotes(args)),
  );

  server.registerTool(
    "get_note",
    {
      title: "Get Note",
      description: "Read a single Apple Notes note by ID.",
      inputSchema: {
        id: z.string(),
        includeBody: z.boolean().default(true),
      },
    },
    async ({ id, includeBody }) => asContent(await getNote(id, includeBody)),
  );

  server.registerTool(
    "search_notes",
    {
      title: "Search Notes",
      description: "Search Apple Notes by title and plaintext content.",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().min(1).max(200).default(30),
      },
    },
    async ({ query, limit }) => asContent(await searchNotes(query, limit)),
  );

  server.registerTool(
    "create_note",
    {
      title: "Create Note",
      description: "Create an Apple Notes note in the default folder, a named folder, or an account's default folder.",
      inputSchema: {
        title: z.string(),
        body: z.string().optional(),
        folder: z.string().optional(),
        account: z.string().optional(),
        reveal: z.boolean().default(false),
      },
    },
    async (args) => asContent(await createNote(args)),
  );

  server.registerTool(
    "update_note",
    {
      title: "Update Note",
      description:
        "Replace a note's body by ID. Provide title/body for simple plaintext-to-HTML content, or html for exact Apple Notes HTML.",
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        html: z.string().optional(),
        replace: z.boolean().default(true),
      },
    },
    async (args) => asContent(await updateNote(args)),
  );

  server.registerTool(
    "append_to_note",
    {
      title: "Append To Note",
      description: "Append plaintext content to the end of an Apple Notes note by ID.",
      inputSchema: {
        id: z.string(),
        text: z.string(),
      },
    },
    async ({ id, text }) => asContent(await appendToNote(id, text)),
  );

  server.registerTool(
    "create_folder",
    {
      title: "Create Folder",
      description: "Create an Apple Notes folder in the default account or a named account.",
      inputSchema: {
        name: z.string(),
        account: z.string().optional(),
      },
    },
    async ({ name, account }) => asContent(await createFolder(name, account)),
  );

  server.registerTool(
    "move_note",
    {
      title: "Move Note",
      description: "Move a note by ID to a named Apple Notes folder.",
      inputSchema: {
        id: z.string(),
        folder: z.string(),
      },
    },
    async ({ id, folder }) => asContent(await moveNote(id, folder)),
  );

  server.registerTool(
    "delete_note",
    {
      title: "Delete Note",
      description: "Delete an Apple Notes note by ID. Only use when the user explicitly asks.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => asContent(await deleteNote(id)),
  );

  server.registerTool(
    "delete_folder",
    {
      title: "Delete Folder",
      description: "Delete an Apple Notes folder by ID. Only use when the user explicitly asks.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => asContent(await deleteFolder(id)),
  );

  server.registerTool(
    "show_in_notes",
    {
      title: "Show In Notes",
      description: "Reveal a note, folder, or account in the Apple Notes app.",
      inputSchema: {
        type: z.enum(["note", "folder", "account"]),
        id: z.string().optional(),
        name: z.string().optional(),
        separately: z.boolean().default(false),
      },
    },
    async (args) => asContent(await showItem(args)),
  );

  server.registerTool(
    "get_selection",
    {
      title: "Get Selection",
      description: "Return the currently selected note or notes in Apple Notes.",
      inputSchema: {},
    },
    async () => asContent(await getSelection()),
  );

  server.registerTool(
    "get_attachments",
    {
      title: "Get Attachments",
      description: "List attachments for an Apple Notes note by note ID.",
      inputSchema: { noteId: z.string() },
    },
    async ({ noteId }) => asContent(await getAttachments(noteId)),
  );

  server.registerTool(
    "get_hashtags",
    {
      title: "Get Hashtags",
      description:
        "Extract hashtag-like tokens from recent note plaintext. Apple Notes tags are not exposed as native scriptable objects.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).default(100),
      },
    },
    async ({ limit }) => asContent(await getHashtags(limit)),
  );

  return server;
}
