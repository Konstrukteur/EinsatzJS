import chalk from "chalk";
import { performance } from "perf_hooks";

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
export const sectionLogger = (message, color = chalk.blue) => {
  console.log(`${formatTime()} ${color(message)}`);
};
export const actionLogger = {
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
