import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const candidates = [
  "prisma/schema.prisma",
  "schema.prisma",
  "future-minds-billing/prisma/schema.prisma",
  "future-minds-billing/schema.prisma",
  "../prisma/schema.prisma",
  "../future-minds-billing/prisma/schema.prisma",
];

let targetSchema = candidates.find((rel) => existsSync(resolve(process.cwd(), rel)));

if (!targetSchema) {
  console.warn("Could not find schema in candidate paths, defaulting to standard prisma generate");
  execSync("npx prisma generate", { stdio: "inherit" });
} else {
  console.log(`Generating Prisma client with schema: ${targetSchema}`);
  execSync(`npx prisma generate --schema=${targetSchema}`, { stdio: "inherit" });
}
