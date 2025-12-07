# Service Panel Pro

A modern, Electron-based control panel for managing multiple local microservices with customizable log viewing.

## Features

- **Centralized Control**: Start, stop, and restart all your services from one place
- **Real-time Logs**: View live logs for each service directly in the UI
- **Expandable Cards**: Click on service names to expand and see logs in full width
- **Customizable Logs**: Adjust font size, font family, text color, and background color
- **Configurable**: Add, remove, and edit service configurations easily
- **Modern UI**: Gradient background with glassmorphism design

## Installation

1. Clone the repository
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
- **Expand Logs**: Click on the service name to expand the card and see logs in full width
- **Global Controls**: Use buttons at the top to control all services at once
- **Add Service**: Click "Add Service" and fill in the service details
- **Edit Config**: Modify the path or command directly in the input fields

### Customizing Logs

1. Click the "⚙️ Settings" button in the top-right corner
2. Adjust:
   - **Font Size**: 10-20px
   - **Font Family**: Choose from various monospace fonts
   - **Text Color**: Green, White, Cyan, Yellow, Magenta
   - **Background Color**: Black, Dark Gray, etc.
3. Settings are saved automatically to localStorage

## Project Structure

- `main.js`: Main Electron process (service management)
- `preload.js`: Security bridge for IPC
- `renderer.js`: Frontend logic
- `index.html`: UI structure with Tailwind CSS
