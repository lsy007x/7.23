#!/usr/bin/env python3
"""GLB 뷰어용 로컬 정적 서버.

실행:  python3 serve.py  (또는 ./serve.py)
브라우저에서 http://localhost:8000 접속.
"""
import http.server
import socketserver
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    # .glb를 올바른 MIME 타입으로 제공
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".glb": "model/gltf-binary",
        ".js": "text/javascript",
    }


with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"GLB 뷰어 실행 중 →  http://localhost:{PORT}")
    print("종료하려면 Ctrl+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
