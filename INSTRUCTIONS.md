# User Instructions

## Before You Start

### System Requirements

| Requirement | Description |
|-------------|-------------|
| **Node.js** | Version 16 or higher ([Download](https://nodejs.org/)) |
| **Git Bash** | Recommended for Windows - provides Unix shell commands ([Download](https://git-scm.com/download/win)) |

> **Important**: This app uses **Git Bash** as the default terminal shell. If Git Bash is not installed, it falls back to PowerShell, which may have compatibility issues with some commands.

### Verifying Installation

Open a terminal and run:
```bash
node --version   # Should show v16.x or higher
git --version    # Should show git version
```

---

## Getting Started

1. Launch the Service Panel Pro application
2. On first run, you'll be asked to select a **parent directory** containing your projects
3. The app will scan this directory for available service folders

---

## Managing Services

### Starting and Stopping

| Button | Action |
|--------|--------|
| **▶ Start** | Launch the service using its configured command |
| **■ Stop** | Terminate the running process |
| **↻ Restart** | Stop and immediately start again |
| **🗑** | Remove service from the panel |

**Sidebar Controls**: Use "Start All", "Stop All", or "Restart All" to control all services at once.

### Viewing Logs

- Each service card shows a **terminal window** with live output
- Logs are **auto-trimmed** to 500 lines to prevent memory issues
- **Smart scroll**: If you scroll up to read old logs, new logs won't force you to the bottom
- A **"New Logs"** indicator appears when new logs arrive while you're scrolled up
- Click **Clear** to empty the log window

### Expanding/Collapsing Cards

- Click the **chevron (▼)** icon to expand the terminal view
- The terminal height is configurable in Settings

---

## Git Integration

### Git Pull

- **Single Service**: Click the **Git Pull** button on any service card
- **All Services**: Click **Git Pull All** in the sidebar

The app will show pull output in the service's terminal window.

### Branch Display

Each service card shows the current Git branch next to **Branch:** in the terminal header.

---

## Using Profiles

Profiles let you manage multiple project setups (e.g., Development, Staging, Production).

### Creating a Profile

1. Click **+ Manage Profiles** in the sidebar
2. Enter a **profile name**
3. Click **Browse** to select the parent directory for this profile
4. Click **Create Profile**

### Switching Profiles

Use the **Profile** dropdown in the sidebar to switch between profiles. Each profile maintains its own:
- Root directory
- List of services
- Service order

### Deleting a Profile

1. Open **Manage Profiles**
2. Select the profile from the delete dropdown
3. Click **Delete** and confirm

> **Note**: The "default" profile cannot be deleted.

---

## Adding a Service

1. Click **Add Service** in the sidebar
2. Enter a **name** for the service (e.g., "API Server")
3. Select a **folder** from the dropdown (shows folders in your parent directory)
4. Enter the **start command** (default: `npm start`)
5. Click **Add Service**

---

## Customizing the Terminal

1. Click **⚙ Settings** in the sidebar
2. Adjust:
   - **Font Size**: 10px - 24px
   - **Expanded Height**: 200px - 800px
   - **Font Family**: Consolas, Courier New, Monaco
   - **Text Color**: Pick any color
   - **Background Color**: Pick any color
3. Click **Done**

Settings are saved automatically and persist across restarts.

---

## Drag & Drop Reordering

1. Hover over the **⋮⋮** drag handle on the left of any service card
2. Drag and drop to reorder your services
3. The new order is saved automatically

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"npm" or commands not found** | Install Git Bash and restart the app |
| **Service won't start** | Check the terminal for error messages |
| **Path not found** | Verify the service folder exists in your parent directory |
| **Process still running after close** | The app force-terminates all processes on exit |
| **App feels slow** | The UI is lightweight; check if services are outputting too much |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Enter** | Execute command in the terminal input |
| **Tab** | Navigate between inputs |

---

## Support

For issues or feature requests, please create an issue in the project repository.
