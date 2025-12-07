# Build Instructions

## Prerequisites

- Node.js and npm installed
- All dependencies installed (`npm install`)

## Building the Application

### For Windows (Portable .exe)

```bash
npm run build:win
```

This will create a portable executable in the `dist` folder that doesn't require installation.

### For macOS (DMG)

```bash
npm run build:mac
```

### For Linux (AppImage)

```bash
npm run build:linux
```

### Build for All Platforms

```bash
npm run build
```

## Output

The built application will be in the `dist` folder.

## Notes

- **Windows**: Creates a portable `.exe` file (no installation needed)
- **First Build**: May take longer as it downloads platform-specific binaries
- **Icon**: To add a custom icon, create an `icon.ico` file in the project root

## Troubleshooting

### Code Signing Error (Windows)

If you see code signing errors, this is normal for development builds. The portable build will still work fine.

### Missing Dependencies

If the build fails, make sure all dependencies are installed:

```bash
npm install
```

### Large Build Size

The first build includes Electron runtime. Subsequent builds will be faster.
