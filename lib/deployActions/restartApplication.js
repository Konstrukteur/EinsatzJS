// deployActions/restartApplication.js

import { sectionLogger, actionLogger } from "./logger.js"; // Ensure correct import paths
import { asyncWrapper } from "../utils/asyncWrapper.js";

/**
 * Restarts the application. Requires the systemctl process to follow the naming convention application.service.
 *
 * @param {Client} conn - An established SSH connection
 * @param {string} application - A string containing the applicationname.
 * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
 */
export async function restartApplication(
  conn,
  application,
  stepNumber,
  connectionMessage
) {
  sectionLogger("systemctl:restart", chalk.blue);

  try {
    const restartCommand = `sudo systemctl restart ${application}.service`;
    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} ${restartCommand}`,
      chalk.yellow
    );
    await asyncWrapper(conn, restartCommand);
    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
      chalk.green
    );
  } catch (error) {
    // Log any errors during npm install
    actionLogger.error(
      `Error restarting the service: ${error.message}`,
      chalk.red
    );
    throw error; // Re-throw the error for further handling if necessary
  }
}
