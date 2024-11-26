#!/usr/bin/env node

import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import readline from "readline";
import Shokan from "../lib/Shokan.js";

import { actionLogger } from "../lib/utils/logger.js";

// Helper function to create a new deployer instance
const createDeployer = async () => {
  const deployConfigPath = path.resolve(process.cwd(), "config", "deploy.js");

  let deployConfig;
  try {
    // Dynamically import the deployConfig
    deployConfig = (await import(`file://${deployConfigPath}`)).default;
  } catch (error) {
    actionLogger.error(
      `Error loading deploy configuration from ${deployConfigPath}:`,
      error.message
    );
    process.exit(1); // Exit if config can't be loaded
  }

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
  const deployer = await createDeployer();
  await deployer.deploy();
};

const releases = async () => {
  const deployer = await createDeployer();
  await deployer.getReleaseIds();
};

const rollback = async () => {
  const deployer = await createDeployer();
  await deployer.rollback();
};

const switchVersion = async (releaseId) => {
  const deployer = await createDeployer();

  if (!releaseId) {
    actionLogger.info("No release ID provided, fetching releases...");
    try {
      const releaseIds = await deployer.getReleaseIds();
      if (!releaseIds || releaseIds.length === 0) {
        actionLogger.info("No releases found. Exiting...");
        return;
      }
      actionLogger.info("Available releases:");
      releaseIds.forEach((id, index) =>
        actionLogger.info(`${index + 1}. Release ID: ${id}`)
      );

      releaseId = await promptUserSelection(releaseIds);
      if (!releaseId) {
        actionLogger.error("No valid release selected. Exiting...");
        return;
      }
    } catch (error) {
      actionLogger.error("Error fetching release IDs:", error);
      return;
    }
  }

  actionLogger.info(`Switching to release ID: ${releaseId}`);
  try {
    await deployer.switchRelease(releaseId);
  } catch (error) {
    actionLogger.error(
      `Error switching to release ${releaseId}: ${error.message}`
    );
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
            actionLogger.info("Operation cancelled by the user.");
            resolve(null); // Return null for cancellation
            rl.close();
            return;
          }

          const selectedIndex = parseInt(answer) - 1;
          if (selectedIndex >= 0 && selectedIndex < releaseIds.length) {
            resolve(releaseIds[selectedIndex]); // Resolve with the selected release
            rl.close();
          } else {
            actionLogger.error(
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

// Setup command to copy the configuration file to the application config directory for deployment
const setup = async () => {
  const deployConfigPath = path.resolve("templates/config", "deploy.js");
  const templatePath = path.resolve(
    "node_modules",
    "shokan",
    "config",
    "deploy.js"
  );

  try {
    // Ensure the config directory exists
    await fs.mkdir(path.resolve("config"), { recursive: true });

    // Check if the deploy.js file already exists
    try {
      await fs.access(deployConfigPath);
      actionLogger.log(
        "deploy.js already exists in config directory. Skipping setup."
      );
      return;
    } catch (error) {
      // File does not exist, proceed with copy
      actionLogger.log("Setting up deployment configuration...");
      await fs.copyFile(templatePath, deployConfigPath);
      actionLogger.log("deploy.js template copied to config directory.");
    }
  } catch (error) {
    actionLogger.error("Error during setup:", error.message);
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
