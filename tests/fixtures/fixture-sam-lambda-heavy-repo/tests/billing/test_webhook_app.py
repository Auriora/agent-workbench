from src.billing.webhook import app


def test_webhook_handler_returns_response():
    assert app.handler({}, None)["statusCode"] == 202
