import express from 'express';
import schedule from 'node-schedule';
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Disable caching for development
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(join(__dirname, 'public')));

// Store scheduled jobs
const scheduledJobs = new Map();

// Configuration
const config = {
  url: 'https://kimpga.com/',
  screenshotPath: process.env.SCREENSHOT_PATH || join(process.env.HOME || '/tmp', 'Desktop', 'screenshots'),
  viewport: { width: 1920, height: 1080 },
  waitForNetworkIdle: false,
  fullPage: false,
  quality: 100,
  scrollCount: 1,
  scrollDelay: 500
};

/**
 * Take a screenshot (reused from existing code)
 */
async function takeScreenshot() {
  console.log(`[${new Date().toISOString()}] Starting screenshot capture...`);

  let browser;
  try {
    // Ensure screenshots directory exists
    if (!fs.existsSync(config.screenshotPath)) {
      fs.mkdirSync(config.screenshotPath, { recursive: true });
    }

    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    console.log(`Navigating to ${config.url}...`);

    // Navigate with retry
    try {
      await page.goto(config.url, {
        waitUntil: config.waitForNetworkIdle ? 'networkidle' : 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      console.log('First attempt timed out, trying with basic load strategy...');
      await page.goto(config.url, {
        waitUntil: 'load',
        timeout: 30000
      });
    }

    await page.waitForTimeout(2000);

    // Switch to English
    try {
      console.log('Switching to English language...');
      const krDropdown = await page.$('text=KR');
      if (krDropdown) {
        await krDropdown.click();
        await page.waitForTimeout(500);
        const enOption = await page.$('text=EN');
        if (enOption) {
          await enOption.click();
          await page.waitForTimeout(1000);
          console.log('Language switched to English');
        }
      }
    } catch (error) {
      console.log('Could not switch language:', error.message);
    }

    // Select Upbit KRW
    try {
      console.log('Setting Base Exchange to Upbit KRW...');
      await page.waitForTimeout(1500);

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
        try {
          await page.waitForTimeout(500);
          const upbitKRW = await page.getByText('Upbit KRW').first();
          if (upbitKRW) {
            await upbitKRW.click({ timeout: 3000 });
            console.log('Selected Upbit KRW from dropdown');
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          console.log('Could not select Upbit KRW:', e.message);
        }
      }
    } catch (error) {
      console.log('Could not set Base Exchange:', error.message);
    }

    // Scroll
    if (config.scrollCount > 0) {
      console.log(`Scrolling down ${config.scrollCount} time(s)...`);
      for (let i = 0; i < config.scrollCount; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight / 2);
        });
        await page.waitForTimeout(config.scrollDelay);
      }
      await page.waitForTimeout(1000);
    }

    // Add timestamp overlay
    const captureTime = new Date();
    await page.evaluate((timeData) => {
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
      fullPage: config.fullPage
    });

    console.log(`✓ Screenshot saved: ${filepath}`);
    await browser.close();

    return { success: true, filepath, filename };

  } catch (error) {
    console.error('Error taking screenshot:', error.message);
    if (browser) {
      await browser.close();
    }
    return { success: false, error: error.message };
  }
}

/**
 * Take screenshot at exact time (pre-warm approach)
 */
async function takeScreenshotAtExactTime(targetDate) {
  console.log(`[EXACT-TIME] Starting browser preparation...`);
  let browser;

  try {
    // Ensure screenshots directory exists
    if (!fs.existsSync(config.screenshotPath)) {
      fs.mkdirSync(config.screenshotPath, { recursive: true });
    }

    // Launch browser and prepare page
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    console.log(`[EXACT-TIME] Navigating to ${config.url}...`);

    try {
      await page.goto(config.url, {
        waitUntil: config.waitForNetworkIdle ? 'networkidle' : 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      console.log('[EXACT-TIME] First attempt timed out, trying with basic load...');
      await page.goto(config.url, {
        waitUntil: 'load',
        timeout: 30000
      });
    }

    await page.waitForTimeout(2000);

    // Switch to English
    try {
      const krDropdown = await page.$('text=KR');
      if (krDropdown) {
        await krDropdown.click();
        await page.waitForTimeout(500);
        const enOption = await page.$('text=EN');
        if (enOption) {
          await enOption.click();
          await page.waitForTimeout(1000);
        }
      }
    } catch (error) {
      console.log('[EXACT-TIME] Could not switch language');
    }

    // Select Upbit KRW
    try {
      await page.waitForTimeout(1500);
      const exchangeButtons = ['text=Bithumb KRW', 'text=Upbit KRW', 'text=Coinone KRW'];
      let dropdownOpened = false;
      for (const selector of exchangeButtons) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            await page.waitForTimeout(1000);
            dropdownOpened = true;
            break;
          }
        } catch (e) {}
      }
      if (dropdownOpened) {
        const upbitKRW = await page.getByText('Upbit KRW').first();
        if (upbitKRW) {
          await upbitKRW.click({ timeout: 3000 });
          await page.waitForTimeout(1000);
        }
      }
    } catch (error) {
      console.log('[EXACT-TIME] Could not set Base Exchange');
    }

    // Scroll
    if (config.scrollCount > 0) {
      for (let i = 0; i < config.scrollCount; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await page.waitForTimeout(config.scrollDelay);
      }
      await page.waitForTimeout(1000);
    }

    // NOW WAIT FOR EXACT TARGET TIME
    const now = new Date();
    const msUntilTarget = targetDate - now;

    if (msUntilTarget > 0) {
      console.log(`[EXACT-TIME] Page ready! Waiting ${msUntilTarget}ms for exact target time...`);
      await new Promise(resolve => setTimeout(resolve, msUntilTarget));
    }

    // CAPTURE AT EXACT TIME
    const captureTime = new Date();
    console.log(`[EXACT-TIME] Capturing NOW at ${captureTime.toISOString()}`);

    // Add timestamp overlay
    await page.evaluate((timeData) => {
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
      fullPage: config.fullPage
    });

    console.log(`[EXACT-TIME] ✓ Screenshot saved: ${filepath}`);
    await browser.close();

    return { success: true, filepath, filename };

  } catch (error) {
    console.error('[EXACT-TIME] Error:', error.message);
    if (browser) {
      await browser.close();
    }
    return { success: false, error: error.message };
  }
}

// API Endpoints

/**
 * GET / - Serve the UI
 */
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

/**
 * POST /api/schedule - Schedule a screenshot
 * Body: { datetime: "2025-11-28T14:00:00+08:00", recurring: false }
 */
app.post('/api/schedule', (req, res) => {
  try {
    const { datetime, recurring } = req.body;

    if (!datetime) {
      return res.status(400).json({ error: 'datetime is required' });
    }

    const targetDate = new Date(datetime);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid datetime format' });
    }

    if (targetDate <= new Date()) {
      return res.status(400).json({ error: 'datetime must be in the future' });
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[SCHEDULER] Scheduling job ${jobId} for ${targetDate.toISOString()}`);
    console.log(`[SCHEDULER] Current time: ${new Date().toISOString()}`);
    console.log(`[SCHEDULER] Time until execution: ${Math.floor((targetDate - new Date()) / 1000)} seconds`);

    // Pre-warm the browser 15 seconds before target time for exact timing
    const PROCESS_DURATION_MS = 15000;
    const earlyStartTime = new Date(targetDate.getTime() - PROCESS_DURATION_MS);

    // Schedule the job to start 15 seconds early
    const job = schedule.scheduleJob(earlyStartTime, async () => {
      console.log(`[SCHEDULER] ✓ Pre-warming for job ${jobId} at ${new Date().toISOString()}`);
      console.log(`[SCHEDULER] Will capture at exact time: ${targetDate.toISOString()}`);

      const result = await takeScreenshotAtExactTime(targetDate);

      if (result.success) {
        console.log(`[SCHEDULER] ✓ Job ${jobId} completed successfully - ${result.filename}`);
      } else {
        console.error(`[SCHEDULER] ✗ Job ${jobId} failed:`, result.error);
      }

      // Remove from scheduled jobs after execution (if not recurring)
      if (!recurring) {
        scheduledJobs.delete(jobId);
        console.log(`[SCHEDULER] Job ${jobId} removed from schedule`);
      }
    });

    if (!job) {
      console.error(`[SCHEDULER] ✗ Failed to schedule job ${jobId}`);
      return res.status(500).json({ error: 'Failed to schedule job' });
    }

    // Store job info
    scheduledJobs.set(jobId, {
      id: jobId,
      datetime: targetDate.toISOString(),
      recurring,
      scheduled: new Date().toISOString(),
      job
    });

    res.json({
      success: true,
      jobId,
      scheduledFor: targetDate.toISOString(),
      message: `Screenshot scheduled for ${targetDate.toLocaleString()}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/jobs - List all scheduled jobs
 */
app.get('/api/jobs', (req, res) => {
  const jobs = Array.from(scheduledJobs.values()).map(job => ({
    id: job.id,
    datetime: job.datetime,
    recurring: job.recurring,
    scheduled: job.scheduled
  }));

  res.json({ jobs });
});

/**
 * DELETE /api/jobs/:jobId - Cancel a scheduled job
 */
app.delete('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;

  const jobInfo = scheduledJobs.get(jobId);
  if (!jobInfo) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Cancel the scheduled job
  jobInfo.job.cancel();
  scheduledJobs.delete(jobId);

  res.json({ success: true, message: 'Job canceled successfully' });
});

/**
 * GET /api/screenshots - List all screenshots
 */
app.get('/api/screenshots', (req, res) => {
  try {
    if (!fs.existsSync(config.screenshotPath)) {
      return res.json({ screenshots: [] });
    }

    const files = fs.readdirSync(config.screenshotPath)
      .filter(file => file.startsWith('screenshot-') && file.endsWith('.png'))
      .map(file => {
        const stats = fs.statSync(join(config.screenshotPath, file));
        return {
          filename: file,
          path: join(config.screenshotPath, file),
          created: stats.birthtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.created - a.created);

    res.json({ screenshots: files });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/screenshot/now - Take immediate screenshot
 */
app.post('/api/screenshot/now', async (req, res) => {
  try {
    const result = await takeScreenshot();

    if (result.success) {
      res.json({
        success: true,
        message: 'Screenshot taken successfully',
        filepath: result.filepath,
        filename: result.filename
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/screenshot/:filename - Serve screenshot image
 */
app.get('/api/screenshot/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = join(config.screenshotPath, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Screenshot not found' });
    }

    res.sendFile(filepath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Screenshot Scheduler UI Service');
  console.log('='.repeat(60));
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Open your browser to schedule screenshots!`);
  console.log('='.repeat(60));
});
