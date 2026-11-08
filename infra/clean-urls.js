function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/") {
    return request;
  }

  if (uri.endsWith("/")) {
    uri = uri.slice(0, -1);
  }

  var lastSegment = uri.substring(uri.lastIndexOf("/") + 1);
  request.uri = lastSegment.indexOf(".") === -1 ? uri + ".html" : uri;

  return request;
}
