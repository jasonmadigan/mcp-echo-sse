# MCP Echo SSE Server

Simple SSE transport server for MCP with an echo tool.

## Usage

### Running locally

```bash
npm install
npm run dev
```

The server will start on `http://localhost:3000` with the SSE endpoint at `http://localhost:3000/sse`.

### Running with Docker

```bash
docker build -t mcp-echo-sse .
docker run -p 3000:3000 mcp-echo-sse
```

Or pull from GitHub Container Registry (after pushing to main):

```bash
docker run -p 3000:3000 ghcr.io/[your-username]/mcp-echo-sse:latest
```

### Environment Variables

`PORT`: Server port (default: 3000)

## Docker

GitHub Actions automatically builds and pushes images to ghcr.io on commits to main.

## Testing with cURL

```bash
# Connect to SSE endpoint and get session ID
curl -N -H "Accept: text/event-stream" http://localhost:3000/sse

# You'll see something like:
# event: endpoint
# data: /messages?sessionId=abc123-def456-...

# Initialize the connection (use your session ID)
curl -X POST "http://localhost:3000/messages?sessionId=YOUR_SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0.0"}},"id":1}'

# Call the echo tool
curl -X POST "http://localhost:3000/messages?sessionId=YOUR_SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"Hello SSE!"}},"id":2}'
```