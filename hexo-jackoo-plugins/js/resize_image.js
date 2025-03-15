// author: https://github.com/bobcn/hexo_resize_image.js

function set_image_size(image, width, height) {
  image.setAttribute("width", width + "px");
  image.setAttribute("height", height + "px");
}

function update_image_size(img) {
  var src = img.getAttribute("src").toString();

  var fields = src.match(/(?<=\?)\d*x\d*/g);
  if (fields && fields.length == 1) {
    var values = fields[0].split("x");
    if (values.length == 2) {
      var width = values[0];
      var height = values[1];

      if (!(width.length && height.length)) {
        var n_width = img.naturalWidth;
        var n_height = img.naturalHeight;
        if (width.length > 0) {
          height = (n_height * width) / n_width;
        }
        if (height.length > 0) {
          width = (n_width * height) / n_height;
        }
      }
      set_image_size(img, width, height);
    }
    return;
  }

  fields = src.match(/(?<=\?)\d*/g);
  if (fields && fields.length == 1) {
    var scale = parseFloat(fields[0].toString());
    var width = (scale / 100.0) * img.naturalWidth;
    var height = (scale / 100.0) * img.naturalHeight;
    set_image_size(img, width, height);
  }
}

function hexo_resize_image() {
  let counter = 0;
  const config = {
      attributeFilter: ["lazyload"],
      attributes: true,
    },
    lazyloadObserver = new MutationObserver((ms) => {
      ms.forEach((m) => {
        m.target.onload = () => update_image_size(m.target);
      });
      counter--;
      if (counter <= 0) lazyloadObserver.disconnect();
    });

  document.querySelectorAll("img").forEach((img) => {
    if (img.hasAttribute("lazyload")) {
      lazyloadObserver.observe(img, config);
      counter++;
    } else update_image_size(img);
  });
}

window.onload = hexo_resize_image;
