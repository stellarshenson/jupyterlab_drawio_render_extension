import json
import os

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from tornado.web import StaticFileHandler


class HelloRouteHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": (
                "Hello, world!"
                " This is the '/jupyterlab-drawio-render-extension/hello' endpoint."
            ),
        }))


def setup_route_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Static files directory
    static_path = os.path.join(os.path.dirname(__file__), "static")

    # Route patterns
    hello_route_pattern = url_path_join(base_url, "jupyterlab-drawio-render-extension", "hello")
    static_route_pattern = url_path_join(base_url, "jupyterlab-drawio-render-extension", "static", "(.*)")

    handlers = [
        (hello_route_pattern, HelloRouteHandler),
        (static_route_pattern, StaticFileHandler, {"path": static_path}),
    ]

    web_app.add_handlers(host_pattern, handlers)
