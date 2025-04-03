// import Hexo from "hexo";
var fs = require("hexo-fs");

hexo.extend.generator.register("js", function (locals) {
  return {
    path: "js/resize_image.js",
    data: function () {
      return fs.createReadStream("hexo-jackoo-plugins/js/resize_image.js");
    },
  };
});

hexo.extend.injector.register(
  "body_end",
  '<script src="/js/resize_image.js"></script>',
  "default"
);

// inject mathjax
hexo.extend.generator.register("js", function (locals) {
  return {
    path: "js/mathjax.js",
    data: function () {
      return fs.createReadStream("hexo-jackoo-plugins/js/mathjax.js");
    },
  };
});

hexo.extend.injector.register(
  "body_end",
  "<script src=/js/mathjax.js></script>",
  "default"
);

// inject swup script loader
hexo.extend.generator.register("js", function (locals) {
  return {
    path: "js/script_loader.js",
    data: function () {
      return fs.createReadStream("hexo-jackoo-plugins/js/script_loader.js");
    },
  };
});

hexo.extend.injector.register(
  "body_end",
  '<script src="/js/script_loader.js"></script>',
  "default"
);
