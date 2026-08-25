"""Lifecycle management for an ephemeral Cloudflare Quick Tunnel."""

from __future__ import annotations

import re
import shutil
import subprocess
import threading


_PUBLIC_URL = re.compile(r"https://[-a-z0-9]+\.trycloudflare\.com", re.IGNORECASE)


class CloudflareTunnel:
    def __init__(self, local_url: str = "http://127.0.0.1:8000") -> None:
        self._local_url = local_url
        self._process: subprocess.Popen[str] | None = None
        self._url: str | None = None
        self._connected = threading.Event()

    @property
    def public_url(self) -> str:
        if self._url is None:
            raise RuntimeError("Cloudflare Tunnel did not provide a public URL")
        return self._url

    def start(self) -> None:
        executable = shutil.which("cloudflared")
        if executable is None:
            raise RuntimeError(
                "cloudflared was not found. Install it, then run the backend with --https."
            )

        self._process = subprocess.Popen(
            [executable, "tunnel", "--no-autoupdate", "--url", self._local_url],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        threading.Thread(target=self._read_output, daemon=True).start()
        if not self._connected.wait(timeout=30):
            self.stop()
            raise RuntimeError("Cloudflare Tunnel did not connect within 30 seconds")

    def _read_output(self) -> None:
        if self._process is None or self._process.stdout is None:
            return
        for line in self._process.stdout:
            match = _PUBLIC_URL.search(line)
            if match:
                self._url = match.group(0)
                self._connected.set()

    def stop(self) -> None:
        if self._process is None:
            return
        if self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._process.kill()
                self._process.wait()
        self._process = None
