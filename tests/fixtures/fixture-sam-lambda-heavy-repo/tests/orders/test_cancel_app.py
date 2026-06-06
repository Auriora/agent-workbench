from src.orders.cancel import app


def test_cancel_handler_returns_response():
    assert app.handler({}, None)["statusCode"] == 200
