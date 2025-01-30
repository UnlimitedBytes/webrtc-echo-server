let pc = null;
let dataChannel = null;
let localStream = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const audioSelect = document.getElementById('audio-input');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');
const connectionStatus = document.getElementById('connection-status');

// Get available audio input devices
async function getAudioDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        audioSelect.innerHTML = '';
        audioDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Microphone ${audioSelect.length + 1}`;
            audioSelect.appendChild(option);
        });
    } catch (e) {
        console.error('Error getting audio devices:', e);
        updateConnectionStatus('error', 'Error accessing audio devices');
    }
}

// Request permission and get audio devices
async function initialize() {
    try {
        // Request audio permission to get device labels
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        await getAudioDevices();
    } catch (e) {
        console.error('Error initializing:', e);
        updateConnectionStatus('error', 'Error accessing microphone');
    }
}

function updateConnectionStatus(state, message) {
    const states = {
        'connecting': { class: 'connecting', text: 'Connecting...' },
        'connected': { class: 'connected', text: 'Connected' },
        'disconnected': { class: 'disconnected', text: 'Disconnected' },
        'error': { class: 'error', text: message || 'Error' },
        'reconnecting': { class: 'connecting', text: `Reconnecting (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...` }
    };

    const status = states[state] || states.error;
    connectionStatus.className = `status ${status.class}`;
    connectionStatus.textContent = `Status: ${status.text}`;
    
    // Update UI elements based on connection state
    const isConnected = state === 'connected';
    startButton.disabled = isConnected;
    stopButton.disabled = !isConnected;
    messageInput.disabled = !isConnected;
    sendButton.disabled = !isConnected;
    audioSelect.disabled = isConnected;
}

function addMessageToChat(message, isEcho = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isEcho ? 'echo-message' : 'user-message'}`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleConnectionStateChange() {
    if (!pc) return;
    
    const state = pc.connectionState;
    console.log('Connection state changed:', state);

    switch (state) {
        case 'connected':
            reconnectAttempts = 0;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            updateConnectionStatus('connected');
            addSystemMessage('Connected to server');
            break;
            
        case 'disconnected':
        case 'failed':
            updateConnectionStatus('disconnected');
            addSystemMessage('Connection lost');
            attemptReconnect();
            break;
            
        case 'connecting':
            updateConnectionStatus('connecting');
            break;
    }
}

async function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        updateConnectionStatus('error', 'Maximum reconnection attempts reached');
        addSystemMessage('Could not reconnect to server. Please try again manually.');
        stop();
        return;
    }

    reconnectAttempts++;
    updateConnectionStatus('reconnecting');
    addSystemMessage(`Attempting to reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    // Wait before attempting to reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    
    reconnectTimeout = setTimeout(async () => {
        try {
            await start();
        } catch (e) {
            console.error('Reconnection attempt failed:', e);
            attemptReconnect();
        }
    }, RECONNECT_DELAY);
}

async function start() {
    if (pc && pc.connectionState === 'connecting') {
        console.log('Connection already in progress');
        return;
    }

    try {
        updateConnectionStatus('connecting');

        // Stop any existing connection
        if (pc) {
            stop();
        }

        // Get selected audio device
        const audioSource = audioSelect.value;
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: audioSource ? { exact: audioSource } : undefined
            }
        });

        // Create peer connection
        pc = new RTCPeerConnection();
        pc.onconnectionstatechange = handleConnectionStateChange;

        // Set up data channel
        dataChannel = pc.createDataChannel('chat');
        setupDataChannel();
        
        // Add local audio track
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        // Handle incoming audio track
        pc.ontrack = (e) => {
            const remoteAudio = new Audio();
            remoteAudio.srcObject = new MediaStream([e.track]);
            remoteAudio.play();
        };

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const response = await fetch('/offer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sdp: pc.localDescription.sdp,
                type: pc.localDescription.type
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const answer = await response.json();
        await pc.setRemoteDescription(answer);

    } catch (e) {
        console.error('Error starting connection:', e);
        updateConnectionStatus('error', e.message);
        stop();
        
        // If the error was due to server being unavailable, attempt to reconnect
        if (e.message.includes('fetch')) {
            attemptReconnect();
        }
    }
}

function setupDataChannel() {
    dataChannel.onopen = () => {
        console.log('Data channel opened');
    };

    dataChannel.onclose = () => {
        console.log('Data channel closed');
    };

    dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
    };

    dataChannel.onmessage = (e) => addMessageToChat(e.data, true);
}

function stop() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (pc) {
        pc.onconnectionstatechange = null;
        pc.close();
        pc = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }

    updateConnectionStatus('disconnected');
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && dataChannel && dataChannel.readyState === 'open') {
        addMessageToChat(message);
        dataChannel.send(message);
        messageInput.value = '';
    }
}

// Event listeners
startButton.addEventListener('click', start);
stopButton.addEventListener('click', () => {
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect on manual stop
    stop();
});
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initialize on page load
initialize();