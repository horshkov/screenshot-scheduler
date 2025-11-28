#!/usr/bin/env node

/**
 * Robust Screenshot Scheduler with Multiple Safeguards
 * Takes screenshots at exact specified times with failsafe mechanisms
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  url: 'https://kimpga.com/',
  screenshotPath: join(process.env.HOME, 'Desktop', 'screenshots'),
  logPath: join(process.env.HOME, 'Desktop', 'screenshot-scheduler.log'),
  viewport: { width: 1920, height: 1080 },
  scrollCount: 1
};

/**
 * Enhanced logging that writes to both console and file
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(config.logPath, logMessage + '\n');
}

/**
 * Take screenshot with all configured settings
 */
async function takeScreenshot() {
  log('Starting screenshot capture...');

  let browser;
  try {
    // Ensure screenshots directory exists
    if (!fs.existsSync(config.screenshotPath)) {
      fs.mkdirSync(config.screenshotPath, { recursive: true });
      log(`Created screenshots directory: ${config.screenshotPath}`);
    }

    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    log(`Navigating to ${config.url}...`);

    // Navigate with retry logic
    try {
      await page.goto(config.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      log('First navigation attempt failed, retrying with basic load...');
      await page.goto(config.url, {
        waitUntil: 'load',
        timeout: 30000
      });
    }

    await page.waitForTimeout(2000);

    // Switch to English
    try {
      log('Switching to English language...');
      const krDropdown = await page.$('text=KR');
      if (krDropdown) {
        await krDropdown.click();
        await page.waitForTimeout(500);
        const enOption = await page.$('text=EN');
        if (enOption) {
          await enOption.click();
          await page.waitForTimeout(1000);
          log('Language switched to English');
        }
      }
    } catch (error) {
      log('Could not switch language: ' + error.message);
    }

    // Set Base Exchange to Upbit KRW
    try {
      log('Setting Base Exchange to Upbit KRW...');
      await page.waitForTimeout(1500);

      const exchangeButtons = ['text=Bithumb KRW', 'text=Upbit KRW', 'text=Coinone KRW'];
      let dropdownOpened = false;

      for (const selector of exchangeButtons) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            log(`Clicked exchange dropdown: ${selector}`);
            await page.waitForTimeout(1000);
            dropdownOpened = true;
            break;
          }
        } catch (e) {}
      }

      if (dropdownOpened) {
        try {
          await page.waitForTimeout(500);
          const upbitKRW = await page.getByText('Upbit KRW').first();
          if (upbitKRW) {
            await upbitKRW.click({ timeout: 3000 });
            log('Selected Upbit KRW from dropdown');
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          log('Could not select Upbit KRW: ' + e.message);
        }
      }
    } catch (error) {
      log('Could not set Base Exchange: ' + error.message);
    }

    // Scroll
    if (config.scrollCount > 0) {
      log(`Scrolling down ${config.scrollCount} time(s) (half viewport)...`);
      for (let i = 0; i < config.scrollCount; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight / 2);
        });
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(1000);
    }

    // Add timestamp overlay
    const captureTime = new Date();
    await page.evaluate((timeData) => {
      // Format: 2025-11-28 / 13:55:00 Asia/Hong_Kong
      const year = timeData.year;
      const month = (timeData.month + 1).toString().padStart(2, '0');
      const day = timeData.day.toString().padStart(2, '0');
      const hours = timeData.hours.toString().padStart(2, '0');
      const minutes = timeData.minutes.toString().padStart(2, '0');
      const seconds = timeData.seconds.toString().padStart(2, '0');
      const timezone = timeData.timezone;

      const dateLine = `${year}-${month}-${day}`;
      const timeLine = `${hours}:${minutes}:${seconds} ${timezone}`;

      const overlay = document.createElement('div');
      overlay.id = 'screenshot-timestamp-overlay';
      overlay.innerHTML = `${dateLine}<br>${timeLine}`;
      overlay.style.cssText = `
        position: fixed;
        bottom: 60%;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: #00ff00;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        font-weight: bold;
        z-index: 999999;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
        border: 2px solid #00ff00;
        line-height: 1.5;
        text-align: center;
        white-space: nowrap;
      `;
      document.body.appendChild(overlay);
    }, {
      month: captureTime.getMonth(),
      day: captureTime.getDate(),
      year: captureTime.getFullYear(),
      hours: captureTime.getHours(),
      minutes: captureTime.getMinutes(),
      seconds: captureTime.getSeconds(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    await page.waitForTimeout(300);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filepath = join(config.screenshotPath, filename);

    // Take screenshot
    await page.screenshot({
      path: filepath,
      fullPage: false
    });

    log(`✓ Screenshot saved: ${filepath}`);

    await browser.close();

    // AUTOMATICALLY OPEN THE SCREENSHOT
    try {
      const { exec } = await import('child_process');
      exec(`open "${filepath}"`, (error) => {
        if (error) {
          log(`Could not auto-open screenshot: ${error.message}`);
        } else {
          log('📸 Screenshot automatically opened!');
        }
      });

      // Also open the screenshots folder
      exec(`open "${config.screenshotPath}"`, (error) => {
        if (!error) {
          log('📁 Screenshots folder opened!');
        }
      });
    } catch (error) {
      log(`Auto-open error: ${error.message}`);
    }

    return filepath;

  } catch (error) {
    log(`ERROR taking screenshot: ${error.message}`);
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Schedule with pre-warming for exact timing
 * Starts browser early so screenshot captures at EXACT specified time
 */
function scheduleWithPeriodicChecks(targetDate) {
  log(`Target time: ${targetDate.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' })} Hong Kong Time`);

  // Process takes ~12 seconds, so we start 15 seconds early to be safe
  const PROCESS_DURATION_MS = 15000; // Start 15 seconds before target
  const earlyStartTime = new Date(targetDate.getTime() - PROCESS_DURATION_MS);

  const checkInterval = 1000; // Check every second
  let hasExecuted = false;

  const intervalId = setInterval(async () => {
    const now = new Date();
    const diff = targetDate - now;

    // Log countdown every 30 seconds
    if (Math.floor(diff / 1000) % 30 === 0 && diff > 0) {
      const minutes = Math.floor(diff / 1000 / 60);
      const seconds = Math.floor((diff / 1000) % 60);
      log(`Time until screenshot: ${minutes}m ${seconds}s`);
    }

    // Start process EARLY (15 seconds before target) to hit exact time
    if (now >= earlyStartTime && !hasExecuted) {
      hasExecuted = true;
      clearInterval(intervalId);

      const actualWait = targetDate - now;
      log(`Starting browser preparation ${Math.floor(actualWait / 1000)}s before target time...`);

      try {
        await takeScreenshotAtExactTime(targetDate);
        log('Screenshot completed successfully!');
        log('='.repeat(60));
        process.exit(0);
      } catch (error) {
        log(`FATAL ERROR: ${error.message}`);
        process.exit(1);
      }
    }
  }, checkInterval);

  // Backup setTimeout
  const msUntilEarlyStart = earlyStartTime - new Date();
  if (msUntilEarlyStart > 0) {
    setTimeout(async () => {
      if (!hasExecuted) {
        log('BACKUP TIMER TRIGGERED');
        hasExecuted = true;
        clearInterval(intervalId);

        try {
          await takeScreenshotAtExactTime(targetDate);
          log('Screenshot completed successfully!');
          log('='.repeat(60));
          process.exit(0);
        } catch (error) {
          log(`FATAL ERROR: ${error.message}`);
          process.exit(1);
        }
      }
    }, msUntilEarlyStart);
  }
}

/**
 * Take screenshot with exact timing - prepares page then waits for exact moment
 */
async function takeScreenshotAtExactTime(targetDate) {
  log('Pre-warming browser and loading page...');

  let browser;
  try {
    // Ensure screenshots directory exists
    if (!fs.existsSync(config.screenshotPath)) {
      fs.mkdirSync(config.screenshotPath, { recursive: true });
      log(`Created screenshots directory: ${config.screenshotPath}`);
    }

    // Launch browser EARLY
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    log(`Navigating to ${config.url}...`);

    // Navigate and prepare page
    try {
      await page.goto(config.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      log('Retrying navigation...');
      await page.goto(config.url, {
        waitUntil: 'load',
        timeout: 30000
      });
    }

    await page.waitForTimeout(2000);

    // Switch to English
    try {
      log('Switching to English language...');
      const krDropdown = await page.$('text=KR');
      if (krDropdown) {
        await krDropdown.click();
        await page.waitForTimeout(500);
        const enOption = await page.$('text=EN');
        if (enOption) {
          await enOption.click();
          await page.waitForTimeout(1000);
          log('Language switched to English');
        }
      }
    } catch (error) {
      log('Could not switch language: ' + error.message);
    }

    // Set Base Exchange to Upbit KRW
    try {
      log('Setting Base Exchange to Upbit KRW...');
      await page.waitForTimeout(1500);

      const exchangeButtons = ['text=Bithumb KRW', 'text=Upbit KRW', 'text=Coinone KRW'];
      let dropdownOpened = false;

      for (const selector of exchangeButtons) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            log(`Clicked exchange dropdown: ${selector}`);
            await page.waitForTimeout(1000);
            dropdownOpened = true;
            break;
          }
        } catch (e) {}
      }

      if (dropdownOpened) {
        try {
          await page.waitForTimeout(500);
          const upbitKRW = await page.getByText('Upbit KRW').first();
          if (upbitKRW) {
            await upbitKRW.click({ timeout: 3000 });
            log('Selected Upbit KRW from dropdown');
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          log('Could not select Upbit KRW: ' + e.message);
        }
      }
    } catch (error) {
      log('Could not set Base Exchange: ' + error.message);
    }

    // Scroll
    if (config.scrollCount > 0) {
      log(`Scrolling down ${config.scrollCount} time(s) (half viewport)...`);
      for (let i = 0; i < config.scrollCount; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight / 2);
        });
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(1000);
    }

    // NOW WAIT FOR EXACT TARGET TIME
    const now = new Date();
    const msUntilTarget = targetDate - now;

    if (msUntilTarget > 0) {
      log(`Page ready! Waiting ${msUntilTarget}ms for exact target time...`);
      await new Promise(resolve => setTimeout(resolve, msUntilTarget));
    }

    // CAPTURE AT EXACT TIME
    const captureTime = new Date();
    log(`CAPTURING NOW at ${captureTime.toISOString()}`);

    // Add timestamp overlay
    await page.evaluate((timeData) => {
      // Format: 2025-11-28 13:55:00 (ISO format, 24-hour, no milliseconds)
      const year = timeData.year;
      const month = (timeData.month + 1).toString().padStart(2, '0');
      const day = timeData.day.toString().padStart(2, '0');
      const hours = timeData.hours.toString().padStart(2, '0');
      const minutes = timeData.minutes.toString().padStart(2, '0');
      const seconds = timeData.seconds.toString().padStart(2, '0');

      const dateLine = `${year}-${month}-${day}`;
      const timeLine = `${hours}:${minutes}:${seconds}`;

      const overlay = document.createElement('div');
      overlay.id = 'screenshot-timestamp-overlay';
      overlay.innerHTML = `${dateLine}<br>${timeLine}`;
      overlay.style.cssText = `
        position: fixed;
        bottom: 60%;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: #00ff00;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        font-weight: bold;
        z-index: 999999;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
        border: 2px solid #00ff00;
        line-height: 1.5;
        text-align: center;
        white-space: nowrap;
      `;
      document.body.appendChild(overlay);
    }, {
      month: captureTime.getMonth(),
      day: captureTime.getDate(),
      year: captureTime.getFullYear(),
      hours: captureTime.getHours(),
      minutes: captureTime.getMinutes(),
      seconds: captureTime.getSeconds()
    });

    await page.waitForTimeout(100); // Minimal wait for overlay to render

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filepath = join(config.screenshotPath, filename);

    // Take screenshot
    await page.screenshot({
      path: filepath,
      fullPage: false
    });

    log(`✓ Screenshot saved: ${filepath}`);

    await browser.close();

    // AUTOMATICALLY OPEN THE SCREENSHOT
    try {
      const { exec } = await import('child_process');
      exec(`open "${filepath}"`, (error) => {
        if (error) {
          log(`Could not auto-open screenshot: ${error.message}`);
        } else {
          log('📸 Screenshot automatically opened!');
        }
      });

      // Also open the screenshots folder
      exec(`open "${config.screenshotPath}"`, (error) => {
        if (!error) {
          log('📁 Screenshots folder opened!');
        }
      });
    } catch (error) {
      log(`Auto-open error: ${error.message}`);
    }

    return filepath;

  } catch (error) {
    log(`ERROR: ${error.message}`);
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: node schedule-screenshot.js "2025-11-28T13:45:00+08:00"');
    console.log('Format: YYYY-MM-DDTHH:MM:SS+08:00 (Hong Kong timezone)');
    process.exit(0);
  }

  const datetimeString = args[0];
  const targetDate = new Date(datetimeString);

  if (isNaN(targetDate.getTime())) {
    console.error(`Invalid date/time format: ${datetimeString}`);
    console.log('Please use format: YYYY-MM-DDTHH:MM:SS+08:00');
    process.exit(1);
  }

  const now = new Date();
  if (targetDate <= now) {
    console.error('The specified time is in the past!');
    process.exit(1);
  }

  log('='.repeat(60));
  log('ROBUST SCREENSHOT SCHEDULER STARTED');
  log('='.repeat(60));
  log(`Target URL: ${config.url}`);
  log(`Screenshot Path: ${config.screenshotPath}`);
  log(`Log File: ${config.logPath}`);
  log('='.repeat(60));

  // Schedule with dual mechanism (interval + setTimeout)
  scheduleWithPeriodicChecks(targetDate);

  log('Service running with periodic checks...');
  log('Press Ctrl+C to stop');
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('Service interrupted by user (SIGINT)');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Service terminated (SIGTERM)');
  process.exit(0);
});

main().catch(error => {
  log(`FATAL: ${error.message}`);
  process.exit(1);
});
