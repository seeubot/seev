/**
 * Enhanced DevBlocker - Script to protect streams by blocking developer tools access
 * This script will close or redirect the window when developer tools are detected
 */
(function() {
  // Configuration
  const config = {
    debugMode: false,                   // Set to true to show console logs
    forceCloseWindow: true,             // Close the window when devtools detected
    redirectOnDevTools: true,           // Whether to redirect when devtools detected
    redirectUrl: 'about:blank',         // URL to redirect to if developer tools detected 
    blockViewSource: true,              // Block view-source attempts
    blockInspectElement: true,          // Block inspect element attempts
    monitorFrequency: 500,              // How often to check for dev tools (ms)
    maxWarningBeforeAction: 1,          // Max warnings before taking action
    preventUrlLeakage: true,            // Protect video URLs from being easily accessed
    useStrictCSP: true                  // Use strict Content Security Policy
  };
  
  // Variables
  let isDevToolsOpen = false;
  let warningCount = 0;
  let lastAction = 0;
  
  // Debug logging function
  function log(message) {
    if (config.debugMode) {
      console.log(`[DevBlocker] ${message}`);
    }
  }
  
  // Initialize blocker
  function init() {
    log('Initializing Enhanced Developer Tools Blocker');
    
    // Apply Content Security Policy if enabled
    if (config.useStrictCSP) {
      applyCSP();
    }
    
    // Prevent view-source protocol
    if (config.blockViewSource) {
      blockViewSourceProtocol();
    }
    
    // Block context menu and keyboard shortcuts
    attachEventListeners();
    
    // Start detection methods
    startDevToolsDetection();
    
    // Clean URL bar and history
    cleanUrlHistory();
    
    // Protect video elements
    protectVideoElements();
    
    // Add protection against iframe inspection
    protectAgainstFrames();
  }
  
  // Apply strict Content Security Policy
  function applyCSP() {
    try {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "default-src 'self' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline';";
      document.head.appendChild(meta);
    } catch (e) {
      log('CSP application failed: ' + e);
    }
  }
  
  // Block view-source protocol
  function blockViewSourceProtocol() {
    if (window.location.protocol === 'view-source:') {
      window.location.href = config.redirectUrl;
    }
  }
  
  // Clean URL bar and history
  function cleanUrlHistory() {
    try {
      // Replace current URL without query parameters
      if (window.location.search) {
        const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      log('History cleaning failed: ' + e);
    }
  }
  
  // Attach all event listeners
  function attachEventListeners() {
    // Block right-click
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      takeActionOnAttempt();
      return false;
    });
    
    // Block keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // Block F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        takeActionOnAttempt();
        return false;
      }
      
      // Block Ctrl+Shift+I/J/C/K (Chrome/Firefox dev tools)
      if (e.ctrlKey && e.shiftKey && (
        e.key === 'I' || e.key === 'i' || 
        e.key === 'J' || e.key === 'j' ||
        e.key === 'C' || e.key === 'c' ||
        e.key === 'K' || e.key === 'k'
      )) {
        e.preventDefault();
        takeActionOnAttempt();
        return false;
      }
      
      // Block Ctrl+U (view source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        takeActionOnAttempt();
        return false;
      }
      
      // Block Ctrl+S (save page)
      if (e.ctrlKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        return false;
      }
    });
    
    // Block copy/cut/paste events
    ['copy', 'cut', 'paste'].forEach(function(event) {
      document.addEventListener(event, function(e) {
        // Allow in input fields and textareas
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          return true;
        }
        
        e.preventDefault();
        return false;
      });
    });
    
    // Catch unload to check if it's devtools related
    window.addEventListener('beforeunload', function(e) {
      if (isDevToolsOpen) {
        // If devtools are open during unload, do something
        localStorage.setItem('_devtools_detected', 'true');
      }
    });
    
    // Check on load if previous session had devtools
    window.addEventListener('load', function() {
      if (localStorage.getItem('_devtools_detected') === 'true') {
        localStorage.removeItem('_devtools_detected');
        // Could implement some additional protection here
      }
    });
  }
  
  // Check for dev tools using various methods
  function startDevToolsDetection() {
    // Method 1: Size detection
    function checkDevToolsSize() {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      
      if (widthThreshold || heightThreshold) {
        return true;
      }
      return false;
    }
    
    // Method 2: Debugger detection
    function checkDebugger() {
      let devtoolsOpen = false;
      
      // Define a getter
      const element = new Image();
      Object.defineProperty(element, 'id', {
        get: function() {
          devtoolsOpen = true;
          return 'detector';
        }
      });
      
      // Try to trigger the getter
      try {
        console.log(element);
        console.clear();
      } catch (e) {}
      
      return devtoolsOpen;
    }
    
    // Method 3: DevTools orientation detection
    function checkDevToolsOrientation() {
      // Usually, devtools causes either width or height to change dramatically
      const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
      
      if (!window._lastOrientation) {
        window._lastOrientation = orientation;
      } else if (window._lastOrientation !== orientation) {
        window._lastOrientation = orientation;
        // Sudden orientation change might be devtools
        return window.innerWidth < 750;
      }
      
      return false;
    }
    
    // Method 4: Date execution timing
    function checkExecutionTime() {
      const start = new Date();
      debugger; // This statement gets triggered if devtools is open
      const end = new Date();
      const diff = end.getTime() - start.getTime();
      
      return diff > 100; // If execution took longer than 100ms, likely devtools is open
    }
    
    // Combined check function
    function checkDevTools() {
      // Run our detection methods
      const detected = 
        checkDevToolsSize() || 
        checkDebugger() || 
        checkDevToolsOrientation() || 
        (Math.random() > 0.9 && checkExecutionTime()); // Only check execution time occasionally
      
      // If detected, take action
      if (detected) {
        if (!isDevToolsOpen) {
          log('Developer tools detected');
          isDevToolsOpen = true;
          handleDevToolsOpen();
        }
      } else if (isDevToolsOpen) {
        log('Developer tools closed');
        isDevToolsOpen = false;
      }
    }
    
    // Set up continuous monitoring
    setInterval(checkDevTools, config.monitorFrequency);
  }
  
  // When dev tools detected as open
  function handleDevToolsOpen() {
    warningCount++;
    
    // Protect video element immediately
    protectVideoElements();
    
    // Take action based on warning count
    if (warningCount >= config.maxWarningBeforeAction) {
      takeActionOnDevTools();
    }
  }
  
  // Take action when devtools detected
  function takeActionOnDevTools() {
    // Check if we've acted recently to prevent infinite loops
    const now = new Date().getTime();
    if (now - lastAction < 1000) {
      return;
    }
    lastAction = now;
    
    // Close the window
    if (config.forceCloseWindow) {
      // First, destroy the UI
      destroyUI();
      
      // Try multiple methods to close the window
      try {
        window.close();
      } catch (e) {}
      
      // If window.close() is prevented, try alternative methods
      if (config.redirectOnDevTools) {
        window.location.href = config.redirectUrl;
      } else {
        // If can't redirect, at least clear the page
        document.body.innerHTML = '';
        document.title = 'Access Denied';
      }
    } 
    // Or just redirect
    else if (config.redirectOnDevTools) {
      window.location.href = config.redirectUrl;
    }
  }
  
  // Take action when an attempt to access dev tools is detected
  function takeActionOnAttempt() {
    warningCount++;
    
    // Immediate action on direct attempt
    if (warningCount >= config.maxWarningBeforeAction) {
      takeActionOnDevTools();
    }
  }
  
  // Destroy UI to make the content inaccessible
  function destroyUI() {
    try {
      // Remove all sources from video elements
      const videos = document.getElementsByTagName('video');
      for (let i = 0; i < videos.length; i++) {
        videos[i].src = '';
        videos[i].load();
      }
      
      // Clear the page content
      const container = document.querySelector('.container');
      if (container) {
        container.style.display = 'none';
      }
    } catch (e) {
      log('Error destroying UI: ' + e);
    }
  }
  
  // Protect video elements
  function protectVideoElements() {
    try {
      const videos = document.getElementsByTagName('video');
      
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        
        // Store current state
        const videoInfo = {
          src: video.src,
          currentTime: video.currentTime,
          playing: !video.paused
        };
        
        // Store in obfuscated property
        const propName = '_v' + Math.random().toString(36).substring(2);
        window[propName] = videoInfo;
        
        // Override the source getter
        if (config.preventUrlLeakage && video.src) {
          // Only if we haven't already protected it
          if (!video.hasAttribute('data-protected')) {
            const originalSrc = video.src;
            
            // Create a special reference that's harder to find
            Object.defineProperty(video, '_srcRef', {
              value: originalSrc,
              writable: false,
              configurable: false,
              enumerable: false
            });
            
            // Add marker that we've protected this video
            video.setAttribute('data-protected', 'true');
            
            // Override the src property if possible
            try {
              Object.defineProperty(video, 'src', {
                get: function() {
                  // Return empty or fake URL when inspected
                  if (isDevToolsOpen) {
                    return '';
                  }
                  return originalSrc;
                },
                set: function(newSrc) {
                  // Allow legitimate source changes
                  if (newSrc && typeof newSrc === 'string') {
                    Object.defineProperty(this, '_srcRef', {
                      value: newSrc,
                      writable: false,
                      configurable: false,
                      enumerable: false
                    });
                  }
                  this.setAttribute('src', newSrc);
                },
                configurable: false
              });
            } catch (e) {
              log('Error protecting video src: ' + e);
            }
          }
        }
      }
      
      // Also protect the URL input that might contain the stream URL
      const urlInput = document.getElementById('url-input');
      if (urlInput && urlInput.value && !urlInput.hasAttribute('data-protected')) {
        const originalValue = urlInput.value;
        
        // Store real value in hidden property
        Object.defineProperty(urlInput, '_valueRef', {
          value: originalValue,
          writable: true,
          configurable: false,
          enumerable: false
        });
        
        // Mark as protected
        urlInput.setAttribute('data-protected', 'true');
        
        // Override value property
        try {
          const originalValueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          
          Object.defineProperty(urlInput, 'value', {
            get: function() {
              if (isDevToolsOpen) {
                return 'Protected content';
              }
              return this._valueRef || originalValueDesc.get.call(this);
            },
            set: function(newValue) {
              this._valueRef = newValue;
              originalValueDesc.set.call(this, newValue);
            },
            configurable: false
          });
        } catch (e) {
          log('Error protecting URL input: ' + e);
        }
      }
    } catch (e) {
      log('Error in video protection: ' + e);
    }
  }
  
  // Protection against being loaded in frames for inspection
  function protectAgainstFrames() {
    // Prevent framing
    try {
      // Ensure we're the top frame
      if (window.self !== window.top) {
        window.top.location = window.self.location;
      }
      
      // Add frame-breaking headers
      const frameBreaker = document.createElement('meta');
      frameBreaker.httpEquiv = 'X-Frame-Options';
      frameBreaker.content = 'DENY';
      document.head.appendChild(frameBreaker);
    } catch (e) {
      // If we can't access top, we're likely in a cross-origin frame
      // Try to break out or redirect
      try {
        window.location = config.redirectUrl;
      } catch (innerE) {
        log('Frame protection error: ' + innerE);
      }
    }
  }
  
  // Initialize everything when the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
