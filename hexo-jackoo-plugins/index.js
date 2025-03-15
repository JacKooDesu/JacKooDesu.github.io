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
