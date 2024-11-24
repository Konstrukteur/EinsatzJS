import chalk from "chalk"; // Ensure this is imported
import { actionLogger } from "./logger.js"; // Ensure logger is imported

export function handleError(message, error) {
  if (error) {
    if (error.stdout) {
      actionLogger.error(`stdout: ${error.stdout}`, chalk.red);
    } else {
      actionLogger.error(
        `Error: ${error.message || "Unknown error"}`,
        chalk.red
      );
    }
  } else {
    actionLogger.error("An unknown error occurred.", chalk.red);
  }
}
