// config/deploy.js

const user = "user name";
const application = "application_name";
const agent = process.env.SSH_AUTH_SOCK; // Use the SSH agent for forwarding if available

const deployConfig = {
  server: "IP",
  port: 22,

  application: application,
  repoUrl: "git@github.com:Username/repository.git",
  user: user,
  branch: "branch",

  stage: "stage",
  deployVia: "git", // git, rsync, copy, remoteCache
  deployTo: `/home/${user}/apps/${application}`,

  nodeVersion: "22.11.0",

  sshOptions: {
    agentForward: true,
    agent: agent,
    user: user,
    keys: "/Users/User/.ssh/id_rsa",
  },
};

export default deployConfig;
