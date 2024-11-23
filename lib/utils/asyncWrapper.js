import { sectionLogger, actionLogger } from "./logger.js"; // Import your logger utility

export const asyncWrapper = (conn, command) => {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(new Error(`Command failed: ${err.message}`));
        return;
      }

      let stdoutData = "";
      let stderrData = "";

      stream.on("data", (data) => {
        const output = data.toString();
        stdoutData += output;
        actionLogger.info(output); // Print stdout in real-time
      });

      stream.stderr.on("data", (data) => {
        const errorOutput = data.toString();
        stderrData += errorOutput;
        actionLogger.error(errorOutput); // Print stderr in real-time
      });

      stream.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed with code ${code}`));
        } else {
          resolve(stdoutData.trim());
        }
      });
    });
  });
};
