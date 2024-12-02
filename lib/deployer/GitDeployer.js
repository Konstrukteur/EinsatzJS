// GitDeployer.js

import path from "path";
import fs from "fs";
import chalk from "chalk";

import { AbstractDeployer } from "./AbstractDeployer.js";

import { sectionLogger, actionLogger } from "../utils/logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { handleError } from "../utils/handleError.js";

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

    try {
      actionLogger.info("Starting Git deployment...");

      // const timestamp = new Date()
      //   .toISOString()
      //   .replace(/[:\-T]/g, "")
      //   .split(".")[0];
      // this.revisionTime = timestamp;
      // const releaseDir = `${this.projectFolder}/releases/${timestamp}`;
      const currentSymlink = `${this.projectFolder}/current`;
      const connectionMessage = `${this.connectionConfig.username}@${this.connectionConfig.host}`;

      // git:wrapper

      // git:check

      // deploy:check:directories
      try {
        await this.checkDirectories(
          this.conn,
          this.projectFolder,
          1,
          connectionMessage
        );
      } catch (error) {
        handleError(`Error while testing directories: ${error.message}`);
        throw error;
      }

      // deploy:check:linkedDirs
      try {
        await this.checkLinkedDirs(
          this.conn,
          this.projectFolder,
          1,
          connectionMessage
        );
      } catch (error) {
        handleError(
          `Error while checking linked directories: ${error.message}`
        );
        throw error;
      }

      // deploy:check:makeLinkedDirs
      try {
        await this.makeLinkedDirs(
          this.conn,
          this.projectFolder,
          1,
          connectionMessage
        );
      } catch (error) {
        handleError(
          `Error while creating linked directories: ${error.message}`
        );
        throw error;
      }

      // deploy:create:releaseDir
      try {
        await this.createReleaseDir(
          this.conn,
          this.releaseDir,
          1,
          connectionMessage
        );
      } catch (error) {
        handleError(`Error while setting revision: ${error.message}`);
        throw error;
      }

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
        : await this.cloneRepo(
            this.conn,
            branch,
            repoUrl,
            1,
            connectionMessage
          );

      // deploy:set_current_revision
      try {
        this.revision = await this.setCurrentRevision(
          this.conn,
          this.releaseDir,
          1,
          connectionMessage
        );
        actionLogger.info(this.revision);
      } catch (error) {
        handleError(`Error while setting revision: ${error.message}`);
        throw error;
      }

      // deploy:set_current_revision_time
      try {
        await this.setCurrentRevisionTime(
          this.conn,
          this.revisionTime,
          this.releaseDir,
          1,
          connectionMessage
        );
      } catch (error) {
        handleError(`Error while setting revision time: ${error.message}`);
        throw error;
      }

      // deploy:symlink:linked_files
      try {
        await this.symlinkLinkedFiles(
          this.conn,
          this.projectFolder,
          this.releaseDir,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(`Error linking files: ${error.message}`, chalk.red);
      }

      // deploy:symlink:linked_dirs
      try {
        await this.symlinkLinkedDirs(
          this.conn,
          this.projectFolder,
          this.releaseDir,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error linking directories: ${error.message}`,
          chalk.red
        );
      }

      // npm:config
      try {
        await this.npmConfig(
          this.conn,
          this.nodeVersion,
          this.releaseDir,
          1,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error during npm config tasks: ${error.message}`,
          chalk.red
        );
      }

      // npm:install
      try {
        await this.npmInstall(
          this.conn,
          this.nodeVersion,
          this.releaseDir,
          1,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error during npm install tasks: ${error.message}`,
          chalk.red
        );
      }

      // npm:assets:precompile
      try {
        await this.assetsPrecompile(
          this.conn,
          this.releaseDir,
          1,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error precompile tasks: ${error.message}`,
          chalk.red
        );
      }

      // npm:backup_package_json
      try {
        await this.backupPackageJson(
          this.conn,
          this.releaseDir,
          1,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error backing up Package.json: ${error.message}`,
          chalk.red
        );
      }

      // deploy:migrate
      try {
        await this.migrate(this.conn, this.releaseDir, 1, connectionMessage);
      } catch (error) {
        actionLogger.error(`Error during migrate: ${error.message}`, chalk.red);
      }

      // deploy:migrating
      try {
        await this.migrating(this.conn, this.releaseDir, 1, connectionMessage);
      } catch (error) {
        actionLogger.error(
          `Error running migrations: ${error.message}`,
          chalk.red
        );
      }

      // deploy:symlink:release
      try {
        await this.symlinkRelease(
          this.conn,
          this.releaseDir,
          currentSymlink,
          1,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error running migrations: ${error.message}`,
          chalk.red
        );
      }

      // systemctl:restart
      try {
        await this.restartApplication(
          this.conn,
          this.application,
          1,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error during restart tasks: ${error.message}`,
          chalk.red
        );
      }

      // deploy:cleanup
      try {
        await this.cleanupOldReleases(
          this.conn,
          this.projectFolder,
          this.releases,
          1,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error during cleanup tasks: ${error.message}`,
          chalk.red
        );
      }

      // deploy:log_revision
      try {
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
      } catch (error) {
        actionLogger.error(
          `Error logging revision: ${error.message}`,
          chalk.red
        );
      }

      // deploy:after:symlink_public_resources
      try {
        await this.symlinkPublicResources(
          this.conn,
          this.projectFolder,
          this.releaseDir,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(
          `Error during cleanup tasks: ${error.message}`,
          chalk.red
        );
      }
    } catch (error) {
      // in this implementation the error would be catched and thrown again
      //
      // this new error would go to the parent
      //
      //  I could through an error and pass an error object and use the object in the code that consumes it.
      // such as:
      //   throw new Error({
      //     statusCode: 400,
      //     message: "uh oh"
      //   }
      // )
      throw new Error(`Git deployment failed: ${error.message}`);
    }
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
