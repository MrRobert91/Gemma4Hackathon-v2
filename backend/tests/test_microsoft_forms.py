import httpx

from app.services.microsoft_forms import (
    extract_microsoft_form_id,
    import_microsoft_form,
    import_microsoft_form_from_html,
    import_microsoft_form_from_runtime_json,
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

SAMPLE_MICROSOFT_RUNTIME_JSON = {
    "id": "runtime-form-123",
    "title": "CUESTIONARIO SOBRE OCIO Y TIEMPO LIBRE",
    "questions": [
        {
            "id": "r5bd0ee570ab347c0af336ee7b2ce0ee6",
            "title": "En los ultimos 3 meses, con que frecuencia has salido?",
            "type": "Question.Choice",
            "choices": [],
            "questionInfo": "{\"Choices\":[{\"Description\":\"Nunca\"},{\"Description\":\"1 a 3 veces\"}],\"ChoiceType\":1}",
        },
        {
            "id": "rff1adf04be3b42f4b9e1e178",
            "title": "Que te ayudaria mas?",
            "type": "Question.Choice",
            "choices": [],
            "questionInfo": "{\"Choices\":[{\"Description\":\"Mas apoyo\"},{\"Description\":\"Mejor transporte\"}],\"ChoiceType\":2}",
        },
    ],
}


def test_extract_microsoft_form_id_from_common_urls():
    assert extract_microsoft_form_id("https://forms.office.com/r/abc123") == "abc123"
    assert extract_microsoft_form_id("https://forms.cloud.microsoft/e/7S9B6Yur2E?origin=lprLink") == "7S9B6Yur2E"
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


def test_import_microsoft_form_from_runtime_json_maps_question_info_choices():
    form = import_microsoft_form_from_runtime_json("runtime-form-123", SAMPLE_MICROSOFT_RUNTIME_JSON)

    assert form.title == "CUESTIONARIO SOBRE OCIO Y TIEMPO LIBRE"
    assert form.questions[0].type == "radio"
    assert [option.label for option in form.questions[0].options] == ["Nunca", "1 a 3 veces"]
    assert form.questions[1].type == "checkbox"
    assert [option.label for option in form.questions[1].options] == ["Mas apoyo", "Mejor transporte"]


def test_import_microsoft_form_from_runtime_json_sorts_questions_by_order():
    form = import_microsoft_form_from_runtime_json(
        "runtime-form-123",
        {
            "title": "Orden",
            "questions": [
                {
                    "id": "q-b",
                    "title": "Segunda",
                    "order": 200,
                    "type": "Question.Choice",
                    "questionInfo": "{\"Choices\":[{\"Description\":\"B\"}],\"ChoiceType\":1}",
                },
                {
                    "id": "q-a",
                    "title": "Primera",
                    "order": 100,
                    "type": "Question.Choice",
                    "questionInfo": "{\"Choices\":[{\"Description\":\"A\"}],\"ChoiceType\":1}",
                },
            ],
        },
    )

    assert [question.title for question in form.questions] == ["Primera", "Segunda"]


def test_import_microsoft_form_prefers_runtime_payload_over_ambiguous_html():
    html = """
    <html>
      <body>
        <script>
          window.__MS_FORMS_BOOTSTRAP__ = {
            "title": "HTML ambiguo",
            "questions": [
              {
                "id": "html-q",
                "title": "Pregunta HTML",
                "type": "Question.Choice",
                "questionInfo": "{\\"Choices\\":[{\\"Description\\":\\"HTML\\"}],\\"ChoiceType\\":1}"
              }
            ]
          };
          window.__RUNTIME__ = {
            "prefetchFormUrl": "https://forms.cloud.microsoft/formapi/api/runtimeForms(\\u0027demo\\u0027)?$expand=questions($expand=choices)"
          };
        </script>
      </body>
    </html>
    """
    runtime_json = {
        "title": "Runtime correcto",
        "questions": [
            {
                "id": "runtime-b",
                "title": "Segunda",
                "order": 200,
                "type": "Question.Choice",
                "questionInfo": "{\"Choices\":[{\"Description\":\"B\"}],\"ChoiceType\":1}",
            },
            {
                "id": "runtime-a",
                "title": "Primera",
                "order": 100,
                "type": "Question.Choice",
                "questionInfo": "{\"Choices\":[{\"Description\":\"A\"}],\"ChoiceType\":1}",
            },
        ],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if "runtimeForms('demo')" in str(request.url):
            return httpx.Response(200, json=runtime_json)
        return httpx.Response(200, text=html)

    form = import_microsoft_form(
        "https://forms.cloud.microsoft/e/demo",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert form.title == "Runtime correcto"
    assert [question.title for question in form.questions] == ["Primera", "Segunda"]


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
