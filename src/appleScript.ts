import { spawn } from "node:child_process";

export interface RunAppleScriptOptions {
  timeoutMs?: number;
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
      reject(new Error(`AppleScript timed out after ${timeoutMs}ms`));
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

      reject(new Error(stderr.trim() || `osascript exited with code ${code}`));
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
