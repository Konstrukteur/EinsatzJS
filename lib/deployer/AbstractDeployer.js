// AbstractDeployer.js
export class AbstractDeployer {
  deploy() {
    throw new Error("Deploy method not implemented");
  }
  rollback() {
    throw new Error("Rollback method not implemented");
  }
  // Common utilities can be shared here.
}
