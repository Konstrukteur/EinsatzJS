import { actionLogger } from "logger";

export const handleError = async (message, error) => {
  logger.error(message, chalk.red);
  if (error.stdout) actionLogger.error(`stdout: ${error.stdout}`, chalk.red);
  if (error.stderr) actionLogger.error(`stderr: ${error.stderr}`, chalk.red);
  throw error;
};
