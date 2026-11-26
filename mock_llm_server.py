#!/usr/bin/env python3
"""Mock OpenAI-compatible /v1/chat/completions server for testing RegBot's
generic LLM fetch path (the path used with Groq/OpenAI keys outside the sandbox).

Usage: python3 scripts/mock_llm_server.py [port]
Logs every request (auth header prefix, model, message roles) to stdout so the
test can verify the client sent a proper Authorization header and payload.
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        auth = self.headers.get("Authorization", "")
        model = body.get("model", "?")
        roles = [m.get("role") for m in body.get("messages", [])]
        sys_msg = next((m["content"] for m in body.get("messages", []) if m.get("role") == "system"), "")

        print(f"[mock] path={self.path} auth={auth[:14]}... model={model} roles={roles}", flush=True)
        print(f"[mock] system prompt has CONTEXT: {'CONTEXT' in sys_msg}, ~{len(sys_msg)} chars", flush=True)

        payload = {
            "id": "mock-1",
            "object": "chat.completion",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "**MOCK-LLM-OK** — generic OpenAI-compatible fetch path works (R7.3).",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20},
        }
        data = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):  # silence default request logging
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9372
    print(f"[mock] listening on :{port}", flush=True)
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
