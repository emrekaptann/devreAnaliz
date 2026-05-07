import os
import sys
import threading
import time
import webview

# Pyinstaller modunda console kapalıysa (noconsole/windowed) çıktı hatalarını önlemek için
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

# Pyinstaller modunda çalışırken gerekli yolları ayarlama
if getattr(sys, 'frozen', False):
    base_path = sys._MEIPASS
else:
    base_path = os.path.abspath(os.path.dirname(__file__))

os.chdir(base_path)

from app import app

def start_server():
    # Flask uygulamasını arka planda başlat
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)

if __name__ == "__main__":
    # Flask sunucusunu arka planda başlatacak thread
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Sunucunun tam olarak ayaklanması için kısa bir bekleme süresi
    time.sleep(1)
    
    # WebView ile kendi penceremizi oluştur (Bağımsız masaüstü uygulaması görünümü)
    webview.create_window('Devre Analizi Uygulaması', 'http://127.0.0.1:5000/', width=1200, height=800)
    
    # Uygulamayı başlat
    webview.start()
