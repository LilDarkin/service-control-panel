const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Get all services (returns promise)
  getServices: () => ipcRenderer.invoke("get-services"),

  // Service controls
  startService: (id) => ipcRenderer.send("start-service", id),
  stopService: (id) => ipcRenderer.send("stop-service", id),
  restartService: (id) => ipcRenderer.send("restart-service", id),

  // Bulk operations
  startAll: () => ipcRenderer.send("start-all"),
  stopAll: () => ipcRenderer.send("stop-all"),
  restartAll: () => ipcRenderer.send("restart-all"),

  // Service management
  addService: (service) => ipcRenderer.send("add-service", service),
  removeService: (id) => ipcRenderer.send("remove-service", id),
  updateService: (service) => ipcRenderer.send("update-service", service),

  // Event listeners
  onInitServices: (callback) =>
    ipcRenderer.on("init-services", (event, services) => callback(services)),
  onServiceStatus: (callback) =>
    ipcRenderer.on("service-status", (event, data) => callback(data)),
  onServiceLog: (callback) =>
    ipcRenderer.on("service-log", (event, data) => callback(data)),
  onServiceAdded: (callback) =>
    ipcRenderer.on("service-added", (event, service) => callback(service)),
  onServiceRemoved: (callback) =>
    ipcRenderer.on("service-removed", (event, id) => callback(id)),

  // File system operations
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  getSubfolders: (parentPath) =>
    ipcRenderer.invoke("get-subfolders", parentPath),

  // Command execution
  executeCommand: (serviceId, command) =>
    ipcRenderer.invoke("execute-command", serviceId, command),
  getGitBranch: (serviceId) => ipcRenderer.invoke("get-git-branch", serviceId),

  // Generic send method for other IPC communications
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),

  // Profile management
  getProfiles: () => ipcRenderer.invoke("get-profiles"),
  switchProfile: (profileName) =>
    ipcRenderer.invoke("switch-profile", profileName),
  createProfile: (profileName, parentDir) =>
    ipcRenderer.send("create-profile", profileName, parentDir),
  deleteProfile: (profileName) =>
    ipcRenderer.send("delete-profile", profileName),
  updateProfileRoot: (profileName, parentDir) =>
    ipcRenderer.invoke("update-profile-root", profileName, parentDir),
});

console.log("Preload script loaded");
