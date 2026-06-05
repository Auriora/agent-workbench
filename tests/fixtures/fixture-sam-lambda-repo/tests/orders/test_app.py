from src.orders import app


def test_handler_returns_response():
    assert app.handler({}, None)["statusCode"] == 200
