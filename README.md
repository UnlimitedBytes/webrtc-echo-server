# WebRTC Echo Server

A simple WebRTC application that demonstrates audio and chat echo functionality. The server echoes back any audio input and chat messages received from the client.

## Features

- 🎤 Real-time audio echo
- 💬 Chat messaging with echo
- 🔄 Automatic reconnection handling
- 📱 Responsive UI design
- 🎯 Clear connection state feedback

## Requirements

- Python 3.8+
- Modern web browser with WebRTC support

## Installation

1. Clone the repository:
```powershell
git clone https://github.com/UnlimitedBytes/webrtc-echo-server.git
cd webrtc-echo-server
```

2. Install dependencies:
```powershell
pip install -r requirements.txt
```

## Usage

1. Start the server:
```powershell
python server.py
```

2. Open your web browser and navigate to:
```
http://localhost:8080
```

3. Allow microphone access when prompted
4. Select your microphone from the dropdown
5. Click "Start Connection" to begin
6. Speak into your microphone - you'll hear your voice echoed back
7. Type messages in the chat - they'll be echoed back by the server

## Features in Detail

### Audio Echo
- Real-time audio streaming using WebRTC
- Automatic echo of incoming audio
- Microphone device selection

### Chat Echo
- Text messaging through WebRTC data channel
- Instant message echo from server
- System messages for connection events

### Connection Management
- Automatic reconnection (up to 5 attempts)
- Visual connection state feedback
- Clear error messaging
- Connection state persistence

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.