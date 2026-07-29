#!/usr/bin/env python3
"""반구천의 암각화 사이트용 로컬 서버.

실행:  python3 serve.py   (또는 ./serve.py)
브라우저에서 http://localhost:8000 접속.

※ 이 사이트는 외부 파일을 불러오지 않으므로 index.html을 더블클릭해서
   (file://) 바로 열어도 정상 동작합니다. 서버는 편의용입니다.
"""
import http.server
import socketserver
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    print(f"반구천의 암각화 →  http://localhost:{PORT}")
    print("종료하려면 Ctrl+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
