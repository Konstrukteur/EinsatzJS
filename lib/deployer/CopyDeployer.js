// lib/deployer/CopyDeployer.js

// Global imports
import path, { dirname } from "path";
import { fileURLToPath } from "url";

// Local imports
import { AbstractDeployer } from "./AbstractDeployer.js";

export class CopyDeployer extends AbstractDeployer {
  constructor(einsatzInstance) {
    this.conn = einsatzInstance.conn;
    this.repoDetails = einsatzInstance.repoDetails;
    this.projectFolder = einsatzInstance.projectFolder;
    this.releaseDir = `${einsatzInstance.projectFolder}/releases/${einsatzInstance.revisionTime}`;
  }

  async deploy(stepNumber, connectionMessage) {
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

                actionLogger.info("Repository copied to the VPS.", chalk.green);
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

              actionLogger.info("Repository copied to the VPS.", chalk.green);
              resolve();
            });
          }
        });
      });
    });
  }

  async rollback() {
    /* Rollback logic */
  }
}
