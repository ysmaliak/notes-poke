import { asString, runAppleScript } from "./appleScript.js";

export interface NoteInput {
  title: string;
  body?: string;
  folder?: string;
  account?: string;
  reveal?: boolean;
}

export interface NoteUpdate {
  id: string;
  title?: string;
  body?: string;
  html?: string;
  replace?: boolean;
}

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function paragraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function noteHtml(title: string, body = ""): string {
  return `<h1>${escapeHtml(title)}</h1>${paragraphs(body)}`;
}

export const notesAppleScriptLibrary = String.raw`
on replaceText(findText, replaceText, sourceText)
  set oldDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to findText
  set textItems to text items of sourceText
  set AppleScript's text item delimiters to replaceText
  set joinedText to textItems as text
  set AppleScript's text item delimiters to oldDelimiters
  return joinedText
end replaceText

on jsonEscape(sourceValue)
  if sourceValue is missing value then return ""
  set sourceText to sourceValue as text
  set sourceText to my replaceText("\\", "\\\\", sourceText)
  set sourceText to my replaceText("\"", "\\\"", sourceText)
  set sourceText to my replaceText(linefeed, "\\n", sourceText)
  set sourceText to my replaceText(return, "\\n", sourceText)
  set sourceText to my replaceText(tab, "\\t", sourceText)
  return sourceText
end jsonEscape

on jsonString(sourceValue)
  return "\"" & my jsonEscape(sourceValue) & "\""
end jsonString

on jsonBool(sourceValue)
  if sourceValue then return "true"
  return "false"
end jsonBool

on pad2(n)
  set nText to n as integer as text
  if length of nText is 1 then return "0" & nText
  return nText
end pad2

on isoDate(d)
  if d is missing value then return ""
  try
    set y to year of d as integer
    set m to month of d as integer
    set dayNumber to day of d as integer
    set h to hours of d as integer
    set minNumber to minutes of d as integer
    set secNumber to seconds of d as integer
    return (y as text) & "-" & my pad2(m) & "-" & my pad2(dayNumber) & "T" & my pad2(h) & ":" & my pad2(minNumber) & ":" & my pad2(secNumber)
  on error
    return d as text
  end try
end isoDate

on findNoteById(noteId)
  tell application "Notes"
    repeat with n in notes
      if id of n is noteId then return n
    end repeat
  end tell
  error "No Apple Notes note found with id " & noteId
end findNoteById

on findFolderById(folderId)
  tell application "Notes"
    repeat with f in folders
      if id of f is folderId then return f
    end repeat
  end tell
  error "No Apple Notes folder found with id " & folderId
end findFolderById

on folderJson(f)
  tell application "Notes"
    set containerName to ""
    set containerId to ""
    set containerKind to ""
    try
      set containerName to name of container of f
      set containerId to id of container of f
      set containerKind to class of container of f as text
    end try
    return "{" & ¬
      "\"id\":" & my jsonString(id of f) & "," & ¬
      "\"name\":" & my jsonString(name of f) & "," & ¬
      "\"shared\":" & my jsonBool(shared of f) & "," & ¬
      "\"containerId\":" & my jsonString(containerId) & "," & ¬
      "\"container\":" & my jsonString(containerName) & "," & ¬
      "\"containerKind\":" & my jsonString(containerKind) & "," & ¬
      "\"noteCount\":" & (count of notes of f as text) & ¬
    "}"
  end tell
end folderJson

on noteJson(n, includeBody)
  tell application "Notes"
    set folderName to ""
    set folderId to ""
    try
      set folderName to name of container of n
      set folderId to id of container of n
    end try
    set bodyText to ""
    if includeBody then
      try
        set bodyText to body of n
      end try
    end if
    return "{" & ¬
      "\"id\":" & my jsonString(id of n) & "," & ¬
      "\"title\":" & my jsonString(name of n) & "," & ¬
      "\"plaintext\":" & my jsonString(plaintext of n) & "," & ¬
      "\"body\":" & my jsonString(bodyText) & "," & ¬
      "\"folderId\":" & my jsonString(folderId) & "," & ¬
      "\"folder\":" & my jsonString(folderName) & "," & ¬
      "\"createdAt\":" & my jsonString(my isoDate(creation date of n)) & "," & ¬
      "\"modifiedAt\":" & my jsonString(my isoDate(modification date of n)) & "," & ¬
      "\"passwordProtected\":" & my jsonBool(password protected of n) & "," & ¬
      "\"shared\":" & my jsonBool(shared of n) & "," & ¬
      "\"attachmentCount\":" & (count of attachments of n as text) & ¬
    "}"
  end tell
end noteJson
`;

export async function getVersion(options: { timeoutMs?: number } = {}): Promise<string> {
  return await runAppleScript(`
tell application "Notes"
  return version
end tell
`, options);
}

export async function getAccounts(): Promise<unknown[]> {
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
set rows to {}
tell application "Notes"
  repeat with a in accounts
    set defaultFolderName to ""
    set defaultFolderId to ""
    try
      set defaultFolderName to name of default folder of a
      set defaultFolderId to id of default folder of a
    end try
    set end of rows to "{" & ¬
      "\\"id\\":" & my jsonString(id of a) & "," & ¬
      "\\"name\\":" & my jsonString(name of a) & "," & ¬
      "\\"upgraded\\":" & my jsonBool(upgraded of a) & "," & ¬
      "\\"defaultFolderId\\":" & my jsonString(defaultFolderId) & "," & ¬
      "\\"defaultFolder\\":" & my jsonString(defaultFolderName) & "," & ¬
      "\\"folderCount\\":" & (count of folders of a as text) & "," & ¬
      "\\"noteCount\\":" & (count of notes of a as text) & ¬
    "}"
  end repeat
end tell
set oldDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to ","
set jsonText to rows as text
set AppleScript's text item delimiters to oldDelimiters
return "[" & jsonText & "]"
`);
  return parseJson<unknown[]>(output);
}

export async function getFolders(options: { account?: string; limit?: number } = {}): Promise<unknown[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 200, 500));
  const source = options.account ? `folders of account ${asString(options.account)}` : "folders";
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
set rows to {}
tell application "Notes"
  set itemCount to 0
  repeat with f in ${source}
    set itemCount to itemCount + 1
    if itemCount is greater than ${limit} then exit repeat
    set end of rows to my folderJson(f)
  end repeat
end tell
set oldDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to ","
set jsonText to rows as text
set AppleScript's text item delimiters to oldDelimiters
return "[" & jsonText & "]"
`);
  return parseJson<unknown[]>(output);
}

export async function getNotes(options: { folder?: string; account?: string; limit?: number; includeBody?: boolean } = {}): Promise<unknown[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 30, 200));
  const source =
    options.folder ? `notes of folder ${asString(options.folder)}` :
    options.account ? `notes of account ${asString(options.account)}` :
    "notes";
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
set rows to {}
tell application "Notes"
  set itemCount to 0
  repeat with n in ${source}
    set itemCount to itemCount + 1
    if itemCount is greater than ${limit} then exit repeat
    set end of rows to my noteJson(n, ${options.includeBody ? "true" : "false"})
  end repeat
end tell
set oldDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to ","
set jsonText to rows as text
set AppleScript's text item delimiters to oldDelimiters
return "[" & jsonText & "]"
`);
  return parseJson<unknown[]>(output);
}

export async function getNote(id: string, includeBody = true): Promise<unknown> {
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  set targetNote to my findNoteById(${asString(id)})
  return my noteJson(targetNote, ${includeBody ? "true" : "false"})
end tell
`);
  return parseJson<unknown>(output);
}

export async function searchNotes(query: string, limit = 30): Promise<unknown[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
set rows to {}
set needle to ${asString(query)}
tell application "Notes"
  set itemCount to 0
  repeat with n in notes
    set haystack to (name of n & linefeed & plaintext of n)
    if haystack contains needle then
      set itemCount to itemCount + 1
      if itemCount is greater than ${safeLimit} then exit repeat
      set end of rows to my noteJson(n, false)
    end if
  end repeat
end tell
set oldDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to ","
set jsonText to rows as text
set AppleScript's text item delimiters to oldDelimiters
return "[" & jsonText & "]"
`);
  return parseJson<unknown[]>(output);
}

export async function createNote(input: NoteInput): Promise<unknown> {
  const html = noteHtml(input.title, input.body);
  const destination =
    input.folder ? ` at folder ${asString(input.folder)}` :
    input.account ? ` at default folder of account ${asString(input.account)}` :
    " at default folder of default account";
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  set newNote to make new note${destination} with properties {body:${asString(html)}}
  if ${input.reveal ? "true" : "false"} then show newNote
  return my noteJson(newNote, true)
end tell
`);
  return parseJson<unknown>(output);
}

export async function updateNote(input: NoteUpdate): Promise<unknown> {
  const bodyHtml = input.html ?? (input.title !== undefined || input.body !== undefined ? noteHtml(input.title ?? "Untitled", input.body ?? "") : undefined);
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  set targetNote to my findNoteById(${asString(input.id)})
  ${bodyHtml !== undefined ? `set body of targetNote to ${input.replace === false ? `(body of targetNote) & ${asString(bodyHtml)}` : asString(bodyHtml)}` : ""}
  return my noteJson(targetNote, true)
end tell
`);
  return parseJson<unknown>(output);
}

export async function appendToNote(id: string, text: string): Promise<unknown> {
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  set targetNote to my findNoteById(${asString(id)})
  set body of targetNote to (body of targetNote) & ${asString(paragraphs(text))}
  return my noteJson(targetNote, true)
end tell
`);
  return parseJson<unknown>(output);
}

export async function createFolder(name: string, account?: string): Promise<unknown> {
  const destination = account ? ` at account ${asString(account)}` : " at default account";
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  set newFolder to make new folder${destination} with properties {name:${asString(name)}}
  return my folderJson(newFolder)
end tell
`);
  return parseJson<unknown>(output);
}

export async function deleteNote(id: string): Promise<string> {
  return await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  set targetNote to my findNoteById(${asString(id)})
  delete targetNote
  return "Deleted note: ${id}"
end tell
`);
}

export async function deleteFolder(id: string): Promise<string> {
  return await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  set targetFolder to my findFolderById(${asString(id)})
  delete targetFolder
  return "Deleted folder: ${id}"
end tell
`);
}

export async function moveNote(id: string, folder: string): Promise<unknown> {
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  set targetNote to my findNoteById(${asString(id)})
  move targetNote to folder ${asString(folder)}
  return my noteJson(targetNote, false)
end tell
`);
  return parseJson<unknown>(output);
}

export async function showItem(input: { type: "note" | "folder" | "account"; id?: string; name?: string; separately?: boolean }): Promise<string> {
  const target =
    input.type === "note" && input.id ? `my findNoteById(${asString(input.id)})` :
    input.type === "folder" && input.id ? `my findFolderById(${asString(input.id)})` :
    input.type === "folder" && input.name ? `folder ${asString(input.name)}` :
    input.type === "account" && input.name ? `account ${asString(input.name)}` :
    undefined;
  if (!target) {
    throw new Error("Provide a valid id or name for the requested Apple Notes item type.");
  }
  return await runAppleScript(`
${notesAppleScriptLibrary}
tell application "Notes"
  show ${target}${input.separately ? " separately true" : ""}
  return "Shown in Notes"
end tell
`);
}

export async function getSelection(): Promise<unknown[]> {
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
set rows to {}
tell application "Notes"
  repeat with n in selection
    set end of rows to my noteJson(n, false)
  end repeat
end tell
set oldDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to ","
set jsonText to rows as text
set AppleScript's text item delimiters to oldDelimiters
return "[" & jsonText & "]"
`);
  return parseJson<unknown[]>(output);
}

export async function getAttachments(noteId: string): Promise<unknown[]> {
  const output = await runAppleScript(`
${notesAppleScriptLibrary}
set rows to {}
tell application "Notes"
  set targetNote to my findNoteById(${asString(noteId)})
  repeat with a in attachments of targetNote
    set attachmentUrl to ""
    try
      set attachmentUrl to URL of a
    end try
    set end of rows to "{" & ¬
      "\\"id\\":" & my jsonString(id of a) & "," & ¬
      "\\"name\\":" & my jsonString(name of a) & "," & ¬
      "\\"url\\":" & my jsonString(attachmentUrl) & "," & ¬
      "\\"contentIdentifier\\":" & my jsonString(content identifier of a) & "," & ¬
      "\\"createdAt\\":" & my jsonString(my isoDate(creation date of a)) & "," & ¬
      "\\"modifiedAt\\":" & my jsonString(my isoDate(modification date of a)) & "," & ¬
      "\\"shared\\":" & my jsonBool(shared of a) & ¬
    "}"
  end repeat
end tell
set oldDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to ","
set jsonText to rows as text
set AppleScript's text item delimiters to oldDelimiters
return "[" & jsonText & "]"
`);
  return parseJson<unknown[]>(output);
}

export async function getHashtags(limit = 100): Promise<unknown[]> {
  const output = await runAppleScript(`
set allText to ""
tell application "Notes"
  set itemCount to 0
  repeat with n in notes
    set itemCount to itemCount + 1
    if itemCount is greater than ${Math.max(1, Math.min(limit, 500))} then exit repeat
    set allText to allText & " " & plaintext of n
  end repeat
end tell
do shell script "/usr/bin/python3 -c " & quoted form of "import re,sys,json; print(json.dumps(sorted(set(re.findall(r'(?<!\\\\w)#[-_A-Za-z0-9]+', sys.stdin.read())))))" with input allText
`);
  return parseJson<unknown[]>(output);
}
