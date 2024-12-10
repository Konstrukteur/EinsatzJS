// config/deploy.js

const user = "user name"; // your ssh username
const application = "application_name"; // your application name
const agent = process.env.SSH_AUTH_SOCK; // Use the SSH agent for forwarding if available

const deployConfig = {
  // Server details
  server: "IP", // the IP address of the production server
  port: 22, // the port of the production server
  user: user,

  // Application details
  application: application,

  // Repo details
  repoUrl: "git@github.com:Username/repository.git", // the repository url
  branch: "branch", // the branch name for deployment

  // Deployment details
  stage: "stage", // the branch name for deployment
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
    keys: "/Users/User/.ssh/id_rsa", // your deployment ssh key
  },
};

export default deployConfig;
