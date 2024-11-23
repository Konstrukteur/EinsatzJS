// deployActions/migrate.js

import chalk from "chalk";
import { sectionLogger, actionLogger } from "./logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

export const migrate = async (conn, stepNumber, connectionMessage) => {
  sectionLogger("deploy:migrate", chalk.blue);
  try {
    actionLogger.info(`[deploy:migrate] Run 'node db/migrate.js'`, chalk.white);
  } catch (error) {
    // Log and rethrow the error for handling in the calling function
    actionLogger.error(`Command failed: ${error.message}`, chalk.red);
    throw new Error(`Execution of step ${stepNumber} failed: ${error.message}`);
  }
};

export const migrating = async (conn, stepNumber, connectionMessage) => {
  sectionLogger("deploy:migrating", chalk.blue);
  try {
    actionLogger.info(
      `Migrating not required, skipping migrations`,
      chalk.white
    );
  } catch (error) {
    // Log and rethrow the error for handling in the calling function
    actionLogger.error(`Command failed: ${error.message}`, chalk.red);
    throw new Error(`Execution of step ${stepNumber} failed: ${error.message}`);
  }
};
