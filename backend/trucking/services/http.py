"""Shared HTTP session: keep-alive connection reuse removes repeated TLS handshakes to the same hosts."""

from __future__ import annotations

import requests
from requests.adapters import HTTPAdapter

_session = requests.Session()
_adapter = HTTPAdapter(pool_connections=8, pool_maxsize=32)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)


def get(url: str, *, params: dict, timeout: float) -> requests.Response:
    """GET through the pooled session (plain GETs only; no cookies or auth state are used)."""
    return _session.get(url, params=params, timeout=timeout)
