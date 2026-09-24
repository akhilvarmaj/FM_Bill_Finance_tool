import "dotenv/config";
import { runAutomation } from "../src/lib/automation/service";
import { db } from "../src/lib/db";
import { enqueueEmailReminders, processEmailQueue } from "../src/lib/notifications/delivery";
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try { console.log(JSON.stringify({ time: new Date().toISOString(), billing: await runAutomation(), reminders: await enqueueEmailReminders(), email: await processEmailQueue() })); }
  catch { console.error("Automation failed. Check database availability and job settings."); if (process.argv.includes("--once")) process.exitCode = 1; }
  finally { running = false; }
}
async function main() {
  await tick();
  if (process.argv.includes("--once")) { await db.$disconnect(); return; }
  const timer = setInterval(() => void tick(), 60000);
  process.once("SIGINT", () => { clearInterval(timer); void db.$disconnect().finally(() => process.exit()); });
  process.once("SIGTERM", () => { clearInterval(timer); void db.$disconnect().finally(() => process.exit()); });
}
void main();