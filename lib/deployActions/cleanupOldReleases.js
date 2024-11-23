// deployActions/cleanupOldReleases.js

import { sectionLogger, actionLogger } from "./logger.js"; // Ensure correct import paths

/**
 * Cleans up old releases on the VPS, keeping only the specified number of most recent releases.
 *
 * @param {Client} conn - An established SSH connection.
 * @param {string} projectFolder - The base project folder path on the VPS.
 * @param {number} keepCount - The number of most recent releases to keep.
 * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
 */
export async function cleanupOldReleases(
  conn,
  projectFolder,
  keepCount,
  stepNumber,
  connectionMessage
) {
  const releasesPath = `${projectFolder}/releases`;

  sectionLogger("deploy:cleanup", chalk.blue);

  try {
    const cleanUpCommand = `cd ${releasesPath} && ls -1t | tail -n +${
      keepCount + 1
    } | xargs -I {} rm -rf {}`;

    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} ${cleanUpCommand}`,
      chalk.yellow
    );

    await executeCommand(conn, cleanUpCommand); // Using executeCommand to send SSH command

    actionLogger.success(
      `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
      chalk.green
    );
  } catch (error) {
    actionLogger.error(
      `Error cleaning up releases: ${error.message}`,
      chalk.red
    );
    throw error; // Re-throw the error for further handling if necessary
  }
}
