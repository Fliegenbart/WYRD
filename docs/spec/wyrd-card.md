# WYRD Card Specification v1.0

## Overview

A **WYRD Card** is a JSON document served at `/.well-known/wyrd.json` that describes an agent's identity, capabilities, and connection methods. Any HTTP server can become a WYRD agent by serving this file.

## Endpoint

```
GET /.well-known/wyrd.json
Content-Type: application/json
```

## Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `wyrd` | `string` | Protocol version. Must be `"1.0"` |
| `id` | `string` | Agent's unique identifier (base58-encoded Ed25519 public key) |
| `name` | `string` | Human-readable agent name |
| `url` | `string` | Base URL where this agent is reachable |
| `capabilities` | `Capability[]` | Array of capabilities this agent provides |
| `transport` | `Transport` | Available connection methods |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | What this agent does |
| `publicKey` | `string` | Ed25519 public key (same as `id` for WYRD agents) |
| `provider` | `Provider` | Organization/owner info |

### Capability Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique capability identifier (e.g. `"get-weather"`) |
| `name` | `string` | Yes | Human-readable name |
| `description` | `string` | Yes | What this capability does |
| `tags` | `string[]` | Yes | Searchable tags for discovery |
| `inputSchema` | `JSONSchema` | No | JSON Schema describing accepted input |
| `outputSchema` | `JSONSchema` | No | JSON Schema describing output format |
| `pricing` | `Pricing` | No | Pricing model (`{ model: "free" | "per-task", amount?: number }`) |

### Transport Object

| Field | Type | Description |
|-------|------|-------------|
| `http` | `string` | URL for HTTP task submission (e.g. `"https://agent.example.com/v1/task"`) |
| `websocket` | `string` | WebSocket URL for real-time communication (optional) |

## Example

```json
{
  "wyrd": "1.0",
  "id": "7Xk9mP2vQbNxR4sT6wYz",
  "name": "WeatherBot",
  "description": "Real-time weather forecasts powered by Open-Meteo",
  "url": "https://weather-agent.fly.dev",
  "publicKey": "7Xk9mP2vQbNxR4sT6wYz",
  "capabilities": [
    {
      "id": "get-weather",
      "name": "Weather Forecast",
      "description": "Get current weather for any city",
      "tags": ["weather", "forecast", "real-time"],
      "inputSchema": {
        "type": "object",
        "properties": {
          "city": { "type": "string" }
        },
        "required": ["city"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "temperature": { "type": "number" },
          "conditions": { "type": "string" }
        }
      }
    }
  ],
  "transport": {
    "http": "https://weather-agent.fly.dev/v1/task"
  },
  "provider": {
    "protocol": "wyrd/v1"
  }
}
```

## Task Submission (HTTP)

To send a task to a WYRD agent:

```
POST /v1/task
Content-Type: application/json

{
  "capabilityId": "get-weather",
  "input": { "city": "Tokyo" }
}
```

**Response (success):**

```json
{
  "taskId": "01HXYZ...",
  "status": "success",
  "output": { "temperature": 10.9, "conditions": "Partly cloudy" },
  "metrics": { "durationMs": 158 },
  "agent": { "id": "7Xk9mP2...", "name": "WeatherBot" }
}
```

**Response (error):**

```json
{
  "taskId": "01HXYZ...",
  "status": "error",
  "error": { "code": "HANDLER_ERROR", "message": "City not found" },
  "metrics": { "durationMs": 12 }
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Task completed successfully |
| 400 | Invalid input (fails schema validation) |
| 404 | Unknown capability |
| 408 | Task timed out |
| 429 | Too many concurrent tasks |
| 500 | Handler error |

## Implementing Without the SDK

You don't need `@wyrd/sdk` to be a WYRD agent. Any HTTP server that:

1. Serves `/.well-known/wyrd.json` with the schema above
2. Accepts `POST /v1/task` with `{ capabilityId, input }`
3. Returns `{ taskId, status, output }` or `{ taskId, status, error }`

...is a valid WYRD agent that any other WYRD agent can discover and call.

## A2A Compatibility

WYRD Cards are designed to be compatible with A2A Agent Cards. The `capabilities` array maps to A2A `skills`, and the `transport` object maps to A2A endpoint configuration.
