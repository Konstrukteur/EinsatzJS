// lib/deployer/AbstractDeployer.js

// Global imports
import chalk from "chalk";

// Local imports
import DeploymentError from "../errors/DeploymentError.js";
import { sectionLogger, actionLogger } from "../utils/logger.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

export class AbstractDeployer {
  constructor(einsatzInstance) {
    if (new.target === AbstractDeployer) {
      throw new Error("Cannot instantiate AbstractDeployer directly");
    }
    this.conn = einsatzInstance.conn;
    this.repoDetails = einsatzInstance.repoDetails;
    this.projectFolder = einsatzInstance.projectFolder;
  }

  // Abstract method for deployment (must be implemented in child classes)
  deploy() {
    throw new Error("Deploy method not implemented");
  }

  // Abstract method for rollback (must be implemented in child classes)
  rollback() {
    throw new Error("Rollback method not implemented");
  }

  /**
   * Optional step that precompiles code.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} projectFolder - The base project folder path on the VPS.
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
   */
  async assetsPrecompile(conn, projectFolder, stepNumber, connectionMessage) {
    sectionLogger("npm:assets:precompile", chalk.blue);
    try {
      actionLogger.info(
        `No asset compilation required, skipping precompilation`,
        chalk.white
      );
    } catch (error) {
      throw new DeploymentError(
        error.message,
        "npm:assets:precompile",
        stepNumber
      );
    }
  }

  /**
   * Optional step that backs up the package.json file.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} projectFolder - The base project folder path on the VPS.
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
   */
  async backupPackageJson(conn, projectFolder, stepNumber, connectionMessage) {
    sectionLogger("npm:backup_package_json", chalk.blue);
    try {
      actionLogger.info(
        `Backing up package.json not required, skipping backing up`,
        chalk.white
      );
    } catch (error) {
      throw new DeploymentError(
        error.message,
        "npm:backup_package_json",
        stepNumber
      );
    }
  }

  /**
   * Ensures that the main directories needed for deployment exist on the server (releases, shared).
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} projectFolder - The base project folder path on the VPS.
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async checkDirectories(conn, projectFolder, stepNumber, connectionMessage) {
    const task = "deploy:check:directories";
    const command = `mkdir -p ${projectFolder}/shared ${projectFolder}/releases`;

    await _runDeploymentStep(
      conn,
      command,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Verifies that the directories specified in linked_dirs are correctly set up in the shared directory (public).
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} projectFolder - The base project folder path on the VPS.
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async checkLinkedDirs(conn, projectFolder, stepNumber, connectionMessage) {
    const task = "deploy:check:linked_dirs";
    const command = `mkdir -p ${projectFolder}/shared/public`;

    await _runDeploymentStep(
      conn,
      command,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Cleans up old releases on the VPS, keeping only the specified number of most recent releases.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} projectFolder - The base project folder path on the VPS.
   * @param {number} keepCount - The number of most recent releases to keep.
   * @param {number} stepNumber - The number of the section deployment step.
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

    const task = "deploy:cleanup";

    const cleanUpCommand = `cd ${releasesPath} && ls -1t | tail -n +${
      keepCount + 1
    } | xargs -I {} rm -rf {}`;

    await _runDeploymentStep(
      conn,
      cleanUpCommand,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Creates the release directory.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} releaseDir - The path to the release directory to be created
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async createReleaseDir(conn, releaseDir, stepNumber, connectionMessage) {
    const task = "deploy:create_release_dir";

    const command = `mkdir -p ${releaseDir}`;

    await _runDeploymentStep(
      conn,
      command,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Logs the revision to revisions.log.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} branch - The branch to be deployed
   * @param {string} revision - The SHA-1 hash of the repository branche's head
   * @param {string} revisionTime - The revision time
   * @param {string} username - The username of the deployer
   * @param {string} projectFolder - The path to the project directory
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
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
    const task = "deploy:log_revision";

    const command = `echo "Branch ${branch} (at ${revision}) deployed as release ${revisionTime} by ${username}" >> ${projectFolder}/revisions.log`;

    await _runDeploymentStep(
      conn,
      command,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Runs make linked dirs (cache, logs, secrets).
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} projectFolder - The path to the project directory
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async makeLinkedDirs(conn, projectFolder, stepNumber, connectionMessage) {
    const task = "deploy:check:make_linked_dirs";

    const command = `mkdir -p ${projectFolder}/shared/cache ${projectFolder}/shared/logs ${projectFolder}/shared/secrets`;

    await _runDeploymentStep(
      conn,
      command,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Runs all pending migrations on the server.
   *
   * @param {Client} conn - An established SSH connection
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
   */
  async migrate(conn, stepNumber, connectionMessage) {
    const task = "deploy:migrate";
    try {
      actionLogger.info(
        `[deploy:migrate] Run 'node db/migrate.js'`,
        chalk.white
      );
    } catch (error) {
      throw new DeploymentError(error.message, "deploy:migrate", stepNumber);
    }
  }

  /**
   * Displays the status of the mmigration process.
   *
   * @param {Client} conn - An established SSH connection
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
   */
  async migrating(conn, stepNumber, connectionMessage) {
    const task = "deploy:migrating";
    try {
      actionLogger.info(
        `Migrating not required, skipping migrations`,
        chalk.white
      );
    } catch (error) {
      throw new DeploymentError(error.message, "deploy:migrating", stepNumber);
    }
  }

  /**
   * Runs npm config in the release directory on the remote server.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} nodeVersion - The required version of node.
   * @param {string} releaseDir - The path to the release directory
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
   */
  async npmConfig(
    conn,
    nodeVersion,
    releaseDir,
    stepNumber,
    connectionMessage
  ) {
    const task = "npm:config";
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
      throw new DeploymentError(error.message, "npm:config", stepNumber);
    }
  }

  /**
   * Runs npm install in the release directory on the remote server.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} nodeVersion - The required version of node.
   * @param {string} releaseDir - The path to the release directory
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async npmInstall(
    conn,
    nodeVersion,
    releaseDir,
    stepNumber,
    connectionMessage
  ) {
    const task = "npm:install";

    // Construct the npm install command with the release directory
    // const installCommand = `npm install --prefix ${releaseDir}`;
    let installCommand;

    if (nodeVersion) {
      installCommand = `zsh -c '. /home/stephan/.nvm/nvm.sh && nvm use v${nodeVersion} && npm install --prefix ${releaseDir}'`;
    } else {
      installCommand = `npm install --prefix ${releaseDir}`;
    }

    await _runDeploymentStep(
      conn,
      installCommand,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Restarts the application. Requires the systemctl process to follow the naming convention application.service.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} application - A string containing the applicationname.
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
   */
  async restartApplication(conn, application, stepNumber, connectionMessage) {
    const task = "systemctl:restart";
    try {
      const restartCommand = `sudo systemctl restart ${application}.service`;

      await _runDeploymentStep(
        conn,
        restartCommand,
        task,
        stepNumber,
        connectionMessage
      );
    } catch (error) {
      throw new DeploymentError(error.message, "systemctl:restart", stepNumber);
    }
  }

  /**
   * Sets current revision.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} releaseDir - The release directory
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @returns {string} Revision.
   */
  async setCurrentRevision(conn, releaseDir, stepNumber, connectionMessage) {
    const task = "deploy:set_current_revision";

    const getCurrentRevisionCommand = `(cd ${releaseDir} && git rev-parse HEAD)`;
    actionLogger.info(`01 ${getCurrentRevisionCommand}`, chalk.yellow);

    const revision = await asyncWrapper(conn, getCurrentRevisionCommand);
    actionLogger.success(`01 ${connectionMessage}`, chalk.green);

    const setCurrentRevisionCommand = `echo "${revision}" > ${releaseDir}/REVISION`;

    // Use _runDeploymentStep to execute the command and log messages
    await _runDeploymentStep(
      conn,
      setCurrentRevisionCommand,
      task,
      stepNumber,
      connectionMessage
    );

    // Return the revision
    return revision;
  }

  /**
   * Sets current revision time.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} revisionTime - The time of the revision
   * @param {string} releaseDir - The release directory
   * @param {number} stepNumber - The number of the section deployment step.
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async setCurrentRevisionTime(
    conn,
    revisionTime,
    releaseDir,
    stepNumber,
    connectionMessage
  ) {
    const task = "deploy:set_current_revision_time";

    const command = `echo "${revisionTime}" > ${releaseDir}/REVISION_TIME`;

    await _runDeploymentStep(
      conn,
      command,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   *  Creates symlinks for all linked dirs.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} projectFolder - The project directory
   * @param {string} releaseDir - The release directory
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
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
      throw new DeploymentError(
        error.message,
        "deploy:symlink:linked_files",
        1
      );
    }
  }

  /**
   * Creates symlinks for all linked files.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} projectFolder - The project directory
   * @param {string} releaseDir - The release directory
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
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
      throw new DeploymentError(
        error.message,
        "deploy:symlink:linked_files",
        1
      );
    }
  }

  /**
   * Creates symlinks for all resources in shared/public to the release/public directory.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} projectFolder - The project directory
   * @param {string} releaseDir - The release directory
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws custom DeploymentError.
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
      throw new DeploymentError(
        error.message,
        "deploy:after:symlink_public_resources",
        1
      );
    }
  }

  /**
   * Creates the symlink for the current release from current to releases/release.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} releaseDir - The release directory
   * @param {string} currentSymlink - The place for the current symlink
   * @param {string} connectionMessage - A string containing the ssh connection details user@ip.
   */
  async symlinkRelease(
    conn,
    releaseDir,
    currentSymlink,
    stepNumber,
    connectionMessage
  ) {
    const task = "deploy:symlink:release";

    const command = `ln -sfn ${releaseDir} ${currentSymlink}`;

    await _runDeploymentStep(
      conn,
      command,
      task,
      stepNumber,
      connectionMessage
    );
  }

  /**
   * Static method for running deployment steps.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} command - The command to be run.
   * @param {string} task - The deployment task.
   * @param {number} stepNumber - The number of the deployment task step.
   * @param {string} message - A string containing the ssh connection details user@ip.
   * @throws {DeploymentError} Throws an errors if there is an exception.
   */
  static async _runDeploymentStep(conn, command, task, stepNumber, message) {
    try {
      sectionLogger(task, chalk.blue);

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
      throw new DeploymentError(error.message, task, stepNumber);
    }
  }
}
