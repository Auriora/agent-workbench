from src.payments import notifier


def test_notifier_returns_queued():
    assert notifier.handler({}, None)["statusCode"] == 202
