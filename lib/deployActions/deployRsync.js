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

    actionLogger.info("Repository downloaded.", chalk.green);

    // Upload tarball to VPS
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        const remoteTarballPath = `${releaseDir}/repo.tar.gz`;
        const readStream = fs.createReadStream(tarballPath);
        const writeStream = sftp.createWriteStream(remoteTarballPath);

        writeStream.on("close", () => {
          actionLogger.info("Tarball uploaded.", chalk.green);

          // Extract tarball on VPS
          conn.exec(
            `cd ${releaseDir} && tar -xzf repo.tar.gz && rm repo.tar.gz`,
            (err) => {
              if (err) return reject(err);
              actionLogger.info("Tarball extracted.", chalk.green);
              resolve();
            }
          );
        });

        writeStream.on("error", reject);
        readStream.pipe(writeStream);
      });
    });
  }