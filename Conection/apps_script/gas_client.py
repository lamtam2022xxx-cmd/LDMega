"""
Google Apps Script Web App Client Connector (Python)
Hỗ trợ gọi các hàm đã deploy trên Google Apps Script (GAS) qua giao thức HTTP (doGet / doPost).
"""

import os
import json
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional

class GoogleAppsScriptClient:
    def __init__(self, webapp_url: Optional[str] = None):
        self.webapp_url = webapp_url or os.getenv("GAS_WEBAPP_URL")

    def ping(self) -> Dict[str, Any]:
        """Kiểm tra kết nối với Web App GAS."""
        if not self.webapp_url:
            return {"success": False, "error": "Chưa cấu hình GAS_WEBAPP_URL"}

        try:
            url = f"{self.webapp_url}?action=ping"
            with urllib.request.urlopen(url, timeout=15) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            return {"success": False, "error": str(e)}

    def execute_action(self, action: str, payload: Optional[Dict] = None) -> Dict[str, Any]:
        """Thực thi action trên Google Apps Script thông qua doPost."""
        if not self.webapp_url:
            return {"success": False, "error": "Chưa cấu hình GAS_WEBAPP_URL"}

        body = payload or {}
        body["action"] = action
        data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(
            self.webapp_url,
            data=data,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            return {"success": False, "error": str(e)}

if __name__ == "__main__":
    gas = GoogleAppsScriptClient()
    print("Google Apps Script Client sẵn sàng.")
