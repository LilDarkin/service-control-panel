# User Instructions

## Getting Started

Launch the Service Panel Pro application to see all your configured microservices displayed as cards in a grid layout.

## Managing Services

### Starting and Stopping Services

- **Start**: Click the green **Start** button on any service card to launch it
- **Stop**: Click the red **Stop** button to terminate the process
- **Restart**: Click **Restart** to stop and immediately start the service again
- **Global Controls**: Use the top buttons to Start, Stop, or Restart **ALL** services at once

### Viewing Logs

#### Normal View

Each service card shows a small log window displaying the last few lines of output.

#### Expanded View

Click on the **service name** (at the top of the card) to expand it. The card will grow to span the full width and show a much larger log window. Click the service name again to collapse it back to normal size.

### Customizing Log Appearance

1. Click the **⚙️ Settings** button in the top-right corner
2. Adjust the following options:
   - **Font Size**: Use the slider to change from 10px to 20px
   - **Font Family**: Choose your preferred monospace font
   - **Text Color**: Select from various terminal-style colors
   - **Background Color**: Pick a background that suits your preference
3. Click anywhere outside the modal to close it
4. Your settings are automatically saved and will persist across app restarts

### Adding a Service

1. Click the **➕ Add Service** button
2. Enter the service name (e.g., "API Server")
3. Enter the path to the service directory (relative to the panel, e.g., "../my-api")
4. Enter the start command (e.g., "npm start")
5. The service will be added and saved to your configuration

### Editing a Service

You can edit the **Path** and **Command** fields directly in each service card. Changes are saved automatically when you click outside the input field.

### Removing a Service

Click the **🗑️** (trash) button on any service card. You'll be asked to confirm before the service is removed.

## Troubleshooting

- **Service won't start**: Check the logs for error messages and verify the path is correct
- **Logs not appearing**: The service might not be outputting to stdout/stderr
- **Settings not saving**: Check that the app has write permissions to the localStorage
