// config/deploy.js

const user = "user name";
const application = "application_name";
const agent = process.env.SSH_AUTH_SOCK; // Use the SSH agent for forwarding if available

const deployConfig = {
  // Server details
  server: "IP",
  port: 22,
  user: user,

  // Application details
  application: application,

  // Repo details
  repoUrl: "git@github.com:Username/repository.git",
  branch: "branch",

  // Deployment details
  stage: "stage",
  /*
   * Available method: git,
   * methods in development: rsync, copy, remoteCache
   */
  deployVia: "git",
  deployTo: `/home/${user}/apps/${application}`,

  nodeVersion: "22.11.0",

  // SSH details
  sshOptions: {
    agentForward: true,
    agent: agent,
    user: user,
    keys: "/Users/User/.ssh/id_rsa",
  },
};

export default deployConfig;
