/**
 * StadiumPulse Command Center JS Dashboard
 * Manages incident classification triage, live logs feed, and staff assistant chat interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // In-memory feed list
    const incidentsList = [];
    let chatHistory = [];

    // DOM References - Incident Form & Triage Card
    const incidentForm = document.getElementById('incident-form');
    const incidentInput = document.getElementById('incident-description');
    const submitBtn = document.getElementById('submit-btn');
    const triageResultContainer = document.getElementById('triage-result-container');
    const triageCard = document.getElementById('triage-card');
    const resultPriorityBadge = document.getElementById('result-priority-badge');
    const resultScoreDisplay = document.getElementById('result-score-display');
    const resultType = document.getElementById('result-type');
    const resultZone = document.getElementById('result-zone');
    const resultCrowd = document.getElementById('result-crowd');
    const resultUrgency = document.getElementById('result-urgency');
    const resultAction = document.getElementById('result-action');
    const resultResource = document.getElementById('result-resource');

    // DOM References - Live Incident Log
    const feedCountBadge = document.getElementById('feed-count-badge');
    const feedEmptyState = document.getElementById('feed-empty-state');
    const incidentFeedList = document.getElementById('incident-feed-list');

    // DOM References - Chat Drawer
    const staffChatDrawer = document.getElementById('staff-chat-drawer');
    const chatHeaderToggle = document.getElementById('chat-header-toggle');
    const chatToggleIcon = document.getElementById('chat-toggle-icon');
    const chatBodyContent = document.getElementById('chat-body-content');
    const chatMessagesContainer = document.getElementById('chat-messages-container');
    const chatForm = document.getElementById('chat-form');
    const chatInputField = document.getElementById('chat-input-field');

    // Drawer state toggle
    let isDrawerExpanded = false;

    function toggleChatDrawer() {
        isDrawerExpanded = !isDrawerExpanded;
        staffChatDrawer.classList.toggle('expanded', isDrawerExpanded);
        
        if (isDrawerExpanded) {
            chatBodyContent.style.display = 'flex';
            chatToggleIcon.textContent = '▼';
            chatToggleIcon.setAttribute('aria-label', 'Collapse Chat Drawer');
            chatHeaderToggle.setAttribute('aria-expanded', 'true');
            // Shift focus to chat input for keyboard user accessibility
            setTimeout(() => chatInputField.focus(), 100);
        } else {
            chatBodyContent.style.display = 'none';
            chatToggleIcon.textContent = '▲';
            chatToggleIcon.setAttribute('aria-label', 'Expand Chat Drawer');
            chatHeaderToggle.setAttribute('aria-expanded', 'false');
        }
    }

    // Toggle click & keyboard (accessibility)
    chatHeaderToggle.addEventListener('click', toggleChatDrawer);
    chatHeaderToggle.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleChatDrawer();
        }
    });

    // Handle Incident Form Triage Submission
    incidentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const description = incidentInput.value.trim();
        if (!description) return;

        // Visual loading state
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span>Triaging Incident...</span> <span class="badge-live" style="background: none; border: none; padding: 0;" aria-hidden="true">⏳</span>`;

        try {
            const response = await fetch('/api/incidents/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Server error classification failed.');
            }

            const data = await response.json();
            displayTriageResult(data, description);
            logIncidentToFeed(data, description);
            incidentInput.value = ''; // Reset input field
        } catch (err) {
            console.error('Classification Error:', err);
            alert(`Triage failed: ${err.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    // Helper: Map scores to urgency badges CSS class and Priority Level name
    function getPriorityClassAndLevel(score) {
        if (score >= 80) return { className: 'badge-critical', level: 'CRITICAL' };
        if (score >= 60) return { className: 'badge-high', level: 'HIGH' };
        if (score >= 40) return { className: 'badge-moderate', level: 'MODERATE' };
        return { className: 'badge-low', level: 'LOW' };
    }

    // Populate and show incident results
    function displayTriageResult(data, rawDescription) {
        const { classification, triage } = data;
        const { priorityScore, recommendedAction, resourceType } = triage;
        const info = getPriorityClassAndLevel(priorityScore);

        // Visual Urgent Border Highlights
        if (priorityScore > 80) {
            triageCard.classList.add('urgent');
        } else {
            triageCard.classList.remove('urgent');
        }

        resultPriorityBadge.textContent = info.level;
        resultPriorityBadge.className = `badge-priority ${info.className}`;
        resultScoreDisplay.innerHTML = `${priorityScore}<span>/100</span>`;
        resultType.textContent = formatLabel(classification.incidentType);
        resultZone.textContent = classification.zone === 'unspecified' ? 'Unspecified Location' : classification.zone;
        resultCrowd.textContent = formatLabel(classification.zoneCrowdLevel);
        resultUrgency.textContent = formatLabel(classification.urgency);
        resultAction.textContent = recommendedAction;
        resultResource.textContent = formatLabel(resourceType);
        resultResource.className = `badge-priority ${info.className}`;

        triageResultContainer.style.display = 'block';
    }

    // Append logs to the Live feed on the right panel
    function logIncidentToFeed(data, description) {
        const { classification, triage } = data;
        const { priorityScore, recommendedAction } = triage;
        const info = getPriorityClassAndLevel(priorityScore);

        const newIncident = {
            id: Date.now(),
            description: description,
            type: classification.incidentType,
            zone: classification.zone,
            priorityScore: priorityScore,
            urgency: classification.urgency,
            level: info.level,
            badgeClass: info.className,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };

        incidentsList.unshift(newIncident); // prepend
        renderFeedList();
    }

    function renderFeedList() {
        if (incidentsList.length === 0) {
            feedEmptyState.style.display = 'block';
            incidentFeedList.style.display = 'none';
            feedCountBadge.textContent = '0 Active';
            feedCountBadge.setAttribute('aria-label', 'Total active incidents logged: 0');
            return;
        }

        feedEmptyState.style.display = 'none';
        incidentFeedList.style.display = 'flex';
        feedCountBadge.textContent = `${incidentsList.length} Active`;
        feedCountBadge.setAttribute('aria-label', `Total active incidents logged: ${incidentsList.length}`);

        incidentFeedList.innerHTML = incidentsList.map(item => {
            let borderClass = '';
            if (item.priorityScore >= 80) borderClass = 'priority-critical';
            else if (item.priorityScore >= 60) borderClass = 'priority-high';

            return `
                <div class="feed-item ${borderClass}" tabindex="0">
                    <div class="feed-left">
                        <div class="feed-desc">${escapeHTML(item.description)}</div>
                        <div class="feed-meta">
                            <span>🕒 ${item.timestamp}</span>
                            <span>📍 Zone: ${escapeHTML(item.zone)}</span>
                            <span>🏷️ ${formatLabel(item.type)}</span>
                        </div>
                    </div>
                    <div class="feed-right">
                        <span class="badge-priority ${item.badgeClass}">${item.level}</span>
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Score: ${item.priorityScore}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // AI Drawer - Chat form submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const question = chatInputField.value.trim();
        if (!question) return;

        // Render user message bubble
        appendChatMessage('staff', question);
        chatInputField.value = ''; // clear

        // Add user question to state history
        const userTurn = { role: 'user', parts: [{ text: question }] };
        
        // Animated typing indicator
        const typingIndicator = showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: question, history: chatHistory })
            });

            if (!response.ok) {
                throw new Error('AI services unreachable. Check connection.');
            }

            const data = await response.json();
            
            // Remove typing indicator & render reply
            removeTypingIndicator(typingIndicator);
            appendChatMessage('ai', data.reply);

            // Update chatHistory
            chatHistory.push(userTurn);
            chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });

        } catch (err) {
            console.error('Chat Error:', err);
            removeTypingIndicator(typingIndicator);
            appendChatMessage('ai', `⚠️ Ops Assistant Error: ${err.message}`);
        }
    });

    // Append Message helper
    function appendChatMessage(sender, text) {
        const bubble = document.createElement('div');
        bubble.className = `chat-message ${sender}`;
        bubble.textContent = text;
        chatMessagesContainer.appendChild(bubble);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
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
        chatMessagesContainer.appendChild(container);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        return container;
    }

    function removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }

    // Helper functions
    function formatLabel(str) {
        if (!str) return 'N/A';
        return str
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
