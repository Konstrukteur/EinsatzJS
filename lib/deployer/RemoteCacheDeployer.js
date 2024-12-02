// RemoteCacheDeployer.js

import path from "path";

import { AbstractDeployer } from "./AbstractDeployer.js";

import { sectionLogger, actionLogger } from "../utils/logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { handleError } from "../utils/handleError.js";

export class RemoteCacheDeployer extends AbstractDeployer {
  constructor(einsatzInstance) {
    this.conn = einsatzInstance.conn;
    this.repoDetails = einsatzInstance.repoDetails;
    this.projectFolder = einsatzInstance.projectFolder;
    this.releaseDir = `${einsatzInstance.projectFolder}/releases/${einsatzInstance.revisionTime}`;
  }

  async deploy(stepNumber, connectionMessage) {}

  async rollback() {
    /* Rollback logic */
  }
}
