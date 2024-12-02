// lib/deployer/GitDeployer.js

// Global imports
import path from "path";
import fs from "fs";
import chalk from "chalk";

// Local imports
import { AbstractDeployer } from "./AbstractDeployer.js";
import { sectionLogger, actionLogger } from "../utils/logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

export class GitDeployer extends AbstractDeployer {
  constructor(einsatzInstance) {
    super(einsatzInstance); // Call to parent constructor
    this.application = einsatzInstance.application;
    this.conn = einsatzInstance.conn;
    this.connectionConfig = einsatzInstance.connectionConfig;
    this.repoDetails = einsatzInstance.repoDetails;
    this.nodeVersion = einsatzInstance.nodeVersion;
    this.projectFolder = einsatzInstance.projectFolder;
    this.releaseDir = `${einsatzInstance.projectFolder}/releases/${einsatzInstance.revisionTime}`;
    this.revisionLogFile = einsatzInstance.revisionLogFile;
    this.revision = "";
    this.revisionTime = einsatzInstance.revisionTime;
    this.releases = einsatzInstance.releases;
  }

  async deploy() {
    const { repoUrl, branch } = this.repoDetails;

    actionLogger.info("Starting Git deployment...");

    const currentSymlink = `${this.projectFolder}/current`;
    const connectionMessage = `${this.connectionConfig.username}@${this.connectionConfig.host}`;

    // git:wrapper

    // git:check

    // deploy:check:directories
    await this.checkDirectories(
      this.conn,
      this.projectFolder,
      1,
      connectionMessage
    );

    // deploy:check:linkedDirs
    await this.checkLinkedDirs(
      this.conn,
      this.projectFolder,
      1,
      connectionMessage
    );

    // deploy:check:makeLinkedDirs
    await this.makeLinkedDirs(
      this.conn,
      this.projectFolder,
      1,
      connectionMessage
    );

    // deploy:create:releaseDir
    await this.createReleaseDir(
      this.conn,
      this.releaseDir,
      1,
      connectionMessage
    );

    // Check if a repo exists in the release directory
    const repoExists = fs.existsSync(path.join(this.releaseDir, ".git"));
    repoExists
      ? await this.pullRepo(
          this.conn,
          this.releaseDir,
          branch,
          1,
          connectionMessage
        )
      : await this.cloneRepo(this.conn, branch, repoUrl, 1, connectionMessage);

    // deploy:set_current_revision
    this.revision = await this.setCurrentRevision(
      this.conn,
      this.releaseDir,
      1,
      connectionMessage
    );
    actionLogger.info(this.revision);

    // deploy:set_current_revision_time
    await this.setCurrentRevisionTime(
      this.conn,
      this.revisionTime,
      this.releaseDir,
      1,
      connectionMessage
    );

    // deploy:symlink:linked_files
    await this.symlinkLinkedFiles(
      this.conn,
      this.projectFolder,
      this.releaseDir,
      connectionMessage
    );

    // deploy:symlink:linked_dirs
    await this.symlinkLinkedDirs(
      this.conn,
      this.projectFolder,
      this.releaseDir,
      connectionMessage
    );

    // npm:config
    await this.npmConfig(
      this.conn,
      this.nodeVersion,
      this.releaseDir,
      1,
      connectionMessage
    );

    // npm:install
    await this.npmInstall(
      this.conn,
      this.nodeVersion,
      this.releaseDir,
      1,
      connectionMessage
    );

    // npm:assets:precompile
    await this.assetsPrecompile(
      this.conn,
      this.releaseDir,
      1,
      connectionMessage
    );

    // npm:backup_package_json
    await this.backupPackageJson(
      this.conn,
      this.releaseDir,
      1,
      connectionMessage
    );

    // deploy:migrate
    await this.migrate(this.conn, this.releaseDir, 1, connectionMessage);

    // deploy:migrating
    await this.migrating(this.conn, this.releaseDir, 1, connectionMessage);

    // deploy:symlink:release
    await this.symlinkRelease(
      this.conn,
      this.releaseDir,
      currentSymlink,
      1,
      connectionMessage
    );

    // systemctl:restart
    await this.restartApplication(
      this.conn,
      this.application,
      1,
      connectionMessage
    );

    // deploy:cleanup
    await this.cleanupOldReleases(
      this.conn,
      this.projectFolder,
      this.releases,
      1,
      connectionMessage
    );

    // deploy:log_revision
    actionLogger.info(this.revision);
    await this.logRevision(
      this.conn,
      this.repoDetails.branch,
      this.revision,
      this.revisionTime,
      this.connectionConfig.username,
      this.projectFolder,
      1,
      connectionMessage
    );

    // deploy:after:symlink_public_resources
    await this.symlinkPublicResources(
      this.conn,
      this.projectFolder,
      this.releaseDir,
      connectionMessage
    );
  }
  async rollback() {
    /* Rollback logic */
  }

  async cloneRepo(conn, branch, repoUrl, stepNumber, connectionMessage) {
    // Clone the repository if it does not exist
    sectionLogger("git:clone", chalk.blue);

    const cloneCommand = `git clone --branch ${branch} ${repoUrl} ${this.releaseDir}`;

    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} ${cloneCommand}`,
      chalk.yellow
    );

    await new Promise((resolve, reject) => {
      conn.exec(cloneCommand, (err, stream) => {
        if (err) {
          reject(new Error(`Command failed: ${err.message}`));
          return;
        }

        let stdoutData = "";
        let stderrData = "";

        stream.on("data", (data) => {
          const output = data.toString();
          stdoutData += output;
          actionLogger.info(output); // Print stdout in real-time
        });

        // Handle standard error (stderr)
        stream.stderr.on("data", (data) => {
          const errorOutput = data.toString();
          stderrData += errorOutput;

          // Use a warning logger for non-critical messages
          if (errorOutput.toLowerCase().includes("error")) {
            actionLogger.error(errorOutput); // Treat as error if it mentions 'error'
          } else {
            actionLogger.info(errorOutput); // Log as warning otherwise
          }
        });

        stream.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}`));
          } else {
            resolve(stdoutData.trim());
          }
        });
      });
    });

    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
      chalk.green
    );
  }

  async pullRepo(conn, releaseDir, branch, stepNumber, connectionMessage) {
    // Pull the latest changes if the repository already exists
    sectionLogger("git:pull", chalk.blue);

    const pullCommand = `cd ${this.releaseDir} && git pull origin ${branch}`;

    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} ${pullCommand}`,
      chalk.yellow
    );

    await asyncWrapper(conn, pullCommand);

    actionLogger.info(
      `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
      chalk.green
    );
  }

  async checkRepo() {}
}
