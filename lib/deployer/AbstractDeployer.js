// AbstractDeployer.js

import chalk from "chalk";

import { sectionLogger, actionLogger } from "../utils/logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { handleError } from "../utils/handleError.js";

export class AbstractDeployer {
  constructor(shokanInstance) {
    if (new.target === AbstractDeployer) {
      throw new Error("Cannot instantiate AbstractDeployer directly");
    }
    this.conn = shokanInstance.conn;
    this.repoDetails = shokanInstance.repoDetails;
    this.projectFolder = shokanInstance.projectFolder;
  }

  // 4. Error Handling Consistency
  // In some methods, error handling is inconsistent. For example, restartApplication directly logs the error and rethrows it, while others wrap errors in a new Error. Ensure consistency:
  // throw new Error(`Execution of step ${stepNumber} failed: ${error.message}`);

  // Abstract method for deployment (must be implemented in child classes)
  deploy() {
    throw new Error("Deploy method not implemented");
  }

  // Abstract method for rollback (must be implemented in child classes)
  rollback() {
    throw new Error("Rollback method not implemented");
  }

  async assetsPrecompile(conn, stepNumber, connectionMessage) {
    sectionLogger("npm:assets:precompile", chalk.blue);
    try {
      actionLogger.info(
        `No asset compilation required, skipping precompilation`,
        chalk.white
      );
    } catch (error) {
      // Log and rethrow the error for handling in the calling function
      actionLogger.error(`Command failed: ${error.message}`, chalk.red);
      throw new Error(
        `Execution of step ${stepNumber} failed: ${error.message}`
      );
    }
  }

  async backupPackageJson(conn, stepNumber, connectionMessage) {
    sectionLogger("npm:backup_package_json", chalk.blue);
    try {
      actionLogger.info(
        `Backing up package.json not required, skipping backing up`,
        chalk.white
      );
    } catch (error) {
      // Log and rethrow the error for handling in the calling function
      actionLogger.error(`Command failed: ${error.message}`, chalk.red);
      throw new Error(
        `Execution of step ${stepNumber} failed: ${error.message}`
      );
    }
  }

  async checkDirectories(conn, projectFolder, stepNumber, connectionMessage) {
    sectionLogger("deploy:check:directories", chalk.blue);
    const command = `mkdir -p ${projectFolder}/shared ${projectFolder}/releases`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(conn, command, stepNumber, connectionMessage);
  }

  async checkLinkedDirs(conn, projectFolder, stepNumber, connectionMessage) {
    sectionLogger("deploy:check:linked_dirs", chalk.blue);
    const command = `mkdir -p ${projectFolder}/shared/public`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(conn, command, stepNumber, connectionMessage);
  }

  /**
   * Cleans up old releases on the VPS, keeping only the specified number of most recent releases.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} projectFolder - The base project folder path on the VPS.
   * @param {number} keepCount - The number of most recent releases to keep.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async cleanupOldReleases(
    conn,
    projectFolder,
    keepCount,
    stepNumber,
    connectionMessage
  ) {
    const releasesPath = `${projectFolder}/releases`;

    sectionLogger("deploy:cleanup", chalk.blue);

    const cleanUpCommand = `cd ${releasesPath} && ls -1t | tail -n +${
      keepCount + 1
    } | xargs -I {} rm -rf {}`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(
      conn,
      cleanUpCommand,
      stepNumber,
      connectionMessage
    );
  }

  async createReleaseDir(conn, releaseDir, stepNumber, connectionMessage) {
    sectionLogger("deploy:create_release_dir", chalk.blue);

    const command = `mkdir -p ${releaseDir}`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(conn, command, stepNumber, connectionMessage);
  }

  async logRevision(
    conn,
    branch,
    revision,
    revisionTime,
    username,
    projectFolder,
    stepNumber,
    connectionMessage
  ) {
    sectionLogger("deploy:log_revision", chalk.blue);

    const command = `echo "Branch ${branch} (at ${revision}) deployed as release ${revisionTime} by ${username}" >> ${projectFolder}/revisions.log`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(conn, command, stepNumber, connectionMessage);
  }

  async makeLinkedDirs(conn, projectFolder, stepNumber, connectionMessage) {
    sectionLogger("deploy:check:make_linked_dirs", chalk.blue);

    const command = `mkdir -p ${projectFolder}/shared/cache ${projectFolder}/shared/logs ${projectFolder}/shared/secrets`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(conn, command, stepNumber, connectionMessage);
  }

  async migrate(conn, stepNumber, connectionMessage) {
    sectionLogger("deploy:migrate", chalk.blue);
    try {
      actionLogger.info(
        `[deploy:migrate] Run 'node db/migrate.js'`,
        chalk.white
      );
    } catch (error) {
      // Log and rethrow the error for handling in the calling function
      actionLogger.error(`Command failed: ${error.message}`, chalk.red);
      throw new Error(
        `Execution of step ${stepNumber} failed: ${error.message}`
      );
    }
  }

  async migrating(conn, stepNumber, connectionMessage) {
    sectionLogger("deploy:migrating", chalk.blue);
    try {
      actionLogger.info(
        `Migrating not required, skipping migrations`,
        chalk.white
      );
    } catch (error) {
      // Log and rethrow the error for handling in the calling function
      actionLogger.error(`Command failed: ${error.message}`, chalk.red);
      throw new Error(
        `Execution of step ${stepNumber} failed: ${error.message}`
      );
    }
  }

  async npmConfig(
    conn,
    nodeVersion,
    releaseDir,
    stepNumber,
    connectionMessage
  ) {
    sectionLogger("npm:config", chalk.blue);
    try {
      actionLogger.info(
        `${String(stepNumber).padStart(2, "0")} nvm use ${nodeVersion}`,
        chalk.yellow
      );
      actionLogger.success(
        `${String(stepNumber).padStart(2, "0")} ${connectionMessage}`,
        chalk.green
      );
    } catch (error) {
      // Log and rethrow the error for handling in the calling function
      actionLogger.error(`Command failed: ${error.message}`, chalk.red);
      throw new Error(
        `Execution of step ${stepNumber} failed: ${error.message}`
      );
    }
  }

  /**
   * Runs npm install in the release directory on the remote server.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} nodeVersion - The required version of node.
   * @param {string} releaseDir - The path to the release directory
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async npmInstall(
    conn,
    nodeVersion,
    releaseDir,
    stepNumber,
    connectionMessage
  ) {
    sectionLogger("npm:install", chalk.blue);

    // Construct the npm install command with the release directory
    // const installCommand = `npm install --prefix ${releaseDir}`;
    let installCommand;

    if (nodeVersion) {
      installCommand = `zsh -c '. /home/stephan/.nvm/nvm.sh && nvm use v${nodeVersion} && npm install --prefix ${releaseDir}'`;
    } else {
      installCommand = `npm install --prefix ${releaseDir}`;
    }

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(
      conn,
      installCommand,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Restarts the application. Requires the systemctl process to follow the naming convention application.service.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} application - A string containing the applicationname.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async restartApplication(conn, application, stepNumber, connectionMessage) {
    sectionLogger("systemctl:restart", chalk.blue);
    try {
      const restartCommand = `sudo systemctl restart ${application}.service`;

      // Use _runDeploymentStep to execute the command and log messages
      await _runDeploymentStep(
        conn,
        restartCommand,
        stepNumber,
        connectionMessage
      );
    } catch (error) {
      // Log any errors during npm install
      actionLogger.error(
        `Error restarting the service: ${error.message}`,
        chalk.red
      );
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  async setCurrentRevision(conn, releaseDir, stepNumber, connectionMessage) {
    sectionLogger("deploy:set_current_revision", chalk.blue);
    const getCurrentRevisionCommand = `(cd ${releaseDir} && git rev-parse HEAD)`;
    actionLogger.info(`01 ${getCurrentRevisionCommand}`, chalk.yellow);

    console.log(connectionMessage);
    const revision = await asyncWrapper(conn, getCurrentRevisionCommand);
    actionLogger.success(`01 ${connectionMessage}`, chalk.green);

    const setCurrentRevisionCommand = `echo "${revision}" > ${releaseDir}/REVISION`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(
      conn,
      setCurrentRevisionCommand,
      stepNumber,
      connectionMessage
    );

    // Return the revision
    return revision; // Return the revision value
  }

  async setCurrentRevisionTime(
    conn,
    revisionTime,
    releaseDir,
    stepNumber,
    connectionMessage
  ) {
    sectionLogger("deploy:set_current_revision_time", chalk.blue);

    const command = `echo "${revisionTime}" > ${releaseDir}/REVISION_TIME`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(conn, command, stepNumber, connectionMessage);
  }

  /**
   *  Creates symlinks for all linked dirs.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} projectFolder - The project directory
   * @param {string} releaseDir - The release directory
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async symlinkLinkedDirs(conn, projectFolder, releaseDir, connectionMessage) {
    const cachePath = `${projectFolder}/shared/cache`;
    const logsPath = `${projectFolder}/shared/logs`;
    const uploadsPath = `${projectFolder}/shared/media/uploads`;

    sectionLogger("deploy:symlink:linked_files", chalk.blue);

    // Define the paths for symlinks
    const symlinks = [
      { target: cachePath, link: `${releaseDir}/cache` },
      { target: logsPath, link: `${releaseDir}/logs` },
      { target: uploadsPath, link: `${releaseDir}/public/uploads` },
    ];

    try {
      // Execute each symlink command sequentially
      for (const [i, { target, link }] of symlinks.entries()) {
        const symlinkCommand = `ln -s ${target} ${link}`;
        actionLogger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
        // await execCommand(symlinkCommand);
        await asyncWrapper(conn, symlinkCommand);
        actionLogger.success(`0${i + 1} ${connectionMessage}`, chalk.green);
      }
    } catch (error) {
      actionLogger.error(
        `Error creating symlinks: ${error.message}`,
        chalk.red
      );
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  /**
   * Creates symlinks for all linked files.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} projectFolder - The project directory
   * @param {string} releaseDir - The release directory
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */

  async symlinkLinkedFiles(conn, projectFolder, releaseDir, connectionMessage) {
    const secretsPath = `${projectFolder}/shared/secrets/.env.production`;

    sectionLogger("deploy:symlink:linked_files", chalk.blue);

    // Define the paths for symlinks
    const symlinks = [
      { target: secretsPath, link: `${releaseDir}/.env.production` },
    ];

    try {
      // Execute each symlink command sequentially
      for (const [i, { target, link }] of symlinks.entries()) {
        const symlinkCommand = `ln -s ${target} ${link}`;
        actionLogger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
        // await execCommand(symlinkCommand);
        await asyncWrapper(conn, symlinkCommand);
        actionLogger.success(`0${i + 1} ${connectionMessage}`, chalk.green);
      }
    } catch (error) {
      actionLogger.error(
        `Error creating symlinks: ${error.message}`,
        chalk.red
      );
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  /**
   * Creates symlinks for all resources in shared/public to the release/public directory.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} projectFolder - The project directory
   * @param {string} releaseDir - The release directory
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async symlinkPublicResources(
    conn,
    projectFolder,
    releaseDir,
    connectionMessage
  ) {
    const sharedPublicDir = `${projectFolder}/shared/public`;
    const releasePublicDir = `${releaseDir}/public`;

    sectionLogger("deploy:after:symlink_public_resources", chalk.blue);

    try {
      // List all files and directories in the shared/public directory
      const listCommand = `find ${sharedPublicDir} -mindepth 1 -maxdepth 1`;
      actionLogger.info(`Listing resources in ${sharedPublicDir}`, chalk.white);

      // Execute the list command and capture output
      const result = await asyncWrapper(conn, listCommand);
      const resources = result.trim().split("\n");

      // Loop through resources and create symlinks in the release/public directory
      for (const [i, resource] of resources.entries()) {
        const resourceName = resource.split("/").pop(); // Get the file/directory name
        const linkPath = `${releasePublicDir}/${resourceName}`;
        const symlinkCommand = `ln -s ${resource} ${linkPath}`;

        actionLogger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
        await asyncWrapper(conn, symlinkCommand);
        actionLogger.success(`0${i + 1} ${connectionMessage}`, chalk.green);
      }
    } catch (error) {
      actionLogger.error(
        `Error creating symlinks: ${error.message}`,
        chalk.red
      );
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  async symlinkRelease(
    conn,
    releaseDir,
    currentSymlink,
    stepNumber,
    connectionMessage
  ) {
    sectionLogger("deploy:symlink:release", chalk.blue);

    const command = `ln -sfn ${releaseDir} ${currentSymlink}`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(conn, command, stepNumber, connectionMessage);
  }

  static async _runDeploymentStep(conn, command, stepNumber, message) {
    try {
      actionLogger.info(
        `${String(stepNumber).padStart(2, "0")} ${command}`,
        chalk.yellow
      );
      await asyncWrapper(conn, command);
      actionLogger.success(
        `${String(stepNumber).padStart(2, "0")} ${message}`,
        chalk.green
      );
    } catch (error) {
      actionLogger.error(`Command failed: ${error.message}`, chalk.red);
      throw new Error(
        `Execution of step ${stepNumber} failed: ${error.message}`
      );
    }
  }
}
