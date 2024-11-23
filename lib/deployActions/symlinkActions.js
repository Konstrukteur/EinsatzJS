// deployActions/symlinkLinkedDirs.js

import chalk from "chalk";

import { sectionLogger, actionLogger } from "../utils/logger.js"; // Ensure correct import paths
import { asyncWrapper } from "../utils/asyncWrapper.js";

/**
 *  Creates symlinks for all linked dirs.
 *
 * @param {Client} conn - An established SSH connection
 * @param {string} projectFolder - The project directory
 * @param {string} releaseDir - The release directory
 * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
 */
export const symlinkLinkedDirs = async (
  conn,
  projectFolder,
  releaseDir,
  connectionMessage
) => {
  const cachePath = `${projectFolder}/shared/cache`;
  const logsPath = `${projectFolder}/shared/logs`;
  const uploadsPath = `${projectFolder}/shared/media/uploads`;

  sectionLogger("deploy:symlink:linked_files", chalk.blue);

  // Define the paths for symlinks
  const symlinks = [
    { target: cachePath, link: `${releaseDir}/cache` },
    { target: logsPath, link: `${releaseDir}/logs` },
    { target: uploadsPath, link: `${releaseDir}/public/uploads` },
  ];

  try {
    // Execute each symlink command sequentially
    for (const [i, { target, link }] of symlinks.entries()) {
      const symlinkCommand = `ln -s ${target} ${link}`;
      actionLogger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
      // await execCommand(symlinkCommand);
      await asyncWrapper(conn, symlinkCommand);
      actionLogger.success(`0${i + 1} ${connectionMessage}`, chalk.green);
    }
  } catch (error) {
    actionLogger.error(`Error creating symlinks: ${error.message}`, chalk.red);
    throw error; // Re-throw the error for further handling if necessary
  }
};

/**
 * Creates symlinks for all linked files.
 *
 * @param {Client} conn - An established SSH connection
 * @param {string} projectFolder - The project directory
 * @param {string} releaseDir - The release directory
 * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
 */

export const symlinkLinkedFiles = async (
  conn,
  projectFolder,
  releaseDir,
  connectionMessage
) => {
  const secretsPath = `${projectFolder}/shared/secrets/.env.production`;

  sectionLogger("deploy:symlink:linked_files", chalk.blue);

  // Define the paths for symlinks
  const symlinks = [
    { target: secretsPath, link: `${releaseDir}/.env.production` },
  ];

  try {
    // Execute each symlink command sequentially
    for (const [i, { target, link }] of symlinks.entries()) {
      const symlinkCommand = `ln -s ${target} ${link}`;
      actionLogger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
      // await execCommand(symlinkCommand);
      await asyncWrapper(conn, symlinkCommand);
      actionLogger.success(`0${i + 1} ${connectionMessage}`, chalk.green);
    }
  } catch (error) {
    actionLogger.error(`Error creating symlinks: ${error.message}`, chalk.red);
    throw error; // Re-throw the error for further handling if necessary
  }
};

/**
 * Creates symlinks for all resources in shared/public to the release/public directory.
 *
 * @param {Client} conn - An established SSH connection
 * @param {string} projectFolder - The project directory
 * @param {string} releaseDir - The release directory
 * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
 */
export const symlinkPublicResources = async (
  conn,
  projectFolder,
  releaseDir,
  connectionMessage
) => {
  const sharedPublicDir = `${projectFolder}/shared/public`;
  const releasePublicDir = `${releaseDir}/public`;

  sectionLogger("deploy:after:symlink_public_resources", chalk.blue);

  try {
    // List all files and directories in the shared/public directory
    const listCommand = `find ${sharedPublicDir} -mindepth 1 -maxdepth 1`;
    actionLogger.info(`Listing resources in ${sharedPublicDir}`, chalk.white);

    // Execute the list command and capture output
    const result = await asyncWrapper(conn, listCommand);
    const resources = result.trim().split("\n");

    // Loop through resources and create symlinks in the release/public directory
    for (const [i, resource] of resources.entries()) {
      const resourceName = resource.split("/").pop(); // Get the file/directory name
      const linkPath = `${releasePublicDir}/${resourceName}`;
      const symlinkCommand = `ln -s ${resource} ${linkPath}`;

      actionLogger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
      await asyncWrapper(conn, symlinkCommand);
      actionLogger.success(`0${i + 1} ${connectionMessage}`, chalk.green);
    }
  } catch (error) {
    actionLogger.error(`Error creating symlinks: ${error.message}`, chalk.red);
    throw error; // Re-throw the error for further handling if necessary
  }
};

export const symlinkRelease = async (
  conn,
  releaseDir,
  currentSymlink,
  stepNumber,
  connectionMessage
) => {
  sectionLogger("deploy:symlink:release", chalk.blue);
  try {
    const command = `ln -sfn ${releaseDir} ${currentSymlink}`;

    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} ${command}`,
      chalk.yellow
    );
    // Execute the command using the async wrapper
    await asyncWrapper(conn, command);

    // Log success message
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
