/**
 * DevBlocker - Script to protect streams by blocking developer tools access
 * This script should be included in the ExoPlayer Web Interface
 */
(function() {
  // Configuration
  const config = {
    debugMode: false,                   // Set to true to show console logs
    redirectOnDevTools: false,          // Whether to redirect when devtools detected
    redirectUrl: 'about:blank',         // URL to redirect to if developer tools detected 
    showWarningMessage: true,           // Show warning when developer tools opened
    warningTitle: 'Developer Tools Detected',
    warningMessage: 'For security reasons, developer tools access is restricted.',
    preventRightClick: true,            // Prevent right click context menu
    preventF12: true,                   // Prevent F12 key for dev tools
    preventCopy: true,                  // Prevent copy/cut commands
    monitorFrequency: 1000,             // How often to check for dev tools (ms)
    maximumWarnings: 3                  // Max warnings before taking action
  };
  
  // Variables
  let isDevToolsOpen = false;
  let warningCount = 0;
  let originalTitle = document.title;
  
  // Debug logging function
  function log(message) {
    if (config.debugMode) {
      console.log(`[DevBlocker] ${message}`);
    }
  }
  
  // Initialize blocker
  function init() {
    log('Initializing Developer Tools Blocker');
    
    // Attach event listeners
    if (config.preventRightClick) {
      document.addEventListener('contextmenu', handleContextMenu);
    }
    
    if (config.preventF12) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    if (config.preventCopy) {
      document.addEventListener('copy', handleCopyEvent);
      document.addEventListener('cut', handleCopyEvent);
    }
    
    // Start detection methods
    startDevToolsDetection();
  }
  
  // Block right-click context menu
  function handleContextMenu(e) {
    e.preventDefault();
    return false;
  }
  
  // Block F12 and other dev tool keyboard shortcuts
  function handleKeyDown(e) {
    // Block F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      warnUser();
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
      warnUser();
      return false;
    }
    
    // Block Ctrl+U (view source)
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
      e.preventDefault();
      warnUser();
      return false;
    }
  }
  
  // Block copy/cut events
  function handleCopyEvent(e) {
    // Allow copy in input fields and textareas
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    
    e.preventDefault();
    return false;
  }
  
  // Check for dev tools using various methods
  function startDevToolsDetection() {
    // Method 1: Size detection
    function checkDevToolsSize() {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      
      // macOS Chrome/Firefox usually has width difference
      // Windows usually has height difference
      if (widthThreshold || heightThreshold) {
        return true;
      }
      return false;
    }
    
    // Method 2: Firebug detection
    function checkFirebug() {
      if (window.console && (window.console.firebug || window.console.table && /firebug/i.test(window.console.table.toString()))) {
        return true;
      }
      return false;
    }
    
    // Method 3: Debug detection
    const element = document.createElement('div');
    Object.defineProperty(element, 'id', {
      get: function() {
        isDevToolsOpen = true;
        return 'devtools-detector';
      }
    });
    
    // Method 4: Console timing detection
    let devToolsTimeout;
    function checkConsoleTimings() {
      const startTime = new Date();
      console.profile('DevToolsDetector');
      console.profileEnd('DevToolsDetector');
      const endTime = new Date();
      
      if (endTime - startTime > 100) {
        return true;
      }
      return false;
    }
    
    // Combined check function
    function checkDevTools() {
      // Don't try to use console.clear as it can be suspicious
      
      try {
        console.log(element);
        console.clear();
      } catch (e) {}
      
      let detected = isDevToolsOpen || 
                     checkDevToolsSize() || 
                     checkFirebug();
      
      // Only use console timing check occasionally as it's more noticeable
      if (!detected && Math.random() > 0.8) {
        detected = checkConsoleTimings();
      }
      
      // Take action if detected
      if (detected) {
        if (!isDevToolsOpen) {
          log('Developer tools detected');
          isDevToolsOpen = true;
          handleDevToolsOpen();
        }
      } else if (isDevToolsOpen) {
        log('Developer tools closed');
        isDevToolsOpen = false;
        handleDevToolsClosed();
      }
    }
    
    // Set up continuous monitoring
    setInterval(checkDevTools, config.monitorFrequency);
  }
  
  // When dev tools detected as open
  function handleDevToolsOpen() {
    if (config.showWarningMessage) {
      warnUser();
    }
    
    // Set warning title
    document.title = config.warningTitle;
    
    // Protect video element and player
    protectVideoElement();
    
    // Redirect if configured
    if (config.redirectOnDevTools && warningCount >= config.maximumWarnings) {
      window.location.href = config.redirectUrl;
    }
  }
  
  // When dev tools detected as closed
  function handleDevToolsClosed() {
    document.title = originalTitle;
  }
  
  // Display warning to user
  function warnUser() {
    warningCount++;
    
    if (warningCount <= config.maximumWarnings) {
      if (config.showWarningMessage) {
        alert(config.warningMessage);
      }
    }
    
    if (warningCount === config.maximumWarnings) {
      // Additional protection when max warnings reached
      obfuscatePlayer();
    }
  }
  
  // Protect video element by cleaning up source references
  function protectVideoElement() {
    try {
      const videoElements = document.getElementsByTagName('video');
      
      for (let i = 0; i < videoElements.length; i++) {
        const video = videoElements[i];
        
        // Create a wrapper for the video info
        const videoInfo = {
          source: video.src,
          currentTime: video.currentTime,
          paused: video.paused
        };
        
        // Store info in an obfuscated variable
        window['_' + Math.random().toString(36).substr(2, 9)] = videoInfo;
        
        // Clear visible source
        if (video.src && video.src.length > 0) {
          // Only clear visible source if we're sure we stored the info
          video.removeAttribute('src');
          video.load();
        }
      }
    } catch (e) {
      log('Error protecting video: ' + e);
    }
  }
  
  // Obfuscate player when max warnings reached
  function obfuscatePlayer() {
    try {
      // Make video element more difficult to inspect
      const playerContainer = document.querySelector('.player-container');
      if (playerContainer) {
        playerContainer.style.opacity = '0.1';
      }
      
      // Mess up player interface to discourage further attempts
      const controls = document.getElementById('player-controls');
      if (controls) {
        controls.style.display = 'none';
      }
    } catch (e) {
      log('Error obfuscating player: ' + e);
    }
  }
  
  // Disable all known dev tools browser extensions
  function disableDevToolsExtensions() {
    // Attempt to disable React, Redux devtools
    try {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };
      window.__REDUX_DEVTOOLS_EXTENSION__ = undefined;
    } catch (e) {}
  }
  
  // Additional protection measures for stream URLs
  function protectStreamUrls() {
    // Override the URL setter in HTMLMediaElement prototype
    try {
      const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
      
      if (originalSrcDescriptor && originalSrcDescriptor.configurable) {
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
          get: originalSrcDescriptor.get,
          set: function(url) {
            // Do something with the URL before setting it
            const obfuscatedUrl = url;
            log('Media source set: [PROTECTED]');
            
            // Store original url in a harder to access form
            this._sourceRef = {
              v: btoa(url.split('').reverse().join(''))
            };
            
            // Call the original setter with the URL
            originalSrcDescriptor.set.call(this, obfuscatedUrl);
          },
          configurable: false,
          enumerable: true
        });
      }
    } catch (e) {
      log('Error protecting URL setter: ' + e);
    }
  }
  
  // Initialize when page is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Apply additional protections
  disableDevToolsExtensions();
  protectStreamUrls();
})();
