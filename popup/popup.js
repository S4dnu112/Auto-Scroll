document.addEventListener('DOMContentLoaded', () => {
    const pixelSlider = document.getElementById('pixel-speed');
    const pixelValue = document.getElementById('pixel-value');
    const toggleBtn = document.getElementById('toggle-btn');
    const mainView = document.getElementById('main-view');
    const errorView = document.getElementById('error-view');
    const typeRadios = document.getElementsByName('scrollType');
    const stepIntervalControl = document.getElementById('step-interval-control');
    const stepIntervalSlider = document.getElementById('step-interval');
    const stepIntervalValue = document.getElementById('step-interval-value');
    const hotkeyInput = document.getElementById('hotkey-input');

    chrome.storage.sync.get(['hotkey'], (data) => {
        if (data.hotkey) {
            hotkeyInput.value = data.hotkey;
        }
    });

    hotkeyInput.addEventListener('input', (e) => {
        let value = e.target.value.toLowerCase();
        if (value.length > 0) {
            value = value[value.length - 1];
            e.target.value = value;
            chrome.storage.sync.set({ hotkey: value });
        }
    });

    hotkeyInput.addEventListener('keydown', (e) => {
        e.preventDefault();
        const key = e.key.toLowerCase();
        if (key.length === 1 && key.match(/[a-z]/)) {
            hotkeyInput.value = key;
            chrome.storage.sync.set({ hotkey: key });
        }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab) return;

        const url = tab.url;
        const restricted = [
            'chrome://',
            'edge://',
            'brave://',
            'about:',
            'view-source:',
            'https://chrome.google.com/webstore',
            'https://chromewebstore.google.com'
        ];

        const isRestricted = restricted.some(protocol => url.startsWith(protocol));

        if (isRestricted) {
            mainView.style.display = 'none';
            errorView.style.display = 'block';
        } else {
            chrome.tabs.sendMessage(tab.id, { action: "PING" }, (response) => {
                if (chrome.runtime.lastError) {
                }
            });
        }
    });

    chrome.storage.sync.get(['pixelSpeed', 'scrollType', 'stepInterval'], (data) => {
        if (data.pixelSpeed) {
            pixelSlider.value = data.pixelSpeed;
            pixelValue.textContent = data.pixelSpeed;
        }
        if (data.scrollType === 'step') {
            typeRadios[1].checked = true;
            stepIntervalControl.style.display = 'block';
        } else {
            typeRadios[0].checked = true;
            stepIntervalControl.style.display = 'none';
        }
        if (data.stepInterval) {
            stepIntervalSlider.value = data.stepInterval;
            stepIntervalValue.textContent = data.stepInterval;
        }
    });

    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const scrollType = e.target.value;
            chrome.storage.sync.set({ scrollType: scrollType });

            if (scrollType === 'step') {
                stepIntervalControl.style.display = 'block';
            } else {
                stepIntervalControl.style.display = 'none';
            }
        });
    });

    stepIntervalSlider.addEventListener('input', (e) => {
        stepIntervalValue.textContent = e.target.value;
        chrome.storage.sync.set({ stepInterval: parseFloat(e.target.value) });
    });

    pixelSlider.addEventListener('input', (e) => {
        pixelValue.textContent = e.target.value;
        chrome.storage.sync.set({ pixelSpeed: parseInt(e.target.value) });
    });

    function updateButtonStates(isScrolling) {
        if (isScrolling) {
            toggleBtn.classList.remove('primary');
            toggleBtn.classList.add('secondary');
            toggleBtn.textContent = 'Stop';
        } else {
            toggleBtn.classList.remove('secondary');
            toggleBtn.classList.add('primary');
            toggleBtn.textContent = 'Start';
        }
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "GET_STATUS" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Status check failed:', chrome.runtime.lastError.message);
                    updateButtonStates(false);
                    return;
                }
                if (response && response.isScrolling !== undefined) {
                    updateButtonStates(response.isScrolling);
                }
            });
        }
    });

    toggleBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const isCurrentlyScrolling = toggleBtn.classList.contains('secondary');
        
        const sendMessage = (message, callback) => {
            chrome.tabs.sendMessage(tab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['scripts/content.js']
                    }).then(() => {
                        chrome.tabs.sendMessage(tab.id, message, callback);
                    }).catch((err) => {
                        console.log('Failed to inject script:', err);
                    });
                } else {
                    callback(response);
                }
            });
        };
        
        if (isCurrentlyScrolling) {
            sendMessage({ action: "STOP_SCROLL" }, (response) => {
                if (response) updateButtonStates(false);
            });
        } else {
            const speed = parseInt(pixelSlider.value);
            const scrollType = document.querySelector('input[name="scrollType"]:checked').value;
            const stepInterval = parseFloat(stepIntervalSlider.value);
            
            sendMessage({
                action: "START_SCROLL",
                speed: speed,
                scrollType: scrollType,
                stepInterval: stepInterval
            }, (response) => {
                if (response) updateButtonStates(true);
            });
        }
    });
});
