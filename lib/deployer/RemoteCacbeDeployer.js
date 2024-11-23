// RemoteCacheDeployer.js

import path from "path";

import { AbstractDeployer } from "./AbstractDeployer";

import { sectionLogger, actionLogger } from "../utils/logger";
import { asyncWrapper } from "../utils/asyncWrapper";
import { handleError } from "./utils/handleError";

export class RemoteSyncDeployer extends AbstractDeployer {
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
