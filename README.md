# Service Panel Pro

A lightweight Electron-based control panel for managing multiple local microservices with real-time log viewing.

## Requirements

Before using this application, make sure you have the following installed:

### Required
- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

### Recommended
- **Git for Windows** with Git Bash - [Download](https://git-scm.com/download/win)
  - The app uses Git Bash as the default shell for running commands
  - Git Bash provides better Unix-like command support (e.g., `npm`, `node`, `yarn`)
  - If Git Bash is not found, the app falls back to PowerShell

### Shell Detection
The app automatically searches for Git Bash in these locations:
- `C:\Program Files\Git\bin\bash.exe`
- `C:\Program Files (x86)\Git\bin\bash.exe`

If Git Bash is not installed, the app will use PowerShell instead.

## Features

- **Centralized Control**: Start, stop, and restart all your services from one place
- **Real-time Logs**: View live logs for each service with smart auto-scroll
- **Multiple Profiles**: Create separate profiles for different project setups
- **Git Integration**: Pull latest changes for individual services or all at once
- **Drag & Drop Reorder**: Organize your service cards by dragging
- **Customizable Terminal**: Adjust font size, family, colors, and log height
- **Lightweight UI**: Optimized for performance on all hardware
- **Log Management**: Automatic log trimming (max 500 lines) to prevent memory issues

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Start the application:

```bash
npm start
```

### Managing Services

- **Start/Stop/Restart**: Click the respective buttons on each service card
- **Expand Logs**: Click the chevron icon to expand the terminal view
- **Global Controls**: Use sidebar buttons to control all services at once
- **Add Service**: Click "Add Service" and select a folder from your parent directory
- **Edit Config**: Modify the path or command directly in the input fields
- **Git Pull**: Pull latest changes for a single service or all services

### Using Profiles

1. Select a profile from the dropdown in the sidebar
2. Click "Manage Profiles" to create new profiles with different root directories
3. Each profile maintains its own set of services

### Customizing Terminal

1. Click the "⚙️ Settings" button in the sidebar
2. Adjust font size, font family, text/background colors
3. Settings are saved automatically to localStorage

## Project Structure

```
├── main.js        # Main Electron process (service management, IPC)
├── preload.js     # Security bridge for IPC communication
├── renderer.js    # Frontend logic and UI interactions
├── index.html     # UI structure with Tailwind CSS
├── package.json   # Project dependencies and scripts
└── profiles/      # Stored in userData - contains profile configurations
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Service won't start | Check logs for errors, verify the path exists |
| Commands not found | Install Git Bash for better shell support |
| App freezes | Logs are auto-trimmed, but restart if needed |
| Process still running after exit | App force-terminates processes on quit |

## Building

To build a distributable version:

```bash
npm run build
```

This creates installers in the `dist/` folder.
