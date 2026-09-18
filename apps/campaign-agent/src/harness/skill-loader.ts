import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SkillFrontmatter = {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  "allowed-tools"?: string;
};

export type SkillSummary = {
  name: string;
  description: string;
  version: string;
  dir: string;
};

export type LoadedSkill = SkillSummary & {
  frontmatter: SkillFrontmatter;
  instructions: string;
  bundled: {
    scripts: string[];
    references: string[];
    assets: string[];
  };
  files: Record<string, string>;
};

export class SkillLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillLoadError";
  }
}

/**
 * Agent Skills spec loader (https://agentskills.io/specification).
 * Progressive disclosure: catalog = name+description; activate = full SKILL.md + bundled files.
 */
export class SkillLibrary {
  constructor(private readonly skillsRoot: string) {}

  async catalog(allowlist: { skill_id: string; version: string }[]): Promise<SkillSummary[]> {
    const discovered = await this.discover();
    const allowed = new Set(allowlist.map((item) => item.skill_id));
    const pinnedVersion = new Map(allowlist.map((item) => [item.skill_id, item.version]));
    return discovered
      .filter((skill) => allowed.has(skill.name))
      .map((skill) => ({
        ...skill,
        version: pinnedVersion.get(skill.name) || skill.version,
      }));
  }

  async activate(
    name: string,
    allowlist: { skill_id: string; version: string }[],
  ): Promise<LoadedSkill> {
    const catalog = await this.catalog(allowlist);
    const summary = catalog.find((item) => item.name === name);
    if (!summary) {
      throw new SkillLoadError(`skill_not_allowed_or_missing: ${name}`);
    }
    return this.readFull(summary);
  }

  async discover(): Promise<SkillSummary[]> {
    const found: SkillSummary[] = [];
    await walkSkillDirs(this.skillsRoot, 6, found);
    return found;
  }

  private async readFull(summary: SkillSummary): Promise<LoadedSkill> {
    const raw = await readFile(path.join(summary.dir, "SKILL.md"), "utf8");
    const parsed = parseSkillMarkdown(raw, summary.dir);
    const bundled = {
      scripts: await listRel(summary.dir, "scripts"),
      references: await listRel(summary.dir, "references"),
      assets: await listRel(summary.dir, "assets"),
    };
    const files: Record<string, string> = { "SKILL.md": raw };
    for (const group of Object.values(bundled)) {
      for (const rel of group) {
        files[rel] = await readFile(path.join(summary.dir, rel), "utf8");
      }
    }
    return {
      ...summary,
      frontmatter: parsed.frontmatter,
      instructions: parsed.body,
      bundled,
      files,
    };
  }
}

export function parseSkillMarkdown(raw: string, dir: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new SkillLoadError("SKILL.md must start with YAML frontmatter");
  }
  const data = parseYaml(match[1] ?? "") as Record<string, unknown>;
  const name = String(data.name ?? "").trim();
  const description = String(data.description ?? "").trim();
  validateSkillName(name, dir);
  if (!description || description.length > 1024) {
    throw new SkillLoadError("description must be 1-1024 characters");
  }
  const metadata = flattenMetadata(data.metadata);
  const frontmatter: SkillFrontmatter = { name, description };
  if (typeof data.license === "string") {
    frontmatter.license = data.license;
  }
  if (typeof data.compatibility === "string") {
    frontmatter.compatibility = data.compatibility;
  }
  if (metadata) {
    frontmatter.metadata = metadata;
  }
  if (typeof data["allowed-tools"] === "string") {
    frontmatter["allowed-tools"] = data["allowed-tools"];
  }
  return { frontmatter, body: (match[2] ?? "").trim() };
}

export function validateSkillName(name: string, dir: string): void {
  if (!NAME_RE.test(name) || name.length > 64) {
    throw new SkillLoadError(`invalid skill name: ${name}`);
  }
  const parent = path.basename(dir);
  if (parent !== name) {
    throw new SkillLoadError(`skill name '${name}' must match directory '${parent}'`);
  }
}

function flattenMetadata(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = String(item);
  }
  return out;
}

async function walkSkillDirs(root: string, depth: number, found: SkillSummary[]): Promise<void> {
  if (depth < 0) {
    return;
  }
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  const hasSkill = entries.some((entry) => entry.isFile() && entry.name === "SKILL.md");
  if (hasSkill) {
    const raw = await readFile(path.join(root, "SKILL.md"), "utf8");
    const parsed = parseSkillMarkdown(raw, root);
    found.push({
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      version: parsed.frontmatter.metadata?.version || "unpinned",
      dir: root,
    });
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      await walkSkillDirs(path.join(root, entry.name), depth - 1, found);
    }
  }
}

async function listRel(dir: string, folder: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(dir, folder), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => `${folder}/${entry.name}`)
      .sort();
  } catch {
    return [];
  }
}
