#!/usr/bin/env node
import { dump } from "./dump";
import { trace } from "./trace";
import { frame } from "./frame";
import { listFixtures } from "./fixtures";

type Args = {
  cmd?: string;
  positional: string[];
  flags: Record<string, string>;
};

function parse(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let cmd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else if (cmd === undefined) {
      cmd = a;
    } else {
      positional.push(a);
    }
  }
  return { cmd, positional, flags };
}

const USAGE = `beats-inspect — introspect compiled timelines

usage:
  beats-inspect list
  beats-inspect dump  <fixture>
  beats-inspect trace <fixture> --step N
  beats-inspect frame <fixture> --step N --t 0.5
`;

function main(argv: string[]): number {
  const { cmd, positional, flags } = parse(argv);
  try {
    switch (cmd) {
      case undefined:
      case "help":
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        return 0;
      case "list": {
        for (const f of listFixtures()) {
          process.stdout.write(`${f.name}  —  ${f.description}\n`);
        }
        return 0;
      }
      case "dump": {
        const name = positional[0];
        if (!name) throw new Error("missing fixture name");
        process.stdout.write(dump(name) + "\n");
        return 0;
      }
      case "trace": {
        const name = positional[0];
        if (!name) throw new Error("missing fixture name");
        const step = Number.parseInt(flags.step ?? "", 10);
        if (!Number.isFinite(step)) throw new Error("--step N required");
        process.stdout.write(trace(name, step) + "\n");
        return 0;
      }
      case "frame": {
        const name = positional[0];
        if (!name) throw new Error("missing fixture name");
        const step = Number.parseInt(flags.step ?? "", 10);
        const t = Number.parseFloat(flags.t ?? "1");
        if (!Number.isFinite(step)) throw new Error("--step N required");
        process.stdout.write(frame(name, step, t) + "\n");
        return 0;
      }
      default:
        process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}`);
        return 1;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${msg}\n`);
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
