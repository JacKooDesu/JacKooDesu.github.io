function loadScript() {
  let swupContent = document.getElementById("swup");

  [...swupContent.getElementsByTagName("xscript")].forEach((e) => {
    let script = document.createElement("script");
    script.src = e.getAttribute("src");
    script.innerHTML = e.innerHTML;

    e.parentNode.replaceChild(script, e);
    // swupContent.appendChild(script);
  });
}

swup.hooks.on("page:view", loadScript);
document.addEventListener('DOMContentLoaded', loadScript);

console.log("swup script loader");