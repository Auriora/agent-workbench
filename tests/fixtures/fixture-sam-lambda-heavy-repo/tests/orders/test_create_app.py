from src.orders.create import app


def test_create_handler_returns_response():
    assert app.handler({}, None)["statusCode"] == 201
