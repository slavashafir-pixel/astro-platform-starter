#!/usr/bin/env node

/**
 * Local daily standup summary.
 * Usage: node scripts/daily-summary.mjs [days]
 *   days — how many days back to look (default: 1)
 */

import { execSync } from "node:child_process";

const days = parseInt(process.argv[2] || "1", 10);
const since = `${days}.days.ago`;

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function section(title) {
  const bar = "─".repeat(title.length + 2);
  console.log(`\n┌${bar}┐`);
  console.log(`│ ${title} │`);
  console.log(`└${bar}┘`);
}

// --- Commits ---
section(`Commits (last ${days} day${days > 1 ? "s" : ""})`);

const log = run(
  `git log --since="${since}" --format="%h|%an|%ad|%s" --date=short`
);

if (!log) {
  console.log("  No commits.");
} else {
  const lines = log.split("\n");
  const byAuthor = {};
  const security = [];

  for (const line of lines) {
    const [hash, author, date, ...msgParts] = line.split("|");
    const msg = msgParts.join("|");
    if (!byAuthor[author]) byAuthor[author] = [];
    byAuthor[author].push({ hash, date, msg });

    if (/security|cve|vulnerab/i.test(msg)) {
      security.push({ hash, msg });
    }
  }

  for (const [author, commits] of Object.entries(byAuthor)) {
    console.log(`\n  ${author} (${commits.length}):`);
    for (const c of commits) {
      console.log(`    ${c.hash}  ${c.date}  ${c.msg}`);
    }
  }

  if (security.length > 0) {
    console.log(`\n  ⚠ Security-related commits (${security.length}):`);
    for (const s of security) {
      console.log(`    ${s.hash}  ${s.msg}`);
    }
  }

  console.log(`\n  Total: ${lines.length} commit${lines.length > 1 ? "s" : ""}`);
}

// --- Branches with recent activity ---
section("Branches with recent activity");

const branches = run(
  `git for-each-ref --sort=-committerdate --format="%(refname:short)|%(committerdate:short)|%(authorname)|%(subject)" refs/heads/ refs/remotes/origin/`
);

if (!branches) {
  console.log("  No branches found.");
} else {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  let count = 0;
  for (const line of branches.split("\n")) {
    const [branch, date, author, ...msgParts] = line.split("|");
    if (date >= cutoffStr) {
      console.log(`  ${branch}`);
      console.log(`    ${date}  ${author}  ${msgParts.join("|")}`);
      count++;
    }
  }
  if (count === 0) {
    console.log("  No branches updated in this period.");
  }
}

// --- Files changed ---
section("Files changed");

const filesChanged = run(
  `git diff --stat HEAD~$(git rev-list --count --since="${since}" HEAD) HEAD 2>/dev/null`
);

if (!filesChanged) {
  console.log("  No file changes.");
} else {
  for (const line of filesChanged.split("\n")) {
    console.log(`  ${line}`);
  }
}

// --- Dependency changes ---
section("Dependency updates");

const depCommits = run(
  `git log --since="${since}" --format="%h %s" --grep="deps"`
);

if (!depCommits) {
  console.log("  No dependency updates.");
} else {
  const fixes = [];
  const chores = [];

  for (const line of depCommits.split("\n")) {
    if (/^[a-f0-9]+ fix/.test(line)) {
      fixes.push(line);
    } else {
      chores.push(line);
    }
  }

  if (fixes.length > 0) {
    console.log(`  Bug fixes (${fixes.length}):`);
    for (const f of fixes) console.log(`    ${f}`);
  }
  if (chores.length > 0) {
    console.log(`  Routine updates (${chores.length}):`);
    for (const c of chores) console.log(`    ${c}`);
  }
}

console.log("\n" + "─".repeat(50));
console.log(`Summary generated at ${new Date().toISOString()}`);
console.log(`Looking back ${days} day${days > 1 ? "s" : ""}\n`);
