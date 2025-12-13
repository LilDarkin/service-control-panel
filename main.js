const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execSync } = require("child_process");

// Auto-updater (only in production)
let autoUpdater = null;
if (app.isPackaged) {
  const { autoUpdater: updater } = require("electron-updater");
  autoUpdater = updater;
  autoUpdater.autoDownload = false; // Disable auto download
  autoUpdater.autoInstallOnAppQuit = true;
}

let mainWindow;
const services = {};
const configPath = path.join(app.getPath("userData"), "services.json");
const profilesDir = path.join(app.getPath("userData"), "profiles");
const logsDir = path.join(app.getPath("userData"), "logs");
let currentProfile = "default";
let maxLogLines = 350; // Default limit

// Log throttling to prevent IPC flooding
const logBuffer = {};
let logFlushTimer = null;

function sendBufferedLog(id, log) {
  if (!logBuffer[id]) {
    logBuffer[id] = [];
  }
  logBuffer[id].push(log);

  // Schedule flush if not already scheduled
  if (!logFlushTimer) {
    logFlushTimer = setTimeout(() => {
      flushLogBuffer();
      logFlushTimer = null;
    }, 50); // Flush every 50ms
  }
}

function flushLogBuffer() {
  Object.keys(logBuffer).forEach((id) => {
    const logs = logBuffer[id];
    if (logs && logs.length > 0 && mainWindow) {
      // Send combined logs as one message
      mainWindow.webContents.send("service-log", {
        id,
        log: logs.join(""),
      });
      logBuffer[id] = [];
    }
  });
}

if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Helper to enforce log file line limit
function enforceLogLimit(filePath, maxLines) {
  try {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    if (lines.length > maxLines) {
      const truncatedLines = lines.slice(lines.length - maxLines);
      const newContent = truncatedLines.join("\n");
      fs.writeFileSync(filePath, newContent);
      console.log(
        `Truncated log file ${path.basename(filePath)} to ${maxLines} lines`
      );
    }
  } catch (error) {
    console.error(`Error truncating log file ${filePath}:`, error);
  }
}

function cleanLogFile(id) {
  const logPath = path.join(logsDir, `${id}.log`);
  enforceLogLimit(logPath, maxLogLines);
}

// Try to find Git Bash
const gitBashPaths = [
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  "C:\\Program Files\\Git\\git-bash.exe",
  "C:\\Program Files (x86)\\Git\\git-bash.exe",
];

let shellPath = null;
for (const p of gitBashPaths) {
  if (fs.existsSync(p)) {
    shellPath = p;
    break;
  }
}

// Fallback to powershell if git bash not found
if (!shellPath) {
  console.log("Git Bash not found, falling back to PowerShell");
  shellPath = "powershell.exe";
} else {
  console.log("Using Git Bash at:", shellPath);
}

// Load configuration
function loadConfig(profileName = "default") {
  try {
    const profilePath = path.join(profilesDir, `${profileName}.json`);
    if (fs.existsSync(profilePath)) {
      const data = fs.readFileSync(profilePath, "utf8");
      const profileData = JSON.parse(data);
      // Profile data now includes: { parentDir, services }
      return profileData;
    } else if (profileName === "default") {
      // Default profile with empty services
      return {
        parentDir: "",
        services: [],
      };
    }
    return { parentDir: "", services: [] };
  } catch (err) {
    console.log("Error loading config:", err);
    return { parentDir: "", services: [] };
  }
}

// Save configuration
function saveConfig(
  servicesArray,
  profileName = currentProfile,
  parentDir = ""
) {
  const profilePath = path.join(profilesDir, `${profileName}.json`);
  const profileData = {
    parentDir: parentDir,
    services: servicesArray,
  };
  fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
}

// Start a service
function startService(id) {
  const service = services[id];
  if (!service) {
    console.error("Service not found:", id);
    return;
  }

  if (service.process) {
    console.log("Service already running:", id);
    return;
  }

  try {
    console.log(
      `Starting service ${id}: ${service.name} with command: ${service.command}`
    );

    // Use cmd.exe for service processes to ensure PATH resolution
    // and better compatibility with taskkill
    service.process = spawn(service.command, {
      cwd: path.resolve(__dirname, service.path),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32" ? "cmd.exe" : true,
    });

    // Clean logs before starting (ensure we start within limits)
    cleanLogFile(id);

    // Create log stream
    const logPath = path.join(logsDir, `${id}.log`);
    const logStream = fs.createWriteStream(logPath, { flags: "a" });

    // Add timestamp to new session
    logStream.write(
      `\n--- Session started at ${new Date().toISOString()} ---\n`
    );

    service.status = "running";
    service.pid = service.process.pid;
    service.logStream = logStream; // Store stream to close it later

    mainWindow.webContents.send("service-status", {
      id,
      status: "running",
      pid: service.process.pid,
    });
    console.log(`Started service ${id}, PID: ${service.process.pid}`);

    service.process.stdout.on("data", (data) => {
      logStream.write(data);
      sendBufferedLog(id, data.toString());
    });

    service.process.stderr.on("data", (data) => {
      logStream.write(data);
      sendBufferedLog(id, data.toString());
    });

    service.process.on("close", (code) => {
      console.log(`Service ${id} stopped with code ${code}`);

      // Close log stream
      if (service.logStream) {
        service.logStream.write(
          `\n--- Session ended at ${new Date().toISOString()} with code ${code} ---\n`
        );
        service.logStream.end(() => {
          service.logStream = null;
          cleanLogFile(id);
        });
      } else {
        cleanLogFile(id);
      }

      service.process = null;
      service.pid = null;
      service.status = "stopped";
      mainWindow.webContents.send("service-status", {
        id,
        status: "stopped",
        pid: null,
      });
      if (code !== 0 && code !== null) {
        mainWindow.webContents.send("service-log", {
          id,
          log: `\nProcess exited with code ${code}\n`,
        });
      }
    });

    service.process.on("error", (error) => {
      console.error(`Error starting service ${id}:`, error);

      if (service.logStream) {
        service.logStream.write(`ERROR: ${error.message}\n`);
        service.logStream.end();
        service.logStream = null;
      }

      mainWindow.webContents.send("service-log", {
        id,
        log: `ERROR: ${error.message}\n`,
      });
      service.process = null;
      service.pid = null;
      service.status = "stopped";
      mainWindow.webContents.send("service-status", {
        id,
        status: "stopped",
        pid: null,
      });
    });
  } catch (error) {
    console.error(`Failed to start service ${id}:`, error);
    mainWindow.webContents.send("service-log", {
      id,
      log: `ERROR: ${error.message}\n`,
    });
  }
}

// Stop a service
function stopService(id) {
  const service = services[id];
  if (service && service.process) {
    console.log(`Stopping service ${id}, PID: ${service.process.pid}`);

    try {
      const pid = service.process.pid;
      if (process.platform === "win32") {
        execSync(`taskkill /F /T /PID ${pid}`, {
          stdio: "ignore",
          windowsHide: true,
        });
        console.log(`Sent taskkill /F /T /PID ${pid}`);
      } else {
        process.kill(-pid);
      }
    } catch (error) {
      console.error(`Error sending kill signal to PID ${pid}:`, error.message);
    }
    console.log(
      `Stop signal sent for service ${id}. Waiting for 'close' event...`
    );
  }
}

// Restart a service
function restartService(id) {
  console.log(`Restarting service ${id}`);
  stopService(id);
  setTimeout(() => startService(id), 1000);
}

// App lifecycle
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#111827", // Match the dark theme bg
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Uncomment to open devtools
  // mainWindow.webContents.openDevTools();

  mainWindow.loadFile("index.html");

  // Load services from default profile
  const profileData = loadConfig("default");
  const config = profileData.services || [];

  config.forEach((s) => {
    services[s.id] = {
      ...s,
      process: null,
      status: "stopped",
    };
  });

  console.log("Loaded services:", Object.keys(services).length);

  // Send services to renderer when window is ready
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Page loaded, sending services:", Object.keys(services).length);
    mainWindow.webContents.send("init-services", {
      services: Object.values(services).map((s) => ({
        id: s.id,
        name: s.name,
        path: s.path,
        command: s.command,
        status: s.status,
      })),
      parentDir: profileData.parentDir || "",
    });
  });

  // Auto-updater setup (only in packaged app)
  if (autoUpdater) {
    autoUpdater.on("checking-for-update", () => {
      console.log("Checking for updates...");
      mainWindow.webContents.send("update-status", { status: "checking" });
    });

    autoUpdater.on("update-available", (info) => {
      console.log("Update available:", info.version);
      // The release notes might be a string or array, handle accordingly
      const releaseNotes = Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map((n) => n.note).join("\n")
        : info.releaseNotes || "No release notes available.";

      mainWindow.webContents.send("update-status", {
        status: "available",
        version: info.version,
        releaseNotes: releaseNotes,
      });
    });

    autoUpdater.on("update-not-available", () => {
      console.log("No updates available");
      mainWindow.webContents.send("update-status", { status: "not-available" });
    });

    autoUpdater.on("download-progress", (progress) => {
      mainWindow.webContents.send("update-status", {
        status: "downloading",
        percent: Math.round(progress.percent),
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("Update downloaded:", info.version);
      mainWindow.webContents.send("update-status", {
        status: "downloaded",
        version: info.version,
      });
      // UI banner will handle user interaction
    });

    autoUpdater.on("error", (err) => {
      console.error("Update error:", err);
      mainWindow.webContents.send("update-status", {
        status: "error",
        error: err.message,
      });
    });

    // Check for updates after a short delay
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  }
});

// Handle install update request from renderer
ipcMain.on("install-update", () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
  }
});

// Handle download update request
ipcMain.on("download-update", () => {
  if (autoUpdater) {
    autoUpdater.downloadUpdate();
  }
});

app.on("before-quit", () => {
  // Stop all services
  Object.keys(services).forEach((id) => stopService(id));
});

app.on("window-all-closed", () => {
  // Final cleanup for any remaining processes
  Object.keys(services).forEach((id) => {
    if (services[id].process) {
      try {
        const pid = services[id].process.pid;
        if (process.platform === "win32") {
          execSync(`taskkill /F /T /PID ${pid}`, {
            stdio: "ignore",
            windowsHide: true,
          });
        } else {
          process.kill(-pid, "SIGKILL");
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  });
  app.quit();
});

// IPC Handlers
ipcMain.handle("get-services", () => {
  console.log("get-services called");
  return Object.values(services).map((s) => ({
    id: s.id,
    name: s.name,
    path: s.path,
    command: s.command,
    status: s.status,
  }));
});

ipcMain.handle("get-version", () => {
  return app.getVersion();
});

ipcMain.on("start-service", (event, id) => {
  console.log("IPC: start-service", id);
  startService(id);
});

ipcMain.on("stop-service", (event, id) => {
  console.log("IPC: stop-service", id);
  stopService(id);
});

ipcMain.on("restart-service", (event, id) => {
  console.log("IPC: restart-service", id);
  restartService(id);
});

ipcMain.on("start-all", () => {
  console.log("IPC: start-all");
  Object.keys(services).forEach((id) => startService(id));
});

ipcMain.on("stop-all", () => {
  console.log("IPC: stop-all");
  Object.keys(services).forEach((id) => stopService(id));
});

ipcMain.on("restart-all", () => {
  console.log("IPC: restart-all");
  Object.keys(services).forEach((id) => restartService(id));
});

ipcMain.on("update-service", (event, service) => {
  console.log("IPC: update-service", service.id);
  if (services[service.id]) {
    services[service.id].name = service.name;
    services[service.id].path = service.path;
    services[service.id].command = service.command;
    const config = Object.values(services).map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      command: s.command,
    }));
    saveConfig(config);
  }
});

ipcMain.on("add-service", (event, service) => {
  console.log("IPC: add-service", service.id);
  services[service.id] = {
    ...service,
    process: null,
    status: "stopped",
  };
  const config = Object.values(services).map((s) => ({
    id: s.id,
    name: s.name,
    path: s.path,
    command: s.command,
  }));
  saveConfig(config);
  mainWindow.webContents.send("service-added", service);
});

ipcMain.on("remove-service", (event, id) => {
  console.log("IPC: remove-service", id);
  stopService(id);
  delete services[id];
  const config = Object.values(services).map((s) => ({
    id: s.id,
    name: s.name,
    path: s.path,
    command: s.command,
  }));
  saveConfig(config);
  mainWindow.webContents.send("service-removed", id);
});

ipcMain.on("reorder-services", (event, newOrderIds) => {
  console.log("IPC: reorder-services", newOrderIds);
  const newConfig = [];
  newOrderIds.forEach((id) => {
    if (services[id]) {
      newConfig.push({
        id: services[id].id,
        name: services[id].name,
        path: services[id].path,
        command: services[id].command,
      });
    }
  });

  // Rebuild services object to match new order (optional, but good for consistency)
  // Note: Object keys order isn't guaranteed in JS, but array order in config is what matters for next load
  saveConfig(newConfig);
});

// File system operations
ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle("get-subfolders", async (event, parentPath) => {
  try {
    if (!fs.existsSync(parentPath)) {
      return [];
    }

    const items = fs.readdirSync(parentPath, { withFileTypes: true });
    return items
      .filter((item) => item.isDirectory())
      .map((item) => ({
        name: item.name,
        path: path.join(parentPath, item.name),
        relativePath: path.relative(
          __dirname,
          path.join(parentPath, item.name)
        ),
      }));
  } catch (error) {
    console.error("Error reading subfolders:", error);
    return [];
  }
});

// Execute command in service directory
ipcMain.handle("execute-command", async (event, serviceId, command) => {
  const service = services[serviceId];
  if (!service) {
    return { success: false, output: "Service not found" };
  }

  return new Promise((resolve) => {
    try {
      const servicePath = path.resolve(__dirname, service.path);

      // Use spawn instead of execSync to avoid blocking
      const childProcess = spawn(command, {
        cwd: servicePath,
        windowsHide: true,
        shell: shellPath,
      });

      let output = "";
      let errorOutput = "";

      childProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      childProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      childProcess.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true, output: output.trim() });
        } else {
          resolve({ success: false, output: (errorOutput || output).trim() });
        }
      });

      childProcess.on("error", (error) => {
        resolve({ success: false, output: error.message });
      });

      // Set a timeout of 60 seconds
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill();
          resolve({
            success: false,
            output: "Command timed out after 60 seconds",
          });
        }
      }, 60000);
    } catch (error) {
      resolve({ success: false, output: error.message });
    }
  });
});

// Get git branch for a service
ipcMain.handle("get-git-branch", async (event, serviceId) => {
  const service = services[serviceId];
  if (!service) {
    return "N/A";
  }

  try {
    const servicePath = path.resolve(__dirname, service.path);

    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: servicePath,
      encoding: "utf8",
      windowsHide: true,
      shell: shellPath,
    });

    return branch.trim();
  } catch (error) {
    return "N/A";
  }
});

// Profile management IPC handlers
ipcMain.handle("get-profiles", () => {
  try {
    const files = fs.readdirSync(profilesDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch (error) {
    return ["default"];
  }
});

// Get service logs
ipcMain.handle("get-service-logs", async (event, serviceId) => {
  try {
    const logPath = path.join(logsDir, `${serviceId}.log`);
    if (fs.existsSync(logPath)) {
      // Read the file. If it's too large, we might want to truncate or stream,
      // but for now let's read the last 100KB to ensure UI responsiveness.
      // Or reading the whole file if requested.
      // Let's read the whole file for now as requested "fetch the logs of that file".
      // But adding a safety limit of 5MB.

      const stats = fs.statSync(logPath);
      if (stats.size > 5 * 1024 * 1024) {
        // Read last 5MB
        const buffer = Buffer.alloc(5 * 1024 * 1024);
        const fd = fs.openSync(logPath, "r");
        fs.readSync(fd, buffer, 0, buffer.length, stats.size - buffer.length);
        fs.closeSync(fd);
        return "--- Log truncated (showing last 5MB) ---\n" + buffer.toString();
      } else {
        return fs.readFileSync(logPath, "utf8");
      }
    }
    return "No logs found.";
  } catch (error) {
    console.error("Error reading logs:", error);
    return `Error reading logs: ${error.message}`;
  }
});

// Clear service logs
ipcMain.on("clear-service-logs", (event, serviceId) => {
  try {
    const logPath = path.join(logsDir, `${serviceId}.log`);
    if (fs.existsSync(logPath)) {
      // Truncate the file to empty it
      fs.truncateSync(logPath, 0);

      // If the service is running, we should also write a marker
      const service = services[serviceId];
      if (service && service.logStream) {
        service.logStream.write(
          `\n--- Logs cleared at ${new Date().toISOString()} ---\n`
        );
      }
    }
  } catch (error) {
    console.error("Error clearing logs:", error);
  }
});

// Update log configuration
ipcMain.on("update-log-config", (event, config) => {
  if (config && config.maxLogLines) {
    maxLogLines = config.maxLogLines;
    console.log("Updated max log lines to:", maxLogLines);
  }
});

ipcMain.handle("switch-profile", async (event, profileName) => {
  console.log("Switching to profile:", profileName);
  currentProfile = profileName;

  // Stop all services
  Object.keys(services).forEach((id) => stopService(id));

  // Clear services
  Object.keys(services).forEach((id) => delete services[id]);

  // Load new profile
  const profileData = loadConfig(profileName);
  const config = profileData.services || [];

  config.forEach((s) => {
    services[s.id] = {
      ...s,
      process: null,
      status: "stopped",
    };
  });

  // Return services and parent directory
  return {
    services: Object.values(services).map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      command: s.command,
      status: s.status,
    })),
    parentDir: profileData.parentDir || "",
  };
});

ipcMain.on("create-profile", (event, profileName, parentDir) => {
  console.log("Creating profile:", profileName, "with parent dir:", parentDir);
  const profilePath = path.join(profilesDir, `${profileName}.json`);
  if (!fs.existsSync(profilePath)) {
    const profileData = {
      parentDir: parentDir || "",
      services: [],
    };
    fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
  }
});

ipcMain.on("delete-profile", (event, profileName) => {
  console.log("Deleting profile:", profileName);
  if (profileName !== "default") {
    const profilePath = path.join(profilesDir, `${profileName}.json`);
    if (fs.existsSync(profilePath)) {
      fs.unlinkSync(profilePath);
    }
  }
});

ipcMain.handle("update-profile-root", async (event, profileName, parentDir) => {
  console.log("Updating profile root:", profileName, "to", parentDir);
  try {
    const profilePath = path.join(profilesDir, `${profileName}.json`);
    if (fs.existsSync(profilePath)) {
      const data = fs.readFileSync(profilePath, "utf8");
      const profileData = JSON.parse(data);
      profileData.parentDir = parentDir;
      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
      return { success: true };
    }
    return { success: false, error: "Profile not found" };
  } catch (error) {
    console.error("Error updating profile root:", error);
    return { success: false, error: error.message };
  }
});
