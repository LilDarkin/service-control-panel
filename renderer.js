// Application state
const app = {
  services: {},
  expandedService: null,
  parentDirectory: "",
  availableFolders: [],
  logsVisible: false, // Default: logs hidden for performance
  logSettings: {
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    textColor: "#00ff00",
    bgColor: "#000000",
    expandedHeight: 300,
    maxLogLines: 200, // Reduced for performance
  },

  // Initialize the app
  async init() {
    console.log("Initializing app...");

    // Load log settings from localStorage
    this.loadLogSettings();

    // Start splash screen animation
    this.startSplashAnimation();

    // Set up event listeners
    window.electronAPI.onInitServices((data) => {
      console.log("Received init-services:", data);
      // Mark services as ready but wait for splash to finish
      this.pendingServices = data;
    });

    window.electronAPI.onServiceStatus(({ id, status, pid }) => {
      console.log("Service status update:", id, status, pid);
      this.updateServiceStatus(id, status, pid);
    });

    window.electronAPI.onServiceLog(({ id, log }) => {
      this.appendLog(id, log);
    });

    window.electronAPI.onServiceAdded((service) => {
      console.log("Service added:", service);
      this.services[service.id] = service;
      this.renderService(service);
    });

    window.electronAPI.onServiceRemoved((id) => {
      console.log("Service removed:", id);
      delete this.services[id];
      this.removeServiceCard(id);
    });

    console.log("App initialized, waiting for services...");

    // Load available profiles
    this.loadProfiles();
  },

  // Splash screen animation with 3-second display
  pendingServices: null,
  splashMessages: [
    "Initializing systems...",
    "Loading configurations...",
    "Preparing workspace...",
    "Starting engines...",
    "Almost ready..."
  ],

  startSplashAnimation() {
    const progressBar = document.getElementById("splash-progress");
    const statusText = document.getElementById("splash-status");
    const splash = document.getElementById("splash-screen");
    
    const splashDuration = 3000; // 3 seconds
    const startTime = Date.now();
    let messageIndex = 0;

    // Animate progress bar
    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / splashDuration) * 100, 100);
      
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }

      // Update status message at intervals
      const newMessageIndex = Math.floor((elapsed / splashDuration) * this.splashMessages.length);
      if (newMessageIndex !== messageIndex && newMessageIndex < this.splashMessages.length) {
        messageIndex = newMessageIndex;
        if (statusText) {
          statusText.textContent = this.splashMessages[messageIndex];
        }
      }

      if (elapsed < splashDuration) {
        requestAnimationFrame(animateProgress);
      } else {
        // Splash duration complete
        this.finishSplash();
      }
    };

    requestAnimationFrame(animateProgress);
  },

  finishSplash() {
    const splash = document.getElementById("splash-screen");
    const statusText = document.getElementById("splash-status");
    const progressBar = document.getElementById("splash-progress");

    // Set final state
    if (progressBar) progressBar.style.width = "100%";
    if (statusText) statusText.textContent = "Ready!";

    // Load services if received
    if (this.pendingServices) {
      this.loadServices(this.pendingServices.services);
      if (this.pendingServices.parentDir) {
        this.parentDirectory = this.pendingServices.parentDir;
        localStorage.setItem("parentDirectory", this.pendingServices.parentDir);
        this.updateProfileRootDisplay();
        this.loadAvailableFolders();
      }
      this.pendingServices = null;
    }

    // Fade out splash with animation
    setTimeout(() => {
      if (splash) {
        splash.classList.add("fade-out");
        setTimeout(() => {
          splash.style.display = "none";
          console.log("Splash screen hidden");
        }, 700);
      }
    }, 300);
  },

  // Load and render all services
  loadServices(services) {
    console.log("Loading services:", services);

    const container = document.getElementById("services-container");
    if (!container) {
      console.error("services-container not found!");
      return;
    }

    container.innerHTML = "";

    services.forEach((service) => {
      this.services[service.id] = service;
      this.renderService(service);
    });

    console.log("Services rendered:", services.length);
  },

  // Render a single service card
  renderService(service) {
    const container = document.getElementById("services-container");
    const card = document.createElement("div");
    card.id = `service-${service.id}`;
    card.dataset.serviceId = service.id;
    card.className = "service-card rounded-lg p-4 text-white flex flex-col h-full";

    // Card is NOT draggable by default
    card.draggable = false;

    const isRunning = service.status === "running";
    const statusClass = isRunning
      ? "bg-green-900 text-green-400 border-green-700"
      : "bg-red-900 text-red-400 border-red-700";
    const statusText = isRunning ? "Running" : "Stopped";
    const pidDisplay = service.pid ? `PID: ${service.pid}` : "";
    const pulseClass = isRunning ? "running" : "";
    const dotColor = isRunning ? "bg-green-400" : "bg-red-400";

    card.innerHTML = `
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <!-- Drag Handle -->
          <button class="drag-handle p-1 hover:bg-dark-700 rounded text-dark-500 hover:text-white cursor-move flex-shrink-0" draggable="true" title="Drag to reorder">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
          </button>
          
          <div class="flex-1 min-w-0">
            <input type="text" value="${service.name}" 
                   onblur="app.updateService('${service.id}', 'name', this.value)"
                   class="text-sm font-semibold bg-transparent border-none text-white focus:outline-none px-0 w-full truncate"
                   title="${service.name}">
            <div class="flex items-center gap-2 mt-0.5">
              <span id="status-${service.id}" class="status-badge ${pulseClass} inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-[10px] font-medium uppercase ${statusClass}">
                <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
                ${statusText}
              </span>
              <span id="pid-${service.id}" class="text-[10px] text-dark-500 font-mono">${pidDisplay}</span>
            </div>
          </div>
        </div>
        <button onclick="app.toggleExpand('${service.id}')" id="expand-icon-${service.id}" class="p-1 hover:bg-dark-700 rounded text-dark-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      <div class="space-y-2 mb-3 flex-1">
        <div>
          <label class="text-[10px] text-dark-500 uppercase font-medium mb-1 block">Path</label>
          <select id="path-select-${service.id}" 
                  onchange="app.updateService('${service.id}', 'path', this.value)"
                  class="input-field w-full px-2 py-1.5 rounded bg-dark-900 text-dark-300 border border-dark-700 text-xs">
            <option value="${service.path}">${service.path}</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] text-dark-500 uppercase font-medium mb-1 block">Command</label>
          <input type="text" value="${service.command}"
                 onblur="app.updateService('${service.id}', 'command', this.value)"
                 class="input-field w-full px-2 py-1.5 rounded bg-dark-900 text-dark-300 border border-dark-700 text-xs font-mono">
        </div>
      </div>
      
      <div class="flex gap-1.5 mb-3">
        <button onclick="app.start('${service.id}')" class="btn flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium">
          ▶ Start
        </button>
        <button onclick="app.stop('${service.id}')" class="btn flex-1 px-2 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium">
          ■ Stop
        </button>
        <button onclick="app.restart('${service.id}')" class="btn flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium">
          ↻ Restart
        </button>
        <button onclick="app.remove('${service.id}')" class="btn px-2 py-1.5 bg-dark-700 hover:bg-dark-600 text-dark-400 hover:text-white rounded text-xs">
          🗑
        </button>
      </div>

      <!-- Git Pull + Toggle Logs -->
      <div class="flex gap-1.5 mb-3">
        <button onclick="app.gitPullService('${service.id}')" class="btn flex-1 px-2 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium flex items-center justify-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Git Pull
        </button>
        <button onclick="app.toggleServiceLog('${service.id}')" id="toggle-log-btn-${service.id}" class="btn px-2 py-1.5 bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-white rounded text-xs flex items-center gap-1">
          <span id="toggle-log-icon-${service.id}">${this.logsVisible ? '📋' : '📄'}</span>
          <span id="toggle-log-text-${service.id}">${this.logsVisible ? 'Hide' : 'Show'}</span>
        </button>
      </div>
      
      <!-- Terminal (hidden by default) -->
      <div class="rounded overflow-hidden border border-dark-700 flex flex-col bg-dark-950" style="height: 200px; ${this.logsVisible ? '' : 'display: none;'}" id="terminal-container-${service.id}">
        <div class="bg-dark-800 px-2 py-1.5 flex items-center justify-between border-b border-dark-700">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-dark-500">Branch:</span>
            <span id="git-branch-${service.id}" class="text-[10px] font-mono text-blue-400">Loading...</span>
          </div>
          <button onclick="app.clearLog('${service.id}')" class="text-[10px] text-dark-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-dark-700">Clear</button>
        </div>
        
        <div class="log-container flex-1 p-2 overflow-y-auto text-xs" 
             id="log-${service.id}" 
             style="font-family: ${this.logSettings.fontFamily}; font-size: ${this.logSettings.fontSize}px; color: ${this.logSettings.textColor}; background-color: ${this.logSettings.bgColor};">
> Ready
</div>
        
        <div class="px-2 py-1.5 bg-dark-800 border-t border-dark-700">
          <div class="flex gap-2 items-center">
            <span class="text-dark-500 text-xs select-none">$</span>
            <input type="text" 
                   id="command-input-${service.id}"
                   placeholder="Enter command..."
                   class="flex-1 bg-transparent border-none text-white text-xs focus:outline-none p-0 font-mono"
                   onkeypress="if(event.key === 'Enter') app.executeCommand('${service.id}')">
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);

    // Attach drag events to the drag handle only
    const dragHandle = card.querySelector(".drag-handle");
    if (dragHandle) {
      dragHandle.addEventListener("dragstart", this.handleDragStart.bind(this));
    }

    // Attach drop events to the card
    card.addEventListener("dragover", this.handleDragOver.bind(this));
    card.addEventListener("drop", this.handleDrop.bind(this));
    card.addEventListener("dragenter", this.handleDragEnter.bind(this));
    card.addEventListener("dragleave", this.handleDragLeave.bind(this));

    this.loadGitBranch(service.id);
    this.updatePathDropdown(service.id);

    // Add scroll listener to hide "new logs" indicator when user scrolls to bottom
    const logElement = document.getElementById(`log-${service.id}`);
    if (logElement) {
      logElement.addEventListener("scroll", () => {
        const isNearBottom = logElement.scrollHeight - logElement.scrollTop - logElement.clientHeight < 50;
        if (isNearBottom) {
          this.hideNewLogsIndicator(service.id);
        }
      });
    }
  },

  // Drag and Drop Handlers
  dragSrcEl: null,

  handleDragStart(e) {
    // Get the service card from the drag handle
    this.dragSrcEl = e.target.closest(".service-card");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", this.dragSrcEl.dataset.serviceId);
    this.dragSrcEl.classList.add("opacity-50");
  },

  handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = "move";
    return false;
  },

  handleDragEnter(e) {
    const card = e.target.closest(".service-card");
    if (card && card !== this.dragSrcEl) {
      card.classList.add("border-indigo-500", "border-2");
    }
  },

  handleDragLeave(e) {
    const card = e.target.closest(".service-card");
    if (card) {
      card.classList.remove("border-indigo-500", "border-2");
    }
  },

  handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }

    const destCard = e.target.closest(".service-card");
    if (this.dragSrcEl && destCard && this.dragSrcEl !== destCard) {
      const container = document.getElementById("services-container");
      const cards = Array.from(container.children);
      const srcIndex = cards.indexOf(this.dragSrcEl);
      const destIndex = cards.indexOf(destCard);

      if (srcIndex < destIndex) {
        destCard.after(this.dragSrcEl);
      } else {
        destCard.before(this.dragSrcEl);
      }

      // Update order
      const newOrderIds = Array.from(container.children).map(
        (card) => card.dataset.serviceId
      );
      window.electronAPI.send("reorder-services", newOrderIds);
    }

    this.dragSrcEl.classList.remove("opacity-50");
    document.querySelectorAll(".service-card").forEach((card) => {
      card.classList.remove("border-indigo-500", "border-2");
    });

    return false;
  },

  // Update service status
  updateServiceStatus(id, status, pid) {
    const badge = document.getElementById(`status-${id}`);
    const pidElement = document.getElementById(`pid-${id}`);

    if (badge) {
      const isRunning = status === "running";
      const statusClass = isRunning
        ? "bg-green-900 text-green-400 border-green-700"
        : "bg-red-900 text-red-400 border-red-700";
      const statusText = isRunning ? "Running" : "Stopped";
      const pulseClass = isRunning ? "running" : "";
      const dotColor = isRunning ? "bg-green-400" : "bg-red-400";

      badge.className = `status-badge ${pulseClass} inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-[10px] font-medium uppercase ${statusClass}`;
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>${statusText}`;
    }

    if (pidElement) {
      pidElement.textContent = pid ? `PID: ${pid}` : "";
    }

    if (this.services[id]) {
      this.services[id].status = status;
      this.services[id].pid = pid;
    }
  },

  // Log buffer for throttled updates
  logBuffer: {},
  logFlushTimer: null,

  // Append log to service (buffered for performance)
  appendLog(id, log) {
    // Buffer the log
    if (!this.logBuffer[id]) {
      this.logBuffer[id] = [];
    }
    this.logBuffer[id].push(log);
    
    // Schedule flush if not already scheduled
    if (!this.logFlushTimer) {
      this.logFlushTimer = setTimeout(() => {
        this.flushLogs();
        this.logFlushTimer = null;
      }, 100); // Flush every 100ms
    }
  },

  // Flush all buffered logs to DOM
  flushLogs() {
    requestAnimationFrame(() => {
      Object.keys(this.logBuffer).forEach(id => {
        const logs = this.logBuffer[id];
        if (!logs || logs.length === 0) return;
        
        const logElement = document.getElementById(`log-${id}`);
        const terminal = document.getElementById(`terminal-container-${id}`);
        
        // Skip if terminal is hidden (huge performance gain)
        if (terminal && terminal.style.display === "none") {
          this.logBuffer[id] = []; // Clear buffer but don't render
          return;
        }
        
        if (logElement) {
          // Batch all logs into one text node
          const combinedLog = logs.map(l => this.stripAnsiCodes(l)).join('');
          const span = document.createElement("span");
          span.textContent = combinedLog;
          
          const isNearBottom = logElement.scrollHeight - logElement.scrollTop - logElement.clientHeight < 50;
          
          logElement.appendChild(span);
          this.trimLogIfNeeded(logElement);
          
          if (isNearBottom) {
            logElement.scrollTop = logElement.scrollHeight;
            this.hideNewLogsIndicator(id);
          } else {
            this.showNewLogsIndicator(id);
          }
        }
        
        // Clear buffer for this service
        this.logBuffer[id] = [];
      });
    });
  },

  // Trim log container to max lines to prevent memory issues
  trimLogIfNeeded(logElement) {
    const maxLines = this.logSettings.maxLogLines || 1000;
    const children = logElement.children;
    
    // Remove oldest entries if we exceed max
    while (children.length > maxLines) {
      logElement.removeChild(children[0]);
    }
  },

  // Show indicator that new logs are available
  showNewLogsIndicator(id) {
    const terminalContainer = document.getElementById(`terminal-container-${id}`);
    if (!terminalContainer) return;

    // Check if indicator already exists
    let indicator = document.getElementById(`new-logs-${id}`);
    if (!indicator) {
      indicator = document.createElement("button");
      indicator.id = `new-logs-${id}`;
      indicator.className = "new-logs-indicator absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1 rounded-full shadow-lg transition-all z-10";
      indicator.textContent = "↓ New logs";
      indicator.onclick = () => this.scrollToBottom(id);
      
      // Make terminal container relative for positioning
      terminalContainer.style.position = "relative";
      terminalContainer.appendChild(indicator);
    }
  },

  // Hide new logs indicator
  hideNewLogsIndicator(id) {
    const indicator = document.getElementById(`new-logs-${id}`);
    if (indicator) {
      indicator.remove();
    }
  },

  // Scroll log to bottom and hide indicator
  scrollToBottom(id) {
    const logElement = document.getElementById(`log-${id}`);
    if (logElement) {
      logElement.scrollTop = logElement.scrollHeight;
    }
    this.hideNewLogsIndicator(id);
  },

  clearLog(id) {
    const logElement = document.getElementById(`log-${id}`);
    if (logElement) {
      logElement.innerHTML = "> Cleared\n";
    }
  },

  // Remove service card
  removeServiceCard(id) {
    const card = document.getElementById(`service-${id}`);
    if (card) {
      card.remove();
    }
  },

  // Service controls
  start(id) {
    console.log("Starting service:", id);
    window.electronAPI.startService(id);
  },

  stop(id) {
    console.log("Stopping service:", id);
    window.electronAPI.stopService(id);
  },

  restart(id) {
    console.log("Restarting service:", id);
    window.electronAPI.restartService(id);
  },

  remove(id) {
    if (
      confirm(
        `Are you sure you want to remove service: ${this.services[id].name}?`
      )
    ) {
      console.log("Removing service:", id);
      window.electronAPI.removeService(id);
    }
  },

  // Global controls
  startAll() {
    console.log("Starting all services");
    window.electronAPI.startAll();
  },

  stopAll() {
    console.log("Stopping all services");
    window.electronAPI.stopAll();
  },

  restartAll() {
    console.log("Restarting all services");
    window.electronAPI.restartAll();
  },

  gitPullAll() {
    console.log("Git Pull All");
    Object.keys(this.services).forEach((id) => {
      this.gitPullService(id);
    });
  },

  async gitPullService(id) {
    console.log("Git Pull Service:", id);
    const output = document.getElementById(`log-${id}`);
    if (output) {
      const isNearBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 50;
      output.innerHTML += `\n> Executing: git pull\n`;
      if (isNearBottom) output.scrollTop = output.scrollHeight;
    }

    const result = await window.electronAPI.executeCommand(id, "git pull");

    if (output) {
      const isNearBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 50;
      if (result.success) {
        output.innerHTML += result.output + "\n";
      } else {
        output.innerHTML += "Error: " + result.output + "\n";
      }
      if (isNearBottom) {
        output.scrollTop = output.scrollHeight;
      } else {
        this.showNewLogsIndicator(id);
      }
    }
  },

  async executeCommand(serviceId) {
    const input = document.getElementById(`command-input-${serviceId}`);
    const log = document.getElementById(`log-${serviceId}`);
    const command = input.value.trim();
    if (!command) return;

    const isNearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 50;
    log.innerHTML += `\n> ${command}\n`;
    const result = await window.electronAPI.executeCommand(serviceId, command);

    if (result.success) {
      log.innerHTML += result.output + "\n";
    } else {
      log.innerHTML += "Error: " + result.output + "\n";
    }
    
    if (isNearBottom) {
      log.scrollTop = log.scrollHeight;
    } else {
      this.showNewLogsIndicator(serviceId);
    }
    input.value = "";
  },

  // Toggle all logs visibility
  toggleAllLogs() {
    this.logsVisible = !this.logsVisible;
    
    // Update button text
    const btnText = document.getElementById("toggle-all-logs-text");
    if (btnText) {
      btnText.textContent = this.logsVisible ? "Hide All Logs" : "Show All Logs";
    }
    
    // Toggle all service terminals
    Object.keys(this.services).forEach(id => {
      const terminal = document.getElementById(`terminal-container-${id}`);
      const icon = document.getElementById(`toggle-log-icon-${id}`);
      const text = document.getElementById(`toggle-log-text-${id}`);
      
      if (terminal) {
        terminal.style.display = this.logsVisible ? "flex" : "none";
      }
      if (icon) {
        icon.textContent = this.logsVisible ? "📋" : "📄";
      }
      if (text) {
        text.textContent = this.logsVisible ? "Hide" : "Show";
      }
    });
  },

  // Toggle individual service log visibility
  toggleServiceLog(id) {
    const terminal = document.getElementById(`terminal-container-${id}`);
    const icon = document.getElementById(`toggle-log-icon-${id}`);
    const text = document.getElementById(`toggle-log-text-${id}`);
    
    if (terminal) {
      const isVisible = terminal.style.display !== "none";
      terminal.style.display = isVisible ? "none" : "flex";
      
      if (icon) {
        icon.textContent = isVisible ? "📄" : "📋";
      }
      if (text) {
        text.textContent = isVisible ? "Show" : "Hide";
      }
    }
  },

  // Add new service
  addService() {
    // Show the add service modal
    const modal = document.getElementById("add-service-modal");
    if (modal) {
      modal.classList.remove("hidden");
      // Clear previous values
      document.getElementById("new-service-name").value = "";
      document.getElementById("new-service-command").value = "npm start";

      // Populate path dropdown from current profile's parent directory
      this.populateNewServicePathDropdown();
    }
  },

  async populateNewServicePathDropdown() {
    const select = document.getElementById("new-service-path");
    if (!select) return;

    // Reset dropdown
    select.innerHTML =
      '<option value="">Select folder from parent directory...</option>';

    // If we have a parent directory and available folders, populate dropdown
    if (this.availableFolders && this.availableFolders.length > 0) {
      this.availableFolders.forEach((folder) => {
        select.innerHTML += `<option value="${folder.path}">${folder.path}</option>`;
      });
    } else if (this.parentDirectory) {
      // Load folders if not already loaded
      await this.loadAvailableFolders();
      // Try again
      if (this.availableFolders && this.availableFolders.length > 0) {
        this.availableFolders.forEach((folder) => {
          select.innerHTML += `<option value="${folder.path}">${folder.path}</option>`;
        });
      }
    } else {
      // No parent directory set
      select.innerHTML +=
        '<option value="" disabled>No parent directory set for this profile</option>';
    }
  },

  saveNewService() {
    const name = document.getElementById("new-service-name").value.trim();
    const path = document.getElementById("new-service-path").value.trim();
    const command = document.getElementById("new-service-command").value.trim();

    if (!name) {
      document.getElementById("new-service-name").focus();
      return;
    }

    if (!path) {
      document.getElementById("new-service-path").focus();
      return;
    }

    if (!command) {
      document.getElementById("new-service-command").focus();
      return;
    }

    const service = {
      id: Date.now().toString(),
      name: name,
      path: path,
      command: command,
      status: "stopped",
    };

    console.log("Adding service:", service);
    window.electronAPI.addService(service);

    // Close modal
    document.getElementById("add-service-modal").classList.add("hidden");
  },

  cancelNewService() {
    document.getElementById("add-service-modal").classList.add("hidden");
  },

  // Profile management
  currentProfile: "default",

  async loadProfiles() {
    const profiles = await window.electronAPI.getProfiles();
    const select = document.getElementById("profile-select");
    if (select && profiles) {
      select.innerHTML = profiles
        .map(
          (p) =>
            `<option value="${p}" ${
              p === this.currentProfile ? "selected" : ""
            }>${p}</option>`
        )
        .join("");
    }
  },

  async switchProfile(profileName) {
    console.log("Switching to profile:", profileName);
    this.currentProfile = profileName;
    const result = await window.electronAPI.switchProfile(profileName);

    // result should include services and parentDir
    if (result) {
      this.loadServices(result.services);

      // Update parent directory
      if (result.parentDir) {
        this.parentDirectory = result.parentDir;
        localStorage.setItem("parentDirectory", result.parentDir);
        await this.loadAvailableFolders();
      } else {
        this.parentDirectory = "";
      }

      // Update profile root display
      this.updateProfileRootDisplay();
    }
  },

  updateProfileRootDisplay() {
    const display = document.getElementById("profile-root-display");
    if (display) {
      display.value = this.parentDirectory || "";
      display.title = this.parentDirectory || "No root folder set";
    }
  },

  async editProfileRoot() {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) {
      this.parentDirectory = dir;
      localStorage.setItem("parentDirectory", dir);

      // Update the profile's parent directory
      await window.electronAPI.updateProfileRoot(this.currentProfile, dir);

      // Reload folders and update display
      await this.loadAvailableFolders();
      this.updateProfileRootDisplay();
    }
  },

  manageProfiles() {
    const modal = document.getElementById("profile-modal");
    if (modal) {
      modal.classList.remove("hidden");
      // Populate delete dropdown
      this.updateProfileDeleteDropdown();
    }
  },

  async updateProfileDeleteDropdown() {
    const profiles = await window.electronAPI.getProfiles();
    const select = document.getElementById("delete-profile-select");
    if (select && profiles) {
      select.innerHTML =
        '<option value="">Select profile to delete...</option>';
      profiles.forEach((p) => {
        if (p !== "default") {
          select.innerHTML += `<option value="${p}">${p}</option>`;
        }
      });
    }
  },

  async createNewProfile() {
    const nameInput = document.getElementById("new-profile-name");
    const dirInput = document.getElementById("new-profile-parent-dir");
    const name = nameInput.value.trim();
    const parentDir = dirInput.value.trim();

    if (!name) {
      alert("Please enter a profile name");
      return;
    }

    if (!parentDir) {
      alert("Please select a parent directory");
      return;
    }

    console.log("Creating profile:", name, "with parent dir:", parentDir);
    await window.electronAPI.createProfile(name, parentDir);

    // Wait a bit then reload
    setTimeout(async () => {
      await this.loadProfiles();
      await this.updateProfileDeleteDropdown();
      nameInput.value = "";
      dirInput.value = "";
    }, 100);
  },

  async selectProfileParentDir() {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) {
      document.getElementById("new-profile-parent-dir").value = dir;
    }
  },

  async confirmDeleteProfile() {
    const select = document.getElementById("delete-profile-select");
    const name = select.value;

    if (!name) {
      return; // Just silently return if nothing selected
    }

    if (name === "default") {
      return; // Can't delete default
    }

    // Store the name for the actual delete
    this.profileToDelete = name;

    // Show custom confirmation modal
    const confirmModal = document.getElementById(
      "delete-profile-confirm-modal"
    );
    const profileNameSpan = document.getElementById("delete-profile-name");
    if (confirmModal && profileNameSpan) {
      profileNameSpan.textContent = name;
      confirmModal.classList.remove("hidden");
    }
  },

  async confirmDeleteProfileYes() {
    const name = this.profileToDelete;
    if (!name) return;

    console.log("Deleting profile:", name);
    window.electronAPI.deleteProfile(name);

    // If we're deleting the current profile, switch to default
    if (this.currentProfile === name) {
      this.switchProfile("default");
    }

    // Wait a bit then reload
    setTimeout(async () => {
      await this.loadProfiles();
      await this.updateProfileDeleteDropdown();
    }, 100);

    // Close both modals
    document
      .getElementById("delete-profile-confirm-modal")
      .classList.add("hidden");
    this.profileToDelete = null;
  },

  cancelDeleteProfile() {
    document
      .getElementById("delete-profile-confirm-modal")
      .classList.add("hidden");
    this.profileToDelete = null;
  },

  closeProfileModal() {
    document.getElementById("profile-modal").classList.add("hidden");
  },

  // Update service configuration
  updateService(id, field, value) {
    if (this.services[id]) {
      this.services[id][field] = value;
      console.log("Updating service:", id, field, value);
      window.electronAPI.updateService(this.services[id]);
    }
  },

  async loadGitBranch(id) {
    const branchElement = document.getElementById(`git-branch-${id}`);
    if (branchElement) {
      const branch = await window.electronAPI.getGitBranch(id);
      branchElement.textContent = branch;
    }
  },

  async selectDirectory() {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) {
      this.parentDirectory = dir;
      localStorage.setItem("parentDirectory", dir);
      const dirInput = document.getElementById("parent-directory");
      if (dirInput) dirInput.value = dir;
      await this.loadAvailableFolders();
    }
  },

  async loadAvailableFolders() {
    if (!this.parentDirectory) return;
    this.availableFolders = await window.electronAPI.getSubfolders(
      this.parentDirectory
    );
    Object.keys(this.services).forEach((id) => {
      this.updatePathDropdown(id);
    });
  },

  updatePathDropdown(id) {
    const select = document.getElementById(`path-select-${id}`);
    if (!select) return;

    const currentPath = this.services[id].path;
    select.innerHTML = `<option value="${currentPath}">${currentPath}</option>`;

    if (this.availableFolders && this.availableFolders.length > 0) {
      this.availableFolders.forEach((folder) => {
        if (folder.path !== currentPath) {
          select.innerHTML += `<option value="${folder.path}">${folder.path}</option>`;
        }
      });
    }
  },

  // Toggle expand/collapse for a service card
  toggleExpand(id) {
    const card = document.getElementById(`service-${id}`);
    const expandIcon = document.getElementById(`expand-icon-${id}`);
    const svg = expandIcon.querySelector("svg");
    const terminalContainer = document.getElementById(
      `terminal-container-${id}`
    );
    const isExpanded = card.classList.contains("md:col-span-2");

    if (isExpanded) {
      // Collapse
      card.classList.remove("md:col-span-2", "xl:col-span-3", "row-span-2");
      svg.classList.remove("rotate-180");
      terminalContainer.style.height = "256px"; // Default height
    } else {
      // Expand (allow multiple)
      card.classList.add("md:col-span-2", "xl:col-span-3", "row-span-2");
      svg.classList.add("rotate-180");
      terminalContainer.style.height = `${this.logSettings.expandedHeight}px`;
    }
  },

  expandAll() {
    Object.keys(this.services).forEach((id) => {
      const card = document.getElementById(`service-${id}`);
      if (!card.classList.contains("md:col-span-2")) {
        this.toggleExpand(id);
      }
    });
  },

  collapseAll() {
    Object.keys(this.services).forEach((id) => {
      const card = document.getElementById(`service-${id}`);
      if (card.classList.contains("md:col-span-2")) {
        this.toggleExpand(id);
      }
    });
  },

  // Toggle settings modal
  toggleSettings() {
    const modal = document.getElementById("settings-modal");
    modal.classList.toggle("hidden");
  },

  // Load log settings from localStorage
  loadLogSettings() {
    const saved = localStorage.getItem("logSettings");
    if (saved) {
      this.logSettings = JSON.parse(saved);
    }

    // Update UI controls
    const fontSizeInput = document.getElementById("log-font-size");
    if (fontSizeInput) fontSizeInput.value = this.logSettings.fontSize;

    const fontSizeValue = document.getElementById("font-size-value");
    if (fontSizeValue)
      fontSizeValue.textContent = this.logSettings.fontSize + "px";

    const logHeightInput = document.getElementById("log-height");
    if (logHeightInput) logHeightInput.value = this.logSettings.expandedHeight;

    const logHeightValue = document.getElementById("log-height-value");
    if (logHeightValue)
      logHeightValue.textContent = this.logSettings.expandedHeight + "px";

    const fontFamilyInput = document.getElementById("log-font-family");
    if (fontFamilyInput) fontFamilyInput.value = this.logSettings.fontFamily;

    const textColorInput = document.getElementById("log-text-color");
    if (textColorInput) textColorInput.value = this.logSettings.textColor;

    const bgColorInput = document.getElementById("log-bg-color");
    if (bgColorInput) bgColorInput.value = this.logSettings.bgColor;
  },

  // Update log settings
  updateLogSettings() {
    this.logSettings.fontSize = parseInt(
      document.getElementById("log-font-size").value
    );
    this.logSettings.fontFamily =
      document.getElementById("log-font-family").value;
    this.logSettings.textColor =
      document.getElementById("log-text-color").value;
    this.logSettings.bgColor = document.getElementById("log-bg-color").value;
    this.logSettings.expandedHeight = parseInt(
      document.getElementById("log-height").value
    );

    document.getElementById("font-size-value").textContent =
      this.logSettings.fontSize + "px";
    document.getElementById("log-height-value").textContent =
      this.logSettings.expandedHeight + "px";

    // Save to localStorage
    localStorage.setItem("logSettings", JSON.stringify(this.logSettings));

    // Apply to all log containers
    document.querySelectorAll(".log-container").forEach((log) => {
      log.style.fontFamily = this.logSettings.fontFamily;
      log.style.fontSize = this.logSettings.fontSize + "px";
      log.style.color = this.logSettings.textColor;
      log.style.backgroundColor = this.logSettings.bgColor;
    });

    // Apply height to expanded cards
    Object.keys(this.services).forEach((id) => {
      const card = document.getElementById(`service-${id}`);
      if (card && card.classList.contains("md:col-span-2")) {
        const terminal = document.getElementById(`terminal-container-${id}`);
        if (terminal)
          terminal.style.height = `${this.logSettings.expandedHeight}px`;
      }
    });
  },

  // Reset log settings to defaults
  resetLogSettings() {
    this.logSettings = {
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      textColor: "#00ff00",
      bgColor: "#000000",
      expandedHeight: 300,
    };

    localStorage.setItem("logSettings", JSON.stringify(this.logSettings));

    // Update UI controls
    document.getElementById("log-font-size").value = this.logSettings.fontSize;
    document.getElementById("font-size-value").textContent =
      this.logSettings.fontSize + "px";
    document.getElementById("log-font-family").value =
      this.logSettings.fontFamily;
    document.getElementById("log-text-color").value =
      this.logSettings.textColor;
    document.getElementById("log-bg-color").value = this.logSettings.bgColor;

    // Apply to all log containers
    this.updateLogSettings();
  },

  // Select parent directory
  async selectParentDirectory() {
    const directory = await window.electronAPI.selectDirectory();
    if (directory) {
      this.parentDirectory = directory;
      document.getElementById("parent-directory").value = directory;
      localStorage.setItem("parentDirectory", directory);

      // Load available folders
      await this.loadAvailableFolders();
    }
  },

  // Load available folders from parent directory
  async loadAvailableFolders() {
    if (!this.parentDirectory) return;

    this.availableFolders = await window.electronAPI.getSubfolders(
      this.parentDirectory
    );
    console.log("Available folders:", this.availableFolders);

    // Update all path dropdowns
    Object.keys(this.services).forEach((id) => {
      this.updatePathDropdown(id);
    });
  },

  // Update path dropdown for a service
  updatePathDropdown(serviceId) {
    const select = document.getElementById(`path-select-${serviceId}`);
    if (!select) return;

    const currentValue = select.value;

    // Clear and rebuild options
    select.innerHTML = "";

    // Add current value if it exists
    if (currentValue) {
      const option = document.createElement("option");
      option.value = currentValue;
      option.textContent = currentValue;
      select.appendChild(option);
    }

    // Add available folders
    this.availableFolders.forEach((folder) => {
      if (folder.path !== currentValue) {
        const option = document.createElement("option");
        option.value = folder.path;
        option.textContent = folder.path;
        select.appendChild(option);
      }
    });
  },

  // Execute command in service directory
  async executeCommand(serviceId) {
    const input = document.getElementById(`command-input-${serviceId}`);
    const output = document.getElementById(`log-${serviceId}`);
    const command = input.value.trim();

    if (!command) return;

    output.innerHTML += `\n> ${command}\n`;
    output.scrollTop = output.scrollHeight;

    const result = await window.electronAPI.executeCommand(serviceId, command);

    if (result.success) {
      output.innerHTML += result.output + "\n";

      // If it was a git command that might change branch, reload branch info
      if (command.includes("git checkout") || command.includes("git switch")) {
        this.loadGitBranch(serviceId);
      }
    } else {
      output.innerHTML += "Error: " + result.output + "\n";
    }

    input.value = "";
    output.scrollTop = output.scrollHeight;
  },

  // Load git branch for a service
  async loadGitBranch(serviceId) {
    const branchElement = document.getElementById(`git-branch-${serviceId}`);
    if (!branchElement) return;

    const branch = await window.electronAPI.getGitBranch(serviceId);
    branchElement.textContent = branch;

    // Color code the branch
    if (branch === "main" || branch === "master") {
      branchElement.className = "text-xs text-blue-400 font-mono";
    } else if (branch === "N/A") {
      branchElement.className = "text-xs text-gray-400 font-mono";
    } else {
      branchElement.className = "text-xs text-green-400 font-mono";
    }
  },

  // Strip ANSI color codes from log text
  stripAnsiCodes(text) {
    // ANSI escape code regex
    return text.replace(/\x1b\[[0-9;]*m/g, "");
  },
};

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing app");
  app.init();
});

// Expose app globally for onclick handlers
window.app = app;

console.log("Renderer script loaded");
