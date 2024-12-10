// lib/deployer/RemoteCacheDeployer.js

// Global imports
import path from "path";

// Local imports
import { AbstractDeployer } from "./AbstractDeployer.js";
import { sectionLogger, actionLogger } from "../utils/logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

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
