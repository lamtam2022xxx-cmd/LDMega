"""
Groq AI Client Connector (Python)
Hỗ trợ gọi API Groq siêu tốc không phụ thuộc thư viện ngoài (dùng chuẩn urllib & json).
"""

import os
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

class GroqClient:
    API_URL = "https://api.groq.com/openai/v1/chat/completions"
    DEFAULT_MODEL = "llama-3.3-70b-versatile"

    def __init__(self, api_key: Optional[str] = None, default_model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.default_model = default_model or os.getenv("GROQ_DEFAULT_MODEL", self.DEFAULT_MODEL)
        
        if not self.api_key:
            # Cho phép khởi tạo nhưng cảnh báo khi gọi API
            pass

    def chat(self, 
             prompt: str, 
             system_prompt: Optional[str] = None, 
             model: Optional[str] = None,
             temperature: float = 0.7,
             max_tokens: int = 2048) -> Dict[str, Any]:
        """
        Gửi prompt và nhận câu trả lời dạng văn bản từ Groq.
        """
        if not self.api_key:
            return {
                "success": False, 
                "error": "Chưa cấu hình GROQ_API_KEY. Vui lòng thiết lập biến môi trường hoặc truyền vào khởi tạo."
            }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.API_URL,
            data=data,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "LDMega-GroqClient/1.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                
                content = res_json["choices"][0]["message"]["content"]
                usage = res_json.get("usage", {})
                return {
                    "success": True,
                    "content": content,
                    "usage": usage,
                    "model": res_json.get("model")
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            return {"success": False, "error": f"HTTP Error {e.code}: {err_body}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def quick_ask(self, question: str) -> str:
        """Hỏi nhanh một câu và trả về chuỗi kết quả trực tiếp."""
        res = self.chat(question)
        if res.get("success"):
            return res["content"]
        return f"[Lỗi Groq]: {res.get('error')}"

if __name__ == "__main__":
    client = GroqClient()
    print("Groq Client đã sẵn sàng. Cần có GROQ_API_KEY để gọi thật.")
