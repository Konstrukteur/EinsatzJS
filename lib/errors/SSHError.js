// lib/errors/SSHError.js

class SSHError extends Error {
  constructor(message, connectionConfig, originalError) {
    super(message); // Pass message to the parent class
    this.name = "SSHError";
    this.host = connectionConfig.host;
    this.username = connectionConfig.username;
    this.port = connectionConfig.port || 22; // Default SSH port
    this.originalMessage = originalError.message; // Capture original error details
    this.timestamp = new Date(); // Log the time of the error

    // Optional: Retain stack trace from original error
    if (originalError.stack) {
      this.stack = originalError.stack;
    }
  }
}

export default SSHError;
