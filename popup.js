// Popup script for managing extension interface
class PopupManager {
  constructor() {
    this.isActive = false;
    this.config = {};
    this.initialize();
  }

  async initialize() {
    // Get current state
    await this.loadState();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Apply theme detection
    this.applyTheme();
    
    // Update UI
    this.updateUI();
    
    // Ensure correct time config visibility
    this.toggleTimeConfigVisibility();
    
    // Ensure correct timer config visibility
    this.toggleTimerConfigVisibility();
  }

  async loadState() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to current tab to get state
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getState' });
      console.log('Received response from tab:', response);
      this.isActive = response.isActiveInThisTab || false;
      this.config = {
        timestampFormat: response.timestampFormat || 'absolute',
        timeFormat: response.timeFormat || 'HH:mm:ss',
        interviewStartTime: response.interviewStartTime,
        relativeFormat: response.relativeFormat || 'mm:ss',
        timerEnabled: response.timerEnabled !== false,
        timerPosition: response.timerPosition || 'top-right',
        themeMode: response.themeMode || 'auto'
      };
    } catch (error) {
      console.error('Failed to load state from tab, trying background script:', error);
      
      // Fallback: get state directly from background script
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getState' });
        this.isActive = response.isActive || false;
        this.config = {
          timestampFormat: response.timestampFormat || 'absolute',
          timeFormat: response.timeFormat || 'HH:mm:ss',
          interviewStartTime: response.interviewStartTime,
          relativeFormat: response.relativeFormat || 'mm:ss',
          timerEnabled: response.timerEnabled !== false,
          timerPosition: response.timerPosition || 'top-right',
          themeMode: response.themeMode || 'auto'
        };
      } catch (fallbackError) {
        console.error('Failed to load state from background script:', fallbackError);
        // Use default values
        this.isActive = false;
        this.config = {
          timestampFormat: 'absolute',
          timeFormat: 'HH:mm:ss',
          interviewStartTime: null,
          relativeFormat: 'mm:ss',
          timerEnabled: true,
          timerPosition: 'top-right',
          themeMode: 'auto'
        };
      }
    }
  }

  setupEventListeners() {
    // Toggle button
    document.getElementById('toggleButton').addEventListener('click', () => {
      this.toggleActive();
    });

    // Configuration changes
    document.getElementById('timestampFormat').addEventListener('change', (e) => {
      const timestampFormat = e.target.checked ? 'relative' : 'absolute';
      this.updateConfig({ timestampFormat: timestampFormat });
      this.toggleTimeConfigVisibility();
    });

    document.getElementById('timeFormat').addEventListener('change', (e) => {
      this.updateConfig({ timeFormat: e.target.value });
    });

    document.getElementById('relativeFormat').addEventListener('change', (e) => {
      this.updateConfig({ relativeFormat: e.target.value });
    });

    document.getElementById('interviewStartTime').addEventListener('change', (e) => {
      this.updateConfig({ interviewStartTime: e.target.value });
    });

    // Timer configuration
    document.getElementById('timerEnabled').addEventListener('change', (e) => {
      this.updateConfig({ timerEnabled: e.target.checked });
      this.toggleTimerConfigVisibility();
    });

    document.getElementById('timerPosition').addEventListener('change', (e) => {
      this.updateConfig({ timerPosition: e.target.value });
    });

    // Theme configuration
    document.getElementById('themeMode').addEventListener('change', (e) => {
      this.updateConfig({ themeMode: e.target.value });
      this.applyTheme();
    });

    // Set to now button
    document.getElementById('setNowButton').addEventListener('click', () => {
      this.setInterviewStartToNow();
    });
  }

  async toggleActive() {
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      // Set interview start time if not already set
      if (!this.config.interviewStartTime) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        this.config.interviewStartTime = `${hours}:${minutes}`;
      }
    }

    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to current tab to set active state
      await chrome.tabs.sendMessage(tab.id, {
        action: 'setActive',
        isActive: this.isActive,
        startTime: this.isActive ? this.config.interviewStartTime : null
      });
      
      this.updateUI();
    } catch (error) {
      console.error('Failed to toggle active state:', error);
      this.isActive = !this.isActive; // Revert on error
    }
  }

  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    try {
      // Save to background script storage
      await chrome.runtime.sendMessage({
        action: 'updateConfig',
        config: this.config
      });
      
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to current tab to update config
      await chrome.tabs.sendMessage(tab.id, {
        action: 'updateConfig',
        config: this.config
      });
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  }

  setInterviewStartToNow() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    document.getElementById('interviewStartTime').value = timeString;
    this.updateConfig({ interviewStartTime: timeString });
  }

  toggleTimeConfigVisibility() {
    const timestampFormat = document.getElementById('timestampFormat').checked ? 'relative' : 'absolute';
    const absoluteConfig = document.getElementById('absoluteTimeConfig');
    const relativeConfig = document.getElementById('relativeTimeConfig');
    
    if (timestampFormat === 'absolute') {
      absoluteConfig.style.display = 'block';
      relativeConfig.style.display = 'none';
    } else {
      absoluteConfig.style.display = 'none';
      relativeConfig.style.display = 'block';
    }
  }

  toggleTimerConfigVisibility() {
    const timerEnabled = document.getElementById('timerEnabled').checked;
    const timerPositionConfig = document.getElementById('timerPositionConfig');
    
    if (timerEnabled) {
      timerPositionConfig.style.display = 'block';
    } else {
      timerPositionConfig.style.display = 'none';
    }
  }

  updateUI() {
    // Update status
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const toggleButton = document.getElementById('toggleButton');
    
    if (this.isActive) {
      statusText.textContent = 'Active';
      statusDot.className = 'status-dot active';
      toggleButton.textContent = 'Stop Interview';
      toggleButton.className = 'toggle-button stop';
    } else {
      statusText.textContent = 'Inactive';
      statusDot.className = 'status-dot inactive';
      toggleButton.textContent = 'Start Interview';
      toggleButton.className = 'toggle-button';
    }

    // Update configuration values
    console.log('Updating UI with config:', this.config);
    document.getElementById('timestampFormat').checked = this.config.timestampFormat === 'relative';
    document.getElementById('timeFormat').value = this.config.timeFormat;
    document.getElementById('relativeFormat').value = this.config.relativeFormat;
    document.getElementById('timerEnabled').checked = this.config.timerEnabled;
    document.getElementById('timerPosition').value = this.config.timerPosition;
    document.getElementById('themeMode').value = this.config.themeMode;
    
    if (this.config.interviewStartTime) {
      document.getElementById('interviewStartTime').value = this.config.interviewStartTime;
    }

    // Update visibility of time config sections
    this.toggleTimeConfigVisibility();
  }

  applyTheme() {
    // Remove existing theme classes
    document.body.classList.remove('dark-theme', 'light-theme');
    
    // Determine theme based on user preference
    if (this.config.themeMode === 'dark') {
      document.body.classList.add('dark-theme');
    } else if (this.config.themeMode === 'light') {
      document.body.classList.add('light-theme');
    } else {
      // Auto mode - follow system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.add('light-theme');
      }
    }
    
    // Listen for system theme changes only in auto mode
    if (this.config.themeMode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        if (this.config.themeMode === 'auto') {
          document.body.classList.remove('dark-theme', 'light-theme');
          if (e.matches) {
            document.body.classList.add('dark-theme');
          } else {
            document.body.classList.add('light-theme');
          }
        }
      });
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
