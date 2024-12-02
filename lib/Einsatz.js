// lib/Einsatz.js

// Global imports
import chalk from "chalk";
import { Client } from "ssh2";

// Local imports
import { sectionLogger, actionLogger } from "./utils/logger.js";
import { establishConnection } from "./utils/sshConnection.js";
import { testAgentForwarding } from "./utils/testAgentForwarding.js";
import { handleError } from "./utils/handleError.js";
import { asyncWrapper } from "./utils/asyncWrapper.js";

import { CopyDeployer } from "./deployer/CopyDeployer.js";
import { GitDeployer } from "./deployer/GitDeployer.js";
import { RemoteCacheDeployer } from "./deployer/RemoteCacheDeployer.js";
import { RemoteSyncDeployer } from "./deployer/RemoteSyncDeployer.js";

import SSHError from "./errors/SSHError.js";

/**
 * Deployer selection through object mapping.
 */
const deployerMapping = {
  git: GitDeployer,
  copy: CopyDeployer,
  remoteCache: RemoteCacheDeployer,
  remoteSync: RemoteSyncDeployer,
};

/**
 * Einsatz is a utility class for deploying projects to a remote VPS using an approach
 * inspired by Capistrano. It provides functionality for uploading repositories, managing releases,
 * and maintaining symlinks for deployments.
 */
class Einsatz {
  /**
   * Creates an instance of Einsatz.
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
    this.repoDirectory = `${this.projectFolder}/repo`; // Repo directory location on the VPS
    this.revisionLogFile = `${this.projectFolder}/revisions.log`; // Path to revisions.log file
    this.revision = "";
    this.revisionTime = "";
    this.releases = 5; // Amount of releases to be kept on the VPS
  }

  /**
   * Executes the deployment process.
   *
   * Steps:
   * 1. Establishes an SSH connection to the VPS.
   * 2. Hands deployment process over to the selected Deployer class
   *
   * @returns {Promise<void>} Resolves when the deployment process completes.
   * @throws {Error} Throws errors if any step in the deployment fails.
   */
  async deploy() {
    try {
      // Establish SSH connection
      this.conn = await establishConnection(this.connectionConfig);

      // Create revisionTime and assign to the Einsatz revisionTime property
      const timestamp = new Date()
        .toISOString()
        .replace(/[:\-T]/g, "")
        .split(".")[0];
      this.revisionTime = timestamp;

      // Test if SSH agent forwarding is working
      await testAgentForwarding(this.conn, this.connectionConfig);

      // Instantiate the deployer after connection is ready

      const DeployerClass = deployerMapping[this.deployVia];
      if (!DeployerClass) {
        // handles error locally and throws it to the catch
        throw new Error(`Unsupported deploy method: ${this.deployVia}`);
      }
      /**
       * throw error and let the previous class handle it
       * throw the error close to the error point and catch it close to the user
       * you shouldn't catch the error where it happends, but where the code is consumed ... closer to the user.
       **/

      // Pass the connection as well as the Einsatz instance object to the deployer
      this.deployer = new DeployerClass(this, this.conn);

      // Delegate deployment process to the selected deployer
      await this.deployer.deploy();
    } catch (error) {
      handleError("Deployment failed: ", error);
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
            // deploy:check:get_releases
            sectionLogger("deploy:get_releases", chalk.blue);

            // list all subdirectories inide the releases directory, but not their content
            const getReleasesCommand = `ls -d ${this.projectFolder}/releases/*/`;
            actionLogger.info(`01 ${getReleasesCommand}`, chalk.yellow);

            const response = await asyncWrapper(conn, getReleasesCommand);
            actionLogger.success(
              `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );
            // Create s directories array by splitting response on newline
            // replace '/' with an empty string
            const directories = response
              .split("\n")
              .filter((line) => line.trim() !== "")
              .map((line) => line.trim().replace("/", ""));
            let releases = [];

            // Slice last 14 digits of the path string and push it into the releases array
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
   * 2. Identifies the current release starting form the current symlink
   * 3. Links the previous release in the release order
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

          try {
            // get current release
            const currentPath = `${this.projectFolder}/current`;
            const currentReleasePath = fs.realpathSync(currentPath);

            // list all subdirectories inside the releases directory, but not their content
            const getReleasesCommand = `ls -d ${this.projectFolder}/releases/*/`;
            actionLogger.info(`01 ${getReleasesCommand}`, chalk.yellow);

            const response = await asyncWrapper(conn, getReleasesCommand);
            actionLogger.success(
              `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );
            // Create s directories array by splitting response on newline
            // replace '/' with an empty string
            const directories = response
              .split("\n")
              .filter((line) => line.trim() !== "")
              .map((line) => line.trim().replace("/", ""));
            let releases = [];

            // Slice last 14 digits of the path string and push it into the releases array
            directories.forEach((path, index) => {
              releases.push(path.slice(path.lastIndexOf("/") - 14, -1));
            });

            const currentRelease = currentReleasePath
              .split("/")
              .filter(Boolean)
              .pop();
            const currentIndex = releases.indexOf(currentRelease);
            if (currentIndex === 0) {
              actionLogger.log(
                "Current release is the oldest release available. Nothing to rollback to."
              );
              return; // Exit the method
            } else if (currentIndex > 0) {
              previousRelease = releases[currentIndex - 1];
            } else {
              actionLogger.log("Current release not found in the list.");
              return; // Exit the method
            }

            actionLogger.info(
              `01 current release: ${currentRelease}, previous release: ${previousRelease}`
            );
          } catch (error) {
            actionLogger.error(
              `Error getting releases:" ${error.message}`,
              chalk.red
            );
          } finally {
            actionLogger.success(
              `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`
            );
          }

          try {
            const target = `${this.projectFolder}/releases/${previousRelease}`;
            const link = `${this.projectFolder}/current`;
            const rollbackReleasesCommand = `ln -s ${target} ${link}`;
            actionLogger.info(`02 ${rollbackReleasesCommand}`, chalk.yellow);
            await asyncWrapper(conn, rollbackReleasesCommand);
          } catch (error) {
            actionLogger.error(
              `Error symlinking previous release:" ${error.message}`,
              chalk.red
            );
          } finally {
            actionLogger.success(
              `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`
            );
          }

          try {
            sectionLogger("deploy:log_revision", chalk.blue);

            const logRevisionCommand = `echo "Rolled back release ${currentRelease} to release ${previousRelease} by ${this.connectionConfig.username}" >> ${this.projectFolder}/revisions.log`;
            actionLogger.info(`01 ${logRevisionCommand}`, chalk.yellow);
            await asyncWrapper(conn, logRevisionCommand);
          } catch (error) {
            actionLogger.error(
              `Error writing revisions log:" ${error.message}`,
              chalk.red
            );
          } finally {
            actionLogger.success(
              `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );
          }
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

          try {
            // get current release
            const currentPath = `${this.projectFolder}/current`;
            const currentReleasePath = fs.realpathSync(currentPath);
            const currentRelease = currentReleasePath
              .split("/")
              .filter(Boolean)
              .pop();

            actionLogger.info(
              `01 current release: ${currentRelease}, target release: ${release}`
            );
          } catch (error) {
            actionLogger.error(
              `Error getting current release:" ${error.message}`,
              chalk.red
            );
          } finally {
            actionLogger.success(
              `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`
            );
          }

          try {
            const target = `${this.projectFolder}/releases/${release}`;
            const link = `${this.projectFolder}/current`;
            const switchReleaseCommand = `ln -s ${target} ${link}`;
            actionLogger.info(`02 ${switchReleaseCommand}`, chalk.yellow);
            await asyncWrapper(conn, switchReleaseCommand);
          } catch (error) {
            actionLogger.error(
              `Error symlinking requested release:" ${error.message}`,
              chalk.red
            );
          } finally {
            actionLogger.success(
              `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`
            );
          }

          try {
            sectionLogger("deploy:log_revision", chalk.blue);

            const logRevisionCommand = `echo "Switched from release ${currentRelease} to release ${release} by ${this.connectionConfig.username}" >> ${this.projectFolder}/revisions.log`;
            actionLogger.info(`01 ${logRevisionCommand}`, chalk.yellow);
            await asyncWrapper(conn, logRevisionCommand);
          } catch (error) {
            actionLogger.error(
              `Error writing revisions log:" ${error.message}`,
              chalk.red
            );
          } finally {
            actionLogger.success(
              `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );
          }
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
export default Einsatz;
