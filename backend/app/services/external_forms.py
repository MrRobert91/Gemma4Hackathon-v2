from __future__ import annotations

from urllib.parse import urlparse

from app.services.google_forms import GoogleFormError, import_google_form, submit_google_form
from app.services.microsoft_forms import MICROSOFT_FORM_HOSTS, import_microsoft_form, submit_microsoft_form


GOOGLE_FORM_HOSTS = {"docs.google.com"}


def detect_form_provider(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host in GOOGLE_FORM_HOSTS and "/forms/" in urlparse(url).path:
        return "google"
    if host in MICROSOFT_FORM_HOSTS:
        return "microsoft"
    raise GoogleFormError("Proveedor de formulario no soportado. Usa una URL de Google Forms o Microsoft Forms.")


def import_external_form(url: str):
    provider = detect_form_provider(url)
    if provider == "google":
        return import_google_form(url)
    return import_microsoft_form(url)


def submit_external_form(url: str, answers: dict[str, list[str]]):
    provider = detect_form_provider(url)
    if provider == "google":
        form = import_google_form(url)
        return submit_google_form(form, answers)

    form = import_microsoft_form(url)
    return submit_microsoft_form(form, answers)
