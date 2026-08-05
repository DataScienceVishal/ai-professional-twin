"""Backend application package.

``pyproject.toml`` is the single source of truth for the version number; the
FastAPI app title and the ``/health`` payload both read ``__version__`` from
here so the three can never drift apart again.
"""

import tomllib
from pathlib import Path

_PYPROJECT_PATH = Path(__file__).resolve().parent.parent / "pyproject.toml"
_FALLBACK_VERSION = "0.0.0"


def _read_version(path: Path = _PYPROJECT_PATH) -> str:
    try:
        with path.open("rb") as handle:
            data = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError):
        return _FALLBACK_VERSION
    project = data.get("project")
    version = project.get("version") if isinstance(project, dict) else None
    return version if isinstance(version, str) else _FALLBACK_VERSION


__version__ = _read_version()
