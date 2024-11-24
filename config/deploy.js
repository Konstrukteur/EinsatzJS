// config/deploy.js

const user = "name";
const application = "name";
const agent = process.env.SSH_AUTH_SOCK; // Use the SSH agent for forwarding if available

const deployConfig = {
  server: "IP",
  port: 22,

  application: application,
  repoUrl: "repo",
  user: user,
  branch: "name",

  stage: "environment",
  deployVia: "git", // git, rsync, copy, remoteCache
  deployTo: `/home/${user}/apps/${application}`,

  nodeVersion: "22.11.0",

  sshOptions: {
    agentForward: true,
    agent: agent,
    user: user,
    keys: "/Users/User/.ssh/key",
  },
};

export default deployConfig;
