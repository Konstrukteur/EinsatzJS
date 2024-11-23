// GitDeployer.js

import path from "path";
import fs from "fs";

import { AbstractDeployer } from "./AbstractDeployer";

import { sectionLogger, actionLogger } from "../utils/logger";
import { asyncWrapper } from "../utils/asyncWrapper";
import { handleError } from "./utils/handleError";

export class GitDeployer extends AbstractDeployer {
  constructor(shokanInstance) {
    this.conn = shokanInstance.conn;
    this.repoDetails = shokanInstance.repoDetails;
    this.projectFolder = shokanInstance.projectFolder;
    this.releaseDir = `${shokanInstance.projectFolder}/releases/${shokanInstance.revisionTime}`;
  }

  async deploy(stepNumber, connectionMessage) {
    const { repoUrl, branch } = this.repoDetails;

    try {
      actionLogger.info("Starting Git deployment...");
      await createReleaseDir(this.conn, this.releaseDir);
      await cloneRemoteRepo(this.conn, this.repoDetails, this.releaseDir);
      // Add more Git-specific deployment steps here.

      // Check if a repo exists in the release directory
      const repoExists = fs.existsSync(path.join(this.releaseDir, ".git"));
      // if (repoExists === "exists") {
      if (repoExists) {
        // Pull the latest changes if the repository already exists
        sectionLogger("git:pull", chalk.blue);

        const pullCommand = `cd ${releaseDir} && git pull origin ${branch}`;

        actionLogger.info(
          `${String(stepNumber).padStart(2, "0")} ${pullCommand}`,
          chalk.yellow
        );

        await asyncWrapper(conn, pullCommand);

        actionLogger.info(
          `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
          chalk.green
        );
      } else {
        // Clone the repository if it does not exist
        sectionLogger("git:clone", chalk.blue);

        const cloneCommand = `git clone --branch ${branch} ${repoUrl} ${this.releaseDir}`;

        actionLogger.info(
          `${String(stepNumber).padStart(2, "0")} ${cloneCommand}`,
          chalk.yellow
        );

        await this.asyncWrapper(conn, cloneCommand);

        actionLogger.info(
          `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
          chalk.green
        );
      }
    } catch (error) {
      throw new Error(`Git deployment failed: ${error.message}`);
    }
  }
  async rollback() {
    /* Rollback logic */
  }
}
