// deployActions/npmActions.js

import { sectionLogger, actionLogger } from "./logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

export const npmConfig = async (
  conn,
  nodeVersion,
  releaseDir,
  stepNumber,
  connectionMessage
) => {
  sectionLogger("npm:config", chalk.blue);
  try {
    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} nvm use ${nodeVersion}`,
      chalk.yellow
    );
    actionLogger.success(
      `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
      chalk.green
    );
  } catch (error) {
    // Log and rethrow the error for handling in the calling function
    actionLogger.error(`Command failed: ${error.message}`, chalk.red);
    throw new Error(`Execution of step ${stepNumber} failed: ${error.message}`);
  }
};

/**
 * Runs npm install in the release directory on the remote server.
 *
 * @param {Client} conn - An established SSH connection
 * @param {string} nodeVersion - The required version of node.
 * @param {string} releaseDir - The path to the release directory
 * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
 */
export const npmInstall = async (
  conn,
  nodeVersion,
  releaseDir,
  stepNumber,
  connectionMessage
) => {
  sectionLogger("npm:install", chalk.blue);
  try {
    // Construct the npm install command with the release directory
    // const installCommand = `npm install --prefix ${releaseDir}`;
    const installCommand = `zsh -c '. /home/stephan/.nvm/nvm.sh && nvm use v${nodeVersion} && npm install --prefix ${releaseDir}'`;
    actionLogger.info(`01 ${installCommand}`, chalk.yellow);

    // Execute the npm install command
    await asyncWrapper(conn, installCommand);

    // Log success
    actionLogger.success(
      `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
      chalk.green
    );
  } catch (error) {
    // Log any errors during npm install
    actionLogger.error(
      `Error running npm install in ${releaseDir}: ${error.message}`,
      chalk.red
    );
    throw error; // Re-throw the error for further handling if necessary
  }
};
