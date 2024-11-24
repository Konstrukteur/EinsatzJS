import chalk from "chalk";
import { Client } from "ssh2";

import { sectionLogger, actionLogger } from "./utils/logger.js";
import { establishConnection } from "./utils/sshConnection.js";
import { testAgentForwarding } from "./utils/testAgentForwarding.js";
import { handleError } from "./utils/handleError.js";
import { asyncWrapper } from "./utils/asyncWrapper.js";

import { CopyDeployer } from "./deployer/CopyDeployer.js";
import { GitDeployer } from "./deployer/GitDeployer.js";
import { RemoteCacheDeployer } from "./deployer/RemoteCacheDeployer.js";
import { RemoteSyncDeployer } from "./deployer/RemoteSyncDeployer.js";

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
      // Establish SSH connection
      this.conn = await establishConnection(this.connectionConfig);

      const timestamp = new Date()
        .toISOString()
        .replace(/[:\-T]/g, "")
        .split(".")[0];
      this.revisionTime = timestamp;

      // Instantiate the deployer after connection is ready
      const DeployerClass = deployerMapping[this.deployVia];
      if (!DeployerClass) {
        throw new Error(`Unsupported deploy method: ${this.deployVia}`);
      }

      // Pass the connection to the deployer
      this.deployer = new DeployerClass(this, this.conn);

      // Test if SSH agent forwarding is working
      await testAgentForwarding(this.conn, this.connectionConfig);

      // Delegate deployment process to the selected deployer
      await this.deployer.deploy();
    } catch (error) {
      console.log(`Deployment failed:${error.message}`);
    } finally {
      // Ensure the SSH connection is closed regardless of success or failure
      if (this.conn) {
        this.conn.end();
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

            const response = await asyncWrapper(conn, getReleasesCommand);
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
