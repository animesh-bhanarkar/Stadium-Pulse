/**
 * StadiumPulse Fan Guide JS Companion
 * Handles chat interactions with Gemini, quick-chips submit, and accessible modal navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
    let chatHistory = [];

    // DOM Elements - Chat
    const fanChatForm = document.getElementById('fan-chat-form');
    const fanChatInput = document.getElementById('fan-chat-input');
    const fanChatMessages = document.getElementById('fan-chat-messages');
    const quickChips = document.querySelectorAll('.quick-chip');

    // DOM Elements - Modals
    const modalButtons = document.querySelectorAll('[data-modal]');
    const modalOverlays = document.querySelectorAll('.modal-overlay');
    const modalCloses = document.querySelectorAll('.modal-close');

    // Track active trigger element to restore keyboard focus on close
    let lastActiveElement = null;

    // Handle Chat Submit
    async function handleChatSubmit(messageText) {
        if (!messageText) return;

        // Render User Bubble
        appendChatMessage('staff', messageText); // user styled bubble (represented as staff class in css)
        fanChatInput.value = '';

        const userTurn = { role: 'user', parts: [{ text: messageText }] };
        const typingIndicator = showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText, history: chatHistory })
            });

            if (!response.ok) {
                throw new Error('AI Service temporary outage.');
            }

            const data = await response.json();
            
            removeTypingIndicator(typingIndicator);
            appendChatMessage('ai', data.reply);

            // Update chat history
            chatHistory.push(userTurn);
            chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });

        } catch (err) {
            console.error('Fan Chat error:', err);
            removeTypingIndicator(typingIndicator);
            appendChatMessage('ai', `⚠️ Support Assistant offline: ${err.message}`);
        }
    }

    fanChatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleChatSubmit(fanChatInput.value.trim());
    });

    // Quick Chips Auto-send click handler
    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const chipQueryText = chip.textContent.replace(/^[^\w]*/, '').trim(); // Strip emoji prefix
            handleChatSubmit(chipQueryText);
        });
    });

    // Chat DOM Helpers
    function appendChatMessage(sender, text) {
        const bubble = document.createElement('div');
        bubble.className = `chat-message ${sender}`;
        bubble.textContent = text;
        fanChatMessages.appendChild(bubble);
        fanChatMessages.scrollTop = fanChatMessages.scrollHeight;
    }

    function showTypingIndicator() {
        const container = document.createElement('div');
        container.className = 'typing-indicator';
        container.setAttribute('aria-label', 'AI Assistant is typing');
        container.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        fanChatMessages.appendChild(container);
        fanChatMessages.scrollTop = fanChatMessages.scrollHeight;
        return container;
    }

    function removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }

    // Modal Navigation Logic (Accessible Dialog Focus Controls)
    
    // Open Modal
    modalButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            const targetModal = document.getElementById(modalId);
            
            if (targetModal) {
                lastActiveElement = btn; // Save trigger reference
                
                targetModal.setAttribute('aria-hidden', 'false');
                targetModal.classList.add('active');
                
                const contentContainer = targetModal.querySelector('.modal-content');
                contentContainer.setAttribute('tabindex', '-1');
                
                // Delay slightly to focus correctly
                setTimeout(() => {
                    contentContainer.focus();
                }, 50);
            }
        });
    });

    // Close Modal Helper
    function closeModal(modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('active');
        
        // Restore focus to original button
        if (lastActiveElement) {
            lastActiveElement.focus();
            lastActiveElement = null;
        }
    }

    // Modal Close Buttons click
    modalCloses.forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const openModal = closeBtn.closest('.modal-overlay');
            if (openModal) closeModal(openModal);
        });
    });

    // Modal Close Backdrop click
    modalOverlays.forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay);
            }
        });
    });

    // Keyboard ESC Close keydown
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                closeModal(activeModal);
            }
        }
    });

    // ── Live Routing Logic ───────────────────────────────────────────────────
    const routingForm = document.getElementById('routing-form');
    const zoneSelect = document.getElementById('zone-select');
    const destSelect = document.getElementById('destination-select');
    const routingResult = document.getElementById('routing-result');
    const routeBtnText = document.getElementById('route-btn-text');
    const routeBtn = document.getElementById('route-btn');

    const DEST_ICONS = {
        'exit': '🚪',
        'accessible_exit': '♿',
        'parking': '🅿️',
        'transit': '🚌',
        'medical': '🏥'
    };

    if (routingForm) {
        routingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Reset state
            routingResult.innerHTML = '';
            
            const zoneVal = zoneSelect.value;
            const destVal = destSelect.value;
            const mobilityVal = document.querySelector('input[name="wheelchair"]:checked').value;

            // Validation
            let errorMsg = '';
            if (!zoneVal) errorMsg = 'Please select your ticket zone.';
            else if (!destVal) errorMsg = 'Please select a destination.';

            if (errorMsg) {
                routingResult.innerHTML = `<div class="route-inline-error"><span>⚠️</span> ${errorMsg}</div>`;
                return;
            }

            // Show loading state
            routeBtn.disabled = true;
            routeBtnText.textContent = 'Finding route...';
            routingResult.innerHTML = `
                <div class="typing-indicator" aria-label="Calculating route..." style="margin: 0 auto; display: flex; justify-content: center; background: none; border: none;">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `;

            try {
                const response = await fetch('/api/route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        destinationType: destVal,
                        mobilityNeed: mobilityVal,
                        zoneId: zoneVal
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to calculate route.');
                }

                // Success rendering
                const loc = data.chosenLocation;
                const route = data.route;
                const icon = DEST_ICONS[loc.type] || '📍';
                const typeLabel = loc.type.replace('_', ' ');

                let warningHtml = '';
                if (data.warning) {
                    warningHtml = `
                        <div class="route-warning-banner">
                            <span style="font-size: 16px;">ℹ️</span>
                            <span>${data.warning}</span>
                        </div>
                    `;
                }

                const stepsHtml = route.steps.map(step => `<li>${step}</li>`).join('');

                routingResult.innerHTML = `
                    <div class="route-result-card">
                        ${warningHtml}
                        <div class="route-dest-header">
                            <div class="route-dest-icon" aria-hidden="true">${icon}</div>
                            <div>
                                <div class="route-dest-name">${loc.name}</div>
                                <div class="route-dest-type">${typeLabel}</div>
                            </div>
                        </div>
                        
                        <div class="route-meta-row">
                            <div class="route-meta-item">
                                <span class="route-meta-label">Distance</span>
                                <span class="route-meta-value">${route.distanceText}</span>
                            </div>
                            <div class="route-meta-item">
                                <span class="route-meta-label">Est. Time</span>
                                <span class="route-meta-value">${route.durationText}</span>
                            </div>
                        </div>
                        
                        <div class="route-steps-heading">Walking Directions</div>
                        <ul class="route-steps-list">
                            ${stepsHtml}
                        </ul>
                    </div>
                `;

            } catch (err) {
                console.error('Routing error:', err);
                routingResult.innerHTML = `
                    <div class="route-error-banner">
                        <p>⚠️ We couldn't find a route right now. ${err.message !== 'Failed to calculate route.' ? err.message : ''}</p>
                        <button type="button" onclick="document.getElementById('route-btn').click()">Try again</button>
                    </div>
                `;
            } finally {
                routeBtn.disabled = false;
                routeBtnText.textContent = 'Get Directions';
            }
        });
    }
});
