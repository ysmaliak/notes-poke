import { spawn } from "node:child_process";

export interface RunAppleScriptOptions {
  timeoutMs?: number;
}

export type AppleScriptErrorKind = "timeout" | "not-authorized" | "script-error";

export class AppleScriptError extends Error {
  kind: AppleScriptErrorKind;

  constructor(kind: AppleScriptErrorKind, message: string) {
    super(message);
    this.name = "AppleScriptError";
    this.kind = kind;
  }
}

const notAuthorizedHelp =
  "macOS Automation permission is missing or was denied for the notes-poke daemon. " +
  "Open System Settings > Privacy & Security > Automation, find \"notes-poke-node\" (or \"node\"), and enable Notes. " +
  "Then rerun `notes-poke install`. If no toggle appears, run `tccutil reset AppleEvents` in Terminal and rerun install.";

function isNotAuthorized(stderr: string): boolean {
  return stderr.includes("-1743") || stderr.includes("Not authorized to send Apple events");
}

export async function runAppleScript(script: string, options: RunAppleScriptOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 20_000;

  return await new Promise((resolve, reject) => {
    const child = spawn("osascript", ["-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new AppleScriptError(
        "timeout",
        `AppleScript timed out after ${timeoutMs}ms. If a macOS permission dialog is waiting for approval, click Allow and retry; if dialogs keep appearing, rerun \`notes-poke install\`.`,
      ));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      if (isNotAuthorized(stderr)) {
        reject(new AppleScriptError("not-authorized", notAuthorizedHelp));
        return;
      }

      reject(new AppleScriptError("script-error", stderr.trim() || `osascript exited with code ${code}`));
    });

    child.stdin.end(script);
  });
}

export function asString(value: string): string {
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")}"`;
}
