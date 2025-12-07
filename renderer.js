// Application state
const app = {
  services: {},
  expandedService: null,
  parentDirectory: "",
  availableFolders: [],
  logSettings: {
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    textColor: "#00ff00",
    bgColor: "#000000",
    expandedHeight: 300,
  },

  // Initialize the app
  async init() {
    console.log("Initializing app...");

    // Load log settings from localStorage
    this.loadLogSettings();

    // Set up event listeners
    window.electronAPI.onInitServices((data) => {
      console.log("Received init-services:", data);
      this.loadServices(data.services);
      if (data.parentDir) {
        this.parentDirectory = data.parentDir;
        localStorage.setItem("parentDirectory", data.parentDir);
        this.updateProfileRootDisplay();
        // Load folders
        this.loadAvailableFolders();
      }
    });

    // Fallback: force hide splash after 5 seconds if not hidden
    setTimeout(() => {
      const splash = document.getElementById("splash-screen");
      if (splash && splash.style.display !== "none") {
        console.log("Force hiding splash screen due to timeout");
        splash.style.opacity = "0";
        setTimeout(() => {
          splash.style.display = "none";
        }, 700);
      }
    }, 5000);

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

    console.log("Services rendered, hiding splash screen");

    // Immediately update and hide splash screen
    const splashStatus = document.getElementById("splash-status");
    if (splashStatus) {
      splashStatus.textContent = "Ready!";
    }

    const splash = document.getElementById("splash-screen");
    if (splash) {
      // Force hide immediately with minimal delay
      splash.style.opacity = "0";
      setTimeout(() => {
        splash.style.display = "none";
        console.log("Splash screen hidden");
      }, 300);
    } else {
      console.error("splash-screen element not found!");
    }
  },

  // Render a single service card
  renderService(service) {
    const container = document.getElementById("services-container");
    const card = document.createElement("div");
    card.id = `service-${service.id}`;
    card.dataset.serviceId = service.id;
    card.className =
      "service-card rounded-xl p-5 text-white flex flex-col h-full transition-all duration-300";

    // Card is NOT draggable by default
    card.draggable = false;

    const statusClass =
      service.status === "running"
        ? "bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30"
        : "bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30";
    const statusText = service.status === "running" ? "Running" : "Stopped";
    const pidDisplay = service.pid ? `PID: ${service.pid}` : "";
    const pulseClass = service.status === "running" ? "running" : "";

    card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <!-- Drag Handle -->
                    <button class="drag-handle p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors cursor-move flex-shrink-0" draggable="true" title="Drag to reorder">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                        </svg>
                    </button>
                    
                    <div class="p-2 rounded-lg bg-gray-700 bg-opacity-50">
                        <span class="text-xl">📦</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <input type="text" value="${service.name}" 
                               onblur="app.updateService('${service.id}', 'name', this.value)"
                               class="text-lg font-bold bg-transparent border-none text-white focus:outline-none focus:ring-0 px-0 w-full truncate"
                               title="${service.name}">
                        <div class="flex items-center gap-2">
                            <span id="status-${service.id}" class="status-badge ${pulseClass} px-2 py-0.5 border rounded text-xs font-medium uppercase tracking-wide ${statusClass}">
                                ${statusText}
                            </span>
                            <span id="pid-${service.id}" class="text-xs text-gray-500 font-mono">${pidDisplay}</span>
                        </div>
                    </div>
                </div>
                <button onclick="app.toggleExpand('${service.id}')" id="expand-icon-${service.id}" class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
            
            <div class="space-y-3 mb-4 flex-1">
                <div>
                    <label class="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Path</label>
                    <select id="path-select-${service.id}" 
                           onchange="app.updateService('${service.id}', 'path', this.value)"
                           class="w-full px-3 py-2 rounded bg-gray-800 text-gray-300 border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm">
                        <option value="${service.path}">${service.path}</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Start Command</label>
                    <input type="text" value="${service.command}"
                           onblur="app.updateService('${service.id}', 'command', this.value)"
                           class="w-full px-3 py-2 rounded bg-gray-800 text-gray-300 border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-mono">
                </div>
            </div>
            
            <div class="grid grid-cols-4 gap-2 mb-4">
                <button onclick="app.start('${service.id}')" class="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors shadow-sm">Start</button>
                <button onclick="app.stop('${service.id}')" class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors shadow-sm">Stop</button>
                <button onclick="app.restart('${service.id}')" class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors shadow-sm">Restart</button>
                <button onclick="app.remove('${service.id}')" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-sm font-medium transition-colors shadow-sm">🗑️</button>
            </div>

            <!-- Git Actions -->
            <div class="mb-4">
                 <button onclick="app.gitPullService('${service.id}')" class="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Git Pull
                </button>
            </div>
            
            <!-- Git Info and Terminal -->
            <div class="bg-black rounded-lg overflow-hidden border border-gray-700 flex flex-col transition-all duration-300" style="height: 256px;" id="terminal-container-${service.id}">
                <div class="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-400">Branch:</span>
                        <span id="git-branch-${service.id}" class="text-xs font-mono">Loading...</span>
                    </div>
                    <div class="flex gap-2">
                         <button onclick="app.clearLog('${service.id}')" class="text-xs text-gray-500 hover:text-white transition-colors">Clear</button>
                    </div>
                </div>
                
                <div class="log-container flex-1 p-3 overflow-y-auto text-xs" 
                     id="log-${service.id}" 
                     style="font-family: ${this.logSettings.fontFamily}; font-size: ${this.logSettings.fontSize}px; color: ${this.logSettings.textColor}; background-color: ${this.logSettings.bgColor};">
> Ready
</div>
                
                <div class="p-2 bg-gray-800 border-t border-gray-700">
                    <div class="flex gap-2">
                        <span class="text-gray-500 select-none">$</span>
                        <input type="text" 
                               id="command-input-${service.id}"
                               placeholder="Type command..."
                               class="flex-1 bg-transparent border-none text-white text-sm focus:ring-0 p-0 font-mono"
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
      const statusClass =
        status === "running"
          ? "bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30"
          : "bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30";
      const statusText = status === "running" ? "Running" : "Stopped";
      const pulseClass = status === "running" ? "running" : "";

      badge.className = `status-badge ${pulseClass} px-2 py-0.5 border rounded text-xs font-medium uppercase tracking-wide ${statusClass}`;
      badge.textContent = statusText;
    }

    if (pidElement) {
      pidElement.textContent = pid ? `PID: ${pid}` : "";
    }

    if (this.services[id]) {
      this.services[id].status = status;
      this.services[id].pid = pid;
    }
  },

  // Append log to service
  appendLog(id, log) {
    const logElement = document.getElementById(`log-${id}`);
    if (logElement) {
      const cleanLog = this.stripAnsiCodes(log);
      const span = document.createElement("span");
      span.textContent = cleanLog;
      logElement.appendChild(span);
      logElement.scrollTop = logElement.scrollHeight;
    }
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
      output.innerHTML += `\n> Executing: git pull\n`;
      output.scrollTop = output.scrollHeight;
    }

    const result = await window.electronAPI.executeCommand(id, "git pull");

    if (output) {
      if (result.success) {
        output.innerHTML += result.output + "\n";
      } else {
        output.innerHTML += "Error: " + result.output + "\n";
      }
      output.scrollTop = output.scrollHeight;
    }
  },

  async executeCommand(serviceId) {
    const input = document.getElementById(`command-input-${serviceId}`);
    const log = document.getElementById(`log-${serviceId}`);
    const command = input.value.trim();
    if (!command) return;

    log.innerHTML += `\n> ${command}\n`;
    const result = await window.electronAPI.executeCommand(serviceId, command);

    if (result.success) {
      log.innerHTML += result.output + "\n";
    } else {
      log.innerHTML += "Error: " + result.output + "\n";
    }
    log.scrollTop = log.scrollHeight;
    input.value = "";
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
