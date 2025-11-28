const API_BASE = '';

// DOM Elements
const dateInput = document.getElementById('date');
const timeInput = document.getElementById('time');
const timezoneSelect = document.getElementById('timezone');
const scheduleBtn = document.getElementById('scheduleBtn');
const nowBtn = document.getElementById('nowBtn');
const scheduleMessage = document.getElementById('scheduleMessage');
const jobsContainer = document.getElementById('jobsContainer');
const screenshotsContainer = document.getElementById('screenshotsContainer');
const refreshJobsBtn = document.getElementById('refreshJobsBtn');
const refreshScreenshotsBtn = document.getElementById('refreshScreenshotsBtn');
const modal = document.getElementById('screenshotModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.querySelector('.close');
const currentTimeDisplay = document.getElementById('currentTime');

// Update current time display
function updateCurrentTime() {
  const timezone = timezoneSelect.value;
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  currentTimeDisplay.textContent = formatter.format(now) + ' (' + timezone + ')';
}

// Initialize
function init() {
  // Set default date to today
  const today = new Date();
  dateInput.valueAsDate = today;

  // Set default time to current time + 2 minutes
  const defaultTime = new Date(today.getTime() + 2 * 60 * 1000);
  const hours = String(defaultTime.getHours()).padStart(2, '0');
  const minutes = String(defaultTime.getMinutes()).padStart(2, '0');
  timeInput.value = `${hours}:${minutes}:00`;

  // Detect user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const option = Array.from(timezoneSelect.options).find(opt => opt.value === userTimezone);
  if (option) {
    option.selected = true;
  }

  // Update current time
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);

  // Update current time when timezone changes
  timezoneSelect.addEventListener('change', updateCurrentTime);

  // Load initial data
  loadJobs();
  loadScreenshots();

  // Event listeners
  scheduleBtn.addEventListener('click', scheduleScreenshot);
  nowBtn.addEventListener('click', takeScreenshotNow);
  refreshJobsBtn.addEventListener('click', loadJobs);
  refreshScreenshotsBtn.addEventListener('click', loadScreenshots);

  // Modal event listeners
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('Close button clicked');
      closeModal();
    });
  }

  window.addEventListener('click', (e) => {
    const modal = document.getElementById('screenshotModal');
    if (modal && e.target === modal) {
      console.log('Clicked outside modal');
      closeModal();
    }
  });

  // Also support ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('screenshotModal');
      if (modal && modal.style.display === 'block') {
        closeModal();
      }
    }
  });
}

// Show message
function showMessage(text, type = 'success') {
  scheduleMessage.textContent = text;
  scheduleMessage.className = `message ${type}`;
  setTimeout(() => {
    scheduleMessage.style.display = 'none';
  }, 5000);
}

// Schedule screenshot
async function scheduleScreenshot() {
  const date = dateInput.value;
  const time = timeInput.value;
  const timezone = timezoneSelect.value;

  if (!date || !time) {
    showMessage('Please select both date and time', 'error');
    return;
  }

  // Create datetime string in the selected timezone
  const datetimeString = `${date}T${time}`;

  // Simple and correct timezone conversion:
  // Create a date string that the browser will parse in the selected timezone
  // Then convert to UTC

  // Parse the input
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);

  // Create a properly formatted date-time string
  // We'll use the user's local interpretation first
  const localDate = new Date(year, month - 1, day, hour, minute, second);

  // Get the offset for the target timezone at this date/time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });

  // Format current date in target timezone to get offset
  const nowInTargetTZ = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  const nowInUTC = new Date();
  const tzOffsetMs = nowInUTC - nowInTargetTZ;

  // Create the date as if it's in the target timezone, then adjust to UTC
  const targetDate = new Date(year, month - 1, day, hour, minute, second);
  const utcDate = new Date(targetDate.getTime() + tzOffsetMs);
  const isoString = utcDate.toISOString();

  console.log('Input:', datetimeString, 'in timezone:', timezone);
  console.log('Converted to UTC:', isoString);
  console.log('Timezone offset:', tzOffsetMs / 1000 / 60 / 60, 'hours');

  scheduleBtn.disabled = true;
  scheduleBtn.textContent = 'Scheduling...';

  try {
    const response = await fetch(`${API_BASE}/api/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        datetime: isoString,
        recurring: false
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const timeFromNow = Math.floor((new Date(data.scheduledFor) - new Date()) / 1000);
      const hours = Math.floor(timeFromNow / 3600);
      const minutes = Math.floor((timeFromNow % 3600) / 60);
      const timeMsg = hours > 0 ? `${hours}h ${minutes}m from now` : `${minutes}m from now`;

      showMessage(`✓ Screenshot scheduled for ${timeMsg}!`, 'success');
      loadJobs();
    } else {
      showMessage(data.error || 'Failed to schedule screenshot', 'error');
    }
  } catch (error) {
    showMessage('Network error: ' + error.message, 'error');
  } finally {
    scheduleBtn.disabled = false;
    scheduleBtn.textContent = 'Schedule Screenshot';
  }
}

// Take screenshot now
async function takeScreenshotNow() {
  nowBtn.disabled = true;
  nowBtn.textContent = 'Taking Screenshot...';

  try {
    const response = await fetch(`${API_BASE}/api/screenshot/now`, {
      method: 'POST'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage('Screenshot taken successfully!', 'success');
      loadScreenshots();
    } else {
      showMessage(data.error || 'Failed to take screenshot', 'error');
    }
  } catch (error) {
    showMessage('Network error: ' + error.message, 'error');
  } finally {
    nowBtn.disabled = false;
    nowBtn.textContent = 'Take Screenshot Now';
  }
}

// Load scheduled jobs
async function loadJobs() {
  try {
    const response = await fetch(`${API_BASE}/api/jobs`);
    const data = await response.json();

    if (data.jobs && data.jobs.length > 0) {
      jobsContainer.innerHTML = data.jobs.map(job => `
        <div class="job-item">
          <div class="job-info">
            <strong>${new Date(job.datetime).toLocaleString()}</strong>
            <small>Job ID: ${job.id}</small>
            <small>Scheduled: ${new Date(job.scheduled).toLocaleString()}</small>
          </div>
          <button class="btn btn-danger" onclick="cancelJob('${job.id}')">Cancel</button>
        </div>
      `).join('');
    } else {
      jobsContainer.innerHTML = '<p class="empty-state">No scheduled jobs</p>';
    }
  } catch (error) {
    jobsContainer.innerHTML = '<p class="empty-state">Error loading jobs</p>';
  }
}

// Cancel job
async function cancelJob(jobId) {
  if (!confirm('Are you sure you want to cancel this job?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage('Job canceled successfully', 'success');
      loadJobs();
    } else {
      showMessage(data.error || 'Failed to cancel job', 'error');
    }
  } catch (error) {
    showMessage('Network error: ' + error.message, 'error');
  }
}

// Load screenshots
async function loadScreenshots() {
  try {
    const response = await fetch(`${API_BASE}/api/screenshots`);
    const data = await response.json();

    if (data.screenshots && data.screenshots.length > 0) {
      screenshotsContainer.innerHTML = data.screenshots.slice(0, 10).map(screenshot => {
        const sizeKB = (screenshot.size / 1024).toFixed(2);
        return `
          <div class="screenshot-item">
            <div class="screenshot-info">
              <strong>${screenshot.filename}</strong>
              <small>Created: ${new Date(screenshot.created).toLocaleString()}</small>
              <small>Size: ${sizeKB} KB</small>
            </div>
            <div class="screenshot-actions">
              <button class="btn btn-secondary" onclick="openScreenshot('${screenshot.filename}')">Open</button>
              <a href="${API_BASE}/api/screenshot/${encodeURIComponent(screenshot.filename)}/download" class="btn btn-primary" download>Download</a>
            </div>
          </div>
        `;
      }).join('');
    } else {
      screenshotsContainer.innerHTML = '<p class="empty-state">No screenshots yet</p>';
    }
  } catch (error) {
    screenshotsContainer.innerHTML = '<p class="empty-state">Error loading screenshots</p>';
  }
}

// Open screenshot in modal
function openScreenshot(filename) {
  console.log('Opening screenshot:', filename);
  const modal = document.getElementById('screenshotModal');
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalDownload = document.getElementById('modalDownload');

  if (!modal || !modalImage || !modalTitle) {
    console.error('Modal elements not found');
    return;
  }

  modalTitle.textContent = filename;
  modalImage.src = `${API_BASE}/api/screenshot/${encodeURIComponent(filename)}`;

  if (modalDownload) {
    modalDownload.href = `${API_BASE}/api/screenshot/${encodeURIComponent(filename)}/download`;
    modalDownload.download = filename;
  }

  modal.style.display = 'block';
  console.log('Modal opened');
}

// Close modal
function closeModal() {
  console.log('Closing modal');
  const modal = document.getElementById('screenshotModal');
  const modalImage = document.getElementById('modalImage');

  if (modal) {
    modal.style.display = 'none';
  }
  if (modalImage) {
    modalImage.src = '';
  }
}

// Make functions globally accessible
window.openScreenshot = openScreenshot;
window.closeModal = closeModal;

// Auto-refresh jobs and screenshots every 10 seconds
setInterval(() => {
  loadJobs();
  loadScreenshots();
}, 10000);

// Initialize on load
init();
