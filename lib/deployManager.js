import chalk from "chalk";
import { performance } from "perf_hooks";
import { Client } from "ssh2";
import fetch from "node-fetch";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Command } from "commander";
import readline from "readline";
import deployConfig from "../config/deploy.js";

/**
 * Timer for tracking timestamps
 */
const startTime = performance.now();
const formatTime = () => {
  const elapsed = performance.now() - startTime;
  const seconds = Math.floor((elapsed / 1000) % 60);
  const minutes = Math.floor(elapsed / 1000 / 60);
  return `${chalk.white(String(minutes).padStart(2, "0"))}:${chalk.white(
    String(seconds).padStart(2, "0")
  )}`;
};

/**
 * Utility function to log messages with color and timestamps
 */
const sectionLogger = (message, color = chalk.blue) => {
  console.log(`${formatTime()} ${color(message)}`);
};
const logger = {
  // Info logger: Indents each line of the message
  info: (message, color = chalk.white) => {
    const lines = message.split("\n");
    lines.forEach((line) => {
      console.log(`      ${color(line)}`);
    });
  },

  // Success logger: Adds a checkmark and custom indentation
  success: (message, color = chalk.green) => {
    console.log(`    ${color(`✔ ${message}`)}`);
  },

  // Success logger: Adds a checkmark and custom indentation
  error: (message, color = chalk.red) => {
    console.log(`    ${color(`x ${message}`)}`);
  },
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
    const conn = new Client();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:\-T]/g, "")
      .split(".")[0];
    this.revisionTime = timestamp;
    const releaseDir = `${this.projectFolder}/releases/${timestamp}`;
    const currentSymlink = `${this.projectFolder}/current`;

    sectionLogger("ssh:connection", chalk.blue);
    logger.info(
      `01 ssh ${this.connectionConfig.username}@${this.connectionConfig.host}`,
      chalk.yellow
    );

    conn
      .on("ready", async () => {
        logger.success(
          `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
          chalk.green
        );
        try {
          // Test if SSH agent forwarding is working
          try {
            await this.testAgentForwarding(conn);
          } catch (error) {
            logger.error(
              `Error checking agent forwarding: ${error.message}`,
              chalk.red
            );
          }
          // git:wrapper
          // git:check
          // deploy:check:directories
          sectionLogger("deploy:check:directories", chalk.blue);

          const checkDirectoryCommand = `mkdir -p ${this.projectFolder}/shared ${this.projectFolder}/releases`;
          logger.info(`01 ${checkDirectoryCommand}`, chalk.yellow);

          await this.asyncWrapper(conn, checkDirectoryCommand);

          logger.success(
            `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          // deploy:check:linkedDirs
          sectionLogger("deploy:check:linked_dirs", chalk.blue);

          const checkLinkedDirectoriesCommand = `mkdir -p ${this.projectFolder}/shared/public`;
          logger.info(`01 ${checkLinkedDirectoriesCommand}`, chalk.yellow);

          await this.asyncWrapper(conn, checkLinkedDirectoriesCommand);

          logger.success(
            `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          // deploy:check:makeLinkedDirs
          sectionLogger("deploy:check:make_linked_dirs", chalk.blue);

          const makeLinkedDirectoriesCommand = `mkdir -p ${this.projectFolder}/shared/cache ${this.projectFolder}/shared/logs ${this.projectFolder}/shared/secrets`;
          logger.info(`01 ${makeLinkedDirectoriesCommand}`, chalk.yellow);

          await this.asyncWrapper(conn, checkLinkedDirectoriesCommand);

          logger.success(
            `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          // Clone repository
          if (this.deployVia === "git") {
            // git:createRelease
            sectionLogger("deploy:create_release_dir", chalk.blue);

            const createReleaseDirCommand = `mkdir -p ${releaseDir}`;
            logger.info(`02 ${createReleaseDirCommand}`, chalk.yellow);

            await this.asyncWrapper(conn, createReleaseDirCommand);

            logger.success(
              `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );

            // git:clone
            await this.cloneRemoteRepo(conn, releaseDir);
          } else if (this.deployVia === "rsync") {
            logger.info("The 'rsync' option has not yet been implemented");
          } else if (this.deployVia === "copy") {
            // git:clone
            await this.gitLocalClone(conn, releaseDir);

            // git:update

            // git:createRelease
            sectionLogger("deploy:create_release_dir", chalk.blue);

            const createReleaseDirCommand = `mkdir -p ${releaseDir}`;
            logger.info(`02 ${createReleaseDirCommand}`, chalk.yellow);

            await this.asyncWrapper(conn, createReleaseDirCommand);

            logger.success(
              `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );
          } else if (this.deployVia === "remoteCache") {
            logger.info(
              "The 'remoteCache' option has not yet been implemented"
            );
          }

          // deploy:set_current_revision
          sectionLogger("deploy:set_current_revision", chalk.blue);

          const setCurrentRevisionCommand = `(cd ${releaseDir} && git rev-parse HEAD)`;
          logger.info(`01 ${setCurrentRevisionCommand}`, chalk.yellow);

          const currentRevision = await this.asyncWrapper(
            conn,
            setCurrentRevisionCommand
          );
          this.revision = currentRevision;
          logger.success(
            `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          const writeRevisionCommand = `echo "${this.revision}" > ${releaseDir}/REVISION`;
          logger.info(`02 ${writeRevisionCommand}`, chalk.yellow);

          await this.asyncWrapper(conn, writeRevisionCommand);
          logger.success(
            `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          // deploy:set_current_revision_time
          sectionLogger("deploy:set_current_revision_time", chalk.blue);

          const setCurrentRevisionTimeCommand = `echo "${this.revisionTime}" > ${releaseDir}/REVISION_TIME`;
          logger.info(`01 ${setCurrentRevisionTimeCommand}`, chalk.yellow);

          await this.asyncWrapper(conn, setCurrentRevisionTimeCommand);

          logger.success(
            `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          // deploy:symlink:linked_files
          try {
            await this.symlinkLinkedFiles(conn, releaseDir);
          } catch (error) {
            logger.error(
              `Error during after-deploy tasks: ${error.message}`,
              chalk.red
            );
          }

          // deploy:symlink:linked_dirs
          try {
            await this.symlinkLinkedDirs(conn, releaseDir);
          } catch (error) {
            logger.error(
              `Error during after-deploy tasks: ${error.message}`,
              chalk.red
            );
          }

          // npm:config
          sectionLogger("npm:config", chalk.blue);

          logger.info(`01 nvm use ${this.nodeVersion}`, chalk.yellow);
          logger.success(
            `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          // npm:install
          try {
            await this.runNpmInstall(conn, releaseDir);
          } catch (error) {
            logger.error(
              `Error during npm install tasks: ${error.message}`,
              chalk.red
            );
          }

          // npm:assets:precompile
          sectionLogger("npm:assets:precompile", chalk.blue);
          logger.info(
            `No asset compilation required, skipping precompilation`,
            chalk.white
          );

          // npm:backup_package_json
          sectionLogger("npm:backup_package_json", chalk.blue);
          logger.info(
            `Backing up package.json not required, skipping backing up`,
            chalk.white
          );

          // deploy:migrate
          sectionLogger("deploy:migrate", chalk.blue);
          logger.info(`[deploy:migrate] Run 'node db/migrate.js'`, chalk.white);

          // deploy:migrating
          sectionLogger("deploy:migrating", chalk.blue);
          logger.info(
            `Migrating not required, skipping migrations`,
            chalk.white
          );

          // deploy:symlink:release
          sectionLogger("deploy:symlink:release", chalk.blue);

          const symlinkCurrentCommand = `ln -sfn ${releaseDir} ${currentSymlink}`;
          logger.info(`01 ${symlinkCurrentCommand}`, chalk.yellow);

          await this.asyncWrapper(conn, symlinkCurrentCommand);

          logger.success(
            `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          // systemctl:restart
          try {
            await this.restartApplication(conn);
          } catch (error) {
            logger.error(
              `Error during restart tasks: ${error.message}`,
              chalk.red
            );
          }

          // deploy:cleanup
          try {
            await this.cleanupOldReleases(conn, 5);
          } catch (error) {
            logger.error(
              `Error during cleanup tasks: ${error.message}`,
              chalk.red
            );
          }

          // deploy:log_revision
          sectionLogger("deploy:log_revision", chalk.blue);

          const logRevisionCommand = `echo "Branch ${this.repoDetails.branch} (at ${this.revision}) deployed as release ${this.revisionTime} by ${this.connectionConfig.username}" >> ${this.projectFolder}/revisions.log`;
          logger.info(`01 ${logRevisionCommand}`, chalk.yellow);

          await this.asyncWrapper(conn, logRevisionCommand);

          logger.success(
            `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );

          // deploy:after:symlink_public_resources
          try {
            await this.symlinkPublicResources(conn, releaseDir);
          } catch (error) {
            logger.error(
              `Error during cleanup tasks: ${error.message}`,
              chalk.red
            );
          }
        } catch (uploadError) {
          logger.error(
            `Error uploading repository: ${uploadError.message}`,
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

  // Utility method to wrap conn.exec in a Promise
  async asyncWrapper(conn, command) {
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) {
          reject(new Error(`Command failed: ${err.message}`));
          return;
        }

        let stdoutData = "";
        let stderrData = "";

        // Handle data as it comes in from stdout (for the main output)
        stream.on("data", (data) => {
          const output = data.toString();
          stdoutData += output; // Append the data to stdoutData
          logger.info(output); // Print stdout in real-time
        });

        // Handle data as it comes in from stderr (for error output)
        stream.on("stderr", (data) => {
          const errorOutput = data.toString();
          stderrData += errorOutput; // Append the data to stderrData
          logger.error(errorOutput, chalk.red); // Print stderr in real-time
        });

        // When the command finishes, resolve with the collected stdout
        stream.on("close", (code, signal) => {
          if (code !== 0) {
            reject(
              new Error(`Command failed with code ${code}, signal ${signal}`)
            );
          }
          resolve(stdoutData.trim()); // Return the full stdout output
        });
      });
    });
  }

  async testAgentForwarding(conn) {
    sectionLogger("ssh:test_agent_forwarding", chalk.blue);

    const checkAgentCommand = "ssh-add -l";
    logger.info(`01 ${checkAgentCommand}`, chalk.yellow);

    try {
      conn.exec(checkAgentCommand, (err, stream) => {
        if (err) {
          logger.error(`Error executing command: ${err.message}`, chalk.red);
          throw err;
        }

        let stdoutData = "";
        let stderrData = "";

        // Handle data from stdout
        stream.on("data", (data) => {
          const output = data.toString();
          stdoutData += output;
          logger.info(output); // Print stdout in real-time
        });

        // Handle data from stderr
        stream.on("stderr", (data) => {
          const errorOutput = data.toString();
          stderrData += errorOutput;
          logger.error(errorOutput, chalk.red); // Print stderr in real-time
        });

        // When the command finishes, check the output
        stream.on("close", (code, signal) => {
          if (code !== 0) {
            logger.error(
              `Command failed with code ${code}, signal ${signal}`,
              chalk.red
            );
            throw new Error(
              `Command failed with code ${code}, signal ${signal}`
            );
          }

          if (stderrData) {
            logger.error(`stderr: ${stderrData}`, chalk.red);
          }

          // Check if the agent has any identities
          if (stdoutData.trim() === "The agent has no identities.") {
            throw new Error(
              "SSH Agent Forwarding not working: No identities found."
            );
          } else {
            logger.success(
              "SSH Agent Forwarding is working correctly.",
              chalk.green
            );
          }
        });
      });
    } catch (error) {
      // If any error occurred during the process, log it
      logger.error(
        `Error checking SSH agent forwarding: ${error.message}`,
        chalk.red
      );
      if (error.stderr) {
        logger.error(`stderr: ${error.stderr}`, chalk.red);
      }
      if (error.stdout) {
        logger.error(`stdout: ${error.stdout}`, chalk.red);
      }
      throw error;
    }
  }

  /**
   * Uploads the repository to the specified release directory on the VPS.
   *
   * Steps:
   * 1. Downloads the repository tarball for the specified branch.
   * 2. Saves the tarball locally.
   * 3. Uploads the tarball to the VPS.
   * 4. Extracts the tarball on the VPS and removes the tarball.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} releaseDir - The release directory on the VPS.
   * @returns {Promise<void>} Resolves when the repository has been uploaded and extracted.
   * @throws {Error} Throws errors if downloading, uploading, or extracting the repository fails.
   */
  async uploadRepoTar(conn, releaseDir) {
    const { repoUrl, branch } = this.repoDetails;
    console.log("repoUrl", repoUrl);
    console.log("branch", branch);
    const tarballUrl = `${repoUrl}/archive/refs/heads/${branch}.tar.gz`;
    console.log("tarballUrl", tarballUrl);
    const response = await fetch(tarballUrl);

    sectionLogger("git:download", chalk.blue);

    if (!response.ok) {
      throw new Error(
        `Failed to download repository tarball: ${response.statusText}`
      );
    }

    const tarballPath = path.join(path.__dirname, "repo.tar.gz");
    const fileStream = fs.createWriteStream(tarballPath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });

    logger.info("Repository downloaded.", chalk.green);

    // Upload tarball to VPS
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        const remoteTarballPath = `${releaseDir}/repo.tar.gz`;
        const readStream = fs.createReadStream(tarballPath);
        const writeStream = sftp.createWriteStream(remoteTarballPath);

        writeStream.on("close", () => {
          logger.info("Tarball uploaded.", chalk.green);

          // Extract tarball on VPS
          conn.exec(
            `cd ${releaseDir} && tar -xzf repo.tar.gz && rm repo.tar.gz`,
            (err) => {
              if (err) return reject(err);
              logger.info("Tarball extracted.", chalk.green);
              resolve();
            }
          );
        });

        writeStream.on("error", reject);
        readStream.pipe(writeStream);
      });
    });
  }

  /**
   * Updates the repository to the latest commit in the release directory.
   * If the repository does not exist in the release directory, it clones the repository.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} releaseDir - The repo directory on the VPS.
   * @returns {Promise<void>} Resolves when the repository has been updated or cloned.
   * @throws {Error} Throws errors if updating or cloning the repository fails.
   */
  async cloneRemoteRepo(conn, releaseDir) {
    const { repoUrl, branch } = this.repoDetails;

    try {
      // Check if a repo exists in the release directory
      const repoExists = fs.existsSync(path.join(releaseDir, ".git"));
      if (repoExists === "exists") {
        // Pull the latest changes if the repository already exists
        sectionLogger("git:pull", chalk.blue);
        const pullCommand = `cd ${releaseDir} && git pull origin ${branch}`;
        logger.info(`01 ${pullCommand}`, chalk.yellow);
        await this.asyncWrapper(conn, pullCommand);
        logger.info(
          `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
          chalk.green
        );
      } else {
        // Clone the repository if it does not exist
        sectionLogger("git:clone", chalk.blue);
        const cloneCommand = `git clone --branch ${branch} ${repoUrl} ${releaseDir}`;
        logger.info(`01 ${cloneCommand}`, chalk.yellow);
        await this.asyncWrapper(conn, cloneCommand);
        logger.info(
          `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
          chalk.green
        );
      }
    } catch (error) {
      logger.error(
        `Error with repository cloning or pulling: ${error.message}`,
        chalk.red
      );
      conn.end();
    }
  }

  /**
   * Uploads the repository to the specified release directory on the VPS by copying files.
   *
   * Steps:
   * 1. Copies the entire repository folder from the local machine to the VPS.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {string} releaseDir - The release directory on the VPS.
   * @returns {Promise<void>} Resolves when the repository has been copied to the VPS.
   * @throws {Error} Throws errors if the copying fails.
   */
  async gitLocalClone(conn, releaseDir) {
    // Get the current file's directory name
    const __filename = fileURLToPath(import.meta.url); // Get file path from module URL
    const __dirname = dirname(__filename); // Get the directory from file path
    const repoDir = path.resolve(__dirname, "..", ".git");

    // const repoDir = path.resolve(__dirname, this.repoDirectory); // Local repository directory
    const remoteRepoDir = `${releaseDir}`; // Target directory on VPS

    sectionLogger("git:clone", chalk.blue);
    console.log("__filename", __filename);
    console.log("__dirname", __dirname);
    console.log("repoDir", repoDir);
    console.log("remoteRepoDir", remoteRepoDir);

    // Use SFTP to upload the files to the remote VPS
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        // Recursive file copy function
        const copyFiles = (src, dest, cb) => {
          fs.readdir(src, (err, files) => {
            if (err) return cb(err);

            let remaining = files.length;
            if (remaining === 0) return cb();

            files.forEach((file) => {
              const srcPath = path.join(src, file);
              const destPath = path.join(dest, file);
              fs.stat(srcPath, (err, stats) => {
                if (err) return cb(err);

                if (stats.isDirectory()) {
                  sftp.mkdir(destPath, { recursive: true }, (err) => {
                    if (err) return cb(err);
                    copyFiles(srcPath, destPath, () => {
                      if (--remaining === 0) cb();
                    });
                  });
                } else {
                  const readStream = fs.createReadStream(srcPath);
                  const writeStream = sftp.createWriteStream(destPath);

                  writeStream.on("close", () => {
                    if (--remaining === 0) cb();
                  });

                  readStream.pipe(writeStream);
                }
              });
            });
          });
        };

        // Check if the remote repo directory exists
        sftp.stat(remoteRepoDir, (err, stats) => {
          if (err && err.code === 2) {
            // Directory does not exist, create it
            sftp.mkdir(remoteRepoDir, { recursive: true }, (err) => {
              if (err) return reject(err);

              // Start copying the repository
              copyFiles(repoDir, remoteRepoDir, (err) => {
                if (err) return reject(err);

                logger.info("Repository copied to the VPS.", chalk.green);
                resolve();
              });
            });
          } else if (err) {
            // Other errors
            return reject(err);
          } else if (stats.isDirectory()) {
            // Directory exists, no need to create
            console.log("trying to copy");
            copyFiles(repoDir, remoteRepoDir, (err) => {
              if (err) return reject(err);

              logger.info("Repository copied to the VPS.", chalk.green);
              resolve();
            });
          }
        });
      });
    });
  }

  /**
   * Creates symlinks for all linked files.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} releaseDir - The release directory
   */
  async symlinkLinkedFiles(conn, releaseDir) {
    const secretsPath = `${this.projectFolder}/shared/secrets/.env.production`;

    sectionLogger("deploy:symlink:linked_files", chalk.blue);

    // Define the paths for symlinks
    const symlinks = [
      { target: secretsPath, link: `${releaseDir}/.env.production` },
    ];

    try {
      // Execute each symlink command sequentially
      for (const [i, { target, link }] of symlinks.entries()) {
        const symlinkCommand = `ln -s ${target} ${link}`;
        logger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
        // await execCommand(symlinkCommand);
        await this.asyncWrapper(conn, symlinkCommand);
        logger.success(
          `0${i + 1} ${this.connectionConfig.username}@${
            this.connectionConfig.host
          }`,
          chalk.green
        );
      }
    } catch (error) {
      logger.error(`Error creating symlinks: ${error.message}`, chalk.red);
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  /**
   *  Creates symlinks for all linked dirs.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} releaseDir - The release directory
   */
  async symlinkLinkedDirs(conn, releaseDir) {
    const cachePath = `${this.projectFolder}/shared/cache`;
    const logsPath = `${this.projectFolder}/shared/logs`;
    const uploadsPath = `${this.projectFolder}/shared/media/uploads`;

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
        logger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
        // await execCommand(symlinkCommand);
        await this.asyncWrapper(conn, symlinkCommand);
        logger.success(
          `0${i + 1} ${this.connectionConfig.username}@${
            this.connectionConfig.host
          }`,
          chalk.green
        );
      }
    } catch (error) {
      logger.error(`Error creating symlinks: ${error.message}`, chalk.red);
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  /**
   * Runs npm install in the release directory on the remote server.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} releaseDir - The path to the release directory
   */
  async runNpmInstall(conn, releaseDir) {
    sectionLogger("npm:install", chalk.blue);

    try {
      // Construct the npm install command with the release directory
      // const installCommand = `npm install --prefix ${releaseDir}`;
      const installCommand = `zsh -c '. /home/stephan/.nvm/nvm.sh && nvm use v${this.nodeVersion} && npm install --prefix ${releaseDir}'`;
      logger.info(`01 ${installCommand}`, chalk.yellow);

      // Execute the npm install command
      const installOutput = await this.asyncWrapper(conn, installCommand);
      // logger.info(`npm install output: ${installOutput}`, chalk.green);

      // Log success
      logger.success(
        `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
        chalk.green
      );
    } catch (error) {
      // Log any errors during npm install
      logger.error(
        `Error running npm install in ${releaseDir}: ${error.message}`,
        chalk.red
      );
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  /**
   * Cleans up old releases on the VPS, keeping only the specified number of most recent releases.
   *
   * @param {Client} conn - An established SSH connection.
   * @param {number} keepCount - The number of most recent releases to keep.
   */
  async cleanupOldReleases(conn, keepCount) {
    const releasesPath = `${this.projectFolder}/releases`;

    sectionLogger("deploy:cleanup", chalk.blue);

    try {
      const cleanUpCommand = `cd ${releasesPath} && ls -1t | tail -n +${
        keepCount + 1
      } | xargs -I {} rm -rf {}`;
      logger.info(`01 ${cleanUpCommand}`, chalk.yellow);
      await this.asyncWrapper(conn, cleanUpCommand);
      logger.success(
        `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
        chalk.green
      );
    } catch (error) {
      logger.error(`Error cleaning up releases: ${error.message}`, chalk.red);
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  /**
   * Restarts the application. Requires the systemctl process to follow the naming convention application.service.
   *
   * @param {Client} conn - An established SSH connection
   */
  async restartApplication(conn) {
    sectionLogger("systemctl:restart", chalk.blue);

    try {
      const restartCommand = `sudo systemctl restart ${this.application}.service`;
      logger.info(`01 ${restartCommand}`, chalk.yellow);
      await this.asyncWrapper(conn, restartCommand);
      logger.info(
        `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
        chalk.green
      );
    } catch (error) {
      // Log any errors during npm install
      logger.error(
        `Error running npm install in ${releaseDir}: ${error.message}`,
        chalk.red
      );
      throw error; // Re-throw the error for further handling if necessary
    }
  }

  /**
   * Creates symlinks for all resources in shared/public to the release/public directory.
   *
   * @param {Client} conn - An established SSH connection
   * @param {string} releaseDir - The release directory
   */
  async symlinkPublicResources(conn, releaseDir) {
    const sharedPublicDir = `${this.projectFolder}/shared/public`;
    const releasePublicDir = `${releaseDir}/public`;

    sectionLogger("deploy:after:symlink_public_resources", chalk.blue);

    try {
      // List all files and directories in the shared/public directory
      const listCommand = `find ${sharedPublicDir} -mindepth 1 -maxdepth 1`;
      logger.info(`Listing resources in ${sharedPublicDir}`, chalk.white);

      // Execute the list command and capture output
      const result = await this.asyncWrapper(conn, listCommand);
      const resources = result.trim().split("\n");

      // Loop through resources and create symlinks in the release/public directory
      for (const [i, resource] of resources.entries()) {
        const resourceName = resource.split("/").pop(); // Get the file/directory name
        const linkPath = `${releasePublicDir}/${resourceName}`;
        const symlinkCommand = `ln -s ${resource} ${linkPath}`;

        logger.info(`0${i + 1} ${symlinkCommand}`, chalk.yellow);
        await this.asyncWrapper(conn, symlinkCommand);
        logger.success(
          `0${i + 1} ${this.connectionConfig.username}@${
            this.connectionConfig.host
          }`,
          chalk.green
        );
      }
    } catch (error) {
      logger.error(`Error creating symlinks: ${error.message}`, chalk.red);
      throw error; // Re-throw the error for further handling if necessary
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
    logger.info(
      `01 ssh ${this.connectionConfig.username}@${this.connectionConfig.host}`,
      chalk.yellow
    );

    return new Promise((resolve, reject) => {
      conn
        .on("ready", async () => {
          logger.success(
            `01 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
            chalk.green
          );
          try {
            // deploy:check:directories
            sectionLogger("deploy:get_releases", chalk.blue);

            const getReleasesCommand = `ls -d ${this.projectFolder}/releases/*/`;
            logger.info(`01 ${getReleasesCommand}`, chalk.yellow);

            const response = await this.asyncWrapper(conn, getReleasesCommand);
            logger.success(
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

            logger.info(`02 release parsing`, chalk.yellow);
            logger.info(`Releases: ${releases.join(", ")}`);
            logger.success(
              `02 ${this.connectionConfig.username}@${this.connectionConfig.host}`,
              chalk.green
            );

            resolve(releases); // Resolve with the list of releases
          } catch (error) {
            logger.error(
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
    logger.info(
      `01 ssh ${this.connectionConfig.username}@${this.connectionConfig.host}`,
      chalk.yellow
    );

    conn
      .on("ready", async () => {
        logger.success(
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
          logger.error(`Error rolling back:" ${error.message}`, chalk.red);
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
    logger.info(
      `01 ssh ${this.connectionConfig.username}@${this.connectionConfig.host}`,
      chalk.yellow
    );

    conn
      .on("ready", async () => {
        logger.success(
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
          logger.error(
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

// Helper function to create a new deployer instance
const createDeployer = () => {
  return new Shokan({
    application: deployConfig.application,
    deployVia: deployConfig.deployVia,
    connectionConfig: {
      host: deployConfig.server,
      port: deployConfig.port,
      username: deployConfig.user,
      agent: deployConfig.agent || process.env.SSH_AUTH_SOCK,
      agentForward: deployConfig.agentForward || true,
    },
    repoDetails: {
      repoUrl: deployConfig.repoUrl,
      branch: deployConfig.branch,
    },
    nodeVersion: deployConfig.nodeVersion,
    projectFolder: deployConfig.deployTo,
  });
};

// Actions
const deploy = async () => {
  const deployer = createDeployer();
  await deployer.deploy();
};

const releases = async () => {
  const deployer = createDeployer();
  await deployer.getReleaseIds();
};

const rollback = async () => {
  const deployer = createDeployer();
  await deployer.rollback();
};

const switchVersion = async (releaseId) => {
  const deployer = createDeployer();

  if (!releaseId) {
    logger.info("No release ID provided, fetching releases...");
    try {
      // Wait for the list of releases
      const releaseIds = await deployer.getReleaseIds();

      if (releaseIds && releaseIds.length === 0) {
        logger.info("No releases found. Exiting...");
        return;
      }

      // Show the releases and let the user choose one
      logger.info("Available releases:");
      releaseIds.forEach((id, index) => {
        logger.info(`${index + 1}. Release ID: ${id}`);
      });

      // Await user selection
      releaseId = await promptUserSelection(releaseIds);

      if (!releaseId) {
        logger.error("No valid release selected. Exiting...");
        return;
      }
    } catch (error) {
      logger.error("Error fetching release IDs:", error);
      return;
    }
  }

  logger.info(`\nSwitching to release ID: ${releaseId}`);
  try {
    await deployer.switchRelease(releaseId);
    // logger.info(`Successfully switched to release ${releaseId}`);
  } catch (error) {
    logger.error(`Error switching to release ${releaseId}: ${error.message}`);
  }
};

// Helper function to prompt user selection and wait for input
const promptUserSelection = (releaseIds) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = () => {
      rl.question(
        "      Select a release by number or press 'c' to cancel: ",
        (answer) => {
          if (answer.trim().toLowerCase() === "c") {
            logger.info("Operation cancelled by the user.");
            resolve(null); // Return null for cancellation
            rl.close();
            return;
          }

          const selectedIndex = parseInt(answer) - 1;

          if (selectedIndex >= 0 && selectedIndex < releaseIds.length) {
            resolve(releaseIds[selectedIndex]); // Resolve with the selected release
            rl.close();
          } else {
            logger.error(
              "Invalid selection. Please choose a valid release number or press 'c' to cancel."
            );
            askQuestion(); // Recurse to ask again
          }
        }
      );
    };

    askQuestion(); // Start the questioning loop
  });
};

// Command-line program setup
const program = new Command();
program.version("0.1.0").description("Deployment CLI");

program.command("deploy").description("Deploy the application").action(deploy);
program.command("releases").description("List all releases").action(releases);
program
  .command("rollback")
  .description("Rollback to the previous release")
  .action(rollback);
program
  .command("switch [releaseId]")
  .description("Switch versions")
  .action(switchVersion);

program.parse(process.argv);
