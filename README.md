# EinsatzJS

This is the EinsatzJS deployment package for the KraftwerkJS framework. It provides after isntallation deploy, rollback, switch and indexing of releases on a remote server.

### 1. **Installation**

- EinsatzJS can be installed either globally or locally in a project directory.

  - **Install it globally with:**
    ```zsh
    $ npm install -g einsatz
    ```
  - **Install it locally (in your project) with:**
    ```zsh
    $ npm install einsatz
    ```

### 2. **Running the Script**

- **Global Installation**: If EinsatzJS has been installed globally, the script becomes accessible as a CLI tool system-wide. You can run it directly by using the `einsatz` command:
  ```zsh
  $ einsatz
  ```
- **Local Installation**: If EinsatzJS has been installed locally, the script will be available in the `node_modules/.bin` directory. You can run it by using `npx`:
  ```zsh
  $ npx einsatz
  ```

### 3. **Setting up EinsatzJS**

- After successfully installing EinsatzJS. The `deploy.js` config file has to be created and configured. EinsatzJS takes care of creating the file:
  ```zsh
  $ einsatz setup
  ```
- Running this command creates a config directory in your project directory, if it does not exist, and copies the `deploy.js` file into it.

  The `deploy.js` config file has to be edited with all necessary information regarding server authenication, the project and the git repository.

  - `user` is the user account for login into your server.
  - `application` is the application name and will define the project directory name.
  - `agent` will acquire your running ssh agent.
  - `deployConfig` requires your servers IP and port number.
  - In the repo details section Einsatz requires the URL of your git repository as well as the branch name, from which to deploy.
  - In the deployment details one can specify deploy method and nodeVersion to be used on the server, if multiple node versions are installed. (In beta only the Git deployer is implemented.)
  - In the SSH details the key for server login has to be specified.

### 4. **Deploying through EinsatzJS**

EinsatzJS provides the following deployment actions:

- deployment:
  ```zsh
  $ einsatz deploy
  ```
- rollback:
  ```zsh
  $ einsatz rollback
  ```
- get release version:
  ```zsh
  $ einsatz releases
  ```
- switch release version:
  ```zsh
  $ einsatz switch
  ```
  It is possible to switch to a specific release version by running:
  ```zsh
  $ einsatz switch 12345678901234
  ```
  Without specifying the release version. EinsatzJS js will automatically fetch the information about the released versions and ask for the release version to switch to.
