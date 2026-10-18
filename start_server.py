#!/usr/bin/env python3
"""可乐跳跳瓶 H5 本地启动器"""
import http.server, socketserver, webbrowser, os
PORT = 8899
os.chdir(os.path.dirname(os.path.abspath(__file__)))
handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
    url = f"http://127.0.0.1:{PORT}"
    print("✅ 可乐跳跳瓶 H5 已启动:", url)
    try:
        webbrowser.open(url)
    except Exception:
        pass
    httpd.serve_forever()
