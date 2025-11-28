/**
 * Screenshot Scheduler Configuration Example
 *
 * Copy this file to config.js and customize the settings below.
 * If config.js doesn't exist, the service will use default settings from index.js
 */

export default {
  // The URL to capture
  url: 'https://kimpga.com/',

  // Time to take screenshot daily (24-hour format: HH:MM:SS)
  scheduledTime: '12:00:00',

  // Path where screenshots will be saved
  // Default: ~/Desktop/screenshots
  screenshotPath: process.env.HOME + '/Desktop/screenshots',

  // Browser viewport size (laptop screen)
  viewport: {
    width: 1920,
    height: 1080
  },

  // Wait for network to be idle before taking screenshot
  // Set to true for stricter loading requirements (may cause timeouts)
  waitForNetworkIdle: false,

  // Capture full page or just viewport (false = viewport only, better quality)
  fullPage: false,

  // Screenshot quality (0-100, higher is better)
  quality: 100,

  // Number of times to scroll down before taking screenshot
  // Set to 0 to capture from the top, 1 to show content below the fold
  scrollCount: 1,

  // Delay in milliseconds between each scroll
  scrollDelay: 500
};
