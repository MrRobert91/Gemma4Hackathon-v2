import httpx

from app.services.microsoft_forms import (
    extract_microsoft_form_id,
    import_microsoft_form_from_html,
    submit_microsoft_form,
)


SAMPLE_MICROSOFT_HTML = """
<html>
  <head>
    <script>
      window.__MS_FORMS_BOOTSTRAP__ = {
        "formId": "ms-form-123",
        "title": "Revision diaria",
        "submitUrl": "https://forms.office.com/formapi/api/demo/forms('ms-form-123')/responses",
        "questions": [
          {
            "id": "q1",
            "title": "Como estas?",
            "type": "Choice",
            "allowMultiple": true,
            "choices": [{"id": "a", "title": "Tengo sed"}, {"id": "b", "title": "Tengo frio"}]
          },
          {
            "id": "q2",
            "title": "Quieres descansar?",
            "type": "Choice",
            "allowMultiple": false,
            "choices": ["Si", "No"]
          }
        ]
      };
    </script>
  </head>
</html>
"""


def test_extract_microsoft_form_id_from_common_urls():
    assert extract_microsoft_form_id("https://forms.office.com/r/abc123") == "abc123"
    assert extract_microsoft_form_id("https://forms.office.com/Pages/ResponsePage.aspx?id=form-id-456") == "form-id-456"


def test_import_microsoft_form_from_html_maps_choice_questions():
    form = import_microsoft_form_from_html("ms-form-123", SAMPLE_MICROSOFT_HTML)

    assert form.provider == "microsoft"
    assert form.title == "Revision diaria"
    assert form.submit_url.endswith("/responses")
    assert [question.title for question in form.questions] == ["Como estas?", "Quieres descansar?"]
    assert form.questions[0].type == "checkbox"
    assert form.questions[1].type == "radio"
    assert [option.label for option in form.questions[0].options] == ["Tengo sed", "Tengo frio"]


def test_submit_microsoft_form_posts_answer_payload():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"ok": True})

    form = import_microsoft_form_from_html("ms-form-123", SAMPLE_MICROSOFT_HTML)
    result = submit_microsoft_form(
        form,
        {"q1": ["Tengo sed"], "q2": ["No"]},
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert result.submitted is True
    body = requests[0].content.decode()
    assert "Tengo sed" in body
    assert "No" in body
