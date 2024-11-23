// deployActions/assetsPrecompile.js

import chalk from "chalk";
import { sectionLogger, actionLogger } from "./logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

export const assetsPrecompile = async (conn, stepNumber, connectionMessage) => {
  sectionLogger("npm:assets:precompile", chalk.blue);
  try {
    actionLogger.info(
      `No asset compilation required, skipping precompilation`,
      chalk.white
    );
  } catch (error) {
    // Log and rethrow the error for handling in the calling function
    actionLogger.error(`Command failed: ${error.message}`, chalk.red);
    throw new Error(`Execution of step ${stepNumber} failed: ${error.message}`);
  }
};
