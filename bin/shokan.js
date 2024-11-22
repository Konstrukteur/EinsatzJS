#!/usr/bin/env node
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { copySync } from "fs-extra";

const [, , command, ...args] = process.argv;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

switch (command) {
  case "setup":
    copySetupFiles();
    break;
  case "deploy":
    deployApplication(args[0]);
    break;
  default:
    console.log("Usage: deployScriptName <setup|deploy>");
}

function copySetupFiles() {
  const targetPath = join(process.cwd(), "config", "deploy.js");
  const sourcePath = join(__dirname, "../templates/config/deploy.js");
  copySync(sourcePath, targetPath);
  console.log("Deployment configuration added to config/deploy.js");
}

function deployApplication(environment) {
  console.log(`Deploying to ${environment || "default"} environment...`);
  try {
    execSync(`node ./config/deploy.js ${environment}`, { stdio: "inherit" });
  } catch (error) {
    console.error("Deployment failed:", error.message);
  }
}
