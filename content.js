// Content script for real-time text processing
class InterviewFillAssistant {
  constructor() {
    this.isActive = false;
    this.config = {
      timestampFormat: 'absolute',
      timeFormat: 'HH:mm:ss',
      interviewStartTime: null,
      relativeFormat: 'mm:ss',
      timerEnabled: true,
      timerPosition: 'top-right',
      postCooldown: 5
    };
    this.timerElement = null;
    this.timerInterval = null;
    this.lastTimestampTime = 0; // Track when last timestamp was added
    this.initialize();
  }

  async initialize() {
    // Get initial state from background script
    const response = await chrome.runtime.sendMessage({ action: 'getState' });
    this.isActive = response.isActiveInThisTab || false; // Only active in the specific tab
    this.config = {
      timestampFormat: response.timestampFormat || 'absolute',
      timeFormat: response.timeFormat || 'HH:mm:ss',
      interviewStartTime: response.interviewStartTime,
      relativeFormat: response.relativeFormat || 'mm:ss',
      timerEnabled: response.timerEnabled !== false,
      timerPosition: response.timerPosition || 'top-right',
      themeMode: response.themeMode || 'auto',
      postCooldown: response.postCooldown || 5
    };

    // Listen for state changes and popup messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'stateChanged') {
        this.handleStateChange(request.changes, request.isActiveInThisTab);
      } else if (request.action === 'getState') {
        // Handle getState requests from popup
        sendResponse({
          isActiveInThisTab: this.isActive,
          timestampFormat: this.config.timestampFormat,
          timeFormat: this.config.timeFormat,
          interviewStartTime: this.config.interviewStartTime,
          relativeFormat: this.config.relativeFormat,
          timerEnabled: this.config.timerEnabled,
          timerPosition: this.config.timerPosition,
          themeMode: this.config.themeMode,
          postCooldown: this.config.postCooldown
        });
      } else if (request.action === 'setActive') {
        // Handle setActive requests from popup
        this.isActive = request.isActive;
        if (request.isActive && request.startTime) {
          this.config.interviewStartTime = request.startTime;
        }
        this.updateTimerDisplay();
        sendResponse({ success: true });
      } else if (request.action === 'updateConfig') {
        // Handle updateConfig requests from popup
        this.config = { ...this.config, ...request.config };
        this.updateTimerDisplay();
        sendResponse({ success: true });
      }
    });

    // Set up text input listeners
    this.setupTextListeners();
  }

  handleStateChange(changes, isActiveInThisTab) {
    if (changes.isActive) {
      this.isActive = isActiveInThisTab || false; // Only active in the specific tab
      this.updateTimerDisplay();
    }
    if (changes.timestampFormat) {
      this.config.timestampFormat = changes.timestampFormat.newValue;
    }
    if (changes.timeFormat) {
      this.config.timeFormat = changes.timeFormat.newValue;
    }
    if (changes.interviewStartTime) {
      this.config.interviewStartTime = changes.interviewStartTime.newValue;
    }
    if (changes.relativeFormat) {
      this.config.relativeFormat = changes.relativeFormat.newValue;
    }
    if (changes.timerEnabled) {
      this.config.timerEnabled = changes.timerEnabled.newValue;
      this.updateTimerDisplay();
    }
    if (changes.timerPosition) {
      this.config.timerPosition = changes.timerPosition.newValue;
      this.updateTimerDisplay();
    }
    if (changes.themeMode) {
      this.config.themeMode = changes.themeMode.newValue;
      this.updateTimerDisplay();
    }
    if (changes.postCooldown) {
      this.config.postCooldown = changes.postCooldown.newValue;
    }
  }

  setupTextListeners() {
    // Listen for input events on text areas and contenteditable elements
    document.addEventListener('input', (event) => {
      if (!this.isActive) return;
      
      const target = event.target;
      if (this.isTextInput(target)) {
        this.handleTextInput(target, event);
      }
    });

    // Listen for keydown events to detect line breaks
    document.addEventListener('keydown', (event) => {
      if (!this.isActive) return;
      
      if (event.key === 'Enter' && this.isTextInput(event.target)) {
        this.handleLineBreak(event.target);
      }
    });

    // Listen for focus changes to update timer position
    document.addEventListener('focusin', (event) => {
      if (this.isActive) {
        this.handleFocusChange();
      }
    });

    document.addEventListener('focusout', (event) => {
      if (this.isActive) {
        this.handleFocusChange();
      }
    });
  }

  isTextInput(element) {
    return element.tagName === 'TEXTAREA' || 
           element.tagName === 'INPUT' && element.type === 'text' ||
           element.contentEditable === 'true' ||
           element.isContentEditable;
  }

  handleLineBreak(element) {
    // Set a flag to indicate we need to add timestamp on next non-whitespace input
    element.dataset.needsTimestamp = 'true';
  }

  handleTextInput(element, event) {
    if (element.dataset.needsTimestamp === 'true') {
      const inputValue = event.data;
      
      // Check if the input is non-whitespace
      if (inputValue && inputValue.trim() !== '') {
        // Check cooldown before adding timestamp
        const now = Date.now();
        const timeSinceLastTimestamp = (now - this.lastTimestampTime) / 1000; // Convert to seconds
        
        if (timeSinceLastTimestamp >= this.config.postCooldown) {
          this.addTimestamp(element);
          this.lastTimestampTime = now; // Update last timestamp time
          element.dataset.needsTimestamp = 'false';
        } else {
          // Still in cooldown, keep the flag for next input
          console.log(`Timestamp cooldown active: ${Math.ceil(this.config.postCooldown - timeSinceLastTimestamp)}s remaining`);
        }
      }
    }
  }

  addTimestamp(element) {
    try {
      const timestamp = this.getFormattedTimestamp();
      
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        // For input/textarea elements, use precise cursor positioning
        const currentValue = this.getElementValue(element);
        const cursorPosition = this.getCursorPosition(element);
        
        // Insert timestamp at the beginning of the current line
        const lines = currentValue.split('\n');
        const currentLineIndex = currentValue.substring(0, cursorPosition).split('\n').length - 1;
        
        if (currentLineIndex < lines.length) {
          lines[currentLineIndex] = timestamp + lines[currentLineIndex];
          const newValue = lines.join('\n');
          this.setElementValue(element, newValue);
          
          // Adjust cursor position safely
          const newCursorPosition = cursorPosition + timestamp.length;
          const maxPosition = newValue.length;
          const safePosition = Math.min(newCursorPosition, maxPosition);
          
          // Use setTimeout to ensure DOM is updated before setting cursor
          setTimeout(() => {
            this.setCursorPosition(element, safePosition);
          }, 0);
        }
      } else {
        // For contenteditable elements, use simpler approach
        // Just add timestamp at the end to avoid cursor positioning issues
        const currentValue = this.getElementValue(element);
        const newValue = currentValue + '\n' + timestamp + ' ';
        this.setElementValue(element, newValue);
        
        // Focus the element and place cursor at the end
        setTimeout(() => {
          element.focus();
          this.setCursorPosition(element, newValue.length);
        }, 0);
      }
    } catch (error) {
      console.warn('Failed to add timestamp:', error);
      // Fallback: just add timestamp at the end
      const timestamp = this.getFormattedTimestamp();
      const currentValue = this.getElementValue(element);
      this.setElementValue(element, currentValue + '\n' + timestamp + ' ');
    }
  }

  getFormattedTimestamp() {
    const now = new Date();
    
    if (this.config.timestampFormat === 'relative' && this.config.interviewStartTime) {
      // Parse the time string (HH:MM[:SS] format)
      const parts = this.config.interviewStartTime.split(':').map(Number);
      const hours = parts[0] || 0;
      const minutes = parts[1] || 0;
      const seconds = parts[2] || 0;
      const startTime = new Date();
      startTime.setHours(hours, minutes, seconds, 0);
      
      // If the start time is in the future (next day), subtract 24 hours
      if (startTime > now) {
        startTime.setDate(startTime.getDate() - 1);
      }
      
      const elapsed = now - startTime;
      console.log('Relative timestamp calculation:', {
        interviewStartTime: this.config.interviewStartTime,
        hours, minutes,
        startTime: startTime.toISOString(),
        now: now.toISOString(),
        elapsed: elapsed
      });
      return this.formatRelativeTime(elapsed);
    } else {
      return this.formatAbsoluteTime(now);
    }
  }

  formatAbsoluteTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    if (this.config.timeFormat === 'HH:mm:ss') {
      return `[${hours}:${minutes}:${seconds}] `;
    } else if (this.config.timeFormat === 'HH:mm') {
      return `[${hours}:${minutes}] `;
    } else {
      return `[${date.toLocaleTimeString()}] `;
    }
  }

  formatRelativeTime(elapsedMs) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    console.log('formatRelativeTime:', {
      elapsedMs,
      totalSeconds,
      minutes,
      seconds,
      relativeFormat: this.config.relativeFormat
    });
    
    if (this.config.relativeFormat === 'mm:ss') {
      return `[+${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}] `;
    } else {
      return `[+${totalSeconds}s] `;
    }
  }

  // Format relative time specifically for timer display (always mm:ss)
  formatTimerRelativeTime(elapsedMs) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  getElementValue(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value;
    } else {
      return element.textContent || element.innerText;
    }
  }

  setElementValue(element, value) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = value;
    } else {
      // For contenteditable elements, preserve the structure better
      try {
        element.textContent = value;
      } catch (error) {
        console.warn('Failed to set element value:', error);
        // Fallback: try innerHTML
        element.innerHTML = value.replace(/\n/g, '<br>');
      }
    }
  }

  getCursorPosition(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.selectionStart || 0;
    } else {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;
        
        // Handle different node types
        if (startContainer.nodeType === Node.TEXT_NODE) {
          return range.startOffset;
        } else {
          // For non-text nodes, try to find the text position
          const textContent = element.textContent || '';
          return Math.min(range.startOffset, textContent.length);
        }
      }
      return 0;
    }
  }

  setCursorPosition(element, position) {
    try {
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        // Ensure position is within bounds
        const maxPosition = element.value.length;
        const safePosition = Math.min(Math.max(0, position), maxPosition);
        element.setSelectionRange(safePosition, safePosition);
      } else {
        // For contenteditable elements, use a simpler approach
        // Just focus the element and place cursor at the end
        element.focus();
        
        // Try to place cursor at the end of the content
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          
          // Find the last text node in the element
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let lastTextNode = null;
          let node;
          while (node = walker.nextNode()) {
            lastTextNode = node;
          }
          
          if (lastTextNode) {
            const range = document.createRange();
            const textLength = lastTextNode.textContent.length;
            const safeOffset = Math.min(position, textLength);
            range.setStart(lastTextNode, safeOffset);
            range.setEnd(lastTextNode, safeOffset);
            selection.addRange(range);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to set cursor position:', error);
      // Fallback: just focus the element
      element.focus();
    }
  }

  updateTimerDisplay() {
    // Remove existing timer
    if (this.timerElement) {
      this.timerElement.remove();
      this.timerElement = null;
    }
    
    // Clear existing interval
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Don't show timer if disabled
    if (!this.config.timerEnabled) {
      return;
    }

    // Create timer element
    this.timerElement = document.createElement('div');
    this.timerElement.id = 'interview-timer';
    this.timerElement.style.cssText = this.getTimerStyles();
    
    // Create timer content with button
    this.timerElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span id="timer-text" style="pointer-events: none;">00:00</span>
        <button id="timer-toggle-btn" style="
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
          pointer-events: auto;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">Start</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(this.timerElement);
    
    // Add button click handler
    const toggleBtn = this.timerElement.querySelector('#timer-toggle-btn');
    toggleBtn.addEventListener('click', () => {
      this.toggleInterviewFromTimer();
    });
    
    // Start timer update
    this.updateTimerText();
    this.timerInterval = setInterval(() => {
      this.updateTimerText();
    }, 1000);
  }

  getTimerStyles() {
    // Determine theme based on user preference
    let shouldUseDarkTheme = false;
    
    if (this.config.themeMode === 'dark') {
      shouldUseDarkTheme = true;
    } else if (this.config.themeMode === 'light') {
      shouldUseDarkTheme = false;
    } else {
      // Auto mode - follow system preference
      shouldUseDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    const baseStyles = `
      position: fixed;
      z-index: 10000;
      background: ${shouldUseDarkTheme ? 'rgba(45, 45, 45, 0.95)' : 'rgba(52, 152, 219, 0.95)'};
      color: ${shouldUseDarkTheme ? '#e0e0e0' : 'white'};
      padding: 8px 12px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: ${shouldUseDarkTheme ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.2)'};
      border: 1px solid ${shouldUseDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'};
      backdrop-filter: blur(10px);
      user-select: none;
      transition: all 0.3s ease;
    `;

    const positionStyles = {
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;',
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'over-focused': 'top: 50%; left: 50%; transform: translate(-50%, -50%);'
    };

    return baseStyles + (positionStyles[this.config.timerPosition] || positionStyles['top-right']);
  }

  updateTimerText() {
    if (!this.timerElement) return;

    const timerText = this.timerElement.querySelector('#timer-text');
    const toggleBtn = this.timerElement.querySelector('#timer-toggle-btn');
    
    if (!timerText || !toggleBtn) return;

    const now = new Date();
    let displayText = '';

    // Update button text based on interview state
    toggleBtn.textContent = this.isActive ? 'Stop' : 'Start';

    // Timer shows different content based on interview state
    if (this.isActive && this.config.interviewStartTime) {
      // Parse the time string (HH:MM[:SS] format)
      const parts = this.config.interviewStartTime.split(':').map(Number);
      const hours = parts[0] || 0;
      const minutes = parts[1] || 0;
      const seconds = parts[2] || 0;
      const startTime = new Date();
      startTime.setHours(hours, minutes, seconds, 0);
      
      // If the start time is in the future (next day), subtract 24 hours
      if (startTime > now) {
        startTime.setDate(startTime.getDate() - 1);
      }
      
      const elapsed = now - startTime;
      displayText = this.formatTimerRelativeTime(elapsed);
    } else {
      // Show current time when not active
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      displayText = `${hours}:${minutes}`;
    }

    timerText.textContent = displayText;
  }

  async toggleInterviewFromTimer() {
    try {
      // Toggle the interview state
      this.isActive = !this.isActive;
      
      if (this.isActive) {
        // Set interview start time to now when starting
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        this.config.interviewStartTime = `${hours}:${minutes}:${seconds}`;
      }
      
      // Send message to background script to update state
      await chrome.runtime.sendMessage({
        action: 'setActive',
        isActive: this.isActive,
        startTime: this.isActive ? this.config.interviewStartTime : null
      });
      
      // Update timer display
      this.updateTimerText();
      
    } catch (error) {
      console.error('Failed to toggle interview from timer:', error);
      // Revert state on error
      this.isActive = !this.isActive;
    }
  }

  // Handle timer positioning over focused element
  handleFocusChange() {
    if (this.config.timerPosition === 'over-focused' && this.timerElement) {
      const focusedElement = document.activeElement;
      if (this.isTextInput(focusedElement)) {
        const rect = focusedElement.getBoundingClientRect();
        this.timerElement.style.top = `${rect.top - 40}px`;
        this.timerElement.style.left = `${rect.left}px`;
        this.timerElement.style.transform = 'none';
      }
    }
  }
}

// Initialize the assistant when the content script loads
const assistant = new InterviewFillAssistant();
