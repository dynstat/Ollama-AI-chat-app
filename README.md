# Ollama AI Chat App

A simple real-time chat application that connects to Ollama AI models for intelligent conversations. Built with React frontend and Node.js backend, featuring concurrent request processing, syntax highlighting, and a beautiful user interface.

## Screenshot:
<img width="1876" height="913" alt="image" src="https://github.com/user-attachments/assets/c1eda2f6-d46e-4d16-82ca-382104688941" />


## Features

- **Real-time AI Chat**: Stream responses from Ollama AI models
- **Concurrent Processing**: Handle multiple users simultaneously with request queuing
- **Syntax Highlighting**: Beautiful code rendering with support for 20+ programming languages
- **Conversation Management**: Save and manage multiple chat conversations
- **Model Selection**: Switch between different Ollama models
- **Responsive Design**: Modern UI that works on desktop and mobile
- **Docker Support**: Easy deployment with Docker and Docker Compose
- **Security**: Rate limiting, CORS protection, and security headers
- **Health Monitoring**: Built-in health checks and metrics

## Architecture

- **Frontend**: React 19 + Vite with syntax highlighting and markdown rendering
- **Backend**: Node.js + Express with concurrent request processing
- **AI Integration**: Ollama API with connection pooling and request queuing
- **Deployment**: Docker containers with Nginx reverse proxy

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) (for local development)
- [Ollama](https://ollama.ai/) (for local AI model hosting)

## 🚀 Quick Start

### Option 1: Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/dynstat/Ollama-AI-chat-app.git
   cd Ollama-AI-chat-app
   ```

2. **Start the application**
   ```bash
   # Production mode
   docker-compose up --build
   
   # Development mode (with hot reload)
   ./dev-start.bat  # Windows
   # OR
   docker-compose -f docker-compose.dev.yml up --build  # Linux/Mac
   ```

3. **Access the application**
   - Frontend: http://localhost:8080 (production) or http://localhost:5173 (development)
   - Backend API: http://localhost:3001

### Option 2: Local Development

1. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory or set environment variables:

```bash
# Ollama Configuration
OLLAMA_HOST=https://Your-Ollama-server-URL/  # Your Ollama server URL
OLLAMA_MODEL=qwen3:1.7b                   # Default model to use

# Security (Optional)
API_KEY=your-secret-api-key               # API key for public exposure
ALLOWED_ORIGINS=http://localhost:3000     # CORS allowed origins

# Server Configuration
PORT=3001                                 # Backend server port
```

### Supported Models

The application supports these Ollama models:
- `qwen3:1.7b` (default)
- `qwen3:8b`
- `qwen2:1.5b`
- `codegemma:2b`
- `codegemma:7b`
- `deepseek-r1:7b`
- `gpt-oss:20b`

### Ollama Server Setup

1. **Install Ollama**: Follow the [official installation guide](https://ollama.ai/download)

2. **Pull a model**:
   ```bash
   ollama pull qwen3:1.7b
   ```

3. **Start Ollama server**:
   ```bash
   ollama serve
   ```

## 🔧 Advanced Configuration

### Concurrent Processing

The application supports concurrent request processing. Configure in `backend/config.js`:

```javascript
// Request queue configuration
export const QUEUE_CONFIG = {
  maxConcurrent: 4,        // Maximum concurrent requests
  timeout: 300000,         // Request timeout (5 minutes)
  retryAttempts: 2,        // Number of retry attempts
  retryDelay: 1000,        // Delay between retries (ms)
};
```

## Usage

1. **Start a Conversation**: Click "New Chat" to begin
2. **Select Model**: Choose from available Ollama models
3. **Send Messages**: Type your message and press Enter
4. **View Responses**: AI responses stream in real-time with syntax highlighting
5. **Manage Chats**: Save, rename, or delete conversations
6. **Code Support**: Send code snippets for analysis and explanation

## 🔍 API Endpoints

- `GET /health` - Health check
- `POST /api/chat` - Send chat message
- `GET /api/queue-status` - Get request queue status
- `GET /metrics` - Prometheus metrics (if enabled)

## 🛠️ Development

### Project Structure

```
Ollama-AI-chat-app/
├── backend/                 # Node.js API server
│   ├── server.mjs          # Main server file
│   ├── config.js           # Configuration
│   └── package.json        # Backend dependencies
├── frontend/               # React application
│   ├── src/
│   │   ├── App.jsx         # Main application component
│   │   └── components/     # React components
│   └── package.json        # Frontend dependencies
├── docker-compose.yml      # Production Docker setup
├── docker-compose.dev.yml  # Development Docker setup
└── dev-start.bat          # Windows development script
```

### Development Commands

```bash
# Backend development
cd backend
npm install
npm start

# Frontend development
cd frontend
npm install
npm run dev
npm run build
npm run lint

# Docker development
docker-compose -f docker-compose.dev.yml up --build
```

## Troubleshooting

### Common Issues

1. **Ollama Connection Error**
   - Ensure Ollama server is running
   - Check `OLLAMA_HOST` environment variable
   - Verify network connectivity

2. **Docker Build Issues**
   - Clear Docker cache: `docker system prune -a`
   - Rebuild without cache: `docker-compose build --no-cache`

3. **Port Conflicts**
   - Change ports in `docker-compose.yml`
   - Check if ports 3001, 5173, or 8080 are in use

4. **Memory Issues**
   - Increase Docker memory allocation
   - Use smaller models for development

### Health Checks

- Backend health: `curl http://localhost:3001/health`
- Frontend: Open http://localhost:8080 in browser
- Queue status: `curl http://localhost:3001/api/queue-status`

## 📊 Performance

- **Concurrent Requests**: Up to 4 simultaneous users
- **Response Time**: Depends on Ollama model and server performance
- **Memory Usage**: ~512MB-2GB depending on model size
- **Connection Pooling**: Up to 50 concurrent connections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) for the AI model hosting
- [React](https://reactjs.org/) for the frontend framework
- [Express](https://expressjs.com/) for the backend framework
- [Highlight.js](https://highlightjs.org/) for syntax highlighting
- [Marked](https://marked.js.org/) for markdown rendering

## 📞 Support

For issues and questions:
- Check the [troubleshooting section](#troubleshooting)
- Review the [concurrent processing documentation](CONCURRENT_PROCESSING.md)
- Open an issue on GitHub
