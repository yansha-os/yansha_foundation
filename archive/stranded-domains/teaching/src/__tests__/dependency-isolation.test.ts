import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

function getAllTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      if (entry !== "__tests__" && entry !== "node_modules") {
        files.push(...getAllTsFiles(fullPath));
      }
    } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("@yansha/teaching Dependency Isolation & Zero Root Couplings", () => {
  const teachingSrcDir = path.resolve(__dirname, "..");
  const files = getAllTsFiles(teachingSrcDir);

  it("finds TypeScript files in @yansha/teaching/src", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains ZERO imports from root @/ paths", () => {
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/from\s+["']@\//);
      expect(content).not.toMatch(/import\s+["']@\//);
    }
  });

  it("contains ZERO imports from root store (lib/store.ts or useSystem)", () => {
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/useSystem/);
      expect(content).not.toMatch(/lib\/store/);
    }
  });

  it("contains ZERO imports from domain applications (@yansha/sahwa, @yansha/workout, @yansha/study)", () => {
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/from\s+["']@yansha\/sahwa/);
      expect(content).not.toMatch(/from\s+["']@yansha\/workout/);
      expect(content).not.toMatch(/from\s+["']@yansha\/study/);
    }
  });
});
