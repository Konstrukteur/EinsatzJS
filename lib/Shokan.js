import chalk from "chalk";
import { Client } from "ssh2";

import { sectionLogger, actionLogger } from "./utils/logger";
import { establishConnection } from "./utils/sshConnection";
import { testAgentForwarding } from "./utils/testAgentForwarding";
import { handleError } from "./utils/handleError";

import { CopyDeployer } from "./deployer/CopyDeployer";
import { GitDeployer } from "./deployer/GitDeployer";
import { RemoteCacheDeployer } from "./deployer/RemoteCacheDeployer";
import { RemoteSyncDeployer } from "./deployer/RemoteSyncDeployer";

import { assetsPrecompile } from "./deployActions/assetsPrecompile";
import { backupPackageJson } from "./deployActions/backupPackageJson";
import { checkDirectories } from "./deployActions/checkDirectories";
import { checkLinkedDirs } from "./deployActions/checkLinkedDirs";
import { cleanupOldReleases } from "./deployActions/cleanupOldReleases";
import { createReleaseDir } from "./utils/createReleaseDir";
import { logRevision } from "./deployActions/logRevision";
import { makeLinkedDirs } from "./deployActions/makeLinkedDirs";
import { migrate, migrating } from "./deployActions/migrationActions";
import { npmConfig, npmInstall } from "./deployActions/npmActions";
import { restartApplication } from "./deployActions/restartApplication";
import {
  setCurrentRevision,
  setCurrentRevisionTime,
} from "./deployActions/currentRevisionActions";
import {
  symlinkLinkedDirs,
  symlinkLinkedFiles,
  symlinkPublicResources,
  symlinkRelease,
} from "./deployActions/symlinkActions";

const deployerMapping = {
  git: GitDeployer,
  copy: CopyDeployer,
  remoteCache: RemoteCacheDeployer,
  remoteSync: RemoteSyncDeployer,
};

/**
 * Shokan is a utility class for deploying projects to a remote VPS using an approach
 * inspired by Capistrano. It provides functionality for uploading repositories, managing releases,
 * and maintaining symlinks for deployments.
 */
class Shokan {
  /**
   * Creates an instance of Shokan.
   *
   * @param {Object} config - The configuration object.
   * @param {String} config.application - The name of the application
   * @param {String} config.deployVia - The name of the application
   * @param {Object} config.connectionConfig - Configuration for the remote VPS.
   * @param {string} config.connectionConfig.host - Hostname or IP address of the VPS.
   * @param {number} config.connectionConfig.port - Port for the SSH connection.
   * @param {string} config.connectionConfig.username - Username for the SSH connection.
   * @param {string} config.connectionConfig.agent - Agent for the SSH connection.
   * @param {string} config.connectionConfig.agentForward - Agentforwarding option.
   * @param {Object} config.repoDetails - Repository details for the project.
   * @param {string} config.repoDetails.repoUrl - URL of the Git repository.
   * @param {string} config.repoDetails.branch - Branch to deploy.
   * @param {string} config.nodeVersion - The nodeVersion used on the VPS.
   * @param {string} config.projectFolder - The base directory for the project on the VPS.
   */
  constructor({
    application,
    deployVia,
    connectionConfig,
    repoDetails,
    nodeVersion,
    projectFolder,
  }) {
    this.application = application; // The application name
    this.deployVia = deployVia; // deployment method
    this.connectionConfig = connectionConfig; // { host, port, username, agent }
    this.repoDetails = repoDetails; // { repoUrl, branch }
    this.nodeVersion = nodeVersion;
    this.projectFolder = projectFolder; // Path to project folder on the VPS
    this.repoDirectory = `${this.projectFolder}/repo`; // Repo directory location
    this.revisionLogFile = `${this.projectFolder}/revisions.log`; // Path to revisions.log file
    this.revision = "";
    this.revisionTime = "";
    this.releases = 5;

    // Instantiate the appropriate deployer
    const DeployerClass = deployerMapping[this.deployVia];
    if (!DeployerClass) {
      throw new Error(`Unsupported deploy method: ${this.deployVia}`);
    }
    this.deployer = new DeployerClass(this);
  }

  /**
   * Executes the deployment process.
   *
   * Steps:
   * 1. Establishes an SSH connection to the VPS.
   * 2. Creates a new release directory based on the current timestamp.
   * 3. Uploads the repository to the release directory.
   * 4. Updates the `current` symlink to point to the new release.
   * 5. Cleans up old releases to save space.
   *
   * @returns {Promise<void>} Resolves when the deployment process completes.
   * @throws {Error} Throws errors if any step in the deployment fails.
   */
  async deploy() {
    try {
      // Esablishing an SSH connection
      this.conn = await establishConnection(this.connectionConfig);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:\-T]/g, "")
        .split(".")[0];
      this.revisionTime = timestamp;
      const releaseDir = `${this.projectFolder}/releases/${timestamp}`;
      const currentSymlink = `${this.projectFolder}/current`;
      const connectionMessage = `${this.connectionConfig.username}@${this.connectionConfig.host}`;

      // Test if SSH agent forwarding is working
      try {
        await testAgentForwarding(this.conn, this.connectionConfig);
      } catch (agentError) {
        errorHandler(
          `Error in testing agent forwarding: ${agentError.message}`
        );
        throw error;
      }

      // git:wrapper

      // git:check

      // deploy:check:directories
      try {
        await checkDirectories(
          this.conn,
          this.projectFolder,
          1,
          connectionMessage
        );
      } catch (error) {
        errorHandler(`Error while testing directories: ${error.message}`);
        throw error;
      }

      // deploy:check:linkedDirs
      try {
        await checkLinkedDirs(
          this.conn,
          this.projectFolder,
          1,
          connectionMessage
        );
      } catch (error) {
        errorHandler(
          `Error while checking linked directories: ${error.message}`
        );
        throw error;
      }

      // deploy:check:makeLinkedDirs
      try {
        await makeLinkedDirs(
          this.conn,
          this.projectFolder,
          1,
          connectionMessage
        );
      } catch (error) {
        errorHandler(
          `Error while creating linked directories: ${error.message}`
        );
        throw error;
      }

      // deploy:create:releaseDir
      try {
        await createReleaseDir(this.conn, releaseDir, 1, connectionMessage);
      } catch (error) {
        errorHandler(`Error while setting revision: ${error.message}`);
        throw error;
      }

      // Delegating deployment process to the selected deployer
      try {
        await this.deployer.deploy(1, connectionMessage);
      } catch (deployerError) {
        errorHandler(`Error while deploying : ${deployerError.message}`);
        throw error;
      }

      // deploy:set_current_revision
      try {
        this.revision = await setCurrentRevision(
          this.conn,
          releaseDir,
          connectionMessage
        );
      } catch (error) {
        errorHandler(`Error while setting revision: ${error.message}`);
        throw error;
      }

      // deploy:set_current_revision_time
      try {
        await setCurrentRevisionTime(
          this.conn,
          this.revisionTime,
          releaseDir,
          1,
          connectionMessage
        );
      } catch (error) {
        errorHandler(`Error while setting revision time: ${error.message}`);
        throw error;
      }

      // deploy:symlink:linked_files
      try {
        await symlinkLinkedFiles(
          this.conn,
          this.projectFolder,
          releaseDir,
          connectionMessage
        );
      } catch (error) {
        actionLogger.error(`Error linking files: ${error.message}`, chalk.red);
      }

      // deploy:symlink:linked_dirs
      try {
        await symlinkLinkedDirs(
          this.conn,
          this.projectFolder,
          releaseDir,
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
        await npmConfig(
          this.conn,
          this.nodeVersion,
          releaseDir,
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
        await npmInstall(
          this.conn,
          this.nodeVersion,
          releaseDir,
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
        await assetsPrecompile(this.conn, releaseDir, 1, connectionMessage);
      } catch (error) {
        actionLogger.error(
          `Error precompile tasks: ${error.message}`,
          chalk.red
        );
      }

      // npm:backup_package_json
      try {
        await backupPackageJson(this.conn, releaseDir, 1, connectionMessage);
      } catch (error) {
        actionLogger.error(
          `Error backing up Package.json: ${error.message}`,
          chalk.red
        );
      }

      // deploy:migrate
      try {
        await migrate(this.conn, releaseDir, 1, connectionMessage);
      } catch (error) {
        actionLogger.error(`Error during migrate: ${error.message}`, chalk.red);
      }

      // deploy:migrating
      try {
        await migrating(this.conn, releaseDir, 1, connectionMessage);
      } catch (error) {
        actionLogger.error(
          `Error running migrations: ${error.message}`,
          chalk.red
        );
      }

      // deploy:symlink:release
      try {
        await symlinkRelease(
          this.conn,
          releaseDir,
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
        await restartApplication(
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
        await cleanupOldReleases(
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
        await logRevision(this.conn, releaseDir, 1, connectionMessage);
      } catch (error) {
        actionLogger.error(
          `Error logging revision: ${error.message}`,
          chalk.red
        );
      }

      // deploy:after:symlink_public_resources
      try {
        await symlinkPublicResources(this.conn, releaseDir, connectionMessage);
      } catch (error) {
        actionLogger.error(
          `Error during cleanup tasks: ${error.message}`,
          chalk.red
        );
      }
    } catch (error) {
      errorhandler(`Deployment failed:${error.message}`);
    } finally {
      // Ensure the SSH connection is closed regardless of success or failure
      if (this.conn) {
        this.conn.end();
        actionLogger.info("SSH connection closed.", chalk.blue);
      }
    }
  }

  /**
   * Gets information about all current releases.
   *
   * Steps:
   * 1. Establishes an SSH connection to the VPS.
   * 2. Collects details about all current releases
   * 3. Displays release information
   *
   * @returns {Promise<void>} Resolves when the deployment process completes.
   * @throws {Error} Throws errors if any step in the deployment fails.
   */
  async getReleaseIds() {
    const conn = new Client();

    sectionLogger("ssh:connection", chalk.blue);
    actionLogger.info(
      `01 ssh ${this.connectionConfig.username}@${this.connectionConfig.host}`,
      chalk.yellow
    );

    return new Promise((resolve, reject) => {
      conn
        .on("ready", async () => {
          actionLogger.success(
            `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );
          try {
            // deploy:check:directories
            sectionLogger("deploy:get_releases", chalk.blue);

            const getReleasesCommand = `ls -d ${this.projectFolder}/releases/*/`;
            actionLogger.info(`01 ${getReleasesCommand}`, chalk.yellow);

            const response = await this.asyncWrapper(conn, getReleasesCommand);
            actionLogger.success(
              `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );
            const directories = response
              .split("\n")
              .filter((line) => line.trim() !== "")
              .map((line) => line.trim().replace("/", ""));
            let releases = [];

            directories.forEach((path, index) => {
              releases.push(path.slice(path.lastIndexOf("/") - 14, -1));
            });

            actionLogger.info(`02 release parsing`, chalk.yellow);
            actionLogger.info(`Releases: ${releases.join(", ")}`);
            actionLogger.success(
              `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );

            resolve(releases); // Resolve with the list of releases
          } catch (error) {
            actionLogger.error(
              `Error getting the releases: ${error.message}`,
              chalk.red
            );
            reject(error); // Reject the promise if there's an error
          } finally {
            conn.end(); // Ensure connection is closed
          }
        })
        .on("error", (err) => {
          console.error("SSH Connection Error:", err);
          reject(err); // Reject the promise on connection error
        })
        .connect(this.connectionConfig);
    });
  }

  /**
   * Rolls deployment back one step.
   *
   * Steps:
   * 1. Establishes an SSH connection to the VPS.
   * 2. Identifies the current release
   * 3. Links the previous release
   *
   * @returns {Promise<void>} Resolves when the deployment process completes.
   * @throws {Error} Throws errors if any step in the deployment fails.
   */
  async rollback() {
    const conn = new Client();

    sectionLogger("ssh:connection", chalk.blue);
    actionLogger.info(
      `01 ssh ${this.connectionConfig.username}@${this.connectionConfig.host}`,
      chalk.yellow
    );

    conn
      .on("ready", async () => {
        actionLogger.success(
          `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
          chalk.green
        );
        try {
          // deploy:rollback
          sectionLogger("deploy:rollback", chalk.blue);

          // const getReleasesCommand = `mkdir -p ${this.projectFolder}/shared ${this.projectFolder}/releases`;
          // logger.info(`01 ${getReleasesCommand}`, chalk.yellow);

          // await this.asyncWrapper(conn, getReleasesCommand);

          // logger.success(
          //   `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
          //   chalk.green
          // );
        } catch (error) {
          actionLogger.error(
            `Error rolling back:" ${error.message}`,
            chalk.red
          );
        } finally {
          conn.end(); // Ensure connection is closed
        }
      })
      .on("error", (err) => {
        console.error("SSH Connection Error:", err);
      })
      .connect(this.connectionConfig);
  }

  /**
   * Switches to a specific release.
   *
   * Steps:
   * 1. Establishes an SSH connection to the VPS.
   * 2. Identifies the current release
   * 3. Links the release provided as an argument
   *
   * @param {number} releaseId - The ID of a release to identify
   *
   * @returns {Promise<void>} Resolves when the deployment process completes.
   * @throws {Error} Throws errors if any step in the deployment fails.
   */
  async switchRelease(release) {
    const conn = new Client();

    sectionLogger("ssh:connection", chalk.blue);
    actionLogger.info(
      `01 ssh ${this.connectionConfig.username}@${this.connectionConfig.host}`,
      chalk.yellow
    );

    conn
      .on("ready", async () => {
        actionLogger.success(
          `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
          chalk.green
        );
        try {
          // deploy:switch_release
          sectionLogger("deploy:switch_release", chalk.blue);

          // const getReleasesCommand = `mkdir -p ${this.projectFolder}/shared ${this.projectFolder}/releases`;
          // logger.info(`01 ${getReleasesCommand}`, chalk.yellow);

          // await this.asyncWrapper(conn, getReleasesCommand);

          // logger.success(
          //   `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
          //   chalk.green
          // );
        } catch (error) {
          actionLogger.error(
            `Error switching the release" ${error.message}`,
            chalk.red
          );
        } finally {
          conn.end(); // Ensure connection is closed
        }
      })
      .on("error", (err) => {
        console.error("SSH Connection Error:", err);
      })
      .connect(this.connectionConfig);
  }
}

// Export the deployer class for use elsewhere
export default Shokan;
