"""Google Sheets metadata + preview for connection UX."""

from __future__ import annotations

from googleapiclient.errors import HttpError

from app.core.google_credentials import get_service_account_email
from google_sheets.client import GoogleSheetsClient
from google_sheets.column_detect import (
    detect_column_mapping,
    validate_mapping,
)
from google_sheets.sheet_range import (
    build_data_range,
    parse_spreadsheet_id,
    spreadsheet_edit_url,
)


class SheetsDiscoveryError(Exception):
    """User-friendly discovery failure."""


class SheetsDiscoveryService:
    """List tabs and preview rows without changing sync pipeline."""

    def __init__(self, client: GoogleSheetsClient | None = None) -> None:
        self._client = client or GoogleSheetsClient()

    def resolve_spreadsheet_id(self, url_or_id: str) -> str:
        sheet_id = parse_spreadsheet_id(url_or_id)
        if not sheet_id:
            raise SheetsDiscoveryError(
                "We couldn't read this Google Sheet. Paste a full link from your browser."
            )
        return sheet_id

    def inspect_url(self, url_or_id: str) -> dict:
        sheet_id = self.resolve_spreadsheet_id(url_or_id)
        try:
            tabs = self.list_tabs(sheet_id)
        except HttpError as exc:
            raise self._http_error(exc) from exc
        if not tabs:
            raise SheetsDiscoveryError("This spreadsheet has no tabs.")
        return {
            "spreadsheet_id": sheet_id,
            "spreadsheet_url": spreadsheet_edit_url(sheet_id),
            "tabs": tabs,
        }

    def list_tabs(self, spreadsheet_id: str) -> list[str]:
        meta = (
            self._client.service.spreadsheets()
            .get(
                spreadsheetId=spreadsheet_id,
                fields="sheets.properties.title",
            )
            .execute()
        )
        sheets = meta.get("sheets", [])
        titles: list[str] = []
        for sheet in sheets:
            title = (sheet.get("properties") or {}).get("title")
            if title:
                titles.append(str(title))
        return titles

    def preview_tab(
        self,
        spreadsheet_id: str,
        sheet_name: str,
        *,
        max_rows: int = 5,
    ) -> dict:
        data_range = build_data_range(sheet_name)
        try:
            result = (
                self._client.service.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=data_range)
                .execute()
            )
        except HttpError as exc:
            raise self._http_error(exc) from exc

        values: list[list[str]] = result.get("values", [])
        if not values:
            raise SheetsDiscoveryError(
                f"Tab “{sheet_name}” looks empty. Pick another tab or add a header row."
            )

        headers = [str(c).strip() for c in values[0]]
        if not any(headers):
            raise SheetsDiscoveryError("First row must contain column headers.")

        preview_rows = [
            [str(c).strip() for c in row]
            for row in values[1 : 1 + max_rows]
        ]
        mapping = detect_column_mapping(headers)
        missing = validate_mapping(headers, mapping)
        suggested_range = build_data_range(sheet_name)

        return {
            "sheet_name": sheet_name,
            "headers": headers,
            "preview_rows": preview_rows,
            "column_mapping": mapping,
            "missing_required": missing,
            "suggested_range": suggested_range,
        }

    @staticmethod
    def _http_error(exc: HttpError) -> SheetsDiscoveryError:
        if exc.resp.status == 403:
            email = get_service_account_email()
            return SheetsDiscoveryError(
                f"We can't access this spreadsheet. Share it with {email} "
                f"(Editor or Viewer) in Google Sheets → Share, then try again."
            )
        if exc.resp.status == 404:
            return SheetsDiscoveryError(
                "Spreadsheet not found. Check the link and sharing permissions."
            )
        return SheetsDiscoveryError(
            "We couldn't read this Google Sheet. Check the link and try again."
        )
