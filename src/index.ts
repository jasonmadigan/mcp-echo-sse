#!/usr/bin/env node
import { createServer } from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = process.env.PORT || 3000;

const transports: Map<string, SSEServerTransport> = new Map();

const server = new Server(
  {
    name: "mcp-echo-sse",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echoes back the input message",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo back",
            },
          },
          required: ["message"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "echo") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const { message } = request.params.arguments as { message: string };

  return {
    content: [
      {
        type: "text",
        text: `Echo: ${message}`,
      },
    ],
  };
});

const httpServer = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/sse") {
    console.log("Establishing SSE connection");
    
    try {
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;
      transports.set(sessionId, transport);
      
      transport.onclose = () => {
        console.log(`SSE connection closed for session ${sessionId}`);
        transports.delete(sessionId);
      };
      
      await server.connect(transport);
      
      console.log(`SSE connection established with session ID: ${sessionId}`);
    } catch (error) {
      console.error("Error establishing SSE connection:", error);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Error establishing SSE connection");
      }
    }
  }
  else if (req.method === "POST" && req.url?.startsWith("/messages")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get("sessionId");
    
    if (!sessionId) {
      res.writeHead(400);
      res.end("Missing sessionId parameter");
      return;
    }
    
    const transport = transports.get(sessionId);
    if (!transport) {
      res.writeHead(404);
      res.end("Session not found");
      return;
    }
    
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    
    req.on("end", async () => {
      try {
        const parsedBody = JSON.parse(body);
        await transport.handlePostMessage(req, res, parsedBody);
      } catch (error) {
        console.error("Error handling message:", error);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Error handling message");
        }
      }
    });
  }
  else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(+PORT, () => {
  console.log(`MCP Echo SSE server running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down server...");
  
  for (const [sessionId, transport] of transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transport.close();
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  
  httpServer.close(() => {
    console.log("Server shutdown complete");
    process.exit(0);
  });
});