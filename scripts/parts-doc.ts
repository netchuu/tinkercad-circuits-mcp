// Prints docs/parts.md from the catalog: npm run parts-doc
import { PARTS } from "../src/catalog.js";

const lines: string[] = [
  "# Parts",
  "",
  "Generated from `src/catalog.ts` with `npm run parts-doc`. Pin offsets are in breadboard holes from the part's origin at angle 0 (x to the right, y down). You rarely need them: say which pin goes in which hole and the builder rotates the part until the rest fit.",
  "",
];
for (const p of PARTS) {
  lines.push(`## \`${p.id}\` - ${p.label}`, "");
  if (p.aliases.length) lines.push(`Also accepted: ${p.aliases.map((a) => `\`${a}\``).join(", ")}`, "");
  lines.push("| pin | offset |", "| --- | --- |");
  for (const [name, [x, y]] of Object.entries(p.pins)) lines.push(`| \`${name}\` | ${x}, ${y} |`);
  lines.push("");
  if (p.props?.length) {
    lines.push("Settings:", "");
    for (const prop of p.props) lines.push(`- \`${prop.name}\`: ${prop.doc}`);
    lines.push("");
  }
  if (p.notes) lines.push(p.notes, "");
}
console.log(lines.join("\n"));
