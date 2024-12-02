// lib/utils/sshConnection.js

// Global imports
import { Client } from "ssh2";
import chalk from "chalk";

// Local imports
import SSHError from "../errors/SSHError.js";
import { sectionLogger, actionLogger } from "./logger.js";

/**
 * Establishes an SSH connection.
 * @param {Object} connectionConfig - SSH configuration object (host, port, username, privateKey, etc.)
 * @returns {Promise<Client>} - A promise that resolves to an SSH client instance.
 */
export async function establishConnection(connectionConfig) {
  sectionLogger("ssh:connection", chalk.blue);
  const conn = new Client();
  actionLogger.info(
    `01 ssh ${connectionConfig.username}@${connectionConfig.host}`,
    chalk.yellow
  );

  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      actionLogger.success(
        `01 ${connectionConfig.username}@${connectionConfig.host}`,
        chalk.green
      );
      resolve(conn);
    });

    conn.on("error", (error) => {
      reject(
        new SSHError(
          `SSH Connection Error: ${error.message}`,
          connectionConfig,
          error
        )
      );
    });

    conn.on("close", () => {
      actionLogger.info("SSH connection closed.");
    });

    conn.connect(connectionConfig);
  });
}
