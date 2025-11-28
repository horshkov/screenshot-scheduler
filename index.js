import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  url: 'https://kimpga.com/',
  scheduledTime: '12:00:00', // Format: HH:MM:SS (24-hour)
  screenshotPath: join(process.env.HOME, 'Desktop', 'screenshots'),
  viewport: { width: 1920, height: 1080 }, // Laptop screen size
  waitForNetworkIdle: false, // Set to true for stricter loading requirements
  fullPage: false, // Only capture visible viewport, not entire page
  quality: 100, // PNG quality (0-100, higher is better)
  scrollCount: 1, // Number of times to scroll down before taking screenshot
  scrollDelay: 500 // Delay in ms between scrolls
};

/**
 * Parse time string (HH:MM:SS) and return hours, minutes, seconds
 */
function parseTime(timeString) {
  const [hours, minutes, seconds] = timeString.split(':').map(Number);
  return { hours, minutes, seconds };
}

/**
 * Calculate milliseconds until the next occurrence of the target time
 */
function getMillisecondsUntilTime(targetTime) {
  const now = new Date();
  const { hours, minutes, seconds } = parseTime(targetTime);

  const target = new Date();
  target.setHours(hours, minutes, seconds, 0);

  // If target time has already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target - now;
}

/**
 * Take a screenshot of the configured website
 */
async function takeScreenshot() {
  console.log(`[${new Date().toISOString()}] Starting screenshot capture...`);

  let browser;
  try {
    // Ensure screenshots directory exists
    if (!fs.existsSync(config.screenshotPath)) {
      fs.mkdirSync(config.screenshotPath, { recursive: true });
      console.log(`Created screenshots directory: ${config.screenshotPath}`);
    }

    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 2 // Higher resolution for better quality (like retina displays)
    });
    const page = await context.newPage();

    console.log(`Navigating to ${config.url}...`);

    // Try to navigate with different wait strategies for better reliability
    try {
      await page.goto(config.url, {
        waitUntil: config.waitForNetworkIdle ? 'networkidle' : 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      // If networkidle/domcontentloaded fails, try with just 'load'
      console.log('First attempt timed out, trying with basic load strategy...');
      await page.goto(config.url, {
        waitUntil: 'load',
        timeout: 30000
      });
    }

    // Wait a bit for any dynamic content to render
    await page.waitForTimeout(3000);

    // Handle cookie consent popup
    try {
      console.log('Checking for cookie consent popup...');

      // Wait for the consent button to appear and be visible
      const consentButton = page.locator('button:has-text("Consent")').first();
      await consentButton.waitFor({ state: 'visible', timeout: 5000 });

      console.log('Found consent button, clicking...');
      await consentButton.click({ force: true });
      console.log('✓ Clicked Consent button');

      // Wait for modal to disappear
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('No consent popup found or already dismissed:', error.message);
    }

    // Switch to English language if available
    try {
      console.log('Switching to English language...');

      // First, try to click on the KR dropdown to open language options
      const krDropdown = await page.$('text=KR');
      if (krDropdown) {
        await krDropdown.click();
        console.log('Opened language dropdown');
        await page.waitForTimeout(500);

        // Now click on EN option
        const enOption = await page.$('text=EN');
        if (enOption) {
          await enOption.click();
          await page.waitForTimeout(1000); // Wait for language to apply
          console.log('Language switched to English');
        } else {
          console.log('EN option not found in dropdown');
        }
      } else {
        console.log('Language dropdown not found, continuing with current language');
      }
    } catch (error) {
      console.log('Could not switch language:', error.message);
    }

    // Select Upbit KRW as the base exchange
    try {
      console.log('Setting Base Exchange to Upbit KRW...');
      // Wait longer after language change for page to settle
      await page.waitForTimeout(1500);

      // Try to find and click the exchange dropdown button (might show Bithumb KRW, Upbit KRW, etc.)
      try {
        // Try clicking on any exchange button (Bithumb, Upbit, etc.) to open dropdown
        const exchangeButtons = [
          'text=Bithumb KRW',
          'text=Upbit KRW',
          'text=Coinone KRW',
          'button:has-text("KRW")',
          'div:has-text("KRW")'
        ];

        let dropdownOpened = false;
        for (const selector of exchangeButtons) {
          try {
            const button = await page.$(selector);
            if (button) {
              await button.click();
              console.log(`Clicked exchange dropdown: ${selector}`);
              await page.waitForTimeout(1000);
              dropdownOpened = true;
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }

        if (dropdownOpened) {
          // Now try to click on Upbit KRW option from the dropdown
          try {
            // Wait for dropdown menu to appear
            await page.waitForTimeout(500);

            // Try to find and click Upbit KRW
            const upbitKRW = await page.getByText('Upbit KRW').first();
            if (upbitKRW) {
              await upbitKRW.click({ timeout: 3000 });
              console.log('Selected Upbit KRW from dropdown');
              await page.waitForTimeout(1000);
            }
          } catch (e) {
            console.log('Could not select Upbit KRW:', e.message);
          }
        } else {
          console.log('Could not open exchange dropdown');
        }
      } catch (e) {
        console.log('Could not interact with Base Exchange:', e.message);
      }
    } catch (error) {
      console.log('Could not set Base Exchange:', error.message);
    }

    // Scroll down to capture more content
    if (config.scrollCount > 0) {
      console.log(`Scrolling down ${config.scrollCount} time(s) (half viewport)...`);
      for (let i = 0; i < config.scrollCount; i++) {
        await page.evaluate(() => {
          // Scroll by half viewport height for better positioning
          window.scrollBy(0, window.innerHeight / 2);
        });
        await page.waitForTimeout(config.scrollDelay);
      }
      // Wait a bit more after final scroll for content to load
      await page.waitForTimeout(1000);
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filepath = join(config.screenshotPath, filename);

    // Add timestamp overlay to the screenshot
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

      // Create overlay div
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

    // Wait a moment for the overlay to render
    await page.waitForTimeout(300);

    // Take screenshot
    await page.screenshot({
      path: filepath,
      fullPage: config.fullPage
    });

    console.log(`✓ Screenshot saved: ${filepath}`);

    await browser.close();
    return filepath;

  } catch (error) {
    console.error('Error taking screenshot:', error.message);
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Schedule the next screenshot
 */
function scheduleNextScreenshot() {
  const msUntilTime = getMillisecondsUntilTime(config.scheduledTime);
  const targetDate = new Date(Date.now() + msUntilTime);

  console.log(`\n[${new Date().toISOString()}] Screenshot scheduled for: ${targetDate.toLocaleString()}`);
  console.log(`Time until screenshot: ${Math.floor(msUntilTime / 1000 / 60)} minutes`);

  setTimeout(async () => {
    try {
      await takeScreenshot();
    } catch (error) {
      console.error('Screenshot failed:', error);
    }

    // Schedule the next screenshot (24 hours later)
    scheduleNextScreenshot();
  }, msUntilTime);
}

/**
 * Schedule a screenshot at a specific date and time
 */
function scheduleAtSpecificTime(datetimeString) {
  const targetDate = new Date(datetimeString);

  if (isNaN(targetDate.getTime())) {
    console.error(`Invalid date/time format: ${datetimeString}`);
    console.log('Please use format: YYYY-MM-DD HH:MM:SS');
    process.exit(1);
  }

  const now = new Date();
  const msUntil = targetDate - now;

  if (msUntil < 0) {
    console.error('The specified time is in the past!');
    process.exit(1);
  }

  console.log(`\n[${now.toISOString()}] Screenshot scheduled for: ${targetDate.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' })} Hong Kong Time`);
  console.log(`Time until screenshot: ${Math.floor(msUntil / 1000 / 60)} minutes and ${Math.floor((msUntil / 1000) % 60)} seconds`);

  setTimeout(async () => {
    try {
      await takeScreenshot();
      console.log('\nScreenshot completed! Exiting...');
      process.exit(0);
    } catch (error) {
      console.error('Screenshot failed:', error);
      process.exit(1);
    }
  }, msUntil);
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Screenshot Scheduler Service');
  console.log('='.repeat(60));
  console.log(`Target URL: ${config.url}`);
  console.log(`Scheduled Time: ${config.scheduledTime} (daily)`);
  console.log(`Screenshot Path: ${config.screenshotPath}`);
  console.log('='.repeat(60));

  // Check for command-line arguments
  const isTestMode = process.argv.includes('--test');
  const atIndex = process.argv.indexOf('--at');
  const hasCustomTime = atIndex !== -1 && process.argv[atIndex + 1];

  if (isTestMode) {
    console.log('\n[TEST MODE] Taking immediate screenshot...\n');
    await takeScreenshot();
    console.log('\n[TEST MODE] Complete! Service will exit now.');
    process.exit(0);
  } else if (hasCustomTime) {
    // Schedule screenshot at specific time
    const datetimeString = process.argv[atIndex + 1];
    scheduleAtSpecificTime(datetimeString);
    console.log('\nService is running. Press Ctrl+C to stop.\n');
  } else {
    // Schedule the screenshot (daily recurring)
    scheduleNextScreenshot();
    console.log('\nService is running. Press Ctrl+C to stop.\n');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down screenshot scheduler...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down screenshot scheduler...');
  process.exit(0);
});

// Start the service
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
