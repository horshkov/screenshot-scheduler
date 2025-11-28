# Screenshot Scheduler Service

A Node.js service that automatically takes screenshots of a website at a specific time each day.

## Features

- **Web UI** for easy scheduling with timezone selector
- Schedule screenshots at exact times with any timezone
- Automatically saves screenshots to your Desktop
- Configurable viewport size and screenshot options
- Full page or viewport-only capture
- Auto-language switching (EN)
- Auto-exchange selection (Upbit KRW)
- Timestamp overlay on screenshots
- REST API for programmatic scheduling
- Test mode for immediate screenshot capture

## Installation

```bash
cd screenshot-scheduler
npm install
```

## Configuration

The service is pre-configured with these defaults:
- URL: `https://kimpga.com/`
- Time: `12:00:00` (12:00 PM daily)
- Screenshot path: `~/Desktop/screenshots/`
- Viewport: 1920x1080 (laptop screen size)
- Capture mode: Viewport only (visible area)
- Quality: High resolution (2x device scale factor for crisp text)
- Auto-language: Automatically switches to English (EN) before capturing
- Auto-scroll: Half viewport scroll down (shows balanced top and middle content)
- Base Exchange: Automatically set to Upbit KRW
- Timestamp Overlay: Shows exact capture time on the right side of the screenshot

To customize settings, edit the `config` object in `index.js`:

```javascript
const config = {
  url: 'https://kimpga.com/',
  scheduledTime: '12:00:00', // Format: HH:MM:SS (24-hour)
  screenshotPath: join(process.env.HOME, 'Desktop', 'screenshots'),
  viewport: { width: 1920, height: 1080 }, // Laptop screen size
  waitForNetworkIdle: false,
  fullPage: false, // Only capture visible viewport
  quality: 100, // PNG quality (0-100)
  scrollCount: 1, // Number of times to scroll down before screenshot
  scrollDelay: 500 // Delay in ms between scrolls
};
```

## Usage

### Option 1: Web UI (Recommended)

Start the web-based UI for easy screenshot scheduling:

```bash
npm run ui
```

Then open your browser to:
```
http://localhost:3000
```

The UI allows you to:
- Schedule screenshots at specific dates and times
- Select any timezone
- View scheduled jobs
- Cancel scheduled jobs
- View recent screenshots
- Take immediate screenshots

### Option 2: Command Line

### Start the Service (Daily Recurring)

```bash
npm start
```

The service will:
1. Calculate when the next scheduled time occurs
2. Wait until that exact time
3. Take a screenshot and save it to the screenshots folder
4. Automatically schedule the next screenshot for 24 hours later

### Schedule at Specific Time (One-time)

To schedule a screenshot at a specific date and time:

```bash
node index.js --at "2025-11-28T13:36:00+08:00"
```

Format: `YYYY-MM-DDTHH:MM:SS+08:00` (Hong Kong timezone: +08:00)

Examples:
```bash
# Today at 2:30 PM Hong Kong time
node index.js --at "2025-11-28T14:30:00+08:00"

# Tomorrow at 10:00 AM Hong Kong time
node index.js --at "2025-11-29T10:00:00+08:00"

# Specific date and time
node index.js --at "2025-12-01T12:00:00+08:00"
```

The service will:
- Schedule the screenshot for the exact time specified
- Wait until that time
- Take the screenshot
- Exit after completion

### Test Mode

To take an immediate screenshot and verify everything works:

```bash
npm test
```

This will:
- Take a screenshot immediately
- Save it to the screenshots folder
- Exit after completion

### Screenshot Files

Screenshots are saved with timestamps in the filename:
```
screenshot-2025-11-28T12-00-00-123Z.png
```

## Running as a Background Service

### macOS/Linux

To keep the service running continuously:

```bash
# Using nohup
nohup npm start > screenshot-scheduler.log 2>&1 &

# Or using screen
screen -dmS screenshot npm start

# View the screen session
screen -r screenshot
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the service
pm2 start index.js --name screenshot-scheduler

# View logs
pm2 logs screenshot-scheduler

# Stop the service
pm2 stop screenshot-scheduler

# Start on system boot
pm2 startup
pm2 save
```

## Troubleshooting

### Screenshots folder not created
The service automatically creates the `~/Desktop/screenshots` folder if it doesn't exist.

### Browser not found
Run `npx playwright install chromium` to install the required browser.

### Wrong time zone
The service uses your system's local time. Ensure your system time and timezone are set correctly.

### Network timeout
If the website takes too long to load, the default timeout is 60 seconds. Adjust the `timeout` parameter in the `page.goto()` call if needed.

## Stopping the Service

Press `Ctrl+C` in the terminal where the service is running, or if running in background:

```bash
# Find the process
ps aux | grep "node index.js"

# Kill the process
kill <PID>
```

## Requirements

- Node.js 14 or higher
- Playwright (installed via npm)
