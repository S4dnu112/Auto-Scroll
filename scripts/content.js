let scrollInterval = null;
let isScrolling = false;
let currentPixelsPerSecond = 50;

let currentScrollType = 'continuous';
let currentStepInterval = 2;
let currentReverseScroll = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PING") {
    sendResponse({ status: "ok" });
  } else if (request.action === "START_SCROLL") {
    startScrolling(request.speed, request.scrollType, request.stepInterval, request.reverseScroll);
    sendResponse({ status: "started", isScrolling: true });
    // Notify background of state change
    chrome.runtime.sendMessage({ action: "UPDATE_STATE", isScrolling: true });
  } else if (request.action === "STOP_SCROLL") {
    stopScrolling();
    sendResponse({ status: "stopped", isScrolling: false });
    // Notify background of state change
    chrome.runtime.sendMessage({ action: "UPDATE_STATE", isScrolling: false });
  } else if (request.action === "GET_STATUS") {
    sendResponse({ isScrolling: isScrolling });
  }
  return true;
});

function startScrolling(speed, scrollType, stepInterval, reverseScroll) {
  stopScrolling();
  isScrolling = true;
  currentScrollType = scrollType || 'continuous';
  currentStepInterval = stepInterval || 2;
  currentReverseScroll = reverseScroll || false;
  startPixelScroll(speed);
}

function stopScrolling() {
  isScrolling = false;
  if (scrollInterval) {
    cancelAnimationFrame(scrollInterval);
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
}

function startPixelScroll(speed) {
  if (speed !== null) {
    currentPixelsPerSecond = speed;
  }

  if (scrollInterval) {
    cancelAnimationFrame(scrollInterval);
    clearInterval(scrollInterval);
    scrollInterval = null;
  }

  if (currentScrollType === 'continuous') {
    let lastTime = performance.now();
    let accumulatedScroll = 0;

    function step(currentTime) {
      if (!isScrolling) return;

      const deltaTime = (currentTime - lastTime) / 1000; // miliseconds
      lastTime = currentTime;

      const pixelsToScroll = currentPixelsPerSecond * deltaTime;
      accumulatedScroll += pixelsToScroll;

      if (accumulatedScroll >= 1) {
        const pixelsToMove = Math.floor(accumulatedScroll);
        const pixels = pixelsToMove * (currentReverseScroll ? -1 : 1);

        const target = getScrollTarget();
        if (target === window) {
          window.scrollBy(0, pixels);
        } else {
          target.scrollTop += pixels;
        }

        accumulatedScroll -= pixelsToMove;
      }

      scrollInterval = requestAnimationFrame(step);
    }

    scrollInterval = requestAnimationFrame(step);

  } else {
    function doStep() {
      if (!isScrolling) return;
      const pixels = Math.floor(currentPixelsPerSecond * currentStepInterval) * (currentReverseScroll ? -1 : 1);

      const target = getScrollTarget();
      if (target === window) {
        window.scrollBy(0, pixels);
      } else {
        target.scrollTop += pixels;
      }
    }
    scrollInterval = setInterval(doStep, currentStepInterval * 1000);
  }
}

function getScrollTarget() {
  const allElements = document.getElementsByTagName('*');
  let maxScrollHeight = 0;
  let maxElement = window;

  if (document.documentElement.scrollHeight > window.innerHeight &&
    getComputedStyle(document.body).overflowY !== 'hidden' &&
    getComputedStyle(document.documentElement).overflowY !== 'hidden') {
  }

  for (let el of allElements) {
    const style = window.getComputedStyle(el);
    const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll');
    const hasScrollableContent = el.scrollHeight > el.clientHeight;

    if (isScrollable && hasScrollableContent) {
      if (el.scrollHeight > maxScrollHeight) {
        maxScrollHeight = el.scrollHeight;
        maxElement = el;
      }
    }
  }

  if (maxElement !== window && maxElement.clientHeight > window.innerHeight * 0.5) {
    return maxElement;
  }

  return window;
}
