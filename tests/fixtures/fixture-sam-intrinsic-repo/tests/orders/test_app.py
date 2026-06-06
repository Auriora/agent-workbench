from src.orders import app


def test_handler_returns_created():
    assert app.handler({}, None)["statusCode"] == 201
