// deployActions/setCurrentRevision.js

import chalk from "chalk";
import { sectionLogger, actionLogger } from "./logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

export const setCurrentRevision = async (
  conn,
  releaseDir,
  connectionMessage
) => {
  sectionLogger("deploy:set_current_revision", chalk.blue);
  try {
    const getCurrentRevisionCommand = `(cd ${releaseDir} && git rev-parse HEAD)`;
    actionLogger.info(`01 ${getCurrentRevisionCommand}`, chalk.yellow);

    const revision = await asyncWrapper(conn, getCurrentRevisionCommand);
    actionLogger.success(`01 ${connectionMessage}`, chalk.green);

    const setCurrentRevisionCommand = `echo "${revision}" > ${releaseDir}/REVISION`;
    actionLogger.info(`02 ${setCurrentRevisionCommand}`, chalk.yellow);
    await asyncWrapper(conn, setCurrentRevisionCommand);
    actionLogger.success(`02 ${connectionMessage}`, chalk.green);

    return revision;
  } catch (error) {
    // Log and rethrow the error for handling in the calling function
    actionLogger.error(`Command failed: ${error.message}`, chalk.red);
    throw new Error(`Execution of step ${stepNumber} failed: ${error.message}`);
  }
};

export const setCurrentRevisionTime = async (
  conn,
  revisionTime,
  releaseDir,
  stepNumber,
  connectionMessage
) => {
  sectionLogger("deploy:set_current_revision_time", chalk.blue);
  try {
    const command = `echo "${revisionTime}" > ${releaseDir}/REVISION_TIME`;

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
