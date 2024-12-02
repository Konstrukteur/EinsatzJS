// lib/utils/testAgentForwarding.js

// Global imports
import chalk from "chalk";

// Local imports
import { actionLogger } from "./logger.js";
import { asyncWrapper } from "./asyncWrapper.js";

/**
 * Tests SSH agent forwarding by running an identity check.
 *
 * @param {Client} conn - The SSH client instance.
 * @param {Object} connectionConfig - SSH connection configuration (for logging purposes).
 * @returns {Promise<void>} - Resolves if agent forwarding works, rejects otherwise.
 */
export async function testAgentForwarding(conn, connectionConfig) {
  const command = "ssh-add -l"; // Command to list the identities in the agent

  actionLogger.info(
    `Testing agent forwarding on ${connectionConfig.host}`,
    chalk.yellow
  );

  try {
    // Execute the identity check command
    const output = await asyncWrapper(conn, command);

    if (
      output.includes("no identities") ||
      output.includes("The agent has no identities")
    ) {
      throw new Error(
        "SSH agent forwarding is enabled, but no identities are available."
      );
    }

    actionLogger.success(
      `Agent forwarding test passed on ${connectionConfig.host}`,
      chalk.green
    );
  } catch (error) {
    actionLogger.error(
      `Agent forwarding test failed on ${connectionConfig.host}: ${error.message}`,
      chalk.red
    );
    throw new Error(`Agent forwarding test failed: ${error.message}`);
  }
}
