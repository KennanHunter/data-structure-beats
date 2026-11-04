import type { Camera, Frame, Pose, Size } from "@kennanhunter/data-structure-beats";

const HEADERS = ["id", "kind", "x", "y", "w", "h", "op", "flags"] as const;

function num(n: number, width = 6): string {
  const s = Number.isInteger(n) ? n.toString() : n.toFixed(1);
  return s.padStart(width);
}

export function formatCamera(c: Camera): string {
  return `camera: cx=${num(c.cx)} cy=${num(c.cy)} zoom=${c.zoom.toFixed(3)}`;
}

export function formatSize(s: Size): string {
  return `size: ${num(s.width)}x${num(s.height)}`;
}

export function formatPose(
  pose: Pose,
  kindsByElement: Map<string, string>,
): string {
  const rows: string[][] = [HEADERS as unknown as string[]];
  const ids = [...pose.boxes.keys()].sort();
  for (const id of ids) {
    const b = pose.boxes.get(id);
    if (!b) continue;
    const flags: string[] = [];
    if (b.tween_size) flags.push("tween_size");
    if (b.enter_from) flags.push(`enter_from=${b.enter_from}`);
    if (b.exit_to) flags.push(`exit_to=${b.exit_to}`);
    rows.push([
      id,
      kindsByElement.get(id) ?? "?",
      num(b.x),
      num(b.y),
      num(b.w),
      num(b.h),
      b.opacity.toFixed(2),
      flags.join(" "),
    ]);
  }
  const widths = rows[0].map((_, col) =>
    rows.reduce((max, row) => Math.max(max, (row[col] ?? "").length), 0),
  );
  return rows
    .map((row) =>
      row.map((cell, col) => cell.padEnd(widths[col])).join("  ").trimEnd(),
    )
    .join("\n");
}

export function formatFrame(
  label: string,
  frame: Frame,
  kindsByElement: Map<string, string>,
): string {
  const header = `${label}  |  ${formatCamera(frame.camera)}  |  ${formatSize(frame.size)}`;
  return `${header}\n${formatPose(frame.pose, kindsByElement)}`;
}
