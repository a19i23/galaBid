const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    ["/auth", "/api", "/webhooks"],
    createProxyMiddleware({
      target: "http://localhost:8080",
      changeOrigin: true,
      // So cookies set by the backend are stored for localhost (dev server port)
      cookieDomainRewrite: "localhost",
    })
  );
};
