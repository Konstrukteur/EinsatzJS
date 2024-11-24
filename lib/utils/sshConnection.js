import { Client } from "ssh2"; // Import SSH2 client
import { sectionLogger, actionLogger } from "./logger.js"; // Import your logger utility
import chalk from "chalk";

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

    conn.on("error", (err) => {
      actionLogger.error(`SSH Connection Error: ${err.message}`);
      reject(new Error(`SSH Connection Error: ${err.message}`));
    });

    conn.on("close", () => {
      actionLogger.info("SSH connection closed.");
    });

    conn.connect(connectionConfig);
  });
}
