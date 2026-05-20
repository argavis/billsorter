"""Speichert Rechnungs-Anhänge in Monats-Unterordner (Januar 2026, Februar 2026, ...)."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

MONTH_NAMES_DE: dict[int, str] = {
    1: "Januar", 2: "Februar", 3: "März", 4: "April",
    5: "Mai", 6: "Juni", 7: "Juli", 8: "August",
    9: "September", 10: "Oktober", 11: "November", 12: "Dezember",
}

MONTH_NAMES_EN: dict[int, str] = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}


def target_folder(root: Path, when: datetime, locale: str = "de") -> Path:
    names = MONTH_NAMES_DE if locale == "de" else MONTH_NAMES_EN
    folder = root / f"{names[when.month]} {when.year}"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def save_attachment(folder: Path, filename: str, content: bytes) -> tuple[Path, bool]:
    """Speichert eine Datei. Returns (final_path, was_newly_written).

    Bei Duplikat (gleicher Name) wird nicht überschrieben — returns (path, False).
    """
    safe_name = sanitize_filename(filename)
    target = folder / safe_name
    if target.exists():
        return target, False
    target.write_bytes(content)
    return target, True


def sanitize_filename(name: str) -> str:
    # Verbotene Zeichen entfernen, Length-Limit
    illegal = '<>:"|?*\x00'
    cleaned = "".join("_" if ch in illegal else ch for ch in name).strip()
    cleaned = cleaned.replace("/", "_").replace("\\", "_")
    if not cleaned:
        cleaned = "unbekannt.bin"
    return cleaned[:240]
