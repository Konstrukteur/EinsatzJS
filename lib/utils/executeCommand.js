import chalk from "chalk";

import { actionLogger } from "./logger.js"; // Adjust the path to your logger utility
import { asyncWrapper } from "./asyncWrapper.js"; // Import the asyncWrapper utility

/**
 * Executes a command on an SSH connection.
 * @param {Client} conn - The SSH client instance.
 * @param {string} command - The command to execute.
 * @param {number} number - The step number (for logging).
 * @param {string} description - A description of the command being executed.
 * @param {Object} connectionConfig - SSH connection configuration (for logging purposes).
 * @returns {Promise<void>} - Resolves when the command completes successfully.
 */
export async function executeCommand(
  conn,
  command,
  number,
  description,
  connectionConfig
) {
  actionLogger.info(
    `${String(number).padStart(2, "0")} ${description}: ${command}`,
    chalk.yellow
  );

  try {
    // Execute the command using the async wrapper
    await asyncWrapper(conn, command);

    // Log success message
    actionLogger.success(
      `${String(number).padStart(2, "0")} ${connectionConfig.username}@${
        connectionConfig.host
      }: ${description}`,
      chalk.green
    );
  } catch (error) {
    // Log and rethrow the error for handling in the calling function
    actionLogger.error(`Command failed: ${error.message}`, chalk.red);
    throw new Error(`Execution of step ${number} failed: ${error.message}`);
  }
}
