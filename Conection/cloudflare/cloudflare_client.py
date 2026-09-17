"""
Cloudflare API & Worker Client Connector (Python)
Hỗ trợ tương tác với Cloudflare REST API và gọi trực tiếp tới Cloudflare Worker đã deploy.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

class CloudflareClient:
    def __init__(self, account_id: Optional[str] = None, api_token: Optional[str] = None):
        self.account_id = account_id or os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.api_token = api_token or os.getenv("CLOUDFLARE_API_TOKEN")
        self.api_base = "https://api.cloudflare.com/client/v4"

    def verify_token(self) -> Dict[str, Any]:
        """Kiểm tra tính hợp lệ của Cloudflare API Token."""
        if not self.api_token:
            return {"success": False, "error": "Chưa cấu hình CLOUDFLARE_API_TOKEN"}

        req = urllib.request.Request(
            f"{self.api_base}/user/tokens/verify",
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            return {"success": False, "error": str(e)}

    def call_worker(self, worker_url: str, endpoint: str = "/api/chat", payload: Optional[Dict] = None) -> Dict[str, Any]:
        """Gửi request tới Cloudflare Worker đã deploy."""
        url = f"{worker_url.rstrip('/')}/{endpoint.lstrip('/')}"
        data = json.dumps(payload or {}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            return {"success": False, "error": str(e)}

if __name__ == "__main__":
    cf = CloudflareClient()
    print("Cloudflare Client sẵn sàng.")
