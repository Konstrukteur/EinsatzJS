// deployActions/backupPackageJson.js

import chalk from "chalk";
import { sectionLogger, actionLogger } from "./logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

export const backupPackageJson = async (
  conn,
  stepNumber,
  connectionMessage
) => {
  sectionLogger("npm:backup_package_json", chalk.blue);
  try {
    actionLogger.info(
      `Backing up package.json not required, skipping backing up`,
      chalk.white
    );
  } catch (error) {
    // Log and rethrow the error for handling in the calling function
    actionLogger.error(`Command failed: ${error.message}`, chalk.red);
    throw new Error(`Execution of step ${stepNumber} failed: ${error.message}`);
  }
};
