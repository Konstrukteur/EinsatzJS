// RemoteCacheDeployer.js

import path from "path";

import { AbstractDeployer } from "./AbstractDeployer.js";

import { sectionLogger, actionLogger } from "../utils/logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { handleError } from "../utils/handleError.js";

export class RemoteCacheDeployer extends AbstractDeployer {
  constructor(shokanInstance) {
    this.conn = shokanInstance.conn;
    this.repoDetails = shokanInstance.repoDetails;
    this.projectFolder = shokanInstance.projectFolder;
    this.releaseDir = `${shokanInstance.projectFolder}/releases/${shokanInstance.revisionTime}`;
  }

  async deploy(stepNumber, connectionMessage) {}

  async rollback() {
    /* Rollback logic */
  }
}
