// lib/utils/handleError.js

// Global imports
import chalk from "chalk";

// Local imports
import { actionLogger } from "./logger.js";
import SSHError from "../errors/DeploymentError.js";
import DeploymentError from "../errors/DeploymentError.js";

export function handleError(task, context, error) {
  if (error instanceof DeploymentError) {
    actionLogger.error(
      `Deployment failed for task ${error.task} at step "${error.step}": ${error.message}`,
      chalk.red
    );
  } else if (error instanceof SSHError) {
    actionLogger.error(`Message: ${error.message}`, chalk.red);
    actionLogger.error(`Host: ${error.host}`, chalk.red);
    actionLogger.error(`Username: ${error.username}`, chalk.red);
    actionLogger.error(`Port: ${error.port}`, chalk.red);
    actionLogger.error(`Timestamp: ${error.timestamp}`, chalk.red);
  }
  if (error.stdout) {
    // Handle errors with command output
    actionLogger.error(`stdout: ${error.stdout}`, chalk.red);
  } else if (error.message) {
    // Generic error message
    actionLogger.error(`Error: ${error.message}`, chalk.red);
  } else {
    actionLogger.error("An unknown error occurred.", chalk.red);
  }
}
