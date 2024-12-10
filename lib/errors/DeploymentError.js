// lib/errors/DeploymentError.js

class DeploymentError extends Error {
  constructor(message, task, step) {
    super(message);
    this.name = "DeploymentError";
    this.task = task; // Task where the error occurred
    this.step = step; // Step where the error occurred
    this.timestamp = new Date(); // Adding a timestamp for logging purposes
  }
}

export default DeploymentError;
