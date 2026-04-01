document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const submitBtn = document.getElementById('submitBtn');
    const newThreadBtn = document.querySelector('.new-thread-btn');
    let messageIdCounter = 0;

    // --- State Management ---
    let chatHistoryContext = [];

    // Load from LocalStorage
    const storedHistory = localStorage.getItem('genview_history');
    if (storedHistory) {
        try {
            chatHistoryContext = JSON.parse(storedHistory);
            
            // Re-render history if exists
            if (chatHistoryContext.length > 0) {
                const suggestionsBox = document.querySelector('.suggestions-container');
                if (suggestionsBox) suggestionsBox.style.display = 'none';

                const title = document.querySelector('.brand-title');
                if (title) title.style.display = 'none';
                
                chatHistoryContext.forEach(msg => {
                    addMessageToChat(msg.content, msg.role === 'user' ? 'user' : 'ai', false, false);
                });
            }
        } catch(e) { console.error("Could not parse history", e); }
    }

    // Clear History Button
    if(newThreadBtn) {
        newThreadBtn.addEventListener('click', () => {
            chatHistoryContext = [];
            localStorage.removeItem('genview_history');
            
            // Clear DOM UI
            const historyContainer = document.getElementById('chatHistory');
            if(historyContainer) historyContainer.innerHTML = '';
            
            // Reset to original view
            const title = document.querySelector('.brand-title');
            if (title) title.style.display = 'block';
            
            const suggestionsBox = document.querySelector('.suggestions-container');
            if (suggestionsBox) suggestionsBox.style.display = 'block';
        });
    }

    function saveHistory() {
        localStorage.setItem('genview_history', JSON.stringify(chatHistoryContext));
    }


    // --- Input Mechanics ---
    searchInput.addEventListener('input', (e) => {
        if (e.target.value.trim().length > 0) {
            submitBtn.classList.add('active');
        } else {
            submitBtn.classList.remove('active');
        }
    });

    // Auto resize textarea
    searchInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    searchInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitBtn.click();
        }
    });


    // --- Frontend Tabs ---
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });


    // --- Backend Integration ---
    submitBtn.addEventListener('click', async () => {
        const prompt = searchInput.value.trim();
        if(!prompt) return;

        // Hide suggestions
        const suggestionsBox = document.querySelector('.suggestions-container');
        if (suggestionsBox) suggestionsBox.style.display = 'none';

        // Add user query to context and save
        chatHistoryContext.push({ role: 'user', content: prompt });
        saveHistory();

        // Add user query to DOM
        addMessageToChat(prompt, 'user');
        searchInput.value = '';
        submitBtn.classList.remove('active');
        searchInput.style.height = 'auto';

        // Add loading message
        const loadingId = addMessageToChat('Thinking...', 'ai', true);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatHistoryContext })
            });

            const data = await response.json();
            document.getElementById(loadingId).remove();

            if (data.error) {
                addMessageToChat('Error: ' + (data.details || data.error), 'error');
                // Slice it out of memory if request failed
                chatHistoryContext.pop(); 
                saveHistory();
            } else {
                // Add AI answer to context and save
                chatHistoryContext.push({ role: 'model', content: data.response });
                saveHistory();

                addMessageToChat(data.response, 'ai');
            }
        } catch (err) {
            document.getElementById(loadingId).remove();
            addMessageToChat('Failed to reach backend. Check if the Flask server is running on port 5000.', 'error');
            chatHistoryContext.pop(); 
            saveHistory();
            console.error(err);
        }
    });

    // --- Message Rendering ---
    function addMessageToChat(text, sender, isLoading = false, autoScroll = true) {
        const id = 'msg-' + messageIdCounter++;
        let historyContainer = document.getElementById('chatHistory');
        
        if (!historyContainer) {
            historyContainer = document.createElement('div');
            historyContainer.id = 'chatHistory';
            historyContainer.className = 'chat-history';
            const searchBox = document.querySelector('.search-box');
            searchBox.parentNode.insertBefore(historyContainer, searchBox);
            
            const title = document.querySelector('.brand-title');
            if (title) title.style.display = 'none';
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message` + (isLoading ? ' loading' : '');
        msgDiv.id = id;

        // Basic formatting
        const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                  .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                                  .replace(/\n/g, '<br>');

        if(sender === 'user') {
            msgDiv.innerHTML = `<div class="msg-content">${formattedText}</div>`;
        } else if (sender === 'error') {
            msgDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#d9534f; margin-right:12px"></i> <div class="msg-content" style="color:#d9534f">${formattedText}</div>`;
        } else {
            msgDiv.innerHTML = `<i class="fa-solid fa-cube logo-icon" style="color:var(--accent-color); margin-right:16px; font-size:24px;"></i> <div class="msg-content ai-prose">${formattedText}</div>`;
        }

        historyContainer.appendChild(msgDiv);

        if(autoScroll) {
            msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        return id;
    }
});
