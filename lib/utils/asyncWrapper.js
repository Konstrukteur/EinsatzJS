// lib/utils/asyncWrapper.js

// Local imports
import { actionLogger } from "./logger.js";

export const asyncWrapper = (conn, command) => {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(new Error(`Command failed: ${err.message}`));
        return;
      }

      let stdoutData = "";
      let stderrData = "";

      // Handle standard output (stdout)
      stream.on("data", (data) => {
        const output = data.toString();
        stdoutData += output;
        actionLogger.info(output); // Print stdout in real-time
      });

      // Handle standard error (stderr)
      stream.stderr.on("data", (data) => {
        const errorOutput = data.toString();
        stderrData += errorOutput;

        // Use a warning logger for non-critical messages
        if (errorOutput.toLowerCase().includes("error")) {
          actionLogger.error(errorOutput); // Treat as error if it mentions 'error'
        } else {
          actionLogger.warning(errorOutput); // Log as warning otherwise
        }
      });

      // Handle stream closure
      stream.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Command failed with code ${code}: ${stderrData.trim()}`)
          );
        } else {
          resolve(stdoutData.trim());
        }
      });
    });
  });
};
