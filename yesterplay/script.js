document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const shortcutsContainer = document.getElementById('shortcuts');
    const shortcutsRightContainer = document.getElementById('shortcuts-right');
    const taskbar = document.getElementById('taskbar');
    const startButton = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');
    const startMenuItems = document.getElementById('start-menu-items');
    const taskbarWindows = document.getElementById('taskbar-windows');
    const clock = document.getElementById('clock');
    let config = null;
    let highestZIndex = 100;
    let openWindows = [];

    // Service Worker Registration
    let deferredPrompt;
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
    });

    window.installPWA = function() {
        if (!deferredPrompt) {
            showModal('Installation', 'Installation is not available. You might already have the app installed, or your browser/platform does not support PWA installation.');
            return;
        }
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    };

    // Clock
    function updateClock() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        clock.textContent = `${hours}:${minutes}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Start Menu
    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        startMenu.classList.remove('show');
    });

    startMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    function executeScript(content) {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = content;
        document.body.appendChild(script);
    }

    // Load Config
    async function loadConfig() {
        try {
            const response = await fetch('config.json');
            config = await response.json();
            sessionStorage.setItem('yesterplay_config', JSON.stringify(config));
            initializeDesktop();
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    function initializeDesktop() {
        // Clear existing shortcuts
        shortcutsContainer.innerHTML = '';
        if (shortcutsRightContainer) shortcutsRightContainer.innerHTML = '';
        startMenuItems.innerHTML = '';

        // Populate desktop shortcuts
        config.shortcuts.forEach(item => {
            if (item.enabled === false) return;

            const shortcut = createShortcut(item);
            if (item.align === 'right' && shortcutsRightContainer) {
                shortcutsRightContainer.appendChild(shortcut);
            } else {
                shortcutsContainer.appendChild(shortcut);
            }

            const startMenuItem = createStartMenuItem(item);
            startMenuItems.appendChild(startMenuItem);

            if (item.autostart) {
                openWindow(item);
            }
        });

        // Set background
        const background = sessionStorage.getItem('yesterplay_background') || config.desktop.background;
        desktop.style.backgroundImage = `url(${background})`;

        // Set title
        const title = sessionStorage.getItem('yesterplay_title') || config.desktop.title || 'YesterPlayOS';
        document.title = title;

        // Set theme color
        const themeColor = sessionStorage.getItem('yesterplay_theme_color') || config.desktop.theme_color || '#000080';
        document.documentElement.style.setProperty('--theme-color', themeColor);
    }

    function createShortcut(item) {
        const shortcut = document.createElement('div');
        shortcut.className = 'shortcut';
        shortcut.innerHTML = `<img src="${item.icon}" alt="${item.name}"><span>${item.name}</span>`;
        shortcut.addEventListener('click', () => {
            if (item.js_only) {
                executeScript(item.content);
            } else {
                openWindow(item);
            }
        });
        return shortcut;
    }

    function createStartMenuItem(item) {
        const menuItem = document.createElement('div');
        menuItem.className = 'start-menu-item';
        menuItem.innerHTML = `<img src="${item.icon}" alt="${item.name}"><span>${item.name}</span>`;
        menuItem.addEventListener('click', () => {
            if (item.js_only) {
                executeScript(item.content);
            } else {
                openWindow(item);
            }
            startMenu.classList.remove('show');
        });
        return menuItem;
    }

    function bringToFront(windowData) {
        highestZIndex++;
        windowData.windowEl.style.zIndex = highestZIndex;
        windowData.windowEl.style.display = 'flex'; // Un-minimize if hidden
        updateActiveWindow(windowData);
        
        // Ensure modals stay on top
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            modal.style.zIndex = highestZIndex + 1000;
        });
    }

    function openWindow(item) {
        // Check if a window for this item is already open
        const existingWindowData = openWindows.find(w => w.item.name === item.name);
        if (existingWindowData) {
            bringToFront(existingWindowData);
            return;
        }

        const windowId = `window-${Date.now()}`;
        const windowEl = document.createElement('div');
        windowEl.id = windowId;
        windowEl.className = 'window';

        // Calculate size and position
        const desktopWidth = desktop.offsetWidth;
        const desktopHeight = desktop.offsetHeight;
        
        const windowWidth = Math.min(600, desktopWidth * 0.9);
        const windowHeight = Math.min(400, desktopHeight * 0.9);

        const maxLeft = Math.max(0, desktopWidth - windowWidth);
        const maxTop = Math.max(0, desktopHeight - windowHeight);

        const randomLeft = Math.floor(Math.random() * maxLeft);
        const randomTop = Math.floor(Math.random() * maxTop);

        windowEl.style.left = `${randomLeft}px`;
        windowEl.style.top = `${randomTop}px`;
        windowEl.style.width = `${windowWidth}px`;
        windowEl.style.height = `${windowHeight}px`;

        windowEl.innerHTML = `
            <div class="window-header">
                <div class="window-header-title-container">
                    <img src="${item.icon}" class="window-header-icon">
                    <span class="window-title">${item.name}</span>
                </div>
                <div class="window-controls">
                    <button class="minimize">_</button>
                    <button class="maximize">□</button>
                    <button class="close">X</button>
                </div>
            </div>
            <div class="window-body">
                ${item.content}
            </div>
        `;

        desktop.appendChild(windowEl);

        // Taskbar button
        const taskbarButton = document.createElement('div');
        taskbarButton.id = `taskbar-${windowId}`;
        taskbarButton.className = 'taskbar-window';
        taskbarButton.innerHTML = `<img src="${item.icon}" class="taskbar-window-icon"><span>${item.name}</span>`;
        taskbarWindows.appendChild(taskbarButton);

        const windowData = { 
            id: windowId, 
            windowEl, 
            taskbarButton, 
            item,
            isMaximized: false,
            restoreInfo: null
        };
        openWindows.push(windowData);

        bringToFront(windowData);

        taskbarButton.addEventListener('click', () => {
            if (windowEl.style.display === 'none') {
                bringToFront(windowData);
            } else if (windowData.taskbarButton.classList.contains('active')) {
                // Already front, so minimize
                windowEl.style.display = 'none';
                updateActiveWindow(null);
            } else {
                bringToFront(windowData);
            }
        });

        const onWindowFocus = () => {
            bringToFront(windowData);
        };

        windowEl.addEventListener('mousedown', onWindowFocus);
        windowEl.addEventListener('touchstart', onWindowFocus, { passive: true });

        // Execute scripts in content
        const scripts = windowEl.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });

        const header = windowEl.querySelector('.window-header');
        const closeButton = windowEl.querySelector('.close');
        const minimizeButton = windowEl.querySelector('.minimize');
        const maximizeButton = windowEl.querySelector('.maximize');
        const video = windowEl.querySelector('video');

        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (video) {
                video.pause();
            }
            desktop.removeChild(windowEl);
            taskbarWindows.removeChild(taskbarButton);
            openWindows = openWindows.filter(w => w.id !== windowId);
        });

        minimizeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            windowEl.style.display = 'none';
            updateActiveWindow(null);
        });

        maximizeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMaximize(windowData);
        });

        header.addEventListener('dblclick', () => {
            toggleMaximize(windowData);
        });

        makeDraggable(windowEl, header, windowData);
        makeResizable(windowEl, windowData);
    }

    function toggleMaximize(windowData) {
        const win = windowData.windowEl;
        if (!windowData.isMaximized) {
            // Save restore state
            windowData.restoreInfo = {
                left: win.style.left,
                top: win.style.top,
                width: win.style.width,
                height: win.style.height
            };
            win.style.left = '0';
            win.style.top = '0';
            win.style.width = '100%';
            win.style.height = '100%';
            win.classList.add('maximized');
            windowData.isMaximized = true;
        } else {
            // Restore
            const info = windowData.restoreInfo;
            win.style.left = info.left;
            win.style.top = info.top;
            win.style.width = info.width;
            win.style.height = info.height;
            win.classList.remove('maximized');
            windowData.isMaximized = false;
        }
    }

    function updateActiveWindow(activeWindow) {
        openWindows.forEach(w => {
            if (activeWindow && w.id === activeWindow.id) {
                w.taskbarButton.classList.add('active');
            } else {
                w.taskbarButton.classList.remove('active');
            }
        });
    }

    function makeDraggable(element, handle, windowData) {
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        const onMove = (e) => {
            if (isDragging) {
                const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
                const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
                element.style.left = (clientX - dragOffsetX) + 'px';
                element.style.top = (clientY - dragOffsetY) + 'px';
                if (e.type === 'touchmove') {
                    e.preventDefault();
                }
            }
        };

        const onEnd = () => {
            if (isDragging) {
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('mouseup', onEnd);
                document.removeEventListener('touchend', onEnd);
            }
        };

        const onStart = (e) => {
            if (windowData.isMaximized) return; // Can't drag maximized window
            if (e.target.classList.contains('resize-handle') || e.target.closest('button')) {
                return;
            }
            isDragging = true;
            const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
            dragOffsetX = clientX - element.offsetLeft;
            dragOffsetY = clientY - element.offsetTop;

            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchend', onEnd);
        };

        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: false });
    }

    function makeResizable(element, windowData) {
        const handles = ['se', 's', 'e'];
        handles.forEach(handleName => {
            const handle = document.createElement('div');
            handle.className = `resize-handle handle-${handleName}`;
            element.appendChild(handle);

            const onStart = (e) => {
                if (windowData.isMaximized) return; // Can't resize maximized window
                e.stopPropagation();
                let isResizing = true;
                const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
                const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
                const startX = clientX;
                const startY = clientY;
                const startWidth = element.offsetWidth;
                const startHeight = element.offsetHeight;
                const minWidth = parseInt(getComputedStyle(element).minWidth) || 200;
                const minHeight = parseInt(getComputedStyle(element).minHeight) || 150;

                const onMove = (e) => {
                    if (isResizing) {
                        const moveClientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
                        const moveClientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
                        const dx = moveClientX - startX;
                        const dy = moveClientY - startY;

                        if (handleName.includes('e')) {
                            element.style.width = `${Math.max(minWidth, startWidth + dx)}px`;
                        }
                        if (handleName.includes('s')) {
                            element.style.height = `${Math.max(minHeight, startHeight + dy)}px`;
                        }
                        if (e.type === 'touchmove') {
                            e.preventDefault();
                        }
                    }
                };

                const onEnd = () => {
                    isResizing = false;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onEnd);
                    document.removeEventListener('touchmove', onMove);
                    document.removeEventListener('touchend', onEnd);
                };

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onEnd);
                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('touchend', onEnd);
            };

            handle.addEventListener('mousedown', onStart);
            handle.addEventListener('touchstart', onStart, { passive: false });
        });
    }

    window.showModal = function(title, message, type = 'info', onConfirm = null) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.zIndex = highestZIndex + 1000;

        let footerContent = `<button class="win95-button" id="modal-ok">OK</button>`;
        if (type === 'confirm') {
            footerContent = `
                <button class="win95-button" id="modal-yes" style="margin-right: 10px;">Yes</button>
                <button class="win95-button" id="modal-no">No</button>
            `;
        }

        modalOverlay.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">${title}</div>
                <div class="modal-body">${message}</div>
                <div class="modal-footer">
                    ${footerContent}
                </div>
            </div>
        `;

        desktop.appendChild(modalOverlay);

        if (type === 'confirm') {
            modalOverlay.querySelector('#modal-yes').addEventListener('click', () => {
                desktop.removeChild(modalOverlay);
                if (onConfirm) onConfirm();
            });
            modalOverlay.querySelector('#modal-no').addEventListener('click', () => {
                desktop.removeChild(modalOverlay);
            });
        } else {
            modalOverlay.querySelector('#modal-ok').addEventListener('click', () => {
                desktop.removeChild(modalOverlay);
            });
        }
    }

    window.showColorPicker = function(title, onSelect) {
        const colors = [];
        // Generate a 256 color palette (approx)
        for (let r = 0; r < 256; r += 51) {
            for (let g = 0; g < 256; g += 51) {
                for (let b = 0; b < 256; b += 51) {
                    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
                    colors.push(hex);
                }
            }
        }
        for (let i = 10; i < 255; i += 6) {
            const v = i.toString(16).padStart(2, '0');
            const hex = `#${v}${v}${v}`;
            if (!colors.includes(hex)) colors.push(hex);
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.zIndex = 100000000; // Even higher

        modalOverlay.innerHTML = `
            <div class="modal-dialog" style="width: auto; max-width: 350px;">
                <div class="modal-header">${title}</div>
                <div class="modal-body" style="padding: 10px; background: #c0c0c0;">
                    <div id="color-palette" style="display: grid; grid-template-columns: repeat(16, 1fr); gap: 1px; background: #000; padding: 1px; border: 2px inset;">
                        ${colors.slice(0, 256).map(c => `<div class="color-swatch" style="background: ${c}; width: 15px; height: 15px; cursor: pointer;" title="${c}" data-color="${c}"></div>`).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="win95-button" id="modal-cancel">Cancel</button>
                </div>
            </div>
        `;

        desktop.appendChild(modalOverlay);

        modalOverlay.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = swatch.getAttribute('data-color');
                desktop.removeChild(modalOverlay);
                if (onSelect) onSelect(color);
            });
        });

        modalOverlay.querySelector('#modal-cancel').addEventListener('click', () => {
            desktop.removeChild(modalOverlay);
        });
    }

    // Always load the latest config to get new shortcuts
    sessionStorage.removeItem('yesterplay_config');
    loadConfig();
});
