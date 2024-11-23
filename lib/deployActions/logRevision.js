// deployActions/logRevision.js

import chalk from "chalk";
import { sectionLogger, actionLogger } from "./logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

export const logRevision = async (
  conn,
  branch,
  revision,
  revisionTime,
  username,
  projectFolder,
  connectionMessage
) => {
  sectionLogger("deploy:log_revision", chalk.blue);
  try {
    const command = `echo "Branch ${branch} (at ${revision}) deployed as release ${revisionTime} by ${username}" >> ${projectFolder}/revisions.log`;

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
