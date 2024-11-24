#!/usr/bin/env node

import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import readline from "readline";
import Shokan from "../lib/Shokan.js"; // Assuming Shokan class is in lib/shokan.js
import deployConfig from "../config/deploy.js"; // The deployConfig (adjust the path as needed)

// Helper function to create a new deployer instance
const createDeployer = () => {
  return new Shokan({
    application: deployConfig.application,
    deployVia: deployConfig.deployVia,
    connectionConfig: {
      host: deployConfig.server,
      port: deployConfig.port,
      username: deployConfig.user,
      agent: deployConfig.agent || process.env.SSH_AUTH_SOCK,
      agentForward: deployConfig.agentForward || true,
    },
    repoDetails: {
      repoUrl: deployConfig.repoUrl,
      branch: deployConfig.branch,
    },
    nodeVersion: deployConfig.nodeVersion,
    projectFolder: deployConfig.deployTo,
  });
};

// Actions
const deploy = async () => {
  const deployer = createDeployer();
  await deployer.deploy();
};

const releases = async () => {
  const deployer = createDeployer();
  await deployer.getReleaseIds();
};

const rollback = async () => {
  const deployer = createDeployer();
  await deployer.rollback();
};

const switchVersion = async (releaseId) => {
  const deployer = createDeployer();

  if (!releaseId) {
    console.info("No release ID provided, fetching releases...");
    try {
      const releaseIds = await deployer.getReleaseIds();
      if (!releaseIds || releaseIds.length === 0) {
        console.info("No releases found. Exiting...");
        return;
      }
      console.info("Available releases:");
      releaseIds.forEach((id, index) =>
        console.info(`${index + 1}. Release ID: ${id}`)
      );

      releaseId = await promptUserSelection(releaseIds);
      if (!releaseId) {
        console.error("No valid release selected. Exiting...");
        return;
      }
    } catch (error) {
      console.error("Error fetching release IDs:", error);
      return;
    }
  }

  console.info(`Switching to release ID: ${releaseId}`);
  try {
    await deployer.switchRelease(releaseId);
  } catch (error) {
    console.error(`Error switching to release ${releaseId}: ${error.message}`);
  }
};

// Helper function to prompt user selection and wait for input
const promptUserSelection = (releaseIds) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = () => {
      rl.question(
        "Select a release by number or press 'c' to cancel: ",
        (answer) => {
          if (answer.trim().toLowerCase() === "c") {
            console.info("Operation cancelled by the user.");
            resolve(null); // Return null for cancellation
            rl.close();
            return;
          }

          const selectedIndex = parseInt(answer) - 1;
          if (selectedIndex >= 0 && selectedIndex < releaseIds.length) {
            resolve(releaseIds[selectedIndex]); // Resolve with the selected release
            rl.close();
          } else {
            console.error(
              "Invalid selection. Please choose a valid release number or press 'c' to cancel."
            );
            askQuestion(); // Recurse to ask again
          }
        }
      );
    };

    askQuestion(); // Start the questioning loop
  });
};

// Setup command to install the necessary pieces for deployment
const setup = async () => {
  const deployConfigPath = path.resolve("config", "deploy.js");
  const templatePath = path.resolve(
    "node_modules",
    "shokan",
    "config",
    "deploy.js"
  );

  try {
    // Check if the deploy.js file already exists
    try {
      await fs.access(deployConfigPath);
      console.log(
        "deploy.js already exists in config directory. Skipping setup."
      );
      return;
    } catch (error) {
      // File does not exist, proceed with copy
      console.log("Setting up deployment configuration...");
      await fs.copyFile(templatePath, deployConfigPath);
      console.log("deploy.js template copied to config directory.");
    }
  } catch (error) {
    console.error("Error during setup:", error.message);
  }
};

// Command-line program setup
const program = new Command();
program.name("shokan").version("0.1.0").description("Shokan Deployment CLI");

program.command("deploy").description("Deploy the application").action(deploy);
program.command("releases").description("List all releases").action(releases);
program
  .command("rollback")
  .description("Rollback to the previous release")
  .action(rollback);
program
  .command("switch [releaseId]")
  .description("Switch versions")
  .action(switchVersion);
program
  .command("setup")
  .description("Setup deployment configuration")
  .action(setup);

program.parse(process.argv);
